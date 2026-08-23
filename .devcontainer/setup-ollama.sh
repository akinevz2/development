#!/bin/bash
# Setup script to install ollama CLI and configure it to connect to ws-rarebox

set -e

# Check for zstd (required by ollama for model operations)
if ! command -v zstd &> /dev/null; then
    echo "⚠ zstd is not installed. Ollama requires zstd for model operations."
    echo "  Install with: sudo apt-get install -y zstd"
    exit 1
fi

# Install ollama CLI if not present
if ! command -v ollama &> /dev/null; then
    echo "Installing ollama CLI..."
    curl -fsSL https://ollama.com/install.sh | sh
else
    echo "Ollama CLI already installed"
fi

# Verify ollama can connect to host
echo "Testing connection to Ollama on host..."
if ollama list &> /dev/null; then
    echo "✓ Successfully connected to Ollama on host"
    ollama list
else
    echo "⚠ Could not connect to Ollama on ws-rarebox:11434"
    echo "  Make sure Ollama is running with OLLAMA_HOST=0.0.0.0:11434"
fi

echo "Ollama CLI setup complete!"
echo "Ollama binary: $(which ollama)"
echo "OLLAMA_HOST: ${OLLAMA_HOST:-http://ws-rarebox:11434}"
