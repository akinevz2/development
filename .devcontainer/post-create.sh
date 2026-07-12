#!/bin/bash

set -euo pipefail

WORKSPACE_ROOT="/workspaces/development"

# Each entry is: relative-path|git-url|branch
DECLARED_SUBMODULES=(
    "personal/gtkappfolder|https://github.com/akinevz2/gtkappfolder|main"
    "personal/pagerts|https://github.com/akinevz2/pagerts|main"
    "personal/website|https://github.com/akinevz2/frontend|main"
    "personal/resume|https://github.com/akinevz2/resume|main"
    "personal/rarebert|https://github.com/akinevz2/rarebert|utilities"
    "uni/2025-report|https://github.com/akinevz2/2025-report|personal"
    "uni/rarebert|https://github.com/akinevz2/rarebert|main"
)

# Each entry is: relative-path|space-separated-packages
DECLARED_LOCAL_NPM_PACKAGES=(
    "personal/pagerts|@types/node @types/jest"
)

NVM_VERSION="v0.40.5"
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

install_missing_apt_packages() {
    echo "📦 Installing required tools (stow, gh, vim, neovim) if missing..."
    local missing_packages=()

    if ! command -v stow >/dev/null 2>&1; then
        missing_packages+=("stow")
    fi

    if ! command -v gh >/dev/null 2>&1; then
        missing_packages+=("gh")
    fi

    if ! command -v vim >/dev/null 2>&1; then
        missing_packages+=("vim")
    fi

    if ! command -v nvim >/dev/null 2>&1; then
        missing_packages+=("neovim")
    fi

    if [ ${#missing_packages[@]} -gt 0 ]; then
        apt-get update
        echo apt-get install -y "${missing_packages[@]}"
    fi
}

ensure_nvm_loaded() {
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        # shellcheck disable=SC1090
        . "$NVM_DIR/nvm.sh"
        return 0
    fi

    return 1
}

install_nvm() {
    echo "📦 Ensuring nvm-managed Node.js is available..."

    if [ ! -s "$NVM_DIR/nvm.sh" ]; then
        curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh" | bash
    fi

    ensure_nvm_loaded

    nvm install --lts
    nvm alias default 'lts/*'
    nvm use --lts >/dev/null

    echo "✅ nvm-managed Node.js is available."
}

install_copilot_nvim_link() {
    local vim_plugin="$HOME/configs/vim/.vim/pack/github/start/copilot.vim"
    local nvim_plugin="$HOME/.local/share/nvim/site/pack/github/start/copilot.vim"

    if [ ! -d "$vim_plugin" ]; then
        echo "❌ copilot.vim submodule is missing: $vim_plugin" >&2
        return 1
    fi

    if [ -e "$nvim_plugin" ] && [ ! -L "$nvim_plugin" ]; then
        echo "❌ Neovim plugin path already exists and is not a symlink: $nvim_plugin" >&2
        return 1
    fi

    mkdir -p "$(dirname "$nvim_plugin")"
    ln -sfn "$vim_plugin" "$nvim_plugin"
}

gitmodules_contains_path() {
    local submodule_path="$1"

    git config -f .gitmodules --get-regexp '^submodule\..*\.path$' 2>/dev/null \
        | awk '{print $2}' \
        | grep -Fxq "$submodule_path"
}

register_declared_submodules() {
    echo "🧩 Reconciling declared submodules..."

    (
        cd "$WORKSPACE_ROOT"

        local entry path url branch
        for entry in "${DECLARED_SUBMODULES[@]}"; do
            IFS='|' read -r path url branch <<< "$entry"

            if gitmodules_contains_path "$path"; then
                git config -f .gitmodules "submodule.$path.url" "$url"
                git config -f .gitmodules "submodule.$path.branch" "$branch"
                continue
            fi

            if [ -e "$path" ] && [ ! -d "$path/.git" ]; then
                echo "⚠ Cannot auto-register $path because the path already exists and is not an initialized submodule."
                continue
            fi

            echo "➕ Registering submodule $path ($branch)..."
            git submodule add -b "$branch" "$url" "$path"
        done

        git submodule sync --recursive
        git submodule update --init --recursive
    )

    echo "✅ Declared submodules reconciled."
}

install_declared_local_npm_packages() {
    echo "📦 Ensuring declared local npm packages are present..."

    local entry project_path package_list package_dir package_name missing_packages
    for entry in "${DECLARED_LOCAL_NPM_PACKAGES[@]}"; do
        IFS='|' read -r project_path package_list <<< "$entry"
        package_dir="$WORKSPACE_ROOT/$project_path"

        if [ ! -d "$package_dir" ]; then
            echo "⚠ Project directory not found at $package_dir; skipping local npm package install."
            continue
        fi

        missing_packages=()
        for package_name in $package_list; do
            if [ ! -d "$package_dir/node_modules/$package_name" ]; then
                missing_packages+=("$package_name")
            fi
        done

        if [ ${#missing_packages[@]} -eq 0 ]; then
            echo "✅ Local npm packages already installed for $project_path."
            continue
        fi

        echo "📦 Installing local npm packages for $project_path..."
        (
            cd "$package_dir"
            npm install --no-save --package-lock=false "${missing_packages[@]}"
        )
        echo "✅ Local npm packages installed for $project_path."
    done
}

todo() {
    echo "⚠ TODO: Implement more functional package helpers."
}

install_local_cli_helpers() {
    echo "🧰 Installing local CLI helpers..."

    mkdir -p "$HOME/.local/bin"
    todo

    echo "✅ Local CLI helpers installed."
}

ensure_github_cli_auth() {
    if [ "${GH_AUTH_PROVIDER:-}" = "wsl-host" ]; then
        echo "✅ Skipping in-container gh auth bootstrap (GH_AUTH_PROVIDER=wsl-host)."
        echo "   Authenticate once on the WSL host; this container reads ~/.config/gh via bind mount."
        return
    fi

    if ! command -v gh >/dev/null 2>&1; then
        echo "⚠ GitHub CLI is not available; skipping gh auth bootstrap."
        return
    fi

    if gh auth status >/dev/null 2>&1; then
        echo "✅ GitHub CLI is already authenticated."
        return
    fi

    echo "🔐 GitHub CLI is not authenticated yet."
    echo "   Run 'gh auth login' after the dev container opens to finish first-time setup."
    echo "   If you want post-create to block for interactive login, rebuild with GH_AUTH_ON_CREATE=1."

    if [ "${GH_AUTH_ON_CREATE:-0}" = "1" ] && [ -t 0 ] && [ -t 1 ]; then
        gh auth login
    fi
}

install_missing_apt_packages
install_nvm
register_declared_submodules

# ── Credentials digest ───────────────────────────────────────────────────────
# Credentials file format: a 2-line tuple
#   line 1: full name (e.g. "Kirill <kine> Nevzorov")
#   line 2: email address (e.g. "akinevz@outlook.com")
# This is parsed directly (never sourced as shell code) and applied to git,
# shell environment, and GitHub CLI context.
CREDENTIALS_FILE="${MY_CREDENTIALS:-}"

read_credentials_tuple() {
    local file="$1"
    local line name email

    if [ ! -f "$file" ]; then
        return 1
    fi

    # Read exactly two non-empty, non-comment lines.
    name=""
    email=""
    while IFS= read -r line; do
        line="${line#"${line%%[![:space:]]*}"}"   # ltrim
        line="${line%"${line##*[![:space:]]}"}"   # rtrim
        [ -z "$line" ] && continue
        case "$line" in \#*) continue ;; esac

        if [ -z "$name" ]; then
            name="$line"
        elif [ -z "$email" ]; then
            email="$line"
            break
        fi
    done < "$file"

    if [ -z "$name" ] || [ -z "$email" ]; then
        return 1
    fi

    printf '%s\n%s\n' "$name" "$email"
}

apply_credentials() {
    local tuple
    tuple=$(read_credentials_tuple "$CREDENTIALS_FILE") || {
        echo "⚠ Credentials file missing or malformed at MY_CREDENTIALS=$CREDENTIALS_FILE; skipping credential config."
        return
    }

    local name email
    name=$(printf '%s\n' "$tuple" | sed -n '1p')
    email=$(printf '%s\n' "$tuple" | sed -n '2p')

    # Basic email shape check.
    if ! printf '%s\n' "$email" | grep -Eq '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'; then
        echo "⚠ Credentials file contains an invalid email address; skipping credential config."
        return
    fi

    # Git identity.
    git config --global user.name "$name"
    git config --global user.email "$email"

    # Shell environment for child processes and dotfiles.
    export GIT_NAME="$name"
    export GIT_EMAIL="$email"

    # Persist for interactive shells (idempotent append).
    if [ -d "$HOME" ]; then
        local env_fragment="$HOME/.my-credentials-env"
        {
            echo "# Auto-generated by devcontainer post-create; do not edit manually."
            echo "export GIT_NAME='$name'"
            echo "export GIT_EMAIL='$email'"
        } > "$env_fragment"

        for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
            if [ -f "$rc" ]; then
                if ! grep -Fxq "source \"$env_fragment\"" "$rc" 2>/dev/null; then
                    echo "source \"$env_fragment\"" >> "$rc"
                fi
            fi
        done
    fi

    # GitHub CLI defaults for repositories created with gh.
    if command -v gh >/dev/null 2>&1; then
        gh config set git_protocol ssh >/dev/null 2>&1 || true
        gh config set prompt disabled >/dev/null 2>&1 || true
    fi

    echo "✅ Credentials configured: $name <$email>"
}

if [ -n "$CREDENTIALS_FILE" ]; then
    apply_credentials
else
    echo "⚠ MY_CREDENTIALS is unset; skipping credential config."
fi
# ─────────────────────────────────────────────────────────────────────────────

echo "📂 Restoring dotfiles..."
if [ ! -d "$HOME/configs" ]; then
    if ! git clone --recurse-submodules https://github.com/akinevz2/configs.git "$HOME/configs"; then
        echo "⚠ Dotfiles clone failed; continuing without dotfiles restore."
        exit 0
    fi
fi
if [ ! -d "$HOME/configs/.git" ]; then
    echo "❌ Dotfiles path is not a Git checkout: $HOME/configs" >&2
    exit 1
fi
cd "$HOME/configs"
if ! git pull --ff-only origin main; then
    echo "⚠ Dotfiles update failed; continuing."
fi
git submodule sync --recursive
git submodule update --init --recursive
if ! make stow-shell; then
    echo "⚠ Dotfiles stow failed; continuing."
fi
if ! make stow-vim; then
    echo "⚠ Vim dotfiles stow failed; continuing."
fi
if ! install_copilot_nvim_link; then
    echo "⚠ copilot.vim link setup failed; continuing without Neovim Copilot symlink."
fi
echo "✅ Dotfiles restored!"

install_declared_local_npm_packages
install_local_cli_helpers
ensure_github_cli_auth

echo "✅ Environment setup complete!"
echo ""
echo "Verifying installations..."
node -v
npm -v
git --version
gh --version 
java -version
javac -version
mvn -version

exit 0

echo "Please view live changelog.ws"