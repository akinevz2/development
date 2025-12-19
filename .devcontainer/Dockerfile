FROM debian:bookworm-slim

# Avoid warnings by switching to noninteractive
ENV DEBIAN_FRONTEND=noninteractive

# Configure apt and install base packages
RUN apt-get update && apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    wget \
    gnupg \
    lsb-release \
    git \
    procps \
    unzip \
    zip \
    build-essential \
    make \
    && rm -rf /var/lib/apt/lists/*

# Install Java 25 (OpenJDK)
# RUN mkdir -p /opt/java && \
#     wget -q https://download.java.net/java/GA/jdk25/6b7c0add7c7e46d5ce81a95b03de5bb0/12/GPL/openjdk-25_linux-x64_bin.tar.gz -O /tmp/openjdk.tar.gz && \
#     tar -xzf /tmp/openjdk.tar.gz -C /opt/java --strip-components=1 && \
#     rm /tmp/openjdk.tar.gz

# ENV JAVA_HOME=/opt/java
# ENV PATH="${JAVA_HOME}/bin:${PATH}"

# Install Maven
RUN wget -q https://dlcdn.apache.org/maven/maven-3/3.9.12/binaries/apache-maven-3.9.12-bin.tar.gz -O /tmp/maven.tar.gz && \
    tar -xzf /tmp/maven.tar.gz -C /opt && \
    ln -s /opt/apache-maven-3.9.12 /opt/maven && \
    rm /tmp/maven.tar.gz

ENV MAVEN_HOME=/opt/maven
ENV PATH="${MAVEN_HOME}/bin:${PATH}"

# Install Quarkus CLI
RUN curl -Ls https://sh.jbang.dev | bash -s - trust add https://repo1.maven.org/maven2/io/quarkus/quarkus-cli/ && \
    curl -Ls https://sh.jbang.dev | bash -s - app install --fresh --force quarkus@quarkusio

ENV PATH="/root/.jbang/bin:${PATH}"

# Install Node.js and npm (LTS version)
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm@latest && \
    rm -rf /var/lib/apt/lists/*

# Install TypeScript globally
RUN npm install -g typescript ts-node

# Install useful CLI tools for JSON/XML/YAML
RUN npm install -g \
    jsonlint \
    yaml-language-server \
    prettier \
    && apt-get update && apt-get install -y \
    jq \
    xmlstarlet \
    yq \
    && rm -rf /var/lib/apt/lists/*

# Install additional development tools
RUN apt-get update && apt-get install -y \
    vim \
    nano \
    htop \
    tree \
    && rm -rf /var/lib/apt/lists/*

# Set the default shell to bash
ENV SHELL=/bin/bash

# Switch back to dialog for any ad-hoc use of apt-get
ENV DEBIAN_FRONTEND=dialog

# Create a non-root user (optional but recommended)
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME -s /bin/bash \
    && apt-get update \
    && apt-get install -y sudo \
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME \
    && rm -rf /var/lib/apt/lists/*

# Set up environment for non-root user
USER $USERNAME
ENV PATH="/home/${USERNAME}/.jbang/bin:${PATH}"

# Install Quarkus CLI for non-root user
RUN curl -Ls https://sh.jbang.dev | bash -s - trust add https://repo1.maven.org/maven2/io/quarkus/quarkus-cli/ && \
    curl -Ls https://sh.jbang.dev | bash -s - app install --fresh --force quarkus@quarkusio

WORKDIR /workspace
