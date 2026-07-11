<<EOF
{
  name: scala-metals,
  image: mcr.microsoft.com/devcontainers/base:debian,
  features: {
    ghcr.io/devcontainers/features/java:1: {
      version: 21
    }
  },
  customizations: {
    vscode: {
      extensions: [
        scalameta.metals,
        scala-lang.scala
      ],
      settings: {
        metals.sbtScript: sbt,
        metals.showInferredType: true
      }
    }
  },
  postCreateCommand: bash -lc source \"$SDKMAN_DIR/bin/sdkman-init.sh\" && sdk install sbt 1.10.2 || true && sdk install scala 3.6.2 || true
}EOF
