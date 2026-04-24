PAGERTS_PATH := personal/pagerts
PAGERTS_URL := https://github.com/akinevz2/pagerts
PICK_PATH ?=
PICK_URL ?=
PARENT_BRANCH ?= main
SUBMODULE_BRANCH ?= main
SUBMODULE_COMMIT_MSG ?= chore: sync pagerts submodule changes
PARENT_COMMIT_MSG ?= chore: update pagerts submodule pointer

.PHONY: subrepo-sync subrepo-publish subrepo-pick globbit

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
