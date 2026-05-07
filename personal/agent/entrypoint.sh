#!/bin/sh
# Ensure the data directory and inventory file are writable.
# This is needed when the host is a Windows NTFS path (e.g. /mnt/c/...) where
# files may be mounted read-only despite Docker volume settings.
chmod -f 666 /data/*.md 2>/dev/null || true

exec python -u /app/inventory_agent.py
