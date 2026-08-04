# Opencode Fleet Configuration

## Machines Configured

| Provider | Machine | VRAM | Connection URL | Notes |
|----------|---------|------|----------------|-------|
| ollama_wsrarebox | WS-RAREBOX (24GB) | http://ws-rarebox.lan:11434/v1 | ✅ Working - v0.32.5 |
| ollama_v9mini | V9-MINI (16GB) | http://v9-mini.lan:11434/v1 | 🟡 Needs verification (TailScale required) |
| ollama_wsvision | WS-VISION (8GB) | http://ws-vision.lan:11434/v1 | 🟡 Needs verification (TailScale required) |

## Usage

### Using a specific provider
Set the model in format `provider/model-name`:
- `ollama_wsrarebox/laguna-xs-2.1:latest` (current default)
- `ollama_v9mini/Qwen3-72B-int4` (for 16GB VRAM models)
- `ollama_wsvision/laguma-xs-2.1:q4_K_M` (smaller quantized models for 8GB)

### Available Models on WS-RAREBOX:
- laguna-xs-2.1:latest, q8_0, q4_K_M
- laguna-s-2.1:q4_K_M  
- laguna-tame:latest
- glm-4.7-flash:latest
- glm-5.2:cloud (API)

### Skills

#### check-machines
Check connectivity of any fleet machine:
```bash
@check-machines ws-rarebox.lan
@check-machines v9-mini.lan
@check-machines ws-vision.lan
```

## Setup Instructions for Worker Machines

Ensure Ollama is running on each machine and accessible via the configured URL. 

For TailScale network access:
1. Install tailscale on worker machines if not already installed
2. Connect to your tail scale network
3. Verify connectivity from this workspace