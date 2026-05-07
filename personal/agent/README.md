# Hardware Inventory Agent

A local AI assistant for your `hardware_inventory.md` that runs the CLI in Docker and uses a Windows-hosted Ollama model over its OpenAI-compatible API. No Python on Windows required.

## Requirements

| Requirement | Notes |
|---|---|
| Windows 11 + WSL2 | Ubuntu 22.04 recommended |
| Docker Desktop | Enable WSL2 backend in settings |
| Ollama on Windows | Must be running and reachable from WSL on port 11434 |
| Model capacity | `qwen3.6:35b-a3b` is large; make sure the Windows box has enough RAM/VRAM for it |

## First-Time Setup

```bash
# 1. Clone / copy this folder somewhere in WSL
#    e.g. ~/projects/inventory-agent

# 2. Make sure Ollama is running on Windows
#    In PowerShell:
#    ollama serve
#    ollama pull qwen3.6:35b-a3b

# 3. Put your inventory file in the data/ subfolder (or pass the path as an arg)
mkdir -p data
cp /mnt/c/Users/YourName/hardware_inventory.md data/

# 4. Make the launcher executable
chmod +x inventory-chat.sh

# 5. Run it
./inventory-chat.sh
# Or point at a specific file:
./inventory-chat.sh /mnt/c/Users/YourName/Documents/hardware_inventory.md
```

The script will:
1. Build the tiny agent Docker image
2. Check that Ollama is reachable from WSL
3. Start the CLI container and point it at Ollama's OpenAI-compatible endpoint
4. Drop you into the CLI chat

By default the launcher auto-detects Ollama from WSL (`localhost` first, then the WSL default gateway), then the container connects to `http://host.docker.internal:11434/v1`.
If your setup differs, override one or both:

```bash
OLLAMA_HOST=http://<windows-host-ip>:11434 \
LLM_BASE_URL=http://<windows-host-ip>:11434/v1 \
./inventory-chat.sh
```

## Usage

```
❯ What GPU is in Era 2?
❯ What's my estimated net profit after all sales?
❯ Move the i7-8086K from Golden Field to Terra and update the action items
❯ Mark "Install fans into Golden Field" as done
❯ Generate an eBay listing for the Aorus B450I
❯ Write a Facebook Marketplace ad for the mATX bundle
❯ changelog    ← view edit history
❯ reload       ← re-read file from disk
❯ exit
```

**Intent detection** is automatic:
- Questions → Q&A mode (multi-turn conversation with context)
- Edit requests → shows a diff, asks for confirmation before writing
- "listing" / "eBay" / "marketplace" → generates a full listing, optionally saves to file

## Ollama Notes

The agent speaks plain OpenAI-compatible chat completions, so any Ollama model tag that works with the `/v1` API should work here.

Default model:

- `qwen3.6:35b-a3b`

Override it per launch:

```bash
MODEL_NAME=qwen3.6:14b ./inventory-chat.sh
MODEL_NAME=llama3.3:70b ./inventory-chat.sh
```

If a very large model feels slow or fails to load, try a smaller tag first to confirm networking and endpoint wiring are correct.

## Changing the Model

Set `MODEL_NAME` when launching:

```bash
MODEL_NAME=qwen3.6:14b ./inventory-chat.sh
```

Popular alternatives:
- `qwen3.6:14b`
- `llama3.1:8b`
- `mistral-small3.1`

## Files

```
inventory-agent/
├── inventory-chat.sh       ← WSL launcher (run this)
├── docker-compose.yml      ← agent service wired to desktop Ollama
├── Dockerfile.agent        ← minimal Python agent image
├── inventory_agent.py      ← the agent (runs inside container)
├── .devcontainer/
│   └── devcontainer.json   ← VS Code devcontainer (optional)
└── data/
    ├── hardware_inventory.md           ← your file (mounted into container)
    └── hardware_inventory_changelog.md ← auto-created on first edit
```
