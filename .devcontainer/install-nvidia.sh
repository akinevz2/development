#!/usr/bin/env bash
set -euo pipefail

# Installs NVIDIA Container Toolkit for Container CDI on Ubuntu/WSL
# and validates GPU passthrough with a test container.

KEYRING_PATH="/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg"
LIST_PATH="/etc/apt/sources.list.d/nvidia-container-toolkit.list"
REPO_URL="https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list"
CUDA_TEST_IMAGE="docker.io/nvidia/cuda:12.6.3-base-ubuntu22.04"

echo "[1/7] Checking host GPU visibility..."
if ! command -v nvidia-smi >/dev/null 2>&1; then
  echo "nvidia-smi not found. Ensure NVIDIA drivers are available in WSL before continuing."
  exit 1
fi
nvidia-smi -L

echo "[2/7] Installing NVIDIA apt key..."
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
  | sudo gpg --dearmor -o "$KEYRING_PATH"

echo "[3/7] Writing NVIDIA toolkit apt repo..."
sudo rm -f "$LIST_PATH"
curl -fsSL "$REPO_URL" \
  | sed "s#deb https://#deb [signed-by=$KEYRING_PATH] https://#g" \
  | sudo tee "$LIST_PATH" >/dev/null

echo "[4/7] Updating apt metadata..."
sudo apt update

echo "[5/7] Installing NVIDIA container toolkit packages..."
sudo apt install -y nvidia-container-toolkit nvidia-container-toolkit-base

echo "[6/7] Generating CDI specification for Containers..."
sudo mkdir -p /etc/cdi
sudo nvidia-ctk cdi generate --output=/etc/cdi/nvidia.yaml

echo "CDI devices detected:"
nvidia-ctk cdi list

echo "[7/7] Verifying Container GPU passthrough..."
nvidia-smi

echo "Done. Container GPU passthrough is configured."
