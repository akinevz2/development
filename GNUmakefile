# GNUmakefile — the MASTER control for the depot: the development repo
# and the system subrepo kept in check together.
#
# GNU make prefers this file over Makefile — bare `make` runs the
# master; the development repo's own recipes remain reachable at
# `make -f Makefile <target>`.
#
# The two repos kept in check:
#   .        the development repo (the depot parent — personal/, the
#            system gitlink, the website gitlink)
#   system/  the depot subrepo (akinevz2/depot — the public submodules:
#            herbctl, herbstutil, polyframes, polytags, on-deploy; the
#            prototyping dirs are gitignored and local)
#
# The resilient publish contract: `git add -u` (tracked changes only —
# including the gitlinks; untracked files stay a manual decision),
# commit when there is anything to commit, push. A repo with nothing
# to publish is not an error.

PUBLISH_MSG ?= depot: publish
REPOS := . system

.PHONY: check sync publish help
.DEFAULT_GOAL := check

help:
	@echo "master targets:"
	@echo "  check     both repos: the branch, the dirt, ahead/behind + the system submodules"
	@echo "  sync      fetch + pull --rebase, both repos + the system submodules"
	@echo "  publish   commit tracked changes + push, both repos (PUBLISH_MSG=<msg>)"

check:
	@set -e; for r in $(REPOS); do \
		echo "== $$r"; \
		git -C $$r status --short --branch | head -4; \
	done
	@echo "== system submodules:"; git -C system submodule status | sed 's/^/  /'

sync:
	@set -e; for r in $(REPOS); do \
		echo "== sync $$r"; \
		git -C $$r fetch origin 2>/dev/null || true; \
		git -C $$r pull --rebase --autostash || exit 1; \
	done
	@git -C system submodule update --remote
	@echo "sync: both repos and the submodules are at their origin tips"

publish:
	@set -e; for r in $(REPOS); do \
		echo "== publish $$r"; \
		git -C $$r add -u; \
		if git -C $$r diff --cached --quiet; then \
			echo "   nothing staged — skipped"; \
		else \
			git -C $$r commit -q -m "$(PUBLISH_MSG)"; \
			git -C $$r push origin HEAD; \
		fi; \
	done
	@echo "publish: both repos are at their origin tips"
