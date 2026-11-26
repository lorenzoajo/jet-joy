# Jet Joy ✈️

Cartoon 3D arcade flight game for mobile browsers, installable as a PWA.
Fly a chunky toy F-16 over floating islands: grab ★ stars, chain rings for boosts and combos, keep your fuel up with red balloons, and pop grumpy blimps (auto-aim cannon fires when something's in the red lock reticle).

## Controls
- **Touch:** drag anywhere on the left half to steer (virtual joystick), ⚡ button to boost (needs ⅓ meter; rings and green chevrons refill it).
- **Tilt (optional):** enable "Tilt steer" on the title screen (iOS asks permission). Hold the phone in the position you like when the mission starts; pausing recalibrates.
- **Keyboard:** WASD / arrows to steer, Space or Shift to boost.

## Develop
```sh
direnv allow        # auto-loads the devenv shell on cd (or: devenv shell)
dev                 # vite dev server on the LAN (open it from your phone)
test-web            # vitest
build-web           # typecheck + production build into dist/
```
Quick testing deep link: `http://localhost:5173/#play=2` jumps straight into mission 3.

## Nix
```sh
nix build           # static site in ./result
nix run             # serve ./result on :8080 (PORT=... to change)
```
Dependencies come from `package-lock.json` via `importNpmLock`, so there is no hash to bump.

## Install on iPhone
Open the deployed URL in Safari → Share → **Add to Home Screen**. It runs full-screen and offline. (Service workers need HTTPS or localhost.)

## Layout
- `src/game/` — framework-free engine: `Game.ts` (loop/entities), `flight.ts` (arcade flight model), `layout.ts` (seeded world gen), `missions.ts` (mission data, win/lose, star rating), `input.ts`, `audio.ts` (WebAudio synth, no audio files), `models/` (procedural low-poly meshes).
- `src/ui/` — Vue screens and HUD (fed by a 10 Hz snapshot, never per frame).
- `src/store/` — localStorage progress and settings.
