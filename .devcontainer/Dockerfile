# Use Ubuntu as base image
FROM ubuntu:latest

# Set non-interactive frontend to avoid prompts
ENV DEBIAN_FRONTEND=noninteractive

# Create the kine user with a home directory
RUN useradd -m -s /bin/bash kine && \
    # Add kine to sudo group (optional, for admin privileges)
    usermod -aG sudo kine && \
    # Set proper permissions on home directory
    chmod 755 /home/kine

# Switch to the kine user as default
USER kine
WORKDIR /home/kine

# Set the environment to make sure USER is set properly
ENV USER=kine
ENV HOME=/home/kine