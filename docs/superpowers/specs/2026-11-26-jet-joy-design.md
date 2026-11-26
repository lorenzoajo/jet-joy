# Jet Joy — Design

## Intent
Cartoon 3D arcade flight game for mobile browsers (iOS Safari first-class), installable as a PWA. Stylized toy-like F-16. Fun, forgiving, short sessions with clear objectives.

## Goals
- 5 short missions with goals + 1–3 star ratings, progress saved locally.
- Fuel drains constantly; fuel balloons refill; rings give speed boost + combo points; ★ stars are mission collectibles.
- Goofy blimp drones firing slow homing bubble missiles; auto-aim cannon to pop them.
- Forgiving physics: terrain/island collision bounces and costs fuel; no instant death. Game over only on empty fuel or too many hits (hits cost fuel).
- Controls: left virtual joystick (pitch/roll), right buttons (BOOST, FIRE). Optional tilt steering (iOS permission requested on tap).
- 60fps target on mid-range phones: low-poly procedural geometry, no external assets, flat/toon shading.
- Offline-capable PWA (manifest, service worker, icons), standalone display, landscape.

## Non-goals
- Multiplayer, realistic flight model, external 3D models/textures, backend.

## Anti-goals
- Frustrating difficulty, Vue reactivity in the per-frame loop, laggy touch input.

## Constraints
- Vue 3 + TypeScript + Vite; Three.js for rendering.
- devenv for dev shell; `nix build` produces static `dist` via flakes.
- Audio/tilt unlocked by first user gesture ("Tap to fly").

## Approaches
1. **Vue UI + plain Three.js engine modules (chosen).** Engine is framework-agnostic TS; Vue only renders menus/HUD from a throttled snapshot. Best performance and separation.
2. TresJS (declarative Three in Vue): nicer templates but reactivity overhead and less loop control.
3. Babylon.js: heavier bundle, no real benefit here.

## Architecture
- `src/game/` — engine: `Game` (loop, state machine), `Player` (arcade flight), `World` (islands, sea, clouds, bounds), `Pickups` (fuel, rings, stars), `Enemies` (blimps, bubble missiles), `Bullets`, `Input` (joystick/keys/tilt), `Audio` (WebAudio synth sfx), `missions.ts` (data), `models/` (procedural meshes).
- `src/ui/` — Vue components: Title, MissionSelect, HUD, Joystick, Pause, Results.
- `src/store/progress.ts` — localStorage stars per mission.
- Engine emits events + a HUD snapshot (~10Hz) consumed by Vue.

## Missions (data-driven)
1. First Flight — collect 5 stars.
2. Ring Runner — fly through 12 rings in 90s.
3. Blimp Pop — pop 4 blimps.
4. Long Haul — collect 10 stars with fuel spread thin.
5. Sky Party — 8 stars + 5 blimps.
Rating: 1★ completed, 2★/3★ by remaining time/fuel thresholds.

## Builder's calls
Exact tuning numbers, color palette, procedural model details, sfx design.
