{
  description = "Jet Joy — cartoon jet PWA game";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        nodejs = pkgs.nodejs_22;
        jet-joy = pkgs.buildNpmPackage {
          pname = "jet-joy";
          version = "0.1.0";
          src = pkgs.lib.cleanSource ./.;
          inherit nodejs;
          npmDeps = pkgs.importNpmLock { npmRoot = ./.; };
          npmConfigHook = pkgs.importNpmLock.npmConfigHook;
          installPhase = ''
            runHook preInstall
            cp -r dist $out
            runHook postInstall
          '';
        };
      in
      {
        packages.default = jet-joy;
        apps.default = {
          type = "app";
          program = "${pkgs.writeShellScript "serve-jet-joy" ''
            exec ${pkgs.python3}/bin/python3 -m http.server -d ${jet-joy} ''${PORT:-8080}
          ''}";
        };
        devShells.default = pkgs.mkShell { packages = [ nodejs ]; };
      });
}
