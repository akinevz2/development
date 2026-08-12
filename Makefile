PAGERTS_PATH := personal/pagerts
PAGERTS_URL := https://github.com/akinevz2/pagerts
PICK_PATH ?=
PICK_URL ?=
PARENT_BRANCH ?= main
SUBMODULE_BRANCH ?= main
SUBMODULE_COMMIT_MSG ?= chore: sync pagerts submodule changes
PARENT_COMMIT_MSG ?= chore: update pagerts submodule pointer

DROP_PORT ?= 7331
DROP_OUT ?= $(CURDIR)

PINCH_PORT ?= 7332
PINCH_ROOT ?= $(CURDIR)

.PHONY: subrepo-sync subrepo-publish subrepo-pick globbit drop pinch

subrepo-sync:
	@set -e; \
	paths="$$(git config --file .gitmodules --get-regexp '^submodule\..*\.path$$' | awk '{print $$2}' | grep -E '^(personal|uni)(/|$$)' || true)"; \
	if [ -z "$$paths" ]; then \
		echo "No submodules found under personal/ or uni/ in .gitmodules"; \
		exit 0; \
	fi; \
	valid_paths=""; \
	for path in $$paths; do \
		if git ls-files --error-unmatch "$$path" >/dev/null 2>&1; then \
			valid_paths="$$valid_paths $$path"; \
			git submodule sync --recursive -- "$$path"; \
		else \
			echo "Skipping stale submodule path $$path (not tracked in index)"; \
		fi; \
	done; \
	if [ -z "$$valid_paths" ]; then \
		echo "No valid submodule paths found under personal/ or uni/"; \
		exit 0; \
	fi; \
	for path in $$valid_paths; do \
		git submodule update --init --remote --recursive -- "$$path"; \
	done

subrepo-pick:
	@test -n "$(PICK_PATH)" || (echo "Set PICK_PATH, e.g. make subrepo-pick PICK_PATH=personal/pagerts PICK_URL=https://github.com/akinevz2/pagerts"; exit 1)
	@test -n "$(PICK_URL)" || (echo "Set PICK_URL, e.g. make subrepo-pick PICK_PATH=personal/pagerts PICK_URL=https://github.com/akinevz2/pagerts"; exit 1)
	git submodule set-url $(PICK_PATH) $(PICK_URL)
	git submodule sync -- $(PICK_PATH)
	git submodule update --init --remote -- $(PICK_PATH)

subrepo-publish:
	git -C $(PAGERTS_PATH) add -A
	git -C $(PAGERTS_PATH) diff --cached --quiet || git -C $(PAGERTS_PATH) commit -m "$(SUBMODULE_COMMIT_MSG)"
	git -C $(PAGERTS_PATH) push origin $(SUBMODULE_BRANCH)
	git add .gitmodules $(PAGERTS_PATH)
	git diff --cached --quiet || git commit -m "$(PARENT_COMMIT_MSG)"
	git push origin $(PARENT_BRANCH)

globbit:
	git add -A
	@if git diff --cached --quiet; then \
		echo "No staged changes after git add -A"; \
		git status; \
	else \
		git commit; \
		git submodule foreach --recursive 'branch=$$(git symbolic-ref --short -q HEAD); if [ -z "$$branch" ]; then echo "[$$name] detached HEAD, skipping push"; elif git diff --quiet && git diff --cached --quiet; then git push origin $$branch; else echo "[$$name] uncommitted changes:"; git status --short; fi'; \
		git push origin $(PARENT_BRANCH); \
	fi

# Makefile for Scala installation on Ubuntu

# Variables
SCALA_VERSION ?= 2.13.10
SCALA_DIR = /opt/scala
SCALA_TAR = scala-$(SCALA_VERSION).tgz
SCALA_URL = https://downloads.lightbend.com/scala/$(SCALA_VERSION)/$(SCALA_TAR)

# Default target
.PHONY: all install-scala clean

all: install-scala

# Install Scala compiler
install-scala:
	@sudo apt-get install wget
	@echo "Installing Scala $(SCALA_VERSION)..."
	@if ! command -v java &> /dev/null; then \
		echo "Java is required. Installing OpenJDK..."; \
		sudo apt update && sudo apt install -y openjdk-21-jdk; \
	fi
	@echo "Downloading Scala $(SCALA_VERSION)..."
	wget -O $(SCALA_TAR) $(SCALA_URL)
	@echo "Extracting Scala..."
	sudo mkdir -p $(SCALA_DIR)
	sudo tar -xzf $(SCALA_TAR) -C $(SCALA_DIR) --strip-components=1
	@echo "Setting up environment variables..."
	sudo echo 'export SCALA_HOME=$(SCALA_DIR)' >> /etc/environment
	sudo echo 'export PATH=$$PATH:$(SCALA_DIR)/bin' >> /etc/environment
	@echo "Cleaning up..."
	rm -f $(SCALA_TAR)
	@echo "Scala installation complete!"
	@echo "Please run 'source /etc/environment' or relogin to use scalac."

# Clean installation files
clean:
	@echo "Cleaning up..."
	sudo rm -rf $(SCALA_DIR)
	sudo sed -i '/SCALA_HOME/d' /etc/environment
	sudo sed -i '/scala/d' /etc/environment
	@echo "Cleanup complete."

# Verify installation
verify: 
	@echo "Verifying Scala installation..."
	@if command -v scalac &> /dev/null; then \
		echo "✓ Scala compiler found:"; \
		scalac -version; \
	else \
		echo "✗ Scala compiler not found. Please check installation."; \
	fi

# Help target
help:
	@echo "Available targets:"
	@echo "  install-scala  - Install Scala compiler (default)"
	@echo "  verify         - Verify installation"
	@echo "  clean          - Remove Scala installation"
	@echo "  help           - Show this help"
	@echo ""
	@echo "Usage:"
	@echo "  make install-scala     # Install Scala"
	@echo "  make verify            # Check installation"
	@echo "  make clean             # Remove Scala"
	@echo "  make help              # Show help"

# File dropper: serves an HTTP page (auto-forwarded by VS Code) for dragging
# files from the Windows host into the devcontainer filesystem.
# Usage: make drop                  # destination = cwd
#        make drop DROP_OUT=/some/dir DROP_PORT=8000
drop:
	@node system/drop.mjs --port $(DROP_PORT) --out $(DROP_OUT)

# File picker: serves an HTTP page (auto-forwarded by VS Code) for picking
# files from the devContainer filesystem and downloading them to the host.
# Usage: make pinch                  # root = cwd
#        make pinch PINCH_ROOT=/some/dir PINCH_PORT=8000
pinch:
	@node system/pinch.mjs --port $(PINCH_PORT) --root $(PINCH_ROOT)
