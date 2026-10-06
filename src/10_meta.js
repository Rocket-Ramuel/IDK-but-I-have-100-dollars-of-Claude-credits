// =====================================================================================
// SECTION 10 — META / SAVE: persistence, achievements, codex, run & room flow, bot, boot
// =====================================================================================
const SAVE_KEY = 'shatterline_v1';
const DEFAULT_SETTINGS = { vMaster: .8, vSfx: .9, vMusic: .55, vUi: .7, shake: 1, reducedMotion: false, flashReduce: false, dmgNumbers: true, hitstop: true, bloom: .9, lighting: true, crt: false,
  particles: 1, renderScale: 1, palette: 'default', gameSpeed: 1, aimAssist: true, assist: false, fps: false, debug: false, soundViz: false };
function defaultMeta() { return { shards: 0, unlocked: {}, boosts: {}, ach: {}, codex: { enemy: {}, weapon: {}, upg: {}, syn: {}, boss: {} }, stats: { runs: 0, wins: 0, kills: 0, best: 0, winChars: {} },
  history: [], settings: Object.assign({}, DEFAULT_SETTINGS), binds: null, heatUnlocked: false, maxHeat: 0, lastChar: 'kestrel', lastHeat: 0 }; }
function load() {
  let m = defaultMeta();
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) { const d = JSON.parse(raw); m = Object.assign(m, d); m.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings); m.codex = Object.assign(defaultMeta().codex, d.codex); m.stats = Object.assign(defaultMeta().stats, d.stats); } } catch (e) { console.warn('save unreadable', e); }
  G.meta = m; G.settings = m.settings; if (m.binds) { for (const a of ACTIONS) if (m.binds[a]) IN.binds[a] = m.binds[a].concat(['', '', '']).slice(0, 3); }
}
function save() { try { G.meta.settings = G.settings; localStorage.setItem(SAVE_KEY, JSON.stringify(G.meta)); } catch (e) { /* storage blocked: progress lives in memory */ } }
function isUnlocked(lock) { if (!lock) return true; if (typeof lock === 'string' && lock.startsWith('ach:')) return !!G.meta.ach[lock.slice(4)]; return false; }
function charUnlocked(id) { const l = T.CH[id].lock; return !l || !!G.meta.unlocked[id] || (typeof l === 'string' && isUnlocked(l)); }
function weaponUnlocked(id) { return !T.meta.weapons[id] || !!G.meta.unlocked[id]; }
const _newAch = [];
function unlockAch(id) {
  if (G.demo || !G.meta || G.meta.ach[id]) return; G.meta.ach[id] = Date.now(); const r = ACH_ROWS.find(a => a[0] === id); if (!r) return; _newAch.push(r[1]);
  if (id === 'win') G.meta.heatUnlocked = true; toast('★ ' + r[1], r[3] || r[2]); A.play('rare'); save();
}
function codexSee(k, id) { if (G.demo || !G.meta) return; const c = G.meta.codex[k] || (G.meta.codex[k] = {}); if (!c[id]) { c[id] = 1; } }
function isSeen(k, id) { return !!(G.meta.codex[k] && G.meta.codex[k][id]); }
const dailySeed = () => { const d = new Date(); return `D${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`; };

// ---- run lifecycle ---------------------------------------------------------------------------------------
function startRun(o) {
  A.init(); G.demo = false; G.bot = G.botAuto || false; G.godMode = false;
  const ch = T.CH[o.char], m = G.meta;
  B = newBuild();
  const run = G.run = { seed: o.seed, char: o.char, heat: o.heat || 0, daily: !!o.daily, biome: 0, gold: T.gold.startGold + (m.boosts.prospect || 0) * 20, hp: ch.hp, maxHp: ch.hp,
    weapons: [makeWeapon(ch.w)], wi: 0, actives: [null, null], upgrades: [], synergies: [], banished: new Set(), rerolls: 1 + (m.boosts.fortune || 0), banishes: 1 + (m.boosts.insight || 0),
    combo: 0, comboT: 0, recap: [], perf: 1, rng: new RNG(o.seed + ':run'), killedBy: '', startTime: Date.now(),
    stats: { time: 0, kills: 0, elites: 0, dmgDealt: 0, dmgTaken: 0, grazes: 0, maxCombo: 0, gold: 0, rooms: 0, bosses: 0, dashes: 0 } };
  run.map = genMap(run, 0); codexSee('weapon', ch.w);
  G.player = makePlayer(run); recalcPlayer(); G.player.hp = G.player.maxHp; for (const u of ch.up || []) pickUpgrade(u, true);
  _newAch.length = 0; G.meta.stats.runs++; save();
  resetWorld(); MUS.setTheme(0); MUS.setIntensity(0);
  mapScreen();
}
function resetWorld() {
  for (let i = G.bullets.length - 1; i >= 0; i--) freeBullet(G.bullets, i); for (let i = G.ebullets.length - 1; i >= 0; i--) freeBullet(G.ebullets, i);
  for (const e of G.enemies) EPOOL.push(e); G.enemies.length = 0; G.pickups.length = 0; G.props.length = 0; G.zones.length = 0; TIMERS.length = 0; TELE.length = 0; BEAMS.length = 0; LASERS.length = 0;
  MORTARS.length = 0; VINES.length = 0; TEXTS.length = 0; FLASHES.length = 0; P.n = 0; G.boss = null; G.corpse = null; G.cam.focusT = 0; G.allies = G.allies.filter(a => a.kind === 'drone' || a.kind === 'orbital');
  G.hitstop = 0; G.tsTimer = 0; G.timeScale = 1;
}
function enterNode(node) {
  const run = G.run; run.map.cur = node.id; UI.clear();
  const room = G.room = genRoom(run, node), p = G.player; resetWorld(); decalsReset(room.w * TS, room.h * TS);
  G.grid.reset(room.w * TS, room.h * TS); PATH.init(room); TAC.reset();
  p.x = p.px = room.entry.x; p.y = p.py = room.entry.y; p.vx = p.vy = 0; p.dashT = 0; p.phoenixUsed = false; p.ghosts.length = 0;
  G.cam.x = p.x; G.cam.y = p.y - 100; G.cam.zt = 1; G.allies.forEach(a => { a.x = a.px = p.x; a.y = a.py = p.y; });
  run.roomHit = false; run.roomT = 0; G.state = 'play'; G.paused = false; document.body.classList.add('play'); IN.clearHits();
  for (const b of room.barrels) addProp('barrel', b.x, b.y);
  MUS.setTheme(run.biome, node.type === 'boss'); A.play('door', p.x, p.y, .8, .8); screenFlash(.15);
  const type = node.type;
  if (type === 'combat' || type === 'elite' || type === 'challenge') { DIRECTOR.start(room); if (type === 'elite') toast('ELITE ROOM', 'Stronger foes, richer rewards'); if (B.sentry) addAlly('sentry', p.x + 30, p.y - 40, 1e9); }
  else if (type === 'boss') { DIRECTOR.active = false; BOSS.spawn(T.BIO[run.biome].boss); }
  else { DIRECTOR.active = false; room.cleared = true; room.open = true; setupSpecialRoom(room, node); MUS.setIntensity(.5); }
}
const ROOMS = {
  update(dt) {
    const room = G.room, run = G.run; run.roomT += dt;
    updateLasers(dt * G.enemyTS); updateMortars(dt);
    if (G.demo) { if (!DIRECTOR.active && !G.alive) { DIRECTOR.start(room); } return; }
    if (room.cleared || G.player.dead) return;
    const alive = G.alive > 0;
    if (room.type === 'boss') { if (!G.boss && !G.corpse && !alive && run.roomT > 3) roomCleared(); return; }
    if (!DIRECTOR.active && !alive) roomCleared();
  },
};
function roomCleared() {
  const room = G.room, run = G.run, p = G.player; room.cleared = true; run.stats.rooms++;
  A.play('clear'); MUS.stinger('clear'); MUS.setIntensity(.5); A.play('door', p.x, p.y);
  const D = T.director; run.perf = clamp(run.perf + (run.roomHit ? -.04 : .06), .85, 1.2);
  if (room.type === 'elite' && !run.roomHit) unlockAch('untouch');
  if (B.secondWind && p.hp < p.maxHp * .4) healPlayer(p.maxHp * B.secondWind);
  dropGold(p.x, p.y - 40, T.gold.room * (room.type === 'elite' ? 1.8 : 1) * (1 + B.gold));
  if (run.biome === 3 && !run.reachedCore) { run.reachedCore = true; }
  const open = () => { room.open = true; wtext(p.x, p.y - 30, 'EXIT OPEN', '#50ffaa', 12, 1.2, -20); };
  const chaos = () => { if (B.chaos) { const u = rollOffers(1, 0, run.rng)[0]; if (u) { pickUpgrade(u.id); toast('UNSTABLE RIFT', u.n); } } };
  if (room.type === 'boss') {
    addTimer(.6, () => rewardScreen({ title: 'Boss Defeated', sub: 'Choose a powerful upgrade', minRar: 2, extra: 1, tag: 'boss', then: () => {
      const c = arenaC(); const last = run.biome >= 3;
      addProp('portal', c.x, c.y, { r: 30, interact: () => last ? endRun(true) : nextBiome(), label: last ? 'ASCEND' : 'NEXT SECTOR', sub: last ? 'Finish the run' : T.BIO[run.biome + 1].n });
      healPlayer(p.maxHp * .25, true); open(); } }));
    return;
  }
  addTimer(.7, () => { if (G.room !== room) return; chaos(); rewardScreen({ minRar: room.type === 'elite' ? 1 : room.type === 'challenge' ? 2 : 0, title: room.type === 'challenge' ? 'Challenge Complete' : undefined, then: open }); });
}
function leaveRoom() {
  const run = G.run, node = run.map.byId[run.map.cur]; node.done = true; A.play('door', G.player.x, G.player.y); UI.hint('');
  if (node.type === 'boss') { nextBiome(); return; }
  if (run.biome === 3 && !run.timedCore) { run.timedCore = true; }
  mapScreen();
}
function nextBiome() {
  const run = G.run; if (run.biome >= 3) { endRun(true); return; }
  run.biome++; run.map = genMap(run, run.biome); run.map.cur = null; if (run.biome === 3 && run.stats.time < 14 * 60) unlockAch('fast');
  toast(T.BIO[run.biome].n, `Sector ${run.biome + 1}`); MUS.setTheme(run.biome); mapScreen();
}
function endRun(win) {
  if (G.state === 'summary') return; const run = G.run, m = G.meta, M = T.meta, s = run.stats; A.stopLoops(); UI.hint('');
  if (win && !G.player.dead) { /* victory */ }
  const shards = round((s.rooms * M.shardsPerRoom + s.bosses * M.shardsPerBoss + s.kills * M.shardsPerKill + (win ? M.winBonus : 0)) * (1 + run.heat * M.heatBonus));
  m.shards += shards; m.stats.kills += 0; if (win) { m.stats.wins++; m.stats.best = m.stats.best ? min(m.stats.best, s.time) : s.time; m.stats.winChars[run.char] = 1; m.heatUnlocked = true; m.maxHeat = max(m.maxHeat || 0, run.heat);
    if (run.heat >= 5) unlockAch('heat5'); if (Object.keys(m.stats.winChars).length >= 3) unlockAch('allchars'); unlockAch('win'); }
  if (m.stats.kills >= 100) unlockAch('kills100'); if (m.stats.kills >= 2000) unlockAch('kills2000');
  m.history.unshift({ win, char: run.char, biome: run.biome, time: s.time, kills: s.kills, seed: run.seed, daily: run.daily, heat: run.heat, date: Date.now(), killedBy: win ? '' : run.killedBy });
  m.history = m.history.slice(0, 25); save();
  if (win) { MUS.stinger('clear'); toast('SHATTERLINE CLEARED', 'The Core is silent'); }
  summaryScreen(win, shards, _newAch.slice());
}

// ---- special rooms: shop, treasure, rest, events -------------------------------------------------------------
function setupSpecialRoom(room, node) {
  const run = G.run, c = { x: room.w * TS / 2, y: room.h * TS / 2 }, rng = new RNG(room.seed + ':special');
  if (node.type === 'shop') {
    toast('SHOP', 'Walk up to an item and press ' + bindLabel(IN.binds.interact[0]));
    const offers = rollOffers(3, 0, rng), items = offers.map(u => ({ kind: 'upg', u, price: T.price.rar[u.rar] }));
    const wpool = Object.keys(T.W).filter(id => weaponUnlocked(id) && !run.weapons.some(w => w.id === id)); if (wpool.length) items.push({ kind: 'weapon', id: rng.pick(wpool), price: T.price.weapon });
    items.push({ kind: 'active', id: rng.pick(Object.keys(T.ACT)), price: T.price.active }, { kind: 'heal', price: T.price.heal }, { kind: 'reroll', price: T.price.reroll });
    items.forEach((it, i) => { const k = items.length, x = c.x + (i - (k - 1) / 2) * 70, y = c.y - 10 + (i % 2) * 30;
      const name = it.kind === 'upg' ? it.u.n : it.kind === 'weapon' ? T.W[it.id].n : it.kind === 'active' ? T.ACT[it.id].n : it.kind === 'heal' ? 'Repair Kit (+30 HP)' : 'Reroll Token';
      const col = it.kind === 'upg' ? (it.u.rar === 4 ? '#ff3355' : ['#9fb3c8', '#3aa0ff', '#c04bff', '#ffb020'][it.u.rar]) : it.kind === 'heal' ? '#5dff8a' : '#ffe23a';
      addProp('pedestal', x, y, { r: 14, col, label: name, sub: '◆ ' + it.price, it, interact: pr => buyItem(pr) }); });
  } else if (node.type === 'treasure') {
    toast('TREASURE', ''); addProp('chest', c.x, c.y, { r: 16, label: 'Chest', sub: 'Open', interact: pr => openChest(pr, rng) });
    if (rng.chance(.4)) addProp('chest', c.x + 90, c.y + 20, { r: 16, cursed: true, label: 'Cursed Chest', sub: 'Great power, at a price', interact: pr => openChest(pr, rng) });
    if (rng.chance(.25)) { const m = spawnEnemy('mimic', c.x - 90, c.y + 20, { noTele: true }); m.inv = 999; }
  } else if (node.type === 'rest') {
    toast('REST SITE', ''); addProp('fire', c.x, c.y, { r: 16, label: 'Campfire', sub: 'Rest', interact: pr => { if (pr.used) return; restChoice(pr); } });
  } else if (node.type === 'event') {
    addProp('shrine', c.x, c.y, { r: 16, label: '???', sub: 'Investigate', interact: pr => { if (pr.used) return; pr.used = true; runEvent(rng); } });
  }
}
function buyItem(pr) {
  const run = G.run, it = pr.it; if (pr.sold) return; if (run.gold < it.price) { A.play('deny'); wtext(pr.x, pr.y - 30, 'NOT ENOUGH ◆', '#ff5470', 9); return; }
  run.gold -= it.price; pr.sold = true; pr.label = 'SOLD'; pr.sub = ''; A.play('buy'); UI.hint('');
  if (it.kind === 'upg') pickUpgrade(it.u.id); else if (it.kind === 'weapon') offerWeapon(it.id); else if (it.kind === 'active') offerActive(it.id);
  else if (it.kind === 'heal') { healPlayer(30, true); A.play('heal'); } else run.rerolls++;
}
function openChest(pr, rng) {
  if (pr.opened) return; pr.opened = true; const run = G.run; burst(pr.x, pr.y, 30, C_GOLD, 300, .6, 3); A.play('rare'); ring(pr.x, pr.y, 50, C_GOLD, .4);
  if (pr.cursed) { const curses = Object.values(UPG).filter(u => u.rar === 4 && upgAllowed(u, run)); rewardScreen({ title: 'Cursed Chest', sub: 'Take one: a legendary gift or a curse with teeth', offers: [rng.pick(curses), ...rollOffers(1, 3, rng)].filter(Boolean) }); return; }
  const r = rng.next(), wpool = Object.keys(T.W).filter(id => weaponUnlocked(id) && !run.weapons.some(w => w.id === id));
  if (r < .4 && wpool.length) offerWeapon(rng.pick(wpool)); else if (r < .65) offerActive(rng.pick(Object.keys(T.ACT))); else rewardScreen({ title: 'Treasure', minRar: 1, tag: 'chest' });
  dropGold(pr.x, pr.y, 25);
}
function restChoice(pr) {
  const p = G.player, heal = T.rest.heal * (1 + (G.meta.boosts.mend || 0) * .2) * (G.run.heat > 3 ? .5 : 1);
  choiceDialog('Campfire', 'The neon embers hum. Take a moment.', [
    [`Rest — heal ${round(p.maxHp * heal)} HP`, () => { pr.used = true; healPlayer(p.maxHp * heal, true); A.play('heal'); }, 'pri'],
    [`Train — +${T.rest.maxHp} max HP`, () => { pr.used = true; B.maxHp += T.rest.maxHp; recalcPlayer(); A.play('pick'); }],
    ['Meditate — choose an upgrade', () => { pr.used = true; rewardScreen({ title: 'Meditation', tag: 'rest' }); }],
  ]);
}
const EVENTS = [
  { t: 'Shattered Altar', d: 'A cracked altar pulses with stolen light. It asks for blood.', c: [['Offer 25% max HP — gain an Epic upgrade', r => { const p = G.player; p.hp = max(1, p.hp - p.maxHp * .25); rewardScreen({ title: 'The Altar Answers', minRar: 2, tag: 'altar' }); }], ['Walk away', () => { }]] },
  { t: "Gambler's Terminal", d: 'A flickering terminal offers double or nothing.', c: [['Bet 50 ◆', r => { const run = G.run; if (run.gold < 50) { toast('NOT ENOUGH ◆'); return; } run.gold -= 50; if (r.chance(.5)) { run.gold += 100; toast('JACKPOT', '+100 ◆'); A.play('buy'); } else { toast('HOUSE WINS', '-50 ◆'); A.play('deny'); } }, 'gold'], ['Leave', () => { }]] },
  { t: 'Cursed Cache', d: 'A cache wrapped in red warning glyphs. Something inside wants out.', c: [['Take it — gain a Curse and 120 ◆', r => { const c = Object.values(UPG).filter(u => u.rar === 4 && upgAllowed(u, G.run)); const u = r.pick(c); pickUpgrade(u.id); G.run.gold += 120; toast(u.n.toUpperCase(), 'Cursed'); }], ['Leave it sealed', () => { }]] },
  { t: 'Healing Spring', d: 'Clean coolant pools in a cracked reservoir.', c: [['Drink — heal 35%', () => { healPlayer(G.player.maxHp * .35, true); A.play('heal'); }], ['Bathe deep — full heal, but gain a Curse', r => { healPlayer(999, true); const c = Object.values(UPG).filter(u => u.rar === 4 && upgAllowed(u, G.run)); pickUpgrade(r.pick(c).id); }]] },
  { t: 'Echo of a Fallen Runner', d: 'A ghostly runner offers what it carried.', c: [['Take their gold (+70 ◆)', () => { G.run.gold += 70; }], ['Take their weapon', r => { const w = Object.keys(T.W).filter(id => weaponUnlocked(id) && !G.run.weapons.some(x => x.id === id)); if (w.length) offerWeapon(r.pick(w)); }]] },
  { t: 'Data Shrine', d: 'Old code still runs here. It can rewrite probability.', c: [['Download — +2 rerolls, +1 banish', () => { G.run.rerolls += 2; G.run.banishes++; }], ['Ignore', () => { }]] },
  { t: 'Forbidden Overclock', d: 'A dangerous firmware patch for your rig.', c: [['Install — +15% damage, −15 max HP', () => { B.dmg += .15; B.maxHp -= 15; recalcPlayer(); }], ['Decline', () => { }]] },
  { t: 'Ambush!', d: 'The shrine was bait. Shapes pour out of the walls.', c: [['Fight! (rare reward)', () => { const room = G.room; room.open = false; room.cleared = false; room.type = 'elite'; DIRECTOR.start(room); DIRECTOR.budget = 14 * (1 + G.run.biome * .6); }, 'pri']] },
];
function runEvent(rng) { const ev = rng.pick(EVENTS); choiceDialog(ev.t, ev.d, ev.c.map(([l, f, cls]) => [l, () => f(rng), cls || ''])); }

// ---- bot (automated playtesting + title attract mode) -------------------------------------------------------------
const BOT = { mx: 0, my: 0, fire: false, dash: false, ability: false, ax: 0, ay: 0, t: 0, path: null, stuck: 0 };
function botThink(dt) {
  const p = G.player, room = G.room; if (!p || p.dead) return; BOT.t -= dt;
  let tgt = null, bd = 1e9; for (const e of G.enemies) { if (e.dead || e.spawnT > 0 || e.burrowed) continue; const d = dist2(p.x, p.y, e.x, e.y) * (e.los ? 1 : 3); if (d < bd) { bd = d; tgt = e; } }
  let mx = 0, my = 0;
  // dodge: repel from incoming bullets
  let danger = 0; for (const b of G.ebullets) { const dx = p.x - b.x, dy = p.y - b.y, d2 = dx * dx + dy * dy; if (d2 > 140 * 140) continue; const d = sqrt(d2), app = -(dx * b.vx + dy * b.vy) / (d * hypot(b.vx, b.vy) + 1e-3);
    if (app > .3) { const px = -b.vy, py = b.vx, s = sign(px * dx + py * dy) || 1, w = (1 - d / 140) * app * 2; mx += px / hypot(px, py) * s * w; my += py / hypot(px, py) * s * w; if (d < 40) danger++; } }
  for (const l of LASERS) { const c = cos(l.ang), s = sin(l.ang), dx = p.x - l.x, dy = p.y - l.y, al = dx * c + dy * s, pe = dx * s - dy * c; // step out of beam lanes
    if (al > 0 && al < l.len + 30 && abs(pe) < 70) { const k = sign(pe) || 1, w = 3 * (1 - abs(pe) / 70); mx += s * k * w; my += -c * k * w; if (abs(pe) < 24 && l.t > l.warn - .25) danger++; } }
  for (const t of TELE) { if (t.type === 'line') { const c = cos(t.ang), s = sin(t.ang), dx = p.x - t.x, dy = p.y - t.y, al = dx * c + dy * s, pe = dx * s - dy * c; if (al > 0 && al < t.a && abs(pe) < t.b + 30) { const k = sign(pe) || 1; mx += s * k * 2; my += -c * k * 2; } } }
  for (const t of TELE) { const d = hypot(p.x - t.x, p.y - t.y); if (t.type === 'circle' && d < t.a + 20) { mx += (p.x - t.x) / (d + 1) * 2; my += (p.y - t.y) / (d + 1) * 2; } }
  if (tgt && !tgt.los && !tgt.fly) { BOT.pt = (BOT.pt || 0) - dt; if (!BOT.path || BOT.pt <= 0) { BOT.pt = .5; const e = { x: p.x, y: p.y }; PATH.solve(e, tgt.x, tgt.y); BOT.path = e.path; BOT.pi = 0; }
    if (BOT.path && BOT.pi * 2 < BOT.path.length) { const gx = BOT.path[BOT.pi * 2], gy = BOT.path[BOT.pi * 2 + 1]; if (dist2(p.x, p.y, gx, gy) < 24 * 24) BOT.pi++; const d = hypot(gx - p.x, gy - p.y) || 1; mx += (gx - p.x) / d * 1.2; my += (gy - p.y) / d * 1.2; } }
  if (tgt) { const wd = curWeapon(p).def, d = sqrt(bd), dx = tgt.x - p.x, dy = tgt.y - p.y, want = clamp((wd.range || wd.spd * wd.life * (wd.drag ? .45 : 1)) * .55, 70, 230); const k = d < want ? -1 : d > want + 80 ? .7 : 0; mx += dx / d * k; my += dy / d * k; mx += -dy / d * .4; my += dx / d * .4;
    const a = leadAim({ x: p.x, y: p.y }, p.x, p.y, 700); BOT.ax = tgt.x + (tgt.vx || 0) * .15; BOT.ay = tgt.y + (tgt.vy || 0) * .15; BOT.fire = tgt.los || d < 300; }
  else { BOT.fire = false; let gx = (room.exitDoor.x + 1) * TS, gy = TS * 1.5; if (hypot(p.x - gx, p.y - gy) < 30) gy = 0;
    const pk = G.pickups[0]; if (pk && !room.open) { gx = pk.x; gy = pk.y; }
    const it = G.props.find(pr => pr.interact && !pr.used && !pr.opened && !pr.sold && pr.kind !== 'pedestal'); if (it && room.open) { gx = it.x; gy = it.y; if (dist2(p.x, p.y, it.x, it.y) < 30 * 30) it.interact(it); }
    if (!losThick(p.x, p.y, gx, gy)) { BOT.pt = (BOT.pt || 0) - dt; if (!BOT.path || BOT.pt <= 0) { BOT.pt = .5; const e = { x: p.x, y: p.y }; PATH.solve(e, gx, gy); BOT.path = e.path; BOT.pi = 0; }
      if (BOT.path && BOT.pi * 2 < BOT.path.length) { gx = BOT.path[BOT.pi * 2]; gy = BOT.path[BOT.pi * 2 + 1]; if (dist2(p.x, p.y, gx, gy) < 24 * 24) BOT.pi++; } }
    const d = hypot(gx - p.x, gy - p.y) || 1; mx += (gx - p.x) / d; my += (gy - p.y) / d; }
  const bad = h => h && (h.k === 'lava' || h.k === 'acid' || (h.k === 'elec' && h.st > 0) || (h.k === 'spike' && h.st > 0) || (h.k === 'elec' && (h.t % (T.haz.elec.off + T.haz.elec.warn + T.haz.elec.on)) > T.haz.elec.off - .6));
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, hx = p.x + cos(a) * 34, hy = p.y + sin(a) * 34; if (bad(hazardAt(hx, hy))) { mx -= cos(a) * 1.2; my -= sin(a) * 1.2; } }
  if (bad(hazardAt(p.x, p.y))) { mx *= 1.5; my *= 1.5; }
  clearanceGrad(p.x, p.y); if (clearanceAt(p.x, p.y) <= 1) { mx += _fx * .8; my += _fy * .8; }
  const l = hypot(mx, my); BOT.mx = l > .1 ? mx / l : 0; BOT.my = l > .1 ? my / l : 0;
  const cw = curWeapon(p); if (cw.def.k === 'bow' && cw.charge >= 1) BOT.fire = false;
  if (danger > 0 && p.dashCharges > 0 && rnd() < .5) BOT.dash = true;
  if (tgt && p.abilityCd <= 0 && sqrt(bd) < 260 && rnd() < .02) BOT.ability = true;
  if (!G.demo || true) { IN.wx = BOT.ax || p.x + 1; IN.wy = BOT.ay || p.y; }
}
// UI auto-pilot for headless bot runs
function botUi() {
  if (!G.bot || G.demo) return; const s = UI.screen;
  if (s === 'reward' || s === 'map') { const c = $ui.querySelector(s === 'map' ? '.node.av' : '.card'); if (c) c.click(); else { const b = $ui.querySelector('.btn'); if (b) b.click(); } }
  else if (s === 'event') { const b = $ui.querySelector('.btn:not(:disabled)'); if (b) b.click(); }
}
setInterval(botUi, 400);
// title-screen attract mode: the bot plays a demo room
function startDemo() {
  G.demo = true; G.bot = true; G.godMode = true; B = newBuild(); const r = new RNG('demo' + floor(rnd() * 999)), chars = Object.keys(T.CH), char = r.pick(chars);
  const run = G.run = { seed: 'DEMO', char, heat: 0, biome: r.int(0, 3), gold: 0, hp: 100, maxHp: 100, weapons: [makeWeapon(r.pick(['sidearm', 'stinger', 'scatter', 'disc', 'arc']))], wi: 0, actives: [null, null], upgrades: [], synergies: [], banished: new Set(),
    rerolls: 0, banishes: 0, combo: 0, comboT: 0, recap: [], perf: 1, rng: r, stats: { time: 0, kills: 0, elites: 0, dmgDealt: 0, dmgTaken: 0, grazes: 0, maxCombo: 0, gold: 0, rooms: 0, bosses: 0, dashes: 0 } };
  run.map = genMap(run, run.biome); const node = run.map.layers[3][0]; node.type = 'combat'; run.map.cur = node.id;
  for (const id of ['kindling', 'static', 'rubber', 'frag']) if (r.chance(.5)) pickUpgrade(id, true);
  G.player = makePlayer(run); G.player.hp = G.player.maxHp = 100;
  const room = G.room = genRoom(run, node); resetWorld(); G.allies.length = 0; decalsReset(room.w * TS, room.h * TS); G.grid.reset(room.w * TS, room.h * TS); PATH.init(room); TAC.reset();
  const p = G.player; p.x = p.px = room.w * TS / 2; p.y = p.py = room.h * TS / 2; G.cam.x = p.x; G.cam.y = p.y; for (const b of room.barrels) addProp('barrel', b.x, b.y); DIRECTOR.start(room); DIRECTOR.budget = 1e9;
  MUS.setTheme(run.biome); MUS.setIntensity(1.5);
}
function attractTick(dt) {
  if (!G.demo || !G.room) return; simTick(dt); if (G.enemies.length > 26) DIRECTOR.phase = 2;
  if (G.run.stats.time > 75) startDemo();
}

// ---- boot ----------------------------------------------------------------------------------------------------------
function boot() {
  load(); R.gl = false; try { R.gl = GLPost.init(); } catch (e) { console.warn('WebGL post disabled', e); R.gl = false; }
  if (!R.gl) { R.glc.style.display = 'none'; R.scene.id = 'scene'; document.body.insertBefore(R.scene, R.hud); }
  resize(); applySettings();
  const unlockAudio = () => { A.init(); MUS.setTheme(G.run ? G.run.biome : 0); };
  addEventListener('pointerdown', unlockAudio, { once: false }); addEventListener('keydown', unlockAudio, { once: false });
  addEventListener('blur', () => { if (G.state === 'play' && !G.paused && !UI.screen && !G.bot) pauseMenu(); });
  titleScreen(); requestAnimationFrame(frame);
}
// debug / test hooks (used by tools/test.js)
window.SL = { G, T, botUi,
  turbo(n) { for (let i = 0; i < n; i++) { if (G.state !== 'play' || G.paused) break; G.hitstop = 0; simTick(STEP); } botUi(); return { state: G.state, screen: UI.screen, biome: G.run && G.run.biome, rooms: G.run && G.run.stats.rooms, t: G.run && G.run.stats.time, hp: G.player && G.player.hp, en: G.enemies.length, node: G.run && G.run.map.cur }; }, startRun, enterNode, spawnEnemy, pickUpgrade, UPG, SYN, P, DIRECTOR, TAC, mapScreen, endRun, BOSS,
  stress(nE = 300, nB = 1000) { const room = G.room, p = G.player; for (let i = 0; i < nE; i++) { const s = room.spawns[i % room.spawns.length]; spawnEnemy(rpick(['mite', 'gunner', 'wisp', 'tick']), s.x, s.y, { noTele: true }); }
    for (let i = 0; i < nB; i++) { const a = rnd() * TAU, d = rr(250, 600); eShot(p.x + cos(a) * d, p.y + sin(a) * d, a + PI + rr(-.5, .5), rr(40, 90), 1, 4.5, 'stress', i % 4 === 0 ? 3 : 0).life = 20; } } };
boot();
