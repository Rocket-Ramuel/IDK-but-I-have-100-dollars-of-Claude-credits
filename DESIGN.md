# SHATTERLINE — Design Document

A neon-on-dark vector twin-stick roguelite. Single self-contained `index.html`, zero dependencies,
procedural art and synthesized audio.

## 0. Repository layout

```
index.html        ← the game (generated, self-contained, open directly in a browser)
src/*.js|html     ← source sections, concatenated in name order into index.html
tools/build.js    ← `node tools/build.js` → index.html
tools/test.js     ← Playwright smoke test + bot run + stress profile
DESIGN.md / PROGRESS.md
```

`index.html` is the deliverable and is committed. The `src/` split exists only to keep sections
editable; the built file keeps the required section order:
**Config/Tuning → Core → Audio → Rendering/FX → World Gen → Entities → AI → Weapons/Upgrades → UI → Meta/Save**.

## 1. Pillars → technical consequences

| Pillar | Consequence |
|---|---|
| Feel first | Input sampled every frame; crosshair/aim drawn from the *latest* mouse position (not interpolated). 120 Hz fixed sim, interpolated render. Hitstop, trauma shake, recoil, flashes, layered SFX on every event. |
| Readable chaos | Player bullets = elongated streaks with white core; enemy bullets = round orbs with dark outline ring. Colour-blind palettes. Every enemy attack has a wind-up (glow + audio + ground marker). Death recap. |
| Builds change play | Upgrades are mostly behavioural flags on a `Build` object (`B`), consumed by one implementation each. 24 synergies. |
| Enemies think | Steering + shared flow field + A* service + per-archetype utility AI + squad tactician + pacing director. |
| One more run | 15–25 min runs, branching map, meta currency buys options (characters/weapons/upgrades), small capped boosts, heat levels. |

## 2. Architecture

### 2.1 Loop
* `requestAnimationFrame` → poll gamepad → accumulate `dt × gameSpeed × timeScale` → run fixed `1/120 s` ticks (max 8/frame)
  → render with `alpha = acc/step` interpolation.
* **Hitstop** freezes the accumulator (sim + particles), render and shake continue.
* **Slow-mo** = `timeScale` eased toward a target (grazes, boss death).

### 2.2 Data layout / performance
* **Enemies, bullets, pickups, props**: pooled plain objects with fixed shapes, kept in dense arrays with swap-remove.
* **Particles**: SoA typed arrays (`Float32Array`), capacity 6000, update per render-frame, batched draw per colour/kind
  (one `stroke()`/`fill()` per bucket). LOD: spawn probability scales down when particle count or frame time is high.
* **Spatial hash**: 64-unit cells, rebuilt every tick by counting sort into `Int32Array`s (no allocation).
  Queries fill a shared `Int32Array` result buffer.
* **Tiles**: `Uint8Array` (0 floor, 1 wall, 2 cover/destructible, 3 door), `Float32Array` cover HP, `Uint8Array` hazards.
* No closures/allocations in hot loops; temp vectors are module-level scalars.

### 2.3 Rendering
Canvas 2D scene → **WebGL post pass** (justified: real bloom threshold/blur, chromatic aberration, desaturation,
vignette, CRT in one cheap shader; fallback to plain 2D canvas when WebGL is missing).

Scene order:
1. background, floor (vector, per-frame Path2D cached per room), hazards (animated)
2. decal canvas (room-sized, 0.5 px/unit, fades with `destination-out`)
3. shadows, props, pickups, enemies, player (vector shapes, squash/stretch, white hit-flash)
4. **lightmap** (¼-res canvas: ambient fill + additive radial lights) composited with `multiply`
5. emissive layer (`lighter`): bullets (sprite cache), beams, arcs, sparks, explosions, telegraphs
6. world text (damage numbers)

Post (GL): bright-pass → ¼-res ping-pong gaussian blur ×2 → composite with chromatic aberration, low-HP
desaturation + red vignette, flash, optional CRT scanlines/curvature.
HUD on a separate crisp 2D canvas above; menus/cards/map are DOM overlays with CSS transitions.

### 2.4 Camera
Follows player with exponential smoothing, leads toward aim (22 %, max 90 u), zoom from a fixed visible
world height (560 u) × intensity zoom (±6 %). Shake = `trauma²` × smooth noise (offset + roll), trauma decays
non-linearly; scaled by the screen-shake setting and zeroed by reduced motion.

## 3. Entities & systems

* **Player**: accel/friction movement (snappy), dash (i-frames, cd, charges, afterimages), 2 weapon slots,
  ability (RMB), two actives (Q/E), graze/perfect-dodge detection (enemy bullet within graze radius during
  i-frames → ammo refund, 0.3 s slow-mo, ability charge).
* **Weapons**: data rows in `T.W`; kinds `gun` (generic projectile with pellets/spread/explode/return/arm…),
  `beam`, `rail`, `arc`, `bow`, `orbit`. Generic bullet supports pierce/bounce/split/homing/explode/elements
  so weapons and upgrades compose.
* **Status**: Burn (dps), Chill→Freeze (stacks to 100), Shock (chain lightning), Poison (stacking dps).
* **Damage pipeline**: `hurtEnemy()` → modifiers (crit, brittle, corrosion, shields, reflect) → flash, number,
  knockback, SFX, hitstop → statuses → on-hit hooks → death → on-kill hooks, drops, gibs, decals, combo, director.

## 4. AI

Layered, all shared/cached so 300 enemies stay cheap.

1. **Perception** (staggered, ~5 Hz/enemy): distance, LOS (grid DDA), HP ratio, nearby allies, player state.
2. **Utility selection** per archetype: actions (`chase`, `hold`, `strafe`, `cover`, `flank`, `retreat`,
   `wait`, `attack`, specials) scored by response curves over the perception inputs + role + tokens,
   with hysteresis bonus for the current action.
3. **Navigation**: one **Dijkstra flow field** to the player (hazard-weighted, time-sliced rebuild into a back
   buffer when the player changes tile), gradient sampled bilinearly. A **wall-clearance field** for
   avoidance. An **A\* service** (typed-array heap, budget 4 searches/tick) for arbitrary targets
   (flank points, cover, sniper perches); direct steering when the target is visible.
4. **Steering**: seek / flee / arrive / separation / cohesion / obstacle avoidance blended, then
   acceleration-limited; circle-vs-tile resolution gives wall sliding.
5. **Tactician (squad)** at 4 Hz: assigns roles `PIN`, `FLANK_L/R`, `RUSH`, `GUARD`, `SNIPE`; hands out
   **attack tokens** (caps simultaneous attackers); triggers pack rushes when enough melee are staged;
   friendly-fire checks; spreads formation when the player's build is AoE-heavy.
6. **Prediction**: intercept solve for lead aim, accuracy per difficulty; "cutoff" shots aimed at
   1.6× lead to block escape lanes.
7. **Adaptation**: EMA of player speed/displacement → *turtle* score (flush: mortars/bombers/rush priority) and
   *kite* score (intercept: chasers target predicted position, pincer flank assignment).
8. **Director (pacing)**: stress = damage taken + HP deficit + nearby pressure − kill speed; cycles
   BUILD → PEAK → RELAX; spawns waves from the room's threat budget; drives music intensity.
9. **Fairness**: every attack has wind-up glow + audio + ground marker, attacker caps, off-screen threat
   arrows, 0.9 s spawn telegraphs, death recap.

### Roster (17)
Mite (swarmer), Gunner, Ram (charger), Bulwark (shield), Lancer (sniper), Lobber (mortar), Brood (summoner),
Phantom (teleport assassin), Tick (kamikaze), Mender (healer), Warden (buffer), Delver (burrower),
Spire (turret), Mimic, Gel (splitter), Wisp (drone), Juggernaut (brute).
Elite modifiers: Vampiric, Hasted, Splitting, Shielded, Volatile, Reflective (stackable).

### Bosses (3 phases each)
Prism Warden (Neon Ruins), Cryo Forgemaster (Frozen Foundry), Mother Bloom (Toxic Undergrowth),
The Architect (The Core, final). Intro: letterbox + pan + title card + stinger. Death: slow-mo, chained
explosions, flash, shards.

## 5. Builds
* 13 weapons, 5 characters, ~90 upgrades in 12 families + general + cursed, 24 synergies (auto-activate
  when two families each have ≥2 picks; codex records them).
* Upgrade rows live in the tuning table: `[id, family, rarity, name, desc-template, stats]`; picking adds
  `stats` into `B`; description numbers are rendered *from the same stats* so tooltips are always exact.
* Rewards: 3 cards per room (family-weighted toward what you own), reroll, banish, shops, treasure,
  cursed items.

## 6. World
* 4 biomes × branching map (6 layers + boss). Node types: combat, elite, shop, treasure, challenge, rest,
  event, boss.
* Rooms: template generators (arena, cross, ring, halls, diamond, pillars, courtyard, L, field, boss arenas)
  + seeded variation (symmetry, destructible cover, barrels, hazards). Doors lock in combat.
* Seeds: per-run seed string; every room/map/offer gets its own RNG derived from `seed:biome:node:purpose`,
  so content is independent of combat randomness → replayable/shareable.

## 7. Audio graph

```
sources → voice gain → StereoPanner → [sfxMinor → duckSfx] → sfx bus ┐
                                        [sfxMajor] ───────→ sfx bus ┤
music stems (drums,bass,lead,pad,arp) → duckMusic → music bus ──────┼→ master → compressor/limiter → out
UI sounds → ui bus ─────────────────────────────────────────────────┘
```
* SFX: layered synthesis (transient + body + tail), noise buffers, FM, ±7 % pitch/vol jitter.
* Voices: per-sound cap with oldest-steal, global cap with priority.
* Spatial: pan by screen-x, attenuation by distance from camera.
* Ducking on big explosions/boss roars.
* Music: look-ahead scheduler (25 ms tick, 120 ms horizon), 16th-note grid, per-biome theme (key, mode,
  progression, tempo, seeded motifs), stem gains follow director intensity (calm/build/combat/boss).
  Stingers quantised to the next beat in key.

## 8. Meta
Shards currency; unlock characters/weapons/upgrades; capped boosts; achievements unlock content; heat
1–10 after first win; daily seed, custom seed, run history, codex (enemies, weapons, upgrades, synergies).
All in `localStorage` (try/catch).

## 9. Milestones
M1 loop/input/movement/dash/weapon/enemy/juice/SFX → M2 AI + 6 enemies → M3 rooms/gen/map/biome 1 + boss →
M4 upgrades/synergies/characters/shop → M5 music/sound pass/post-processing → M6 remaining biomes, bosses,
meta, UI polish → M7 balance/perf/bugs. Verified with Playwright (console errors, screenshots, bot, stress).
