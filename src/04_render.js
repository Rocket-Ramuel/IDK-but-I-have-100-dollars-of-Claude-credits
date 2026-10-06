// =====================================================================================
// SECTION 4 — RENDERING / FX: canvases, camera, room, particles, lights, decals, post FX
// =====================================================================================
const R = {
  W: 1, H: 1, z: 1, vw: 800, vh: 560, m: [1, 0, 0, 1, 0, 0], dpr: 1, gl: null, flash: 0, ab: 0, lowHp: 0, scale: 1,
  scene: document.createElement('canvas'), light: document.createElement('canvas'), hud: document.getElementById('hud'), glc: document.getElementById('gl'),
};
R.c = R.scene.getContext('2d', { alpha: false }); R.lc = R.light.getContext('2d', { alpha: false }); R.hc = R.hud.getContext('2d');
const BPAL = { // bullet palettes: [player, crit, enemy, enemyAlt]
  default: ['#7ff6ff', '#fff27a', '#ff2a6d', '#ff8a1e'], deutan: ['#4da6ff', '#ffffff', '#ffb000', '#ff6a00'],
  protan: ['#5ab0ff', '#ffffff', '#ffc400', '#ff7f00'], tritan: ['#38e8d0', '#ffffff', '#ff2a2a', '#ff6ad5'],
};
const ELEM_COL = ['', '', '#ff8a2b', '#8fe3ff', '#c39bff', '#8dff4a']; // index 2..5 fire frost shock poison
function bpal() { return BPAL[G.settings.palette] || BPAL.default; }

function resize() {
  const s = G.settings || { renderScale: 1 }, dpr = min(window.devicePixelRatio || 1, 2) * (s.renderScale || 1);
  let W = floor(innerWidth * dpr), H = floor(innerHeight * dpr); const px = W * H;
  if (px > T.view.maxPx) { const k = sqrt(T.view.maxPx / px); W = floor(W * k); H = floor(H * k); }
  R.W = R.scene.width = W; R.H = R.scene.height = H; R.scale = W / innerWidth;
  R.light.width = max(1, W >> 2); R.light.height = max(1, H >> 2);
  const hd = min(window.devicePixelRatio || 1, 2); R.hud.width = floor(innerWidth * hd); R.hud.height = floor(innerHeight * hd); R.hdpr = hd;
  if (R.gl) GLPost.resize(W, H);
}
addEventListener('resize', resize);

// ---- camera -------------------------------------------------------------------------------
function updateCamera(dt, alpha) {
  const c = G.cam, p = G.player, s = G.settings;
  let tx = c.x, ty = c.y;
  if (c.focus && c.focusT > 0) { tx = c.focus.x; ty = c.focus.y; }
  else if (p) {
    const px = lerp(p.px, p.x, alpha), py = lerp(p.py, p.y, alpha);
    let lx = (IN.wx - px) * T.view.lead, ly = (IN.wy - py) * T.view.lead; const l = hypot(lx, ly), lm = T.view.leadMax;
    if (l > lm) { lx *= lm / l; ly *= lm / l; }
    if (IN.padAim) { lx = cos(IN.aimAng) * lm * .7; ly = sin(IN.aimAng) * lm * .7; }
    tx = px + lx + p.recX; ty = py + ly + p.recY;
  }
  const k = 1 - exp(-dt * T.view.follow * (c.focusT > 0 ? .35 : 1)); c.x = lerp(c.x, tx, k); c.y = lerp(c.y, ty, k);
  c.zoom = lerp(c.zoom, c.zt, 1 - exp(-dt * 2.5));
  // trauma shake: trauma² × smooth noise, decays non-linearly
  const sh = s.reducedMotion ? 0 : s.shake;
  c.trauma = max(0, c.trauma - dt * T.fx.traumaDecay * (.4 + c.trauma));
  const tr = c.trauma * c.trauma * sh, t = G.rt * 38;
  c.sx = tr * T.fx.shakePx * (sin(t * 1.1) + sin(t * 2.3 + 1.3) * .5) / 1.5; c.sy = tr * T.fx.shakePx * (sin(t * 1.3 + 4) + sin(t * 2.9 + 2) * .5) / 1.5;
  c.rot = tr * T.fx.shakeRot * sin(t * .9 + 7);
  const z = R.H / T.view.height * c.zoom, ca = cos(c.rot) * z, sa = sin(c.rot) * z, M = R.m;
  M[0] = ca; M[1] = sa; M[2] = -sa; M[3] = ca;
  M[4] = R.W / 2 + c.sx * R.scale - (ca * c.x - sa * c.y); M[5] = R.H / 2 + c.sy * R.scale - (sa * c.x + ca * c.y);
  R.z = z; R.vw = R.W / z; R.vh = R.H / z;
  // mouse → world (inverse transform)
  const mx = IN.mx * R.scale - M[4], my = IN.my * R.scale - M[5], det = M[0] * M[3] - M[1] * M[2];
  IN.wx = (M[3] * mx - M[2] * my) / det; IN.wy = (-M[1] * mx + M[0] * my) / det;
}
const camXf = () => R.c.setTransform(R.m[0], R.m[1], R.m[2], R.m[3], R.m[4], R.m[5]);
function xf(ctx, x, y, ang, sx, sy) { // camera · translate · rotate · scale
  const M = R.m, c = cos(ang), s = sin(ang), a = c * sx, b = s * sx, cc = -s * sy, d = c * sy;
  ctx.setTransform(M[0] * a + M[2] * b, M[1] * a + M[3] * b, M[0] * cc + M[2] * d, M[1] * cc + M[3] * d, M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]);
}
const toScreenX = (x, y) => (R.m[0] * x + R.m[2] * y + R.m[4]) / R.scale, toScreenY = (x, y) => (R.m[1] * x + R.m[3] * y + R.m[5]) / R.scale;
function inView(x, y, m) { const c = G.cam, hw = R.vw * .6 + m, hh = R.vh * .6 + m; return x > c.x - hw && x < c.x + hw && y > c.y - hh && y < c.y + hh; }

// ---- colour registry (for typed-array particles) ------------------------------------------
const COLS = [], COLI = new Map();
function ci(hex) { let i = COLI.get(hex); if (i === undefined) { i = COLS.length; COLS.push(hex); COLI.set(hex, i); } return i; }
const C_WHITE = ci('#ffffff'), C_SMOKE = ci('#1a1424'), C_FIRE = ci('#ff8a2b'), C_FIRE2 = ci('#ffd23a'), C_ICE = ci('#8fe3ff'), C_SHOCK = ci('#c39bff'), C_POISON = ci('#8dff4a'), C_GOLD = ci('#ffe23a'), C_RED = ci('#ff2a4a'), C_HEAL = ci('#5dff8a');

// ---- particles (SoA typed arrays) ---------------------------------------------------------
const PMAX = T.fx.maxParticles;
const P = { n: 0, x: new Float32Array(PMAX), y: new Float32Array(PMAX), vx: new Float32Array(PMAX), vy: new Float32Array(PMAX), life: new Float32Array(PMAX), max: new Float32Array(PMAX),
  size: new Float32Array(PMAX), drag: new Float32Array(PMAX), grav: new Float32Array(PMAX), rot: new Float32Array(PMAX), vr: new Float32Array(PMAX), col: new Uint8Array(PMAX), kind: new Uint8Array(PMAX),
  order: new Uint16Array(PMAX), keyCnt: new Uint32Array(8 * 256), lod: 1 };
const PK = { SPARK: 0, DOT: 1, GLOW: 2, SHARD: 3, SMOKE: 4, RING: 5 };
function emit(kind, x, y, vx, vy, life, size, col, drag = 3, grav = 0) {
  if (P.n >= PMAX) return; if (P.lod < 1 && kind !== PK.RING && rnd() > P.lod) return;
  const i = P.n++; P.x[i] = x; P.y[i] = y; P.vx[i] = vx; P.vy[i] = vy; P.life[i] = P.max[i] = life; P.size[i] = size; P.col[i] = col; P.kind[i] = kind;
  P.drag[i] = drag; P.grav[i] = grav; P.rot[i] = rnd() * TAU; P.vr[i] = (rnd() - .5) * 18;
}
function burst(x, y, n, col, spd, life, size, kind = PK.SPARK, drag = 4) {
  n = ceil(n * G.settings.particles); for (let i = 0; i < n; i++) { const a = rnd() * TAU, s = spd * (.3 + rnd() * .7); emit(kind, x, y, cos(a) * s, sin(a) * s, life * (.5 + rnd() * .5), size * (.6 + rnd() * .6), col, drag); }
}
function spray(x, y, ang, spread, n, col, spd, life, size, kind = PK.SPARK, drag = 5) {
  n = ceil(n * G.settings.particles); for (let i = 0; i < n; i++) { const a = ang + (rnd() - .5) * spread, s = spd * (.4 + rnd() * .6); emit(kind, x, y, cos(a) * s, sin(a) * s, life * (.5 + rnd() * .5), size * (.6 + rnd() * .6), col, drag); }
}
function ring(x, y, r, col, life = .35, w = 3) { emit(PK.RING, x, y, r, 0, life, w, col, 0); }
function updateParticles(dt) {
  if (dt <= 0) return; let n = P.n;
  for (let i = 0; i < n; i++) {
    let l = P.life[i] - dt;
    if (l <= 0) { n--; if (i !== n) { P.x[i] = P.x[n]; P.y[i] = P.y[n]; P.vx[i] = P.vx[n]; P.vy[i] = P.vy[n]; P.life[i] = P.life[n]; P.max[i] = P.max[n]; P.size[i] = P.size[n];
        P.drag[i] = P.drag[n]; P.grav[i] = P.grav[n]; P.rot[i] = P.rot[n]; P.vr[i] = P.vr[n]; P.col[i] = P.col[n]; P.kind[i] = P.kind[n]; i--; } continue; }
    P.life[i] = l; if (P.kind[i] === PK.RING) continue;
    const d = 1 / (1 + P.drag[i] * dt); P.vx[i] *= d; P.vy[i] = P.vy[i] * d + P.grav[i] * dt; P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.rot[i] += P.vr[i] * dt;
  }
  P.n = n;
  // LOD: shed spawns under load
  const load = max(P.n / (PMAX * .75), G.stats.frameMs / 15);
  P.lod = load > 1 ? clamp(1.6 - load * .7, .25, 1) : 1;
}
function drawParticles(ctx, pass) { // pass 0: normal-blend (smoke, shards); pass 1: additive
  const n = P.n; if (!n) return;
  // counting sort by key = kind*256+col
  const kc = P.keyCnt; kc.fill(0); const ord = P.order;
  for (let i = 0; i < n; i++) kc[P.kind[i] * 256 + P.col[i]]++;
  let s = 0; for (let k = 0; k < kc.length; k++) { const c = kc[k]; kc[k] = s; s += c; }
  for (let i = 0; i < n; i++) ord[kc[P.kind[i] * 256 + P.col[i]]++] = i;
  let curKey = -1, kind = -1;
  const flush = () => { if (kind === PK.SPARK) ctx.stroke(); else if (kind === PK.DOT || kind === PK.SHARD) ctx.fill(); };
  for (let j = 0; j < n; j++) {
    const i = ord[j], k = P.kind[i], key = k * 256 + P.col[i];
    const additive = k === PK.SPARK || k === PK.DOT || k === PK.GLOW || k === PK.RING;
    if (additive !== (pass === 1)) continue;
    if (key !== curKey) { flush(); curKey = key; kind = k; const c = COLS[P.col[i]]; ctx.fillStyle = ctx.strokeStyle = c; ctx.beginPath(); if (k === PK.SPARK) ctx.lineWidth = 1.6; }
    const x = P.x[i], y = P.y[i], f = P.life[i] / P.max[i], sz = P.size[i];
    switch (k) {
      case PK.SPARK: { const L = .028 * sz * f; ctx.moveTo(x, y); ctx.lineTo(x - P.vx[i] * L, y - P.vy[i] * L); break; }
      case PK.DOT: { const r = sz * (.3 + f * .7); ctx.rect(x - r, y - r, r * 2, r * 2); break; }
      case PK.SHARD: { const r = sz * (.4 + f * .6), a = P.rot[i]; ctx.moveTo(x + cos(a) * r, y + sin(a) * r); ctx.lineTo(x + cos(a + 2.4) * r * .7, y + sin(a + 2.4) * r * .7); ctx.lineTo(x + cos(a + 3.9) * r * .5, y + sin(a + 3.9) * r * .5); ctx.closePath(); break; }
      case PK.GLOW: { const r = sz * (.5 + f * .5); ctx.globalAlpha = f * .55; ctx.drawImage(lightSprite(COLS[P.col[i]]), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; break; }
      case PK.SMOKE: { const r = sz * (1.6 - f * .6); ctx.globalAlpha = f * .45; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; break; }
      case PK.RING: { const r = P.vx[i] * (1 - f * f * .6 + .1); ctx.globalAlpha = f; ctx.lineWidth = P.size[i] * f + .5; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; break; }
    }
  }
  flush();
}

// ---- light sprites ---------------------------------------------------------------------------
const _lightSprites = new Map();
function lightSprite(hex) {
  let c = _lightSprites.get(hex); if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, rgba(hex, 1)); g.addColorStop(.25, rgba(hex, .55)); g.addColorStop(.6, rgba(hex, .14)); g.addColorStop(1, rgba(hex, 0));
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); _lightSprites.set(hex, c); return c;
}
// lights queued each frame: x,y,r,col,intensity
const LQ = { n: 0, x: new Float32Array(512), y: new Float32Array(512), r: new Float32Array(512), a: new Float32Array(512), c: new Array(512) };
function light(x, y, r, col, a = 1) { if (LQ.n >= 512 || !inView(x, y, r)) return; const i = LQ.n++; LQ.x[i] = x; LQ.y[i] = y; LQ.r[i] = r; LQ.a[i] = a; LQ.c[i] = col; }
// timed light flashes (explosions, muzzle)
const FLASHES = [];
function flashLight(x, y, r, col, dur = .12, a = 1) { if (FLASHES.length < 80) FLASHES.push({ x, y, r, col, t: dur, d: dur, a }); }
function renderLighting(ctx, amb) {
  const lc = R.lc, lw = R.light.width, lh = R.light.height, k = lw / R.W, M = R.m;
  lc.globalCompositeOperation = 'source-over'; lc.setTransform(1, 0, 0, 1, 0, 0); lc.fillStyle = amb; lc.fillRect(0, 0, lw, lh);
  lc.setTransform(M[0] * k, M[1] * k, M[2] * k, M[3] * k, M[4] * k, M[5] * k); lc.globalCompositeOperation = 'lighter';
  const n = min(LQ.n, T.fx.maxLights + 100);
  for (let i = 0; i < n; i++) { const r = LQ.r[i]; lc.globalAlpha = min(1, LQ.a[i]); lc.drawImage(lightSprite(LQ.c[i]), LQ.x[i] - r, LQ.y[i] - r, r * 2, r * 2); }
  lc.globalAlpha = 1; LQ.n = 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(R.light, 0, 0, R.W, R.H); ctx.globalCompositeOperation = 'source-over';
}

// ---- decals (persistent, fading) --------------------------------------------------------------
const DEC = { c: document.createElement('canvas'), k: .5, fadeT: 0 };
DEC.x = DEC.c.getContext('2d');
function decalsReset(w, h) { DEC.c.width = ceil(w * DEC.k); DEC.c.height = ceil(h * DEC.k); DEC.x.clearRect(0, 0, DEC.c.width, DEC.c.height); }
function decal(kind, x, y, r, col, a = .6) {
  const d = DEC.x, k = DEC.k; d.setTransform(k, 0, 0, k, 0, 0); d.globalCompositeOperation = 'source-over';
  if (kind === 'scorch') { const g = d.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(.6, `rgba(0,0,0,${a * .5})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = g; d.beginPath(); d.arc(x, y, r, 0, TAU); d.fill(); }
  else if (kind === 'splat') { d.fillStyle = rgba(col, a); for (let i = 0; i < 6; i++) { const aa = rnd() * TAU, rr2 = rnd() * r; d.beginPath(); d.arc(x + cos(aa) * rr2, y + sin(aa) * rr2, r * (.15 + rnd() * .3), 0, TAU); d.fill(); } }
  else if (kind === 'debris') { d.fillStyle = rgba(col, a); for (let i = 0; i < 7; i++) { const aa = rnd() * TAU, rr2 = rnd() * r; d.fillRect(x + cos(aa) * rr2, y + sin(aa) * rr2, 2 + rnd() * 4, 2 + rnd() * 4); } }
  else if (kind === 'glow') { d.globalAlpha = a; d.drawImage(lightSprite(col), x - r, y - r, r * 2, r * 2); d.globalAlpha = 1; }
}
function decalsFade(dt) { DEC.fadeT += dt; if (DEC.fadeT < .5) return; DEC.fadeT = 0; const d = DEC.x; d.setTransform(1, 0, 0, 1, 0, 0);
  d.globalCompositeOperation = 'destination-out'; d.fillStyle = `rgba(0,0,0,${T.fx.decalFade})`; d.fillRect(0, 0, DEC.c.width, DEC.c.height); d.globalCompositeOperation = 'source-over'; }

// ---- world texts (damage numbers etc.) ----------------------------------------------------------
const TEXTS = [];
function wtext(x, y, txt, col, size = 9, life = .7, vy = -55) {
  if (TEXTS.length >= T.fx.dmgNumbers) TEXTS.shift();
  TEXTS.push({ x: x + (rnd() - .5) * 8, y, txt, col, size, t: life, d: life, vy });
}
function dmgNumber(x, y, v, crit, col) { if (!G.settings.dmgNumbers) return; wtext(x, y - 6, crit ? fmt(v) + '!' : fmt(v), crit ? bpal()[1] : col || '#ffffff', crit ? 12 : 8.5, crit ? .8 : .55, crit ? -75 : -55); }

// ---- telegraphs (ground markers for enemy attacks) -------------------------------------------------
const TELE = [];
function tele(type, x, y, a, b, dur, col = '#ff2a4a', ang = 0, owner = null) { const t = { type, x, y, a, b, ang, t: 0, dur, col, owner }; TELE.push(t); return t; }
function updateTele(dt) { for (let i = TELE.length - 1; i >= 0; i--) { const t = TELE[i]; t.t += dt; if (t.t >= t.dur || (t.owner && t.owner.dead)) TELE.splice(i, 1); } }
function drawTele(ctx) {
  for (const t of TELE) {
    const f = sat(t.t / t.dur), pulse = .55 + .45 * sin(G.rt * 30);
    ctx.strokeStyle = ctx.fillStyle = t.col; ctx.lineWidth = 1.6;
    if (t.type === 'circle') { // a = radius
      xf(ctx, t.x, t.y, 0, 1, 1); ctx.globalAlpha = .12 + .1 * f; ctx.beginPath(); ctx.arc(0, 0, t.a, 0, TAU); ctx.fill();
      ctx.globalAlpha = .45 + .4 * f * pulse; ctx.beginPath(); ctx.arc(0, 0, t.a, 0, TAU); ctx.stroke();
      ctx.globalAlpha = .35; ctx.beginPath(); ctx.arc(0, 0, t.a * f, 0, TAU); ctx.fill();
    } else if (t.type === 'line') { // a = length, b = half width
      xf(ctx, t.x, t.y, t.ang, 1, 1); ctx.globalAlpha = .1 + .12 * f; ctx.fillRect(0, -t.b, t.a, t.b * 2);
      ctx.globalAlpha = .5 + .4 * f * pulse; ctx.strokeRect(0, -t.b, t.a, t.b * 2); ctx.globalAlpha = .35; ctx.fillRect(0, -t.b, t.a * f, t.b * 2);
    } else if (t.type === 'ring') { // expanding ring warning: a = inner, b = outer
      xf(ctx, t.x, t.y, 0, 1, 1); ctx.globalAlpha = .2 + .3 * f * pulse; ctx.lineWidth = t.b - t.a; ctx.beginPath(); ctx.arc(0, 0, (t.a + t.b) / 2, 0, TAU); ctx.stroke();
    } else if (t.type === 'cone') { // a = radius, b = half angle
      xf(ctx, t.x, t.y, t.ang, 1, 1); ctx.globalAlpha = .1 + .15 * f; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, t.a, -t.b, t.b); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = .5 * pulse + .3; ctx.stroke();
    } else if (t.type === 'mark') { // x marker (phantom)
      xf(ctx, t.x, t.y, G.rt * 3, 1, 1); ctx.globalAlpha = .5 + .5 * pulse; ctx.lineWidth = 2.5; const r = t.a * (1.4 - f * .4);
      ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(r, -r); ctx.lineTo(-r, r); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, t.a * (1 - f) + 4, 0, TAU); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

// ---- instantaneous beams / bolts (rail, arc, lasers) -------------------------------------------------
const BEAMS = [];
function beamFx(x1, y1, x2, y2, col, w, life, jag = 0) {
  if (BEAMS.length > 120) BEAMS.shift();
  const pts = [x1, y1]; if (jag > 0) { const n = max(2, floor(hypot(x2 - x1, y2 - y1) / 18)); for (let i = 1; i < n; i++) { const t = i / n; pts.push(lerp(x1, x2, t) + (rnd() - .5) * jag, lerp(y1, y2, t) + (rnd() - .5) * jag); } }
  pts.push(x2, y2); BEAMS.push({ pts, col, w, t: life, d: life });
}
function drawBeams(ctx, dt) {
  camXf(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = BEAMS.length - 1; i >= 0; i--) {
    const b = BEAMS[i]; b.t -= dt; if (b.t <= 0) { BEAMS.splice(i, 1); continue; }
    const f = b.t / b.d, p = b.pts; ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (let k = 2; k < p.length; k += 2) ctx.lineTo(p[k], p[k + 1]);
    ctx.globalAlpha = f; ctx.strokeStyle = b.col; ctx.lineWidth = b.w * (.5 + f * .8); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = b.w * .35 * f; ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.lineCap = 'butt';
}

// ---- room rendering --------------------------------------------------------------------------------
function buildRoomPaths(room) {
  const ts = T.tile, w = room.w, h = room.h, t = room.tiles, rng = new RNG(room.seed + 'paint');
  const wall = new Path2D(), edge = new Path2D(), f2 = new Path2D(), grid = new Path2D(), deco = new Path2D();
  const solid = (x, y) => x < 0 || y < 0 || x >= w || y >= h || t[y * w + x] === 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = x * ts, Y = y * ts;
    if (t[y * w + x] === 1) {
      wall.rect(X, Y, ts, ts);
      if (!solid(x, y - 1)) { edge.moveTo(X, Y); edge.lineTo(X + ts, Y); } if (!solid(x, y + 1)) { edge.moveTo(X, Y + ts); edge.lineTo(X + ts, Y + ts); }
      if (!solid(x - 1, y)) { edge.moveTo(X, Y); edge.lineTo(X, Y + ts); } if (!solid(x + 1, y)) { edge.moveTo(X + ts, Y); edge.lineTo(X + ts, Y + ts); }
    } else {
      if ((x + y) % 2 === 0 && rng.chance(.5)) f2.rect(X + 1, Y + 1, ts - 2, ts - 2);
      if (rng.chance(.06)) { const cx = X + rng.int(6, 26), cy = Y + rng.int(6, 26); deco.moveTo(cx, cy); deco.lineTo(cx + rng.pick([-1, 1]) * rng.int(6, 14), cy); deco.rect(cx - 1.5, cy - 1.5, 3, 3); }
    }
  }
  for (let x = 0; x <= w; x++) { grid.moveTo(x * ts, 0); grid.lineTo(x * ts, h * ts); }
  for (let y = 0; y <= h; y++) { grid.moveTo(0, y * ts); grid.lineTo(w * ts, y * ts); }
  room.paths = { wall, edge, f2, grid, deco };
}
function drawRoom(ctx, room, bio) {
  const ts = T.tile, P2 = room.paths; camXf();
  ctx.fillStyle = bio.floor; ctx.fillRect(0, 0, room.w * ts, room.h * ts);
  ctx.fillStyle = bio.floor2; ctx.fill(P2.f2);
  ctx.strokeStyle = bio.grid; ctx.lineWidth = 1; ctx.globalAlpha = .55; ctx.stroke(P2.grid); ctx.globalAlpha = .7; ctx.lineWidth = 1.2; ctx.stroke(P2.deco); ctx.globalAlpha = 1;
  ctx.drawImage(DEC.c, 0, 0, room.w * ts, room.h * ts);
  drawHazards(ctx, room, bio);
}
function drawWalls(ctx, room, bio) {
  const P2 = room.paths, ts = T.tile; camXf();
  ctx.fillStyle = bio.wall; ctx.fill(P2.wall);
  ctx.strokeStyle = bio.top; ctx.lineWidth = 6; ctx.globalAlpha = .6; ctx.stroke(P2.edge); ctx.globalAlpha = 1;
  ctx.strokeStyle = bio.edge; ctx.lineWidth = 1.8; ctx.stroke(P2.edge);
  // destructible cover
  for (const i of room.coverList) {
    if (room.tiles[i] !== 2) continue; const x = (i % room.w) * ts, y = floor(i / room.w) * ts, f = room.hp[i] / T.room.coverHp;
    ctx.fillStyle = bio.top; ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4); ctx.strokeStyle = bio.acc; ctx.globalAlpha = .45 + .55 * f; ctx.lineWidth = 1.5; ctx.strokeRect(x + 3, y + 3, ts - 6, ts - 6);
    ctx.beginPath(); ctx.moveTo(x + 7, y + 7); ctx.lineTo(x + ts - 7, y + ts - 7); if (f < .66) { ctx.moveTo(x + ts - 7, y + 7); ctx.lineTo(x + 12, y + 18); } ctx.stroke(); ctx.globalAlpha = 1;
  }
  // doors
  for (const d of room.doors) {
    const x = d.x * ts, y = d.y * ts, open = room.open, horiz = d.horiz, len = d.len * ts;
    ctx.fillStyle = open ? 'rgba(80,255,170,.12)' : 'rgba(255,40,70,.18)';
    if (horiz) ctx.fillRect(x, y, len, ts); else ctx.fillRect(x, y, ts, len);
    if (!open) { ctx.strokeStyle = '#ff2a4a'; ctx.lineWidth = 2.2; ctx.beginPath(); for (let k = 0; k <= d.len * 2; k++) { if (horiz) { ctx.moveTo(x + k * ts / 2, y + 4); ctx.lineTo(x + k * ts / 2, y + ts - 4); } else { ctx.moveTo(x + 4, y + k * ts / 2); ctx.lineTo(x + ts - 4, y + k * ts / 2); } } ctx.stroke(); }
    else { ctx.strokeStyle = '#50ffaa'; ctx.lineWidth = 2; ctx.globalAlpha = .5 + .5 * sin(G.rt * 5); if (horiz) ctx.strokeRect(x + 2, y + 2, len - 4, ts - 4); else ctx.strokeRect(x + 2, y + 2, ts - 4, len - 4); ctx.globalAlpha = 1; }
  }
}
function drawHazards(ctx, room, bio) {
  const ts = T.tile, t = G.rt;
  for (const hz of room.hazards) {
    const i = hz.i, x = (i % room.w) * ts, y = floor(i / room.w) * ts;
    switch (hz.k) {
      case 'lava': { const p = .7 + .3 * sin(t * 2 + i); ctx.fillStyle = `rgba(255,${round(70 + 50 * p)},20,${.55 + .25 * p})`; ctx.fillRect(x, y, ts, ts); ctx.fillStyle = 'rgba(255,220,90,.35)';
        ctx.fillRect(x + 6 + 8 * sin(t + i), y + 10, 8, 4); break; }
      case 'acid': { const p = .6 + .4 * sin(t * 1.7 + i * 1.3); ctx.fillStyle = `rgba(110,255,40,${.25 + .15 * p})`; ctx.fillRect(x, y, ts, ts); ctx.fillStyle = 'rgba(200,255,120,.45)';
        ctx.beginPath(); ctx.arc(x + 10 + 10 * sin(i), y + 16 + 6 * cos(t * 2 + i), 2.5 * p, 0, TAU); ctx.fill(); break; }
      case 'ice': { ctx.fillStyle = 'rgba(160,230,255,.13)'; ctx.fillRect(x, y, ts, ts); ctx.strokeStyle = 'rgba(200,240,255,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 4, y + 24); ctx.lineTo(x + 20, y + 8); ctx.stroke(); break; }
      case 'elec': { const st = hz.st; // 0 off,1 warn,2 on
        ctx.strokeStyle = st === 2 ? '#ffffff' : st === 1 ? '#ffe23a' : rgba(bio.acc, .35); ctx.lineWidth = st === 2 ? 2 : 1.2; ctx.globalAlpha = st === 1 ? (.4 + .6 * (sin(t * 40) > 0)) : 1;
        ctx.strokeRect(x + 3, y + 3, ts - 6, ts - 6); if (st === 2) { ctx.fillStyle = 'rgba(190,160,255,.35)'; ctx.fillRect(x + 3, y + 3, ts - 6, ts - 6); ctx.beginPath(); ctx.moveTo(x + 4, y + 4 + rnd() * 24); for (let k = 1; k < 4; k++) ctx.lineTo(x + 4 + k * 8, y + 4 + rnd() * 24); ctx.stroke(); }
        ctx.globalAlpha = 1; break; }
      case 'spike': { const st = hz.st; ctx.fillStyle = st === 1 ? 'rgba(255,40,70,.35)' : 'rgba(255,255,255,.05)'; ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
        ctx.fillStyle = st === 2 ? '#e8ecff' : 'rgba(180,180,200,.35)'; for (let k = 0; k < 4; k++) { const sx = x + 8 + (k % 2) * 16, sy = y + 8 + (k >> 1) * 16;
          if (st === 2) { ctx.beginPath(); ctx.moveTo(sx - 4, sy + 4); ctx.lineTo(sx, sy - 6); ctx.lineTo(sx + 4, sy + 4); ctx.fill(); } else ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3); } break; }
    }
  }
}

// ---- WebGL post-processing --------------------------------------------------------------------------
const GLPost = {
  init() {
    const gl = R.glc.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) return false; this.gl = gl;
    const vs = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
    const head = 'precision mediump float;varying vec2 v;uniform sampler2D s;uniform vec2 px;';
    this.pBright = this.prog(vs, head + 'uniform float th;void main(){vec3 c=(texture2D(s,v+px*vec2(-1.,-1.)).rgb+texture2D(s,v+px*vec2(1.,-1.)).rgb+texture2D(s,v+px*vec2(-1.,1.)).rgb+texture2D(s,v+px*vec2(1.,1.)).rgb)*.25;' +
      'float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(th,th+.35,l),1.);}');
    this.pBlur = this.prog(vs, head + 'uniform vec2 dir;void main(){vec3 c=texture2D(s,v).rgb*.2270;' +
      'c+=(texture2D(s,v+dir*1.3846).rgb+texture2D(s,v-dir*1.3846).rgb)*.3162;c+=(texture2D(s,v+dir*3.2308).rgb+texture2D(s,v-dir*3.2308).rgb)*.0703;gl_FragColor=vec4(c,1.);}');
    this.pComp = this.prog(vs, head + 'uniform sampler2D b;uniform sampler2D b2;uniform float ab,desat,vig,flash,crt,time,bloom;uniform vec3 tint;' +
      'void main(){vec2 uv=v;if(crt>0.){vec2 d=uv-.5;uv=.5+d*(1.+dot(d,d)*.12);if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.){gl_FragColor=vec4(0.,0.,0.,1.);return;}}' +
      'vec2 d=uv-.5;float r2=dot(d,d);vec3 c;c.r=texture2D(s,uv+d*ab).r;c.g=texture2D(s,uv).g;c.b=texture2D(s,uv-d*ab).b;' +
      'c+=(texture2D(b,uv).rgb*.8+texture2D(b2,uv).rgb*.7)*bloom;float l=dot(c,vec3(.299,.587,.114));c=mix(c,vec3(l)*vec3(1.05,.95,.95),desat);' +
      'c*=1.-smoothstep(.12,.85,r2*1.7)*(.35+vig*.5);c=mix(c,c*vec3(1.4,.35,.4)+vec3(.12,0.,.01),vig*smoothstep(.05,.6,r2*2.)*.85);c*=tint;c+=flash;' +
      'if(crt>0.){c*=.86+.14*sin(uv.y*px.y*3.14159);c*=.95+.05*sin(time*90.+uv.y*20.);}gl_FragColor=vec4(c,1.);}');
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.tex = this.mkTex(); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    return true;
  },
  prog(vs, fs) {
    const gl = this.gl, p = gl.createProgram();
    for (const [t, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); gl.attachShader(p, s); }
    gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); } return { p, u };
  },
  mkTex() { const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; },
  mkFbo(w, h) { const gl = this.gl, t = this.mkTex(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null); return { t, f, w, h }; },
  resize(W, H) { R.glc.width = W; R.glc.height = H; const w = max(1, W >> 2), h = max(1, H >> 2), w2 = max(1, W >> 3), h2 = max(1, H >> 3);
    this.A = this.mkFbo(w, h); this.B = this.mkFbo(w, h); this.C = this.mkFbo(w2, h2); this.D = this.mkFbo(w2, h2); },
  pass(pr, src, dst, w, h, set) { const gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.f : null); gl.viewport(0, 0, w, h); gl.useProgram(pr.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform1i(pr.u.s, 0); if (pr.u.px) gl.uniform2f(pr.u.px, 1 / w, 1 / h); if (set) set(pr.u);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 3); },
  draw() {
    const gl = this.gl, s = G.settings, W = R.W, H = R.H;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, R.scene);
    const bloom = s.bloom;
    if (bloom > 0) {
      const A2 = this.A, B2 = this.B, C2 = this.C, D2 = this.D;
      this.pass(this.pBright, this.tex, A2, A2.w, A2.h, u => { gl.uniform2f(u.px, .5 / A2.w, .5 / A2.h); gl.uniform1f(u.th, .55); });
      for (let i = 0; i < 2; i++) { this.pass(this.pBlur, A2.t, B2, B2.w, B2.h, u => gl.uniform2f(u.dir, 1 / B2.w, 0)); this.pass(this.pBlur, B2.t, A2, A2.w, A2.h, u => gl.uniform2f(u.dir, 0, 1 / A2.h)); }
      this.pass(this.pBlur, A2.t, C2, C2.w, C2.h, u => gl.uniform2f(u.dir, 1.5 / A2.w, 0)); this.pass(this.pBlur, C2.t, D2, D2.w, D2.h, u => gl.uniform2f(u.dir, 0, 1.5 / C2.h));
      this.pass(this.pBlur, D2.t, C2, C2.w, C2.h, u => gl.uniform2f(u.dir, 1.5 / C2.w, 0)); this.pass(this.pBlur, C2.t, D2, D2.w, D2.h, u => gl.uniform2f(u.dir, 0, 1.5 / C2.h));
    }
    const fl = s.flashReduce ? .25 : 1;
    this.pass(this.pComp, this.tex, null, W, H, u => {
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.A.t); gl.uniform1i(u.b, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.D.t); gl.uniform1i(u.b2, 2);
      gl.uniform2f(u.px, 1 / W, H); gl.uniform1f(u.ab, R.ab * fl * (s.reducedMotion ? .3 : 1)); gl.uniform1f(u.desat, R.lowHp * .75);
      gl.uniform1f(u.vig, R.lowHp); gl.uniform1f(u.flash, min(.6, R.flash * fl)); gl.uniform1f(u.crt, s.crt ? 1 : 0); gl.uniform1f(u.time, G.rt % 100);
      gl.uniform1f(u.bloom, bloom); gl.uniform3f(u.tint, 1, 1, 1);
      gl.activeTexture(gl.TEXTURE0);
    });
  },
};
function screenFlash(v) { R.flash = max(R.flash, v); }
function aberrate(v) { R.ab = max(R.ab, v); }

// ---- master render ---------------------------------------------------------------------------------
function render(alpha, dt, wdt) {
  const ctx = R.c;
  updateCamera(dt, alpha);
  updateParticles(wdt); updateTele(wdt);
  R.flash = max(0, R.flash - dt * 4); R.ab = max(0, R.ab - dt * .03);
  const hpF = G.player && G.state === 'play' ? G.player.hp / G.player.maxHp : 1;
  R.lowHp = lerp(R.lowHp, hpF < T.fx.lowHp ? (1 - hpF / T.fx.lowHp) * .7 + .3 * (.5 + .5 * sin(G.rt * 6)) * (1 - hpF / T.fx.lowHp) : 0, 1 - exp(-dt * 5));
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  const room = G.room, bio = T.BIO[room ? room.biome : 0];
  ctx.fillStyle = bio.bg; ctx.fillRect(0, 0, R.W, R.H);
  if (room && room.paths) {
    decalsFade(wdt);
    drawRoom(ctx, room, bio);
    drawWalls(ctx, room, bio);
    drawWorld(ctx, alpha, wdt);
    // lighting
    if (G.settings.lighting) { for (const l of room.lights) light(l.x, l.y, l.r, l.c, l.a * (.85 + .15 * sin(G.rt * 3 + l.x))); queueLights(alpha);
      for (let i = FLASHES.length - 1; i >= 0; i--) { const f = FLASHES[i]; f.t -= dt; if (f.t <= 0) { FLASHES.splice(i, 1); continue; } light(f.x, f.y, f.r, f.col, f.a * f.t / f.d); }
      renderLighting(ctx, room.amb || bio.amb); } else { LQ.n = 0; FLASHES.length = 0; }
    drawActors(ctx, alpha);
    // emissive layer
    camXf(); ctx.globalCompositeOperation = 'lighter'; drawTele(ctx); camXf(); drawParticles(ctx, 1); drawBeams(ctx, wdt); drawEmissive(ctx, alpha);
    ctx.globalCompositeOperation = 'source-over'; drawEnemyBullets(ctx, alpha); drawWorldText(ctx, wdt);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (R.gl) GLPost.draw();
  drawHUD(dt, alpha);
}
function drawWorldText(ctx, dt) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (let i = TEXTS.length - 1; i >= 0; i--) {
    const t = TEXTS[i]; t.t -= dt; if (t.t <= 0) { TEXTS.splice(i, 1); continue; }
    t.y += t.vy * dt; t.vy *= 1 - dt * 3; const f = t.t / t.d, pop = f > .8 ? 1 + (f - .8) * 2.5 : 1;
    xf(ctx, t.x, t.y, 0, pop, pop); ctx.globalAlpha = min(1, f * 2.5); ctx.font = `800 ${t.size}px ${'Segoe UI,Arial'}`;
    ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 2.6; ctx.strokeText(t.txt, 0, 0); ctx.fillStyle = t.col; ctx.fillText(t.txt, 0, 0);
  }
  ctx.globalAlpha = 1;
}
