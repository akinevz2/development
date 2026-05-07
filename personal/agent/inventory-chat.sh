#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# inventory-chat.sh
# Run from WSL. Builds the agent container and connects it to a Windows-hosted
# Ollama instance via Docker Compose.
# Usage: ./inventory-chat.sh [path/to/hardware_inventory.md]
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_INVENTORY="$SCRIPT_DIR/data/hardware_inventory.md"
INVENTORY_FILE="$DEFAULT_INVENTORY"
OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
LLM_BASE_URL="${LLM_BASE_URL:-http://host.docker.internal:11434/v1}"
MODEL_NAME="${MODEL_NAME:-qwen3.6:35b-a3b}"

usage() {
    cat <<'EOF'
Usage: ./inventory-chat.sh [path/to/hardware_inventory.md]

Environment overrides:
    OLLAMA_HOST   Base URL used for the WSL-side health check. Default: auto-detect
  LLM_BASE_URL  OpenAI-compatible base URL passed into the agent container.
                Default: http://host.docker.internal:11434/v1
  MODEL_NAME    Ollama model tag to use. Default: qwen3.6:35b-a3b
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            usage
            exit 0
            ;;
        *)
            if [[ "$INVENTORY_FILE" != "$DEFAULT_INVENTORY" ]]; then
                echo "ERROR: Multiple inventory paths provided."
                usage
                exit 1
            fi
            INVENTORY_FILE="$1"
            shift
            ;;
    esac
done

# ── Resolve absolute path ──────────────────────────────────────────────────────
INVENTORY_FILE="$(realpath "$INVENTORY_FILE")"
INVENTORY_DIR="$(dirname "$INVENTORY_FILE")"

if [[ ! -f "$INVENTORY_FILE" ]]; then
    echo "ERROR: Inventory file not found: $INVENTORY_FILE"
    usage
    exit 1
fi

# ── Check dependencies ─────────────────────────────────────────────────────────
for cmd in docker curl; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "ERROR: '$cmd' is not installed or not in PATH."
        echo "Install Docker Desktop with WSL2 backend and curl in your distro."
        exit 1
    fi
done

# ── Check Ollama availability from WSL ────────────────────────────────────────
echo "── Checking Ollama from WSL ──────────────────────────────────────────────"

resolve_default_gateway() {
    ip route | awk '/^default/ {print $3; exit}'
}

if [[ -z "${OLLAMA_HOST:-}" || "$OLLAMA_HOST" == "http://localhost:11434" ]]; then
    GATEWAY_IP="$(resolve_default_gateway || true)"
    CANDIDATES=("http://localhost:11434")
    if [[ -n "$GATEWAY_IP" ]]; then
        CANDIDATES+=("http://${GATEWAY_IP}:11434")
    fi

    FOUND_HOST=""
    for candidate in "${CANDIDATES[@]}"; do
        if curl -fsS "$candidate/api/tags" >/dev/null 2>&1; then
            FOUND_HOST="$candidate"
            break
        fi
    done

    if [[ -z "$FOUND_HOST" ]]; then
        echo "ERROR: Could not reach Ollama from WSL."
        echo ""
        echo "Tried:"
        for candidate in "${CANDIDATES[@]}"; do
            echo "  - $candidate"
        done
        echo ""
        echo "Verify on Windows:"
        echo "  1) Ollama is running"
        echo "  2) The service is listening on port 11434"
        echo ""
        echo "Then retry with a manual override, for example:"
        echo "  OLLAMA_HOST=http://<windows-host-ip>:11434 $0 ${INVENTORY_FILE}"
        exit 2
    fi

    OLLAMA_HOST="$FOUND_HOST"
else
    if ! curl -fsS "$OLLAMA_HOST/api/tags" >/dev/null; then
        echo "ERROR: Could not reach Ollama at $OLLAMA_HOST"
        echo ""
        echo "Verify on Windows:"
        echo "  1) Ollama is running"
        echo "  2) The service is listening on port 11434"
        echo ""
        echo "Or rerun with a different host, for example:"
        echo "  OLLAMA_HOST=http://<windows-host-ip>:11434 $0 ${INVENTORY_FILE}"
        exit 2
    fi
fi

# ── Export env for Compose ─────────────────────────────────────────────────────
export INVENTORY_DIR
export LLM_BASE_URL
export MODEL_NAME

# ── Build agent image if needed ────────────────────────────────────────────────
echo "── Building agent image (cached after first run) ────────────────────────"
docker compose -f "$SCRIPT_DIR/docker-compose.yml" build agent --quiet

# ── Launch agent ──────────────────────────────────────────────────────────────
echo "── Launching inventory agent ─────────────────────────────────────────────"
echo "   Inventory: $INVENTORY_FILE"
echo "   Changelog: $INVENTORY_DIR/hardware_inventory_changelog.md"
echo "   Ollama check: $OLLAMA_HOST"
echo "   Agent endpoint: $LLM_BASE_URL"
echo "   Model: $MODEL_NAME"
echo ""

# Run agent container interactively, mounting the inventory dir
docker compose -f "$SCRIPT_DIR/docker-compose.yml" run --rm \
    -e INVENTORY_DIR="$INVENTORY_DIR" \
    agent
