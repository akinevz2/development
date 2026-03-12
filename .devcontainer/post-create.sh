#!/bin/bash
echo "📂 Restoring dotfiles..."
if [ ! -d "$HOME/dotfiles" ]; then
    git clone https://github.com/akinevz2/configs.git "$HOME/dotfiles"
fi
cd "$HOME/dotfiles"
git pull origin main
sudo apt-get update && sudo apt-get install -y stow pandoc texlive-latex-extra
make stow-shell
echo "✅ Dotfiles restored!"

echo "✅ Environment setup complete!"
echo ""
echo "Verifying installations..."
node -v
npm -v
git --version

exit 0
