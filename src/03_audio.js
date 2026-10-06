// =====================================================================================
// SECTION 3 — AUDIO: bus graph, voice manager, procedural SFX, adaptive music
// =====================================================================================
const A = {
  ctx: null, ok: false, voices: Object.create(null), nVoices: 0, loops: Object.create(null), noiseBuf: null, hbT: 0,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
      const g = () => c.createGain();
      this.master = g(); this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.knee.value = 8; this.comp.ratio.value = 6; this.comp.attack.value = .004; this.comp.release.value = .18;
      this.lim = c.createDynamicsCompressor(); this.lim.threshold.value = -2; this.lim.knee.value = 0; this.lim.ratio.value = 20; this.lim.attack.value = .001; this.lim.release.value = .08;
      this.master.connect(this.comp); this.comp.connect(this.lim); this.lim.connect(c.destination);
      this.sfx = g(); this.sfx.connect(this.master);
      this.duckS = g(); this.duckS.connect(this.sfx); // minor sfx path, ducked by big events
      this.music = g(); this.music.connect(this.master); this.duckM = g(); this.duckM.connect(this.music);
      this.ui = g(); this.ui.connect(this.master);
      const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1; this.noiseBuf = b;
      this.ok = true; this.applyVolumes(); MUS.init();
    } catch (e) { console.warn('audio unavailable', e); }
  },
  applyVolumes() { if (!this.ok) return; const s = G.settings, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.vMaster, t, .02); this.sfx.gain.setTargetAtTime(s.vSfx, t, .02); this.music.gain.setTargetAtTime(s.vMusic * .55, t, .02); this.ui.gain.setTargetAtTime(s.vUi, t, .02); },
  duck(amount, dur) { if (!this.ok) return; const t = this.ctx.currentTime;
    for (const g of [this.duckM.gain, this.duckS.gain]) { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(1 - amount, t + .03); g.setTargetAtTime(1, t + .05 + dur * .3, dur * .35); } },
  // ---- play a one-shot. x,y world position (undefined = centered/non-spatial)
  play(name, x, y, vol = 1, pitch = 1) {
    if (CUE_LABEL[name] && !G.demo) soundCue(CUE_LABEL[name], x, y);
    if (!this.ok || G.settings.vMaster <= 0) return;
    const def = SFX[name]; if (!def || (G.demo && !def.ui)) return;
    const c = this.ctx, now = c.currentTime;
    let list = this.voices[name]; if (!list) list = this.voices[name] = [];
    for (let i = list.length - 1; i >= 0; i--) if (list[i].end < now) { list.splice(i, 1); this.nVoices--; }
    if (this.nVoices > 56 && (def.pri || 1) < 2) return; // global cap: drop low priority
    if (list.length >= (def.max || 4)) { const o = list.shift(); this.nVoices--; o.g.gain.cancelScheduledValues(now); o.g.gain.setTargetAtTime(0, now, .008); } // steal oldest
    let pan = 0, att = 1;
    if (x !== undefined) { const cm = G.cam, hw = R.vw * .5 || 400; pan = clamp((x - cm.x) / hw, -1, 1) * .7;
      const d = hypot(x - cm.x, y - cm.y), lim = hw * 1.1; if (d > lim) att = clamp(1 - (d - lim) / 700, .12, 1); }
    vol *= att * (1 + (rnd() - .5) * .16); pitch *= 1 + (rnd() - .5) * .12;
    const v = c.createGain(); v.gain.value = vol * (def.v || 1);
    const p = c.createStereoPanner(); p.pan.value = pan; v.connect(p); p.connect(def.ui ? this.ui : def.minor ? this.duckS : this.sfx);
    const dur = def.f(v, now + .004, pitch) || .3;
    list.push({ end: now + dur, g: v }); this.nVoices++;
  },
  // ---- sustained loops (beam, flamer, minigun spin, bow draw) ----
  loop(id, on, param = 1) {
    if (!this.ok) return; const c = this.ctx, t = c.currentTime; let L = this.loops[id];
    if (!on) { if (L && L.on) { L.on = false; L.g.gain.setTargetAtTime(0, t, .04); } return; }
    if (!L) { L = this.loops[id] = LOOPS[id](c); L.g.connect(this.sfx); }
    if (!L.on) { L.on = true; L.g.gain.setTargetAtTime(L.vol, t, .02); }
    if (L.set) L.set(param, t);
  },
  stopLoops() { for (const k in this.loops) this.loop(k, false); },
  heartbeat(dt, hpFrac) {
    if (!this.ok) return; this.hbT -= dt;
    if (hpFrac < T.fx.lowHp && hpFrac > 0 && this.hbT <= 0) { this.hbT = lerp(.55, .95, hpFrac / T.fx.lowHp); this.play('heart'); }
  },
};
// ---- sound visualisation: every gameplay-relevant sound also produces a directional caption (accessibility)
const CUE_LABEL = { wind: 'Wind-up', windSnipe: 'Sniper aiming', growl: 'Charge', fuse: 'Fuse lit', blink: 'Teleport', burrow: 'Burrowing', spawn: 'Enemy spawning', laser: 'Laser',
  roar: 'Roar', whistle: 'Shell incoming', mortar: 'Mortar fired', slam: 'Slam', explode: 'Explosion', eshotBig: 'Heavy shot', snipe: 'Sniper shot', hurt: 'Hit taken', ready: 'Ability ready', empty: 'Out of ammo' };
const CUES = [];
const cuesOn = () => G.settings.soundViz || !A.ok || G.settings.vMaster <= 0 || G.settings.vSfx <= 0;
function soundCue(label, x, y) {
  if (!cuesOn() || G.state !== 'play') return;
  for (const c of CUES) if (c.label === label && c.t > .8 && (x === undefined || hypot((c.x || 0) - x, (c.y || 0) - y) < 160)) { c.t = 1.2; c.x = x; c.y = y; c.n++; return; }
  if (CUES.length >= 8) CUES.shift(); CUES.push({ label, x, y, t: 1.2, n: 1 });
}
// ---- synthesis helpers --------------------------------------------------------------------
function _o(out, type, f0, f1, t, dur, peak, att = .002, sweep = dur) {
  const c = A.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(max(1, f1), t + sweep);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + .02); return o;
}
function _n(out, ftype, f0, f1, q, t, dur, peak, att = .002, rate = 1) {
  const c = A.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = A.noiseBuf; s.playbackRate.value = rate; s.loop = true; f.type = ftype; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(max(20, f1), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
  s.connect(f); f.connect(g); g.connect(out); s.start(t, rnd() * 1.5); s.stop(t + dur + .02); return f;
}
function _fm(out, cf, mf, idx, t, dur, peak, cf1 = cf) { // FM pair
  const c = A.ctx, car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
  car.frequency.setValueAtTime(cf, t); if (cf1 !== cf) car.frequency.exponentialRampToValueAtTime(cf1, t + dur);
  mod.frequency.value = mf; mg.gain.setValueAtTime(idx, t); mg.gain.exponentialRampToValueAtTime(idx * .05 + 1, t + dur);
  mod.connect(mg); mg.connect(car.frequency); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + .003); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
  car.connect(g); g.connect(out); car.start(t); mod.start(t); car.stop(t + dur + .02); mod.stop(t + dur + .02);
}
// SFX recipes: f(out, t, pitch) → duration. Layered transient + body + tail.
const SFX = {
  pistol: { max: 5, f: (o, t, p) => { _o(o, 'square', 2400 * p, 700 * p, t, .03, .18); _n(o, 'bandpass', 2200 * p, 500, 1.2, t, .09, .5); _o(o, 'sine', 180 * p, 55, t, .1, .55); return .12; } },
  smg: { max: 6, minor: 1, f: (o, t, p) => { _o(o, 'square', 2800 * p, 1100 * p, t, .02, .12); _n(o, 'bandpass', 2600 * p, 900, 1.5, t, .06, .38); _o(o, 'sine', 210 * p, 70, t, .06, .35); return .08; } },
  minigun: { max: 6, minor: 1, f: (o, t, p) => { _n(o, 'highpass', 1800 * p, 1200, .8, t, .035, .3); _o(o, 'square', 900 * p, 300, t, .03, .1); _o(o, 'sine', 140 * p, 60, t, .05, .3); return .06; } },
  shotgun: { max: 3, pri: 2, f: (o, t, p) => { _o(o, 'square', 1800 * p, 300, t, .02, .25); _n(o, 'lowpass', 4000 * p, 200, .7, t, .32, .9); _o(o, 'sine', 110 * p, 38, t, .26, .9); _n(o, 'bandpass', 900, 300, 2, t + .03, .2, .25); return .34; } },
  rocket: { max: 3, f: (o, t, p) => { _n(o, 'bandpass', 500 * p, 1800, 1.5, t, .35, .55, .03); _o(o, 'sawtooth', 160 * p, 70, t, .25, .2); _o(o, 'sine', 90, 40, t, .15, .5); return .36; } },
  rail: { max: 2, pri: 3, f: (o, t, p) => { _o(o, 'sawtooth', 4200 * p, 180, t, .32, .3, .001, .18); _n(o, 'highpass', 5000, 2000, .7, t, .12, .6); _o(o, 'sine', 70 * p, 28, t, .55, 1); _fm(o, 900 * p, 1400, 900, t, .25, .25, 300); return .56; } },
  arc: { max: 4, f: (o, t, p) => { _n(o, 'bandpass', 3200 * p, 1400, 3, t, .14, .7); _fm(o, 140 * p, 61, 600, t, .16, .35); _o(o, 'square', 3000 * p, 600, t, .02, .15); return .17; } },
  zap: { max: 6, minor: 1, f: (o, t, p) => { _n(o, 'bandpass', 4200 * p, 2200, 4, t, .09, .45); _fm(o, 220 * p, 97, 400, t, .08, .2); return .1; } },
  disc: { max: 4, f: (o, t, p) => { _o(o, 'triangle', 520 * p, 980 * p, t, .18, .3); _o(o, 'sine', 2600 * p, 2400, t, .12, .12); _n(o, 'bandpass', 1400, 3200, 2, t, .12, .2); return .2; } },
  bow: { max: 3, f: (o, t, p) => { _o(o, 'triangle', 260 * p, 110, t, .3, .5); _n(o, 'highpass', 3000, 1500, 1, t, .05, .5); _o(o, 'sine', 1300 * p, 1250, t, .2, .1); return .32; } },
  bowfull: { max: 2, f: (o, t, p) => { _o(o, 'sine', 1760, 1760, t, .25, .22); _o(o, 'sine', 2640, 2640, t + .04, .25, .16); return .3; } },
  blade: { max: 4, f: (o, t, p) => { _n(o, 'bandpass', 700 * p, 3600 * p, 3, t, .14, .5, .02); _o(o, 'sine', 1900 * p, 2600, t, .1, .08); return .15; } },
  mine: { max: 4, f: (o, t, p) => { _o(o, 'sine', 330 * p, 110, t, .1, .6); _n(o, 'lowpass', 1500, 300, 1, t, .07, .3); return .12; } },
  beep: { max: 4, minor: 1, f: (o, t, p) => { _o(o, 'square', 1700 * p, 1700 * p, t, .05, .1); return .06; } },
  empty: { max: 2, f: (o, t, p) => { _o(o, 'square', 1200, 900, t, .02, .15); _o(o, 'square', 600, 500, t + .05, .02, .1); return .08; } },
  reload: { max: 2, f: (o, t, p) => { _n(o, 'bandpass', 2400 * p, 1800, 3, t, .04, .4); _o(o, 'square', 500 * p, 300, t, .03, .12); return .06; } },
  reloaded: { max: 2, f: (o, t, p) => { _n(o, 'bandpass', 3200 * p, 2400, 3, t, .03, .45); _o(o, 'square', 900 * p, 1200, t, .04, .14); _o(o, 'triangle', 1800, 1800, t + .04, .06, .08); return .1; } },
  hit: { max: 7, minor: 1, f: (o, t, p) => { _o(o, 'square', 1100 * p, 380 * p, t, .035, .14); _n(o, 'highpass', 2500, 1500, 1, t, .025, .18); return .05; } },
  crit: { max: 4, pri: 2, f: (o, t, p) => { _o(o, 'square', 1500 * p, 500, t, .04, .16); _o(o, 'sine', 2637 * p, 2637 * p, t, .16, .14); _o(o, 'sine', 3951 * p, 3951 * p, t + .01, .14, .09); _n(o, 'highpass', 4000, 3000, 1, t, .04, .25); return .18; } },
  armor: { max: 3, minor: 1, f: (o, t, p) => { _o(o, 'square', 1250 * p, 1200, t, .05, .12); _o(o, 'sine', 3100 * p, 3000, t, .09, .1); return .1; } },
  kill: { max: 6, f: (o, t, p) => { _n(o, 'bandpass', 1500 * p, 400, 1.4, t, .14, .5); _o(o, 'sine', 420 * p, 80, t, .14, .45); _o(o, 'triangle', 900 * p, 200, t, .08, .15); return .16; } },
  killbig: { max: 3, pri: 2, f: (o, t, p) => { _n(o, 'lowpass', 3000 * p, 150, .8, t, .35, .7); _o(o, 'sine', 160 * p, 40, t, .3, .7); _o(o, 'sawtooth', 300 * p, 60, t, .2, .12); return .36; } },
  shatter: { max: 4, f: (o, t, p) => { for (let i = 0; i < 5; i++) _o(o, 'sine', (2000 + rnd() * 3500) * p, 1800, t + i * .012, .14, .09); _n(o, 'highpass', 6000, 4000, 1, t, .12, .35); return .2; } },
  explode: { max: 4, pri: 3, f: (o, t, p) => { _n(o, 'lowpass', 2600 * p, 90, .7, t, .75, 1.1); _o(o, 'sine', 95 * p, 28, t, .6, 1.1); _n(o, 'bandpass', 600, 120, 1, t + .04, .5, .35, .03); _o(o, 'square', 1200, 200, t, .02, .3); return .8; } },
  explodeS: { max: 5, pri: 2, f: (o, t, p) => { _n(o, 'lowpass', 2200 * p, 140, .7, t, .35, .7); _o(o, 'sine', 140 * p, 40, t, .28, .7); return .38; } },
  hurt: { max: 2, pri: 3, f: (o, t, p) => { _o(o, 'sawtooth', 240, 70, t, .28, .5); _n(o, 'lowpass', 1600, 200, 1, t, .2, .7); _o(o, 'square', 90, 60, t, .2, .3); _o(o, 'sine', 55, 35, t, .3, .8); return .32; } },
  shieldhit: { max: 2, pri: 3, f: (o, t, p) => { _o(o, 'sine', 1400, 600, t, .25, .4); _o(o, 'triangle', 2100, 900, t, .2, .2); _n(o, 'highpass', 3000, 3000, 1, t, .1, .3); return .26; } },
  dash: { v: 2, max: 3, f: (o, t, p) => { _n(o, 'bandpass', 500 * p, 2600 * p, 2.2, t, .16, .55, .02); _o(o, 'sine', 300 * p, 600 * p, t, .12, .12); return .18; } },
  graze: { max: 3, pri: 3, f: (o, t, p) => { _o(o, 'sine', 1568, 1568, t, .25, .25); _o(o, 'sine', 2349, 2349, t + .03, .3, .2); _o(o, 'sine', 3136, 3136, t + .06, .35, .14); _n(o, 'highpass', 5000, 8000, 1, t, .2, .2, .1); return .4; } },
  coin: { v: 1.5, max: 5, ui: 0, minor: 1, f: (o, t, p) => { _o(o, 'square', 1320 * p, 1320 * p, t, .05, .07); _o(o, 'square', 1980 * p, 1980 * p, t + .045, .09, .07); return .14; } },
  heal: { max: 2, f: (o, t, p) => { [523, 659, 784, 1046].forEach((f, i) => _o(o, 'triangle', f * p, f * p, t + i * .05, .25, .18)); return .45; } },
  eshot: { max: 6, minor: 1, f: (o, t, p) => { _o(o, 'square', 640 * p, 260 * p, t, .08, .13); _n(o, 'lowpass', 1200 * p, 400, 1, t, .06, .22); return .09; } },
  eshotBig: { max: 4, f: (o, t, p) => { _o(o, 'sawtooth', 380 * p, 120 * p, t, .16, .2); _n(o, 'lowpass', 900 * p, 200, 1, t, .14, .35); _o(o, 'sine', 120, 50, t, .12, .35); return .18; } },
  snipe: { max: 2, pri: 3, f: (o, t, p) => { _o(o, 'sawtooth', 2600, 300, t, .18, .3, .001, .1); _n(o, 'highpass', 3000, 1500, 1, t, .1, .5); _o(o, 'sine', 90, 40, t, .2, .5); return .22; } },
  wind: { v: 2.2, max: 6, pri: 2, f: (o, t, p) => { _o(o, 'sawtooth', 180 * p, 520 * p, t, .4 * p, .07, .1, .38 * p); _o(o, 'sine', 360 * p, 1040 * p, t, .4 * p, .05, .1, .38 * p); return .45; } },
  windSnipe: { v: 2, max: 3, pri: 3, f: (o, t, p) => { _o(o, 'sine', 900, 2700, t, 1.15, .08, .3, 1.1); _o(o, 'square', 450, 1350, t, 1.15, .02, .3, 1.1); return 1.2; } },
  growl: { max: 3, pri: 2, f: (o, t, p) => { _o(o, 'sawtooth', 70 * p, 150 * p, t, .7, .22, .1, .7); _n(o, 'lowpass', 300, 900, 2, t, .7, .2, .2); return .75; } },
  mortar: { max: 3, f: (o, t, p) => { _o(o, 'sine', 140 * p, 55, t, .22, .7); _n(o, 'lowpass', 900, 200, 1, t, .2, .4); return .24; } },
  whistle: { v: 3, max: 4, minor: 1, f: (o, t, p) => { _o(o, 'sine', 1900 * p, 600 * p, t, 1, .05, .3, 1); return 1; } },
  blink: { max: 3, pri: 2, f: (o, t, p) => { _o(o, 'sine', 300 * p, 2400 * p, t, .25, .25, .2); _n(o, 'bandpass', 1000, 6000, 3, t, .25, .2, .2); return .28; } },
  slash: { max: 3, pri: 2, f: (o, t, p) => { _n(o, 'bandpass', 3000 * p, 800, 2, t, .14, .6); _o(o, 'sawtooth', 900, 200, t, .1, .15); return .16; } },
  fuse: { v: 1.8, max: 4, pri: 2, f: (o, t, p) => { for (let i = 0; i < 5; i++) _o(o, 'square', 1500 + i * 150, 1500 + i * 150, t + i * .14 * (1 - i * .12), .04, .14); return .7; } },
  block: { max: 3, minor: 1, f: (o, t, p) => { _o(o, 'square', 1200 * p, 1150, t, .04, .14); _o(o, 'sine', 3300 * p, 3200, t, .08, .1); _n(o, 'bandpass', 5000, 5000, 4, t, .05, .2); return .1; } },
  spawn: { v: 1.6, max: 4, minor: 1, f: (o, t, p) => { _o(o, 'sine', 120 * p, 520 * p, t, .8, .1, .5, .8); _n(o, 'bandpass', 300, 2000, 3, t, .8, .08, .6); return .85; } },
  heal2: { max: 3, minor: 1, f: (o, t, p) => { _o(o, 'sine', 880 * p, 1320 * p, t, .2, .08); return .2; } },
  burrow: { max: 3, minor: 1, f: (o, t, p) => { _n(o, 'lowpass', 400, 200, 2, t, .5, .3, .1); _o(o, 'sine', 60, 50, t, .5, .3); return .5; } },
  roar: { max: 1, pri: 4, f: (o, t, p) => { [55, 58.3, 82.4, 110].forEach(f => _o(o, 'sawtooth', f * p, f * .7 * p, t, 1.6, .2, .15)); _n(o, 'lowpass', 300, 2200, 1.5, t, 1.4, .5, .3); _fm(o, 70, 35, 300, t, 1.5, .3, 50); return 1.7; } },
  laser: { max: 3, pri: 2, f: (o, t, p) => { _o(o, 'sawtooth', 110 * p, 105 * p, t, .7, .25, .02); _o(o, 'square', 220 * p, 230 * p, t, .7, .1, .02); _n(o, 'bandpass', 2000, 2000, 2, t, .7, .2); return .72; } },
  slam: { max: 2, pri: 3, f: (o, t, p) => { _o(o, 'sine', 80 * p, 25, t, .7, 1.1); _n(o, 'lowpass', 1500, 80, 1, t, .6, .9); _o(o, 'square', 300, 60, t, .1, .3); return .72; } },
  door: { max: 2, f: (o, t, p) => { _o(o, 'sawtooth', 90 * p, 60 * p, t, .35, .25, .02); _n(o, 'lowpass', 700, 200, 1, t, .3, .4); _o(o, 'square', 400 * p, 300, t + .25, .05, .1); return .4; } },
  clear: { max: 1, pri: 4, f: (o, t, p) => { [392, 523, 659, 784].forEach((f, i) => { _o(o, 'triangle', f, f, t + i * .07, .5, .18); _o(o, 'sine', f * 2, f * 2, t + i * .07, .4, .05); }); return .8; } },
  synergy: { max: 1, pri: 4, f: (o, t, p) => { [523, 659, 784, 988, 1175, 1568].forEach((f, i) => _o(o, 'triangle', f, f * 1.005, t + i * .05, 1.2, .14, .02)); _n(o, 'highpass', 6000, 9000, 1, t, 1, .12, .3); return 1.3; } },
  pick: { max: 2, ui: 1, f: (o, t, p) => { [659, 988, 1319].forEach((f, i) => _o(o, 'square', f * p, f * p, t + i * .04, .18, .1)); return .3; } },
  hover: { max: 2, ui: 1, f: (o, t, p) => { _o(o, 'sine', 1800 * p, 1500 * p, t, .04, .08); return .05; } },
  click: { max: 2, ui: 1, f: (o, t, p) => { _o(o, 'square', 900 * p, 600 * p, t, .04, .1); _o(o, 'sine', 1800 * p, 1800 * p, t + .02, .05, .06); return .08; } },
  deny: { max: 2, ui: 1, f: (o, t, p) => { _o(o, 'square', 220, 180, t, .12, .12); _o(o, 'square', 233, 190, t, .12, .1); return .14; } },
  buy: { max: 2, ui: 1, f: (o, t, p) => { [1046, 1318, 1568, 2093].forEach((f, i) => _o(o, 'square', f, f, t + i * .035, .1, .07)); return .25; } },
  heart: { max: 1, pri: 3, f: (o, t, p) => { _o(o, 'sine', 62, 40, t, .14, .9, .01); _o(o, 'sine', 58, 38, t + .18, .14, .6, .01); return .35; } },
  death: { max: 1, pri: 5, f: (o, t, p) => { _o(o, 'sawtooth', 300, 30, t, 1.6, .4, .01, 1.5); _n(o, 'lowpass', 2000, 60, 1, t, 1.5, .8); _o(o, 'sine', 50, 20, t, 1.5, 1); return 1.7; } },
  rare: { max: 1, pri: 4, f: (o, t, p) => { [784, 1046, 1318, 1568, 2093].forEach((f, i) => _o(o, 'sine', f, f, t + i * .06, .6, .16)); return .9; } },
  pickup: { max: 3, f: (o, t, p) => { _o(o, 'triangle', 600 * p, 1500 * p, t, .15, .25); _o(o, 'sine', 1200 * p, 3000 * p, t, .15, .1); return .18; } },
  grenade: { max: 2, f: (o, t, p) => { _o(o, 'sine', 500, 260, t, .1, .4); _n(o, 'bandpass', 800, 2400, 2, t, .2, .3); return .2; } },
  ability: { max: 2, pri: 3, f: (o, t, p) => { _o(o, 'sawtooth', 200 * p, 900 * p, t, .25, .2, .01); _o(o, 'sine', 400 * p, 1800 * p, t, .3, .2); _n(o, 'bandpass', 1500, 5000, 2, t, .3, .2); return .32; } },
  ready: { max: 1, ui: 1, f: (o, t, p) => { _o(o, 'sine', 1320, 1320, t, .1, .08); _o(o, 'sine', 1760, 1760, t + .06, .12, .08); return .2; } },
};
// ---- sustained loop instruments --------------------------------------------------------
const LOOPS = {
  beam: c => { const g = c.createGain(); g.gain.value = 0; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2; f.frequency.value = 900; f.connect(g);
    const a = c.createOscillator(), b = c.createOscillator(), l = c.createOscillator(), lg = c.createGain(); a.type = b.type = 'sawtooth'; a.frequency.value = 110; b.frequency.value = 111.7;
    l.frequency.value = 17; lg.gain.value = 300; l.connect(lg); lg.connect(f.frequency); a.connect(f); b.connect(f); a.start(); b.start(); l.start();
    return { g, vol: .22, set: (p, t) => { f.frequency.setTargetAtTime(700 + p * 1600, t, .05); a.frequency.setTargetAtTime(110 + p * 50, t, .05); b.frequency.setTargetAtTime(111.7 + p * 52, t, .05); } }; },
  flame: c => { const g = c.createGain(); g.gain.value = 0; const s = c.createBufferSource(); s.buffer = A.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100; f.Q.value = 1.5; const f2 = c.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 300; f2.gain.value = 8;
    s.connect(f); f.connect(f2); f2.connect(g); s.start(); return { g, vol: .5 }; },
  spin: c => { const g = c.createGain(); g.gain.value = 0; const o = c.createOscillator(); o.type = 'sawtooth'; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 800;
    o.connect(f); f.connect(g); o.start(); return { g, vol: .08, set: (p, t) => { o.frequency.setTargetAtTime(60 + p * 260, t, .05); f.frequency.setTargetAtTime(400 + p * 1600, t, .05); } }; },
  draw: c => { const g = c.createGain(); g.gain.value = 0; const o = c.createOscillator(); o.type = 'triangle'; o.connect(g); o.start();
    return { g, vol: .06, set: (p, t) => o.frequency.setTargetAtTime(200 + p * 500, t, .03) }; },
};

// =====================================================================================
// Adaptive music: look-ahead step sequencer with stems driven by the director intensity.
// =====================================================================================
const SCALES = { aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11] };
const THEMES = [
  { bpm: 124, root: 45, sc: 'aeolian', prog: [0, 5, 3, 4], lead: 'square', pad: 'sawtooth', bassW: 'sawtooth', seed: 'neon', swing: 0 },
  { bpm: 108, root: 50, sc: 'dorian', prog: [0, 3, 6, 4], lead: 'triangle', pad: 'sawtooth', bassW: 'square', seed: 'frost', swing: .08 },
  { bpm: 116, root: 43, sc: 'phrygian', prog: [0, 1, 0, 6], lead: 'sawtooth', pad: 'triangle', bassW: 'sawtooth', seed: 'toxic', swing: .12 },
  { bpm: 138, root: 40, sc: 'harm', prog: [0, 5, 1, 4], lead: 'sawtooth', pad: 'sawtooth', bassW: 'sawtooth', seed: 'core', swing: 0 },
];
const DRUMS = { // 16-step strings per level: kick / snare / hat
  k: ['', 'x.......x.......', 'x...x...x...x...', 'x...x...x..xx...', 'x..x..x.x..x.xx.'],
  s: ['', '', '....x.......x...', '....x.......x..x', '....x..x....x.xx'],
  h: ['', '..x...x...x...x.', 'x.x.x.x.x.x.x.x.', 'xxx.x.xxx.x.xxx.', 'xxxxxxxxxxxxxxxx'],
};
const STEM_GAIN = { pad: [.55, .45, .32, .28, .28], arp: [.22, .3, .28, .24, .3], bass: [0, .45, .7, .8, .9], drums: [0, .35, .8, 1, 1], lead: [0, 0, .32, .5, .62] };
const mtof = m => 440 * pow(2, (m - 69) / 12);
const MUS = {
  on: false, step: 0, next: 0, theme: THEMES[0], level: 0, levelF: 0, stems: {}, motif: null, bar: 0, stingQ: [],
  init() {
    const c = A.ctx; for (const k in STEM_GAIN) { const g = c.createGain(); g.gain.value = 0; g.connect(A.duckM); this.stems[k] = g; }
    this.makeVerb();
    setInterval(() => this.schedule(), 25);
  },
  makeVerb() { // cheap filtered feedback delay "space" for pads/arp/lead
    const c = A.ctx, d = c.createDelay(1), fb = c.createGain(), f = c.createBiquadFilter(), inp = c.createGain(), out = c.createGain();
    d.delayTime.value = .29; fb.gain.value = .38; f.type = 'lowpass'; f.frequency.value = 2200; out.gain.value = .5;
    inp.connect(d); d.connect(f); f.connect(fb); fb.connect(d); f.connect(out); out.connect(A.duckM); this.verbIn = inp;
  },
  setTheme(i, boss = false) {
    const th = THEMES[i % THEMES.length];
    if (th !== this.theme || this.boss !== boss) { this.theme = th; this.boss = boss; this.genMotif(); }
    if (!this.on && A.ok) { this.on = true; this.next = A.ctx.currentTime + .1; this.step = 0; }
  },
  genMotif() { // seeded 2-bar lead motif (32 steps), chord-tone anchored
    const r = new RNG(this.theme.seed + (this.boss ? 'b' : '')), m = [];
    for (let i = 0; i < 32; i++) { const strong = i % 4 === 0; m.push(r.chance(strong ? .85 : i % 2 === 0 ? .45 : .15) ? (strong ? r.pick([0, 2, 4]) : r.int(0, 6)) + (r.chance(.2) ? 7 : 0) : -1); }
    m[28] = m[29] = m[30] = m[31] = -1; m[24] = 4; this.motif = m;
  },
  setIntensity(l) { this.level = clamp(l, 0, 4); },
  schedule() {
    if (!this.on || !A.ok) return; const c = A.ctx, th = this.theme, spb = 60 / th.bpm / 4;
    // stem gains follow intensity
    const lv = this.level, lo = floor(lv), fr = lv - lo, now = c.currentTime;
    for (const k in this.stems) { const a = STEM_GAIN[k], v = lerp(a[lo], a[min(4, lo + 1)], fr); this.stems[k].gain.setTargetAtTime(v, now, 1.2); }
    while (this.next < now + .12) { this.playStep(this.step, this.next, spb); this.next += spb; this.step++; }
  },
  deg(d, oct = 0) { const s = SCALES[this.theme.sc], n = s.length; const o = floor(d / n); return this.theme.root + s[((d % n) + n) % n] + 12 * (o + oct); },
  playStep(step, t, spb) {
    const th = this.theme, s16 = step % 16, bar = floor(step / 16), chord = th.prog[bar % 4], lvl = round(this.level), st = this.stems, boss = this.boss;
    if (s16 % 2 === 1) t += th.swing * spb;
    // stingers fire on beat boundaries
    if (s16 % 4 === 0 && this.stingQ.length) { const f = this.stingQ.shift(); f(t, chord); }
    const dl = boss ? 4 : lvl;
    if (st.drums.gain.value > .01 || dl > 0) {
      if (DRUMS.k[dl][s16] === 'x') this.kick(t);
      if (DRUMS.s[dl][s16] === 'x') this.snare(t);
      if (DRUMS.h[dl][s16] === 'x') this.hat(t, s16 % 4 === 2 ? .7 : .4);
    }
    // bass: root with octave pops
    const bassPat = boss ? 'x.xx.x.xx.xx.x.x' : 'x..x..x.x..x..x.';
    if (bassPat[s16] === 'x') this.note('bass', th.bassW, mtof(this.deg(chord, -1) + (s16 === 6 || s16 === 14 ? 12 : 0)), t, spb * 1.6, .32, 'lp', 900);
    // pad: chord on bar start
    if (s16 === 0) for (const d of [0, 2, 4]) this.note('pad', th.pad, mtof(this.deg(chord + d, 0)), t, spb * 15.5, .07, 'lp', 1400, .5, true);
    // arp
    if (s16 % 2 === 0) { const d = [0, 2, 4, 7][(s16 / 2) % 4]; this.note('arp', 'triangle', mtof(this.deg(chord + d, 1)), t, spb * 1.2, .08, 'lp', 3000, .005, true); }
    // lead motif (2 bars) with variation every 4th bar
    const mi = (step % 32), md = this.motif[mi];
    if (md >= 0 && st.lead.gain.value > .01) { let d = md + (bar % 4 === 3 ? 2 : 0); this.note('lead', th.lead, mtof(this.deg(chord + d, 2)), t, spb * 1.8, .09, 'lp', 2600, .01, true); }
  },
  note(stem, type, f, t, dur, vol, ft, fc, att = .005, verb = false) {
    const c = A.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f;
    let src = o; if (type !== 'triangle' && type !== 'sine') { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(fc, t); fl.frequency.exponentialRampToValueAtTime(fc * .35, t + dur); o.connect(fl); src = fl; }
    if (stem === 'pad') { const o2 = c.createOscillator(); o2.type = type; o2.frequency.value = f * 1.006; o2.connect(src === o ? g : src); o2.start(t); o2.stop(t + dur + .1); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.setTargetAtTime(0, t + dur * .6, dur * .25);
    src.connect(g); g.connect(this.stems[stem]); if (verb && this.verbIn) g.connect(this.verbIn);
    o.start(t); o.stop(t + dur + .1);
  },
  kick(t) { const c = A.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(42, t + .12);
    g.gain.setValueAtTime(.75, t); g.gain.exponentialRampToValueAtTime(.001, t + .32); o.connect(g); g.connect(this.stems.drums); o.start(t); o.stop(t + .34); },
  snare(t) { _n(this.stems.drums, 'bandpass', 1900, 1200, .8, t, .16, .32); const c = A.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(120, t + .08); g.gain.setValueAtTime(.25, t); g.gain.exponentialRampToValueAtTime(.001, t + .1); o.connect(g); g.connect(this.stems.drums); o.start(t); o.stop(t + .12); },
  hat(t, v) { _n(this.stems.drums, 'highpass', 7500, 7000, 1, t, .045, .13 * v); },
  stinger(kind) {
    if (!this.on) return; const self = this;
    this.stingQ.push((t, chord) => {
      const spb = 60 / self.theme.bpm / 4, out = A.duckM, play = (d, i, dur = spb * 3, typ = 'square', v = .1) => {
        const o = A.ctx.createOscillator(), g = A.ctx.createGain(); o.type = typ; o.frequency.value = mtof(self.deg(d, 2)); g.gain.setValueAtTime(0, t + i * spb);
        g.gain.linearRampToValueAtTime(v, t + i * spb + .01); g.gain.setTargetAtTime(0, t + i * spb + dur * .5, dur * .3); o.connect(g); g.connect(out); o.start(t + i * spb); o.stop(t + i * spb + dur * 2); };
      if (kind === 'clear') [0, 2, 4, 7].forEach((d, i) => play(chord + d, i));
      else if (kind === 'synergy') [0, 4, 7, 9, 11, 14].forEach((d, i) => play(d, i * .5, spb * 6, 'triangle', .08));
      else if (kind === 'boss') { for (const d of [-14, -7, 0]) play(d, 0, spb * 12, 'sawtooth', .14); }
      else if (kind === 'death') [7, 4, 2, 0, -3].forEach((d, i) => play(d, i * 2, spb * 4, 'triangle', .1));
    });
  },
};
