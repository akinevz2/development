{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
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
}
