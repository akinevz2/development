# Dev Container Configuration

This is a devcontainer

# Security Practices

Never trust client input - validate everything
Use built-in ORM mechanisms for protection - Parametrised queries are automatic
Audit everything - log security-relevant events to respectful and identifiable loggers
Fail securely - Generic error messages, detailed logs
Layer your security - multiple defenses prevent single point of failure
Test security - don't assume it works, prove it behaves according to the scenario

This dev container provides a complete development environment with:

## Included Tools & Languages

- **Operating System**: Debian Bookworm (Slim)
- **Java**: OpenJDK 25 (latest)
- **Build Tools**: Maven 3.9.9, Make
- **Quarkus**: CLI via JBang
- **Node.js**: LTS version with npm
- **TypeScript**: Latest version with ts-node
- **Scala**: Latest version with SBT, Coursier, Scalafmt, Scalafix
- **Data Format Tools**:
  - JSON: `jq`, `jsonlint`
  - XML: `xmlstarlet`
  - YAML: `yq`, `yaml-language-server`
  - Prettier for formatting

## VS Code Extensions

Pre-installed extensions for:

- Java development (Red Hat, debugger, testing)
- Quarkus support
- Scala/Metals
- TypeScript/JavaScript (ESLint, Prettier)
- JSON/XML/YAML editing
- Makefile tools
- Git (GitLens)
- Quality of life improvements

## Port Forwarding

Default forwarded ports:

- `8080`: Main application (Quarkus default)
- `8081`: Secondary application
- `5005`: Java debug port
- `3000`: Node.js applications

## Persistent Volumes

Maven, SBT, and Ivy2 caches are mounted from your host machine to speed up builds across container rebuilds.

## Usage

1. Open this folder in VS Code
2. When prompted, click "Reopen in Container"
3. Wait for the container to build (first time only)
4. Start developing!

## Verification

After the container starts, run:

```bash
java -version      # Should show Java 25
mvn -version       # Maven 3.9.9
node -v            # Node.js LTS
npm -v             # npm latest
scala -version     # Scala latest
sbt --version      # SBT
quarkus --version  # Quarkus CLI
make --version     # GNU Make
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
