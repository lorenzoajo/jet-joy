{ pkgs, ... }:
{
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_22;
    npm.enable = true;
    npm.install.enable = true;
  };

  scripts = {
    dev.exec = "npm run dev";
    build-web.exec = "npm run build";
    test-web.exec = "npm test";
    nix-build.exec = "nix build .#default";
  };

  processes.vite.exec = "npm run dev";

  enterShell = ''
    echo "Jet Joy dev shell — commands: dev, build-web, test-web, nix-build"
  '';
}
