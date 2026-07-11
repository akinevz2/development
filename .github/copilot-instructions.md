# DevContainer Computing Platform - Maintenance Instructions

This devcontainer serves as a personal Unix-based computing platform. Follow these guidelines when making changes or assisting with system maintenance.

## System Philosophy

This is a **persistent development environment** that should be treated like a personal workstation, not a disposable container. All configurations should survive rebuilds.

## Local LLM Infrastructure

### Hosts

| Host | IP | Role |
|---|---|---|
| `ws-raretower` | `10.77.77.1` | Cornfield node-1 runner (bare metal, GPU) |
| `minifridge` | `10.77.77.5` | Primary development machine |

Both hosts are injected via `runArgs` in `devcontainer.json` and are always reachable from inside the container.

### Cornfield Topology Notes

- Local fork branding uses `cornfield` in this workspace (submodule path: `system/cornfield`, remote: `akinevz2/cornfield`).
- `ws-raretower` is the node-1 runtime host for the cornfield stack.
- `minifridge` is the day-to-day development and maintenance host.
- Both nodes should keep the Nix package manager available so an LLM agent can perform system maintenance and reproducible installs.
- Ongoing gateway objective: include Copilot and Anthropic-backed models as fallback providers for higher-order reasoning when local inference quality is insufficient.

### Endpoints

| Port | Protocol | Service | Notes |
|---|---|---|---|
| `11434` | HTTP | Ollama (direct) | Raw Ollama API; use for management ops (model list, pull, delete) |
| `11444` | HTTP | OpenZiti LLM-gateway | **Primary inference endpoint** — OpenAI-compatible, model-routing aware |

**Default base URL for all new LLM client code:** `http://ws-raretower:11444/v1`

### Model Routing Strategy

The LLM-gateway at `:11444` routes requests by model name. Follow this split:

| Use case | Target model alias | Rationale |
|---|---|---|
| **Tool / function calls** | `tools` (small, fast model) | Structured output; latency matters more than reasoning depth |
| **Generation / thinking** | `think` (large, capable model) | Open-ended reasoning, summaries, code generation |
| **Embeddings** | `embed` | Dedicated embedding model; never use a chat model for this |

When writing LangChain4j, Ollama Java client, or any OpenAI-SDK code in this repo, default to the `tools` model for anything that invokes functions/tools and the `think` model for chat/completion turns that need reasoning. Do **not** hardcode specific model version strings (e.g. `gemma4:latest`) in application config — use the alias names so the gateway can be reconfigured without touching code.

**Example Quarkus `application.properties` snippet:**

```properties
# LLM gateway — OpenAI-compatible
quarkus.langchain4j.openai.base-url=http://ws-raretower:11444/v1
quarkus.langchain4j.openai.api-key=none
quarkus.langchain4j.openai.chat-model.model-name=think
quarkus.langchain4j.openai.embedding-model.model-name=embed

# Override for tool-calling sessions (set programmatically where needed)
# pdhd.llm.tool-model=tools
```

### Fallback: Direct Ollama

If the gateway at `:11444` is unavailable, fall back to direct Ollama at `http://ws-raretower:11434`. The Ollama API is a subset of OpenAI-compatible, so the same client code works with a URL swap. Avoid hardcoding port 11434 in new code; prefer the gateway.

### Connectivity Check

```bash
# Gateway health
curl -s http://ws-raretower:11444/v1/models | jq '.data[].id'

# Direct Ollama fallback
curl -s http://ws-raretower:11434/api/tags | jq '.models[].name'
```

## Dotfiles Management

- **Primary dotfiles repo**: `https://github.com/akinevz2/configs.git`
- **Location**: `~/dotfiles`
- **Management tool**: GNU Stow
- User shell configurations (`.bashrc`, `.zshrc`, etc.) are symlinked from `~/dotfiles/shell/`
- **After editing shell configs**:
  ```bash
  cd ~/dotfiles
  git add -A
  git commit -m "Update shell configs"
  git push
  ```
- Dotfiles are automatically restored on container rebuild via `devcontainer.json`

## Package Management Strategy

### System Packages (APT)

- Use `sudo apt install -y <package>` for system-level tools
- Add essential packages to `.devcontainer/post-create.sh` for persistence
- Always run `sudo apt update` before installing

### Language-Specific Package Managers

- **Node.js/NPM**: Global tools go in post-create.sh (`npm install -g`)
- **Java/Maven**: Managed via devcontainer features and coursier
- **Scala**: Via coursier (`cs install`)
- **Python**: Use `--break-system-packages` flag or create venvs

### Persistent Directories

These are mounted from host and survive rebuilds:

- `~/.m2` - Maven repository
- `~/.sbt` - SBT cache
- `~/.ivy2` - Ivy cache

## File Organization

```
/workspaces/development/
├── .devcontainer/          # Container configuration
│   ├── devcontainer.json   # Main config with dotfiles settings
│   ├── post-create.sh      # Setup script
│   └── Dockerfile.warp     # Custom image with Cloudflare WARP
├── .vscode/                # Workspace settings
│   ├── settings.json       # Editor config
│   └── extensions.json     # Recommended extensions
├── .github/                # GitHub-specific files
│   └── copilot-instructions.md  # This file
└── [project files]         # Your actual development work
```

## Container Rebuild Best Practices

1. **Before rebuilding**: Commit and push all dotfile changes
2. **Post-rebuild verification**:

   ```bash
   # Check dotfiles are linked
   ls -la ~ | grep " -> "

   # Verify tools
   node -v && npm -v && java -version && scala -version

   # Check shell config loaded
   echo $PATH | grep -q ".local/share/coursier"
   ```

## Services & Daemons

### LLM Gateway (ws-raretower:11444)

The OpenZiti LLM-gateway runs on the host machine and is available as long as `ws-raretower` is reachable (it is injected at container start via `--add-host`). No daemon management is needed inside the container. If the gateway is down, the Ollama fallback at `:11434` is always available.

### Cloudflare WARP

- **Daemon**: `sudo warp-svc &> /dev/null &`
- **CLI**: `warp-cli`
- **Status**: `warp-cli status`
- Start daemon before using CLI commands

### D-Bus (if needed)

- Required by some services (WARP, NetworkManager)
- Start: `sudo mkdir -p /run/dbus && sudo dbus-daemon --system --fork`

## Development Workflow

### Adding New Tools

1. Test installation manually first
2. If it should persist, add to `post-create.sh`
3. Document in this file
4. Test with a container rebuild

### Modifying Configurations

1. Edit config files (they're symlinked to dotfiles)
2. Test changes
3. Commit to dotfiles repo: `cd ~/dotfiles && git add -A && git commit && git push`
4. Changes will automatically apply on next rebuild

### Path Management

- Coursier bin: `~/.local/share/coursier/bin`
- JBang: `~/.jbang/bin`
- User local: `~/.local/bin`
- All managed via `.bashrc` which is stowed from dotfiles

## Troubleshooting

### Dotfiles not loading after rebuild

```bash
cd ~/dotfiles
make stow-shell
```

### Command not found after rebuild

- Check if it's in `post-create.sh`
- Verify PATH in `.bashrc`
- Run: `source ~/.bashrc`

### Container feels slow

- Check Docker resource limits
- Review mount points in `devcontainer.json`
- Consider pruning: `docker system prune -a`

## Making Changes Persistent

**Rule of thumb**: If you want it to survive a rebuild, it must be either:

1. In the dotfiles repo (configs)
2. In `post-create.sh` (installations)
3. In `devcontainer.json` (container config)
4. On a mounted volume (cache/data)

**DO NOT** just install things and expect them to survive - the container is ephemeral!

## Current Tool Stack

### Languages & Runtimes

- Java 25 (via SDKMAN/devcontainer features)
- Maven (latest)
- Node.js (LTS)
- Scala (via Coursier)
- SBT (via Coursier)
- Python 3.13

### Build Tools

- Maven, SBT, Make, npm
- Quarkus CLI (via JBang)

### Development Tools

- Git, GitHub CLI (`gh`)
- Docker (Docker-in-Docker)
- GNU Stow (dotfiles management)
- TypeScript, ts-node, ESLint, Prettier
- jq, xmlstarlet, yq (data processing)

### Networking

- Cloudflare WARP CLI
- curl, wget
- OpenZiti LLM-gateway at `ws-raretower:11444` (OpenAI-compatible, model-routing)
- Ollama at `ws-raretower:11434` (direct, management only)

### VS Code Extensions

See `.devcontainer/devcontainer.json` for the full list

## Security Notes

- This container runs as `kine` user (non-root)
- Sudo is available for system operations
- Docker socket is accessible (Docker-in-Docker)
- WARP daemon requires root privileges

## Custom Modifications

When adding custom features:

1. Document here
2. Add to appropriate config file
3. Test rebuild cycle
4. Commit all changes to git

---

**Remember**: Treat this like your personal workstation. Keep it organized, document changes, and maintain the dotfiles repo!
