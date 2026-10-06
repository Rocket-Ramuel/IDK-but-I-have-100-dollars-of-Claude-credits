// =====================================================================================
// SECTION 5 — WORLD GEN: rooms, templates, tiles, collision, LOS, flow field, A*, map
// =====================================================================================
const TS = T.tile;
const TILE = { FLOOR: 0, WALL: 1, COVER: 2, DOOR: 3 };

// ---- room templates: carve floor into a wall-filled grid ------------------------------------------
const TEMPLATES = {
  arena(g, r) { g.carveRect(1, 1, g.w - 2, g.h - 2); for (let i = r.int(1, 3); i > 0; i--) g.mirrorBlock(r.int(4, g.w / 2 - 4), r.int(4, g.h - 6), r.int(1, 2), r.int(1, 2), TILE.WALL); },
  cross(g, r) { const bw = floor(g.w * r.range(.38, .5)), bh = floor(g.h * r.range(.4, .55)); g.carveRect(1, floor((g.h - bh) / 2), g.w - 2, bh); g.carveRect(floor((g.w - bw) / 2), 1, bw, g.h - 2); },
  ring(g, r) { g.carveRect(1, 1, g.w - 2, g.h - 2); const iw = floor(g.w * r.range(.22, .32)), ih = floor(g.h * r.range(.22, .32)); g.fillRect(floor((g.w - iw) / 2), floor((g.h - ih) / 2), iw, ih, TILE.WALL); },
  halls(g, r) { g.carveRect(1, 1, g.w - 2, g.h - 2); const x = floor(g.w / 2); g.fillRect(x - 1, 1, 2, g.h - 2, TILE.WALL); const n = r.int(2, 3);
    for (let i = 0; i < n; i++) { const y = floor((i + 1) * g.h / (n + 1)) - 1; g.carveRect(x - 1, y - 1, 2, 4); } },
  diamond(g, r) { const cx = g.w / 2, cy = g.h / 2, rx = g.w / 2 - 1, ry = g.h / 2 - 1; for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) if (abs(x + .5 - cx) / rx + abs(y + .5 - cy) / ry <= 1.25) g.set(x, y, 0); },
  oct(g, r) { const c = floor(min(g.w, g.h) * r.range(.2, .3)); for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) { const dx = min(x - 1, g.w - 2 - x), dy = min(y - 1, g.h - 2 - y); if (dx + dy >= c) g.set(x, y, 0); } },
  pillars(g, r) { g.carveRect(1, 1, g.w - 2, g.h - 2); const s = r.int(5, 7), sz = r.int(1, 2); for (let y = 4; y < g.h - 4; y += s) for (let x = 4; x < g.w - 4; x += s) g.fillRect(x, y, sz, sz, TILE.WALL); },
  courtyard(g, r) { g.carveRect(1, 1, g.w - 2, g.h - 2); const m = r.int(6, 8), x0 = m, y0 = floor(m * .7), x1 = g.w - m, y1 = g.h - floor(m * .7);
    g.fillRect(x0, y0, x1 - x0, 1, 1); g.fillRect(x0, y1, x1 - x0, 1, 1); g.fillRect(x0, y0, 1, y1 - y0 + 1, 1); g.fillRect(x1, y0, 1, y1 - y0 + 1, 1);
    const cx = floor(g.w / 2), cy = floor(g.h / 2); g.carveRect(cx - 2, y0, 4, 1); g.carveRect(cx - 2, y1, 4, 1); g.carveRect(x0, cy - 1, 1, 3); g.carveRect(x1, cy - 1, 1, 3); },
  ell(g, r) { const a = floor(g.w * r.range(.45, .6)), b = floor(g.h * r.range(.45, .6)); g.carveRect(1, 1, g.w - 2, b); if (r.chance(.5)) g.carveRect(1, 1, a, g.h - 2); else g.carveRect(g.w - 1 - a, 1, a, g.h - 2); },
  twin(g, r) { const rr = g.h / 2 - 1.5; for (const cx of [g.w * .3, g.w * .7]) g.carveCircle(cx, g.h / 2, rr); g.carveRect(floor(g.w * .3), floor(g.h / 2) - 2, ceil(g.w * .4), 5); },
  cave(g, r) { // cellular automata
    for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) g.set(x, y, r.chance(.4) ? 1 : 0);
    for (let it = 0; it < 4; it++) { const nt = g.t.slice(); for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) { let n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) n += g.t[(y + j) * g.w + x + i] === 1 ? 1 : 0; nt[y * g.w + x] = n >= 5 ? 1 : 0; } g.t.set(nt); }
    g.carveRect(floor(g.w / 2) - 3, 2, 6, g.h - 4); g.carveRect(4, floor(g.h / 2) - 2, g.w - 8, 4);
  },
  boss(g, r) { g.carveCircle(g.w / 2, g.h / 2, min(g.w, g.h) / 2 - 1.5); g.carveRect(floor(g.w / 2) - 2, 1, 4, 4); g.carveRect(floor(g.w / 2) - 2, g.h - 5, 4, 4); },
};
const TEMPLATE_BIAS = [
  { arena: 3, cross: 2, ring: 2, halls: 2, diamond: 1, oct: 2, pillars: 3, courtyard: 2, ell: 2, twin: 1, cave: 0 },
  { arena: 3, cross: 2, ring: 2, halls: 3, diamond: 1, oct: 2, pillars: 3, courtyard: 2, ell: 2, twin: 2, cave: 1 },
  { arena: 2, cross: 1, ring: 2, halls: 1, diamond: 2, oct: 2, pillars: 1, courtyard: 1, ell: 1, twin: 3, cave: 4 },
  { arena: 3, cross: 2, ring: 3, halls: 2, diamond: 2, oct: 3, pillars: 2, courtyard: 3, ell: 2, twin: 2, cave: 1 },
];
class TileGrid {
  constructor(w, h) { this.w = w; this.h = h; this.t = new Uint8Array(w * h).fill(1); }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inb(x, y) ? this.t[y * this.w + x] : 1; }
  set(x, y, v) { if (x > 0 && y > 0 && x < this.w - 1 && y < this.h - 1) this.t[y * this.w + x] = v; }
  carveRect(x, y, w, h) { this.fillRect(x, y, w, h, 0); }
  fillRect(x, y, w, h, v) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, v); }
  carveCircle(cx, cy, r) { for (let y = 1; y < this.h - 1; y++) for (let x = 1; x < this.w - 1; x++) if ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r) this.set(x, y, 0); }
  mirrorBlock(x, y, w, h, v) { this.fillRect(x, y, w, h, v); this.fillRect(this.w - x - w, y, w, h, v); }
}

function genRoom(run, node) {
  const biome = run.biome, seed = `${run.seed}:${biome}:${node.id}:room`, r = new RNG(seed), type = node.type, isBoss = type === 'boss';
  let w = r.int(T.room.minW, T.room.maxW), h = r.int(T.room.minH, T.room.maxH);
  if (type === 'shop' || type === 'rest' || type === 'treasure' || type === 'event') { w = r.int(24, 28); h = r.int(18, 20); }
  if (isBoss) { w = 44; h = 36; }
  const g = new TileGrid(w, h);
  const tpl = isBoss ? 'boss' : (type === 'shop' || type === 'rest' || type === 'treasure' || type === 'event') ? r.pick(['arena', 'oct']) : r.weighted(TEMPLATE_BIAS[biome]);
  TEMPLATES[tpl](g, r);
  const room = { seed, biome, type, tpl, w, h, tiles: g.t, hp: new Float32Array(w * h), hz: new Int16Array(w * h).fill(-1), hazards: [], coverList: [], doors: [], lights: [],
    open: false, cleared: false, spawns: [], barrels: [], node };
  // doors: carve N and S corridors to the nearest floor
  const door = (side) => {
    const cx = floor(w / 2) - 1; let best = -1;
    for (let o = 0; o < w / 2 - 2 && best < 0; o++) for (const x of [cx + o, cx - o]) { if (x < 2 || x > w - 4) continue;
      for (let y = 1; y < h - 1; y++) { const yy = side === 'N' ? y : h - 1 - y; if (g.get(x, yy) === 0 && g.get(x + 1, yy) === 0) { best = x; break; } } if (best >= 0) break; }
    if (best < 0) best = cx;
    if (side === 'N') { for (let y = 1; y < h - 1 && (g.get(best, y) !== 0 || g.get(best + 1, y) !== 0); y++) { g.set(best, y, 0); g.set(best + 1, y, 0); } room.tiles[best] = room.tiles[best + 1] = TILE.DOOR; room.doors.push({ x: best, y: 0, len: 2, horiz: true, side }); }
    else { for (let y = h - 2; y > 0 && (g.get(best, y) !== 0 || g.get(best + 1, y) !== 0); y--) { g.set(best, y, 0); g.set(best + 1, y, 0); } const i = (h - 1) * w + best; room.tiles[i] = room.tiles[i + 1] = TILE.DOOR; room.doors.push({ x: best, y: h - 1, len: 2, horiz: true, side }); }
  };
  door('N'); door('S');
  const sd = room.doors[1]; room.entry = { x: (sd.x + 1) * TS, y: (sd.y - 1.5) * TS }; room.exitDoor = room.doors[0];
  // procedural variation
  const isCombat = type === 'combat' || type === 'elite' || type === 'challenge';
  const freeAt = (x, y, m = 0) => { for (let j = -m; j <= m; j++) for (let i = -m; i <= m; i++) if (g.get(x + i, y + j) !== 0) return false; return true; };
  const nearEntry = (x, y, d = 5) => abs(x - (sd.x + 1)) < d && abs(y - sd.y) < d + 1 || abs(x - (room.doors[0].x + 1)) < 4 && y < 5;
  if (isCombat || isBoss) {
    const nCover = isBoss ? 0 : r.int(T.room.cover[0], T.room.cover[1]);
    for (let i = 0; i < nCover; i++) {
      const bw = r.int(1, 3), bh = bw === 1 ? r.int(2, 3) : 1, x = r.int(3, floor(w / 2) - 2), y = r.int(3, h - 4);
      let ok = true; for (let j = -1; j <= bh; j++) for (let k = -1; k <= bw; k++) if (!freeAt(x + k, y + j) || nearEntry(x + k, y + j)) ok = false;
      if (!ok) continue; for (let j = 0; j < bh; j++) for (let k = 0; k < bw; k++) { g.set(x + k, y + j, 2); g.set(w - 1 - x - k, y + j, 2); }
    }
    const haz = T.BIO[biome].haz, nh = isBoss ? 0 : r.int(T.room.hazards[0], T.room.hazards[1]) + (biome > 0 ? 1 : 0);
    for (let i = 0; i < nh; i++) {
      const k = r.pick(haz), hw = r.int(2, k === 'ice' ? 6 : 4), hh = r.int(2, k === 'ice' ? 5 : 3), x = r.int(2, w - hw - 2), y = r.int(3, h - hh - 4);
      for (let j = 0; j < hh; j++) for (let q = 0; q < hw; q++) if (g.get(x + q, y + j) === 0 && !nearEntry(x + q, y + j, 4) && room.hz[(y + j) * w + x + q] < 0) {
        room.hz[(y + j) * w + x + q] = room.hazards.length; room.hazards.push({ i: (y + j) * w + x + q, k, st: 0, t: (x + y) * .13 % 1 * 2, cd: 0 }); }
    }
    const nb = isBoss ? 0 : r.int(T.room.barrels[0], T.room.barrels[1]);
    for (let i = 0; i < nb * 3 && room.barrels.length < nb; i++) { const x = r.int(2, w - 3), y = r.int(2, h - 3); if (freeAt(x, y, 1) && !nearEntry(x, y, 6) && room.hz[y * w + x] < 0) room.barrels.push({ x: (x + .5) * TS, y: (y + .5) * TS }); }
  }
  // connectivity: flood from entry; fill unreachable floor, break cover that seals doors
  const reach = floodFrom(room, floor(room.entry.x / TS), floor(room.entry.y / TS));
  const ed = room.doors[0];
  if (!reach[(ed.y + 1) * w + ed.x]) { for (let i = 0; i < w * h; i++) if (g.t[i] === 2) g.t[i] = 0; }
  const reach2 = floodFrom(room, floor(room.entry.x / TS), floor(room.entry.y / TS));
  for (let i = 0; i < w * h; i++) if (g.t[i] === 0 && !reach2[i]) { g.t[i] = 1; if (room.hz[i] >= 0) room.hazards[room.hz[i]].dead = 1; }
  room.hazards = room.hazards.filter(h => !h.dead); room.hz.fill(-1); room.hazards.forEach((hz, k) => room.hz[hz.i] = k);
  for (let i = 0; i < w * h; i++) if (g.t[i] === 2) { room.coverList.push(i); room.hp[i] = T.room.coverHp; }
  // spawn points (clear floor away from the entry)
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) if (freeAt(x, y, 1) && room.hz[y * w + x] < 0 && !nearEntry(x, y, 7)) room.spawns.push({ x: (x + .5) * TS, y: (y + .5) * TS });
  // lights: lava glow + wall lamps
  const bio = T.BIO[biome];
  room.hazards.forEach((hz, k) => { if ((hz.k === 'lava' || hz.k === 'acid') && k % 3 === 0) room.lights.push({ x: (hz.i % w + .5) * TS, y: (floor(hz.i / w) + .5) * TS, r: 90, c: hz.k === 'lava' ? '#ff6a1a' : '#66ff33', a: .7 }); });
  for (let i = 0; i < 40; i++) { const x = r.int(1, w - 2), y = r.int(1, h - 2); if (g.get(x, y) === 1 && (g.get(x, y + 1) === 0 || g.get(x + 1, y) === 0) && room.lights.length < 22)
    room.lights.push({ x: (x + .5) * TS, y: (y + .5) * TS, r: r.range(110, 170), c: r.chance(.6) ? bio.edge : bio.acc, a: .55 }); }
  room.amb = bio.amb;
  room.flow = new FlowField(room); room.clear = clearanceField(room);
  buildRoomPaths(room);
  return room;
}
function floodFrom(room, sx, sy) {
  const w = room.w, h = room.h, seen = new Uint8Array(w * h), q = [sy * w + sx]; seen[q[0]] = 1;
  while (q.length) { const i = q.pop(), x = i % w, y = (i / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const j = ny * w + nx; if (!seen[j] && room.tiles[j] === 0) { seen[j] = 1; q.push(j); } } }
  return seen;
}
// ---- tile queries ----------------------------------------------------------------------------------------
function tileAt(x, y) { const r = G.room, tx = floor(x / TS), ty = floor(y / TS); if (tx < 0 || ty < 0 || tx >= r.w || ty >= r.h) return 1; return r.tiles[ty * r.w + tx]; }
// solidity masks: walls always; cover blocks walkers and bullets; doors block unless open (for the player)
function solidFor(t, fly, player) { return t === 1 || (t === 2 && !fly) || (t === 3 && !(player && G.room.open)); }
// circle vs tile collision with sliding; returns true if touched
let _hitWallNX = 0, _hitWallNY = 0;
function collideTiles(e, r, fly = false, player = false) {
  const room = G.room, x0 = floor((e.x - r) / TS), x1 = floor((e.x + r) / TS), y0 = floor((e.y - r) / TS), y1 = floor((e.y + r) / TS); let hit = false;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = (tx < 0 || ty < 0 || tx >= room.w || ty >= room.h) ? 1 : room.tiles[ty * room.w + tx];
    if (!solidFor(t, fly, player)) continue;
    const nx = clamp(e.x, tx * TS, tx * TS + TS), ny = clamp(e.y, ty * TS, ty * TS + TS); let dx = e.x - nx, dy = e.y - ny; const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 1e-6) { const d = sqrt(d2), p = r - d; dx /= d; dy /= d; e.x += dx * p; e.y += dy * p; _hitWallNX = dx; _hitWallNY = dy; }
      else { const cx = tx * TS + TS / 2, cy = ty * TS + TS / 2, ax = e.x - cx, ay = e.y - cy; if (abs(ax) > abs(ay)) { e.x = cx + sign(ax) * (TS / 2 + r); _hitWallNX = sign(ax); _hitWallNY = 0; } else { e.y = cy + sign(ay) * (TS / 2 + r); _hitWallNX = 0; _hitWallNY = sign(ay); } }
      hit = true;
    }
  }
  return hit;
}
// DDA raycast through tiles. mode: 0 = walls+cover block, 1 = walls only (flyers / phase). Returns distance to hit or maxD.
let _rayTile = -1;
function raycast(x, y, dx, dy, maxD, mode = 0) {
  const room = G.room, w = room.w, h = room.h; let tx = floor(x / TS), ty = floor(y / TS);
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, tdx = dx !== 0 ? abs(TS / dx) : 1e9, tdy = dy !== 0 ? abs(TS / dy) : 1e9;
  let tmx = dx !== 0 ? ((dx > 0 ? (tx + 1) * TS - x : x - tx * TS) / abs(dx)) : 1e9, tmy = dy !== 0 ? ((dy > 0 ? (ty + 1) * TS - y : y - ty * TS) / abs(dy)) : 1e9, d = 0;
  _rayTile = -1;
  for (let i = 0; i < 200; i++) {
    if (tmx < tmy) { d = tmx; tmx += tdx; tx += stepX; } else { d = tmy; tmy += tdy; ty += stepY; }
    if (d >= maxD) return maxD;
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) return d;
    const t = room.tiles[ty * w + tx]; if (t === 1 || t === 3 || (t === 2 && mode === 0)) { _rayTile = ty * w + tx; return d; }
  }
  return maxD;
}
function los(x0, y0, x1, y1, mode = 0) { const dx = x1 - x0, dy = y1 - y0, d = hypot(dx, dy); if (d < 1) return true; return raycast(x0, y0, dx / d, dy / d, d, mode) >= d - .5; }
// swept-circle visibility (centre + two offset rays) — for walkable straight lines
function losThick(x0, y0, x1, y1, r = 11) { const d = hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / d * r, ny = (x1 - x0) / d * r;
  return los(x0, y0, x1, y1) && los(x0 + nx, y0 + ny, x1 + nx, y1 + ny) && los(x0 - nx, y0 - ny, x1 - nx, y1 - ny); }
function damageCover(i, dmg) {
  const room = G.room; if (room.tiles[i] !== 2) return; room.hp[i] -= dmg;
  if (room.hp[i] <= 0) {
    room.tiles[i] = 0; const x = (i % room.w + .5) * TS, y = (floor(i / room.w) + .5) * TS, bio = T.BIO[room.biome];
    burst(x, y, 14, ci(bio.acc), 260, .5, 3, PK.SHARD, 3); burst(x, y, 6, C_SMOKE, 60, .8, 8, PK.SMOKE, 2); decal('debris', x, y, 18, bio.top, .8);
    A.play('shatter', x, y, .6, .7); room.flow.dirty = true; room.clear = clearanceField(room);
  }
}

// ---- flow field (Dijkstra, time-sliced into a back buffer, shared by all walkers) -----------------------
class FlowField {
  constructor(room) {
    const n = room.w * room.h; this.room = room; this.w = room.w; this.h = room.h; this.dist = new Float32Array(n).fill(1e9); this.back = new Float32Array(n);
    this.heapI = new Int32Array(n * 8); this.heapD = new Float32Array(n * 8); this.hn = 0; this.building = false; this.tile = -1; this.dirty = true; this.timer = 0;
    this.cost = new Float32Array(n); this.updateCost();
  }
  updateCost() { const r = this.room; for (let i = 0; i < this.cost.length; i++) { const t = r.tiles[i]; this.cost[i] = (t === 1 || t === 2 || t === 3) ? -1 : (r.hz[i] >= 0 ? (r.hazards[r.hz[i]].k === 'ice' ? 1.5 : 7) : 1); } }
  push(i, d) { let k = this.hn++; const H = this.heapI, D = this.heapD; while (k > 0) { const p = (k - 1) >> 1; if (D[p] <= d) break; H[k] = H[p]; D[k] = D[p]; k = p; } H[k] = i; D[k] = d; }
  pop() { const H = this.heapI, D = this.heapD, top = H[0], n = --this.hn, li = H[n], ld = D[n]; let k = 0;
    while (true) { let c = 2 * k + 1; if (c >= n) break; if (c + 1 < n && D[c + 1] < D[c]) c++; if (D[c] >= ld) break; H[k] = H[c]; D[k] = D[c]; k = c; } H[k] = li; D[k] = ld; this.popD = D[0]; return top; }
  // call every tick with the target position; does at most `budget` node expansions
  update(tx, ty, dt, budget = 900) {
    const ti = clamp(floor(ty / TS), 0, this.h - 1) * this.w + clamp(floor(tx / TS), 0, this.w - 1);
    this.timer -= dt;
    if (!this.building && (ti !== this.tile || this.dirty) && this.timer <= 0) {
      if (this.dirty) this.updateCost(); this.dirty = false; this.tile = ti; this.timer = .08;
      this.back.fill(1e9); this.hn = 0; this.back[ti] = 0; this.push(ti, 0); this.building = true;
    }
    if (!this.building) return;
    const w = this.w, h = this.h, B = this.back, C = this.cost;
    while (this.hn > 0 && budget-- > 0) {
      const d0 = this.heapD[0], i = this.pop(); if (d0 > B[i]) continue;
      const x = i % w, y = (i / w) | 0;
      for (let k = 0; k < 8; k++) {
        const dx = DX8[k], dy = DY8[k], nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx, c = C[j]; if (c < 0) continue;
        if (dx && dy && (C[y * w + nx] < 0 || C[ny * w + x] < 0)) continue; // no corner cutting
        const nd = d0 + c * (dx && dy ? 1.4142 : 1); if (nd < B[j]) { B[j] = nd; this.push(j, nd); }
      }
    }
    if (this.hn === 0) { const t = this.dist; this.dist = this.back; this.back = t; this.building = false; }
  }
  // smooth descent direction at world pos → _fx,_fy (0,0 if none)
  dir(x, y) {
    const w = this.w, tx = floor(x / TS), ty = floor(y / TS); _fx = _fy = 0; if (tx < 0 || ty < 0 || tx >= w || ty >= this.h) return;
    const D = this.dist, d0 = D[ty * w + tx]; let bx = 0, by = 0;
    for (let k = 0; k < 8; k++) { const nx = tx + DX8[k], ny = ty + DY8[k]; if (nx < 0 || ny < 0 || nx >= w || ny >= this.h) continue; const dn = D[ny * w + nx];
      if (dn < d0) { const wt = (d0 - dn) / (DX8[k] && DY8[k] ? 1.4142 : 1); bx += ((nx + .5) * TS - x) * wt; by += ((ny + .5) * TS - y) * wt; } }
    const l = hypot(bx, by); if (l > 1e-4) { _fx = bx / l; _fy = by / l; }
  }
  at(x, y) { const tx = floor(x / TS), ty = floor(y / TS); if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return 1e9; return this.dist[ty * this.w + tx]; }
}
const DX8 = [1, -1, 0, 0, 1, 1, -1, -1], DY8 = [0, 0, 1, -1, 1, -1, 1, -1];
let _fx = 0, _fy = 0;
// clearance: chessboard distance (tiles) to nearest solid
function clearanceField(room) {
  const w = room.w, h = room.h, n = w * h, c = new Uint8Array(n).fill(255), q = new Int32Array(n); let qh = 0, qt = 0;
  for (let i = 0; i < n; i++) if (room.tiles[i] !== 0) { c[i] = 0; q[qt++] = i; }
  while (qh < qt) { const i = q[qh++], x = i % w, y = (i / w) | 0; for (let k = 0; k < 8; k++) { const nx = x + DX8[k], ny = y + DY8[k]; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const j = ny * w + nx; if (c[j] > c[i] + 1) { c[j] = c[i] + 1; q[qt++] = j; } } }
  return c;
}
function clearanceAt(x, y) { const r = G.room, tx = floor(x / TS), ty = floor(y / TS); if (tx < 0 || ty < 0 || tx >= r.w || ty >= r.h) return 0; return r.clear[ty * r.w + tx]; }
// gradient of clearance (push away from walls) → _fx,_fy
function clearanceGrad(x, y) { const tx = floor(x / TS), ty = floor(y / TS), r = G.room; _fx = _fy = 0; const c0 = clearanceAt(x, y);
  for (let k = 0; k < 8; k++) { const nx = tx + DX8[k], ny = ty + DY8[k]; if (nx < 0 || ny < 0 || nx >= r.w || ny >= r.h) continue; const d = r.clear[ny * r.w + nx] - c0; if (d > 0) { _fx += DX8[k] * d; _fy += DY8[k] * d; } }
  const l = hypot(_fx, _fy); if (l > 0) { _fx /= l; _fy /= l; } }

// ---- A* path service (typed arrays, generation stamps, per-tick budget) -----------------------------------
const PATH = {
  n: 0, q: [], gen: 1,
  init(room) { const n = room.w * room.h; this.n = n; this.g = new Float32Array(n); this.from = new Int32Array(n); this.stamp = new Uint32Array(n); this.closed = new Uint32Array(n);
    this.hI = new Int32Array(n * 8); this.hF = new Float32Array(n * 8); this.q.length = 0; },
  request(e, x, y) { if (e.pathReq) return; e.pathReq = true; this.q.push(e, x, y); },
  update() {
    for (let b = 0; b < T.ai.pathBudget && this.q.length; b++) { const e = this.q.shift(), x = this.q.shift(), y = this.q.shift(); e.pathReq = false; if (e.dead) { b--; continue; } this.solve(e, x, y); }
  },
  solve(e, gx, gy) {
    const room = G.room, w = room.w, h = room.h, C = room.flow.cost, s = floor(e.y / TS) * w + floor(e.x / TS), gt = clamp(floor(gy / TS), 0, h - 1) * w + clamp(floor(gx / TS), 0, w - 1);
    const gen = ++this.gen, G2 = this.g, F = this.from, S = this.stamp, CL = this.closed, HI = this.hI, HF = this.hF; let hn = 0;
    const gx2 = gt % w, gy2 = (gt / w) | 0, hfn = (i) => { const dx = abs(i % w - gx2), dy = abs(((i / w) | 0) - gy2); return (dx + dy) + (1.4142 - 2) * min(dx, dy); };
    const push = (i, f) => { let k = hn++; while (k > 0) { const p = (k - 1) >> 1; if (HF[p] <= f) break; HI[k] = HI[p]; HF[k] = HF[p]; k = p; } HI[k] = i; HF[k] = f; };
    const pop = () => { const top = HI[0], n = --hn, li = HI[n], lf = HF[n]; let k = 0; while (true) { let c = 2 * k + 1; if (c >= n) break; if (c + 1 < n && HF[c + 1] < HF[c]) c++; if (HF[c] >= lf) break; HI[k] = HI[c]; HF[k] = HF[c]; k = c; } HI[k] = li; HF[k] = lf; return top; };
    if (C[gt] < 0 || s < 0 || s >= w * h) { e.path = null; return; }
    S[s] = gen; G2[s] = 0; F[s] = -1; push(s, hfn(s)); let found = false, it = 0;
    while (hn > 0 && it++ < 2500) {
      const i = pop(); if (CL[i] === gen) continue; CL[i] = gen; if (i === gt) { found = true; break; }
      const x = i % w, y = (i / w) | 0;
      for (let k = 0; k < 8; k++) { const dx = DX8[k], dy = DY8[k], nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const j = ny * w + nx, c = C[j]; if (c < 0 || CL[j] === gen) continue;
        if (dx && dy && (C[y * w + nx] < 0 || C[ny * w + x] < 0)) continue; const ng = G2[i] + c * (dx && dy ? 1.4142 : 1);
        if (S[j] !== gen || ng < G2[j]) { S[j] = gen; G2[j] = ng; F[j] = i; push(j, ng + hfn(j)); } }
    }
    if (!found) { e.path = null; return; }
    const out = []; for (let i = gt; i !== -1 && out.length < 400; i = F[i]) out.push(i); out.reverse();
    // string-pull: skip waypoints with direct line of sight
    const pts = []; let a = 0; while (a < out.length - 1) { let b = out.length - 1; const ax = (out[a] % w + .5) * TS, ay = (((out[a] / w) | 0) + .5) * TS;
      while (b > a + 1 && !losThick(ax, ay, (out[b] % w + .5) * TS, (((out[b] / w) | 0) + .5) * TS)) b--; pts.push((out[b] % w + .5) * TS, (((out[b] / w) | 0) + .5) * TS); a = b; }
    e.path = pts; e.pathI = 0;
  },
};

// ---- hazards ---------------------------------------------------------------------------------------------
function updateHazards(dt) {
  const room = G.room, H = T.haz;
  for (const hz of room.hazards) {
    if (hz.k === 'elec') { hz.t += dt; const cyc = H.elec.off + H.elec.warn + H.elec.on, ph = hz.t % cyc; const st = ph < H.elec.off ? 0 : ph < H.elec.off + H.elec.warn ? 1 : 2;
      if (st === 1 && hz.st === 0 && hz.i % 5 === 0) A.play('zap', (hz.i % room.w + .5) * TS, (floor(hz.i / room.w) + .5) * TS, .25, .6); hz.st = st; }
    else if (hz.k === 'spike') { if (hz.st > 0) { hz.t -= dt; if (hz.t <= 0) { if (hz.st === 1) { hz.st = 2; hz.t = H.spike.up; } else { hz.st = 0; hz.cd = H.spike.rearm; } } } else if (hz.cd > 0) hz.cd -= dt; }
  }
}
// returns hazard object under a position (or null); triggers spike plates
function hazardAt(x, y) { const r = G.room, tx = floor(x / TS), ty = floor(y / TS); if (tx < 0 || ty < 0 || tx >= r.w || ty >= r.h) return null; const k = r.hz[ty * r.w + tx]; return k >= 0 ? r.hazards[k] : null; }
function stepHazard(hz) { if (hz && hz.k === 'spike' && hz.st === 0 && hz.cd <= 0) { hz.st = 1; hz.t = T.haz.spike.warn; A.play('beep', (hz.i % G.room.w + .5) * TS, (floor(hz.i / G.room.w) + .5) * TS, .3, .8); } }

// ---- branching map ------------------------------------------------------------------------------------------
const ROOM_ICON = { combat: '⚔', elite: '☠', shop: '$', treasure: '◆', challenge: '⏱', rest: '✚', event: '?', boss: '♛' };
const ROOM_COL = { combat: '#c8d4ea', elite: '#ff4a6a', shop: '#ffe23a', treasure: '#ffb020', challenge: '#ff8a2b', rest: '#5dff8a', event: '#b98bff', boss: '#ff2bd6' };
const ROOM_NAME = { combat: 'Combat', elite: 'Elite', shop: 'Shop', treasure: 'Treasure', challenge: 'Challenge', rest: 'Rest Site', event: 'Mystery', boss: 'Boss' };
function genMap(run, biome) {
  const r = new RNG(`${run.seed}:${biome}:map`), L = T.map.layers, layers = [], nodes = [];
  for (let l = 0; l < L; l++) {
    const n = l === 0 ? r.int(2, 3) : r.int(T.map.minW, T.map.maxW), row = [];
    for (let k = 0; k < n; k++) {
      let type;
      if (l === 0) type = 'combat';
      else if (l === L - 1) type = r.chance(.55) ? 'rest' : r.pick(['shop', 'combat', 'event']);
      else { const w = Object.assign({}, T.map.w); if (l < 2) { w.elite = 0; w.rest = 0; } if (l === 1) w.shop = 0; type = r.weighted(w); }
      const node = { id: `${biome}-${l}-${k}`, layer: l, x: (k + 1) / (n + 1) + r.range(-.04, .04), type, next: [], done: false };
      row.push(node); nodes.push(node);
    }
    layers.push(row);
  }
  // guarantee variety: one shop mid-map, one treasure
  const mid = layers[2 + r.int(0, 2)]; if (!nodes.some(n => n.type === 'shop')) r.pick(mid).type = 'shop';
  if (!nodes.some(n => n.type === 'treasure')) r.pick(layers[r.int(1, 3)]).type = 'treasure';
  const boss = { id: `${biome}-boss`, layer: L, x: .5, type: 'boss', next: [], done: false }; layers.push([boss]); nodes.push(boss);
  for (let l = 0; l < L; l++) {
    const a = layers[l], b = layers[l + 1];
    a.forEach((n, i) => { const j = b.length === 1 ? 0 : round(i * (b.length - 1) / max(1, a.length - 1)); n.next.push(b[j].id); if (b.length > 1 && r.chance(.45)) { const j2 = clamp(j + r.pick([-1, 1]), 0, b.length - 1); if (!n.next.includes(b[j2].id)) n.next.push(b[j2].id); } });
    b.forEach((m, j) => { if (!a.some(n => n.next.includes(m.id))) { let bi = 0, bd = 9; a.forEach((n, i) => { const d = abs(n.x - m.x); if (d < bd) { bd = d; bi = i; } }); a[bi].next.push(m.id); } });
  }
  return { layers, nodes, byId: Object.fromEntries(nodes.map(n => [n.id, n])), cur: null };
}
