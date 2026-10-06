// =====================================================================================
// SECTION 6 — ENTITIES: player, bullets, damage, status, explosions, pickups, props, zones
// =====================================================================================
const DMG = { BULLET: 1, DOT: 2, SHOCK: 4, EXPL: 8, SUMMON: 16, MELEE: 32, ENV: 64 };
let B = null; // current build (stats from upgrades), see newBuild()
let _eid = 1;

// ---- bullets (pooled, fixed shape) ------------------------------------------------------------------
class Bullet {
  constructor() { this.reset(); }
  reset() {
    this.x = this.y = this.px = this.py = this.vx = this.vy = 0; this.r = 3; this.dmg = 0; this.life = 1; this.age = 0; this.team = 0; this.shape = 0; this.col = 0;
    this.crit = false; this.pierce = 0; this.bounce = 0; this.bounces = 0; this.homing = 0; this.split = 0; this.splitDepth = 0; this.isFrag = false; this.explode = 0; this.expDmg = 0;
    this.burn = 0; this.chill = 0; this.shock = 0; this.poison = 0; this.kb = 0; this.src = ''; this.ret = 0; this.acc = 0; this.maxSpd = 0; this.drag = 0; this.mine = 0; this.armT = 0;
    this.forked = false; this.dist = 0; this.h0 = this.h1 = this.h2 = this.h3 = 0; this.hn = 0; this.ebounce = 0; this.grazed = false; this.owner = null; this.dead = false;
    this.w = null; this.lastHit = 0; this.zapT = 0; this.wallPass = -1; this.curve = 0; this.delay = 0; this.wave = 0; this.waveA = 0; this.baseAng = 0; this.big = false; this.phase = false; this.pierced = 0; this.critBonus = 0; this.lightning = 0; this.seek = false; this.missile = false; this.summon = false; this.spd0 = 0;
  }
  hitBefore(id) { return this.h0 === id || this.h1 === id || this.h2 === id || this.h3 === id; }
  markHit(id) { switch (this.hn++ & 3) { case 0: this.h0 = id; break; case 1: this.h1 = id; break; case 2: this.h2 = id; break; default: this.h3 = id; } }
}
const BPOOL = []; for (let i = 0; i < 2500; i++) BPOOL.push(new Bullet());
function newBullet(team) { const b = BPOOL.pop() || new Bullet(); b.reset(); b.team = team; (team === 0 ? G.bullets : G.ebullets).push(b); return b; }
function freeBullet(list, i) { const b = list[i]; list[i] = list[list.length - 1]; list.pop(); BPOOL.push(b); }
// enemy bullet helper: shape 0 orb, 1 big orb, 2 needle, 3 alt colour orb
function eShot(x, y, ang, spd, dmg, r = 4.5, src = 'bullet', shape = 0, owner = null) {
  const b = newBullet(1), hs = G.run ? 1 + (G.run.heat > 2 ? .12 : 0) : 1;
  b.x = b.px = x; b.y = b.py = y; b.vx = cos(ang) * spd * hs; b.vy = sin(ang) * spd * hs; b.r = r; b.dmg = dmg; b.life = 6; b.src = src; b.shape = shape; b.owner = owner; b.baseAng = ang; b.spd0 = spd * hs;
  return b;
}

// ---- build ---------------------------------------------------------------------------------------
function newBuild() {
  const b = { syn: {}, fam: {}, picks: {} };
  for (const row of UPG_ROWS) for (const k in row[5]) b[k] = 0;
  for (const k of ['dmg', 'rate', 'reload', 'mag', 'pspd', 'range', 'size', 'spread', 'kb', 'crit', 'critDmg', 'speed', 'dashCd', 'maxHp', 'luck', 'gold', 'pickup', 'enemyHp', 'enemySpd', 'dmgTaken', 'maxHpPct']) b[k] = b[k] || 0;
  return b;
}
const burnDps = () => (T.ST.burnDps + B.burnAdd) * (1 + B.burnPct + (G.run.char === 'ember' ? .25 : 0));
const freezeDur = () => T.ST.freezeDur + B.freezeAdd;
const poisonMax = () => T.ST.poisonMax + B.poisonMaxAdd;
const poisonDps = () => T.ST.poisonDps + B.poisonDpsAdd;
const shockDmg = () => T.ST.shockDmg * (1 + B.shockPct);
const shockJumps = () => T.ST.shockJumps + B.shockAdd;
const expMul = () => 1 + B.expDmg, expRad = () => 1 + B.expRad;
const famCount = f => B.fam[f] || 0;

// ---- player -------------------------------------------------------------------------------------------
function makePlayer(run) {
  const ch = T.CH[run.char];
  return {
    x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, r: T.player.r, ang: 0, hp: run.hp, maxHp: run.maxHp, dead: false, deadT: 0,
    dashT: 0, dashCd: 0, dashCharges: 1, dashDx: 0, dashDy: 0, iframe: 0, hitT: 0, ghosts: [], ghostT: 0,
    abilityCd: 0, recX: 0, recY: 0, squash: 0, bob: 0, flash: 0, muzzle: 0, shots: 0, hits: 0, still: 0, moveT: 0,
    buffs: { dmg: 0, rate: 0, crit: 0, overdrive: 0, aegis: 0, adren: 0 }, cascade: 0, cascadeT: 0, autoCrit: 0, reloadCrits: 0,
    shield: run.char === 'bastion' ? 20 : 0, shieldMax: run.char === 'bastion' ? 20 : 0, shieldT: 0, barrierT: 0, phoenixUsed: false, teslaT: 0, killsForNuke: 0, voltCount: 0, color: ch.col,
  };
}
function updatePlayer(dt) {
  const p = G.player, run = G.run, ch = T.CH[run.char], TP = T.player;
  p.px = p.x; p.py = p.y;
  if (p.dead) { p.deadT += dt; p.vx *= .9; p.vy *= .9; return; }
  for (const k in p.buffs) if (p.buffs[k] > 0) p.buffs[k] -= dt;
  if (p.cascadeT > 0 && (p.cascadeT -= dt) <= 0) p.cascade = 0;
  p.flash = max(0, p.flash - dt); p.muzzle = max(0, p.muzzle - dt); p.hitT = max(0, p.hitT - dt); p.iframe = max(0, p.iframe - dt);
  p.recX *= exp(-dt * 18); p.recY *= exp(-dt * 18); p.squash *= exp(-dt * 12);
  // aim
  if (IN.padAim) { let a = IN.aimAng; if (G.settings.aimAssist) a = aimAssist(p, a); p.ang = a; } else p.ang = atan2(IN.wy - p.y, IN.wx - p.x);
  // dash charges
  const dmax = 1 + (B.dashCharges | 0) + (run.char === 'wraith' ? 1 : 0), dcd = TP.dashCd * max(.3, 1 - B.dashCd);
  if (p.dashCharges < dmax) { p.dashCd -= dt; if (p.dashCd <= 0) { p.dashCharges++; p.dashCd = p.dashCharges < dmax ? dcd : 0; } }
  let mx = IN.moveX, my = IN.moveY; if (G.bot) { mx = BOT.mx; my = BOT.my; }
  if (IN.take('dash') || (G.bot && BOT.dash)) { BOT.dash = false; if (p.dashCharges > 0 && p.dashT <= 0) startDash(p, mx, my, dcd); }
  const hz = hazardAt(p.x, p.y), onIce = hz && hz.k === 'ice';
  if (p.dashT > 0) {
    p.dashT -= dt; const s = TP.dashSpeed * (p.dashT > TP.dashTime * .3 ? 1 : .55); p.vx = p.dashDx * s; p.vy = p.dashDy * s;
    p.ghostT -= dt; if (p.ghostT <= 0) { p.ghostT = .022; p.ghosts.push({ x: p.x, y: p.y, a: p.ang, t: .22 }); }
    dashTrails(p, dt);
  } else {
    let spd = TP.speed * ch.spd * max(.3, 1 + B.speed); const w = curWeapon(p);
    if (w.def.slow && IN.down.fire && w.spin > .1) spd *= w.def.slow;
    if (w.def.k === 'bow' && w.charge > 0) spd *= .75;
    const tvx = mx * spd, tvy = my * spd, acc = TP.accel * (onIce ? T.haz.ice.friction : 1), fr = TP.friction * (onIce ? T.haz.ice.friction : 1);
    const ax = tvx - p.vx, ay = tvy - p.vy, al = hypot(ax, ay), k = (mx || my) ? acc * dt : al * min(1, fr * dt);
    if (al > 0) { const s = min(al, k) / al; p.vx += ax * s; p.vy += ay * s; }
  }
  p.x += p.vx * dt; p.y += p.vy * dt; collideTiles(p, p.r, false, true);
  const sp = hypot(p.vx, p.vy); p.bob += dt * sp * .05; p.moveT = sp > 60 ? min(1, p.moveT + dt) : max(0, p.moveT - dt * 2);
  p.still = sp < T.ai.turtleSpd ? p.still + dt : max(0, p.still - dt * 2);
  for (let i = p.ghosts.length - 1; i >= 0; i--) if ((p.ghosts[i].t -= dt) <= 0) p.ghosts.splice(i, 1);
  // hazards
  if (hz && p.dashT <= 0) playerHazard(p, hz, dt);
  // shields
  if (p.shieldMax > 0) { p.shieldT -= dt; if (p.shieldT <= 0 && p.shield < p.shieldMax) p.shield = min(p.shieldMax, p.shield + dt * 6); }
  if (B.barrier && p.barrierT > 0) { p.barrierT -= dt; if (p.barrierT <= 0) { A.play('ready'); ring(p.x, p.y, 22, ci('#7fdcff'), .4); } }
  // weapons / abilities / actives
  updateWeapons(p, dt);
  if ((IN.take('ability') || (G.bot && BOT.ability)) && p.abilityCd <= 0) { BOT.ability = false; useAbility(p); p.abilityCd = ch.cd; }
  else if (p.abilityCd > 0) { const was = p.abilityCd; p.abilityCd -= dt; if (was > 0 && p.abilityCd <= 0) A.play('ready'); }
  for (let i = 0; i < 2; i++) { const a = run.actives[i]; if (!a) continue; if (a.cd > 0) a.cd -= dt; if (IN.take(i ? 'act2' : 'act1') && a.cd <= 0) { useActive(p, a); } }
  if (IN.take('swap') && run.weapons.length > 1) swapWeapon(p);
  if (IN.take('interact')) interact(p);
  updatePassives(p, dt);
  // exit through open door
  if (G.room.open && p.y < TS * 1.05 && abs(p.x - (G.room.exitDoor.x + 1) * TS) < TS * 1.2) leaveRoom();
}
function startDash(p, mx, my, dcd) {
  if (!mx && !my) { mx = cos(p.ang); my = sin(p.ang); } const l = hypot(mx, my); p.dashDx = mx / l; p.dashDy = my / l;
  p.dashT = T.player.dashTime; p.iframe = T.player.dashIframe; if (p.dashCharges === 1 + (B.dashCharges | 0) + (G.run.char === 'wraith' ? 1 : 0)) p.dashCd = dcd; p.dashCharges--;
  p.squash = .35; p.grazedThisDash = false; A.play('dash', p.x, p.y, .8); spray(p.x, p.y, atan2(-p.dashDy, -p.dashDx), .9, 10, ci(p.color), 260, .3, 3);
  G.run.stats.dashes++;
  if (B.syn.assassin) p.autoCrit = 3;
  if (B.dashFrost) { ring(p.x, p.y, 100, C_ICE, .4, 4); forEnemiesNear(p.x, p.y, 100, e => addChill(e, B.dashFrost)); A.play('shatter', p.x, p.y, .4, .6); }
  if (B.dashShock) { let n = B.dashShock; forEnemiesNear(p.x, p.y, 170, e => { if (n-- > 0) { beamFx(p.x, p.y, e.x, e.y, '#c39bff', 2, .15, 14); hurtEnemy(e, 25, DMG.SHOCK); } }); A.play('zap', p.x, p.y); }
  if (B.syn.stormcaller) { let n = 3; forEnemiesNear(p.x, p.y, 260, e => { if (n-- > 0) { beamFx(e.x, e.y - 300, e.x, e.y, '#d8c2ff', 4, .25, 30); hurtEnemy(e, 40, DMG.SHOCK); flashLight(e.x, e.y, 120, '#b98bff', .15); } }); }
  if (B.dashBomb) { const b = newBullet(0); b.x = b.px = p.x; b.y = b.py = p.y; b.life = .6; b.r = 6; b.shape = 6; b.explode = 70 * expRad(); b.expDmg = T.ST.bombDmg * expMul(); b.src = 'bomb'; b.pierce = 99; b.mine = 2; }
  if (B.dashAcid) addZone('acid', p.x, p.y, 40, 3, 0);
}
function dashTrails(p, dt) {
  p.trailT = (p.trailT || 0) - dt; if (p.trailT > 0) return; p.trailT = .03;
  if (B.dashFire) addZone('fire', p.x, p.y, B.syn.wildfire ? 28 : 18, T.ST.dashFireDur, B.dashFire);
}
function playerHazard(p, hz, dt) {
  const H = T.haz;
  if (hz.k === 'lava' && G.run.char !== 'ember') { hurtPlayer(H.lava.dps * .5, 'Lava'); }
  else if (hz.k === 'elec' && hz.st === 2) hurtPlayer(H.elec.dmg, 'Electric Floor');
  else if (hz.k === 'spike') { stepHazard(hz); if (hz.st === 2) hurtPlayer(H.spike.dmg, 'Spike Trap'); }
  else if (hz.k === 'acid') { p.acidT = (p.acidT || 0) + dt; if (p.acidT > .8) { p.acidT = 0; hurtPlayer(6, 'Acid Pool'); } }
}
function aimAssist(p, a) {
  let best = null, bs = .18;
  for (const e of G.enemies) { if (e.dead || e.spawnT > 0 || e.burrowed) continue; const d = hypot(e.x - p.x, e.y - p.y); if (d > 480) continue;
    const da = abs(angDiff(a, atan2(e.y - p.y, e.x - p.x))); const s = da + d / 4000; if (da < .2 && s < bs) { bs = s; best = e; } }
  return best ? lerpAng(a, atan2(best.y - p.y, best.x - p.x), .65) : a;
}
function hurtPlayer(dmg, src, x, y) {
  const p = G.player; if (!p || p.dead || p.hitT > 0 || p.dashT > 0 || p.iframe > 0 || G.cam.focusT > 0 || G.godMode) return false;
  if (B.barrier && p.barrierT <= 0) { p.barrierT = T.ST.barrierCd; p.hitT = .5; A.play('shieldhit', p.x, p.y); ring(p.x, p.y, 30, ci('#7fdcff'), .4, 4); burst(p.x, p.y, 16, C_ICE, 200, .4, 3); hitstop(.03); return false; }
  const run = G.run; dmg *= (1 + B.dmgTaken) * (run.heat > 4 ? 1.2 : 1) * (run.char === 'bastion' ? .85 : 1) * (G.settings.assist ? .5 : 1);
  if (p.shield > 0) { const a = min(p.shield, dmg); p.shield -= a; dmg -= a; p.shieldT = 3; if (dmg <= 0) { p.hitT = .4; A.play('shieldhit', p.x, p.y, .7); ring(p.x, p.y, 26, ci('#5dff8a'), .3); return true; } }
  p.hp -= dmg; p.hitT = T.player.hitIframe; p.flash = .12; run.stats.dmgTaken += dmg; run.roomHit = true;
  run.recap.push({ src, dmg: round(dmg), t: G.time, hp: max(0, round(p.hp)) }); if (run.recap.length > 8) run.recap.shift();
  DIRECTOR.onPlayerHurt(dmg);
  A.play('hurt', p.x, p.y); trauma(.55); hitstop(.06); aberrate(T.fx.abberation * 1.6); screenFlash(.12);
  burst(p.x, p.y, 18, C_RED, 260, .45, 3); ring(p.x, p.y, 34, C_RED, .3, 3); wtext(p.x, p.y - 14, '-' + round(dmg), '#ff5470', 11, .8, -45);
  if (B.hurtFreeze) { ring(p.x, p.y, 140, C_ICE, .5, 5); forEnemiesNear(p.x, p.y, 140, e => freeze(e, freezeDur())); A.play('shatter', p.x, p.y); }
  if (p.hp <= 0) {
    if (B.phoenix && !p.phoenixUsed) { p.phoenixUsed = true; p.hp = p.maxHp * .4; p.hitT = 2; explode(p.x, p.y, 180, 120, 0, 'Phoenix'); addZone('fire', p.x, p.y, 120, 3, 25);
      toast('PHOENIX HEART', 'Reborn in fire'); slowmo(.3, .8); return true; }
    playerDie(src);
  }
  return true;
}
function healPlayer(v, force = false) {
  const p = G.player; if (!p || p.dead || (B.noHeal && !force)) return; const h = min(v, p.maxHp - p.hp); if (h <= 0) return;
  p.hp += h; wtext(p.x, p.y - 16, '+' + round(h), '#5dff8a', 10, .8, -40); burst(p.x, p.y, 8, C_HEAL, 120, .5, 2, PK.DOT);
}
function playerDie(src) {
  const p = G.player; p.dead = true; p.hp = 0; G.run.killedBy = src; A.stopLoops();
  A.play('death'); MUS.stinger('death'); MUS.setIntensity(0); slowmo(.2, 1.6); trauma(1); screenFlash(.5); aberrate(.02);
  burst(p.x, p.y, 60, ci(p.color), 420, 1.2, 4, PK.SHARD, 2); burst(p.x, p.y, 40, C_WHITE, 500, .8, 3); ring(p.x, p.y, 120, ci(p.color), .8, 6);
  addTimer(2.2, () => endRun(false));
}

// ---- damage to enemies --------------------------------------------------------------------------------------
function hurtEnemy(e, dmg, kind, crit = false, kx = 0, ky = 0) {
  if (e.dead || e.spawnT > 0 || e.inv > 0 || e.burrowed) return 0;
  if (e.frozenT > 0) dmg *= 1 + B.brittle;
  if (e.poison > 0) dmg *= 1 + B.corrode * e.poison;
  if (e.buffT > 0) dmg *= 1 - T.E.warden.buffDef;
  if (kind & DMG.SHOCK && e.poison > 0 && B.syn.electrolysis) dmg *= 1.5;
  if (e.armor && !(kind & DMG.DOT)) { const d0 = dmg; dmg = max(dmg * .25, dmg - e.armor); if (d0 - dmg > 1 && rnd() < .3) A.play('armor', e.x, e.y, .4); }
  if (e.shield > 0) { const a = min(e.shield, dmg); e.shield -= a; dmg -= a; e.shieldT = T.elite.shielded.regen; if (e.shield <= 0) { ring(e.x, e.y, e.r * 1.6, ci('#58a8ff'), .3, 3); A.play('shatter', e.x, e.y, .5, 1.3); } if (dmg <= 0) return a; }
  e.hp -= dmg; G.run.stats.dmgDealt += dmg; e.lastHitT = G.time;
  if (!(kind & DMG.DOT)) { e.flash = .07; e.squash = .25; }
  if (kx || ky) { const m = e.boss ? 0 : 1 / (e.mass || 1); e.kbx += kx * m; e.kby += ky * m; }
  if (dmg >= 1 || crit) dmgNumber(e.x, e.y - e.r, dmg, crit, kind & DMG.DOT ? '#bfc8dc' : kind & DMG.SHOCK ? '#d8c2ff' : null);
  if (e.boss) BOSS.onHurt(e, dmg);
  if (e.hp <= 0) killEnemy(e, kind, crit);
  return dmg;
}
function killEnemy(e, kind, crit) {
  if (e.dead) return; e.dead = true; e.hp = 0;
  if (e.boss) { codexSee('boss', e.bossId); BOSS.onDeath(e); return; }
  const run = G.run, p = G.player, col = ci(e.col), big = e.r >= 14 || e.elite, def = e.def;
  run.stats.kills++; if (e.elite) run.stats.elites++; G.meta && (G.meta.stats.kills++);
  codexSee('enemy', e.type);
  // juice
  hitstop((big ? T.fx.hitstopHeavy : T.fx.hitstopKill) * (e.boss ? 3 : 1)); trauma(big ? .3 : .12);
  burst(e.x, e.y, big ? 26 : 12, col, big ? 380 : 300, .6, big ? 5 : 3.5, PK.SHARD, 2.5); burst(e.x, e.y, big ? 18 : 9, C_WHITE, 420, .3, 3);
  ring(e.x, e.y, e.r * 2.6, col, .3, 3); flashLight(e.x, e.y, e.r * 9, e.col, .15, .9); decal('splat', e.x, e.y, e.r * 1.4, mixHex(e.col, '#000000', .55), .55);
  if (e.frozenT > 0) { A.play('shatter', e.x, e.y); burst(e.x, e.y, 14, C_ICE, 300, .5, 4, PK.SHARD, 2); } else A.play(big ? 'killbig' : 'kill', e.x, e.y, 1, big ? .8 : 1.15 - e.r * .01);
  // combo
  run.combo++; run.comboT = T.player.comboTime; run.stats.maxCombo = max(run.stats.maxCombo, run.combo);
  if (run.combo % 10 === 0 && run.combo > 0) { wtext(p.x, p.y - 26, run.combo + ' COMBO', '#ffe23a', 12, 1.1, -30); if (run.combo >= 50) unlockAch('combo50'); }
  // drops
  if (!e.noDrop) {
    const gold = (def.cost || 1) * T.gold.enemy * (e.elite ? T.gold.elite / 1.4 : 1) * (1 + B.gold) * (1 + min(run.combo, 30) * .01);
    dropGold(e.x, e.y, gold);
    const hpF = p.hp / p.maxHp, ch = .018 + (hpF < .35 ? .03 : 0) + (DIRECTOR.phase === 2 ? .02 : 0);
    if (!(G.run.heat > 9) && rnd() < ch * (e.elite ? 4 : 1)) dropPickup('heal', e.x, e.y, 8);
  }
  DIRECTOR.onKill(e);
  // on-kill effects
  if (B.killHeal) healPlayer(B.killHeal, true);
  if (run.char === 'wraith') { const dmax = 1 + (B.dashCharges | 0) + 1; if (p.dashCharges < dmax) { p.dashCharges++; } }
  if (e.burnT > 0 && B.burnExplode) explode(e.x, e.y, T.ST.burnExplodeR * expRad(), B.burnExplode * expMul(), 0, 'Combustion', true);
  if (e.burnT > 0 && run.char === 'ember') forEnemiesNear(e.x, e.y, 110, o => ignite(o, burnDps()));
  if (e.frozenT > 0 && B.shatter) { const n = B.shatter * (B.syn.cryoshards ? 2 : 1); for (let i = 0; i < n; i++) { const b = fragBullet(e.x, e.y, i / n * TAU + rnd() * .3, T.ST.shardDmg, 'Shatter'); b.chill = 20; b.col = 3; } }
  if (e.poison > 0) {
    if (B.poisonCloud) addZone('toxic', e.x, e.y, 60, 3, 0);
    if (B.poisonSpread) forEnemiesNear(e.x, e.y, 120, o => addPoison(o, ceil(e.poison * .6)));
    if (B.syn.plague) for (let i = 0; i < 3; i++) fragBullet(e.x, e.y, rnd() * TAU, 10, 'Plague').poison = 2;
    if (B.syn.hive && rnd() < .25) spawnGhost(e);
  }
  if (B.killSplit) for (let i = 0; i < B.killSplit; i++) fragBullet(e.x, e.y, i / B.killSplit * TAU, 12 * (1 + B.dmg), 'Cluster Kill');
  if (B.killExplode && rnd() < B.killExplode) explode(e.x, e.y, 60 * expRad(), 50 * expMul(), 0, 'Volatile', true);
  if (B.killSeeker) { const b = fragBullet(e.x, e.y, rnd() * TAU, T.ST.seekerDmg * (1 + B.dmg), 'Seeker'); b.homing = 9; b.life = 1.6; b.seek = true; b.vx *= .7; b.vy *= .7; }
  if (B.ghosts && rnd() < B.ghosts) spawnGhost(e);
  if (B.nuke) { p.killsForNuke++; if (p.killsForNuke >= T.ST.nukeKills) { p.killsForNuke = 0; nukeStrike(); } }
  // elite / special deaths
  if (e.mods) {
    if (e.mods.includes('splitting')) for (let i = 0; i < T.elite.splitting.n; i++) { const m = spawnEnemy(e.type === 'gel' ? 'gel' : 'mite', e.x + rr(-10, 10), e.y + rr(-10, 10), { noTele: true, size: e.type === 'gel' ? 1 : 0 }); m.hp = m.maxHp = max(10, e.maxHp * T.elite.splitting.hp / 2.6); }
    if (e.mods.includes('volatile')) { const v = T.elite.volatile; const t = tele('circle', e.x, e.y, v.r, 0, v.fuse, '#ff8a2b'); addTimer(v.fuse, () => explode(t.x, t.y, v.r, v.dmg, 2, 'Volatile Elite')); A.play('fuse', e.x, e.y); }
  }
  if (def.b === 'gel' && e.size > 0) for (let i = 0; i < 2; i++) spawnEnemy('gel', e.x + (i ? 8 : -8), e.y, { noTele: true, size: e.size - 1, vx: (i ? 1 : -1) * 160 });
  if (def.b === 'bomber') explode(e.x, e.y, def.blast, def.dmg, 2, 'Tick');
  if (e.parent) e.parent.kids--;
}
function dropGold(x, y, v) { v = round(v); while (v > 0) { const c = v >= 10 ? 5 : v >= 3 ? 2 : 1; v -= c; dropPickup('gold', x, y, c); } }

// ---- status effects ------------------------------------------------------------------------------------------
function ignite(e, dps, dur = T.ST.burnDur) {
  if (e.dead) return; if (e.frozenT > 0 && B.syn.thermal) { e.frozenT = 0; e.chill = 0; explode(e.x, e.y, 55, 60 * (1 + B.dmg), 0, 'Thermal Shock', true); burst(e.x, e.y, 16, C_ICE, 320, .5, 4, PK.SHARD); }
  e.burnT = max(e.burnT, dur); e.burnDps = max(e.burnDps, dps);
}
function addChill(e, v) {
  if (e.dead || e.frozenT > 0) return; e.chill += v;
  if (e.chill >= T.ST.chillMax) { e.chill = 0; if (e.boss) { e.chill = T.ST.chillMax * .5; return; } freeze(e, freezeDur()); }
}
function freeze(e, d) { if (e.boss || e.dead) return; e.frozenT = d; e.atkPhase = 0; A.play('shatter', e.x, e.y, .35, 1.6); burst(e.x, e.y, 8, C_ICE, 140, .4, 2.5, PK.SHARD); }
function addPoison(e, n) { if (e.dead) return; e.poison = min(poisonMax(), e.poison + n); e.poisonT = T.ST.poisonDecay; }
function updateStatus(e, dt) {
  if (e.burnT > 0) { e.burnT -= dt; e.burnAcc += e.burnDps * dt; e.fxT -= dt; if (e.fxT <= 0) { e.fxT = .07; emit(PK.DOT, e.x + rr(-e.r, e.r), e.y + rr(-e.r, e.r), rr(-20, 20), -rr(40, 90), .5, 2.2, rnd() < .5 ? C_FIRE : C_FIRE2, 2); } }
  if (e.poison > 0) { e.poisonAcc += e.poison * poisonDps() * dt; e.poisonT -= dt; if (e.poisonT <= 0) { e.poison--; e.poisonT = T.ST.poisonDecay; } if (rnd() < dt * 6) emit(PK.DOT, e.x + rr(-e.r, e.r), e.y, 0, -30, .6, 2, C_POISON, 1); }
  if (e.chill > 0) e.chill = max(0, e.chill - T.ST.chillDecay * dt);
  if (e.frozenT > 0) e.frozenT -= dt;
  if (e.stunT > 0) e.stunT -= dt;
  // dot ticks at 4 Hz
  e.dotT -= dt; if (e.dotT <= 0) { e.dotT = .25; const d = e.burnAcc + e.poisonAcc; e.burnAcc = e.poisonAcc = 0; if (d > 0) hurtEnemy(e, d, DMG.DOT); }
  if (e.shieldMax > 0 && e.shield < e.shieldMax) { e.shieldT -= dt; if (e.shieldT <= 0) e.shield = min(e.shieldMax, e.shield + e.shieldMax * dt * .5); }
}
// spread mechanics (1 Hz) — burn spread
function statusSpread() {
  if (!B.burnSpread) return;
  for (const e of G.enemies) if (!e.dead && e.burnT > 0) { let n = B.burnSpread; forEnemiesNear(e.x, e.y, 90, o => { if (n > 0 && o !== e && o.burnT <= 0) { n--; ignite(o, e.burnDps); beamFx(e.x, e.y, o.x, o.y, '#ff8a2b', 1.5, .2, 8); } }); }
}
// apply bullet on-hit effects (elements, splitting, etc.)
function applyOnHit(e, b) {
  const p = G.player, run = G.run, sm = b.crit && B.critStatus ? 2 : 1;
  let burn = b.burn + B.burnChance + (B.syn.wildfire && p.moveT > .5 ? .4 : 0); if (b.summon && B.syn.legion) burn = 1;
  if (burn > 0 && (b.summon && !B.droneElem && !B.syn.legion ? false : true) && rnd() < burn * sm) ignite(e, burnDps() * (b.burn >= 1 ? 1 : 1));
  if (b.summon && !B.droneElem) { if (B.syn.hive) addPoison(e, 3); return; }
  const chill = B.chill + b.chill + (B.syn.glacier && b.pierced > 0 ? 30 : 0) + (B.syn.cryoshards && b.isFrag ? 30 : 0);
  if (chill > 0) addChill(e, chill * sm);
  const pois = B.poison + b.poison + (B.syn.venomrounds && b.pierced > 0 ? 2 : 0) + (B.syn.plague && b.isFrag ? 2 : 0);
  if (pois > 0) addPoison(e, pois * sm);
  let shock = B.shockChance + b.shock; if (B.syn.thunderclap && b.crit) shock = 1;
  if (run.char === 'volt' && ++p.voltCount >= 5) { p.voltCount = 0; shock = 1; }
  if (shock > 0 && rnd() < shock * sm) chainLightning(e, shockDmg() * (1 + B.dmg * .5), shockJumps(), b.x, b.y);
  if (B.capacitor && ++p.hits % T.ST.capacitorN === 0) { let n = B.capacitor; forEnemiesNear(e.x, e.y, 220, o => { if (n-- > 0) { beamFx(e.x, e.y, o.x, o.y, '#c39bff', 2.5, .2, 16); hurtEnemy(o, 30, DMG.SHOCK); } }); A.play('zap', e.x, e.y); }
  if (run.char === 'volt' && shock >= 1) e.stunT = max(e.stunT, .25);
}
// chain lightning from a source enemy
let _chainId = 1;
function chainLightning(first, dmg, jumps, sx, sy) {
  const id = ++_chainId; let cur = first, x = sx, y = sy, total = 0;
  A.play('zap', first.x, first.y, .8);
  while (cur && total < 40) {
    cur.chainId = id; beamFx(x, y, cur.x, cur.y, '#c9a8ff', 2.2, .16, 14); flashLight(cur.x, cur.y, 80, '#b98bff', .12, .8);
    hurtEnemy(cur, dmg, DMG.SHOCK); if (B.syn.electrolysis) addPoison(cur, 3); if (B.syn.superconductor) addChill(cur, 25);
    if (B.syn.overload) explode(cur.x, cur.y, 34, 20 * expMul(), 0, 'Overload', true);
    if (!(B.syn.superconductor && cur.frozenT > 0)) jumps--;
    if (jumps < 0) break;
    x = cur.x; y = cur.y; let best = null, bd = T.ST.shockRange * T.ST.shockRange;
    const n = G.grid.query(x, y, T.ST.shockRange), L = G.grid.list;
    for (let i = 0; i < n; i++) { const o = L[G.grid.out[i]]; if (!o || o.dead || o.chainId === id || o.spawnT > 0 || o.burrowed) continue; const d = dist2(x, y, o.x, o.y); if (d < bd) { bd = d; best = o; } }
    cur = best; dmg *= T.ST.shockFall; total++;
  }
}
function forEnemiesNear(x, y, r, fn) {
  const n = G.grid.query(x, y, r + G.qpad), L = G.grid.list, out = G.grid.out, r2 = r * r;
  for (let i = 0; i < n; i++) { const e = L[out[i]]; if (e && !e.dead && e.spawnT <= 0 && !e.burrowed && dist2(x, y, e.x, e.y) < r2 + e.r * e.r * 2) fn(e); }
}
function nearestEnemy(x, y, r, needLos = false) {
  let best = null, bd = r * r; for (const e of G.enemies) { if (e.dead || e.spawnT > 0 || e.burrowed) continue; const d = dist2(x, y, e.x, e.y); if (d < bd && (!needLos || los(x, y, e.x, e.y))) { bd = d; best = e; } } return best;
}

// ---- explosions ---------------------------------------------------------------------------------------------
// team: 0 player (hurts enemies), 1 enemy (hurts player), 2 both
function explode(x, y, r, dmg, team, src, small = false) {
  const big = r > 70;
  A.play(big ? 'explode' : 'explodeS', x, y, small ? .6 : 1); if (big) A.duck(.45, .5);
  trauma(small ? .12 : big ? .5 : .3); if (big) hitstop(.035); flashLight(x, y, r * 3.2, '#ff9a4a', .22, 1.2); if (big) aberrate(T.fx.abberation);
  burst(x, y, small ? 10 : 24, C_FIRE2, r * 6, .4, 4); burst(x, y, small ? 6 : 14, C_FIRE, r * 4, .55, 5, PK.DOT); burst(x, y, small ? 3 : 8, C_SMOKE, r * 1.5, 1.1, r * .3, PK.SMOKE, 2);
  ring(x, y, r, C_FIRE2, .3, 5); emit(PK.GLOW, x, y, 0, 0, .25, r * 1.6, C_FIRE2, 0); decal('scorch', x, y, r * .9, null, .7);
  if (team !== 1) {
    forEnemiesNear(x, y, r, e => { const d = hypot(e.x - x, e.y - y), f = 1 - .5 * sat(d / r), a = atan2(e.y - y, e.x - x);
      hurtEnemy(e, dmg * f, DMG.EXPL, false, cos(a) * 300, sin(a) * 300); if (B.expStun && team === 0) e.stunT = max(e.stunT, B.expStun); if (B.syn.avalanche) addChill(e, 60); });
    if (team === 0) {
      if (B.syn.napalm) addZone('fire', x, y, r * .7, 3, 18);
      if (B.syn.cluster && !small) for (let i = 0; i < 3; i++) { const b = fragBullet(x, y, rnd() * TAU, 0, 'Bomblet'); b.explode = 30; b.expDmg = 15 * expMul(); b.life = .25 + rnd() * .2; b.shape = 6; b.isFrag = true; b.split = 0; }
    }
  }
  if (team !== 0) { const p = G.player; if (p && !p.dead && dist2(x, y, p.x, p.y) < (r + p.r * .5) ** 2) hurtPlayer(dmg, src, x, y); }
  // cover + barrels
  const room = G.room, coverDmg = B && (B.expDmg > 0) ? dmg * 3 : dmg * .8, tr = ceil(r / TS);
  for (let j = -tr; j <= tr; j++) for (let i = -tr; i <= tr; i++) { const tx = floor(x / TS) + i, ty = floor(y / TS) + j; if (tx < 0 || ty < 0 || tx >= room.w || ty >= room.h) continue;
    const k = ty * room.w + tx; if (room.tiles[k] === 2 && dist2(x, y, (tx + .5) * TS, (ty + .5) * TS) < (r + 16) ** 2) damageCover(k, coverDmg); }
  for (const pr of G.props) if (pr.kind === 'barrel' && !pr.dead && dist2(x, y, pr.x, pr.y) < (r + 10) ** 2) { pr.hp -= dmg; if (pr.hp <= 0) pr.fuse = pr.fuse || .12; }
}
function nukeStrike() {
  let best = null, bc = 0; for (const e of G.enemies) { if (e.dead) continue; let c = 0; forEnemiesNear(e.x, e.y, 140, () => c++); if (c > bc) { bc = c; best = e; } }
  if (!best) return; const x = best.x, y = best.y; tele('circle', x, y, 160, 0, .7, '#ffe23a'); A.play('windSnipe', x, y, .6);
  addTimer(.7, () => { explode(x, y, 170, T.ST.nukeDmg * expMul(), 0, 'Nuke'); screenFlash(.5); beamFx(x, y - 600, x, y, '#ffffff', 22, .4); });
}

// ---- fragments (split bullets) -------------------------------------------------------------------------------
function fragBullet(x, y, ang, dmg, src) {
  const b = newBullet(0), s = 520 * (1 + B.pspd); b.x = b.px = x; b.y = b.py = y; b.vx = cos(ang) * s; b.vy = sin(ang) * s; b.r = 2.2; b.dmg = dmg; b.life = .35 * (1 + B.range); b.isFrag = true;
  b.shape = 1; b.src = src; b.col = 0; return b;
}
function splitBullet(b, n, spreadAng) {
  if (b.isFrag && b.splitDepth <= 0) return;
  const a0 = atan2(b.vy, b.vx);
  for (let i = 0; i < n; i++) {
    const a = spreadAng ? a0 + (i - (n - 1) / 2) * spreadAng : a0 + (rnd() - .5) * 2.2, f = fragBullet(b.x, b.y, a, b.dmg * .35, b.src);
    f.burn = b.burn; f.col = b.col; f.splitDepth = b.isFrag ? b.splitDepth - 1 : B.splitDepth; f.isFrag = true; f.h0 = b.lastHit || 0; f.hn = 1;
    if (f.splitDepth > 0) f.split = B.split;
  }
}

// ---- player bullets update ---------------------------------------------------------------------------------------
function updatePlayerBullets(dt) {
  const list = G.bullets, room = G.room, grid = G.grid, L = grid.list, out = grid.out, p = G.player;
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i]; b.px = b.x; b.py = b.y; b.age += dt; b.life -= dt;
    if (b.mine) { if (updateMine(b, dt)) { freeBullet(list, i); } continue; }
    if (b.life <= 0) { if (b.explode) explode(b.x, b.y, b.explode, b.expDmg, 0, b.src, b.isFrag); freeBullet(list, i); continue; }
    // motion modifiers
    if (b.drag) { const d = 1 / (1 + b.drag * dt); b.vx *= d; b.vy *= d; }
    if (b.acc) { const s = hypot(b.vx, b.vy), ns = min(b.maxSpd, s + b.acc * dt); b.vx *= ns / s; b.vy *= ns / s; if (rnd() < .5) emit(PK.SMOKE, b.x, b.y, rr(-10, 10), rr(-10, 10), .5, 3, C_SMOKE, 2); emit(PK.DOT, b.x, b.y, -b.vx * .1, -b.vy * .1, .15, 2.5, C_FIRE2, 3); }
    if (b.homing > 0 && b.age > .06) { const t = nearestEnemy(b.x, b.y, b.seek ? 600 : 300); if (t) { const a = atan2(b.vy, b.vx), ta = atan2(t.y - b.y, t.x - b.x), s = hypot(b.vx, b.vy), na = a + clamp(angDiff(a, ta), -b.homing * dt, b.homing * dt); b.vx = cos(na) * s; b.vy = sin(na) * s; } }
    if (b.ret > 0 && b.age > b.ret) { // boomerang return
      const dx = p.x - b.x, dy = p.y - b.y, d = hypot(dx, dy), s = max(hypot(b.vx, b.vy), 500); b.vx = lerp(b.vx, dx / d * s * 1.1, min(1, dt * 8)); b.vy = lerp(b.vy, dy / d * s * 1.1, min(1, dt * 8)); b.life = max(b.life, .1);
      if (d < 18) { if (b.w) b.w.ammo = min(b.w.mag, b.w.ammo + 1); freeBullet(list, i); continue; } if (b.age > b.ret * 2 + .1) { b.hn = 0; b.h0 = b.h1 = b.h2 = b.h3 = 0; b.age = b.ret + .01; }
    }
    if (B.fork && !b.forked && !b.isFrag && b.dist > 110) { b.forked = true; const a = atan2(b.vy, b.vx), s = hypot(b.vx, b.vy); b.vx = cos(a - .22) * s; b.vy = sin(a - .22) * s; const f = cloneBullet(b); f.vx = cos(a + .22) * s; f.vy = sin(a + .22) * s; }
    if (b.lightning) { b.zapT = (b.zapT || 0) - dt; if (b.zapT <= 0) { b.zapT = .18; let n = 2; forEnemiesNear(b.x, b.y, 110, e => { if (n-- > 0) { beamFx(b.x, b.y, e.x, e.y, '#c9a8ff', 1.8, .12, 10); hurtEnemy(e, 12 * (1 + B.dmg), DMG.SHOCK); } }); } }
    const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt; b.dist += hypot(b.vx, b.vy) * dt;
    // walls
    const tx = floor(nx / TS), ty = floor(ny / TS), t = (tx < 0 || ty < 0 || tx >= room.w || ty >= room.h) ? 1 : room.tiles[ty * room.w + tx];
    if (t === 1 || t === 2 || t === 3) {
      const out2 = tx < 0 || ty < 0 || tx >= room.w || ty >= room.h;
      if ((b.phase || B.phase) && !out2 && b.wallPass !== ty * room.w + tx) { if (t === 2) damageCover(ty * room.w + tx, b.dmg * .5); b.x = nx; b.y = ny; continue; }
      if (t === 2) damageCover(ty * room.w + tx, b.dmg);
      spray(b.x, b.y, atan2(-b.vy, -b.vx), 1.6, 4, b.crit ? C_GOLD : ci(bpal()[0]), 160, .18, 2);
      const totalB = b.bounce + B.bounce + (B.syn.pinballwiz ? 1 : 0) + (B.syn.kinetic ? 1 : 0);
      if (B.splitWall && !b.isFrag) splitBullet(b, B.splitWall, .5);
      if (b.bounces < totalB && !b.ret) {
        const hx = tileSolidB(floor(nx / TS), floor(b.y / TS)), hy = tileSolidB(floor(b.x / TS), floor(ny / TS));
        if (hx || (!hx && !hy)) b.vx = -b.vx; if (hy || (!hx && !hy)) b.vy = -b.vy; b.bounces++;
        b.dmg *= 1 + B.bounceDmg + (B.syn.kinetic ? .25 : 0); if (B.syn.kinetic) { b.vx *= 1.25; b.vy *= 1.25; }
        if (B.bounceSeek || B.syn.pinballwiz) { const e = nearestEnemy(b.x, b.y, 500, true); if (e) { const s = hypot(b.vx, b.vy), a = atan2(e.y - b.y, e.x - b.x); b.vx = cos(a) * s; b.vy = sin(a) * s; } }
        if (B.bounceNova) { ring(b.x, b.y, 45, C_GOLD, .25, 2); forEnemiesNear(b.x, b.y, 45, e => hurtEnemy(e, B.bounceNova * (1 + B.dmg), DMG.EXPL)); }
        if (B.syn.mirrors) splitBullet(b, 1, 0);
        A.play('block', b.x, b.y, .25, 1.5); b.life = max(b.life, .25);
        continue;
      }
      if (b.explode) explode(b.x, b.y, b.explode, b.expDmg, 0, b.src, b.isFrag);
      if (b.ret) { b.age = b.ret + .01; b.vx *= -.5; b.vy *= -.5; continue; }
      freeBullet(list, i); continue;
    }
    b.x = nx; b.y = ny;
    // enemies
    const n = grid.query(b.x, b.y, b.r + G.qpad); let gone = false;
    for (let k = 0; k < n; k++) {
      const e = L[out[k]]; if (!e || e.dead || e.spawnT > 0 || e.burrowed || b.hitBefore(e.id)) continue;
      const rr2 = b.r + e.r; if (dist2(b.x, b.y, e.x, e.y) > rr2 * rr2) continue;
      if (bulletHitsEnemy(b, e)) { gone = true; break; }
    }
    if (gone) { freeBullet(list, i); continue; }
    // barrels
    for (const pr of G.props) if (pr.kind === 'barrel' && !pr.dead && dist2(b.x, b.y, pr.x, pr.y) < (b.r + 11) ** 2) { pr.hp -= b.dmg; pr.flash = .08; if (pr.hp <= 0 && !pr.fuse) pr.fuse = .05; if (!b.pierce) { freeBullet(list, i); gone = true; } break; }
  }
}
function tileSolidB(tx, ty) { const r = G.room; if (tx < 0 || ty < 0 || tx >= r.w || ty >= r.h) return true; const t = r.tiles[ty * r.w + tx]; return t === 1 || t === 2 || t === 3; }
function cloneBullet(b) { const f = newBullet(0); for (const k in b) f[k] = b[k]; return f; }
// returns true if the bullet is consumed
function bulletHitsEnemy(b, e) {
  // reflective elite: bounce back as enemy bullet
  if (e.reflectT > 0 && !b.summon) { const r = eShot(b.x, b.y, atan2(G.player.y - b.y, G.player.x - b.x), 260, 10, 4, 'Reflected Shot', 3); A.play('block', b.x, b.y, .6, 1.2); ring(b.x, b.y, 10, C_WHITE, .2); return true; }
  // bulwark frontal shield
  if (e.def.b === 'shield' && !e.frozenT && e.stunT <= 0) { const a = atan2(b.y - e.y, b.x - e.x); if (abs(angDiff(e.ang, a)) < e.def.arc) {
    spray(b.x, b.y, a, 1.4, 5, ci('#58a8ff'), 220, .2, 2.5); A.play('block', b.x, b.y, .5); e.shieldFlash = .1;
    if (b.pierce >= 3 || b.src === 'Railgun') { /* heavy rounds punch through */ } else return true; } }
  b.markHit(e.id); b.lastHit = e.id;
  const p = G.player, run = G.run; let crit = b.crit, dmg = b.dmg;
  if (!crit && B.execute && e.hp < e.maxHp * B.execute) crit = true;
  if (!crit && b.critBonus > 0 && rnd() < b.critBonus) crit = true;
  if (!crit && B.farCrit && !b.summon && dist2(p.x, p.y, e.x, e.y) > 260 * 260 && rnd() < B.farCrit) crit = true;
  if (crit) { dmg *= T.ST.critMul + B.critDmg; if (B.critHaste) { p.cascade = min(4, p.cascade + 1); p.cascadeT = 2; } }
  if (e.frozenT > 0 && B.syn.glacier && b.pierced > 0) dmg *= 2;
  const a = atan2(b.vy, b.vx), kb = b.kb * (1 + B.kb) * (run.char === 'bastion' ? 1.4 : 1);
  hurtEnemy(e, dmg, b.summon ? DMG.SUMMON | DMG.BULLET : DMG.BULLET, crit, cos(a) * kb, sin(a) * kb);
  if (!b.summon) { if (crit) { A.play('crit', e.x, e.y, .8); hitstop(.022); spray(b.x, b.y, a, 1, 8, C_GOLD, 300, .25, 3); } else A.play('hit', e.x, e.y, .5); }
  spray(b.x, b.y, a + PI, 1.8, crit ? 6 : 3, ci(e.col), 200, .2, 2.5);
  applyOnHit(e, b);
  if (B.syn.detonator && crit) explode(b.x, b.y, 45 * expRad(), b.dmg * .5 * expMul(), 0, 'Detonator', true);
  if (B.split && !b.isFrag || (b.isFrag && b.splitDepth > 0)) splitBullet(b, B.split || 1, 0);
  if (b.explode) { explode(b.x, b.y, b.explode * (b.homing && B.syn.smartbombs ? 1.5 : 1), b.expDmg, 0, b.src, b.isFrag); if (!b.mine) return true; }
  if (b.ebounce < B.enemyBounce && !b.summon) { b.ebounce++; const t = nearestOther(b, e, 300); if (t) { const s = hypot(b.vx, b.vy), na = atan2(t.y - b.y, t.x - b.x); b.vx = cos(na) * s; b.vy = sin(na) * s; return false; } }
  if (b.pierce > 0) {
    b.pierce--; b.pierced++; b.dmg *= 1 + B.pierceDmg; if (B.syn.drill) b.critBonus += .25;
    if (B.impale && b.pierced === 3) { explode(b.x, b.y, 55 * expRad(), T.ST.impaleDmg * expMul(), 0, 'Impale', true); }
    return false;
  }
  return true;
}
function nearestOther(b, ex, r) { let best = null, bd = r * r; for (const e of G.enemies) { if (e === ex || e.dead || e.spawnT > 0 || b.hitBefore(e.id)) continue; const d = dist2(b.x, b.y, e.x, e.y); if (d < bd) { bd = d; best = e; } } return best; }
function updateMine(b, dt) { // returns true when finished. mine 1 = proximity mine, 2/3 = fused bomb/grenade
  if (b.mine >= 2) {
    if (b.drag) { const d = 1 / (1 + b.drag * dt); b.vx *= d; b.vy *= d; const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
      if (tileSolidB(floor(nx / TS), floor(b.y / TS))) b.vx = -b.vx * .5; else b.x = nx; if (tileSolidB(floor(b.x / TS), floor(ny / TS))) b.vy = -b.vy * .5; else b.y = ny; }
    if (b.life <= 0) { explode(b.x, b.y, b.explode, b.expDmg, 0, b.src); return true; } if (rnd() < .3) emit(PK.SPARK, b.x, b.y, rr(-60, 60), -rr(40, 120), .2, 3, C_FIRE2); return false; }
  if (b.age < .55) { const d = 1 / (1 + 5 * dt); b.vx *= d; b.vy *= d; b.x += b.vx * dt; b.y += b.vy * dt; if (tileSolidB(floor(b.x / TS), floor(b.y / TS))) { b.x = b.px; b.y = b.py; b.vx = b.vy = 0; } return false; }
  b.armT += dt; if (b.armT < T.W.mines.arm) return false;
  if (b.age > T.W.mines.mineLife) { explode(b.x, b.y, b.explode, b.expDmg, 0, 'Mine'); return true; }
  let trig = false; forEnemiesNear(b.x, b.y, T.W.mines.prox, () => trig = true);
  if (trig) { explode(b.x, b.y, b.explode, b.expDmg, 0, 'Mine'); return true; }
  return false;
}

// ---- enemy bullets update ------------------------------------------------------------------------------------------
function updateEnemyBullets(dt) {
  const list = G.ebullets, p = G.player, room = G.room, ets = G.enemyTS; dt *= ets;
  const pr = p.r * .7, gr = T.player.grazeR, aegis = p.buffs.aegis > 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i]; b.px = b.x; b.py = b.y; b.age += dt; b.life -= dt;
    if (b.delay > 0) { b.delay -= dt; continue; }
    if (b.life <= 0) { freeBullet(list, i); continue; }
    if (b.curve) { const a = atan2(b.vy, b.vx) + b.curve * dt, s = hypot(b.vx, b.vy); b.vx = cos(a) * s; b.vy = sin(a) * s; }
    if (b.acc) { const s = hypot(b.vx, b.vy), ns = clamp(s + b.acc * dt, 30, b.maxSpd || 600); b.vx *= ns / s; b.vy *= ns / s; }
    if (b.homing > 0 && b.age < 1.6) { const a = atan2(b.vy, b.vx), ta = atan2(p.y - b.y, p.x - b.x), s = hypot(b.vx, b.vy), na = a + clamp(angDiff(a, ta), -b.homing * dt, b.homing * dt); b.vx = cos(na) * s; b.vy = sin(na) * s; }
    let nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
    if (b.wave) { const perp = b.baseAng + PI / 2, o = sin(b.age * b.wave) * b.waveA - sin((b.age - dt) * b.wave) * b.waveA; nx += cos(perp) * o; ny += sin(perp) * o; }
    const tx = floor(nx / TS), ty = floor(ny / TS), t = (tx < 0 || ty < 0 || tx >= room.w || ty >= room.h) ? 1 : room.tiles[ty * room.w + tx];
    if ((t === 1 || t === 3 || t === 2) && !b.phase) { if (t === 2) damageCover(ty * room.w + tx, b.dmg * .5); spray(b.x, b.y, atan2(-b.vy, -b.vx), 1.5, 3, ci(bpal()[2]), 120, .15, 2); freeBullet(list, i); continue; }
    b.x = nx; b.y = ny;
    if (p.dead) continue;
    const d2 = dist2(b.x, b.y, p.x, p.y);
    if (aegis && d2 < 40 * 40) { reflectBullet(b); freeBullet(list, i); continue; }
    if (d2 < (b.r + pr) ** 2) {
      if (p.dashT > 0 || p.iframe > 0) { if (!b.grazed) graze(p, b); continue; }
      if (hurtPlayer(b.dmg, b.src, b.x, b.y)) { freeBullet(list, i); continue; }
    } else if ((p.dashT > 0 || p.iframe > 0) && !b.grazed && d2 < (b.r + gr) ** 2) graze(p, b);
    // decoy absorbs
    for (const a of G.allies) if (a.kind === 'decoy' && dist2(b.x, b.y, a.x, a.y) < 18 * 18) { a.hp -= b.dmg; freeBullet(list, i); break; }
  }
}
function reflectBullet(b) { const f = newBullet(0); f.x = f.px = b.x; f.y = f.py = b.y; f.vx = -b.vx * 1.4; f.vy = -b.vy * 1.4; f.dmg = 20 * (1 + B.dmg); f.r = 3; f.life = 1; f.src = 'Aegis'; f.col = 1; ring(b.x, b.y, 8, C_GOLD, .2); }
function graze(p, b) {
  b.grazed = true; const run = G.run; run.stats.grazes++; if (run.stats.grazes === 50) unlockAch('graze50');
  if (p.grazedThisDash) { run.ability += 0; return; } p.grazedThisDash = true;
  A.play('graze', p.x, p.y); slowmo(T.player.grazeSlowScale, T.player.grazeSlow); wtext(p.x, p.y - 20, 'PERFECT', '#7ff6ff', 10, .7, -50);
  ring(p.x, p.y, 40, ci('#7ff6ff'), .35, 3); emit(PK.GLOW, p.x, p.y, 0, 0, .3, 50, ci('#7ff6ff'), 0);
  const w = curWeapon(p); if (w.def.mag < 99) w.ammo = min(w.mag, w.ammo + ceil(w.mag * (run.char === 'kestrel' ? 1 : T.player.grazeAmmo))); if (w.reloadT > 0 && run.char === 'kestrel') w.reloadT = 0;
  p.abilityCd = max(0, p.abilityCd - T.CH[run.char].cd * T.player.grazeCharge);
  if (run.char === 'kestrel') p.buffs.dmg = 2.5;
  if (B.adrenaline) { p.dashCharges = min(p.dashCharges + 1, 1 + (B.dashCharges | 0) + (run.char === 'wraith' ? 1 : 0)); p.buffs.adren = 3; }
}

// ---- pickups -------------------------------------------------------------------------------------------------------
function dropPickup(kind, x, y, v) {
  const a = rnd() * TAU, s = rr(60, 200); G.pickups.push({ kind, x, y, px: x, py: y, vx: cos(a) * s, vy: sin(a) * s, v, t: 0, life: kind === 'gold' ? 30 : 20 });
}
function updatePickups(dt) {
  const p = G.player, R2 = T.player.pickupR * (1 + B.pickup), cleared = G.room.cleared;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const k = G.pickups[i]; k.px = k.x; k.py = k.y; k.t += dt; k.life -= dt;
    if (k.life <= 0) { G.pickups.splice(i, 1); continue; }
    const dx = p.x - k.x, dy = p.y - k.y, d = hypot(dx, dy);
    if (!p.dead && k.t > .35 && (d < R2 || cleared)) { const s = cleared ? 700 : 520 * (1 - d / R2) + 200; k.vx = lerp(k.vx, dx / d * s, min(1, dt * 10)); k.vy = lerp(k.vy, dy / d * s, min(1, dt * 10)); }
    else { const f = 1 / (1 + 6 * dt); k.vx *= f; k.vy *= f; }
    k.x += k.vx * dt; k.y += k.vy * dt; collideTiles(k, 4);
    if (!p.dead && d < p.r + 8 && k.t > .2) {
      G.pickups.splice(i, 1);
      if (k.kind === 'gold') { G.run.gold += k.v; G.run.stats.gold += k.v; A.play('coin', k.x, k.y, .5, 1 + min(.5, G.run.comboPitch = ((G.run.comboPitch || 0) + .02) % .5)); if (G.run.gold >= 400) unlockAch('rich'); }
      else if (k.kind === 'heal') { if (!(G.run.heat > 9)) { healPlayer(k.v); A.play('heal', k.x, k.y); } }
    }
  }
}

// ---- props: barrels, chests, shop items, interactables -----------------------------------------------------------------
function addProp(kind, x, y, o = {}) { const pr = Object.assign({ kind, x, y, px: x, py: y, hp: T.room.barrelHp, dead: false, flash: 0, t: 0, r: 11 }, o); G.props.push(pr); return pr; }
function updateProps(dt) {
  const p = G.player;
  for (let i = G.props.length - 1; i >= 0; i--) {
    const pr = G.props[i]; pr.t += dt; pr.flash = max(0, pr.flash - dt);
    if (pr.kind === 'barrel') {
      if (pr.fuse) { pr.fuse -= dt; if (pr.fuse <= 0) { pr.dead = true; explode(pr.x, pr.y, T.room.barrelR, T.room.barrelDmg, 2, 'Explosive Barrel'); } }
      if (pr.dead) { G.props.splice(i, 1); continue; }
      // push out player/enemies
      const d = hypot(p.x - pr.x, p.y - pr.y); if (d < p.r + pr.r && d > 0) { p.x = pr.x + (p.x - pr.x) / d * (p.r + pr.r); p.y = pr.y + (p.y - pr.y) / d * (p.r + pr.r); }
    }
    if (pr.dead) { G.props.splice(i, 1); continue; }
    if (pr.interact) { pr.near = !p.dead && dist2(p.x, p.y, pr.x, pr.y) < 42 * 42; }
  }
}
function interact(p) {
  let best = null, bd = 42 * 42; for (const pr of G.props) if (pr.interact && !pr.dead) { const d = dist2(p.x, p.y, pr.x, pr.y); if (d < bd) { bd = d; best = pr; } }
  if (best) best.interact(best);
}

// ---- zones (ground effects) ------------------------------------------------------------------------------------------
const ZPOOL = [];
function addZone(kind, x, y, r, dur, dps, team = 0) {
  if (G.zones.length > 220) return null; const z = ZPOOL.pop() || {}; z.kind = kind; z.x = x; z.y = y; z.r = r; z.t = dur; z.dur = dur; z.dps = dps; z.team = team; z.tick = 0; G.zones.push(z); return z;
}
function updateZones(dt) {
  const p = G.player;
  for (let i = G.zones.length - 1; i >= 0; i--) {
    const z = G.zones[i]; z.t -= dt; if (z.t <= 0) { ZPOOL.push(z); G.zones[i] = G.zones[G.zones.length - 1]; G.zones.pop(); continue; }
    z.tick -= dt; if (z.tick > 0) continue; z.tick = .25;
    if (z.team === 0) {
      if (z.kind === 'fire') forEnemiesNear(z.x, z.y, z.r, e => { hurtEnemy(e, z.dps * .25, DMG.DOT); ignite(e, burnDps()); });
      else if (z.kind === 'acid' || z.kind === 'toxic') forEnemiesNear(z.x, z.y, z.r, e => addPoison(e, z.kind === 'acid' ? 1 : 1));
      else if (z.kind === 'tesla') { let n = 0; forEnemiesNear(z.x, z.y, z.r, e => { if (n++ < 8 && rnd() < .75) { beamFx(z.x + rr(-20, 20), z.y + rr(-20, 20), e.x, e.y, '#c9a8ff', 2, .12, 12); hurtEnemy(e, T.ab.tesla.dmg * .75 * (1 + B.dmg), DMG.SHOCK); e.stunT = max(e.stunT, .15); } }); if (n) A.play('zap', z.x, z.y, .5); }
      else if (z.kind === 'hole') forEnemiesNear(z.x, z.y, z.r, e => { if (e.boss) return; const a = atan2(z.y - e.y, z.x - e.x); e.kbx += cos(a) * 140; e.kby += sin(a) * 140; hurtEnemy(e, 4, DMG.DOT); });
    } else if (!p.dead && dist2(z.x, z.y, p.x, p.y) < z.r * z.r) {
      if (z.kind === 'efire') hurtPlayer(z.dps, 'Fire'); else if (z.kind === 'eacid') hurtPlayer(z.dps, 'Acid'); else if (z.kind === 'eice') { p.vx *= .6; p.vy *= .6; }
    }
  }
}
// ---- timers (deferred actions inside sim time) -------------------------------------------------------------------------
const TIMERS = [];
function addTimer(t, fn) { TIMERS.push({ t, fn }); }
function updateTimers(dt) { for (let i = TIMERS.length - 1; i >= 0; i--) { const tm = TIMERS[i]; tm.t -= dt; if (tm.t <= 0) { TIMERS.splice(i, 1); tm.fn(); } } }

// ---- the simulation tick ----------------------------------------------------------------------------------------------
function simTick(dt) {
  G.time += dt; G.tick++; const run = G.run, p = G.player;
  if (G.cam.focusT > 0) G.cam.focusT -= dt / max(.2, G.timeScale);
  run.stats.time += dt; if (run.comboT > 0 && (run.comboT -= dt) <= 0) run.combo = 0;
  G.enemyTS = p.buffs && p.buffs.warp > 0 ? T.ACT.warp.scale : 1;
  if (p.buffs.warp > 0) p.buffs.warp -= dt;
  if (G.bot) botThink(dt);
  updatePlayer(dt);
  G.grid.build(G.enemies); G.qpad = G.boss ? 56 : 28;
  const tgt = decoyTarget() || p; G.room.flow.update(tgt.x, tgt.y, dt);
  PATH.update();
  TAC.update(dt); DIRECTOR.update(dt);
  updateEnemies(dt * G.enemyTS);
  updatePlayerBullets(dt);
  updateEnemyBullets(dt);
  updateAllies(dt); updateZones(dt); updateProps(dt); updatePickups(dt); updateTimers(dt);
  updateHazards(dt); hazardsOnEnemies(dt);
  if ((G.tick % T.sim.hz) === 0) statusSpread();
  ROOMS.update(dt);
  // sweep dead enemies
  const E = G.enemies; for (let i = E.length - 1; i >= 0; i--) if (E[i].dead) { EPOOL.push(E[i]); E[i] = E[E.length - 1]; E.pop(); }
  A.heartbeat(dt, p.dead ? 1 : p.hp / p.maxHp);
}
function hazardsOnEnemies(dt) {
  if (!G.room.hazards.length) return;
  for (const e of G.enemies) {
    if (e.dead || e.fly || e.spawnT > 0 || e.burrowed || e.boss) continue; const hz = hazardAt(e.x, e.y); if (!hz) continue;
    if (hz.k === 'lava') { hurtEnemy(e, T.haz.lava.dps * dt, DMG.DOT | DMG.ENV); if (e.burnT <= 0) ignite(e, 8); }
    else if (hz.k === 'elec' && hz.st === 2) { if ((e.envT = (e.envT || 0) - dt) <= 0) { e.envT = .5; hurtEnemy(e, T.haz.elec.dmg, DMG.ENV); e.stunT = .2; } }
    else if (hz.k === 'spike') { stepHazard(hz); if (hz.st === 2 && (e.envT = (e.envT || 0) - dt) <= 0) { e.envT = .7; hurtEnemy(e, T.haz.spike.dmg, DMG.ENV); } }
    else if (hz.k === 'acid' && rnd() < dt * 2) addPoison(e, 1);
  }
}
