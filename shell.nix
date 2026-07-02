{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  packages = with pkgs; [
    bash
    coreutils
    curl
    git
    gh
    jq
    ripgrep
    gnugrep
    gnused
    gawk
    findutils
    file
    which
    xz
    python3
    uv
    nodejs
  ];
}
