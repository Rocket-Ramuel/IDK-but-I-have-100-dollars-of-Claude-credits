// =====================================================================================
// SECTION 7 — AI: enemies, perception, utility AI, steering, squad tactician, director
// =====================================================================================
class Enemy {
  constructor() { this.reset(); }
  reset() {
    this.id = 0; this.type = ''; this.def = null; this.brain = null; this.x = this.y = this.px = this.py = this.vx = this.vy = this.kbx = this.kby = this.dvx = this.dvy = 0;
    this.r = 10; this.hp = this.maxHp = 1; this.spd = 0; this.armor = 0; this.mass = 1; this.ang = 0; this.aim = 0; this.dead = false; this.spawnT = 0; this.inv = 0; this.fly = false;
    this.flash = 0; this.squash = 0; this.bob = rnd() * TAU; this.boss = false; this.elite = false; this.mods = null; this.shield = 0; this.shieldMax = 0; this.shieldT = 0; this.reflectT = 0; this.reflectCd = 0;
    this.burnT = 0; this.burnDps = 0; this.burnAcc = 0; this.chill = 0; this.frozenT = 0; this.poison = 0; this.poisonT = 0; this.poisonAcc = 0; this.stunT = 0; this.dotT = 0; this.fxT = 0; this.chainId = 0;
    this.act = ''; this.actT = 0; this.thinkT = rnd() * .2; this.percT = rnd() * .15; this.los = false; this.dist = 999; this.angTo = 0; this.role = 0; this.token = 0; this.atkPhase = 0; this.atkT = 0; this.cd = rr(.6, 1.6);
    this.tx = 0; this.ty = 0; this.hasT = false; this.path = null; this.pathI = 0; this.pathReq = false; this.pathT = 0; this.strafe = rnd() < .5 ? 1 : -1; this.waitT = 0; this.kids = 0; this.parent = null;
    this.burrowed = false; this.size = 0; this.buffT = 0; this.shieldFlash = 0; this.noDrop = false; this.a = 0; this.b = 0; this.c = 0; this.d = 0; this.ax = 0; this.ay = 0; this.phase = 0; this.lastHitT = -9;
    this.envT = 0; this.healT = 0; this.healTarget = null; this.lungeT = 0; this.ally = null; this.contact = 0; this.lastLosT = 0; this.seenT = 0; this.lx = 0; this.ly = 0;
    this.hasted = false; this.vamp = false; this.tl = null; this.sight = 0; this.alpha = 1; this.peek = 0; this.atkKind = ''; this.atkDur = 1; this.lockAng = false; this.onWall = null; this.dmgMul = 1; this.col = '#ffffff'; this.orbT = 0; this.bossId = ''; this.introT = 0; this.transT = 0; this.gen = null; this.waitT = 0; this.hold = 0; this.lift = 0; this.spin = 0; this.orbs = null; this.wind = 0; this.flood = null; this.floodQ = 0; this.shrink = 0; this.shrinkR = 0; this.lastAtk = ''; this.bdmg = 10;
  }
}
const EPOOL = []; for (let i = 0; i < 400; i++) EPOOL.push(new Enemy());
const ROLE = { NONE: 0, PIN: 1, FLANK_L: 2, FLANK_R: 3, GUARD: 4, SNIPE: 5 }, ROLE_NAME = ['', 'PIN', 'FLANK L', 'FLANK R', 'GUARD', 'SNIPE'];
function enemyScale() { const run = G.run, b = run ? run.biome : 0, l = run && run.map.cur ? run.map.byId[run.map.cur].layer : 0;
  return { hp: [1, 1.45, 2, 2.7][b] * (1 + l * .05) * (1 + (run && run.heat > 0 ? .15 : 0)) * (1 + (B ? B.enemyHp : 0)), dmg: [1, 1.15, 1.3, 1.45][b] }; }
function spawnEnemy(type, x, y, o = {}) {
  const def = T.E[type], e = EPOOL.pop() || new Enemy(), sc = enemyScale(); e.reset();
  e.id = _eid++; e.type = type; e.def = def; e.brain = BRAINS[def.b]; e.x = e.px = x; e.y = e.py = y; e.r = def.r; e.fly = !!def.fly;
  e.maxHp = e.hp = def.hp * sc.hp; e.dmgMul = sc.dmg; e.armor = def.armor || 0; e.col = def.col; e.spawnT = o.noTele ? 0 : T.director.spawnDelay; e.mass = (e.r / 10) ** 2;
  if (o.size !== undefined && type === 'gel') { e.size = o.size; const k = [.45, .7, 1][e.size]; e.r = def.r * k; e.maxHp = e.hp = def.hp * sc.hp * [.2, .45, 1][e.size]; e.mass = (e.r / 10) ** 2; }
  else if (type === 'gel') e.size = 2;
  if (o.vx) e.kbx = o.vx;
  if (o.elite) makeElite(e, o.elite);
  if (e.brain.init) e.brain.init(e, o);
  e.ang = atan2(G.player.y - y, G.player.x - x); e.lastLosT = G.time + e.spawnT;
  if (e.spawnT > 0) { A.play('spawn', x, y, .5); tele('circle', x, y, e.r * 1.8, 0, e.spawnT, e.col); }
  G.enemies.push(e); if (!o.noCodex) codexSee('enemy', type); return e;
}
function makeElite(e, mods) {
  const E2 = T.elite; e.elite = true; e.mods = mods; e.maxHp = e.hp = e.maxHp * E2.hpMul; e.r *= E2.rMul; e.mass *= 1.6;
  e.hasted = mods.includes('hasted'); e.vamp = mods.includes('vampiric');
  if (mods.includes('shielded')) e.shield = e.shieldMax = e.maxHp * E2.shielded.frac;
  if (mods.includes('reflective')) e.reflectCd = E2.reflective.every;
}
function eSpeed(e) {
  let s = e.def.spd * (1 + (B ? B.enemySpd : 0)) * (G.run.heat > 8 ? 1.1 : 1);
  if (e.hasted) s *= 1 + T.elite.hasted.spd; if (e.buffT > 0) s *= 1 + T.E.warden.buffSpd;
  if (e.chill > 0) s *= max(.2, 1 - e.chill / T.ST.chillMax * T.ST.chillSlow * (1 + (B ? B.chillSlow : 0)));
  if (B && B.neuro && e.poison >= 8) s *= .7; return s;
}
const eDmg = (e, d) => d * e.dmgMul * (B && B.neuro && e.poison >= 8 ? .75 : 1);
function decoyTarget() { for (const a of G.allies) if (a.kind === 'decoy') return a; return null; }
// predictive aim: intercept for projectile speed s with accuracy blend
function leadAim(e, sx, sy, s, accMul = 1, lead = 1) {
  const p = decoyTarget() || G.player, run = G.run, acc = clamp((T.ai.accuracy[run.biome] + run.heat * T.ai.accHeat) * accMul, 0, 1);
  const dx = p.x - sx, dy = p.y - sy, vx = (p.vx || 0) * lead, vy = (p.vy || 0) * lead;
  const a = vx * vx + vy * vy - s * s, b = 2 * (dx * vx + dy * vy), c = dx * dx + dy * dy; let t = 0;
  if (abs(a) < 1e-6) t = -c / b; else { const disc = b * b - 4 * a * c; if (disc >= 0) { const r1 = (-b - sqrt(disc)) / (2 * a), r2 = (-b + sqrt(disc)) / (2 * a); t = min(r1, r2) > 0 ? min(r1, r2) : max(r1, r2); } }
  t = clamp(t || 0, 0, 1.5) * acc; return atan2(dy + vy * t, dx + vx * t) + (rnd() - .5) * (1 - acc) * .25;
}

// ---- per-tick enemy update ------------------------------------------------------------------------------------------
function updateEnemies(dt) {
  const p = G.player, tgt = decoyTarget() || p;
  for (let i = 0; i < G.enemies.length; i++) {
    const e = G.enemies[i]; if (e.dead) continue;
    e.px = e.x; e.py = e.y; e.flash = max(0, e.flash - dt); e.squash *= exp(-dt * 10); e.bob += dt * 6; e.shieldFlash = max(0, e.shieldFlash - dt); e.buffT = max(0, e.buffT - dt);
    if (e.spawnT > 0) { e.spawnT -= dt; if (e.spawnT <= 0) { burst(e.x, e.y, 10, ci(e.col), 200, .4, 3); ring(e.x, e.y, e.r * 2.5, ci(e.col), .3); } continue; }
    if (e.inv > 0) e.inv -= dt;
    updateStatus(e, dt); if (e.dead) continue;
    if (e.reflectCd > 0) { e.reflectCd -= dt; if (e.reflectCd <= 0) { e.reflectT = T.elite.reflective.dur; e.reflectCd = T.elite.reflective.every + T.elite.reflective.dur; A.play('block', e.x, e.y, .6, .7); } }
    if (e.reflectT > 0) e.reflectT -= dt;
    // perception (staggered)
    e.percT -= dt; if (e.percT <= 0) { e.percT = (1 / T.ai.losHz) * (.8 + rnd() * .4); const dx = tgt.x - e.x, dy = tgt.y - e.y; e.dist = hypot(dx, dy); e.angTo = atan2(dy, dx);
      e.los = los(e.x, e.y, tgt.x, tgt.y, e.fly ? 1 : 0); if (e.los) { e.lastLosT = G.time; e.lx = tgt.x; e.ly = tgt.y; } }
    else { e.dist = hypot(tgt.x - e.x, tgt.y - e.y); e.angTo = atan2(tgt.y - e.y, tgt.x - e.x); }
    const disabled = (e.frozenT > 0 || e.stunT > 0) && !e.boss;
    e.dvx = e.dvy = 0;
    if (!disabled) {
      if (e.atkPhase === 0) { e.thinkT -= dt; if (e.thinkT <= 0) { e.thinkT = (1 / T.ai.thinkHz) * (.8 + rnd() * .4); think(e); } }
      e.actT += dt; if (e.cd > 0) e.cd -= dt * (e.hasted ? 1 + T.elite.hasted.rate : 1);
      const act = e.brain.acts[e.act]; if (act) act.run(e, dt);
      if (e.atkPhase > 0) runAttack(e, dt);
    } else if (e.atkPhase > 0) endAttack(e);
    steerMove(e, dt, disabled);
    // contact damage
    if (e.contact > 0 && !p.dead && dist2(e.x, e.y, p.x, p.y) < (e.r + p.r * .8) ** 2) { if (hurtPlayer(eDmg(e, e.contact), e.def.n, e.x, e.y)) { if (e.vamp) e.hp = min(e.maxHp, e.hp + e.contact * T.elite.vampiric.heal * 3); e.contact = 0; } }
  }
}
function think(e) {
  const acts = e.brain.acts; let best = null, bs = -1;
  for (const k in acts) { let s = acts[k].score(e); if (k === e.act) s *= 1.25; if (s > bs) { bs = s; best = k; } }
  if (best !== e.act) { e.act = best; e.actT = 0; e.hasT = false; e.path = null; if (acts[best].enter) acts[best].enter(e); }
}
// combine desired velocity with separation, wall avoidance, knockback; move & collide
function steerMove(e, dt, disabled) {
  const spd = eSpeed(e), grid = G.grid, L = grid.list, out = grid.out;
  let sx = 0, sy = 0; const sr = e.r * T.ai.sepR * TAC.spread + 4, n = grid.query(e.x, e.y, sr + 20);
  for (let k = 0, used = 0; k < n && used < 10; k++) {
    const o = L[out[k]]; if (o === e || o.dead || o.spawnT > 0 || o.burrowed || o.fly !== e.fly) continue;
    let dx = e.x - o.x, dy = e.y - o.y; const d2 = dx * dx + dy * dy, rs = (e.r + o.r) * T.ai.sepR * TAC.spread;
    if (d2 > rs * rs || d2 < 1e-6) continue; used++; const d = sqrt(d2); dx /= d; dy /= d; const push = 1 - d / rs; sx += dx * push; sy += dy * push;
    const hard = e.r + o.r; if (d < hard && !e.boss) { const c = (hard - d) * (o.boss ? 1 : .5); e.x += dx * c; e.y += dy * c; }
  }
  let dvx = e.dvx, dvy = e.dvy;
  if (!disabled) { dvx += sx * T.ai.sepW * spd; dvy += sy * T.ai.sepW * spd;
    if (!e.fly && (dvx || dvy) && clearanceAt(e.x, e.y) <= 1) { clearanceGrad(e.x, e.y); dvx += _fx * spd * T.ai.avoidW * .6; dvy += _fy * spd * T.ai.avoidW * .6; } }
  else { dvx = dvy = 0; }
  const dl = hypot(dvx, dvy), cap = e.lungeT > 0 ? 1e9 : spd * 1.15; if (dl > cap) { dvx *= cap / dl; dvy *= cap / dl; }
  const acc = (e.lungeT > 0 ? 30 : 9) * dt; e.vx += (dvx - e.vx) * min(1, acc); e.vy += (dvy - e.vy) * min(1, acc);
  const kd = exp(-dt * 7); e.kbx *= kd; e.kby *= kd;
  e.x += (e.vx + e.kbx) * dt; e.y += (e.vy + e.kby) * dt;
  if (e.boss) { if (collideTiles(e, e.r * .6, true)) { } }
  else if (collideTiles(e, e.r, e.fly)) { if (e.onWall) e.onWall(e); }
  if (!disabled && e.atkPhase === 0 && (e.vx * e.vx + e.vy * e.vy) > 100 && !e.lockAng) e.ang = lerpAng(e.ang, atan2(e.vy, e.vx), min(1, dt * 8));
}
// ---- movement primitives (set e.dvx/e.dvy) ------------------------------------------------------------------------------
function seekPoint(e, x, y, spd, arrive = 0) { const dx = x - e.x, dy = y - e.y, d = hypot(dx, dy); if (d < 1) return d; const k = arrive > 0 ? min(1, d / arrive) : 1; e.dvx = dx / d * spd * k; e.dvy = dy / d * spd * k; return d; }
function flowTo(e, spd) { // chase the player via shared flow field; direct seek with line of sight
  const tgt = decoyTarget() || G.player;
  if (e.fly || (e.los && e.dist < 260)) { let tx = tgt.x, ty = tgt.y; if (TAC.intercept && tgt.vx !== undefined) { tx += tgt.vx * .45; ty += tgt.vy * .45; } return seekPoint(e, tx, ty, spd); }
  G.room.flow.dir(e.x, e.y); if (_fx || _fy) { e.dvx = _fx * spd; e.dvy = _fy * spd; } else seekPoint(e, tgt.x, tgt.y, spd);
}
function fleeFrom(e, x, y, spd) { // move away using inverse flow gradient blended with direct flee
  const dx = e.x - x, dy = e.y - y, d = hypot(dx, dy) || 1; G.room.flow.dir(e.x, e.y); let fx = dx / d - _fx * .6, fy = dy / d - _fy * .6;
  clearanceGrad(e.x, e.y); if (clearanceAt(e.x, e.y) <= 2) { fx += _fx * .8; fy += _fy * .8; } const l = hypot(fx, fy) || 1; e.dvx = fx / l * spd; e.dvy = fy / l * spd;
}
// navigate to arbitrary point: direct if visible, else A* path
function goTo(e, x, y, spd, arrive = 24) {
  if (e.fly || losThick(e.x, e.y, x, y, e.r)) { e.path = null; return seekPoint(e, x, y, spd, arrive); }
  e.pathT -= 1 / T.sim.hz;
  if (!e.path || e.pathT <= 0) { e.pathT = .6; PATH.request(e, x, y); if (!e.path) { flowTo(e, spd); return 999; } }
  const P2 = e.path; if (e.pathI * 2 >= P2.length) { e.path = null; return seekPoint(e, x, y, spd, arrive); }
  const wx = P2[e.pathI * 2], wy = P2[e.pathI * 2 + 1]; if (dist2(e.x, e.y, wx, wy) < 20 * 20) e.pathI++;
  seekPoint(e, wx, wy, spd); return hypot(x - e.x, y - e.y);
}
function strafeAround(e, range, spd) { // hold a distance band, circling
  const tgt = decoyTarget() || G.player, d = e.dist, a = e.angTo, rad = clamp((d - range) / 80, -1, 1);
  if (e.actT > 1.2 && rnd() < .01) e.strafe = -e.strafe;
  const tx = cos(a) * rad + cos(a + PI / 2) * e.strafe * .8, ty = sin(a) * rad + sin(a + PI / 2) * e.strafe * .8, l = hypot(tx, ty) || 1;
  e.dvx = tx / l * spd; e.dvy = ty / l * spd;
  if (clearanceAt(e.x + e.dvx * .3, e.y + e.dvy * .3) < 1) e.strafe = -e.strafe;
}
// candidate search: find a floor point (within radius) satisfying a scorer; few samples
function findSpot(e, rad, scorer, samples = 14) {
  const room = G.room; let best = null, bs = -1e9;
  for (let i = 0; i < samples; i++) { const a = rnd() * TAU, d = rr(TS, rad), x = e.x + cos(a) * d, y = e.y + sin(a) * d, tx = floor(x / TS), ty = floor(y / TS);
    if (tx < 1 || ty < 1 || tx >= room.w - 1 || ty >= room.h - 1 || room.tiles[ty * room.w + tx] !== 0 || room.hz[ty * room.w + tx] >= 0) continue;
    const cx = (tx + .5) * TS, cy = (ty + .5) * TS, s = scorer(cx, cy); if (s > bs) { bs = s; best = { x: cx, y: cy }; } }
  return best;
}
// ---- attack framework: windup (telegraph) → execute → recover ------------------------------------------------------------
function startAttack(e, windup, kind = 'wind', snd = 'wind', sndPitch = 1) {
  e.atkPhase = 1; e.atkT = windup; e.atkKind = kind; e.atkDur = windup; e.vx *= .3; e.vy *= .3;
  if (snd) A.play(snd, e.x, e.y, .45, sndPitch);
}
function runAttack(e, dt) {
  e.atkT -= dt; const br = e.brain;
  if (e.atkPhase === 1) { if (br.windup) br.windup(e, dt, 1 - e.atkT / e.atkDur); if (e.atkT <= 0) { e.atkPhase = 2; e.atkT = 0; br.fire(e); } }
  else if (e.atkPhase === 2) { if (br.active && e.atkT > 0) br.active(e, dt); if (e.atkT <= 0) { e.atkPhase = 3; e.atkT = br.recover || .35; } }
  else if (e.atkPhase === 3 && e.atkT <= 0) { endAttack(e); e.cd = (e.def.cd || 2) * rr(.8, 1.25); }
}
function endAttack(e) { e.atkPhase = 0; e.contact = 0; e.lockAng = false; e.lungeT = 0; e.tl = null; TAC.release(e); }
const canShoot = e => e.cd <= 0 && e.atkPhase === 0;
function friendlyBlocked(e, ang, d) { // is an ally in the line of fire?
  const grid = G.grid, L = grid.list, out = grid.out, cx = cos(ang), cy = sin(ang);
  for (let s = 1; s <= 3; s++) { const px = e.x + cx * d * s / 4, py = e.y + cy * d * s / 4, n = grid.query(px, py, 24);
    for (let k = 0; k < n; k++) { const o = L[out[k]]; if (o === e || o.dead || o.fly) continue; const rx = o.x - e.x, ry = o.y - e.y, along = rx * cx + ry * cy; if (along < 0 || along > d) continue;
      if (abs(rx * cy - ry * cx) < o.r + 4) return true; } }
  return false;
}
const plr = () => decoyTarget() || G.player;
const tokenOk = (e, kind) => e.token || TAC.grant(e, kind);

// ---- shared action library ---------------------------------------------------------------------------------------------
const ACT = {
  chase: (spdK = 1) => ({ score: e => .4, run: (e) => flowTo(e, eSpeed(e) * spdK) }),
  reacquire: { score: e => e.los ? .05 : .75, run: e => { if (G.time - e.lastLosT < 3 && !e.fly) goTo(e, e.lx, e.ly, eSpeed(e)); else flowTo(e, eSpeed(e)); } },
  engage: (range) => ({ score: e => e.los ? .55 + (abs(e.dist - range) < range * .4 ? .2 : 0) : .1, run: e => strafeAround(e, range, eSpeed(e) * .75) }),
  flank: (range) => ({
    score: e => (e.role === ROLE.FLANK_L || e.role === ROLE.FLANK_R) ? (TAC.flush ? .8 : .65) : 0,
    run: e => { const p = plr(), side = e.role === ROLE.FLANK_L ? -1 : 1, base = TAC.front + side * T.ai.flankAng * (TAC.intercept ? .8 : 1);
      let tx = p.x + cos(base) * range, ty = p.y + sin(base) * range; if (TAC.intercept) { tx += p.vx * .6; ty += p.vy * .6; }
      const d = goTo(e, tx, ty, eSpeed(e)); if (d < 60) strafeAround(e, range, eSpeed(e) * .6); },
  }),
  cover: (range) => ({
    score: e => { const p = G.player, aimed = abs(angDiff(p.ang, atan2(e.y - p.y, e.x - p.x))) < .3; return (e.hp < e.maxHp * .6 ? .45 : .2) + (aimed ? .25 : 0) + (TAC.flush ? -.3 : 0) + (e.role === ROLE.PIN ? .05 : 0); },
    enter: e => { const p = plr(); const s = findSpot(e, 200, (x, y) => { const d = hypot(x - p.x, y - p.y); if (los(x, y, p.x, p.y) || d < 120 || d > range * 1.5) return -1e9; return -abs(d - range) * .3 - hypot(x - e.x, y - e.y) + (clearanceAt(x, y) <= 1 ? 60 : 0); });
      e.hasT = !!s; if (s) { e.tx = s.x; e.ty = s.y; } },
    run: e => { if (!e.hasT) { strafeAround(e, range, eSpeed(e) * .6); return; } const d = goTo(e, e.tx, e.ty, eSpeed(e) * 1.1, 10);
      // peek: when ready, step out toward the player to regain LOS and shoot
      if (d < 16 && canShoot(e)) { e.peek = .7; } if (e.peek > 0) { e.peek -= 1 / T.sim.hz; seekPoint(e, plr().x, plr().y, eSpeed(e) * .8); } },
  }),
  retreat: { score: e => (e.hp < e.maxHp * .35 && TAC.healers > 0 ? .9 : 0), run: e => { const h = TAC.healer; if (h && !h.dead) goTo(e, h.x, h.y, eSpeed(e)); else fleeFrom(e, plr().x, plr().y, eSpeed(e)); } },
};
// ---- brains -------------------------------------------------------------------------------------------------------------
const BRAINS = {
  // MITE: stage in packs, rush together on the tactician's signal, lunge
  swarm: {
    acts: {
      wait: { score: e => TAC.rushing ? 0 : (e.dist < 110 ? .1 : .6), run: e => { const p = plr(), stage = 230; if (e.dist > stage + 60) flowTo(e, eSpeed(e)); else strafeAround(e, stage, eSpeed(e) * .45); e.waitT += 1 / T.sim.hz; } },
      rush: { score: e => TAC.rushing ? 1 : (e.dist < 110 ? .9 : TAC.packSize < 2 ? .7 : 0), run: e => { flowTo(e, eSpeed(e) * 1.15); if (e.dist < 75 && e.los && canShoot(e) && tokenOk(e, 'melee')) startAttack(e, e.def.wind, 'lunge', 'wind', 1.6); } },
    },
    windup: (e, dt, f) => { e.ang = e.angTo; e.dvx = e.dvy = 0; e.squash = .3 * f; },
    fire: e => { const a = leadAim(e, e.x, e.y, e.def.lunge, 1, .6); e.ang = a; e.vx = cos(a) * e.def.lunge; e.vy = sin(a) * e.def.lunge; e.lungeT = .22; e.atkT = .22; e.contact = e.def.dmg; e.lockAng = true; },
    active: (e, dt) => { e.lungeT -= dt; e.dvx = e.vx; e.dvy = e.vy; if (rnd() < .5) emit(PK.SPARK, e.x, e.y, -e.vx * .3, -e.vy * .3, .15, 2, ci(e.col)); },
    recover: .45,
  },
  // GUNNER: engage at range, use cover & peek, flank on orders, burst fire with lead
  gunner: {
    acts: { engage: ACT.engage(250), cover: ACT.cover(250), flank: ACT.flank(240), reacquire: ACT.reacquire, retreat: ACT.retreat },
    tick: e => { if (e.los && canShoot(e) && e.dist < 420 && tokenOk(e, 'ranged')) { if (friendlyBlocked(e, e.angTo, e.dist)) { e.strafe = -e.strafe; return; } startAttack(e, e.def.wind, 'burst', 'wind', 1.2); } },
    windup: (e, dt, f) => { e.ang = e.angTo; e.aim = e.angTo; },
    fire: e => { e.atkT = e.def.burst * .11; e.b = 0; e.c = 0; },
    active: (e, dt) => { e.c -= dt; if (e.c <= 0 && e.b < e.def.burst) { e.c = .11; e.b++; const a = leadAim(e, e.x, e.y, e.def.bspd, 1, e.b === 3 && TAC.intercept ? 1.6 : 1);
      eShot(e.x + cos(a) * e.r, e.y + sin(a) * e.r, a, e.def.bspd, eDmg(e, e.def.dmg), 4.5, 'Gunner', 0, e); e.ang = a; A.play('eshot', e.x, e.y, .5); e.squash = .15; } },
  },
  // RAM: approach, telegraph a charge lane, charge; stuns itself on walls
  charger: {
    acts: { approach: { score: e => .5, run: e => { if (e.dist > 300 || !e.los) flowTo(e, eSpeed(e)); else strafeAround(e, 220, eSpeed(e) * .6);
      if (e.los && e.dist < 340 && canShoot(e) && tokenOk(e, 'melee')) { startAttack(e, e.def.wind, 'charge', 'growl'); e.tl = tele('line', e.x, e.y, 300, e.r, e.def.wind, '#ff6a3a', e.angTo, e); } } } },
    windup: (e, dt, f) => { if (f < .75) e.ang = lerpAng(e.ang, leadAim(e, e.x, e.y, e.def.cspd, .8, .5), min(1, dt * 6)); e.dvx = e.dvy = 0; e.squash = .2 * f;
      if (e.tl) { e.tl.x = e.x; e.tl.y = e.y; e.tl.ang = e.ang; e.tl.a = min(e.def.cspd * e.def.cdur, raycast(e.x, e.y, cos(e.ang), sin(e.ang), 600)); } },
    fire: e => { e.atkT = e.def.cdur; e.lungeT = e.def.cdur; e.contact = e.def.dmg; e.lockAng = true; trauma(.08); },
    active: (e, dt) => { e.dvx = cos(e.ang) * e.def.cspd; e.dvy = sin(e.ang) * e.def.cspd; e.vx = e.dvx; e.vy = e.dvy; e.lungeT = e.atkT; emit(PK.SPARK, e.x, e.y, -e.dvx * .4 + rr(-60, 60), -e.dvy * .4 + rr(-60, 60), .25, 3, ci(e.col)); },
    recover: .7, init: e => { e.onWall = e2 => { if (e2.atkPhase === 2) { e2.atkPhase = 3; e2.atkT = 1.3; e2.stunT = 1.3; e2.contact = 0; trauma(.25); A.play('slam', e2.x, e2.y, .5, 1.4); burst(e2.x, e2.y, 14, ci(e2.col), 240, .4, 3); wtext(e2.x, e2.y - 18, 'STUNNED', '#ffd23a', 9); } }; },
  },
  // BULWARK: slow advance with frontal shield (slow turn rate → flankable), escorts ranged allies, fan shots
  shield: {
    acts: { advance: { score: e => .5, run: e => { const p = plr(); e.lockAng = true; e.ang += clamp(angDiff(e.ang, e.angTo), -1.5 / T.sim.hz, 1.5 / T.sim.hz);
        // escort: stand between player and the nearest ranged ally
        const ally = TAC.protectee(e); if (ally && e.dist > 150 && e.dist < 420) { const a = atan2(p.y - ally.y, p.x - ally.x); goTo(e, ally.x + cos(a) * 70, ally.y + sin(a) * 70, eSpeed(e)); } else if (e.dist > 120) flowTo(e, eSpeed(e)); else strafeAround(e, 120, eSpeed(e) * .5);
        if (e.los && canShoot(e) && e.dist < 380 && tokenOk(e, 'ranged')) startAttack(e, e.def.wind, 'fan', 'wind', .8); } } },
    windup: (e, dt, f) => { e.ang += clamp(angDiff(e.ang, e.angTo), -dt, dt); },
    fire: e => { for (let i = -2; i <= 2; i++) eShot(e.x + cos(e.ang) * e.r, e.y + sin(e.ang) * e.r, e.ang + i * .2, e.def.bspd, eDmg(e, e.def.dmg), 5, 'Bulwark', 0, e); A.play('eshotBig', e.x, e.y, .6); },
  },
  // LANCER: seek a long sightline perch, kite away, laser-sighted shot
  sniper: {
    acts: {
      perch: { score: e => (!e.los || e.dist < 300 || e.dist > 600) ? .65 : .2, enter: e => { const p = plr(); const s = findSpot(e, 360, (x, y) => { const d = hypot(x - p.x, y - p.y); if (d < 330 || !los(x, y, p.x, p.y)) return -1e9; return -abs(d - 450) * .4 - hypot(x - e.x, y - e.y) * .5 + clearanceAt(x, y) * -5; }, 18); e.hasT = !!s; if (s) { e.tx = s.x; e.ty = s.y; } },
        run: e => { if (e.hasT) { if (goTo(e, e.tx, e.ty, eSpeed(e), 10) < 14) e.hasT = false; } else strafeAround(e, 450, eSpeed(e) * .5); } },
      kite: { score: e => e.dist < 220 ? .95 : 0, run: e => fleeFrom(e, plr().x, plr().y, eSpeed(e) * 1.1) },
      aim: { score: e => e.los && e.dist >= 220 && e.dist < 720 ? .6 : 0, run: e => { e.dvx = e.dvy = 0; if (canShoot(e) && tokenOk(e, 'ranged')) { startAttack(e, e.def.wind, 'snipe', 'windSnipe'); } } },
    },
    windup: (e, dt, f) => { if (f < .72) e.aim = leadAim(e, e.x, e.y, e.def.bspd, 1.1, 1); e.ang = e.aim; e.dvx = e.dvy = 0; e.sight = f; },
    fire: e => { eShot(e.x + cos(e.aim) * e.r, e.y + sin(e.aim) * e.r, e.aim, e.def.bspd, eDmg(e, e.def.dmg), 4, 'Lancer', 2, e); A.play('snipe', e.x, e.y); e.sight = 0; e.kbx -= cos(e.aim) * 140; e.kby -= sin(e.aim) * 140; },
    recover: .5,
  },
  // LOBBER: indirect fire — doesn't need LOS; marks landing circles; flushes campers
  mortar: {
    acts: { keep: { score: e => .5, run: e => { if (e.dist < 260) fleeFrom(e, plr().x, plr().y, eSpeed(e)); else if (e.dist > 460) flowTo(e, eSpeed(e)); else strafeAround(e, 380, eSpeed(e) * .4);
      if (canShoot(e) && e.dist < 560 && tokenOk(e, 'ranged')) startAttack(e, e.def.wind, 'lob', null); } } },
    windup: (e, dt, f) => { e.squash = -.2 * f; },
    fire: e => { const p = plr(), n = e.def.shells + (TAC.flush ? 2 : 0); A.play('mortar', e.x, e.y, .7);
      for (let i = 0; i < n; i++) { const t = e.def.flight + i * .12, px = p.x + (p.vx || 0) * t * .7 + (i ? rr(-70, 70) : 0), py = p.y + (p.vy || 0) * t * .7 + (i ? rr(-70, 70) : 0);
        const tl = tele('circle', px, py, e.def.blast, 0, t, '#c8ff3a'); const dmg = eDmg(e, e.def.dmg), r = e.def.blast;
        A.play('whistle', px, py, .25); MORTARS.push({ x0: e.x, y0: e.y, x1: px, y1: py, t: 0, d: t }); addTimer(t, () => explode(tl.x, tl.y, r, dmg, 1, 'Lobber Shell', true)); } },
  },
  // BROOD: keeps far behind allies, hatches mites
  summoner: {
    acts: { hide: { score: e => .5, run: e => { const p = plr(); if (e.dist < 300) fleeFrom(e, p.x, p.y, eSpeed(e)); else if (e.dist > 520) flowTo(e, eSpeed(e)); else strafeAround(e, 400, eSpeed(e) * .3);
      if (canShoot(e) && e.kids < e.def.maxKids && G.enemies.length < 140) startAttack(e, e.def.wind, 'spawn', 'growl', 1.5); } } },
    windup: (e, dt, f) => { e.squash = .3 * sin(f * 20); },
    fire: e => { for (let i = 0; i < e.def.spawn; i++) { const a = rnd() * TAU, m = spawnEnemy('mite', e.x + cos(a) * 24, e.y + sin(a) * 24); m.spawnT = .5; m.parent = e; m.noDrop = rnd() < .6; e.kids++; } },
  },
  // PHANTOM: lurks outside your aim, marks a spot behind you, blinks, slashes
  assassin: {
    acts: { lurk: { score: e => .5, run: e => { const p = G.player, inAim = abs(angDiff(p.ang, atan2(e.y - p.y, e.x - p.x))) < .5; e.strafe = inAim ? (angDiff(p.ang, atan2(e.y - p.y, e.x - p.x)) > 0 ? 1 : -1) : e.strafe;
      strafeAround(e, 260, eSpeed(e) * (inAim ? 1.2 : .7)); if (canShoot(e) && e.dist < 520 && tokenOk(e, 'melee')) { startAttack(e, e.def.mark, 'blink', 'blink', .7);
        const pl = plr(), back = (G.player.ang || 0) + PI + rr(-.6, .6); let tx = pl.x + cos(back) * 48, ty = pl.y + sin(back) * 48; if (tileAt(tx, ty) !== 0) { tx = pl.x; ty = pl.y; }
        e.tx = tx; e.ty = ty; tele('mark', tx, ty, 14, 0, e.def.mark, '#9d7bff'); } } } },
    windup: (e, dt, f) => { e.dvx = e.dvy = 0; e.alpha = 1 - f * .8; },
    fire: e => { burst(e.x, e.y, 12, ci(e.col), 200, .3, 3); e.x = e.px = e.tx; e.y = e.py = e.ty; e.alpha = 1; burst(e.x, e.y, 12, ci(e.col), 200, .3, 3); e.atkT = .28; e.b = 0; e.ang = e.angTo = atan2(G.player.y - e.y, G.player.x - e.x);
      tele('cone', e.x, e.y, e.def.slashR + 10, 1.1, .28, '#9d7bff', e.ang); },
    active: (e, dt) => { e.dvx = e.dvy = 0; if (e.atkT <= .02 && !e.b) { e.b = 1; A.play('slash', e.x, e.y); spray(e.x, e.y, e.ang, 2, 14, ci('#d8c2ff'), 300, .25, 3);
      const p = G.player, d = hypot(p.x - e.x, p.y - e.y); if (d < e.def.slashR + p.r && abs(angDiff(e.ang, atan2(p.y - e.y, p.x - e.x))) < 1.15) hurtPlayer(eDmg(e, e.def.dmg), 'Phantom', e.x, e.y); } },
    recover: .6,
  },
  // TICK: kamikaze; fuse when close; explosion hurts everyone
  bomber: {
    acts: { run: { score: e => .5, run: e => { flowTo(e, eSpeed(e)); if (e.dist < e.def.trig && e.los) startAttack(e, e.def.fuse, 'fuse', 'fuse'); } } },
    windup: (e, dt, f) => { flowTo(e, eSpeed(e) * .45); e.flash = (f * 12 % 1) < .5 ? .05 : 0; e.squash = .25 * f; if (!e.tl) e.tl = tele('circle', e.x, e.y, e.def.blast, 0, e.def.fuse, '#ffdf3a', 0, e); e.tl.x = e.x; e.tl.y = e.y; },
    fire: e => { e.noDrop = false; killEnemy(e, DMG.EXPL); },
  },
  // MENDER: stays behind the line, heals the most hurt ally with a visible beam
  healer: {
    acts: {
      guard: { score: e => .5, run: e => { const p = plr(), t = e.healTarget && !e.healTarget.dead ? e.healTarget : TAC.tank || null;
        if (t) { const a = atan2(t.y - p.y, t.x - p.x); goTo(e, t.x + cos(a) * 90, t.y + sin(a) * 90, eSpeed(e)); } else if (e.dist < 320) fleeFrom(e, p.x, p.y, eSpeed(e)); else strafeAround(e, 380, eSpeed(e) * .4); } },
      flee: { score: e => e.dist < 190 ? .9 : 0, run: e => fleeFrom(e, plr().x, plr().y, eSpeed(e) * 1.15) },
    },
    tick: (e, dt) => { e.healT -= dt; if (e.healT <= 0) { e.healT = .5; let best = null, bf = .97; for (const o of G.enemies) { if (o === e || o.dead || o.spawnT > 0 || o.boss) continue; const f = o.hp / o.maxHp, d = dist2(o.x, o.y, e.x, e.y);
        if (f < bf && d < e.def.range ** 2 && los(e.x, e.y, o.x, o.y)) { bf = f; best = o; } } e.healTarget = best; }
      const t = e.healTarget; if (t && !t.dead) { const h = e.def.heal * dt * e.dmgMul; t.hp = min(t.maxHp, t.hp + h); if (rnd() < dt * 8) emit(PK.DOT, t.x + rr(-t.r, t.r), t.y + rr(-t.r, t.r), 0, -40, .5, 2.5, C_HEAL, 1); } },
  },
  // WARDEN: aura (haste + armour), escorts the pack, slow homing orbs
  buffer: {
    acts: { escort: { score: e => .5, run: e => { const c = TAC.centroid; if (c.n > 1) goTo(e, c.x, c.y, eSpeed(e), 60); else strafeAround(e, 300, eSpeed(e) * .5);
      if (e.los && canShoot(e) && e.dist < 450 && tokenOk(e, 'ranged')) startAttack(e, e.def.wind, 'orb', 'wind', .7); } } },
    tick: (e, dt) => { forEnemiesNear(e.x, e.y, e.def.aura, o => { if (o !== e) o.buffT = .3; }); },
    fire: e => { for (let i = -1; i <= 1; i++) { const b = eShot(e.x, e.y, e.angTo + i * .5, e.def.bspd, eDmg(e, e.def.dmg), 6, 'Warden Orb', 1, e); b.homing = 1.2; b.life = 4; } A.play('eshotBig', e.x, e.y, .5, 1.2); },
  },
  // DELVER: burrows (invulnerable) toward you, ring telegraph, erupts with a bullet ring
  burrower: {
    acts: { dig: { score: e => .5, run: e => {
      if (e.burrowed) { flowTo(e, eSpeed(e) * 1.2); if (rnd() < .4) emit(PK.SMOKE, e.x + rr(-8, 8), e.y + rr(-8, 8), 0, 0, .7, 6, ci('#5a4030'), 1);
        e.a -= 1 / T.sim.hz; if ((e.dist < 70 || e.a <= 0) && canShoot(e)) { startAttack(e, e.def.emerge, 'emerge', 'burrow'); e.tl = tele('ring', e.x, e.y, 12, 44, e.def.emerge, '#d08a4a', 0, e); } }
      else { strafeAround(e, 200, eSpeed(e) * .3); e.a -= 1 / T.sim.hz; if (e.a <= 0) { e.burrowed = true; e.a = rr(1.4, 2.4); A.play('burrow', e.x, e.y, .5); burst(e.x, e.y, 10, ci('#8a6a50'), 160, .4, 3, PK.SHARD); } } } } },
    init: e => { e.burrowed = true; e.a = rr(1, 2); },
    windup: (e, dt, f) => { e.dvx = e.dvy = 0; if (rnd() < .5) emit(PK.SHARD, e.x + rr(-20, 20), e.y + rr(-20, 20), rr(-40, 40), -rr(40, 120), .4, 3, ci('#8a6a50'), 2); },
    fire: e => { e.burrowed = false; e.a = rr(1.6, 2.4); trauma(.15); A.play('slam', e.x, e.y, .5, 1.3); const n = e.def.ring, o = rnd() * TAU;
      for (let i = 0; i < n; i++) eShot(e.x, e.y, o + i / n * TAU, e.def.bspd, eDmg(e, e.def.dmg), 5, 'Delver', 0, e);
      const p = G.player; if (dist2(p.x, p.y, e.x, e.y) < (34 + p.r) ** 2) hurtPlayer(eDmg(e, e.def.dmg * 1.4), 'Delver', e.x, e.y); burst(e.x, e.y, 20, ci('#8a6a50'), 260, .5, 4, PK.SHARD); },
    recover: .5,
  },
  // SPIRE: stationary bullet-hell emitter cycling patterns
  turret: {
    acts: { idle: { score: e => 1, run: e => { e.dvx = e.dvy = 0; if (canShoot(e) && e.dist < 640) startAttack(e, .6, 'pattern', 'wind', .6); } } },
    init: e => { e.mass = 99; e.c = 0; },
    windup: (e, dt, f) => { e.a += dt * 2; },
    fire: e => { e.c = (e.c + 1) % 3; e.atkT = e.c === 0 ? 2.2 : e.c === 1 ? .05 : .6; e.b = 0; e.d = 0; if (e.c === 1) { const n = 14, o = rnd() * TAU; for (let i = 0; i < n; i++) eShot(e.x, e.y, o + i / n * TAU, e.def.bspd, eDmg(e, e.def.dmg), 4.5, 'Spire', 3, e); A.play('eshotBig', e.x, e.y, .5); } },
    active: (e, dt) => { e.d -= dt; if (e.d > 0) return;
      if (e.c === 0) { e.d = 1 / e.def.rate; e.a += .37; for (let k = 0; k < 3; k++) eShot(e.x, e.y, e.a + k * TAU / 3, e.def.bspd, eDmg(e, e.def.dmg), 4, 'Spire', 0, e); if (rnd() < .3) A.play('eshot', e.x, e.y, .25, .8); }
      else if (e.c === 2) { e.d = .2; const a = leadAim(e, e.x, e.y, e.def.bspd * 1.4); for (let k = -1; k <= 1; k++) eShot(e.x, e.y, a + k * .15, e.def.bspd * 1.4, eDmg(e, e.def.dmg), 4, 'Spire', 0, e); A.play('eshot', e.x, e.y, .4); } },
    recover: .8,
  },
  // MIMIC: dormant chest that wakes when approached or hit
  mimic: {
    acts: {
      sleep: { score: e => e.a ? 0 : 1, run: e => { e.dvx = e.dvy = 0; if (e.dist < 70 || e.hp < e.maxHp) { e.a = 1; e.inv = 0; A.play('roar', e.x, e.y, .4, 2); trauma(.2); wtext(e.x, e.y - 24, 'MIMIC!', '#ffcf5a', 12); e.cd = .5; } } },
      hunt: { score: e => e.a ? .6 : 0, run: e => { flowTo(e, eSpeed(e)); if (canShoot(e) && e.los) startAttack(e, e.def.wind, rnd() < .5 ? 'bite' : 'ring', 'growl', 1.3); } },
    },
    init: e => { e.noTele = true; e.spawnT = 0; },
    fire: e => { if (e.atkKind === 'bite') { const a = e.angTo; e.vx = cos(a) * 520; e.vy = sin(a) * 520; e.lungeT = .25; e.contact = e.def.dmg; e.atkT = .25; e.lockAng = true; }
      else { for (let i = 0; i < 16; i++) eShot(e.x, e.y, i / 16 * TAU + e.bob, e.def.bspd, eDmg(e, 12), 5, 'Mimic', 3, e); A.play('eshotBig', e.x, e.y, .6); } },
    active: (e, dt) => { if (e.lungeT > 0) { e.lungeT -= dt; e.dvx = e.vx; e.dvy = e.vy; } },
  },
  // GEL: hops at you; splits on death
  gel: {
    acts: { hop: { score: e => .5, run: e => { e.dvx = e.dvy = 0; if (e.dist > 500) flowTo(e, eSpeed(e) * .5); else if (canShoot(e)) startAttack(e, e.def.wind * (e.size === 0 ? .6 : 1), 'hop', null); } } },
    windup: (e, dt, f) => { e.squash = -.35 * f; },
    fire: e => { let a; if (e.los) a = leadAim(e, e.x, e.y, e.def.hop, .9, .5); else { G.room.flow.dir(e.x, e.y); a = atan2(_fy, _fx); } const s = e.def.hop * (1.3 - e.size * .15); e.vx = cos(a) * s; e.vy = sin(a) * s; e.lungeT = .35; e.atkT = .35; e.contact = e.def.dmg; e.squash = .4; },
    active: (e, dt) => { e.lungeT -= dt; e.dvx = e.vx * .97; e.dvy = e.vy * .97; },
    recover: .25,
  },
  // WISP: flying harasser; orbits at range ignoring cover
  wisp: {
    acts: { orbit: { score: e => .5, run: e => { strafeAround(e, e.def.range, eSpeed(e)); if (e.los && canShoot(e) && tokenOk(e, 'ranged')) startAttack(e, e.def.wind, 'shot', 'wind', 1.8); } } },
    fire: e => { e.atkT = .2; e.b = 0; e.c = 0; },
    active: (e, dt) => { e.c -= dt; strafeAround(e, e.def.range, eSpeed(e) * .5); if (e.c <= 0 && e.b < 2) { e.c = .14; e.b++; const a = leadAim(e, e.x, e.y, e.def.bspd); eShot(e.x, e.y, a, e.def.bspd, eDmg(e, e.def.dmg), 4, 'Wisp', 0, e); A.play('eshot', e.x, e.y, .3, 1.4); } },
    recover: .2,
  },
  // JUGGERNAUT: armoured advance, ground slam with shockwave ring
  brute: {
    acts: { push: { score: e => .5, run: e => { flowTo(e, eSpeed(e)); if (e.dist < 115 && canShoot(e) && tokenOk(e, 'melee')) { startAttack(e, e.def.wind, 'slam', 'growl', .7); e.tl = tele('circle', e.x, e.y, e.def.slamR, 0, e.def.wind, '#ff3b3b', 0, e); } } } },
    init: e => { e.mass = 6; },
    windup: (e, dt, f) => { e.dvx = e.dvy = 0; e.squash = -.3 * f; if (e.tl) { e.tl.x = e.x; e.tl.y = e.y; } },
    fire: e => { A.play('slam', e.x, e.y); trauma(.4); ring(e.x, e.y, e.def.slamR, ci(e.col), .4, 6); burst(e.x, e.y, 24, ci(e.col), 300, .5, 4, PK.SHARD); decal('scorch', e.x, e.y, 50, null, .5);
      const p = G.player; if (dist2(p.x, p.y, e.x, e.y) < (e.def.slamR + p.r * .5) ** 2) hurtPlayer(eDmg(e, e.def.dmg), 'Juggernaut', e.x, e.y);
      const n = 18, o = rnd() * TAU; for (let i = 0; i < n; i++) if (i % 6 !== 0) eShot(e.x, e.y, o + i / n * TAU, e.def.bspd, eDmg(e, 12), 5, 'Juggernaut', 0, e); },
    recover: .9,
  },
};
// anti-stall: any walker that has lost the player for 5s pushes in along the flow field
const HUNT = { score: e => (e.spd !== 0 && e.def.spd > 0 && G.time - e.lastLosT > 5 && !e.boss) ? 2 : 0, run: e => flowTo(e, eSpeed(e)) };
for (const k in BRAINS) if (k !== 'turret' && k !== 'mimic') BRAINS[k].acts.hunt = HUNT;
// brains with a per-tick hook (attack decisions outside actions)
for (const k in BRAINS) { const br = BRAINS[k]; if (br.tick) for (const a in br.acts) { const r0 = br.acts[a].run; br.acts[a] = Object.assign({}, br.acts[a], { run: (e, dt) => { r0(e, dt); br.tick(e, dt); } }); } }
const MORTARS = []; // visual arcs for mortar shells

// =====================================================================================
// TACTICIAN — squad coordination: roles, attack tokens, pack rushes, adaptation
// =====================================================================================
const TAC = {
  t: 0, ranged: 0, melee: 0, maxR: 3, maxM: 2, rushing: false, rushUntil: 0, packSize: 0, front: 0, spread: 1, flush: false, intercept: false, turtle: 0, kite: 0,
  centroid: { x: 0, y: 0, n: 0 }, healers: 0, healer: null, tank: null, waitStart: 0,
  reset() { this.ranged = this.melee = 0; this.rushing = false; this.turtle = this.kite = 0; this.flush = this.intercept = false; this.waitStart = G.time; },
  grant(e, kind) { const b = G.run.biome; if (kind === 'ranged') { if (this.ranged >= T.ai.tokensRanged[b] + (G.run.heat > 5 ? 1 : 0)) return false; this.ranged++; } else { if (this.melee >= T.ai.tokensMelee[b]) return false; this.melee++; } e.token = kind; return true; },
  release(e) { if (!e.token) return; if (e.token === 'ranged') this.ranged = max(0, this.ranged - 1); else this.melee = max(0, this.melee - 1); e.token = 0; },
  protectee(e) { let best = null, bd = 1e9; for (const o of G.enemies) { if (o.dead || o === e || !(o.def.b === 'gunner' || o.def.b === 'sniper') || !o.los) continue; const d = dist2(o.x, o.y, e.x, e.y); if (d < bd) { bd = d; best = o; } } return bd < 300 * 300 ? best : null; },
  update(dt) {
    const p = G.player, E = G.enemies;
    // adaptation metrics (EMA)
    const k = T.ai.adaptRate * dt, sp = hypot(p.vx, p.vy);
    this.turtle = lerp(this.turtle, p.still > 2.2 ? 1 : 0, k); this.kite = lerp(this.kite, sp > T.ai.kiteSpd ? 1 : 0, k);
    this.flush = this.turtle > .5; this.intercept = this.kite > .55;
    this.t -= dt; if (this.t > 0) return; this.t = .25;
    // recount tokens (robust against deaths mid-attack)
    let r = 0, m = 0; for (const e of E) if (!e.dead && e.token) { if (e.token === 'ranged') r++; else m++; } this.ranged = r; this.melee = m;
    // centroid & front
    let cx = 0, cy = 0, n = 0, staged = 0, healers = 0, tank = null, healer = null;
    for (const e of E) { if (e.dead || e.spawnT > 0) continue; cx += e.x; cy += e.y; n++;
      if (e.def.b === 'swarm' && e.act === 'wait' && e.dist < 340) staged++;
      if (e.def.b === 'healer') { healers++; healer = e; } if ((e.def.b === 'shield' || e.def.b === 'brute') && !tank) tank = e; }
    this.centroid.n = n; if (n) { this.centroid.x = cx / n; this.centroid.y = cy / n; this.front = atan2(this.centroid.y - p.y, this.centroid.x - p.x); }
    this.healers = healers; this.healer = healer; this.tank = tank; this.packSize = staged;
    // pack rush: enough staged melee or they've waited long enough (faster if the player is turtling)
    if (this.rushing && G.time > this.rushUntil) { this.rushing = false; this.waitStart = G.time; }
    if (!this.rushing && staged > 0 && (staged >= T.ai.rushPack || G.time - this.waitStart > T.ai.rushWait * (this.flush ? .5 : 1))) { this.rushing = true; this.rushUntil = G.time + 3.2; if (staged >= 3) A.play('growl', this.centroid.x, this.centroid.y, .3, 2); }
    if (!staged && !this.rushing) this.waitStart = G.time;
    // roles: ranged units nearest the front pin, the rest flank left/right (pincer when kiting)
    const ranged = []; for (const e of E) if (!e.dead && e.spawnT <= 0 && (e.def.b === 'gunner' || e.def.b === 'wisp')) ranged.push(e);
    if (ranged.length) {
      let ref = this.front; if (this.intercept && sp > 30) ref = atan2(p.vy, p.vx) + PI; // pincer around the player's heading
      ranged.sort((a, b) => abs(angDiff(ref, atan2(a.y - p.y, a.x - p.x))) - abs(angDiff(ref, atan2(b.y - p.y, b.x - p.x))));
      const pins = max(1, ceil(ranged.length * (this.intercept ? .3 : .45)));
      ranged.forEach((e, i) => { e.role = i < pins ? ROLE.PIN : (angDiff(ref, atan2(e.y - p.y, e.x - p.x)) < 0 ? ROLE.FLANK_L : ROLE.FLANK_R); });
      if (ranged.length >= 3 && !ranged.some(e => e.role === ROLE.FLANK_L)) ranged[ranged.length - 1].role = ROLE.FLANK_L;
      if (ranged.length >= 3 && !ranged.some(e => e.role === ROLE.FLANK_R)) ranged[ranged.length - 2].role = ROLE.FLANK_R;
    }
    for (const e of E) { if (e.def.b === 'sniper') e.role = ROLE.SNIPE; else if (e.def.b === 'healer') e.role = ROLE.GUARD; }
    // spread formation against AoE builds
    const w = curWeapon(p).def, aoe = (B.explode || B.explodeR || w.exp || w.k === 'arc' || B.shockChance > .2 || w.k === 'beam') ? .45 : 0;
    this.spread = 1 + aoe;
  },
};

// =====================================================================================
// DIRECTOR — pacing: stress model, BUILD → PEAK → RELAX, wave composition
// =====================================================================================
const DIRECTOR = {
  stress: 0, phase: 0, phaseT: 0, budget: 0, spent: 0, waveT: 0, active: false, kills: 0, killRate: 0, history: new Float32Array(240), hi: 0, histT: 0,
  start(room) {
    const run = G.run, node = room.node, D = T.director;
    let budget = (D.budget + node.layer * D.perLayer) * pow(D.biomeMul, run.biome) * (room.type === 'elite' ? D.eliteMul : 1) * (run.heat > 5 ? 1.25 : 1) * clamp(run.perf, .85, 1.2);
    if (room.type === 'challenge') budget = 1e9;
    this.budget = budget; this.spent = 0; this.stress = 0; this.phase = 0; this.phaseT = 0; this.waveT = .6; this.active = true; this.kills = 0; this.killRate = 0;
    this.elites = room.type === 'elite' ? 2 + (run.biome >= 2 ? 1 : 0) : 0; this.challengeT = room.type === 'challenge' ? D.challengeTime : 0;
    if (room.type === 'challenge') toast('SURVIVE', `${D.challengeTime} seconds`);
  },
  onPlayerHurt(d) { this.stress += d * T.director.stressDmg; },
  onKill(e) { this.kills++; this.killRate += 1; },
  aliveCost() { let c = 0; for (const e of G.enemies) if (!e.dead && !e.boss) c += e.def.cost || 1; return c; },
  update(dt) {
    // stress graph for debug overlay
    this.histT -= dt; if (this.histT <= 0) { this.histT = .1; this.history[this.hi++ % 240] = this.stress; }
    if (!this.active) return; const D = T.director, p = G.player, run = G.run;
    let near = 0; for (const e of G.enemies) if (!e.dead && dist2(e.x, e.y, p.x, p.y) < 200 * 200) near++;
    this.killRate *= exp(-dt / 4);
    this.stress = max(0, this.stress + (near * .012 + (1 - p.hp / p.maxHp) * .03 - this.killRate * .004) * dt - D.stressDecay * dt * (this.phase === 2 ? 2 : 1));
    this.phaseT += dt; const alive = this.aliveCost();
    const isCh = G.room.type === 'challenge';
    if (isCh) { this.challengeT -= dt; if (this.challengeT <= 0) { this.active = false; for (const e of G.enemies) if (!e.dead) { e.noDrop = true; killEnemy(e, DMG.ENV); } return; } }
    if (this.phase === 0) { // BUILD
      this.waveT -= dt;
      const cap = T.director.maxAlive[run.biome] * (isCh ? 3 : 1);
      if (this.spent < this.budget && (this.waveT <= 0 || alive < 3) && alive < cap) this.spawnWave();
      if (this.stress > D.peakStress && !isCh) { this.phase = 1; this.phaseT = 0; }
    } else if (this.phase === 1) { // PEAK: hold, no new waves unless the room empties
      if (this.phaseT > D.peakTime || alive < 2) { this.phase = 2; this.phaseT = 0; }
    } else { // RELAX
      if (this.phaseT > D.relaxTime && this.stress < D.relaxStress || this.phaseT > D.relaxTime * 2.5 || alive === 0) { this.phase = 0; this.phaseT = 0; this.waveT = .3; }
    }
    MUS.setIntensity(this.phase === 1 ? 3 : this.phase === 0 ? (alive > 6 ? 2.6 : 2) : 1.4);
    if (this.spent >= this.budget && G.alive === 0) { this.active = false; }
  },
  pool() {
    const run = G.run, pool = Object.assign({}, T.BIO[run.biome].pool);
    if (TAC.flush) for (const k of ['lobber', 'tick', 'phantom']) if (pool[k]) pool[k] *= 2;
    if (TAC.intercept) for (const k of ['wisp', 'ram', 'mite']) if (pool[k]) pool[k] *= 1.6;
    if (G.room.type === 'challenge') return { mite: 6, tick: 2, wisp: 1, gunner: 1 };
    return pool;
  },
  spawnWave() {
    const run = G.run, D = T.director, room = G.room, p = G.player, pool = this.pool(), rng = run.rng;
    let waveBudget = max(4, this.budget * D.waveFrac * (this.stress < .2 ? 1.2 : 1)); if (room.type === 'challenge') waveBudget = 10 + G.time % 10;
    // pick an anchor spawn point at a fair distance, then cluster around it (squad spawns)
    const cand = room.spawns.filter(s => { const d = hypot(s.x - p.x, s.y - p.y); return d > D.minSpawnDist && d < 700; });
    if (!cand.length) return; let anchor = rng.pick(cand), spent = 0, n = 0;
    while (spent < waveBudget && this.spent < this.budget && n < 14) {
      const type = rng.weighted(pool), def = T.E[type]; if (type === 'spire' && G.enemies.some(e => e.type === 'spire' && !e.dead)) continue;
      const pts = cand.filter(s => dist2(s.x, s.y, anchor.x, anchor.y) < 180 * 180), sp = pts.length ? rng.pick(pts) : rng.pick(cand);
      if (rng.chance(.25)) anchor = rng.pick(cand);
      let elite = null; const ech = T.elite.chance * (1 + run.biome * .4) * (run.heat > 1 ? 2 : 1);
      if ((this.elites > 0 && n === 0) || (def.cost >= 3 && rng.chance(ech))) { if (this.elites > 0) this.elites--; elite = [rng.pick(T.elite.mods)]; if (run.biome >= 2 && rng.chance(.35)) { const m2 = rng.pick(T.elite.mods); if (!elite.includes(m2)) elite.push(m2); } }
      if (type === 'mite') { for (let i = 0; i < 3; i++) spawnEnemy('mite', sp.x + rr(-20, 20), sp.y + rr(-20, 20), { elite: i === 0 ? elite : null }); }
      else spawnEnemy(type, sp.x, sp.y, { elite });
      const c = def.cost * (type === 'mite' ? 3 : 1) * (elite ? 2.2 : 1); spent += c; this.spent += c; n++;
    }
    this.waveT = rr(5, 8);
  },
};
