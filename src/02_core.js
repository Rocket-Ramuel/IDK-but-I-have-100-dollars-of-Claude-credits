// =====================================================================================
// SECTION 2 — CORE: math, RNG, input, spatial hash, loop
// =====================================================================================
const TAU = Math.PI * 2, PI = Math.PI, { sin, cos, atan2, sqrt, abs, min, max, floor, ceil, round, hypot, sign, exp, pow, log } = Math;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, sat = v => v < 0 ? 0 : v > 1 ? 1 : v;
const angDiff = (a, b) => { let d = (b - a) % TAU; return d > PI ? d - TAU : d < -PI ? d + TAU : d; };
const lerpAng = (a, b, t) => a + angDiff(a, b) * t;
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
const smooth = t => t * t * (3 - 2 * t), easeOut = t => 1 - (1 - t) * (1 - t), easeOutBack = t => 1 + 2.7 * pow(t - 1, 3) + 1.7 * pow(t - 1, 2);
const rnd = Math.random, rr = (a, b) => a + (b - a) * rnd(), ri = (a, b) => a + floor(rnd() * (b - a + 1)), rpick = a => a[floor(rnd() * a.length)];
const fmt = n => n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : '' + round(n);
const fmtTime = s => `${floor(s / 60)}:${String(floor(s % 60)).padStart(2, '0')}`;
const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgba = (h, a) => { const c = hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
const mixHex = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return '#' + x.map((v, i) => round(lerp(v, y[i], t)).toString(16).padStart(2, '0')).join(''); };

// ---- seeded RNG (sfc32 seeded by xmur3 string hash) -------------------------------------
function xmur3(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return (h ^= h >>> 16) >>> 0; }; }
class RNG {
  constructor(seed) { const g = xmur3(String(seed)); this.a = g(); this.b = g(); this.c = g(); this.d = g(); for (let i = 0; i < 15; i++) this.next(); }
  next() { let a = this.a >>> 0, b = this.b >>> 0, c = this.c >>> 0, d = this.d >>> 0, t = (a + b | 0) + d | 0;
    this.d = d + 1 | 0; this.a = b ^ b >>> 9; this.b = c + (c << 3) | 0; c = c << 21 | c >>> 11; this.c = c + t | 0; return (t >>> 0) / 4294967296; }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return a + floor(this.next() * (b - a + 1)); }
  pick(arr) { return arr[floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  weighted(obj) { let s = 0; for (const k in obj) s += obj[k]; let r = this.next() * s; for (const k in obj) if ((r -= obj[k]) <= 0) return k; return Object.keys(obj)[0]; }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = floor(this.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
}
const randomSeed = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 8; i++) s += c[floor(rnd() * c.length)]; return s; };

// ---- input -------------------------------------------------------------------------------
const ACTIONS = ['up', 'down', 'left', 'right', 'fire', 'ability', 'dash', 'act1', 'act2', 'reload', 'swap', 'interact', 'build', 'pause'];
const ACTION_NAMES = { up: 'Move Up', down: 'Move Down', left: 'Move Left', right: 'Move Right', fire: 'Fire', ability: 'Ability', dash: 'Dash', act1: 'Active 1',
  act2: 'Active 2', reload: 'Reload', swap: 'Swap Weapon', interact: 'Interact', build: 'Build Overview', pause: 'Pause' };
// [primary, secondary, gamepad]
const DEFAULT_BINDS = { up: ['KeyW', 'ArrowUp', ''], down: ['KeyS', 'ArrowDown', ''], left: ['KeyA', 'ArrowLeft', ''], right: ['KeyD', 'ArrowRight', ''],
  fire: ['Mouse0', '', 'Pad7'], ability: ['Mouse2', '', 'Pad6'], dash: ['Space', 'ShiftLeft', 'Pad4'], act1: ['KeyQ', '', 'Pad2'], act2: ['KeyE', '', 'Pad1'],
  reload: ['KeyR', '', 'Pad10'], swap: ['KeyX', 'Wheel', 'Pad3'], interact: ['KeyF', '', 'Pad5'], build: ['Tab', '', 'Pad8'], pause: ['Escape', 'KeyP', 'Pad9'] };
const IN = {
  binds: JSON.parse(JSON.stringify(DEFAULT_BINDS)), held: Object.create(null), hits: Object.create(null), down: Object.create(null),
  mx: 0, my: 0, wx: 0, wy: 0, moveX: 0, moveY: 0, aimAng: 0, padAim: false, device: 'kb', pad: null, padHeld: [], rebind: null,
  stickX: 0, stickY: 0, lastPadMove: 0,
  codeDown(code) {
    if (this.rebind) { this.rebind(code); return; }
    if (this.held[code]) return; this.held[code] = true;
    for (const a of ACTIONS) if (this.binds[a].includes(code)) this.hits[a] = (this.hits[a] || 0) + 1;
    onActionPress(code);
  },
  codeUp(code) { this.held[code] = false; },
  take(a) { if (this.hits[a] > 0) { this.hits[a] = 0; return true; } return false; },
  clearHits() { for (const a of ACTIONS) this.hits[a] = 0; },
  update() {
    for (const a of ACTIONS) { const b = this.binds[a]; this.down[a] = !!(this.held[b[0]] || this.held[b[1]] || this.held[b[2]]); }
    let mx = (this.down.right ? 1 : 0) - (this.down.left ? 1 : 0), my = (this.down.down ? 1 : 0) - (this.down.up ? 1 : 0);
    if (this.pad && (abs(this.stickX) > 0 || abs(this.stickY) > 0)) { mx = this.stickX; my = this.stickY; }
    const l = hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
    this.moveX = mx; this.moveY = my;
  },
};
const isTyping = e => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT');
addEventListener('keydown', e => {
  if (isTyping(e) && !IN.rebind) return;
  if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F3', 'F4', 'F5', 'F6'].includes(e.code) || IN.rebind) e.preventDefault();
  IN.device = 'kb'; if (!e.repeat) IN.codeDown(e.code);
});
addEventListener('keyup', e => IN.codeUp(e.code));
addEventListener('mousemove', e => { IN.mx = e.clientX; IN.my = e.clientY; IN.device = 'kb'; IN.padAim = false; });
addEventListener('mousedown', e => { if (e.target.closest && e.target.closest('#ui .panel,#ui .btn,#ui .card')) return; IN.device = 'kb'; IN.codeDown('Mouse' + e.button); });
addEventListener('mouseup', e => IN.codeUp('Mouse' + e.button));
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => { if (G.state === 'play') { IN.codeDown('Wheel'); IN.codeUp('Wheel'); } }, { passive: true });
addEventListener('blur', () => { for (const k in IN.held) IN.held[k] = false; });

const PAD_DEAD = .22;
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : []; let p = null;
  for (const q of pads) if (q && q.connected) { p = q; break; }
  IN.pad = p; if (!p) { IN.stickX = IN.stickY = 0; return; }
  const ax = (i) => { const v = p.axes[i] || 0; return abs(v) < PAD_DEAD ? 0 : (v - sign(v) * PAD_DEAD) / (1 - PAD_DEAD); };
  IN.stickX = ax(0); IN.stickY = ax(1);
  const rx = ax(2), ry = ax(3);
  if (hypot(rx, ry) > .35) { IN.aimAng = atan2(ry, rx); IN.padAim = true; IN.device = 'pad'; }
  if (abs(IN.stickX) + abs(IN.stickY) > .3) IN.device = 'pad';
  for (let i = 0; i < p.buttons.length; i++) {
    const b = p.buttons[i], d = b.pressed || b.value > .5, code = 'Pad' + i;
    if (d && !IN.padHeld[i]) { IN.device = 'pad'; IN.codeDown(code); padUiPress(i); }
    else if (!d && IN.padHeld[i]) IN.codeUp(code);
    IN.padHeld[i] = d;
  }
  // stick navigation for menus
  const now = performance.now();
  if (G.state !== 'play' && now - IN.lastPadMove > 180) {
    if (IN.stickY < -.6) { padUiPress(12); IN.lastPadMove = now; } else if (IN.stickY > .6) { padUiPress(13); IN.lastPadMove = now; }
    else if (IN.stickX < -.6) { padUiPress(14); IN.lastPadMove = now; } else if (IN.stickX > .6) { padUiPress(15); IN.lastPadMove = now; }
  }
}
const bindLabel = c => !c ? '—' : c.startsWith('Key') ? c.slice(3) : c.startsWith('Digit') ? c.slice(5) : c === 'Mouse0' ? 'LMB' : c === 'Mouse2' ? 'RMB' : c === 'Mouse1' ? 'MMB' :
  c.startsWith('Pad') ? (['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'LS', 'RS', 'Up', 'Down', 'Left', 'Right'][+c.slice(3)] || c) : c.replace('Left', 'L').replace('Right', 'R');

// ---- spatial hash (counting sort into typed arrays; zero allocation per tick) -------------
class Grid {
  constructor(cs, cap) { this.cs = cs; this.cap = cap; this.items = new Int32Array(cap); this.cellOf = new Int32Array(cap); this.out = new Int32Array(cap); }
  reset(w, h) { this.cols = ceil(w / this.cs) + 2; this.rows = ceil(h / this.cs) + 2; this.start = new Int32Array(this.cols * this.rows + 1); this.cnt = new Int32Array(this.cols * this.rows); }
  cell(x, y) { const cx = clamp(floor(x / this.cs) + 1, 0, this.cols - 1), cy = clamp(floor(y / this.cs) + 1, 0, this.rows - 1); return cy * this.cols + cx; }
  build(list) {
    const n = min(list.length, this.cap), cnt = this.cnt, st = this.start; cnt.fill(0);
    for (let i = 0; i < n; i++) { const c = this.cell(list[i].x, list[i].y); this.cellOf[i] = c; cnt[c]++; }
    let s = 0; for (let c = 0; c < cnt.length; c++) { st[c] = s; s += cnt[c]; cnt[c] = st[c]; } st[cnt.length] = s;
    for (let i = 0; i < n; i++) this.items[cnt[this.cellOf[i]]++] = i;
    this.list = list;
  }
  // fills this.out with indices into list; returns count
  query(x, y, r) {
    const cs = this.cs, x0 = clamp(floor((x - r) / cs) + 1, 0, this.cols - 1), x1 = clamp(floor((x + r) / cs) + 1, 0, this.cols - 1);
    const y0 = clamp(floor((y - r) / cs) + 1, 0, this.rows - 1), y1 = clamp(floor((y + r) / cs) + 1, 0, this.rows - 1);
    let n = 0; const out = this.out, st = this.start, it = this.items;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { const c = cy * this.cols + cx; for (let k = st[c], e = st[c + 1]; k < e; k++) out[n++] = it[k]; }
    return n;
  }
}

// ---- global game state ---------------------------------------------------------------------
const G = {
  state: 'boot', time: 0, rt: 0, tick: 0, timeScale: 1, tsTarget: 1, tsTimer: 0, hitstop: 0, enemyTS: 1, paused: false,
  run: null, room: null, player: null, enemies: [], bullets: [], ebullets: [], pickups: [], props: [], allies: [], zones: [], fxq: [],
  grid: new Grid(64, 2048), cam: { x: 0, y: 0, px: 0, py: 0, zoom: 1, zt: 1, trauma: 0, sx: 0, sy: 0, rot: 0, focus: null, focusT: 0 },
  settings: null, meta: null, qpad: 28, alive: 0, debug: { fps: false, ai: false, flow: false, hit: false, stress: false }, bot: false,
  stats: { frameMs: 0, simMs: 0, renderMs: 0, fps: 60, ticks: 0 },
};
const STEP = 1 / T.sim.hz;

// ---- main loop -----------------------------------------------------------------------------
let lastT = 0, acc = 0, fpsAcc = 0, fpsN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const t0 = performance.now();
  let dt = lastT ? min(.1, (now - lastT) / 1000) : STEP; lastT = now; G.rt += dt;
  pollPad(); IN.update();
  let wdt = 0; // world dt this frame (for particles/visual sim)
  const s0 = performance.now();
  if (G.state === 'play' && !G.paused) {
    G.timeScale = lerp(G.timeScale, G.tsTimer > 0 ? G.tsTarget : 1, 1 - exp(-dt * 14));
    if (G.tsTimer > 0) G.tsTimer -= dt;
    if (G.hitstop > 0) G.hitstop -= dt;
    else {
      const gs = G.settings.gameSpeed * G.timeScale; wdt = dt * gs; acc += wdt;
      let steps = 0; while (acc >= STEP && steps < T.sim.maxSteps) { simTick(STEP); acc -= STEP; steps++; }
      if (steps === T.sim.maxSteps) acc = 0;
    }
  } else if (G.state === 'title') { acc += dt; let s = 0; while (acc >= STEP && s < 4) { attractTick(STEP); acc -= STEP; s++; } if (s === 4) acc = 0; wdt = dt; }
  else acc = 0;
  const s1 = performance.now();
  render(clamp(acc / STEP, 0, 1), dt, wdt);
  const t1 = performance.now();
  G.stats.simMs = lerp(G.stats.simMs, s1 - s0, .1); G.stats.renderMs = lerp(G.stats.renderMs, t1 - s1, .1); G.stats.frameMs = lerp(G.stats.frameMs, t1 - t0, .1);
  fpsAcc += dt; fpsN++; if (fpsAcc > .5) { G.stats.fps = fpsN / fpsAcc; fpsAcc = fpsN = 0; }
}
// slow motion + hitstop helpers
function slowmo(scale, dur) { if (G.settings.reducedMotion && scale < .5) scale = .5; G.tsTarget = scale; G.tsTimer = max(G.tsTimer, dur); }
function hitstop(s) { G.hitstop = min(T.fx.hitstopCap, max(G.hitstop, s * (G.settings.hitstop ? 1 : 0))); }
function trauma(v) { G.cam.trauma = min(T.fx.maxTrauma, G.cam.trauma + v); }
