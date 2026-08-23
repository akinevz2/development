
DROP_PORT ?= 7331
DROP_OUT ?= $(CURDIR)

PINCH_PORT ?= 7332
PINCH_ROOT ?= $(CURDIR)

.PHONY: all restore

all: restore
	@echo all engines go!

# Help target
help:
	@$$EDITOR -g12 ./Makefile

drop:
	@node system/drop.mjs --port $(DROP_PORT) --out $(DROP_OUT)

# File picker: serves an HTTP page (auto-forwarded by VS Code) for picking
# files from the devContainer filesystem and downloading them to the host.
# Usage: make pinch                  # root = cwd
#        make pinch PINCH_ROOT=/some/dir PINCH_PORT=8000
pinch:
	@node system/pinch.mjs --port $(PINCH_PORT) --root $(PINCH_ROOT)

restore:
	`( printf "console.log({"; grep postStartCommand .devcontainer/devcontainer.json; printf "}.postStartCommand)" ) | node`
