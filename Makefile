
DROP_PORT ?= 7331
DROP_ROOT ?= $(CURDIR)

PINCH_PORT ?= 7332
PINCH_ROOT ?= $(CURDIR)

.PHONY: all restore pull push sync status edit

all: edit
	@echo all engines go!

pull:
	@echo "Pulling changes from development repository..."
	@git pull || { echo "Error pulling development"; exit 1; }
	@echo "Pull completed successfully"

push:
	@echo "Pushing changes to development repository..."
	@git push || { echo "Error pushing development"; exit 1; }
	@echo "Push completed successfully"

sync:
	@echo "Syncing development repository..."
	@git pull || { echo "Error syncing (pull failed)"; exit 1; }
	@echo "Sync completed successfully"

# Show status of development repository
status:
	@git status --short

edit:
	@vi ./Makefile

# Help target
help:
	@vi +36 ./Makefile

drop:
	@node system/drop.mjs --port $(DROP_PORT) --out $(DROP_ROOT)

pinch:
	@node system/pinch.mjs --port $(PINCH_PORT) --root $(PINCH_ROOT)

restore:
	`( printf "console.log({"; grep postAttachCommand .devcontainer/devcontainer.json; printf "}.postAttachCommand)" ) | node`
