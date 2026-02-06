# Dev Container Configuration

Slim devcontainer for general development.

# Security Practices

Never trust client input - validate everything
Use built-in ORM mechanisms for protection - Parametrised queries are automatic
Audit everything - log security-relevant events to respectful and identifiable loggers
Fail securely - Generic error messages, detailed logs
Layer your security - multiple defenses prevent single point of failure
Test security - don't assume it works, prove it behaves according to the scenario

This dev container provides a minimal development environment with:

## Included Tools & Languages

- **Operating System**: Debian Bookworm (Slim)
- **Node.js**: LTS version with npm
- **Git** and **GitHub CLI**

## VS Code Extensions

Pre-installed extensions for:

- TypeScript/JavaScript (ESLint, Prettier)
- YAML editing
- Git (GitLens)
- Quality of life improvements

## Port Forwarding

Default forwarded ports:

- `8080`: General use
- `8081`: General use

## Repository Layout

Top-level directories are:

- **personal/**: personal projects
  - **website/** (formerly frontend)
  - **gtkappfolder/**
  - **pagerts/**
  - **resume/**
  - **KEYBOARD.md**
- **uni/**: university projects and coursework

## Usage

1. Open this folder in VS Code
2. When prompted, click "Reopen in Container"
3. Wait for the container to build (first time only)
4. Start developing!

## Verification

After the container starts, run:

```bash
node -v            # Node.js LTS
npm -v             # npm latest
git --version      # Git
```

## Customization

Edit `devcontainer.json` to:

- Add more VS Code extensions
- Change port forwarding
- Modify settings
- Add post-create commands

Edit `Dockerfile` to:

- Install additional system packages
- Change tool versions
- Add more global npm packages
