# SHATTERLINE — Progress Log

## How to work on it
* Edit `src/*` (sections, concatenated in name order), then `node tools/build.js` → regenerates `index.html` (the deliverable, committed).
* Tests (Playwright, headless Chromium; `NODE_PATH=$(npm root -g)`; screenshots go to `$OUT`, default `./shots`, git-ignored):
  * `node tools/test.js smoke 20` — load, start run, bot plays in real time, screenshots, console errors.
  * `node tools/test.js run N` — turbo bot full run (`GOD=1`, `CHAR=`, `SEED=`); logs room transitions, stalls (with enemy dump), death recap.
  * `node tools/test.js scene N` — real-time capture of a configured fight (`BIOME`, `NODE=boss|elite…`, `UPGS=a,b`, `WEAPON`, `CHAR`, `TAG`).
  * `node tools/test.js stress` — 300 enemies + 1000 bullets, timings.
  * `node tools/fuzz.js` — every weapon, character, active item, room type, all 4 bosses, and an all-97-upgrades/24-synergies build, bot-driven; reports exceptions.
* In-game debug: F3 FPS/timings + director stress graph, F4 AI action/role/token labels + A* paths, F5 flow field, F6 hitboxes. `window.SL` exposes test hooks.

## Milestones
| | Status | Notes |
|---|---|---|
| M1 loop/input/movement/dash/weapon/enemy/juice/SFX | ✅ | 120 Hz fixed step, interpolated render, hitstop, trauma shake, graze system |
| M2 AI framework + enemies | ✅ | 17 archetype brains, utility selection, flow field, A* service, tactician, director |
| M3 rooms/gen/map/biome 1 + boss | ✅ | 11 templates + boss arena, seeded variation, doors, hazards, branching map |
| M4 upgrades/synergies/characters/shop | ✅ | 97 upgrades, 24 synergies, 5 characters, 8 actives, shop/treasure/rest/events |
| M5 adaptive music, sound pass, post FX | ✅ | 4 themes × 5 stems, beat-quantised stingers, WebGL bloom/CA/CRT/low-HP grade |
| M6 remaining biomes/bosses, meta, UI | ✅ | 4 biomes/bosses, unlocks, boosts, achievements, codex, history, daily/custom seeds, heat 1–10 |
| M7 balance/perf/bugs | ✅ (first pass) | see below |

## Verification results (latest)
* Fuzz: 0 exceptions across all weapons/characters/actives/rooms/bosses/all-upgrade build.
* God-mode bot completes a full run (4 biomes + The Architect → victory summary), 0 console errors.
* Non-god bot (crude dodging) reliably clears biome 1 rooms and sometimes boss 1; deaths come from dense boss patterns.
* Stress (256 enemies + ~1060 enemy bullets): sim ≈ 1.5 ms/tick (≈3 ms/frame at 60 fps). JS render ≈ 8 ms under
  SwiftShader software GL (dominated by rasterisation that is GPU-side on real hardware).
* Every SFX recipe offline-rendered: non-silent, no NaN, peaks within limiter range. Music sequencer + stem ramps verified.

## Key design decisions
* Single file built from `src/` sections — keeps the required section order while staying editable.
* Canvas 2D scene + WebGL post pass (bloom threshold/blur, chromatic aberration, desaturation, vignette, CRT); falls back to 2D.
* Actors (enemies, player) are drawn *after* the lightmap so combatants stay crisp; environment stays moody.
* Enemy bullets are cached sprites with a dark rim (readability on any background); player bullets are batched streaks.
* Upgrade descriptions are generated from the same stat rows that are applied → tooltips are always exact.
* Synergies auto-activate (two families ≥2 picks) with a toast + stinger; build overview shows progress toward them.
* Gameplay timers run in sim time (`addTimer`), so slow-mo/hitstop/pause never desync logic.

## Tuning notes
* Explosions from barrels/Ticks hurt the player for at most `T.room.selfBlast` (18) — full damage to enemies.
* Hazards: electric floor / spikes 12 per hit; lava 11 per 0.8 s (i-frames).
* Boss bullet damage = 11 × biome factor (1 / 1.15 / 1.3 / 1.45); lasers scale 0.8–1.1 by biome. Prism Warden HP 2600.
* Director budget: `16 + 3.5×layer`, ×1.5 per biome, ×1.5 elite rooms; waves ≈ 34 % of budget; BUILD→PEAK (stress > .72)→RELAX.
* Anti-stall: any walker without LOS on the player for 5 s switches to a flow-field hunt.

## Known issues / ideas for next session
* Balance is bot-informed; a human playtest pass on boss 2–4 pattern density and late-biome enemy HP is the next step.
* Gamepad UI navigation is spatial-nearest; works on all screens but the settings sliders need mouse/keyboard to adjust.
* Bot (tests only) does not use shops and plays bows/flamers conservatively.
