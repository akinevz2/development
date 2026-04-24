PAGERTS_PATH := personal/pagerts
PAGERTS_URL := https://github.com/akinevz2/pagerts
PARENT_BRANCH ?= main
SUBMODULE_BRANCH ?= main
SUBMODULE_COMMIT_MSG ?= chore: sync pagerts submodule changes
PARENT_COMMIT_MSG ?= chore: update pagerts submodule pointer

.PHONY: pagerts-sync pagerts-publish

pagerts-sync:
	git submodule set-url $(PAGERTS_PATH) $(PAGERTS_URL)
	git submodule sync -- $(PAGERTS_PATH)
	git submodule update --init --remote -- $(PAGERTS_PATH)

pagerts-publish:
	git -C $(PAGERTS_PATH) add -A
	git -C $(PAGERTS_PATH) diff --cached --quiet || git -C $(PAGERTS_PATH) commit -m "$(SUBMODULE_COMMIT_MSG)"
	git -C $(PAGERTS_PATH) push origin $(SUBMODULE_BRANCH)
	git add .gitmodules $(PAGERTS_PATH)
	git diff --cached --quiet || git commit -m "$(PARENT_COMMIT_MSG)"
	git push origin $(PARENT_BRANCH)
