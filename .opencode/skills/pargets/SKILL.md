---
name: pagerts
description: Fetch and parse Wikipedia pages using npx pagerts for link extraction. Uses curl for web URL fallback, then npx pagerts file://<local-file> to extract resources.
---
# pagerts

## Purpose

Extracts all linked resources from a Wikipedia page using `npx pagerts` (the parsoid-based resource extractor). The tool can operate on either a web URL or a local HTML file.

## Workflow

### Step 1 — Accept a Wikipedia URL or local file path

The script accepts one argument:
- **Web URL** (e.g., `https://en.wikipedia.org/wiki/Cook–Levin_theorem`) — automatically downloaded via `curl` to a temporary local file
- **Local file path** (e.g., `./page.html` or `file:///path/to/page.html`) — used directly

### Step 2 — Download via curl (if web URL)

If the argument is a `https://` URL:
```bash
curl -s "$URL" > /tmp/pagerts-local-<timestamp>.html
```
The temp file location is printed to stdout for debugging.

### Step 3 — Run npx pagerts on local file

```bash
npx pagerts "file:///tmp/pagerts-local-<timestamp>.html"
```
or for direct local files:
```bash
npx pagerts "./page.html"
```

**NOT** using the `fetch` subcommand — just passing the path as the required argument.

### Step 4 — Process output with jq

The output is a JSON array with a `resources` field. Each resource has:
- `text.{key, value}` — e.g., `{"key": "class", "value": "mw-jump-link"}`
- `link.{key, value}` — e.g., `{"key": "href", "value": "https://en.wikipedia.org/..."}`

Filter resources where `link.value` matches `en.wikipedia.org` or `ru.wikipedia.org`:
```bash
jq -r '.[0].resources[] | select(.link.value | test("en\\.wikipedia\\.org|ru\\.wikipedia\\.org")) | {title: .text.value, url: .link.value}'
```

## Command Reference

```bash
# With web URL (autocurls + processes):
./pagerts-wiki.sh --all https://en.wikipedia.org/wiki/Cook–Levin_theorem

# With web URL (single URL, JSON object):
./pagerts-wiki.sh https://en.wikipedia.org/wiki/Cook–Levin_theorem

# With local HTML file:
./pagerts-wiki.sh ./page.html

# Underlying commands (what the script runs):
curl -s "https://en.wikipedia.org/wiki/Cook–Levin_theorem" > /tmp/pagerts-local-12345.html
npx pagerts "file:///tmp/pagerts-local-12345.html"
```