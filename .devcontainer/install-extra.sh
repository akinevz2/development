# Packages required for development environment
# These should also be listed in the Dockerfile's apt-get install command
REQUIRED_PACKAGES=(git make build-essential sudo stow gh vim npm neovim nodejs git-lfs)

install_missing_apt_packages() {
    echo "📦 Installing missing packages..."
    local missing_packages=()

    for pkg in "${REQUIRED_PACKAGES[@]}"; do
        # Determine the command name to check; defaults to package name itself.
        local cmd="$pkg"
        case "$pkg" in
            neovim) cmd="nvim" ;;
        esac

        if ! command -v "$cmd" >/dev/null 2>&1; then
            missing_packages+=("$pkg")
        fi
    done

    if [ ${#missing_packages[@]} -gt 0 ]; then
        echo "⚠ The following packages are missing: ${missing_packages[*]}"
        
        # Check if we have sudo access (needed when running as non-root user)
        if command -v sudo >/dev/null 2>&1; then
            sudo apt-get update
            sudo apt-get install -y "${missing_packages[@]}"
        else
            echo "❌ Cannot install packages: no sudo available. Please run as root or ensure Dockerfile installs all required packages."
            return 1
        fi
    else
        echo "✅ All required packages are already installed."
    fi
}

install_missing_apt_packages