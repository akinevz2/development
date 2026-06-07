{
  description = "Development workspace Nix configuration for Turnstone agents";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            bash
            coreutils
            curl
            git
            jq
            ripgrep
            gnugrep
            gnused
            gawk
            findutils
            file
            which
            xz
          ];
        };
      });
}
