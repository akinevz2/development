FROM mcr.microsoft.com/devcontainers/base:bookworm

ARG USERNAME=kine

RUN groupmod --new-name "${USERNAME}" vscode \
    && usermod --login "${USERNAME}" --home "/home/${USERNAME}" --move-home vscode \
    && if [ -f /etc/sudoers.d/vscode ]; then \
        sed "s/^vscode /${USERNAME} /" /etc/sudoers.d/vscode > "/etc/sudoers.d/${USERNAME}"; \
        chmod 0440 "/etc/sudoers.d/${USERNAME}"; \
        rm /etc/sudoers.d/vscode; \
    fi

WORKDIR /workspaces/development
