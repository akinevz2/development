# Development Workstation Devcontainer

This repository is configured to run as a persistent development workstation in
VS Code Dev Containers.

## What This Devcontainer Includes

- Base image: Debian Bookworm slim
- Build source: `.devcontainer/Dockerfile`
- Devcontainer features:
  - Git (latest)
  - GitHub CLI (latest)
- Post-create runtime bootstrap:
  - `nvm` via the upstream install script (`v0.40.5`)
  - Node.js LTS via `nvm install --lts`
- Forwarded ports: 8080 and 8081
- Default remote user: `vscode`

## Dotfiles and Persistence

Dotfiles are restored from:

- Repository: `https://github.com/akinevz2/configs.git`
- Target path: `~/dotfiles`
- Install command: `cd ~/dotfiles && make stow`

The post-create script also ensures dotfiles are synced and shell links are
applied using:

- `.devcontainer/post-create.sh`
- `make stow-shell`

It also installs documentation tooling via apt:

- `pandoc`
- `texlive-latex-extra`

## VS Code Customization

The devcontainer applies workspace defaults for:

- Bash as the default integrated terminal profile
- Prettier for JSON and TypeScript formatting
- YAML formatting via Red Hat YAML extension
- Format on save

Recommended extensions are configured in
`.devcontainer/devcontainer.json` and include Copilot, ESLint, Prettier,
GitLens, Error Lens, YAML support, and EditorConfig.

## First Run

1. Open this folder in VS Code.
2. Select Reopen in Container when prompted.
3. Wait for image build and post-create setup to complete.
4. Verify tooling:

```bash
nvm --version
node -v
npm -v
git --version
gh --version
```

## Security Practices

- Validate all external input.
- Prefer parameterized database access via trusted libraries/ORMs.
- Log security-relevant events with clear attribution.
- Return generic errors to clients and detailed diagnostics to logs.
- Use defense-in-depth controls.
- Test security behavior, do not assume it.

## Repository Layout (High Level)

- `personal/`: personal projects
- `uni/`: university projects and coursework
- `.devcontainer/`: container build and setup configuration

## Customization

- Edit `.devcontainer/devcontainer.json` for ports, features, extensions, and
  editor settings.
- Edit `.devcontainer/Dockerfile` for OS-level packages and base image changes.
- Edit `.devcontainer/post-create.sh` for setup steps that should run after
  container creation.
