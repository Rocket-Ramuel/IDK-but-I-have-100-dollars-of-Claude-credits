# SHATTERLINE — Progress Log

## How to work on it
* Edit `src/*` (sections in load order), then `node tools/build.js` → regenerates `index.html` (the deliverable).
* Test: `NODE_PATH=$(npm root -g) node tools/test.js smoke 20` (screenshots in `$OUT`, default `./shots`).
  * `run N` — turbo bot full-run (`GOD=1` god mode, `CHAR=`, `SEED=`), reports stalls + errors.
  * `stress` — 300 enemies + 1000 bullets, prints frame/sim timings.
* In-game: F3 FPS, F4 AI labels/paths, F5 flow field, F6 hitboxes. `window.SL` exposes test hooks.

## Status
### Session 1
* All sections authored: config, core, audio (SFX + adaptive music), renderer (+WebGL post), world gen, entities, AI (17 brains,
  tactician, director), 4 bosses, weapons (13), upgrades (97), synergies (24), UI, meta/save, bot.
* Bot completes biomes 1–3 + bosses in god mode with zero console errors.
* Fixed: UI callback staging, boss grid-query padding, focus timer in sim-time, Bulwark/Mender deadlock,
  anti-stall hunt action, thick-LOS path smoothing, stacked toasts.

## Known issues / next
* Visual tuning of bloom/glow density in heavy fights (verify in real-time captures).
* Balance pass (enemy HP/dmg per biome, boss HP), full non-god bot runs.
