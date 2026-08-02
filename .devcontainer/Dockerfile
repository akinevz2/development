# Use Ubuntu as base image
FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Set non-interactive frontend to avoid prompts
ENV DEBIAN_FRONTEND=noninteractive

# Update apt and install packages with explicit permissions handling
RUN echo "Updating package lists..." && \
    apt-get update && \
    echo "Installing required packages..." && \
    apt-get install -y \
        git \
        make \
        build-essential \
        sudo \
        stow \
        gh \
        vim \
        npm \
        neovim \
        nodejs \
        git-lfs \
        pandoc \
        texlive-latex-extra \
        texlive-xetex \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*