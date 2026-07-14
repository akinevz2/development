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
        apt-get install -y "${missing_packages[@]}"
    fi
}

install_missing_apt_packages