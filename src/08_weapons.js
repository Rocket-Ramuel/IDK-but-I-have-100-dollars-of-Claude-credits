// =====================================================================================
// SECTION 8 — WEAPONS / UPGRADES: firing, abilities, actives, summons, upgrade engine
// =====================================================================================
const SHAPE = { bolt: 0, pellet: 1, rocket: 2, disc: 3, flame: 4, arrow: 5, mine: 6, orb: 7, blade: 8 };
const ELEM_IDX = () => B.burnChance >= .5 ? 2 : B.chill >= 25 ? 3 : B.shockChance >= .3 ? 4 : B.poison >= 2 ? 5 : 0;
function makeWeapon(id) { const def = T.W[id]; return { id, def, ammo: def.mag, mag: def.mag, reloadT: 0, cd: 0, spin: 0, heat: 0, charge: 0, full: false, beam: null, tick: 0, ramp: 0 }; }
const curWeapon = p => G.run.weapons[G.run.wi];
function refreshWeapons() { for (const w of G.run.weapons) { const m = w.def.k === 'orbit' ? w.def.mag : max(1, round(w.def.mag * (1 + B.mag))); if (m !== w.mag) { w.ammo = min(m, w.ammo + max(0, m - w.mag)); w.mag = m; } } }
function swapWeapon(p) { const run = G.run; A.loop('beam', false); A.loop('flame', false); A.loop('spin', false); A.loop('draw', false); run.wi = (run.wi + 1) % run.weapons.length; const w = curWeapon(p); w.cd = max(w.cd, T.player.swapTime); A.play('reload', p.x, p.y, .6, 1.3); wtext(p.x, p.y - 22, w.def.n, '#7ff6ff', 9, .8, -30); }
function dmgMul(p) {
  let m = (1 + B.dmg) * (1 + B.momentum * p.moveT); if (B.berserk) m *= 1 + (1 - p.hp / p.maxHp); if (p.buffs.dmg > 0) m *= 1.3; return m;
}
function rateMul(p) { return max(.2, 1 + B.rate + p.cascade * .12 + (p.buffs.adren > 0 ? .3 : 0) + (p.buffs.overdrive > 0 ? .6 : 0)); }
function rollCrit(p) {
  if (p.autoCrit > 0) { p.autoCrit--; return true; } if (p.reloadCrits > 0) { p.reloadCrits--; return true; }
  return rnd() < T.ST.critBase + B.crit + (G.run.char === 'wraith' ? .15 : 0);
}
function startReload(w, p) { if (w.reloadT > 0 || w.ammo >= w.mag || w.def.k === 'orbit' || w.def.k === 'bow') return; w.reloadT = w.def.rel; A.play('reload', p.x, p.y, .7); if (B.reloadHurt) { p.hp = max(1, p.hp - B.reloadHurt); wtext(p.x, p.y - 16, '-' + B.reloadHurt, '#ff5470', 8); } }
const _tmpB = new Bullet();
function updateWeapons(p, dt) {
  const w = curWeapon(p), d = w.def, run = G.run, held = (IN.down.fire || (G.bot && BOT.fire)) && !p.dead && G.cam.focusT <= 0;
  w.cd -= dt;
  if (w.reloadT > 0) { w.reloadT -= dt * (1 + B.reload); if (w.reloadT <= 0) { w.reloadT = 0; w.ammo = w.mag; A.play('reloaded', p.x, p.y, .7); if (B.reloadCrit) p.reloadCrits = B.reloadCrit; } }
  if (IN.take('reload')) startReload(w, p);
  const od = p.buffs.overdrive > 0;
  // loops reset
  if (d.k !== 'beam') A.loop('beam', false);
  if (d.id !== 'flamer') A.loop('flame', false);
  if (d.k === 'beam') {
    w.beam = null;
    if (held && w.reloadT <= 0 && !w.over) {
      w.heat += dt * (od ? .4 : 1); w.ramp = min(1, w.ramp + dt / d.ramp); fireBeam(p, w, dt);
      if (w.heat >= d.heat) { w.over = true; w.reloadT = d.rel; w.heat = 0; A.play('empty', p.x, p.y); A.loop('beam', false); wtext(p.x, p.y - 20, 'OVERHEAT', '#ff8a2b', 9); }
    } else { w.ramp = max(0, w.ramp - dt * 2); w.heat = max(0, w.heat - dt * .9); A.loop('beam', false); if (w.reloadT <= 0) w.over = false; }
    w.ammo = round((1 - w.heat / d.heat) * w.mag);
    return;
  }
  if (d.k === 'bow') {
    if (held && w.cd <= 0) { w.charge = min(1, w.charge + dt / (d.charge / rateMul(p))); A.loop('draw', true, w.charge); if (w.charge >= 1 && !w.full) { w.full = true; A.play('bowfull', p.x, p.y); ring(p.x, p.y, 20, C_GOLD, .25); } }
    else if (w.charge > 0) { fireBow(p, w); w.charge = 0; w.full = false; w.cd = 1 / d.rate; A.loop('draw', false); }
    return;
  }
  if (d.k === 'orbit') orbitBlades(p, w);
  if (d.id === 'minigun') { w.spin = clamp(w.spin + (held ? dt / d.spin : -dt / d.spin * 1.5), 0, 1); A.loop('spin', w.spin > .02, w.spin); }
  const rate = (d.id === 'minigun' ? lerp(d.rateMin, d.rate, w.spin) : d.rate) * rateMul(p);
  if (held && w.cd <= 0 && w.reloadT <= 0) {
    if (w.ammo <= 0) { if (d.k === 'orbit') { w.cd = .2; } else { startReload(w, p); if (w.reloadT <= 0) A.play('empty', p.x, p.y); w.cd = .25; } if (w.reloadT <= 0 && (p.emptyT || 0) < G.time) { p.emptyT = G.time + 1; wtext(p.x, p.y - 20, 'EMPTY', '#ff8a2b', 9, .6); } }
    else {
      if (d.k === 'rail') fireRail(p, w); else if (d.k === 'arc') fireArc(p, w); else if (d.k === 'orbit') fireBlade(p, w); else fireGun(p, w);
      if (!od || d.k === 'orbit') w.ammo--;
      w.cd = max(w.cd + 1 / rate, -dt);
      if (w.ammo <= 0 && d.k !== 'orbit') startReload(w, p);
      afterShot(p, w);
    }
  }
  if (w.cd < 0 && !held) w.cd = 0;
  A.loop('flame', d.id === 'flamer' && held && w.reloadT <= 0 && w.ammo > 0);
}
function muzzle(p, d, k = 1) {
  const a = p.ang, mx = p.x + cos(a) * 16, my = p.y + sin(a) * 16;
  p.recX -= cos(a) * d.rec * k; p.recY -= sin(a) * d.rec * k; p.muzzle = .05; p.squash = max(p.squash, .1 * k);
  trauma(d.shk * k * .6); G.cam.x -= cos(a) * d.rec * .3; G.cam.y -= sin(a) * d.rec * .3;
  flashLight(mx, my, 90 + d.rec * 8, '#ffe8a0', .06, .9);
  if (d.snd) A.play(d.snd, p.x, p.y, d.k === 'gun' && d.rate > 12 ? .55 : .8);
  if (d.k === 'gun' && d.id !== 'flamer' && d.id !== 'disc' && d.id !== 'mines') { // shell casing + flash sparks
    const ca = a + PI / 2 * (rnd() < .5 ? 1 : -1) * .9 + PI; emit(PK.SHARD, p.x, p.y, cos(ca) * rr(60, 120) - cos(a) * 30, sin(ca) * rr(60, 120) - sin(a) * 30, .5, 2.2, C_GOLD, 6);
    spray(mx, my, a, .6, 3, C_FIRE2, 300, .08, 2.5);
  }
  return [mx, my];
}
function bulletFrom(p, w, ang, spdK = 1) {
  const d = w.def, b = newBullet(0), s = d.spd * (1 + B.pspd) * spdK * (1 + (rnd() - .5) * (d.spdVar || 0)), mx = p.x + cos(p.ang) * 14, my = p.y + sin(p.ang) * 14;
  b.x = b.px = mx; b.y = b.py = my; b.vx = cos(ang) * s; b.vy = sin(ang) * s; b.life = d.life * (1 + B.range); b.r = d.sz * (1 + B.size);
  b.crit = rollCrit(p); b.dmg = d.dmg * dmgMul(p); b.pierce = (d.pierce || 0) + B.pierce; b.homing = B.homing + (b.crit && B.syn.bloodhound ? 6 : 0); if (b.crit && B.syn.bloodhound) b.pierce++;
  if (d.exp) { b.explode = d.exp * expRad(); b.expDmg = d.expD * dmgMul(p) * expMul(); } else if (B.explode) { b.explode = T.ST.explodeR * expRad(); b.expDmg = b.dmg * T.ST.explodeDmg * expMul(); }
  b.burn = d.burn || 0; b.kb = d.kb; b.src = d.n; b.shape = SHAPE[d.sh] || 0; b.col = b.crit ? 1 : ELEM_IDX(); b.drag = d.drag || 0; b.acc = d.acc || 0; b.maxSpd = d.maxSpd || 0; b.ret = d.ret || 0; b.mine = d.mine ? 1 : 0;
  b.split = B.split; b.splitDepth = B.splitDepth; return b;
}
function fireGun(p, w) {
  const d = w.def, n = d.cnt + B.extraProj, spr = d.spr * max(.15, 1 - B.spread);
  for (let i = 0; i < n; i++) {
    let a = p.ang + (rnd() - .5) * spr;
    if (d.cnt === 1 && n > 1) a = p.ang + (i - (n - 1) / 2) * .12 + (rnd() - .5) * spr;
    const b = bulletFrom(p, w, a);
    if (d.mine) { b.vx *= .9; b.vy *= .9; }
  }
  muzzle(p, d);
}
function afterShot(p, w) {
  p.shots++; const run = G.run;
  if (B.missile) { const every = max(3, 9 - B.missile * 2); if (p.shots % every === 0) fireMissiles(p, 1 + B.missileCount); }
  if (B.ballLight && p.shots % 8 === 0) { const b = newBullet(0); b.x = b.px = p.x; b.y = b.py = p.y; b.vx = cos(p.ang) * 150; b.vy = sin(p.ang) * 150; b.life = 2.6; b.r = 7; b.dmg = 15 * dmgMul(p); b.pierce = 99; b.lightning = 1; b.shape = SHAPE.orb; b.col = 4; b.src = 'Ball Lightning'; A.play('zap', p.x, p.y, .5, .7); }
}
function fireMissiles(p, n) {
  for (let i = 0; i < n; i++) { const b = newBullet(0), a = p.ang + (i - (n - 1) / 2) * .5 + PI * (n > 1 ? 0 : 0) + rr(-.2, .2), s = 260; b.x = b.px = p.x; b.y = b.py = p.y; b.vx = cos(a) * s; b.vy = sin(a) * s; b.life = 2; b.r = 4;
    b.dmg = 12 * dmgMul(p); b.homing = 7; b.acc = 900; b.maxSpd = 700; b.explode = 50 * expRad() * (B.syn.smartbombs ? 1.2 : 1); b.expDmg = T.ST.missileDmg * dmgMul(p) * expMul() * (B.syn.smartbombs ? 2 : 1); b.shape = SHAPE.rocket; b.src = 'Missile'; b.missile = true; b.seek = true; }
  A.play('rocket', p.x, p.y, .4, 1.3);
}
function fireRail(p, w) {
  const d = w.def, a = p.ang + (rnd() - .5) * .01, cx = cos(a), cy = sin(a), sx = p.x + cx * 12, sy = p.y + cy * 12, wall = raycast(sx, sy, cx, cy, d.range, B.phase ? 1 : 0);
  const hits = []; for (const e of G.enemies) { if (e.dead || e.spawnT > 0 || e.burrowed) continue; const rx = e.x - sx, ry = e.y - sy, al = rx * cx + ry * cy; if (al < 0 || al > wall + e.r) continue; if (abs(rx * cy - ry * cx) < e.r + 5 * (1 + B.size)) hits.push([al, e]); }
  hits.sort((x, y) => x[0] - y[0]);
  const crit = rollCrit(p); let dmg = d.dmg * dmgMul(p) * (crit ? T.ST.critMul + B.critDmg : 1);
  _tmpB.reset(); _tmpB.crit = crit; _tmpB.x = sx; _tmpB.y = sy; _tmpB.src = 'Railgun';
  for (const [al, e] of hits) { const ex = sx + cx * al, ey = sy + cy * al; _tmpB.x = ex; _tmpB.y = ey; hurtEnemy(e, dmg, DMG.BULLET, crit, cx * d.kb, cy * d.kb); applyOnHit(e, _tmpB); spray(ex, ey, a, .8, 8, ci(e.col), 400, .3, 3); _tmpB.pierced++; dmg *= 1 + B.pierceDmg;
    if (B.syn.detonator && crit) explode(ex, ey, 45, dmg * .5, 0, 'Detonator', true); if (B.explode) explode(ex, ey, T.ST.explodeR * expRad(), dmg * T.ST.explodeDmg * expMul(), 0, 'Rail', true); }
  const ex = sx + cx * wall, ey = sy + cy * wall; if (_rayTile >= 0 && G.room.tiles[_rayTile] === 2) damageCover(_rayTile, dmg);
  beamFx(sx, sy, ex, ey, crit ? bpal()[1] : bpal()[0], 9, .28); beamFx(sx, sy, ex, ey, '#ffffff', 3, .18);
  burst(ex, ey, 14, C_WHITE, 380, .3, 3); flashLight(ex, ey, 140, bpal()[0], .15); if (crit) A.play('crit', p.x, p.y);
  if (hits.length) hitstop(.03 + min(.03, hits.length * .01));
  if (B.splitWall) for (let i = 0; i < B.splitWall; i++) fragBullet(ex - cx * 4, ey - cy * 4, a + PI + (i - (B.splitWall - 1) / 2) * .5, d.dmg * .35 * dmgMul(p), 'Railgun');
  muzzle(p, d); aberrate(.004);
}
function fireArc(p, w) {
  const d = w.def, crit = rollCrit(p), dmg = d.dmg * dmgMul(p) * (crit ? T.ST.critMul + B.critDmg : 1);
  let best = null, bs = 1e9; for (const e of G.enemies) { if (e.dead || e.spawnT > 0 || e.burrowed) continue; const dx = e.x - p.x, dy = e.y - p.y, dd = hypot(dx, dy); if (dd > d.range * (1 + B.range * .5)) continue;
    const da = abs(angDiff(p.ang, atan2(dy, dx))); if (da > d.cone) continue; const s = dd + da * 200; if (s < bs && los(p.x, p.y, e.x, e.y)) { bs = s; best = e; } }
  const mx = p.x + cos(p.ang) * 14, my = p.y + sin(p.ang) * 14;
  if (best) { _tmpB.reset(); _tmpB.crit = crit; _tmpB.x = best.x; _tmpB.y = best.y; _tmpB.src = d.n;
    const id = ++_chainId; let cur = best, x = mx, y = my, dm = dmg, jumps = d.chain + B.shockAdd + (B.pierce > 0 ? 1 : 0);
    while (cur) { cur.chainId = id; beamFx(x, y, cur.x, cur.y, crit ? '#fff27a' : '#c9a8ff', 2.6, .14, 16); hurtEnemy(cur, dm, DMG.SHOCK | DMG.BULLET, crit, (cur.x - x) * .5, (cur.y - y) * .5); applyOnHit(cur, _tmpB);
      if (B.syn.superconductor) addChill(cur, 25); if (B.syn.overload) explode(cur.x, cur.y, 34, 20 * expMul(), 0, 'Overload', true);
      if (!(B.syn.superconductor && cur.frozenT > 0)) jumps--; if (jumps < 0) break; x = cur.x; y = cur.y; dm *= d.fall; let nb = null, nd = T.ST.shockRange ** 2;
      for (const o of G.enemies) { if (o.dead || o.chainId === id || o.spawnT > 0 || o.burrowed) continue; const q = dist2(x, y, o.x, o.y); if (q < nd) { nd = q; nb = o; } } cur = nb; }
    if (crit) A.play('crit', best.x, best.y, .6);
  } else { const r = d.range * .45, a = p.ang + rr(-.3, .3); beamFx(mx, my, mx + cos(a) * r, my + sin(a) * r, '#c9a8ff', 1.6, .1, 14); }
  muzzle(p, d);
}
function fireBeam(p, w, dt) {
  const d = w.def, a = p.ang, cx = cos(a), cy = sin(a), sx = p.x + cx * 14, sy = p.y + cy * 14, range = d.range * (1 + B.range * .5);
  const wall = raycast(sx, sy, cx, cy, range, B.phase ? 1 : 0); let end = wall;
  const hits = []; for (const e of G.enemies) { if (e.dead || e.spawnT > 0 || e.burrowed) continue; const rx = e.x - sx, ry = e.y - sy, al = rx * cx + ry * cy; if (al < 0 || al > wall) continue; if (abs(rx * cy - ry * cx) < e.r + 4) hits.push([al, e]); }
  hits.sort((x, y) => x[0] - y[0]); const maxHits = 1 + B.pierce; if (hits.length >= maxHits) end = hits[maxHits - 1][0];
  w.beam = { x2: sx + cx * end, y2: sy + cy * end, w: 3 + w.ramp * 4 };
  A.loop('beam', true, w.ramp); p.recX -= cx * .3; p.recY -= cy * .3; trauma(.01 + w.ramp * .01);
  flashLight(w.beam.x2, w.beam.y2, 60 + w.ramp * 40, bpal()[0], .05, .8);
  w.tick -= dt; if (w.tick > 0) return; w.tick += 1 / (d.rate * rateMul(p));
  const crit = rollCrit(p), dmg = d.dmg * dmgMul(p) * (1 + w.ramp * d.rampMul) * (crit ? T.ST.critMul + B.critDmg : 1);
  _tmpB.reset(); _tmpB.crit = crit; _tmpB.src = d.n;
  for (let i = 0; i < min(maxHits, hits.length); i++) { const e = hits[i][1]; hurtEnemy(e, dmg, DMG.BULLET, crit, cx * d.kb, cy * d.kb); _tmpB.x = e.x; _tmpB.y = e.y; if (rnd() < .3) applyOnHit(e, _tmpB); spray(e.x, e.y, a + PI, 1.2, 2, ci(e.col), 200, .2, 2); }
  if (end === wall && _rayTile >= 0 && G.room.tiles[_rayTile] === 2) damageCover(_rayTile, dmg * .5);
  spray(w.beam.x2, w.beam.y2, a + PI, 1.6, 2, ci(bpal()[0]), 220, .2, 2);
}
function fireBow(p, w) {
  const d = w.def, pw = max(.15, w.charge), full = w.charge >= .98, b = bulletFrom(p, w, p.ang + (rnd() - .5) * .02 * (1 - pw), lerp(d.spd, d.spdMax, pw) / d.spd);
  b.dmg = lerp(d.dmg, d.dmgMax, pw * pw) * dmgMul(p); b.kb = d.kb * pw; if (full) { b.crit = true; b.col = 1; b.pierce += 3; b.r *= 1.3; } b.life *= .6 + pw * .6;
  muzzle(p, d, .4 + pw * .8); A.play('bow', p.x, p.y, .8, .8 + pw * .4); p.shots++; afterShot(p, w);
}
// orbiting blades shred anything they touch (per-enemy cooldown)
function orbitBlades(p, w) {
  const d = w.def; for (let i = 0; i < w.ammo; i++) { const a = G.time * d.orbitSpd + i / max(1, w.mag) * TAU, bx = p.x + cos(a) * d.orbitR, by = p.y + sin(a) * d.orbitR;
    forEnemiesNear(bx, by, 10, e => { if ((e.orbT || 0) > G.time) return; e.orbT = G.time + .22; const c = rollCrit(p); hurtEnemy(e, d.orbitDmg * dmgMul(p) * (c ? T.ST.critMul + B.critDmg : 1), DMG.MELEE, c, cos(a + PI / 2) * 160, sin(a + PI / 2) * 160);
      _tmpB.reset(); _tmpB.crit = c; _tmpB.x = bx; _tmpB.y = by; applyOnHit(e, _tmpB); spray(bx, by, a + PI / 2, 1, 5, ci(e.col), 220, .2, 2.5); A.play('blade', bx, by, .35, 1.4); }); }
}
function fireBlade(p, w) {
  const d = w.def, b = bulletFrom(p, w, p.ang); b.w = w; b.pierce = 99; b.ret = d.ret; b.dmg = d.dmg * dmgMul(p); muzzle(p, d);
}
// ---- abilities (RMB) -------------------------------------------------------------------------------------------------------
function aimPoint(p, range) { const dx = (G.bot ? BOT.ax : IN.wx) - p.x, dy = (G.bot ? BOT.ay : IN.wy) - p.y, d = hypot(dx, dy), k = min(1, range / max(1, d)), ad = d * k;
  const a = atan2(dy, dx), wd = raycast(p.x, p.y, cos(a), sin(a), ad, 0); const r = min(ad, wd - 8); return { x: p.x + cos(a) * r, y: p.y + sin(a) * r, a, d: r }; }
function useAbility(p) {
  const ch = G.run.char, AB = T.ab; A.play('ability', p.x, p.y);
  if (ch === 'kestrel') { const t = aimPoint(p, AB.frag.range), b = newBullet(0), k = 5; b.x = b.px = p.x; b.y = b.py = p.y; b.vx = cos(t.a) * t.d * k; b.vy = sin(t.a) * t.d * k; b.drag = k; b.life = AB.frag.fuse; b.mine = 3; b.r = 5; b.shape = SHAPE.mine;
    b.explode = AB.frag.r * expRad(); b.expDmg = AB.frag.dmg * dmgMul(p) * expMul(); b.src = 'Frag'; A.play('grenade', p.x, p.y); tele('circle', t.x, t.y, AB.frag.r, 0, AB.frag.fuse, '#7ff6ff'); }
  else if (ch === 'ember') { for (let i = 0; i < 28; i++) { const a = i / 28 * TAU, b = newBullet(0); b.x = b.px = p.x; b.y = b.py = p.y; b.vx = cos(a) * 420; b.vy = sin(a) * 420; b.life = .38; b.r = 9; b.drag = 2; b.dmg = AB.inferno.dmg * dmgMul(p); b.burn = 1; b.pierce = 99; b.shape = SHAPE.flame; b.col = 2; b.src = 'Inferno'; }
    forEnemiesNear(p.x, p.y, AB.inferno.r, e => { const a = atan2(e.y - p.y, e.x - p.x); e.kbx += cos(a) * AB.inferno.kb / e.mass; e.kby += sin(a) * AB.inferno.kb / e.mass; ignite(e, burnDps() * 1.5); }); addZone('fire', p.x, p.y, 60, 2, 20);
    trauma(.4); ring(p.x, p.y, AB.inferno.r, C_FIRE, .4, 6); A.play('explode', p.x, p.y, .6, 1.4); flashLight(p.x, p.y, 300, '#ff8a2b', .3); }
  else if (ch === 'volt') { const t = aimPoint(p, 260); addZone('tesla', t.x, t.y, AB.tesla.r, AB.tesla.dur, 0); ring(t.x, t.y, AB.tesla.r, C_SHOCK, .5, 4); A.play('arc', t.x, t.y); }
  else if (ch === 'bastion') { addAlly('sentry', p.x, p.y, AB.sentry.dur); ring(p.x, p.y, 30, C_HEAL, .4); }
  else if (ch === 'wraith') { const t = aimPoint(p, AB.blink.range), sx = p.x, sy = p.y; A.play('blink', p.x, p.y);
    const cx = cos(t.a), cy = sin(t.a); for (const e of G.enemies) { if (e.dead || e.spawnT > 0) continue; const rx = e.x - sx, ry = e.y - sy, al = rx * cx + ry * cy; if (al < 0 || al > t.d + e.r) continue; if (abs(rx * cy - ry * cx) < e.r + 14) { const c = rollCrit(p); hurtEnemy(e, AB.blink.dmg * dmgMul(p) * (c ? 2 : 1), DMG.MELEE, c, cx * 200, cy * 200); burst(e.x, e.y, 10, ci('#ff4dd2'), 300, .3, 3); } }
    for (let i = 0; i < 8; i++) p.ghosts.push({ x: lerp(sx, t.x, i / 8), y: lerp(sy, t.y, i / 8), a: p.ang, t: .3 }); p.x = p.px = t.x; p.y = p.py = t.y; p.iframe = .25; beamFx(sx, sy, p.x, p.y, '#ff4dd2', 6, .25); trauma(.2); }
}
// ---- actives (Q/E) -----------------------------------------------------------------------------------------------------
function useActive(p, a) {
  const def = T.ACT[a.id]; a.cd = def.cd; A.play('ability', p.x, p.y, 1, 1.3);
  switch (a.id) {
    case 'wipe': { let n = 0; for (let i = G.ebullets.length - 1; i >= 0; i--) { const b = G.ebullets[i]; if (dist2(b.x, b.y, p.x, p.y) < 280 * 280) { emit(PK.DOT, b.x, b.y, 0, 0, .3, 3, ci(bpal()[2]), 0); freeBullet(G.ebullets, i); n++; } }
      forEnemiesNear(p.x, p.y, 200, e => { const an = atan2(e.y - p.y, e.x - p.x); e.kbx += cos(an) * 400 / e.mass; e.kby += sin(an) * 400 / e.mass; }); ring(p.x, p.y, 280, ci('#7ff6ff'), .5, 6); screenFlash(.15); trauma(.3); break; }
    case 'warp': p.buffs.warp = def.dur; ring(p.x, p.y, 400, ci('#8fe3ff'), .8, 4); break;
    case 'decoy': addAlly('decoy', p.x, p.y, def.dur); break;
    case 'overdrive': p.buffs.overdrive = def.dur; ring(p.x, p.y, 40, C_GOLD, .4); break;
    case 'hole': { const t = aimPoint(p, 320); addZone('hole', t.x, t.y, 170, def.dur, 0); addTimer(def.dur, () => explode(t.x, t.y, 110, def.dmg * dmgMul(p), 0, 'Singularity')); break; }
    case 'flask': healPlayer(def.heal); A.play('heal', p.x, p.y); break;
    case 'aegis': p.buffs.aegis = def.dur; break;
    case 'strike': { const t = aimPoint(p, 420); for (let i = 0; i < 6; i++) { const an = i / 6 * TAU, x = t.x + cos(an) * (i ? 70 : 0), y = t.y + sin(an) * (i ? 70 : 0); tele('circle', x, y, 46, 0, .8 + i * .05, '#ffe23a');
      addTimer(.8 + i * .05, () => { beamFx(x, y - 500, x, y, '#fff27a', 14, .3); explode(x, y, 50, def.dmg * dmgMul(p), 0, 'Orbital Strike', true); }); } break; }
  }
}
// ---- allies & passives --------------------------------------------------------------------------------------------------
function addAlly(kind, x, y, life = 1e9, o = {}) { const a = Object.assign({ kind, x, y, px: x, py: y, vx: 0, vy: 0, t: life, cd: rnd() * .3, ang: 0, ph: rnd() * TAU, hp: 80, missT: 3 }, o); G.allies.push(a); return a; }
function syncAllies() {
  const p = G.player, cnt = k => G.allies.filter(a => a.kind === k).length;
  for (let i = cnt('drone'); i < B.drones; i++) addAlly('drone', p.x, p.y, 1e9, { ph: i * 2.1 });
  for (let i = cnt('orbital'); i < B.orbitals; i++) addAlly('orbital', p.x, p.y, 1e9, { ph: 0 });
  const orbs = G.allies.filter(a => a.kind === 'orbital'); orbs.forEach((a, i) => a.ph = i / orbs.length * TAU);
}
function spawnGhost(e) { if (G.allies.filter(a => a.kind === 'ghost').length > 8) return; addAlly('ghost', e.x, e.y, T.ST.ghostDur, { r: e.r, type: e.type, col: e.col }); }
function allyShot(a, t, dmg, spd = 560) {
  const an = atan2(t.y - a.y, t.x - a.x), b = newBullet(0); b.x = b.px = a.x; b.y = b.py = a.y; b.vx = cos(an) * spd; b.vy = sin(an) * spd; b.life = .9; b.r = 2.6; b.dmg = dmg * (1 + B.dmg * .5); b.summon = true; b.shape = SHAPE.bolt; b.col = 0; b.src = 'Drone'; b.kb = 30;
  if (B.syn.legion) { b.explode = 30; b.expDmg = b.dmg * .5; b.burn = 1; b.col = 2; } a.ang = an; return b;
}
function updateAllies(dt) {
  const p = G.player, rm = 1 + B.droneRate;
  for (let i = G.allies.length - 1; i >= 0; i--) {
    const a = G.allies[i]; a.px = a.x; a.py = a.y; a.t -= dt; a.cd -= dt;
    if (a.t <= 0 || a.hp <= 0) { burst(a.x, a.y, 10, ci('#5dff8a'), 160, .3, 2); G.allies.splice(i, 1); continue; }
    if (a.kind === 'drone') { a.ph += dt * 1.8; const tx = p.x + cos(a.ph) * 36, ty = p.y + sin(a.ph) * 36 - 6; a.x = lerp(a.x, tx, min(1, dt * 10)); a.y = lerp(a.y, ty, min(1, dt * 10));
      if (a.cd <= 0) { const t = nearestEnemy(a.x, a.y, 380, true); if (t) { allyShot(a, t, T.ST.droneDmg); a.cd = 1 / (T.ST.droneRate * rm); A.play('smg', a.x, a.y, .2, 1.6); } else a.cd = .2; }
      if (B.syn.swarmai) { a.missT -= dt; if (a.missT <= 0) { a.missT = 3; fireMissiles({ x: a.x, y: a.y, ang: rnd() * TAU, buffs: p.buffs, moveT: 0, hp: 1, maxHp: 1 }, 1); } } }
    else if (a.kind === 'sentry') { if (a.cd <= 0) { const t = nearestEnemy(a.x, a.y, 460, true); if (t) { allyShot(a, t, a.t > 100 ? T.ST.sentryDmg : T.ab.sentry.dmg, 640); a.cd = 1 / ((a.t > 100 ? 4 : T.ab.sentry.rate) * rm); A.play('pistol', a.x, a.y, .25, 1.4); } else a.cd = .2; }
      if (B.syn.swarmai) { a.missT -= dt; if (a.missT <= 0) { a.missT = 3; fireMissiles({ x: a.x, y: a.y, ang: a.ang, buffs: p.buffs, moveT: 0, hp: 1, maxHp: 1 }, 1); } } }
    else if (a.kind === 'orbital') { a.ph += dt * 4 * rm; a.x = p.x + cos(a.ph) * 54; a.y = p.y + sin(a.ph) * 54;
      forEnemiesNear(a.x, a.y, 10, e => { if ((e.orbT || 0) < G.time) { e.orbT = G.time + .3; hurtEnemy(e, T.ST.orbitalDmg * (1 + B.dmg * .5), DMG.SUMMON); _tmpB.reset(); _tmpB.summon = true; applyOnHit(e, _tmpB); spray(a.x, a.y, a.ph, 1, 4, C_HEAL, 200, .2, 2); } }); }
    else if (a.kind === 'ghost') { const t = nearestEnemy(a.x, a.y, 500); if (t) { const an = atan2(t.y - a.y, t.x - a.x); a.vx = lerp(a.vx, cos(an) * 200, dt * 5); a.vy = lerp(a.vy, sin(an) * 200, dt * 5);
        if (dist2(a.x, a.y, t.x, t.y) < (t.r + a.r) ** 2 && a.cd <= 0) { a.cd = .5; hurtEnemy(t, 15 * (1 + B.dmg * .5), DMG.SUMMON); _tmpB.reset(); _tmpB.summon = true; applyOnHit(t, _tmpB); } } a.x += a.vx * dt; a.y += a.vy * dt; collideTiles(a, a.r, true); }
  }
}
function updatePassives(p, dt) {
  if (B.tesla) { p.teslaT -= dt; if (p.teslaT <= 0) { p.teslaT = T.ST.teslaCd; const t = nearestEnemy(p.x, p.y, 240, true); if (t) { chainLightning(t, T.ST.teslaDmg * (1 + B.dmg * .5) * B.tesla, 2 + B.shockAdd, p.x, p.y - 10); } } }
  if (G.tick % 60 === 0) syncAllies();
}
// =====================================================================================
// UPGRADE ENGINE — offers, picking, synergies
// =====================================================================================
const UPG = {}; for (const r of UPG_ROWS) UPG[r[0]] = { id: r[0], fam: r[1], rar: r[2], n: r[3], d: r[4], s: r[5], o: r[6] || {} };
const SYN = {}; for (const r of SYN_ROWS) SYN[r[0]] = { id: r[0], a: r[1], b: r[2], n: r[3], d: r[4] };
const RAR_NAME = ['Common', 'Rare', 'Epic', 'Legendary', 'Cursed'];
function upgDesc(u, html = true) {
  const v = Object.assign({}, T.ST, { burnDps: round(burnDpsPreview()), freezeDur: B ? freezeDur() : T.ST.freezeDur, poisonMax: B ? poisonMax() : T.ST.poisonMax }, u.s);
  return u.d.replace(/\{(\w+)(%?)\}/g, (_, k, pc) => { let x = v[k]; if (x === undefined) return k; x = pc ? round(x * 100) + '%' : (Math.round(x * 10) / 10); return html ? `<b>${x}</b>` : x; });
}
function burnDpsPreview() { return B && G.run ? burnDps() : T.ST.burnDps; }
function upgAllowed(u, run) {
  if (run.banished.has(u.id)) return false; const lock = u.o.lock; if (lock && !isUnlocked(lock)) return false;
  const have = B.picks[u.id] || 0; if (u.o.max && have >= u.o.max) return false;
  if (u.o.req === 'summonAny') { if (!(B.drones || B.sentry || B.orbitals || G.run.char === 'bastion')) return false; } else if (u.o.req && !B[u.o.req]) return false;
  return true;
}
// family-aware, luck-aware weighted offer roll
function rollOffers(n, minRar, rng) {
  const run = G.run, out = [], pool = Object.values(UPG).filter(u => upgAllowed(u, run));
  const rw = T.rarityW.map((w, i) => max(1, w + T.luckW[i] * (B.luck || 0)));
  for (let k = 0; k < n && pool.length; k++) {
    let rar; if (rng.chance(T.curseChance * (k === n - 1 ? 1.5 : 0)) && pool.some(u => u.rar === 4)) rar = 4; else { rar = +rng.weighted({ 0: rw[0], 1: rw[1], 2: rw[2], 3: rw[3] }); rar = max(rar, minRar); }
    let cand = pool.filter(u => u.rar === rar && !out.includes(u)); for (let r = rar; !cand.length && r >= 0; r--) cand = pool.filter(u => u.rar === r && !out.includes(u));
    if (!cand.length) cand = pool.filter(u => !out.includes(u)); if (!cand.length) break;
    const w = {}; for (const u of cand) { const fc = famCount(u.fam); let wt = 1 + (fc > 0 ? .7 : 0); if (fc === 1 && synPartnerReady(u.fam)) wt += .8; w[u.id] = wt; }
    out.push(UPG[rng.weighted(w)]);
  }
  return out;
}
function synPartnerReady(f) { for (const s of Object.values(SYN)) { if (B.syn[s.id]) continue; if ((s.a === f && famCount(s.b) >= 2) || (s.b === f && famCount(s.a) >= 2)) return true; } return false; }
// hint text about synergies a card would progress or complete
function synHint(u) {
  if (u.fam === 'core' || u.fam === 'curse') return ''; const after = famCount(u.fam) + 1, res = [];
  for (const s of Object.values(SYN)) { if (B.syn[s.id] || (s.a !== u.fam && s.b !== u.fam)) continue; const other = s.a === u.fam ? s.b : s.a;
    if (after >= 2 && famCount(other) >= 2) res.push(`Completes <b>${isSeen('syn', s.id) ? s.n : '???'}</b>`); else if (famCount(other) >= 1 && after <= 2) res.push(`Toward ${isSeen('syn', s.id) ? s.n : '??? (' + FAM[other].n + ')'}`); }
  return res.slice(0, 2).join('<br>');
}
function pickUpgrade(id, silent = false) {
  const u = UPG[id], run = G.run; for (const k in u.s) B[k] = (B[k] || 0) + u.s[k];
  B.picks[id] = (B.picks[id] || 0) + 1; B.fam[u.fam] = (B.fam[u.fam] || 0) + 1; run.upgrades.push(id); codexSee('upg', id);
  if (!silent) { A.play(u.rar >= 2 ? 'rare' : 'pick'); }
  if (run.upgrades.filter(x => UPG[x].rar === 4).length >= 3) unlockAch('cursed3');
  recalcPlayer(); refreshWeapons(); if (G.player) syncAllies(); checkSynergies();
}
function checkSynergies() {
  for (const s of Object.values(SYN)) {
    if (B.syn[s.id] || famCount(s.a) < 2 || famCount(s.b) < 2) continue;
    B.syn[s.id] = true; G.run.synergies.push(s.id); const first = !isSeen('syn', s.id); codexSee('syn', s.id);
    setTimeout(() => { toast('SYNERGY: ' + s.n.toUpperCase(), s.d, true); A.play('synergy'); MUS.stinger('synergy'); }, 350);
    const found = Object.keys(G.meta.codex.syn || {}).length; if (found >= 5) unlockAch('synergist'); if (found >= 12) unlockAch('syn12');
  }
}
function recalcPlayer() {
  const p = G.player, run = G.run, ch = T.CH[run.char]; if (!p) return;
  const base = ch.hp + (G.meta.boosts.vit || 0) * 8 + B.maxHp, mx = max(10, round(base * (1 + B.maxHpPct)));
  if (mx > p.maxHp) p.hp += mx - p.maxHp; p.maxHp = mx; p.hp = min(p.hp, mx); run.maxHp = mx;
}
