# Nix Usage For Turnstone Agents

These files are committed in-repo so agent sessions running in `/workspace`
can use consistent package tooling.

## Files

- `flake.nix`: Primary Nix flake config for a reproducible dev shell.
- `shell.nix`: Fallback for non-flake workflows.
- `.config/nix/nix.conf`: Enables `nix-command` + `flakes`.

## Typical Commands

- Enter dev shell (flake):
  - `nix develop`
- Run one command with a package:
  - `nix shell nixpkgs#ripgrep --command rg --version`
- Legacy shell fallback:
  - `nix-shell`

## Notes

- Keep this config in source control so all agent runs share the same package baseline.
- If additional tools are needed, add them to `flake.nix` and `shell.nix` together.
