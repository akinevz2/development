#!/bin/bash

set -euo pipefail

# default to ${USER} if set outside of devcontainer
USER_HOME="/home/"$USER
export USER_HOME

if [ "$USER_HOME" = "/home/root" ]; then
    echo "❌ User home directory is root, skipping: $USER_HOME" >&2
    exit 1
fi

MY_CREDENTIALS=".my-credentials"  # Relative to $USER_HOME; can be overridden by MY_CREDENTIALS env var

ensure_github_known_hosts() {
    # A freshly rebuilt container has no ~/.ssh/known_hosts, so the first
    # git@github.com operation would fail host-key verification in the
    # non-interactive post-create context. Populate known_hosts with
    # GitHub's published host keys (pinned; updated 2025).
    local ssh_dir="$USER_HOME/.ssh"
    local known_hosts="$ssh_dir/known_hosts"

    mkdir -p "$ssh_dir"
    chmod 700 "$ssh_dir"

    # GitHub's published SSH host keys (https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)
    if ! grep -q "github.com" "$known_hosts" 2>/dev/null; then
        {
            echo "# github.com SSH host keys (pinned $(date +%Y-%m-%d))"
            echo "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl"
            echo "github.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg="
            echo "github.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjshcLrqPEiiphnt+VTTvDP6mHBL9j1aNUkY4Ue1gvwnGLVlOhGeYrnZaMgRK6+PKCUXaDbC7qtbW8gIkhL7aGCsOr/C56SJMy/BCZfxd1nWzAOxSDPgVsmerOBYfNqltV9/hWCqBywINIR+5dIg6JTJ72pcEpEjcYgXkE2YEFXV1JHnsKgbLWNlhScqb2UmyRkQyytRLtL+38TGxkxCflmO+5Z8CSSNY7GidjMIZ7Q4zMjA2n1nGrlTDkzwDCsw+wqFPGQA179cnfGWOWRVruj16z6XyvxvjJwbz0wQZ75XK5tKSb7FNyeIEs4TT4jk+S4dhPeAUC5y+bDYirYgM4GC7uEnztnZyaVWQ7B381AK4Qdrwt51ZqExKbQpTUNn+EjqoTwvqNj4kqx5QUCI0ThS/YkOxJCXmPUWZbhjpCg56i+2aB6CmK2JGhn57K5mj0MNdBXA4/WnwH6XoPWJzK5Nyu2zB3nAZp+S5hpQs+p1vN1/wsjk="
        } >> "$known_hosts"
        chmod 644 "$known_hosts"
        echo "✅ Added GitHub host keys to $known_hosts"
    fi
}

ensure_github_known_hosts

echo "🛠 Running post-create script in devcontainer for user: $USER_HOME"
# Each entry is: relative-path|git-url|branch
DECLARED_SUBMODULES=(
    "personal/gtkappfolder|git@github.com:akinevz2/gtkappfolder.git|main"
    "personal/pagerts|git@github.com:akinevz2/pagerts.git|main"
    "personal/website|git@github.com:akinevz2/frontend.git|main"
    "personal/resume|git@github.com:akinevz2/resume.git|main"
    "personal/rarebert|git@github.com:akinevz2/rarebert.git|utilities"
    "uni/rarebert|git@github.com:akinevz2/rarebert.git|main"
)

# Each entry is: relative-path|space-separated-packages
DECLARED_LOCAL_NPM_PACKAGES=(
    "personal/pagerts|@types/node"
)

NVM_VERSION="v0.40.5"
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

# Source the install-extra.sh script that contains missing functions
if [ -f ".devcontainer/install-extra.sh" ]; then
    source .devcontainer/install-extra.sh
else
    echo "⚠ install-extra.sh not found"
fi

# Install any missing packages from REQUIRED_PACKAGES array (requires sudo for apt-get)
# Note: This runs as the container user, so sudo is needed if packages are actually missing.
# The Dockerfile should install all packages during build to avoid this requirement.
if type install_missing_apt_packages >/dev/null 2>&1; then
    install_missing_apt_packages || echo "⚠ Package installation skipped (may require root privileges)."
fi

install_local_cli_helpers() {
    echo "🧰 Installing local CLI helpers..."

    mkdir -p "$HOME/.local/bin"
    todo

    echo "✅ Local CLI helpers installed."
}

# Function to install declared local NPM packages
install_declared_local_npm_packages() {
    echo "📦 Installing declared local NPM packages..."
    
    for entry in "${DECLARED_LOCAL_NPM_PACKAGES[@]}"; do
        local package_path=$(echo "$entry" | cut -d'|' -f1)
        local packages=$(echo "$entry" | cut -d'|' -f2-)
        
        if [ -d "$package_path" ]; then
            echo "Installing packages in $package_path: $packages"
            cd "$package_path"
            npm install $packages
            cd - > /dev/null
        else
            echo "⚠ Package path does not exist: $package_path"
        fi
    done
    
    echo "✅ Local NPM packages installed."
}

install_opencode_cli() {
    # Only install if opencode.json or .opencode/ exists in the workspace root
    if [ -f "opencode.json" ] || [ -d ".opencode" ]; then
        echo "🔧 Installing opencode-ai CLI..."
        npm install -g opencode-ai
        echo "✅ opencode-ai installed."
    else
        echo "⏭ Skipping opencode-ai installation (no opencode.json or .opencode/ found in workspace root)."
    fi
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
    if [ -d "$USER_HOME" ]; then
        local env_fragment="$USER_HOME/.my-credentials-env"
        {
            echo "# Auto-generated by devcontainer post-create; do not edit manually."
            echo "export GIT_NAME='$name'"
            echo "export GIT_EMAIL='$email'"
        } > "$env_fragment"

        for rc in "$USER_HOME/.bashrc" "$USER_HOME/.zshrc"; do
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
if [ ! -d "$USER_HOME/dots" ]; then
    if ! git clone --recurse-submodules "$dotfiles" "$USER_HOME/dots"; then
    # if ! git clone  "$USER_HOME/dots"; then
        echo "⚠ Dotfiles clone failed; continuing without dotfiles restore."
        exit 0
    fi
    # echo "✅ Dotfiles restored!"
    # stow symlinks shell/.bashrc, .aliases, .exports, .zshrc, etc. into $USER_HOME.
    # .bashrc sources aliases/exports and bootstraps ssh-agent, so no manual append.
    cd "$USER_HOME/dots" && stow shell --adopt
fi

git submodule sync --recursive

submodules_resync() {
    # Try to reset and reinitialize submodules
    for submodule in "${DECLARED_SUBMODULES[@]}"; do
        local path=$(echo "$submodule" | cut -d'|' -f1)
        if [ -d "$path" ]; then
            echo "Attempting to synchronize $path with origin..."
            
            # Try origin/main first
            # if git -C "$path" fetch origin main 2>/dev/null; then
            #     git -C "$path" reset --hard origin/main 2>/dev/null && echo "✅ Reset $path to origin/main"
            # elif git -C "$path" fetch origin master 2>/dev/null; then
            #     # If main fails, try master
            #     git -C "$path" reset --hard origin/master 2>/dev/null && echo "✅ Reset $path to origin/master"
            # else
            #     echo "⚠ Could not fetch from origin/main or origin/master for $path"
            # fi
            
            # Show last commit and unstaged files if possible
            if [ -d "$path/.git" ]; then
                echo "Last commit in $path:"
                git -C "$path" log --oneline -1 2>/dev/null || echo "No commits found"
                echo "Unstaged changes in $path:"
                git -C "$path" status --porcelain 2>/dev/null || echo "No status available"
            fi
        fi
    done
}

# Handle potential submodule issues by attempting fallback strategies
(git submodule update --init --recursive) || \
    echo "⚠ Submodule initialization failed, attempting fallback strategies..." && \
    submodules_resync

echo "✅ Environment setup complete!"
echo ""

install_opencode_cli

echo "Verifying installations..."
bash -c "$(cat <<STRING
node -v; 
npm -v;
git --version;
gh --version;
java -version;
javac -version;
mvn -version;
STRING
)"

exit 0
