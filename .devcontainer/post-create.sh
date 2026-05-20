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
        echo "⚠ .my-credentials is present but missing GIT_EMAIL or GIT_NAME; skipping git global config."
    fi
else
    echo "⚠ Credentials file not found at MY_CREDENTIALS=$CREDENTIALS_FILE; skipping git global config."
fi
# ─────────────────────────────────────────────────────────────────────────────

echo "📂 Restoring dotfiles..."
if [ ! -d "$HOME/dotfiles" ]; then
    if ! git clone https://github.com/akinevz2/configs.git "$HOME/dotfiles"; then
        echo "⚠ Dotfiles clone failed; continuing without dotfiles restore."
        exit 0
    fi
fi
cd "$HOME/dotfiles"
if ! git pull origin main; then
    echo "⚠ Dotfiles update failed; continuing."
fi
if ! make stow-shell; then
    echo "⚠ Dotfiles stow failed; continuing."
fi
echo "✅ Dotfiles restored!"

echo "✅ Environment setup complete!"
echo ""
echo "Verifying installations..."
node -v
npm -v
git --version

exit 0
