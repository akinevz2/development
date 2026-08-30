
DROP_PORT ?= 7331
DROP_ROOT ?= $(CURDIR)

PINCH_PORT ?= 7332
PINCH_ROOT ?= $(CURDIR)

.PHONY: all restore

all: edit
	@echo all engines go!

edit:
	@vi ./Makefile

# Help target
help:
	@vi +15 ./Makefile

drop:
	@node system/drop.mjs --port $(DROP_PORT) --out $(DROP_ROOT)

pinch:
	@node system/pinch.mjs --port $(PINCH_PORT) --root $(PINCH_ROOT)

restore:
	`( printf "console.log({"; grep postStartCommand .devcontainer/devcontainer.json; printf "}.postStartCommand)" ) | node`
