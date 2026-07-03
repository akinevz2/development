# Cornfield Node Operations Notes

This document captures current node roles and maintenance expectations for the cornfield deployment in this workspace.

## Node Roles

- minifridge (10.77.77.5): primary development machine.
- ws-raretower (10.77.77.1): cornfield node-1 runner for deployment/runtime workloads.

## Repository Mapping

- Workspace submodule path: system/cornfield
- Submodule remote: https://github.com/akinevz2/cornfield.git

## Package Manager Requirement (Both Nodes)

Both hosts should have Nix package manager available so an LLM agent can perform reproducible system maintenance tasks.

Minimum checks:

```bash
command -v nix
nix --version
nix profile list || true
```

## LLM Gateway Fallback Plan (ws-raretower)

Primary endpoint remains the local gateway on ws-raretower. In addition, configure provider fallbacks for high-complexity requests when local models are insufficient:

- Copilot-backed provider route
- Anthropic-backed provider route

Implementation objective:

- Keep local models as default for speed/cost control.
- Route high-order reasoning to fallback providers by policy/alias.
- Preserve clear provider ordering and failure behavior in gateway config.

## Setup Checklist

- [ ] Verify system/cornfield submodule tracks akinevz2/cornfield.
- [ ] Verify Nix is installed and callable on minifridge.
- [ ] Verify Nix is installed and callable on ws-raretower.
- [ ] Add Copilot provider credentials/config on ws-raretower gateway.
- [ ] Add Anthropic provider credentials/config on ws-raretower gateway.
- [ ] Define fallback policy (local first, remote fallback for higher-order thinking).
- [ ] Validate routing with test prompts and capture results.

## Validation Commands

```bash
# Submodule check from workspace root
cd /workspaces/development
git submodule status system/cornfield

# Gateway model visibility on ws-raretower
curl -s http://ws-raretower:11444/v1/models | jq '.data[].id'

# Direct Ollama fallback visibility
curl -s http://ws-raretower:11434/api/tags | jq '.models[].name'
```

## Minifridge Rebuild Command

Use the cornfield-branded path (not the legacy `system/turnstone` path):

```bash
podman compose -f system/cornfield/deploy/minifridge-node.compose.yaml build \
	&& podman compose -f system/cornfield/deploy/minifridge-node.compose.yaml up -d
```
