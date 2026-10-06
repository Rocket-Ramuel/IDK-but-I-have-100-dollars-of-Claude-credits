// =====================================================================================
// SECTION 9 — UI: HUD (canvas), DOM menus, cards, map, settings, codex, gamepad nav
// =====================================================================================
const $ui = document.getElementById('ui');
const UI = {
  cb: {}, next: {}, back: null, screen: '', hintEl: null, n: 0,
  // callbacks are staged while a template is built, then swapped in when it is shown
  show(html, back = null, screen = '') { if (this.hintEl) this.hint(''); this.cb = this.next; this.next = {}; $ui.innerHTML = html; this.back = back; this.screen = screen; this.focusFirst(); },
  clear() { $ui.innerHTML = ''; this.cb = {}; this.next = {}; this.back = null; this.screen = ''; },
  a(fn) { const k = 'a' + (this.n++); this.next[k] = fn; return `data-a="${k}"`; },   // register a click action
  btn(label, fn, cls = '', extra = '') { return `<button class="btn ${cls}" ${this.a(fn)} ${extra}>${label}</button>`; },
  focusables() { return [...$ui.querySelectorAll('.btn:not(:disabled),.card,.node.av,.char,[data-nav]')].filter(e => e.offsetParent !== null); },
  focusFirst() { if (IN.device !== 'pad') return; const f = this.focusables(); if (f.length) this.setFocus(f[0]); },
  setFocus(el) { $ui.querySelectorAll('.f').forEach(e => e.classList.remove('f')); if (el) { el.classList.add('f'); el.scrollIntoView({ block: 'nearest' }); } },
  nav(dx, dy) { const f = this.focusables(); if (!f.length) return; let cur = $ui.querySelector('.f'); if (!cur) { this.setFocus(f[0]); return; }
    const r0 = cur.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2; let best = null, bs = 1e9;
    for (const el of f) { if (el === cur) continue; const r = el.getBoundingClientRect(), x = r.left + r.width / 2 - cx, y = r.top + r.height / 2 - cy; const along = x * dx + y * dy; if (along <= 4) continue; const s = along + abs(x * dy - y * dx) * 2.5; if (s < bs) { bs = s; best = el; } }
    if (best) { this.setFocus(best); A.play('hover'); } },
  toastQ: [],
};
$ui.addEventListener('click', e => { const t = e.target.closest('[data-a]'); if (!t || t.disabled) return; const fn = UI.cb[t.dataset.a]; if (fn) { A.init(); A.play('click'); fn(t); } });
$ui.addEventListener('mouseover', e => { const t = e.target.closest('.btn,.card,.node.av,.char'); if (t && t !== UI._hov) { UI._hov = t; A.play('hover'); } });
function padUiPress(i) {
  if (G.state === 'play' && !G.paused) return;
  if (i === 12) UI.nav(0, -1); else if (i === 13) UI.nav(0, 1); else if (i === 14) UI.nav(-1, 0); else if (i === 15) UI.nav(1, 0);
  else if (i === 0) { const f = $ui.querySelector('.f'); if (f) f.click(); else UI.focusFirst(); }
  else if (i === 1 && UI.back) UI.back();
}
function onActionPress(code) {
  if (code === 'F3') { G.settings.fps = G.debug.fps = !G.debug.fps; return; } if (code === 'F4') { G.settings.debug = G.debug.ai = !G.debug.ai; return; }
  if (code === 'F5') { G.debug.flow = !G.debug.flow; return; } if (code === 'F6') { G.debug.hit = !G.debug.hit; return; }
  if (G.state === 'map' && IN.binds.build.includes(code) && UI.screen === 'map') { openBuild(true, mapScreen); return; }
  if (G.state === 'play') {
    if (UI.screen === 'build') { if (IN.binds.build.includes(code) || IN.binds.pause.includes(code)) closeBuild(); return; }
    if (IN.binds.pause.includes(code)) { togglePause(); return; }
    if (IN.binds.build.includes(code) && !G.paused) { openBuild(); return; }
    if (G.paused && code === 'Escape' && UI.back) { UI.back(); return; }
  } else if (code === 'Escape' && UI.back) { UI.back(); return; }
  if (UI.screen === 'reward' && /^Digit[1-4]$/.test(code)) { const c = $ui.querySelectorAll('.card')[+code.slice(5) - 1]; if (c) c.click(); }
  if (UI.screen === 'map' && /^Digit[1-4]$/.test(code)) { const c = $ui.querySelectorAll('.node.av')[+code.slice(5) - 1]; if (c) c.click(); }
}
const $toasts = document.getElementById('toasts');
function toast(t1, t2 = '', big = false) { // stacked in a flex column so simultaneous toasts never overlap
  if (G.demo) return; while ($toasts.children.length > 3) $toasts.firstChild.remove();
  const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = `<div class="t1" style="${big ? '' : 'font-size:21px'}">${t1}</div>${t2 ? `<div class="t2">${t2}</div>` : ''}`;
  $toasts.appendChild(d); setTimeout(() => d.remove(), 2800);
}
UI.bossIntro = (n, t) => { const d = document.createElement('div'); d.className = 'boss-card';
  d.innerHTML = `<div class="t1" style="font-size:46px;letter-spacing:.2em;text-shadow:0 0 20px #ff2bd6,0 0 50px #ff2bd6">${n}</div><div class="t2" style="font-size:15px;color:#fff">${t}</div>`; document.body.appendChild(d); setTimeout(() => d.remove(), 2700); };
// tooltip near the bottom (shop pedestals etc.)
UI.hint = html => { if (!UI.hintEl) { UI.hintEl = document.createElement('div'); UI.hintEl.className = 'hint'; UI.hintEl.style.cssText = 'position:fixed;right:24px;top:50%;transform:translateY(-50%);pointer-events:none;z-index:5'; document.body.appendChild(UI.hintEl); }
  if (UI.screen && html) html = ''; if (UI.hintEl._h !== html) { UI.hintEl._h = html; UI.hintEl.innerHTML = html; } };

// ---------------------------------------------------------------------------- card rendering
function famTag(f) { return `<span class="tag" style="color:${FAM[f].c}">${FAM[f].n}</span>`; }
function cardHTML(u, extra = '') {
  const cls = u.rar === 4 ? 'rC' : 'r' + u.rar, n = B.picks[u.id] || 0, hint = synHint(u);
  return `<div class="card ${cls}" ${extra}><div class="rar">${RAR_NAME[u.rar]}${n ? ` · owned ×${n}` : ''}</div><div class="icon">${famIcon(u.fam)}</div><div class="nm">${u.n}</div><div class="ds">${upgDesc(u)}</div>
    <div class="tags">${famTag(u.fam)}</div>${hint ? `<div class="syn">${hint}</div>` : ''}</div>`;
}
function famIcon(f, s = 56) { // procedural SVG emblem per family
  const c = FAM[f].c, P = {
    fire: 'M28 6 C36 20 46 24 40 40 C36 50 20 50 16 40 C12 30 22 26 20 16 C26 22 28 14 28 6Z', frost: 'M28 4 L28 52 M7 16 L49 40 M49 16 L7 40 M22 8 L28 14 L34 8 M22 48 L28 42 L34 48',
    shock: 'M32 4 L14 32 L28 32 L22 52 L42 22 L28 22 Z', poison: 'M28 6 C40 24 44 30 44 38 A16 16 0 0 1 12 38 C12 30 16 24 28 6Z M22 38 A4 4 0 1 0 22.1 38',
    ricochet: 'M6 44 L22 12 L36 40 L50 10', pierce: 'M4 28 L44 28 M34 18 L48 28 L34 38 M14 20 L14 36 M24 20 L24 36', split: 'M6 28 L26 28 L46 10 M26 28 L46 46 M26 28 L48 28',
    homing: 'M28 28 m-18 0 a18 18 0 1 0 36 0 a18 18 0 1 0 -36 0 M28 28 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M28 2 L28 14 M28 42 L28 54 M2 28 L14 28 M42 28 L54 28',
    explosive: 'M28 4 L33 20 L50 14 L38 28 L52 38 L34 36 L30 52 L24 36 L6 40 L18 28 L6 14 L23 20 Z', summon: 'M28 8 L44 18 L44 38 L28 48 L12 38 L12 18 Z M28 22 L34 28 L28 34 L22 28Z',
    crit: 'M28 4 L34 22 L52 22 L38 33 L43 51 L28 40 L13 51 L18 33 L4 22 L22 22 Z', speed: 'M8 14 L30 14 M4 28 L34 28 M10 42 L30 42 M34 8 L52 28 L34 48',
    core: 'M28 6 L48 18 L48 38 L28 50 L8 38 L8 18Z M28 18 L38 24 L38 34 L28 40 L18 34 L18 24Z', curse: 'M28 6 C44 6 50 18 50 28 C50 38 42 44 36 44 L36 52 L20 52 L20 44 C14 44 6 38 6 28 C6 18 12 6 28 6Z M18 24 L24 30 M24 24 L18 30 M32 24 L38 30 M38 24 L32 30' };
  return `<svg width="${s}" height="${s}" viewBox="0 0 56 56" fill="none" stroke="${c}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" style="filter:drop-shadow(0 0 6px ${c})"><path d="${P[f]}"/></svg>`;
}
function weaponCard(id, extra = '', price = '') { const d = T.W[id]; return `<div class="card r1" ${extra}><div class="rar">Weapon</div><div class="icon">${famIcon('pierce')}</div><div class="nm">${d.n}</div><div class="ds">${d.d}<br><br>
  <span class="dim">Damage</span> <b>${d.dmg}${d.cnt > 1 ? '×' + d.cnt : ''}</b> · <span class="dim">Rate</span> <b>${d.rate}/s</b><br><span class="dim">Mag</span> <b>${d.k === 'beam' ? 'heat' : d.mag}</b> · <span class="dim">Reload</span> <b>${d.rel}s</b></div>${price}</div>`; }
function activeCard(id, extra = '', price = '') { const d = T.ACT[id]; return `<div class="card r2" ${extra}><div class="rar">Active Item</div><div class="icon">${famIcon('core')}</div><div class="nm">${d.n}</div><div class="ds">${d.d}<br><br><span class="dim">Cooldown</span> <b>${d.cd}s</b></div>${price}</div>`; }

// ---------------------------------------------------------------------------- HUD
const HUDS = { hpGhost: 1, mm: null, mmRoom: null };
function drawHUD(dt) {
  const c = R.hc, W = innerWidth, H = innerHeight; c.setTransform(R.hdpr, 0, 0, R.hdpr, 0, 0); c.clearRect(0, 0, W, H);
  if (!R.gl && R.lowHp > .01) { const g = c.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .8); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(160,0,20,${R.lowHp * .6})`); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  if (!R.gl && R.flash > .01) { c.fillStyle = `rgba(255,255,255,${min(.5, R.flash)})`; c.fillRect(0, 0, W, H); }
  const p = G.player, run = G.run;
  if (G.state === 'play' && p && run && !G.demo) {
    c.font = '600 12px ' + 'ui-monospace,Consolas,monospace'; c.textBaseline = 'middle';
    // letterbox during focus moments
    const lb = G.cam.focusT > 0 ? min(1, G.cam.focusT * 2) : 0; if (lb > 0) { c.fillStyle = '#000'; c.fillRect(0, 0, W, H * .09 * lb); c.fillRect(0, H - H * .09 * lb, W, H * .09 * lb); }
    else {
      hudVitals(c, p, run, dt); hudWeapon(c, p, run, W, H); hudMinimap(c, run, W); hudTop(c, run, W, H); hudThreats(c, W, H); hudCues(c, p, W, H, dt);
      if (run.combo >= 3) { const x = W - 30, y = H * .42, f = run.comboT / T.player.comboTime; c.textAlign = 'right'; c.font = `900 ${28 + min(20, run.combo * .3)}px Segoe UI,Arial`; c.fillStyle = '#ffe23a'; c.shadowColor = '#ffe23a'; c.shadowBlur = 12;
        c.fillText(run.combo + '×', x, y); c.shadowBlur = 0; c.font = '700 10px ui-monospace,monospace'; c.fillStyle = '#c8b860'; c.fillText('COMBO', x, y + 24); c.fillStyle = '#ffe23a'; c.fillRect(x - 80 * f, y + 34, 80 * f, 3); }
      hudCrosshair(c, p);
    }
  }
  if (G.debug.fps || G.debug.ai || G.debug.stress) hudDebug(c, W, H);
}
function hudBar(c, x, y, w, h, f, col, bg = 'rgba(255,255,255,.1)') { c.fillStyle = bg; c.fillRect(x, y, w, h); c.fillStyle = col; c.fillRect(x, y, w * clamp(f, 0, 1), h); }
function hudCues(c, p, W, H, dt) {
  const px = toScreenX(p.x, p.y), py = toScreenY(p.x, p.y); c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let i = CUES.length - 1; i >= 0; i--) {
    const q = CUES[i]; q.t -= dt; if (q.t <= 0) { CUES.splice(i, 1); continue; } const a = min(1, q.t * 2), lbl = q.label + (q.n > 1 ? ' ×' + q.n : '');
    c.globalAlpha = a; c.font = '700 12px ui-monospace,monospace';
    if (q.x === undefined) { c.fillStyle = 'rgba(0,0,0,.6)'; const w = c.measureText(lbl).width + 16; c.fillRect(W / 2 - w / 2, H - 96 - i * 20, w, 18); c.fillStyle = '#ffe23a'; c.fillText('◉ ' + lbl, W / 2, H - 87 - i * 20); continue; }
    const sx = toScreenX(q.x, q.y), sy = toScreenY(q.x, q.y), on = sx > 20 && sx < W - 20 && sy > 20 && sy < H - 20;
    if (on) { const r = 14 + (1.2 - q.t) * 30; c.strokeStyle = '#ffe23a'; c.lineWidth = 2; c.beginPath(); c.arc(sx, sy, r, 0, TAU); c.stroke(); }
    const ang = atan2(sy - py, sx - px), d = min(130, max(70, hypot(sx - px, sy - py) * .5)), lx = px + cos(ang) * d, ly = py + sin(ang) * d, w = c.measureText(lbl).width + 26;
    c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(lx - w / 2, ly - 10, w, 20); c.fillStyle = '#ffe23a'; c.fillText(lbl, lx + 6, ly);
    c.save(); c.translate(lx - w / 2 + 9, ly); c.rotate(ang); c.beginPath(); c.moveTo(6, 0); c.lineTo(-4, 5); c.lineTo(-4, -5); c.closePath(); c.fill(); c.restore();
  }
  c.globalAlpha = 1;
}
function hudVitals(c, p, run, dt) {
  const x = 22, y = 22, w = 240, h = 16, f = p.hp / p.maxHp; HUDS.hpGhost = max(f, HUDS.hpGhost - dt * .35);
  c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(x - 4, y - 4, w + 8, h + 8);
  if (f < T.fx.lowHp) { const beat = pow(max(0, sin(G.rt * 7.5)), 8); c.strokeStyle = `rgba(255,40,70,${.4 + .6 * beat})`; c.lineWidth = 2 + beat * 3; c.strokeRect(x - 5, y - 5, w + 10, h + 10); } // visual heartbeat
  hudBar(c, x, y, w, h, HUDS.hpGhost, 'rgba(255,255,255,.55)', 'rgba(255,40,70,.12)');
  const g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, f < .3 ? '#ff2a4a' : '#ff4a6a'); g.addColorStop(1, f < .3 ? '#ff6a3a' : '#ff8ab0'); c.fillStyle = g; c.fillRect(x, y, w * f, h);
  if (p.shieldMax) hudBar(c, x, y + h - 4, w, 4, p.shield / p.shieldMax, '#5dff8a', 'rgba(0,0,0,0)');
  c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1; for (let i = 1; i < p.maxHp / 25; i++) { const sx = x + w * i * 25 / p.maxHp; c.beginPath(); c.moveTo(sx, y); c.lineTo(sx, y + h); c.stroke(); }
  c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = '700 12px ui-monospace,monospace'; c.fillText(`${ceil(p.hp)} / ${p.maxHp}`, x + 6, y + h / 2 + 1);
  if (B.barrier) { c.fillStyle = p.barrierT <= 0 ? '#7fdcff' : 'rgba(127,220,255,.25)'; c.beginPath(); c.arc(x + w + 16, y + h / 2, 7, 0, TAU); c.fill(); }
  // dash pips
  const dmax = 1 + (B.dashCharges | 0) + (run.char === 'wraith' ? 1 : 0), dcd = T.player.dashCd * max(.3, 1 - B.dashCd);
  for (let i = 0; i < dmax; i++) { const px = x + i * 26, fill = i < p.dashCharges ? 1 : i === p.dashCharges ? 1 - p.dashCd / dcd : 0; hudBar(c, px, y + h + 8, 22, 5, fill, i < p.dashCharges ? '#7ff6ff' : 'rgba(127,246,255,.5)'); }
  // ability + actives
  const ch = T.CH[run.char], items = [{ k: IN.binds.ability, f: 1 - p.abilityCd / ch.cd, n: ch.ab, col: ch.col }];
  run.actives.forEach((a, i) => { if (a) items.push({ k: IN.binds[i ? 'act2' : 'act1'], f: 1 - a.cd / T.ACT[a.id].cd, n: T.ACT[a.id].n, col: '#c04bff' }); });
  items.forEach((it, i) => { const cx = x + 20 + i * 52, cy = y + h + 46, r = 18, ready = it.f >= 1;
    c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.arc(cx, cy, r + 3, 0, TAU); c.fill();
    c.strokeStyle = ready ? it.col : 'rgba(255,255,255,.2)'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, r, -PI / 2, -PI / 2 + TAU * clamp(it.f, 0, 1)); c.stroke();
    if (ready && i === 0 && p.readyFlash > 0) { const f = p.readyFlash; c.strokeStyle = it.col; c.lineWidth = 3; c.globalAlpha = f; c.beginPath(); c.arc(cx, cy, r + (1 - f) * 18, 0, TAU); c.stroke(); c.globalAlpha = 1; p.readyFlash = max(0, f - dt * 1.5); }
    if (ready) { c.shadowColor = it.col; c.shadowBlur = 10; c.fillStyle = it.col; c.beginPath(); c.arc(cx, cy, 6, 0, TAU); c.fill(); c.shadowBlur = 0; }
    c.fillStyle = '#c8d4ea'; c.font = '700 9px ui-monospace,monospace'; c.textAlign = 'center'; c.fillText(bindLabel(it.k[IN.device === 'pad' ? 2 : 0] || it.k[0]), cx, cy + r + 10); });
  // gold
  c.textAlign = 'left'; c.font = '800 15px ui-monospace,monospace'; c.fillStyle = '#ffe23a'; c.fillText('◆ ' + run.gold, x, y + h + 92);
  c.font = '600 10px ui-monospace,monospace'; c.fillStyle = '#8a93b8'; c.fillText(`↻${run.rerolls}  ⊘${run.banishes}`, x + 80, y + h + 92);
}
function hudWeapon(c, p, run, W, H) {
  const w = curWeapon(p), d = w.def, x = W - 24, y = H - 30; c.textAlign = 'right'; c.font = '800 16px Segoe UI,Arial'; c.fillStyle = '#fff'; c.fillText(d.n.toUpperCase(), x, y - 26);
  if (run.weapons.length > 1) { const o = run.weapons[(run.wi + 1) % run.weapons.length]; c.font = '600 11px ui-monospace,monospace'; c.fillStyle = '#8a93b8'; c.fillText(`[${bindLabel(IN.binds.swap[IN.device === 'pad' ? 2 : 0])}] ${o.def.n}`, x, y - 46); }
  if (w.reloadT > 0) { hudBar(c, x - 160, y - 4, 160, 6, 1 - w.reloadT / d.rel, '#ffe23a'); c.font = '700 10px ui-monospace,monospace'; c.fillStyle = '#ffe23a'; c.fillText(d.k === 'beam' ? 'COOLING' : 'RELOADING', x, y + 12); return; }
  if (d.k === 'beam') { hudBar(c, x - 160, y - 4, 160, 6, w.heat / d.heat, w.heat / d.heat > .75 ? '#ff4a1a' : '#ff8a2b'); return; }
  if (d.k === 'bow') { hudBar(c, x - 160, y - 4, 160, 6, w.charge, w.full ? '#fff27a' : '#7ff6ff'); return; }
  if (w.mag <= 40) { const pw = min(9, 150 / w.mag); for (let i = 0; i < w.mag; i++) { c.fillStyle = i < w.ammo ? (p.buffs.overdrive > 0 ? '#ffe23a' : '#7ff6ff') : 'rgba(127,246,255,.15)'; c.fillRect(x - (i + 1) * pw, y - 6, pw - 2, 10); } }
  else { c.font = '800 20px ui-monospace,monospace'; c.fillStyle = w.ammo / w.mag < .2 ? '#ff5470' : '#7ff6ff'; c.fillText(`${w.ammo}`, x - 40, y); c.font = '600 12px ui-monospace,monospace'; c.fillStyle = '#8a93b8'; c.fillText(`/${w.mag}`, x, y + 2); }
  if (d.id === 'minigun') hudBar(c, x - 160, y + 10, 160, 3, w.spin, '#ff8a2b');
}
function hudMinimap(c, run, W) {
  const room = G.room; if (!room) return; const mw = 170, mh = 120, s = min(mw / room.w, mh / room.h), x0 = W - mw - 20 + (mw - room.w * s) / 2, y0 = 20;
  if (HUDS.mmRoom !== room || HUDS.mmDirty) { HUDS.mmRoom = room; HUDS.mmDirty = false; const cv = HUDS.mm || (HUDS.mm = document.createElement('canvas')); cv.width = room.w * 4; cv.height = room.h * 4; const x = cv.getContext('2d');
    x.clearRect(0, 0, cv.width, cv.height); for (let i = 0; i < room.w * room.h; i++) { const t = room.tiles[i]; if (t === 0) { x.fillStyle = room.hz[i] >= 0 ? 'rgba(255,120,40,.35)' : 'rgba(255,255,255,.1)'; x.fillRect((i % room.w) * 4, floor(i / room.w) * 4, 4, 4); } else if (t === 2) { x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect((i % room.w) * 4, floor(i / room.w) * 4, 4, 4); } } }
  if (G.tick % 30 === 0) HUDS.mmDirty = true;
  c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(W - mw - 24, 16, mw + 8, mh + 8); c.drawImage(HUDS.mm, x0, y0, room.w * s, room.h * s);
  const k = s / TS; for (const e of G.enemies) { if (e.dead) continue; c.fillStyle = e.boss ? '#ff2bd6' : e.elite ? '#ffb020' : '#ff4a6a'; const r = e.boss ? 4 : 2; c.fillRect(x0 + e.x * k - r / 2, y0 + e.y * k - r / 2, r, r); }
  const d = room.exitDoor; c.fillStyle = room.open ? '#50ffaa' : '#ff2a4a'; c.fillRect(x0 + d.x * s, y0, s * 2, 3);
  for (const pr of G.props) if (pr.interact) { c.fillStyle = '#ffe23a'; c.fillRect(x0 + pr.x * k - 2, y0 + pr.y * k - 2, 4, 4); }
  const p = G.player; c.fillStyle = '#7ff6ff'; c.beginPath(); c.arc(x0 + p.x * k, y0 + p.y * k, 3, 0, TAU); c.fill();
  c.textAlign = 'right'; c.font = '700 10px ui-monospace,monospace'; c.fillStyle = T.BIO[run.biome].edge; const node = run.map.byId[run.map.cur];
  c.fillText(`${T.BIO[run.biome].n} · ${node ? ROOM_NAME[node.type].toUpperCase() : ''}`, W - 20, mh + 38); c.fillStyle = '#8a93b8'; c.fillText(`${fmtTime(run.stats.time)}  ·  SEED ${run.seed}${run.heat ? '  ·  HEAT ' + run.heat : ''}`, W - 20, mh + 52);
}
function hudTop(c, run, W, H) {
  const b = G.boss;
  if (b && !b.dead && b.introT <= 0) { const w = min(620, W * .5), x = (W - w) / 2, y = 28, f = b.hp / b.maxHp; c.textAlign = 'center'; c.font = '800 13px Segoe UI,Arial'; c.fillStyle = '#fff'; c.fillText(T.boss[b.bossId].n, W / 2, y - 10);
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - 3, y - 3, w + 6, 16); hudBar(c, x, y, w, 10, f, b.col); c.fillStyle = '#000'; for (const k of [.66, .33]) c.fillRect(x + w * k - 1, y, 2, 10); return; }
  if (DIRECTOR.active && G.room.type === 'challenge') { c.textAlign = 'center'; c.font = '900 28px Segoe UI,Arial'; c.fillStyle = '#ff8a2b'; c.fillText(ceil(DIRECTOR.challengeT), W / 2, 34); return; }
  const n = G.alive; if (!G.room.cleared && (n || DIRECTOR.active)) { c.textAlign = 'center'; c.font = '700 12px ui-monospace,monospace'; c.fillStyle = '#ff8ab0'; c.fillText(`◉ ${n}  ${['BUILD', 'PEAK', 'LULL'][DIRECTOR.phase]}`, W / 2, 26); }
  else if (G.room.open && G.room.type !== 'boss') { c.textAlign = 'center'; c.font = '700 12px ui-monospace,monospace'; c.fillStyle = '#50ffaa'; c.globalAlpha = .6 + .4 * sin(G.rt * 4); c.fillText('▲ EXIT OPEN ▲', W / 2, 26); c.globalAlpha = 1; }
}
function hudThreats(c, W, H) {
  const m = 26; let n = 0;
  for (const e of G.enemies) {
    if (e.dead || e.spawnT > 0 || n > 18) continue; const sx = toScreenX(e.x, e.y), sy = toScreenY(e.x, e.y); if (sx > -10 && sx < W + 10 && sy > -10 && sy < H + 10) continue; n++;
    const a = atan2(sy - H / 2, sx - W / 2), k = min((W / 2 - m) / abs(cos(a)), (H / 2 - m) / abs(sin(a))), x = W / 2 + cos(a) * k, y = H / 2 + sin(a) * k, warn = e.atkPhase === 1;
    const s = warn ? 10 + 3 * sin(G.rt * 25) : e.boss ? 10 : 6; c.save(); c.translate(x, y); c.rotate(a); c.globalAlpha = warn ? 1 : .55; c.fillStyle = warn ? '#ff2a4a' : e.col;
    c.beginPath(); c.moveTo(s, 0); c.lineTo(-s * .7, s * .7); c.lineTo(-s * .7, -s * .7); c.closePath(); c.fill(); c.restore();
  }
  c.globalAlpha = 1;
}
function hudCrosshair(c, p) {
  let x = IN.mx, y = IN.my; if (IN.padAim || IN.device === 'pad') { x = toScreenX(p.x + cos(p.ang) * 110, p.y + sin(p.ang) * 110); y = toScreenY(p.x + cos(p.ang) * 110, p.y + sin(p.ang) * 110); }
  const w = curWeapon(p), sp = 6 + (w.def.spr || 0) * 30 + (p.muzzle > 0 ? 3 : 0); c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.shadowColor = '#7ff6ff'; c.shadowBlur = 6; c.beginPath();
  c.moveTo(x - sp - 7, y); c.lineTo(x - sp, y); c.moveTo(x + sp, y); c.lineTo(x + sp + 7, y); c.moveTo(x, y - sp - 7); c.lineTo(x, y - sp); c.moveTo(x, y + sp); c.lineTo(x, y + sp + 7); c.stroke();
  if (w.reloadT > 0) { c.strokeStyle = '#ffe23a'; c.beginPath(); c.arc(x, y, sp + 12, -PI / 2, -PI / 2 + TAU * (1 - w.reloadT / w.def.rel)); c.stroke(); }
  c.shadowBlur = 0; c.fillStyle = '#fff'; c.fillRect(x - 1, y - 1, 2, 2);
}
function hudDebug(c, W, H) {
  const s = G.stats, x = 20, y = H - 150; c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(x - 6, y - 14, 290, 150); c.textAlign = 'left'; c.font = '11px ui-monospace,monospace'; c.fillStyle = '#7ff6ff';
  const lines = [`FPS ${s.fps.toFixed(0)}  frame ${s.frameMs.toFixed(1)}ms`, `sim ${s.simMs.toFixed(2)}ms  render ${s.renderMs.toFixed(2)}ms`, `enemies ${G.enemies.length}  pB ${G.bullets.length}  eB ${G.ebullets.length}`,
    `particles ${P.n}  lod ${P.lod.toFixed(2)}  voices ${A.nVoices}`, `director ${['BUILD', 'PEAK', 'RELAX'][DIRECTOR.phase]} stress ${DIRECTOR.stress.toFixed(2)} spent ${DIRECTOR.spent.toFixed(0)}/${DIRECTOR.budget > 1e8 ? '∞' : DIRECTOR.budget.toFixed(0)}`,
    `tac tokens R${TAC.ranged} M${TAC.melee} rush ${TAC.rushing ? 'Y' : 'n'} flush ${TAC.flush ? 'Y' : 'n'} intercept ${TAC.intercept ? 'Y' : 'n'}`];
  lines.forEach((l, i) => c.fillText(l, x, y + i * 14));
  const gx = x, gy = y + 92, gw = 240, gh = 40; c.strokeStyle = 'rgba(255,255,255,.2)'; c.strokeRect(gx, gy, gw, gh); c.strokeStyle = '#ff4a6a'; c.beginPath();
  for (let i = 0; i < 240; i++) { const v = DIRECTOR.history[(DIRECTOR.hi + i) % 240]; const px = gx + i, py = gy + gh - min(1.2, v) / 1.2 * gh; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke();
  c.strokeStyle = 'rgba(255,226,58,.5)'; c.beginPath(); const ty = gy + gh - T.director.peakStress / 1.2 * gh; c.moveTo(gx, ty); c.lineTo(gx + gw, ty); c.stroke();
}

// ---------------------------------------------------------------------------- screens
function titleScreen() {
  G.state = 'title'; document.body.classList.remove('play'); startDemo();
  const m = G.meta, daily = dailySeed();
  UI.show(`<div class="title-bg"></div><div class="title-wrap"><div class="logo">SHATTER<br>LINE</div><div class="sub">NEON ROGUELITE · ${m.stats.runs} RUNS · ${m.stats.wins} WINS</div>
    <div class="menu">${UI.btn('Play', () => charSelect(), 'pri')}${UI.btn('Daily Run · ' + daily, () => charSelect({ daily: true }))}${UI.btn('Unlocks · ◆' + m.shards, () => unlocksScreen())}
    ${UI.btn('Codex', () => codexScreen())}${UI.btn('Achievements', () => achScreen())}${UI.btn('History', () => historyScreen())}${UI.btn('Settings', () => settingsScreen(titleScreen))}</div></div>
    <div class="foot">WASD move · Mouse aim · LMB fire · RMB ability · SPACE dash · Q/E actives · TAB build · ESC pause · Gamepad supported</div>`, null, 'title');
}
function charSelect(o = {}) {
  const m = G.meta; let sel = m.lastChar && charUnlocked(m.lastChar) ? m.lastChar : 'kestrel', heat = o.daily ? 0 : (m.lastHeat || 0);
  const render = () => {
    const ch = T.CH[sel];
    const cards = Object.entries(T.CH).map(([id, c]) => { const ok = charUnlocked(id), lk = c.lock;
      return `<div class="char ${ok ? '' : 'lock'} ${id === sel ? 'sel' : ''}" style="--cc:${c.col}" ${UI.a(() => { if (ok) { sel = id; render(); } else A.play('deny'); })}><b>${c.n}</b><p class="dim">${c.role}</p>
        <p>${ok ? T.W[c.w].n : typeof lk === 'number' ? '◆ ' + lk + ' in Unlocks' : 'Defeat the Prism Warden'}</p></div>`; }).join('');
    const heatSel = m.heatUnlocked ? `<div class="row"><h3 style="margin:0">Heat</h3>${UI.btn('−', () => { heat = max(0, heat - 1); render(); }, 'sm')}<b class="gold" style="min-width:20px;text-align:center">${heat}</b>${UI.btn('+', () => { heat = min(min(10, (m.maxHeat || 0) + 1), heat + 1); render(); }, 'sm')}
      <span class="dim" style="font-size:11px">${heat ? T.heat.slice(0, heat).join(' · ') : 'No modifiers'}</span></div>` : '<p class="dim" style="font-size:12px">Heat levels unlock after your first victory.</p>';
    UI.show(`<div class="panel wide"><h2>${o.daily ? 'Daily Run · ' + dailySeed() : 'Choose Your Runner'}</h2><div class="chars">${cards}</div>
      <div class="row" style="margin-top:16px;align-items:flex-start"><div class="col grow"><h3>${ch.n} — ${ch.role}</h3><p><span class="gold">Passive:</span> ${ch.p}</p><p><span class="gold">Ability [RMB]:</span> ${ch.ad}</p>
      <p><span class="gold">Weapon:</span> ${T.W[ch.w].n} — <span class="dim">${T.W[ch.w].d}</span></p><p><span class="gold">HP:</span> ${ch.hp + (m.boosts.vit || 0) * 8}</p></div>
      <div class="col" style="min-width:260px">${o.daily ? '' : `<label class="dim">Seed (blank = random)</label><input type="text" id="seedIn" maxlength="16" placeholder="random" value="${o.seed || ''}">`}${o.daily ? '' : heatSel}</div></div>
      <div class="row" style="margin-top:18px">${UI.btn('Start Run', () => { const s = o.daily ? dailySeed() : (document.getElementById('seedIn').value.trim().toUpperCase() || randomSeed()); m.lastChar = sel; m.lastHeat = heat; save(); startRun({ char: sel, seed: s, heat, daily: !!o.daily }); }, 'pri')}${UI.btn('Back', titleScreen)}</div></div>`, titleScreen, 'char');
  };
  render();
}
function unlocksScreen(tab = 'chars') {
  const m = G.meta, M = T.meta;
  const buy = (cost, fn) => () => { if (m.shards < cost) { A.play('deny'); return; } m.shards -= cost; fn(); A.play('buy'); save(); unlocksScreen(tab); };
  let body = '';
  if (tab === 'chars') body = Object.entries(T.CH).map(([id, c]) => { const ok = charUnlocked(id); return `<div class="item ${ok ? '' : 'lock'}"><b style="color:${c.col}">${c.n}</b>${c.role}<br><span class="dim">${c.p}</span><br>
    ${ok ? '<span class="good">Unlocked</span>' : typeof c.lock === 'number' ? UI.btn('◆ ' + c.lock, buy(c.lock, () => m.unlocked[id] = 1), 'sm', m.shards < c.lock ? 'disabled' : '') : '<span class="bad">Defeat the Prism Warden</span>'}</div>`; }).join('');
  if (tab === 'weapons') body = Object.entries(M.weapons).map(([id, cost]) => { const ok = !cost || m.unlocked[id]; return `<div class="item ${ok ? '' : 'lock'}"><b>${T.W[id].n}</b><span class="dim">${T.W[id].d}</span><br>
    ${ok ? '<span class="good">In pool</span>' : UI.btn('◆ ' + cost, buy(cost, () => m.unlocked[id] = 1), 'sm', m.shards < cost ? 'disabled' : '')}</div>`; }).join('');
  if (tab === 'boosts') body = Object.entries(M.boosts).map(([id, b]) => { const lv = m.boosts[id] || 0, cost = b.cost[lv]; return `<div class="item"><b>${b.n} ${'●'.repeat(lv)}${'○'.repeat(b.max - lv)}</b>${b.d}<br>
    ${lv >= b.max ? '<span class="good">Maxed</span>' : UI.btn('◆ ' + cost, buy(cost, () => m.boosts[id] = lv + 1), 'sm', m.shards < cost ? 'disabled' : '')}</div>`; }).join('');
  if (tab === 'upgrades') body = Object.values(UPG).filter(u => u.o.lock).map(u => `<div class="item ${isUnlocked(u.o.lock) ? '' : 'lock'}"><b>${u.n}</b>${upgDescStatic(u)}<br>${isUnlocked(u.o.lock) ? '<span class="good">In pool</span>' : '<span class="bad">Achievement: ' + ACH_ROWS.find(a => 'ach:' + a[0] === u.o.lock)[1] + '</span>'}</div>`).join('');
  const tabs = [['chars', 'Characters'], ['weapons', 'Weapons'], ['boosts', 'Boosts'], ['upgrades', 'Upgrades']].map(([k, n]) => UI.btn(n, () => unlocksScreen(k), k === tab ? 'pri sm' : 'sm')).join('');
  UI.show(`<div class="panel wide"><h2>Unlocks <span class="gold" style="float:right">◆ ${m.shards}</span></h2><p class="dim" style="font-size:12px">Unlocks add options to the pool. Boosts are small and capped.</p><div class="tabs">${tabs}</div><div class="list scroll">${body}</div>
    <div class="row" style="margin-top:14px">${UI.btn('Back', titleScreen)}</div></div>`, titleScreen, 'unlocks');
}
function upgDescStatic(u) { const save = B; if (!B) B = newBuild(); const d = u.d.replace(/\{(\w+)(%?)\}/g, (_, k, pc) => { let x = u.s[k] !== undefined ? u.s[k] : T.ST[k]; if (x === undefined) return k; return '<b>' + (pc ? round(x * 100) + '%' : x) + '</b>'; }); B = save; return d; }
function codexScreen(tab = 'enemy') {
  const cx = G.meta.codex, seen = (k, id) => cx[k] && cx[k][id]; let body = '';
  if (tab === 'enemy') body = Object.entries(T.E).map(([id, e]) => seen('enemy', id) ? `<div class="item"><b style="color:${e.col}">${e.n}</b>${e.d}<br><span class="dim">HP ${e.hp} · Speed ${e.spd}</span></div>` : '<div class="item unk"><b>???</b>Not yet encountered</div>').join('')
    + Object.entries(T.boss).map(([id, b]) => seen('boss', id) ? `<div class="item"><b style="color:${b.col}">${b.n}</b>${b.t}<br><span class="dim">HP ${b.hp} · 3 phases</span></div>` : '<div class="item unk"><b>??? (Boss)</b></div>').join('');
  if (tab === 'weapon') body = Object.entries(T.W).map(([id, w]) => seen('weapon', id) ? `<div class="item"><b>${w.n}</b>${w.d}</div>` : '<div class="item unk"><b>???</b></div>').join('');
  if (tab === 'upg') body = Object.values(UPG).map(u => seen('upg', u.id) ? `<div class="item" style="border-color:${FAM[u.fam].c}55"><b>${u.n} <span class="tag" style="color:${FAM[u.fam].c}">${FAM[u.fam].n}</span></b>${upgDescStatic(u)}</div>` : '<div class="item unk"><b>???</b></div>').join('');
  if (tab === 'syn') body = Object.values(SYN).map(s => seen('syn', s.id) ? `<div class="item" style="border-color:#ffe23a55"><b class="gold">${s.n}</b>${famTag(s.a)} + ${famTag(s.b)}<br>${s.d}</div>` : `<div class="item unk"><b>???</b>${FAM[s.a].n} + ?</div>`).join('');
  const cnt = k => Object.keys(cx[k] || {}).length, tot = { enemy: Object.keys(T.E).length + 4, weapon: Object.keys(T.W).length, upg: UPG_ROWS.length, syn: SYN_ROWS.length };
  const tabs = [['enemy', 'Bestiary'], ['weapon', 'Arsenal'], ['upg', 'Upgrades'], ['syn', 'Synergies']].map(([k, n]) => UI.btn(`${n} ${cnt(k) + (k === 'enemy' ? cnt('boss') : 0)}/${tot[k]}`, () => codexScreen(k), k === tab ? 'pri sm' : 'sm')).join('');
  UI.show(`<div class="panel wide"><h2>Codex</h2><div class="tabs">${tabs}</div><div class="list scroll">${body}</div><div class="row" style="margin-top:14px">${UI.btn('Back', titleScreen)}</div></div>`, titleScreen, 'codex');
}
function achScreen() {
  const a = G.meta.ach; UI.show(`<div class="panel wide"><h2>Achievements ${Object.keys(a).length}/${ACH_ROWS.length}</h2><div class="list scroll">${ACH_ROWS.map(r => `<div class="item ${a[r[0]] ? '' : 'lock'}"><b>${a[r[0]] ? '★' : '☆'} ${r[1]}</b>${r[2]}${r[3] ? `<br><span class="gold">${r[3]}</span>` : ''}</div>`).join('')}</div>
    <div class="row" style="margin-top:14px">${UI.btn('Back', titleScreen)}</div></div>`, titleScreen, 'ach');
}
function historyScreen() {
  const h = G.meta.history, s = G.meta.stats;
  const rows = h.map(r => `<div class="item"><b class="${r.win ? 'good' : ''}">${r.win ? 'VICTORY' : 'Died · ' + T.BIO[r.biome].n}</b>${T.CH[r.char].n} · ${fmtTime(r.time)} · ${r.kills} kills${r.heat ? ' · Heat ' + r.heat : ''}<br>
    <span class="dim">Seed ${r.seed}${r.daily ? ' (daily)' : ''} · ${new Date(r.date).toLocaleDateString()}${r.killedBy ? ' · ' + r.killedBy : ''}</span><br>${UI.btn('Replay seed', () => charSelect({ seed: r.seed }), 'sm')}</div>`).join('') || '<p class="dim">No runs yet.</p>';
  UI.show(`<div class="panel wide"><h2>Run History</h2><div class="kv" style="margin-bottom:14px"><b>Runs</b><span>${s.runs}</span><b>Wins</b><span>${s.wins}</span><b>Total kills</b><span>${s.kills}</span><b>Best time</b><span>${s.best ? fmtTime(s.best) : '—'}</span></div>
    <div class="list scroll">${rows}</div><div class="row" style="margin-top:14px">${UI.btn('Back', titleScreen)}</div></div>`, titleScreen, 'history');
}
function settingsScreen(back, tab = 'audio') {
  const s = G.settings, sl = (k, lab, mn, mx, st) => `<label>${lab}</label><input type="range" min="${mn}" max="${mx}" step="${st}" value="${s[k]}" data-set="${k}"><span id="v_${k}">${(+s[k]).toFixed(st < 1 ? 2 : 0)}</span>`;
  const tg = (k, lab) => `<label>${lab}</label><span>${UI.btn(s[k] ? 'On' : 'Off', () => { s[k] = !s[k]; applySettings(); settingsScreen(back, tab); }, s[k] ? 'pri sm' : 'sm')}</span><span></span>`;
  let body = '';
  if (tab === 'audio') body = `<div class="set">${sl('vMaster', 'Master volume', 0, 1, .05)}${sl('vSfx', 'Effects', 0, 1, .05)}${sl('vMusic', 'Music', 0, 1, .05)}${sl('vUi', 'Interface', 0, 1, .05)}</div>`;
  if (tab === 'video') body = `<p class="dim" style="font-size:12px;margin-bottom:10px">Every gameplay sound has a visual cue. "Visualize sound cues" adds directional captions and turns on automatically when sound is muted.</p><div class="set">${sl('shake', 'Screen shake', 0, 1.5, .05)}${tg('soundViz', 'Visualize sound cues')}${tg('reducedMotion', 'Reduced motion')}${tg('flashReduce', 'Flash reduction')}${tg('dmgNumbers', 'Damage numbers')}${tg('hitstop', 'Hitstop')}
    ${sl('bloom', 'Bloom', 0, 1.5, .05)}${tg('lighting', 'Dynamic lighting')}${tg('crt', 'CRT scanlines')}${sl('particles', 'Particle density', .25, 1.5, .05)}${sl('renderScale', 'Render scale', .5, 1, .05)}
    <label>Bullet palette</label><select data-set="palette">${Object.keys(BPAL).map(k => `<option ${s.palette === k ? 'selected' : ''} value="${k}">${{ default: 'Default', deutan: 'Deuteranopia', protan: 'Protanopia', tritan: 'Tritanopia' }[k]}</option>`).join('')}</select><span></span></div>`;
  if (tab === 'game') body = `<div class="set">${sl('gameSpeed', 'Game speed', .5, 1.2, .05)}${tg('aimAssist', 'Gamepad aim assist')}${tg('assist', 'Assist mode (−50% damage taken)')}${tg('fps', 'FPS overlay')}${tg('debug', 'AI debug overlay (F4)')}</div>
    <p class="dim" style="font-size:12px">F3 FPS · F4 AI states · F5 flow field · F6 hitboxes</p>`;
  if (tab === 'controls') body = `<div class="set" style="grid-template-columns:160px 1fr 1fr 1fr">${ACTIONS.map(a => `<label>${ACTION_NAMES[a]}</label>${[0, 1, 2].map(i => UI.btn(bindLabel(IN.binds[a][i]), (el) => {
      el.textContent = '…press…'; IN.rebind = code => { IN.rebind = null; if (code !== 'Escape') { for (const b of ACTIONS) for (let j = 0; j < 3; j++) if (IN.binds[b][j] === code) IN.binds[b][j] = ''; IN.binds[a][i] = code; } G.meta.binds = IN.binds; save(); settingsScreen(back, 'controls'); }; }, 'sm bind')).join('')}`).join('')}</div>
    <div class="row" style="margin-top:10px">${UI.btn('Reset controls', () => { IN.binds = JSON.parse(JSON.stringify(DEFAULT_BINDS)); G.meta.binds = IN.binds; save(); settingsScreen(back, 'controls'); }, 'sm')}</div>`;
  const tabs = [['audio', 'Audio'], ['video', 'Video & Accessibility'], ['game', 'Gameplay'], ['controls', 'Controls']].map(([k, n]) => UI.btn(n, () => settingsScreen(back, k), k === tab ? 'pri sm' : 'sm')).join('');
  UI.show(`<div class="panel wide"><h2>Settings</h2><div class="tabs">${tabs}</div><div class="scroll">${body}</div><div class="row" style="margin-top:16px">${UI.btn('Back', () => { save(); back(); })}</div></div>`, () => { save(); back(); }, 'settings');
  $ui.querySelectorAll('[data-set]').forEach(el => el.addEventListener('input', () => { const k = el.dataset.set; s[k] = el.tagName === 'SELECT' ? el.value : +el.value; const v = document.getElementById('v_' + k); if (v) v.textContent = (+s[k]).toFixed(2); applySettings(); }));
}
function applySettings() { const s = G.settings; G.debug.fps = s.fps; G.debug.ai = s.debug; A.applyVolumes(); resize(); save(); }
// ---------------------------------------------------------------------------- in-run screens
function togglePause() { if (G.paused) { if (UI.screen === 'pause') resume(); return; } if (UI.screen !== '' && UI.screen !== 'hud') return; pauseMenu(); }
function pauseMenu() {
  G.paused = true; A.stopLoops(); document.body.classList.remove('play');
  UI.show(`<div class="panel"><h2>Paused</h2><div class="menu">${UI.btn('Resume', resume, 'pri')}${UI.btn('Build Overview', () => openBuild(true))}${UI.btn('Settings', () => settingsScreen(pauseMenu))}
    ${UI.btn('Restart Run', () => startRun({ char: G.run.char, seed: G.run.seed, heat: G.run.heat, daily: G.run.daily }))}${UI.btn('Abandon Run', () => { G.paused = false; UI.clear(); G.player.hp = 0; playerDie('Abandoned'); })}${UI.btn('Quit to Title', () => { G.paused = false; titleScreen(); })}</div>
    <p class="dim" style="font-size:11px;margin-top:12px">Seed ${G.run.seed}</p></div>`, resume, 'pause');
}
function resume() { G.paused = false; UI.clear(); document.body.classList.add('play'); IN.clearHits(); }
function openBuild(fromPause = false, back = null) {
  if (!fromPause) { G.paused = true; A.stopLoops(); } const run = G.run, p = G.player;
  const fams = Object.keys(FAM).filter(f => famCount(f)).map(f => `<span class="tag" style="color:${FAM[f].c}">${FAM[f].n} ${famCount(f)}</span>`).join(' ') || '<span class="dim">none</span>';
  const ups = {}; for (const id of run.upgrades) ups[id] = (ups[id] || 0) + 1;
  const upHtml = Object.entries(ups).map(([id, n]) => { const u = UPG[id]; return `<div class="item" style="border-color:${FAM[u.fam].c}66"><b>${u.n}${n > 1 ? ' ×' + n : ''}</b>${upgDesc(u)}</div>`; }).join('') || '<p class="dim">No upgrades yet.</p>';
  const syns = Object.values(SYN).map(s => { const on = B.syn[s.id], a = famCount(s.a), b = famCount(s.b); if (!on && a + b < 2) return ''; const known = isSeen('syn', s.id);
    return `<div class="item" style="${on ? 'border-color:#ffe23a' : ''}"><b class="${on ? 'gold' : ''}">${on || known ? s.n : '???'} ${on ? '✓' : ''}</b>${famTag(s.a)} ${min(2, a)}/2 + ${famTag(s.b)} ${min(2, b)}/2${on || known ? '<br>' + s.d : ''}</div>`; }).join('');
  const st = [['Damage', '+' + round(B.dmg * 100) + '%'], ['Fire rate', '+' + round(B.rate * 100) + '%'], ['Crit', round((T.ST.critBase + B.crit + (run.char === 'wraith' ? .15 : 0)) * 100) + '% ×' + (T.ST.critMul + B.critDmg).toFixed(1)], ['Move speed', '+' + round(B.speed * 100) + '%'],
    ['Pierce', B.pierce], ['Bounces', B.bounce], ['Projectiles', '+' + B.extraProj], ['Max HP', p.maxHp]].map(([k, v]) => `<b>${k}</b><span>${v}</span>`).join('');
  const close = back || (fromPause ? pauseMenu : closeBuild);
  UI.show(`<div class="panel wide"><h2>Build — ${T.CH[run.char].n}</h2><div class="row" style="align-items:flex-start;gap:24px"><div class="col" style="min-width:220px"><h3>Weapons</h3>${run.weapons.map(w => `<p>${w.def.n}</p>`).join('')}
    <h3 style="margin-top:10px">Actives</h3>${run.actives.filter(Boolean).map(a => `<p>${T.ACT[a.id].n}</p>`).join('') || '<p class="dim">none</p>'}<h3 style="margin-top:10px">Stats</h3><div class="kv">${st}</div><h3 style="margin-top:10px">Families</h3><p>${fams}</p></div>
    <div class="col grow"><h3>Synergies</h3><div class="list">${syns || '<p class="dim">Pick two upgrades from two families to discover synergies.</p>'}</div><h3 style="margin-top:12px">Upgrades</h3><div class="list scroll" style="max-height:34vh">${upHtml}</div></div></div>
    <div class="row" style="margin-top:12px">${UI.btn('Close', close)}</div></div>`, close, 'build');
}
function closeBuild() { resume(); }
function mapScreen() {
  const run = G.run, map = run.map, cur = map.cur ? map.byId[map.cur] : null; G.state = 'map'; document.body.classList.remove('play'); A.stopLoops(); MUS.setIntensity(0);
  const avail = cur ? cur.next : map.layers[0].map(n => n.id), L = map.layers.length;
  const pos = n => ({ x: n.x * 100, y: 92 - n.layer / (L - 1) * 84 });
  let lines = ''; for (const n of map.nodes) for (const id of n.next) { const a = pos(n), b = pos(map.byId[id]); const on = (n.done || n === cur) && avail.includes(id); lines += `<line x1="${a.x}%" y1="${a.y}%" x2="${b.x}%" y2="${b.y}%" stroke="${on ? '#ffffff' : n.done ? '#7ff6ff55' : '#ffffff22'}" stroke-width="${on ? 2.5 : 1.5}" stroke-dasharray="${on ? '' : '4 5'}"/>`; }
  const nodes = map.nodes.map(n => { const p = pos(n), av = avail.includes(n.id); return `<div class="node ${av ? 'av' : ''} ${n.done ? 'done' : ''} ${n === cur ? 'cur' : ''}" style="left:${p.x}%;top:${p.y}%;color:${ROOM_COL[n.type]};border-color:${av ? ROOM_COL[n.type] : ''}" title="${ROOM_NAME[n.type]}" ${av ? UI.a(() => enterNode(n)) : ''}>${ROOM_ICON[n.type]}</div>`; }).join('');
  const bio = T.BIO[run.biome];
  UI.show(`<div class="backdrop"><div class="panel clear" style="text-align:center"><h2 style="color:${bio.edge};text-shadow:0 0 12px ${bio.edge}">${bio.n}</h2><p class="dim">Sector ${run.biome + 1} of 4 · choose your path</p>
    <div class="map"><svg>${lines}</svg>${nodes}</div><div class="legend">${Object.keys(ROOM_ICON).map(k => `<span style="color:${ROOM_COL[k]}">${ROOM_ICON[k]} ${ROOM_NAME[k]}</span>`).join('')}</div>
    <div class="row" style="justify-content:center;margin-top:12px">${UI.btn('Build [Tab]', () => openBuild(true, mapScreen), 'sm')}<span class="gold">◆ ${run.gold}</span><span>HP ${ceil(G.player.hp)}/${G.player.maxHp}</span></div></div></div>`, null, 'map');
}
// reward cards (after rooms)
function rewardScreen(opts) {
  const run = G.run; G.paused = true; A.stopLoops(); document.body.classList.remove('play');
  const n = max(2, 3 - (run.heat > 7 ? 1 : 0) + (opts.extra || 0)), rng = new RNG(`${run.seed}:${run.biome}:${run.map.cur}:offer:${run.rerollN || 0}:${opts.tag || ''}`);
  const offers = opts.offers || rollOffers(n, opts.minRar || 0, rng);
  const done = () => { UI.clear(); G.paused = false; document.body.classList.add('play'); IN.clearHits(); if (opts.then) opts.then(); };
  const cards = offers.map((u, i) => cardHTML(u, UI.a(() => { pickUpgrade(u.id); done(); }) + ` data-nav`)).join('');
  UI.show(`<div class="panel clear" style="text-align:center"><h2>${opts.title || 'Choose an Upgrade'}</h2><p class="dim" style="margin-bottom:18px">${opts.sub || 'Press 1–3 or click a card'}</p><div class="cards">${cards}</div>
    <div class="row" style="justify-content:center;margin-top:20px">${UI.btn(`Reroll (${run.rerolls})`, () => { if (run.rerolls <= 0) { A.play('deny'); return; } run.rerolls--; run.rerollN = (run.rerollN || 0) + 1; rewardScreen(Object.assign({}, opts, { offers: null })); }, '', run.rerolls ? '' : 'disabled')}
    ${UI.btn(`Banish… (${run.banishes})`, () => banishMode(offers, opts), '', run.banishes ? '' : 'disabled')}${UI.btn('Skip (+15 ◆)', () => { run.gold += 15; done(); })}</div></div>`, null, 'reward');
}
function banishMode(offers, opts) {
  const run = G.run; UI.show(`<div class="panel clear" style="text-align:center"><h2 class="bad">Banish which upgrade?</h2><p class="dim">It will never appear again this run.</p><div class="cards">${offers.map(u => cardHTML(u, UI.a(() => { run.banishes--; run.banished.add(u.id); run.rerollN = (run.rerollN || 0) + 1; rewardScreen(Object.assign({}, opts, { offers: null })); }))).join('')}</div>
    <div class="row" style="justify-content:center;margin-top:20px">${UI.btn('Cancel', () => rewardScreen(Object.assign({}, opts, { offers })))}</div></div>`, () => rewardScreen(Object.assign({}, opts, { offers })), 'reward');
}
// generic choice dialog (events, rest, treasure)
function choiceDialog(title, text, choices, cls = '') {
  G.paused = true; A.stopLoops(); document.body.classList.remove('play');
  UI.show(`<div class="panel ev ${cls}"><h2>${title}</h2><div class="txt">${text}</div><div class="menu">${choices.map(c => UI.btn(c[0], () => { UI.clear(); G.paused = false; document.body.classList.add('play'); IN.clearHits(); c[1](); }, c[2] || '', c[3] ? 'disabled' : '')).join('')}</div></div>`, null, 'event');
}
// weapon choice: take or swap
function offerWeapon(id, then) {
  const run = G.run; codexSee('weapon', id);
  if (run.weapons.length < 2) { run.weapons.push(makeWeapon(id)); refreshWeapons(); toast(T.W[id].n.toUpperCase(), 'Weapon acquired · ' + bindLabel(IN.binds.swap[0]) + ' to swap'); if (then) then(); return; }
  G.paused = true; document.body.classList.remove('play');
  UI.show(`<div class="panel clear" style="text-align:center"><h2>New Weapon</h2><div class="cards">${weaponCard(id)}</div><p class="dim" style="margin:14px">Replace which weapon?</p>
    <div class="row" style="justify-content:center">${run.weapons.map((w, i) => UI.btn('Replace ' + w.def.n, () => { run.weapons[i] = makeWeapon(id); refreshWeapons(); run.wi = i; UI.clear(); G.paused = false; document.body.classList.add('play'); if (then) then(); })).join('')}${UI.btn('Leave it', () => { UI.clear(); G.paused = false; document.body.classList.add('play'); if (then) then(); })}</div></div>`, null, 'reward');
}
function offerActive(id, then) {
  const run = G.run; const slot = run.actives[0] ? (run.actives[1] ? -1 : 1) : 0;
  if (slot >= 0) { run.actives[slot] = { id, cd: 0 }; toast(T.ACT[id].n.toUpperCase(), 'Active item · ' + bindLabel(IN.binds[slot ? 'act2' : 'act1'][0])); if (then) then(); return; }
  G.paused = true; document.body.classList.remove('play');
  UI.show(`<div class="panel clear" style="text-align:center"><h2>New Active Item</h2><div class="cards">${activeCard(id)}</div><div class="row" style="justify-content:center;margin-top:14px">
    ${run.actives.map((a, i) => UI.btn('Replace ' + T.ACT[a.id].n, () => { run.actives[i] = { id, cd: 0 }; UI.clear(); G.paused = false; document.body.classList.add('play'); if (then) then(); })).join('')}${UI.btn('Leave it', () => { UI.clear(); G.paused = false; document.body.classList.add('play'); if (then) then(); })}</div></div>`, null, 'reward');
}
function summaryScreen(win, shards, newAch) {
  const run = G.run, s = run.stats; G.state = 'summary'; document.body.classList.remove('play');
  const recap = run.recap.slice(-6).reverse().map(r => `<div class="row" style="gap:8px;font-size:12px"><span class="bad" style="min-width:42px">-${r.dmg}</span><span>${r.src}</span><span class="dim" style="margin-left:auto">${fmtTime(r.t)} · ${r.hp} HP left</span></div>`).join('');
  const ups = [...new Set(run.upgrades)].map(id => `<span class="tag" style="color:${FAM[UPG[id].fam].c}">${UPG[id].n}${run.upgrades.filter(x => x === id).length > 1 ? ' ×' + run.upgrades.filter(x => x === id).length : ''}</span>`).join(' ');
  UI.show(`<div class="backdrop"><div class="panel wide"><h1 style="font-size:36px;${win ? '' : 'text-shadow:0 0 14px #ff2a4a,0 0 30px #ff2a4a'}">${win ? 'VICTORY' : 'RUN OVER'}</h1>
    <p class="dim">${T.CH[run.char].n} · ${T.BIO[run.biome].n} · Seed ${run.seed}${run.heat ? ' · Heat ' + run.heat : ''}</p>
    <div class="row" style="align-items:flex-start;gap:28px;margin-top:12px"><div class="kv" style="min-width:230px"><b>Time</b><span>${fmtTime(s.time)}</span><b>Rooms</b><span>${s.rooms}</span><b>Kills</b><span>${s.kills} (${s.elites} elite)</span>
      <b>Damage dealt</b><span>${fmt(s.dmgDealt)}</span><b>Damage taken</b><span>${fmt(s.dmgTaken)}</span><b>Perfect dodges</b><span>${s.grazes}</span><b>Best combo</b><span>${s.maxCombo}</span><b>Gold earned</b><span>${s.gold}</span><b>Synergies</b><span>${run.synergies.length}</span></div>
    <div class="col grow">${win ? '' : `<h3>Death Recap — killed by ${run.killedBy || '?'}</h3><div class="col" style="gap:4px">${recap || '<span class="dim">—</span>'}</div>`}
      <h3 style="margin-top:10px">Build</h3><div class="tags" style="display:flex;gap:5px;flex-wrap:wrap">${ups || '<span class="dim">none</span>'}</div>
      ${run.synergies.length ? `<h3 style="margin-top:10px">Synergies</h3><p class="gold">${run.synergies.map(id => SYN[id].n).join(' · ')}</p>` : ''}
      <h3 style="margin-top:10px">Shards earned</h3><p class="gold" style="font-size:20px">◆ +${shards}</p>${newAch.length ? `<p class="good">New: ${newAch.join(', ')}</p>` : ''}</div></div>
    <div class="row" style="margin-top:18px">${UI.btn('Run Again', () => charSelect(), 'pri')}${UI.btn('Same Seed', () => startRun({ char: run.char, seed: run.seed, heat: run.heat, daily: run.daily }))}${UI.btn('Title', titleScreen)}</div></div></div>`, titleScreen, 'summary');
}
