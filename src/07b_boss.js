// =====================================================================================
// SECTION 7b — AI: BOSSES (generator-scripted attack patterns, phases, arena mechanics)
// =====================================================================================
const LASERS = [];
function laser(x, y, ang, warn, dur, vr = 0, w = 14, dmg = 18, owner = null, col = '#ff2bd6') {
  const l = { x, y, ang, warn, dur, t: 0, vr, w, dmg, owner, col, len: 0, on: false, ox: owner ? x - owner.x : 0, oy: owner ? y - owner.y : 0 }; LASERS.push(l); A.play('laser', x, y, .35, 1.4); return l;
}
function updateLasers(dt) {
  const p = G.player;
  for (let i = LASERS.length - 1; i >= 0; i--) {
    const l = LASERS[i]; l.t += dt; if (l.t > l.warn + l.dur || (l.owner && l.owner.dead)) { LASERS.splice(i, 1); continue; }
    if (l.owner) { l.x = l.owner.x + l.ox; l.y = l.owner.y + l.oy; }
    if (l.t > l.warn) { if (!l.on) { l.on = true; A.play('laser', l.x, l.y, .6, .9); trauma(.12); } l.ang += l.vr * dt; }
    else l.ang += l.vr * dt * .15;
    l.len = raycast(l.x, l.y, cos(l.ang), sin(l.ang), 1600, 1);
    if (l.on && !p.dead) { const dx = p.x - l.x, dy = p.y - l.y, c = cos(l.ang), s = sin(l.ang), along = dx * c + dy * s, perp = abs(dx * s - dy * c);
      if (along > 0 && along < l.len && perp < l.w * .5 + p.r * .6) hurtPlayer(l.dmg * G.enemyScaleDmg, 'Laser'); }
    if (l.on && rnd() < .5) emit(PK.SPARK, l.x + cos(l.ang) * l.len, l.y + sin(l.ang) * l.len, rr(-150, 150), rr(-150, 150), .2, 3, ci(l.col));
  }
}
// pattern helpers (enemy bullets)
const bS = (e, a, spd, r = 5, shape = 0, src) => eShot(e.x + cos(a) * e.r * .6, e.y + sin(a) * e.r * .6, a, spd, e.bdmg, r, src || e.def.n, shape, e);
function ringShot(e, n, spd, off = 0, r = 5, shape = 0, gapAt = -1, gapN = 0) { for (let i = 0; i < n; i++) { if (gapN && ((i - gapAt + n) % n) < gapN) continue; bS(e, off + i / n * TAU, spd, r, shape); } }
function fanShot(e, n, spread, spd, a, r = 5, shape = 0) { for (let i = 0; i < n; i++) bS(e, a + (n > 1 ? (i / (n - 1) - .5) * spread : 0), spd, r, shape); }
const toP = e => atan2(G.player.y - e.y, G.player.x - e.x);
const arenaC = () => ({ x: G.room.w * TS / 2, y: G.room.h * TS / 2 });
// "yield n" waits n seconds; "yield 0" waits one tick
const BOSSES = {
  prism: {
    phases: [['spokes', 'spiral', 'fans'], ['spokes6', 'ringGap', 'spiral', 'fans'], ['cross', 'dash', 'spiralDense', 'spokes6']],
    move(e, dt) { const c = arenaC(), p = G.player; const tx = lerp(c.x, p.x, .35) + cos(G.time * .4) * 80, ty = lerp(c.y, p.y, .35) + sin(G.time * .6) * 60; seekPoint(e, tx, ty, 40, 80); e.spin = (e.spin || 0) + dt * (.6 + e.phase * .5); },
    onPhase(e, ph) { if (ph === 1) { // electrified floor quadrants
        const room = G.room, c = arenaC(); for (let i = 0; i < room.w * room.h; i++) { if (room.tiles[i] !== 0 || room.hz[i] >= 0) continue; const x = (i % room.w + .5) * TS - c.x, y = (floor(i / room.w) + .5) * TS - c.y, d = hypot(x, y);
          if (d > 220 && d < 470 && ((floor((atan2(y, x) + PI) / (PI / 4))) % 2 === 0)) { room.hz[i] = room.hazards.length; room.hazards.push({ i, k: 'elec', st: 0, t: floor((atan2(y, x) + PI) / (PI / 2)) * 1.1, cd: 0 }); } } room.flow.dirty = true;
        e.orbs = [0, TAU / 3, TAU * 2 / 3]; }
      if (ph === 2) e.orbs = [0, PI / 2, PI, PI * 1.5]; },
    tick(e, dt) { if (e.orbs) { e.orbT = (e.orbT || 0) - dt; if (e.orbT <= 0) { e.orbT = e.phase === 2 ? 1.6 : 2.2; for (const o of e.orbs) { const a = o + e.spin, ox = e.x + cos(a) * 95, oy = e.y + sin(a) * 95; for (let i = 0; i < 8; i++) eShot(ox, oy, i / 8 * TAU + e.spin, 120, e.bdmg, 4.5, 'Prism Shard', 3, e); } A.play('eshotBig', e.x, e.y, .4, 1.3); } } },
    atk: {
      *spokes(e) { const a = rnd() * TAU, d = rnd() < .5 ? 1 : -1; for (let i = 0; i < 4; i++) laser(e.x, e.y, a + i * PI / 2, 1.1, 2.6, .42 * d, 16, 20, e); yield 4; },
      *spokes6(e) { const a = rnd() * TAU, d = rnd() < .5 ? 1 : -1; for (let i = 0; i < 6; i++) laser(e.x, e.y, a + i * PI / 3, 1.0, 3, .5 * d, 14, 20, e); for (let k = 0; k < 4; k++) { yield .9; ringShot(e, 12, 130, rnd() * TAU, 5, 3); } yield .6; },
      *spiral(e) { let a = rnd() * TAU; const d = rnd() < .5 ? 1 : -1; for (let t = 0; t < 2.6; t += .07) { for (let k = 0; k < 3; k++) bS(e, a + k * TAU / 3, 160); a += .21 * d; if (t % .35 < .07) A.play('eshot', e.x, e.y, .3, .9); yield .07; } yield .8; },
      *spiralDense(e) { let a = 0; for (let t = 0; t < 3.2; t += .06) { for (let k = 0; k < 5; k++) bS(e, a + k * TAU / 5, 150 + 30 * sin(t * 3)); a += .17; yield .06; } yield .6; },
      *fans(e) { for (let i = 0; i < 3; i++) { fanShot(e, 7 + e.phase * 2, .9, 210, leadAim(e, e.x, e.y, 210)); A.play('eshotBig', e.x, e.y, .5); yield .45; } yield .7; },
      *ringGap(e) { for (let i = 0; i < 4; i++) { ringShot(e, 28, 150, toP(e), 5, 0, floor(rnd() * 28), 4); A.play('eshotBig', e.x, e.y, .5); yield .7; } yield .5; },
      *cross(e) { const a = rnd() * TAU; for (let i = 0; i < 4; i++) laser(e.x, e.y, a + i * PI / 2, .9, 3.4, .7 * (rnd() < .5 ? 1 : -1), 18, 22, e); let b = 0; for (let t = 0; t < 4; t += .15) { bS(e, b, 120); bS(e, b + PI, 120); b += .3; yield .15; } yield .5; },
      *dash(e) { const c = arenaC(); for (let k = 0; k < 3; k++) { const a = toP(e), len = raycast(e.x, e.y, cos(a), sin(a), 900, 1) - e.r - 10; tele('line', e.x, e.y, len, e.r, .7, '#ff2bd6', a, e); A.play('growl', e.x, e.y, .5, 1.5); e.hold = 1; yield .7;
          for (let t = 0; t < len / 900; t += 1 / 120) { e.x += cos(a) * 900 / 120; e.y += sin(a) * 900 / 120; if (floor(t * 120) % 6 === 0) { bS(e, a + PI / 2, 90, 5, 3); bS(e, a - PI / 2, 90, 5, 3); } yield 0; }
          trauma(.4); A.play('slam', e.x, e.y, .7); ringShot(e, 16, 140, rnd() * TAU); yield .4; } e.hold = 0; yield .5; },
    },
  },
  forge: {
    phases: [['slam', 'spikes', 'molten'], ['slam2', 'icicles', 'blizzard', 'spikes', 'molten'], ['charge', 'rings', 'slam', 'icicles']],
    move(e, dt) { if (!e.hold) flowTo(e, 55 + e.phase * 12); e.spin = (e.spin || 0) + dt * 2; },
    onPhase(e, ph) { const room = G.room, c = arenaC();
      if (ph === 1) { for (let i = 0; i < room.w * room.h; i++) { if (room.tiles[i] !== 0 || room.hz[i] >= 0) continue; const x = (i % room.w + .5) * TS - c.x, y = (floor(i / room.w) + .5) * TS - c.y, d = hypot(x, y);
          if ((d > 140 && d < 230) || (d > 360 && d < 430)) { room.hz[i] = room.hazards.length; room.hazards.push({ i, k: 'ice', st: 0, t: 0, cd: 0 }); } }
        for (let k = 0; k < 7; k++) { const a = rnd() * TAU, d = rr(150, 400), x = c.x + cos(a) * d, y = c.y + sin(a) * d; tele('circle', x, y, 22, 0, 1, '#6fd8ff'); addTimer(1, () => { const tx = floor(x / TS), ty = floor(y / TS), i = ty * room.w + tx;
          if (room.tiles[i] === 0 && dist2(G.player.x, G.player.y, x, y) > 40 * 40) { room.tiles[i] = 2; room.hp[i] = 120; room.coverList.push(i); room.flow.dirty = true; room.clear = clearanceField(room); burst(x, y, 14, C_ICE, 200, .4, 3, PK.SHARD); } }); } }
      if (ph === 2) { e.col = '#ff8a2b'; } },
    tick(e, dt) { if (e.wind) { const p = G.player; if (!p.dead && p.dashT <= 0) { p.x += e.windX * dt; p.y += e.windY * dt; collideTiles(p, p.r, false, true); } } },
    atk: {
      *slam(e) { const p = G.player, a = toP(e), d = min(220, hypot(p.x - e.x, p.y - e.y)), tx = e.x + cos(a) * d, ty = e.y + sin(a) * d; tele('circle', tx, ty, 95, 0, .9, '#6fd8ff'); A.play('growl', e.x, e.y, .6, .8); e.hold = 1;
        const sx = e.x, sy = e.y; for (let t = 0; t < .9; t += 1 / 120) { const f = t / .9; e.x = lerp(sx, tx, f); e.y = lerp(sy, ty, f); e.lift = sin(f * PI) * 40; yield 0; } e.lift = 0;
        A.play('slam', e.x, e.y); trauma(.6); hitstop(.04); ring(e.x, e.y, 95, C_ICE, .4, 8); burst(e.x, e.y, 30, C_ICE, 340, .6, 4, PK.SHARD); decal('scorch', e.x, e.y, 70, null, .5);
        if (dist2(p.x, p.y, e.x, e.y) < (95 + p.r * .5) ** 2) hurtPlayer(e.bdmg * 1.6, 'Forge Hammer', e.x, e.y);
        ringShot(e, 30, 170, toP(e), 5, 0, floor(rnd() * 30), 3); addZone('eice', e.x, e.y, 70, 3, 0, 1); e.hold = 0; yield 1; },
      *slam2(e) { const g1 = BOSSES.forge.atk.slam(e); for (let r = g1.next(); !r.done; r = g1.next()) yield r.value; const g2 = BOSSES.forge.atk.slam(e); for (let r = g2.next(); !r.done; r = g2.next()) yield r.value; },
      *spikes(e) { const base = toP(e); A.play('growl', e.x, e.y, .4, 1.2);
        for (let s = 1; s <= 12; s++) { for (const off of [-.35, 0, .35]) { const a = base + off, x = e.x + cos(a) * s * 42, y = e.y + sin(a) * s * 42; if (tileAt(x, y) !== 0) continue; tele('circle', x, y, 22, 0, .6, '#6fd8ff');
            addTimer(.6, () => { burst(x, y, 6, C_ICE, 200, .3, 3, PK.SHARD); const p = G.player; if (dist2(p.x, p.y, x, y) < (22 + p.r * .6) ** 2) hurtPlayer(e.bdmg, 'Ice Spike', x, y); if (s % 3 === 0) A.play('shatter', x, y, .3); }); } yield .07; } yield 1; },
      *molten(e) { const p = G.player; A.play('mortar', e.x, e.y); for (let i = 0; i < 4; i++) { const x = p.x + p.vx * .8 + rr(-90, 90), y = p.y + p.vy * .8 + rr(-90, 90), t = 1 + i * .15; tele('circle', x, y, 50, 0, t, '#ff8a2b');
          MORTARS.push({ x0: e.x, y0: e.y, x1: x, y1: y, t: 0, d: t, col: '#ff8a2b' }); addTimer(t, () => { explode(x, y, 50, e.bdmg, 1, 'Molten Slag', true); addZone('efire', x, y, 42, 4, 6, 1); }); } yield 1.8; },
      *icicles(e) { for (let i = 0; i < 7; i++) { const b = bS(e, toP(e) + (i - 3) * .35, 130, 6, 2); b.homing = 1.1; b.life = 4; yield .12; } A.play('shatter', e.x, e.y, .5); yield 1.4; },
      *blizzard(e) { const a = rnd() * TAU, c = arenaC(); e.wind = 1; e.windX = cos(a) * 85; e.windY = sin(a) * 85; toast('BLIZZARD', ''); A.play('roar', e.x, e.y, .4, 1.6);
        for (let t = 0; t < 4; t += .1) { const pa = a + PI + rr(-.6, .6), sx = c.x + cos(pa) * 520, sy = c.y + sin(pa) * 520; eShot(sx, sy, a + rr(-.15, .15), 150, e.bdmg * .7, 4, 'Blizzard', 3, e).phase = true;
          if (rnd() < .5) emit(PK.DOT, G.player.x + rr(-300, 300), G.player.y + rr(-200, 200), e.windX * 3, e.windY * 3, .8, 1.5, C_WHITE, 0); yield .1; } e.wind = 0; yield .6; },
      *charge(e) { for (let k = 0; k < 3; k++) { const a = leadAim(e, e.x, e.y, 700, .9), len = raycast(e.x, e.y, cos(a), sin(a), 1000, 1) - e.r; tele('line', e.x, e.y, len, e.r, .7, '#ff8a2b', a, e); A.play('growl', e.x, e.y, .6, 1); e.hold = 1; yield .7;
          for (let t = 0; t < len / 700; t += 1 / 120) { e.x += cos(a) * 700 / 120; e.y += sin(a) * 700 / 120; const p = G.player; if (dist2(p.x, p.y, e.x, e.y) < (e.r + p.r) ** 2) hurtPlayer(e.bdmg * 1.5, 'Forge Charge', e.x, e.y); if (rnd() < .5) emit(PK.SPARK, e.x, e.y, rr(-200, 200), rr(-200, 200), .3, 4, C_FIRE); yield 0; }
          trauma(.5); A.play('slam', e.x, e.y); ringShot(e, 18, 160, rnd() * TAU, 5, 3); yield .35; } e.hold = 0; yield .5; },
      *rings(e) { for (let i = 0; i < 6; i++) { const ice = i % 2 === 0; ringShot(e, 22, ice ? 130 : 190, i * .14, 5, ice ? 3 : 0); A.play(ice ? 'shatter' : 'eshotBig', e.x, e.y, .4); yield .42; } yield .6; },
    },
  },
  bloom: {
    phases: [['petals', 'sweep', 'pods'], ['flood', 'orbs', 'petals', 'sweep'], ['double', 'lash', 'flood', 'pods']],
    move(e, dt) { const c = arenaC(); seekPoint(e, c.x, c.y, 30, 40); e.spin = (e.spin || 0) + dt * (.4 + e.phase * .3); },
    onPhase(e, ph) { if (ph >= 1) e.floodT = 2; },
    tick(e, dt) { // acid flood mechanic: safe circles telegraphed, then the arena floods
      if (e.phase < 1) return;
      const F = e.flood || (e.flood = { st: 0, t: 0, safe: [] });
      F.t -= dt;
      if (F.st === 0 && F.t <= 0 && e.floodQ) { e.floodQ = 0; F.st = 1; F.t = 1.6; const c = arenaC(); F.safe = []; for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + rnd(), d = rr(160, 380); F.safe.push({ x: c.x + cos(a) * d, y: c.y + sin(a) * d, r: 72 }); } A.play('windSnipe', e.x, e.y, .5, .5); }
      else if (F.st === 1 && F.t <= 0) { F.st = 2; F.t = 3.6; A.play('burrow', e.x, e.y, 1, .6); trauma(.2); }
      else if (F.st === 2) { if (F.t <= 0) { F.st = 0; F.t = 0; } else { const p = G.player; F.hT = (F.hT || 0) - dt; if (F.hT <= 0 && !F.safe.some(s => dist2(p.x, p.y, s.x, s.y) < s.r * s.r)) { F.hT = .5; hurtPlayer(e.bdmg * .6, 'Acid Flood'); } } }
    },
    atk: {
      *petals(e) { let a = rnd() * TAU; for (let t = 0; t < 3; t += .12) { for (let k = 0; k < 5; k++) { const b = bS(e, a + k * TAU / 5, 150, 5, 3); b.curve = (floor(t / .12) % 2 ? .5 : -.5); } a += .13; if (t % .6 < .12) A.play('eshot', e.x, e.y, .3, .7); yield .12; } yield .8; },
      *sweep(e) { const a = toP(e); tele('cone', e.x, e.y, 320, .9, 1, '#7dff3a', a, e); A.play('growl', e.x, e.y, .6, .9); yield 1;
        const p = G.player, d = hypot(p.x - e.x, p.y - e.y); if (d < 320 && abs(angDiff(a, toP(e))) < .9) hurtPlayer(e.bdmg * 1.3, 'Vine Sweep', e.x, e.y);
        for (let k = 0; k < 12; k++) bS(e, a - .9 + k / 11 * 1.8, 200, 5); VINES.push({ a, t: .4, owner: e }); trauma(.3); A.play('slash', e.x, e.y, .8, .6); yield .8; },
      *pods(e) { if (G.enemies.length < 18) { for (let i = 0; i < 3; i++) { const a = rnd() * TAU; spawnEnemy(i ? 'mite' : 'gel', e.x + cos(a) * 80, e.y + sin(a) * 80, { size: 1 }).noDrop = true; } A.play('growl', e.x, e.y, .5, 1.6); } yield 1.2; },
      *flood(e) { e.floodQ = 1; e.flood && (e.flood.t = 0); yield 2; ringShot(e, 16, 120, rnd() * TAU, 6, 3); yield 2.5; },
      *orbs(e) { const p = G.player; for (let i = 0; i < 5; i++) { const x = p.x + rr(-160, 160), y = p.y + rr(-160, 160), t = 1.2; tele('circle', x, y, 30, 0, t, '#7dff3a'); MORTARS.push({ x0: e.x, y0: e.y, x1: x, y1: y, t: 0, d: t, col: '#7dff3a' });
          addTimer(t, () => { for (let k = 0; k < 10; k++) eShot(x, y, k / 10 * TAU, 120, e.bdmg * .8, 5, 'Poison Orb', 3, e); burst(x, y, 10, C_POISON, 160, .4, 3); }); yield .2; } yield 1.4; },
      *double(e) { let a = 0; for (let t = 0; t < 4; t += .1) { for (let k = 0; k < 3; k++) { const b1 = bS(e, a + k * TAU / 3, 140, 5, 0); b1.curve = .35; const b2 = bS(e, -a + k * TAU / 3 + .5, 140, 5, 3); b2.curve = -.35; } a += .16; yield .1; } yield .6; },
      *lash(e) { for (let k = 0; k < 3; k++) { const g = BOSSES.bloom.atk.sweep(e); for (let r = g.next(); !r.done; r = g.next()) yield r.value * .6; } },
    },
  },
  arch: {
    phases: [['square', 'grid', 'tri'], ['echoPrism', 'echoForge', 'echoBloom', 'summon', 'grid'], ['spiral4', 'homing', 'sweep', 'grid', 'tri']],
    move(e, dt) { const c = arenaC(); e.spin = (e.spin || 0) + dt * (1 + e.phase * .4); seekPoint(e, c.x + sin(G.time * .5) * 150, c.y + sin(G.time * .8) * 90, 70, 60); },
    onPhase(e, ph) { if (ph === 2) { e.shrink = 1; e.shrinkR = 560; toast('COLLAPSE', 'The arena is closing in'); } },
    tick(e, dt) { if (e.shrink) { const c = arenaC(), p = G.player; e.shrinkR = max(300, e.shrinkR - dt * 12); if (dist2(p.x, p.y, c.x, c.y) > e.shrinkR * e.shrinkR) { e.shT = (e.shT || 0) - dt; if (e.shT <= 0) { e.shT = .5; hurtPlayer(12, 'Collapse Field'); } } } },
    atk: {
      *square(e) { for (let w = 0; w < 3; w++) { const rot = rnd() * TAU; for (let s = 0; s < 4; s++) for (let i = 0; i < 9; i++) { const lx = (i / 8 - .5) * 2, ly = 1, a0 = rot + s * PI / 2, x = lx * cos(a0) - ly * sin(a0), y = lx * sin(a0) + ly * cos(a0);
            bS(e, atan2(y, x), 120 * hypot(x, y), 5, w % 2 ? 3 : 0); } A.play('eshotBig', e.x, e.y, .5); yield .8; } yield .5; },
      *grid(e) { const c = arenaC(), R2 = 560, off = rr(-40, 40); for (let i = -1; i <= 1; i++) { laser(c.x - R2, c.y + i * 160 + off, 0, 1.2, .5, 0, 20, 24); laser(c.x + i * 160 + off, c.y - R2, PI / 2, 1.2, .5, 0, 20, 24); } yield 2.1; },
      *tri(e) { for (let k = 0; k < 4; k++) { const a = leadAim(e, e.x, e.y, 200); for (let s = 0; s < 3; s++) for (let i = 0; i < 6; i++) { const t = i / 6, a1 = a + s * TAU / 3, a2 = a + (s + 1) * TAU / 3, x = lerp(cos(a1), cos(a2), t), y = lerp(sin(a1), sin(a2), t); bS(e, atan2(y, x), 200 * hypot(x, y), 5, 3); } A.play('eshotBig', e.x, e.y, .5); yield .55; } yield .5; },
      *echoPrism(e) { yield* BOSSES.prism.atk.spokes(e); },
      *echoForge(e) { e.hold = 1; ringShot(e, 30, 170, toP(e), 5, 0, floor(rnd() * 30), 3); trauma(.4); A.play('slam', e.x, e.y); yield .6; ringShot(e, 30, 150, toP(e) + .1, 5, 3, floor(rnd() * 30), 3); e.hold = 0; yield 1; },
      *echoBloom(e) { yield* BOSSES.bloom.atk.petals(e); },
      *summon(e) { if (G.enemies.filter(o => !o.dead && !o.boss).length < 4) { const c = arenaC(); for (let i = 0; i < 2; i++) { const t = G.run.rng.pick(['gunner', 'ram', 'bulwark', 'lancer', 'phantom', 'jugg']), a = rnd() * TAU; spawnEnemy(t, c.x + cos(a) * 300, c.y + sin(a) * 300, { elite: [G.run.rng.pick(T.elite.mods)] }).noDrop = true; } } yield 1.5; },
      *spiral4(e) { let a = rnd() * TAU; for (let t = 0; t < 4; t += .07) { for (let k = 0; k < 4; k++) bS(e, a + k * PI / 2, 165, 5, k % 2 ? 3 : 0); a += .19 + t * .02; yield .07; } yield .5; },
      *homing(e) { for (let i = 0; i < 6; i++) { const b = bS(e, e.spin + i * TAU / 6, 110, 7, 1); b.homing = 1.3; b.life = 4.5; } A.play('eshotBig', e.x, e.y, .6, .7); yield 1.6; },
      *sweep(e) { const a = toP(e) - PI / 2, d = rnd() < .5 ? 1 : -1; laser(e.x, e.y, a, .9, 2.8, .9 * d, 18, 22, e); laser(e.x, e.y, a + PI, .9, 2.8, .9 * d, 18, 22, e); yield 2; ringShot(e, 20, 140, rnd() * TAU); yield 1.8; },
    },
  },
};
const VINES = [];
// generic boss brain wired into the enemy system
for (const id in BOSSES) BRAINS['boss_' + id] = { acts: { fight: { score: () => 1, run: (e, dt) => BOSS.run(e, dt) } }, fire() { } };
const BOSS = {
  spawn(id) {
    const c = arenaC(), d = T.boss[id], e = spawnEnemy('jugg', c.x, c.y - 120, { noTele: true, noCodex: true });
    e.boss = true; e.bossId = id; e.def = Object.assign({}, T.E.jugg, { n: d.n, b: 'boss_' + id, cost: 0 }); e.brain = BRAINS['boss_' + id]; e.r = d.r; e.col = d.col; e.mass = 50; e.armor = 0;
    e.maxHp = e.hp = d.hp * (G.run.heat > 6 ? 1.25 : 1) * (1 + B.enemyHp); e.phase = 0; e.introT = 2.6; e.gen = null; e.waitT = 1; e.bdmg = 11 * [1, 1.15, 1.3, 1.45][G.run.biome]; G.enemyScaleDmg = [.8, .9, 1, 1.1][G.run.biome];
    G.boss = e; G.cam.focus = e; G.cam.focusT = 2.4; A.play('roar', e.x, e.y); A.duck(.6, 1.5); MUS.setTheme(G.run.biome, true); MUS.stinger('boss'); MUS.setIntensity(4);
    UI.bossIntro(d.n, d.t); codexSee('boss', id); LASERS.length = 0; VINES.length = 0; return e;
  },
  run(e, dt) {
    const def = BOSSES[e.bossId]; e.dvx = e.dvy = 0;
    if (e.introT > 0) { e.introT -= dt; e.inv = .1; return; }
    if (e.transT > 0) { e.transT -= dt; e.inv = .1; return; }
    if (!e.hold) def.move(e, dt); if (def.tick) def.tick(e, dt);
    if (e.waitT > 0) { e.waitT -= dt; return; }
    if (!e.gen) { const list = def.phases[e.phase]; let k; do { k = list[floor(rnd() * list.length)]; } while (k === e.lastAtk && list.length > 1); e.lastAtk = k; e.gen = def.atk[k](e); }
    const r = e.gen.next(); if (r.done) { e.gen = null; e.waitT = .25; } else e.waitT = r.value || 0;
  },
  onHurt(e, dmg) {
    const f = e.hp / e.maxHp, ph = f < .33 ? 2 : f < .66 ? 1 : 0;
    if (ph > e.phase && e.hp > 0) {
      e.phase = ph; e.gen = null; e.hold = 0; e.lift = 0; e.wind = 0; e.transT = 1.6; e.waitT = .6; LASERS.length = 0;
      A.play('roar', e.x, e.y); A.duck(.5, 1); trauma(.7); screenFlash(.35); aberrate(.012); slowmo(.4, .6);
      // clear bullets with a visible shockwave — fair reset between phases
      for (let i = G.ebullets.length - 1; i >= 0; i--) { const b = G.ebullets[i]; burst(b.x, b.y, 1, ci(bpal()[2]), 60, .3, 2, PK.DOT); freeBullet(G.ebullets, i); }
      ring(e.x, e.y, 400, ci(e.col), .8, 10); burst(e.x, e.y, 50, ci(e.col), 500, .8, 4, PK.SHARD);
      wtext(e.x, e.y - e.r - 20, `PHASE ${ph + 1}`, e.col, 16, 1.5, -20);
      BOSSES[e.bossId].onPhase(e, ph);
    }
  },
  onDeath(e) {
    const run = G.run, x = e.x, y = e.y, col = e.col; G.boss = null; LASERS.length = 0; e.wind = 0;
    for (let i = G.ebullets.length - 1; i >= 0; i--) freeBullet(G.ebullets, i);
    for (const o of G.enemies) if (!o.dead && o !== e) { o.noDrop = true; killEnemy(o, DMG.ENV); }
    G.corpse = { x, y, r: e.r, col, t: 0, id: e.bossId, spin: e.spin || 0 };
    slowmo(.25, 2.2); A.play('roar', x, y, 1, .7); A.duck(.7, 2.5); MUS.setIntensity(0); trauma(1); G.cam.focus = G.corpse; G.cam.focusT = 2.6;
    for (let i = 0; i < 9; i++) addTimer(i * .22, () => { const a = rnd() * TAU, d = rnd() * e.r; explode(x + cos(a) * d, y + sin(a) * d, 40 + i * 4, 0, 0, '', true); });
    addTimer(2.1, () => { G.corpse = null; explode(x, y, 160, 0, 0, '', false); screenFlash(.8); aberrate(.03); burst(x, y, 120, ci(col), 700, 1.6, 6, PK.SHARD, 1.5); burst(x, y, 80, C_WHITE, 800, 1, 4);
      ring(x, y, 300, ci(col), 1, 12); ring(x, y, 180, C_WHITE, .7, 6); dropGold(x, y, T.gold.boss * (1 + B.gold)); dropPickup('heal', x, y, 30); MUS.stinger('clear'); unlockAch(e.bossId === 'arch' ? 'win' : e.bossId); run.stats.bosses++; });
  },
};
G.enemyScaleDmg = 1;
function updateMortars(dt) { for (let i = MORTARS.length - 1; i >= 0; i--) { const m = MORTARS[i]; m.t += dt; if (m.t >= m.d) MORTARS.splice(i, 1); } for (let i = VINES.length - 1; i >= 0; i--) if ((VINES[i].t -= dt) <= 0) VINES.splice(i, 1); }
