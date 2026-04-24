#!/bin/bash

# ── Git credentials ──────────────────────────────────────────────────────────
CREDENTIALS_FILE="${MY_CREDENTIALS}"
if [ -f "$CREDENTIALS_FILE" ]; then
    source "$CREDENTIALS_FILE"
    if [ -n "$GIT_EMAIL" ] && [ -n "$GIT_NAME" ]; then
        git config --global user.email "$GIT_EMAIL"
        git config --global user.name "$GIT_NAME"
        echo "✅ Git credentials configured: $GIT_NAME <$GIT_EMAIL>"
    else
        echo -e "\033[1;31m"
        echo "██████████████████████████████████████████████████"
        echo "██                                              ██"
        echo "██   ⚠  AUTHENTICATION FAILED                  ██"
        echo "██   .my-credentials is missing GIT_EMAIL      ██"
        echo "██   or GIT_NAME. Git is not configured.       ██"
        echo "██                                              ██"
        echo "██████████████████████████████████████████████████"
        echo -e "\033[0m"
        exit 1
    fi
else
    echo -e "\033[1;31m"
    echo "██████████████████████████████████████████████████"
    echo "██                                              ██"
    echo "██   ⚠  AUTHENTICATION FAILED                  ██"
    echo "██   .my-credentials not found.                ██"
    echo "██   Set MY_CREDENTIALS in devcontainer.json   ██"
    echo "██   Git global config has NOT been set.       ██"
    echo "██                                              ██"
    echo "██████████████████████████████████████████████████"
    echo -e "\033[0m"
    exit 1
fi
# ─────────────────────────────────────────────────────────────────────────────

echo "📂 Restoring dotfiles..."
if [ ! -d "$HOME/dotfiles" ]; then
    git clone https://github.com/akinevz2/configs.git "$HOME/dotfiles"
fi
cd "$HOME/dotfiles"
git pull origin main
make stow-shell
echo "✅ Dotfiles restored!"

echo "✅ Environment setup complete!"
echo ""
echo "Verifying installations..."
node -v
npm -v
git --version

exit 0
