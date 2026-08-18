---
name: exam-revision
description: Use when preparing exam revision material in this repo (uni/ coursework, lecture notes, past papers, PDFs). Generates structured revision notes, practice questions with answer keys, and exports to Anki TSV, Markdown, or PDF. Always runs the agent on the Laguna XS 2.1 model hosted on the WS-RAREBOX ollama provider.
metadata:
  model: ollama_wsrarebox/laguna-xs-2.1:q8_0
  fallback_model: ollama_wsrarebox/laguna-xs-2.1:q4_K_M
---

# Exam Revision Skill

Always execute this skill on the **Laguna XS 2.1** model via the WS-RAREBOX
provider. The exact model id to use is:

```
ollama_wsrarebox/laguna-xs-2.1:q8_0
```

Prefer the `q8_0` quant for dense revision work (notes, long-form answers,
PDF export) — it fits comfortably in 24GB VRAM on WS-RAREBOX and gives the
highest fidelity. Fall back to `ollama_wsrarebox/laguna-xs-2.1:q4_K_M` only
when WS-RAREBOX is unreachable (verify first via the `@check-machines`
skill against `ws-rarebox`).

If the user has not specified a model, you MUST set the active model to
`ollama_wsrarebox/laguna-xs-2.1:q8_0` before doing any revision work. Do not
silently fall back to `glm-5.2:cloud` or any other provider for revision
generation.

## Inputs the user may provide

- One or more source files (lecture notes, PDFs, Markdown, code comments).
- An exam date and a list of topics with weights.
- A desired output format (Markdown, Anki TSV, or PDF).

If any of these are missing, ask for them with the `question` tool before
proceeding. Do not invent exam dates or topic weights.

## Workflow

Run these stages in order. Each stage writes its outputs into the relevant
course directory under `uni/<course>/revision/` so revision material is
version-controlled alongside the coursework.

### 1. Locate the course directory

- If the user names a course (e.g. `anlp`), work under `uni/<course>/`.
- If the user gives a source path, infer the course from the path's
  top-level `uni/` child. If it is not under `uni/`, ask the user to name
  the destination course directory.
- Create `uni/<course>/revision/<exam-slug>/` where `<exam-slug>` is
  derived from the exam title or `YYYY-MM-DD` exam date. Use kebab-case.

### 2. Generate revision notes

From the supplied source material, produce structured revision notes at
`uni/<course>/revision/<exam-slug>/notes.md`:

- Top-level sections per topic.
- Each topic section: key concepts, definitions, formulas, worked
  examples, common pitfalls.
- Preserve any mathematical notation as LaTeX in `$...$` / `$$...$$`
  so pandoc can render it.
- Cite source locations as `(see <file>:<line>)` anchors so the user can
  jump back.
- Do NOT fabricate content that is not in the source material. If a gap
  is found, emit a `> GAP:` blockquote listing what is missing and where
  to look it up.

### 3. Generate practice questions with answer keys

Produce two paired files:

- `questions.md` — numbered questions only, grouped by topic.
- `answers.md` — same numbering, full model answers with reasoning. For
  quantitative questions, show every step. For code-based questions,
  include runnable snippets.

Use a mix of question types: MCQ, short-answer, long-answer, and one
"past-paper-style" synthesis question per topic. For MCQs, mark the
correct option with `(correct)` in the answer key, not in the question
file. Do not leak answers into the question file.

### 4. Export to requested format

Default to Markdown output. If the user asks for another format:

- **Anki TSV**: emit `deck.tsv` with columns `Front<TAB>Back<TAB>Tags`.
  One card per row. Tags are `::<course>::<exam-slug>::<topic>`. Escape
  literal tabs and newlines inside fields. Generate one card per
  definition, formula, and worked example from the notes — do NOT
  generate one card per question.
- **PDF**: run `pandoc notes.md -o notes.pdf` with `--pdf-engine=xelatex`
  (the devcontainer already has `texlive-xetex` installed). For the
  question/answer pair, run `pandoc questions.md answers.md -o exam.pdf`
  using a front cover from the exam title and date. Write the PDFs
  into the same revision directory.

Always keep the Markdown source files even when exporting to other
formats, so the user can re-run pandoc after edits.

## Conventions

- Write all prose in the same voice as the existing coursework under
  `uni/<course>/` — check `uni/<course>/AGENTS.md` if present and follow
  any style rules it defines.
- Do not modify any source files under `uni/<course>/src`, `data/`, or
  `report/`. Revision material lives only under `revision/`.
- Never commit anything. Leave staging to the user.
- After each stage, print a one-line summary of what was written and
  where, so the user can review incrementally.

## Verification

Before declaring the skill complete:

1. Confirm `uni/<course>/revision/<exam-slug>/notes.md` exists and opens.
2. Confirm `questions.md` and `answers.md` exist and question numbers
   line up 1:1 with answers.
3. If Anki or PDF export was requested, confirm the exported file exists
   and is non-empty (use `ls -la`).
4. If anything failed, report the exact failure and stop — do not
   silently skip a stage.

## Edge cases

- **WS-RAREBOX unreachable**: after the `@check-machines ws-rarebox`
  probe fails, ask the user whether to (a) retry, (b) fall back to
  `laguna-xs-2.1:q4_K_M` on the same provider, or (c) abort. Do not
  silently switch providers — revision quality depends on the model.
- **No source material supplied**: refuse to generate; ask the user to
  point at lecture notes or past papers. Never fabricate course content.
- **Exam date in the past**: warn the user and continue only if they
  confirm.