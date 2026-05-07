#!/usr/bin/env python3
"""
Hardware Inventory Agent
Runs inside Docker, talks to an OpenAI-compatible LLM endpoint, reads/writes the
.md file on the host via bind mount.
Features: Q&A, suggest+apply edits, changelog, eBay listing generation.
"""

import os
import sys
import re
import json
import textwrap
from datetime import datetime
from pathlib import Path

from openai import OpenAI
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.prompt import Prompt, Confirm
from rich.syntax import Syntax
from rich.rule import Rule
from rich import box
from prompt_toolkit import prompt as pt_prompt
from prompt_toolkit.history import InMemoryHistory
from prompt_toolkit.styles import Style

# ── Config ────────────────────────────────────────────────────────────────────
LLM_BASE_URL    = os.environ.get("LLM_BASE_URL", "http://host.docker.internal:11434/v1")
MODEL_NAME      = os.environ.get("MODEL_NAME", "qwen3.6:35b-a3b")
INVENTORY_PATH  = Path(os.environ.get("INVENTORY_PATH", "/data/hardware_inventory.md"))
CHANGELOG_PATH  = Path(os.environ.get("CHANGELOG_PATH", "/data/hardware_inventory_changelog.md"))

console = Console()
client  = OpenAI(base_url=LLM_BASE_URL, api_key="not-needed")

# ── Helpers ───────────────────────────────────────────────────────────────────

def load_inventory() -> str:
    if not INVENTORY_PATH.exists():
        console.print(f"[red]Inventory file not found:[/] {INVENTORY_PATH}")
        sys.exit(1)
    return INVENTORY_PATH.read_text(encoding="utf-8")


def save_inventory(content: str) -> None:
    if not os.access(INVENTORY_PATH, os.W_OK):
        console.print(
            f"[red]Cannot write to inventory file:[/] {INVENTORY_PATH}\n"
            "[dim]Fix with: chmod 644 data/hardware_inventory.md[/]"
        )
        return
    INVENTORY_PATH.write_text(content, encoding="utf-8")


def append_changelog(entry: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    block = f"\n## {timestamp}\n{entry.strip()}\n"
    with open(CHANGELOG_PATH, "a", encoding="utf-8") as f:
        f.write(block)


def chat(messages: list[dict], stream: bool = True) -> str:
    """Call the configured chat endpoint, stream response, return full text."""
    full = []
    if stream:
        with client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            max_tokens=1024,
            temperature=0.3,
            stream=True,
        ) as stream_resp:
            for chunk in stream_resp:
                delta = chunk.choices[0].delta.content or ""
                print(delta, end="", flush=True)
                full.append(delta)
        print()  # newline after stream
    else:
        resp = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            max_tokens=1024,
            temperature=0.3,
        )
        full = [resp.choices[0].message.content]
    return "".join(full)


# ── Token budgeting ────────────────────────────────────────────────────────────

MAX_CONTEXT_TOKENS = 4096
MAX_OUTPUT_TOKENS  = 1024
# Available input budget: total context minus output reservation and a safety buffer
_INPUT_BUDGET = MAX_CONTEXT_TOKENS - MAX_OUTPUT_TOKENS - 64  # 3008 tokens


def _est_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token."""
    return max(1, len(text) // 4)


def _split_sentences(text: str) -> list[str]:
    """Split text on sentence-ending punctuation followed by whitespace."""
    parts = re.split(r'(?<=[.!?])\s+', text.strip())
    return [p for p in parts if p]


_TOO_LONG_PREFIX = "\x00TOO_LONG\x00"


def _chunk_input(user_input: str, reserved: int) -> list[str]:
    """
    Fit user_input into (_INPUT_BUDGET - reserved) tokens.
    - If it fits, returns [user_input].
    - If not, splits by sentence and batches sentences that fit.
    - Sentences that individually exceed the budget are returned as sentinel
      strings prefixed with _TOO_LONG_PREFIX so the caller can report them.
    Raises ValueError if there is no budget at all.
    """
    available = _INPUT_BUDGET - reserved
    if available <= 0:
        raise ValueError(
            f"No token budget remaining after system prompt and history "
            f"({reserved} tokens used, budget is {_INPUT_BUDGET})."
        )

    if _est_tokens(user_input) <= available:
        return [user_input]

    sentences = _split_sentences(user_input)
    chunks: list[str] = []
    current_parts: list[str] = []
    current_tokens = 0

    for sent in sentences:
        sent_tokens = _est_tokens(sent)
        if sent_tokens > available:
            if current_parts:
                chunks.append(" ".join(current_parts))
                current_parts, current_tokens = [], 0
            chunks.append(_TOO_LONG_PREFIX + sent)
            continue
        if current_tokens + sent_tokens > available:
            chunks.append(" ".join(current_parts))
            current_parts, current_tokens = [sent], sent_tokens
        else:
            current_parts.append(sent)
            current_tokens += sent_tokens

    if current_parts:
        chunks.append(" ".join(current_parts))

    return chunks


# ── System prompts ─────────────────────────────────────────────────────────────

def system_qa(inventory: str) -> str:
    return f"""You are an expert hardware inventory assistant.
The user's current hardware inventory (Markdown) is below.
Answer questions accurately and concisely. Reference specific parts, builds, and notes from the inventory.
If asked about something not in the inventory, say so clearly.

--- INVENTORY START ---
{inventory}
--- INVENTORY END ---"""


def system_edit(inventory: str) -> str:
    return f"""You are a hardware inventory editor.
The user's current inventory (Markdown) is below.
When asked to make a change, respond ONLY with a JSON object (no markdown fences) in this exact schema:
{{
  "summary": "One-line human description of the change",
  "search":  "The EXACT multi-line string in the original markdown to replace",
  "replace": "The new markdown string to substitute in"
}}
If the change requires adding new content with no existing anchor, set "search" to "" and "replace" to the new lines to append.
Never output anything other than this JSON object.

--- INVENTORY START ---
{inventory}
--- INVENTORY END ---"""


def system_ebay(inventory: str) -> str:
    return f"""You are a specialist eBay listing copywriter for used PC hardware sold in the UK.
The user's inventory (Markdown) is below — pay attention to the Sell List section.
When asked to generate a listing, produce a complete, compelling eBay listing with:
- A punchy, keyword-rich title (max 80 chars)
- Condition notes
- Full description with specs, compatibility, and honest condition
- Suggested starting price and Buy It Now price (GBP)
- Postage recommendation
Write naturally, not as bullet spam. Appeal to builders and upgraders.

--- INVENTORY START ---
{inventory}
--- INVENTORY END ---"""


# ── Edit flow ─────────────────────────────────────────────────────────────────

def apply_edit(inventory: str, user_request: str) -> str | None:
    """Ask model for a JSON edit patch, show diff, ask for confirmation, apply."""
    console.print("\n[dim]Thinking about edit...[/]")

    messages = [
        {"role": "system", "content": system_edit(inventory)},
        {"role": "user",   "content": user_request},
    ]
    try:
        raw = chat(messages, stream=False)
    except Exception as exc:
        console.print(f"[red]Request failed: {exc}[/]")
        return None

    # Strip accidental fences
    raw = re.sub(r"^```[a-z]*\n?", "", raw.strip(), flags=re.MULTILINE)
    raw = re.sub(r"\n?```$", "", raw.strip())

    try:
        patch = json.loads(raw)
    except json.JSONDecodeError:
        console.print(f"[red]Could not parse model edit response as JSON.[/]\nRaw:\n{raw}")
        return None

    summary = patch.get("summary", "(no summary)")
    search  = patch.get("search", "")
    replace = patch.get("replace", "")

    console.print(Panel(f"[bold]{summary}[/]", title="Proposed Edit", border_style="yellow"))

    if search:
        console.print("\n[red]─ REMOVE ─────────────────────────────────────────────[/]")
        console.print(Syntax(search,  "markdown", theme="monokai"))
        console.print("[green]─ ADD ────────────────────────────────────────────────[/]")
        console.print(Syntax(replace, "markdown", theme="monokai"))
    else:
        console.print("\n[green]─ APPEND ─────────────────────────────────────────────[/]")
        console.print(Syntax(replace, "markdown", theme="monokai"))

    if not Confirm.ask("\n[bold yellow]Apply this edit?[/]"):
        console.print("[dim]Edit discarded.[/]")
        return None

    if search:
        if search not in inventory:
            console.print("[red]Could not find the target text in inventory — no changes made.[/]")
            console.print("[dim]The model may have quoted text slightly differently. Try rephrasing.[/]")
            return None
        new_inventory = inventory.replace(search, replace, 1)
    else:
        new_inventory = inventory.rstrip() + "\n\n" + replace

    save_inventory(new_inventory)
    append_changelog(f"**Edit:** {summary}")
    console.print("[green]✓ Inventory updated and changelog appended.[/]")
    return new_inventory


# ── eBay listing flow ─────────────────────────────────────────────────────────

def generate_listing(inventory: str, user_request: str) -> None:
    console.print("\n[bold cyan]Generating eBay listing...[/]\n")
    messages = [
        {"role": "system", "content": system_ebay(inventory)},
        {"role": "user",   "content": user_request},
    ]
    try:
        listing_text = chat(messages, stream=True)
    except Exception as exc:
        console.print(f"[red]Request failed: {exc}[/]")
        return

    # Offer to save
    if Confirm.ask("\n[bold yellow]Save this listing to a file?[/]"):
        slug = re.sub(r"[^a-z0-9]+", "_", user_request[:40].lower()).strip("_")
        ts   = datetime.now().strftime("%Y%m%d_%H%M")
        out  = INVENTORY_PATH.parent / f"listing_{slug}_{ts}.txt"
        out.write_text(listing_text, encoding="utf-8")
        console.print(f"[green]✓ Saved to[/] {out}")


# ── Intent detection ──────────────────────────────────────────────────────────

EDIT_PATTERNS = re.compile(
    r"\b(update|change|edit|move|set|mark|add|remove|delete|rename|tick|check off|"
    r"complete|cross off|replace|swap|transfer|list as|selling|sold)\b",
    re.IGNORECASE,
)

EBAY_PATTERNS = re.compile(
    r"\b(listing|ebay|sell listing|facebook|marketplace|write a listing|generate listing|"
    r"draft listing|listing for|ad for)\b",
    re.IGNORECASE,
)

def detect_intent(text: str) -> str:
    """Returns 'edit', 'listing', or 'qa'."""
    if EBAY_PATTERNS.search(text):
        return "listing"
    if EDIT_PATTERNS.search(text):
        return "edit"
    return "qa"


# ── Main REPL ─────────────────────────────────────────────────────────────────

def main() -> None:
    console.print(Panel(
        "[bold white]Hardware Inventory Agent[/]\n"
        f"[dim]Powered by OpenAI-compatible API · {MODEL_NAME}[/]\n\n"
        "  [cyan]Ask questions[/] about your inventory\n"
        "  [yellow]Request edits[/] — review before they're written\n"
        "  [green]Generate eBay listings[/] for sell items\n"
        "  [dim]Type [bold]exit[/] or [bold]quit[/] to leave · [bold]reload[/] to re-read file[/]",
        border_style="bright_blue",
        box=box.DOUBLE_EDGE,
    ))

    inventory   = load_inventory()
    qa_history: list[dict] = []  # rolling context for Q&A turns
    pt_history  = InMemoryHistory()
    pt_style    = Style.from_dict({"prompt": "bold ansicyan"})

    while True:
        try:
            user_input = pt_prompt(
                "\n❯ ",
                history=pt_history,
                style=pt_style,
            ).strip()
        except (EOFError, KeyboardInterrupt):
            console.print("\n[dim]Bye.[/]")
            break

        if not user_input:
            continue

        low = user_input.lower()

        if low in {"exit", "quit", "q"}:
            console.print("[dim]Bye.[/]")
            break

        if low == "reload":
            inventory = load_inventory()
            qa_history.clear()
            console.print("[green]✓ Inventory reloaded from disk.[/]")
            continue

        if low == "changelog":
            if CHANGELOG_PATH.exists():
                console.print(Markdown(CHANGELOG_PATH.read_text(encoding="utf-8")))
            else:
                console.print("[dim]No changelog yet.[/]")
            continue

        if low == "help":
            console.print(Markdown(textwrap.dedent("""
                ## Commands
                - **exit / quit** — leave the agent
                - **reload** — re-read the inventory file from disk
                - **changelog** — show the change history
                - **help** — this message

                ## What you can ask
                - *"What GPU is in Era 2?"* — inventory Q&A
                - *"Move the 8086K from Golden Field to Terra"* — edit with confirmation
                - *"Mark 'Install fans into Golden Field' as done"* — tick off action items
                - *"Generate an eBay listing for the B450I"* — listing copywriting
                - *"Write a Facebook Marketplace ad for the mATX bundle"* — listing copywriting
            """)))
            continue

        intent = detect_intent(user_input)
        console.print(f"[dim]Intent: {intent}[/]")
        console.print(Rule(style="dim"))

        if intent == "edit":
            # Reload fresh before editing
            inventory = load_inventory()
            result = apply_edit(inventory, user_input)
            if result:
                inventory = result
                qa_history.clear()  # stale context after edit

        elif intent == "listing":
            generate_listing(inventory, user_input)

        else:  # qa — maintain rolling context
            reserved = _est_tokens(system_qa(inventory)) + sum(
                _est_tokens(m["content"]) for m in qa_history[-6:]
            )
            try:
                input_chunks = _chunk_input(user_input, reserved)
            except ValueError as exc:
                console.print(f"[red]Input too long: {exc}[/]")
                continue

            num_chunks = len([c for c in input_chunks if not c.startswith(_TOO_LONG_PREFIX)])
            if num_chunks > 1:
                console.print(f"[dim]Input split into {num_chunks} chunks.[/]")

            for chunk in input_chunks:
                if chunk.startswith(_TOO_LONG_PREFIX):
                    sent = chunk[len(_TOO_LONG_PREFIX):]
                    console.print(
                        f"[red]Sentence too long (~{_est_tokens(sent)} tokens), skipped:[/]\n"
                        f"[dim]{sent[:120]}{'...' if len(sent) > 120 else ''}[/]"
                    )
                    continue

                qa_history.append({"role": "user", "content": chunk})
                messages = [
                    {"role": "system", "content": system_qa(inventory)},
                    *qa_history[-6:],  # last 3 turns to stay within context
                ]
                console.print()
                try:
                    reply = chat(messages, stream=True)
                except Exception as exc:
                    console.print(f"[red]Request failed: {exc}[/]")
                    qa_history.pop()  # remove the user message we just appended
                    continue
                qa_history.append({"role": "assistant", "content": reply})


if __name__ == "__main__":
    main()
