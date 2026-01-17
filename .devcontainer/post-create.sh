#!/bin/bash
set -e

# Restore dotfiles
echo "📂 Restoring dotfiles..."
if [ ! -d "$HOME/dotfiles" ]; then
    git clone https://github.com/akinevz2/doftiles "$HOME/dotfiles"
fi
cd "$HOME/dotfiles"
git pull origin main
sudo apt-get update && sudo apt-get install -y stow
make stow-shell
echo "✅ Dotfiles restored!"

# Install TypeScript globally
echo "📦 Installing TypeScript and ts-node..."
npm install -g typescript ts-node

# Install JSON/YAML/XML tooling
echo "📦 Installing format tooling..."
npm install -g jsonlint yaml-language-server prettier

sudo apt-get update
sudo apt-get install -y jq xmlstarlet make build-essential

# Install Scala via Coursier
echo "📦 Installing Scala tooling..."
curl -fL https://github.com/coursier/launchers/raw/master/cs-x86_64-pc-linux.gz | gzip -d > cs
chmod +x cs
sudo mv cs /usr/local/bin/cs
cs setup -y --apps sbt,scala,scalac,scalafmt,scalafix

# Install Quarkus CLI
echo "📦 Installing Quarkus CLI..."
curl -Ls https://sh.jbang.dev | bash -s - trust add https://repo1.maven.org/maven2/io/quarkus/quarkus-cli/

# Add Scala and JBang to PATH for current session
export PATH="$HOME/.local/share/coursier/bin:$HOME/.jbang/bin:$PATH"

# Add to .bashrc for persistence
echo 'export PATH="$HOME/.local/share/coursier/bin:$HOME/.jbang/bin:$PATH"' >> ~/.bashrc

echo "✅ Environment setup complete!"
echo ""
echo "Verifying installations..."
java -version
mvn -version
node -v
npm -v
echo "TypeScript: $(tsc -v)"
scala -version 2>/dev/null || echo "Scala installed (restart shell or source ~/.bashrc)"
sbt --version 2>/dev/null || echo "SBT installed (restart shell or source ~/.bashrc)"
quarkus --version 2>/dev/null || echo "Quarkus CLI installed (restart shell or source ~/.bashrc)"
make --version | head -n 1
echo ""
# echo "🚀 Setting up development environment with Warp CLI..."

echo "🌐 Warp CLI status:"
warp-cli --version
echo ""
echo "💡 To use Warp CLI, run:"
echo "   warp-cli register"
echo "   warp-cli connect"
echo ""
echo "🎉 Ready to code!"
