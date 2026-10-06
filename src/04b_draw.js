// =====================================================================================
// SECTION 4b — RENDERING: entity drawing (vector shapes), bullets, emissive layer, lights
// =====================================================================================
const mkPath = pts => { const p = new Path2D(); p.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]); p.closePath(); return p; };
const ngon = (n, r = 1, rot = 0) => { const a = []; for (let i = 0; i < n; i++) a.push(cos(rot + i / n * TAU) * r, sin(rot + i / n * TAU) * r); return a; };
const star = (n, r1, r2) => { const a = []; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, t = i / (n * 2) * TAU; a.push(cos(t) * r, sin(t) * r); } return a; };
const circ = (r = 1) => { const p = new Path2D(); p.arc(0, 0, r, 0, TAU); return p; };
const SH = {
  mite: mkPath([1.1, 0, -.7, .8, -.35, 0, -.7, -.8]), gunner: mkPath([.9, -.55, .9, .55, .2, .9, -.8, .8, -.8, -.8, .2, -.9]), ram: mkPath([1.15, 0, -.35, .95, -.95, .55, -.6, 0, -.95, -.55, -.35, -.95]),
  bulwark: mkPath(ngon(6, 1, PI / 6)), lancer: mkPath([1.2, 0, .1, .55, -.95, .2, -.95, -.2, .1, -.55]), lobber: circ(1), brood: mkPath(ngon(9, 1)), phantom: mkPath([1, 0, .2, .55, -.9, .9, -.4, 0, -.9, -.9, .2, -.55]),
  tick: circ(1), mender: mkPath([.35, -1, .35, -.35, 1, -.35, 1, .35, .35, .35, .35, 1, -.35, 1, -.35, .35, -1, .35, -1, -.35, -.35, -.35, -.35, -1]), warden: mkPath(ngon(8, 1, PI / 8)),
  delver: mkPath([1.2, 0, .3, .7, -.9, .55, -.9, -.55, .3, -.7]), spire: mkPath(star(6, 1.15, .55)), mimic: mkPath([-1, -.8, 1, -.8, 1, .8, -1, .8]), gel: circ(1), wisp: mkPath([1, 0, 0, .6, -1, 0, 0, -.6]),
  jugg: mkPath([.75, -1, 1, -.7, 1, .7, .75, 1, -.75, 1, -1, .7, -1, -.7, -.75, -1]), player: mkPath([1.35, 0, -.65, .9, -.25, 0, -.65, -.9]), hex: mkPath(ngon(6, 1)), tri: mkPath(ngon(3, 1)), oct: mkPath(ngon(8, 1, PI / 8)),
  sq: mkPath([-1, -1, 1, -1, 1, 1, -1, 1]), circ: circ(1),
};
const ROT_FREE = { spire: 1, gel: 1, brood: 1, tick: 1, lobber: 1, mimic: 1, mender: 1 };
const _dark = new Map(); const darkOf = c => { let d = _dark.get(c); if (!d) { d = mixHex(c, '#000000', .72); _dark.set(c, d); } return d; };
const lerpX = (o, a) => o.px + (o.x - o.px) * a, lerpY = (o, a) => o.py + (o.y - o.py) * a;

function drawWorld(ctx, alpha, wdt) {
  camXf();
  // ground zones (non-emissive part)
  for (const z of G.zones) { if (!inView(z.x, z.y, z.r)) continue; const f = min(1, z.t / .4, (z.dur - z.t) / .2 + .2);
    if (z.kind === 'acid' || z.kind === 'toxic' || z.kind === 'eacid') { ctx.globalAlpha = .28 * f; ctx.fillStyle = '#5dff2a'; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill(); }
    else if (z.kind === 'hole') { ctx.globalAlpha = .85 * f; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(z.x, z.y, 26 + 6 * sin(G.rt * 20), 0, TAU); ctx.fill(); }
    else if (z.kind === 'eice') { ctx.globalAlpha = .25 * f; ctx.fillStyle = '#9fe4ff'; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill(); } }
  ctx.globalAlpha = 1;
  // shadows (one batched path)
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath();
  for (const e of G.enemies) { if (e.spawnT > 0 || e.burrowed) continue; const x = lerpX(e, alpha), y = lerpY(e, alpha); if (!inView(x, y, 40)) continue; const o = e.fly ? 14 : e.r * .5 + (e.lift || 0); ctx.moveTo(x + e.r, y + o); ctx.ellipse(x, y + o, e.r, e.r * .45, 0, 0, TAU); }
  const p = G.player; if (p && !p.dead) { const x = lerpX(p, alpha), y = lerpY(p, alpha); ctx.moveTo(x + 10, y + 6); ctx.ellipse(x, y + 6, 10, 4.5, 0, 0, TAU); }
  ctx.fill();
  // pickups
  for (const k of G.pickups) { const x = lerpX(k, alpha), y = lerpY(k, alpha); if (!inView(x, y, 10)) continue; const blink = k.life < 4 && (k.life * 6 % 1) < .4;
    if (blink) continue; if (k.kind === 'gold') { xf(ctx, x, y + sin(k.t * 6) * 1.5, k.t * 4, 3.4 * (.6 + .4 * abs(sin(k.t * 5))), 3.4); ctx.fillStyle = '#ffe23a'; ctx.fill(SH.sq); }
    else { xf(ctx, x, y + sin(k.t * 4) * 2, 0, 5.5, 5.5); ctx.fillStyle = '#5dff8a'; ctx.fill(SH.mender); } }
  // props
  for (const pr of G.props) drawProp(ctx, pr);
  // mortar shell shadows
  camXf(); ctx.fillStyle = 'rgba(0,0,0,.4)'; for (const m of MORTARS) { const f = m.t / m.d; ctx.beginPath(); ctx.ellipse(lerp(m.x0, m.x1, f), lerp(m.y0, m.y1, f), 5, 2.5, 0, 0, TAU); ctx.fill(); }
}
// actors are drawn after the lightmap so combatants stay crisp while the environment stays moody
function drawActors(ctx, alpha) {
  const p = G.player; camXf();
  for (const e of G.enemies) drawEnemy(ctx, e, alpha);
  if (G.corpse) drawCorpse(ctx, G.corpse);
  // allies
  for (const a of G.allies) drawAlly(ctx, a, alpha);
  if (p) drawPlayer(ctx, p, alpha);
}
function drawProp(ctx, pr) {
  if (!inView(pr.x, pr.y, 30)) return; const t = G.rt;
  if (pr.kind === 'barrel') { xf(ctx, pr.x, pr.y, 0, 11, 11); ctx.fillStyle = pr.flash > 0 ? '#fff' : '#3a1208'; ctx.fill(SH.oct); ctx.lineWidth = .16; ctx.strokeStyle = pr.fuse ? (sin(t * 60) > 0 ? '#fff' : '#ff4a1a') : '#ff6a1a'; ctx.stroke(SH.oct);
    ctx.fillStyle = '#ffb020'; ctx.fillRect(-.55, -.12, 1.1, .24); ctx.fillRect(-.12, -.55, .24, 1.1); return; }
  if (pr.kind === 'chest' || pr.kind === 'pedestal' || pr.kind === 'shrine' || pr.kind === 'fire' || pr.kind === 'portal') {
    const bob = sin(t * 2.5 + pr.x) * 2;
    if (pr.kind === 'chest') { xf(ctx, pr.x, pr.y, 0, 15, 12); ctx.fillStyle = pr.opened ? '#1a1206' : '#2a1d08'; ctx.fill(SH.sq); ctx.lineWidth = .12; ctx.strokeStyle = pr.cursed ? '#ff3355' : '#ffb020'; ctx.stroke(SH.sq);
      if (!pr.opened) { ctx.fillStyle = pr.cursed ? '#ff3355' : '#ffe23a'; ctx.fillRect(-.2, -.25, .4, .5); } }
    else if (pr.kind === 'pedestal') { xf(ctx, pr.x, pr.y + 8, 0, 14, 6); ctx.fillStyle = '#1b1430'; ctx.fill(SH.hex); ctx.lineWidth = .15; ctx.strokeStyle = pr.col || '#7ff6ff'; ctx.stroke(SH.hex);
      if (!pr.sold) { xf(ctx, pr.x, pr.y - 8 + bob, t, 7, 7); ctx.fillStyle = darkOf(pr.col || '#7ff6ff'); ctx.fill(SH.hex); ctx.lineWidth = .25; ctx.strokeStyle = pr.col || '#7ff6ff'; ctx.stroke(SH.hex); } }
    else if (pr.kind === 'shrine') { xf(ctx, pr.x, pr.y + bob * .5, 0, 16, 16); ctx.fillStyle = '#160c26'; ctx.fill(SH.tri); ctx.lineWidth = .1; ctx.strokeStyle = pr.used ? '#555' : '#b98bff'; ctx.stroke(SH.tri); }
    else if (pr.kind === 'fire') { xf(ctx, pr.x, pr.y, 0, 14, 7); ctx.fillStyle = '#2a1408'; ctx.fill(SH.hex); }
    else if (pr.kind === 'portal') { for (let i = 0; i < 3; i++) { xf(ctx, pr.x, pr.y, t * (1 + i) * (i % 2 ? -1 : 1), 26 - i * 6, 26 - i * 6); ctx.lineWidth = .08; ctx.strokeStyle = ['#ff2bd6', '#22e8ff', '#ffffff'][i]; ctx.stroke(SH.hex); } }
    if (pr.near && pr.label) { camXf(); ctx.font = '700 8px Segoe UI,Arial'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.fillText(pr.label, pr.x, pr.y - 26); ctx.fillStyle = '#ffe23a'; if (pr.sub) ctx.fillText(pr.sub, pr.x, pr.y - 16);
      ctx.font = '600 6.5px ui-monospace,monospace'; ctx.fillStyle = '#8a93b8'; ctx.fillText('[' + bindLabel(IN.binds.interact[IN.device === 'pad' ? 2 : 0]) + ']', pr.x, pr.y + 26); }
  }
}
function drawEnemy(ctx, e, alpha) {
  const x = lerpX(e, alpha), y = lerpY(e, alpha); if (!inView(x, y, e.r * 3 + 20)) return;
  const sh = SH[e.type] || SH.circ, t = G.rt;
  if (e.spawnT > 0) { const f = 1 - e.spawnT / T.director.spawnDelay; xf(ctx, x, y, t * 4, e.r * (2.2 - f * 1.2), e.r * (2.2 - f * 1.2)); ctx.lineWidth = .08; ctx.strokeStyle = e.col; ctx.globalAlpha = .4 + f * .6; ctx.stroke(SH.hex); ctx.globalAlpha = f * .7; xf(ctx, x, y, e.ang, e.r * f, e.r * f); ctx.fillStyle = e.col; ctx.fill(sh); ctx.globalAlpha = 1; return; }
  if (e.burrowed) { xf(ctx, x, y, 0, e.r * 1.1, e.r * .6); ctx.fillStyle = '#2a1c12'; ctx.fill(SH.circ); ctx.lineWidth = .1; ctx.strokeStyle = '#8a6a50'; ctx.stroke(SH.circ); return; }
  if (e.boss) { drawBoss(ctx, e, x, y); return; }
  const sq = e.squash, wob = e.type === 'gel' ? sin(e.bob * 1.5) * .08 : 0, sx = e.r * (1 + sq + wob), sy = e.r * (1 - sq * .7 - wob), lift = e.fly ? -6 + sin(e.bob) * 2 : 0;
  const rot = ROT_FREE[e.type] ? (e.type === 'spire' ? e.a || 0 : 0) : e.ang;
  const wind = e.atkPhase === 1 ? 1 - e.atkT / e.atkDur : 0, fl = e.flash > 0;
  ctx.globalAlpha = e.alpha !== undefined ? e.alpha : 1; if (e.type === 'phantom') ctx.globalAlpha *= .75 + .25 * sin(t * 9);
  xf(ctx, x, y + lift, rot, sx, sy); ctx.lineWidth = (2 + wind * 2) / e.r;
  ctx.fillStyle = fl ? '#ffffff' : e.frozenT > 0 ? '#5a8fb0' : wind > 0 ? mixHex(darkOf(e.col), e.col, wind * .5) : darkOf(e.col); ctx.fill(sh);
  ctx.strokeStyle = fl ? '#ffffff' : e.frozenT > 0 ? '#bdf0ff' : wind > .6 && (t * 20 % 1) < .5 ? '#ffffff' : e.col; ctx.stroke(sh);
  // type details
  switch (e.type) {
    case 'gunner': case 'lancer': ctx.beginPath(); ctx.moveTo(.6, 0); ctx.lineTo(e.type === 'lancer' ? 2 : 1.5, 0); ctx.lineWidth = .3; ctx.stroke(); break;
    case 'lobber': xf(ctx, x, y, e.angTo, e.r, e.r); ctx.fillStyle = e.col; ctx.fillRect(.2, -.3, 1, .6); break;
    case 'tick': ctx.fillStyle = (e.atkPhase === 1 ? (t * 16 % 1 < .5) : (t * 3 % 1 < .3)) ? '#ffffff' : e.col; ctx.beginPath(); ctx.arc(0, 0, .45, 0, TAU); ctx.fill(); break;
    case 'brood': ctx.fillStyle = e.col; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cos(t + i * 2.1) * .45, sin(t + i * 2.1) * .45, .22 + .05 * sin(t * 4 + i), 0, TAU); ctx.fill(); } break;
    case 'mimic': if (e.a) { ctx.fillStyle = '#ffffff'; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * .28 - .12, -.1); ctx.lineTo(i * .28, .25 + .1 * sin(t * 20 + i)); ctx.lineTo(i * .28 + .12, -.1); ctx.fill(); } } else { ctx.fillStyle = '#ffe23a'; ctx.fillRect(-.15, -.2, .3, .4); } break;
    case 'jugg': ctx.strokeStyle = e.col; ctx.lineWidth = .12; ctx.strokeRect(-.55, -.55, 1.1, 1.1); break;
    case 'mender': break;
    case 'wisp': ctx.beginPath(); ctx.arc(0, 0, 1.5, t * 3, t * 3 + 4); ctx.lineWidth = .15; ctx.stroke(); break;
    case 'gel': ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(-.3, -.35, .2, 0, TAU); ctx.fill(); break;
  }
  if (e.type === 'bulwark') { // frontal shield arc
    xf(ctx, x, y, e.ang, e.r, e.r); ctx.beginPath(); ctx.arc(0, 0, 1.45, -e.def.arc, e.def.arc); ctx.lineWidth = .38; ctx.strokeStyle = e.shieldFlash > 0 ? '#ffffff' : '#9fd0ff'; ctx.stroke(); ctx.lineWidth = .12; ctx.strokeStyle = '#ffffff'; ctx.stroke(); }
  // status overlays
  if (e.frozenT > 0) { xf(ctx, x, y, .3, e.r * 1.3, e.r * 1.3); ctx.strokeStyle = 'rgba(200,245,255,.85)'; ctx.lineWidth = .1; ctx.stroke(SH.hex); }
  if (e.shield > 0) { xf(ctx, x, y, 0, e.r * 1.55, e.r * 1.55); ctx.globalAlpha = .25 + .35 * e.shield / e.shieldMax; ctx.strokeStyle = '#58a8ff'; ctx.lineWidth = .12; ctx.stroke(SH.circ); ctx.globalAlpha = 1; }
  if (e.elite) { xf(ctx, x, y, t * 1.5, e.r * 1.75, e.r * 1.75); ctx.lineWidth = .07; ctx.setLineDash([.3, .25]); e.mods.forEach((m, i) => { ctx.strokeStyle = T.elite[m].col; ctx.beginPath(); ctx.arc(0, 0, 1 + i * .14, 0, TAU); ctx.stroke(); }); ctx.setLineDash([]); }
  if (e.reflectT > 0) { xf(ctx, x, y, t * 4, e.r * 1.4, e.r * 1.4); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = .18; ctx.globalAlpha = .6 + .4 * sin(t * 30); ctx.stroke(SH.oct); ctx.globalAlpha = 1; }
  ctx.globalAlpha = 1;
  // hp bar when hurt (elites always)
  if ((e.hp < e.maxHp && G.time - e.lastHitT < 2.5) || e.elite) { camXf(); const w = max(18, e.r * 2), f = e.hp / e.maxHp; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - w / 2 - 1, y - e.r - 9, w + 2, 4);
    ctx.fillStyle = e.elite ? '#ffb020' : '#ff4a6a'; ctx.fillRect(x - w / 2, y - e.r - 8, w * f, 2); if (e.shieldMax) { ctx.fillStyle = '#58a8ff'; ctx.fillRect(x - w / 2, y - e.r - 6, w * e.shield / e.shieldMax, 1); } }
  if (G.debug.ai) { camXf(); ctx.font = '6px monospace'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(`${e.act}${e.role ? ' ' + ROLE_NAME[e.role] : ''}${e.token ? ' T' : ''}`, x, y + e.r + 9);
    if (e.path) { ctx.strokeStyle = 'rgba(255,255,0,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); for (let i = e.pathI * 2; i < e.path.length; i += 2) ctx.lineTo(e.path[i], e.path[i + 1]); ctx.stroke(); } }
  if (G.debug.hit) { camXf(); ctx.strokeStyle = '#0f0'; ctx.lineWidth = .7; ctx.beginPath(); ctx.arc(x, y, e.r, 0, TAU); ctx.stroke(); }
}
function drawBoss(ctx, e, x, y) {
  const t = G.rt, s = e.spin || 0, col = e.col, fl = e.flash > 0, dk = darkOf(col), r = e.r, ly = y - (e.lift || 0), inv = e.transT > 0;
  ctx.lineWidth = 2.5 / r;
  if (e.bossId === 'prism') {
    xf(ctx, x, ly, s, r, r); ctx.fillStyle = fl ? '#fff' : dk; ctx.fill(SH.hex); ctx.strokeStyle = fl ? '#fff' : col; ctx.stroke(SH.hex);
    xf(ctx, x, ly, -s * 1.7, r * .6, r * .6); ctx.strokeStyle = '#ffffff'; ctx.stroke(SH.tri); xf(ctx, x, ly, s * 2.3, r * .28, r * .28); ctx.fillStyle = '#ffffff'; ctx.fill(SH.hex);
    if (e.orbs) for (const o of e.orbs) { const a = o + s; xf(ctx, x + cos(a) * 95, ly + sin(a) * 95, -s * 3, 10, 10); ctx.fillStyle = dk; ctx.fill(SH.tri); ctx.lineWidth = .2; ctx.strokeStyle = col; ctx.stroke(SH.tri); }
  } else if (e.bossId === 'forge') {
    xf(ctx, x, ly, e.angTo, r, r); ctx.fillStyle = fl ? '#fff' : dk; ctx.fill(SH.oct); ctx.strokeStyle = fl ? '#fff' : col; ctx.stroke(SH.oct);
    ctx.fillStyle = e.phase === 2 ? '#ff8a2b' : '#ffb060'; ctx.beginPath(); ctx.arc(0, 0, .35 + .05 * sin(t * 8), 0, TAU); ctx.fill();
    const ha = sin(s) * .8; ctx.save(); ctx.rotate(ha); ctx.fillStyle = dk; ctx.strokeStyle = col; ctx.fillRect(.6, -.15, 1.1, .3); ctx.fillRect(1.5, -.5, .5, 1); ctx.strokeRect(1.5, -.5, .5, 1); ctx.restore();
  } else if (e.bossId === 'bloom') {
    for (let i = 0; i < 8; i++) { xf(ctx, x, ly, s + i * TAU / 8, r, r); ctx.fillStyle = fl ? '#fff' : dk; ctx.beginPath(); ctx.ellipse(1.05, 0, .65, .3, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = col; ctx.stroke(); }
    xf(ctx, x, ly, 0, r * .62, r * .62); ctx.fillStyle = fl ? '#fff' : '#1a2a0a'; ctx.fill(SH.circ); ctx.strokeStyle = '#ffe23a'; ctx.stroke(SH.circ);
    const a = e.angTo; ctx.fillStyle = '#ffe23a'; ctx.beginPath(); ctx.arc(cos(a) * .35, sin(a) * .35, .3, 0, TAU); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cos(a) * .45, sin(a) * .45, .12, 0, TAU); ctx.fill();
    // flood mechanic visuals
    const F = e.flood; if (F && F.st > 0) { camXf(); const c = arenaC(); ctx.globalAlpha = F.st === 1 ? .12 + .1 * sin(t * 20) : .32; ctx.fillStyle = '#5dff2a'; ctx.beginPath(); ctx.arc(c.x, c.y, 560, 0, TAU);
      for (const sf of F.safe) { ctx.moveTo(sf.x + sf.r, sf.y); ctx.arc(sf.x, sf.y, sf.r, 0, TAU, true); } ctx.fill('evenodd'); ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; for (const sf of F.safe) { ctx.beginPath(); ctx.arc(sf.x, sf.y, sf.r, 0, TAU); ctx.stroke(); } }
  } else {
    for (let i = 0; i < 3; i++) { xf(ctx, x, ly, s * (i % 2 ? -1 : 1) + i, r * (1.5 + i * .25), r * (.5 + i * .1)); ctx.strokeStyle = i === 1 ? '#ff3b1f' : col; ctx.lineWidth = .05; ctx.stroke(SH.circ); }
    xf(ctx, x, ly, s * .7, r * .9, r * .9); ctx.fillStyle = fl ? '#fff' : dk; ctx.fill(SH.sq); ctx.lineWidth = .08; ctx.strokeStyle = fl ? '#fff' : col; ctx.stroke(SH.sq);
    xf(ctx, x, ly, -s * 1.3 + PI / 4, r * .55, r * .55); ctx.strokeStyle = '#ff3b1f'; ctx.stroke(SH.sq); xf(ctx, x, ly, 0, r * .22, r * .22); ctx.fillStyle = '#ffffff'; ctx.fill(SH.circ);
    if (e.shrink) { camXf(); const c = arenaC(); ctx.strokeStyle = '#ff2a4a'; ctx.lineWidth = 4; ctx.globalAlpha = .6 + .4 * sin(t * 8); ctx.beginPath(); ctx.arc(c.x, c.y, e.shrinkR, 0, TAU); ctx.stroke();
      ctx.globalAlpha = .12; ctx.fillStyle = '#ff2a4a'; ctx.beginPath(); ctx.arc(c.x, c.y, 900, 0, TAU); ctx.arc(c.x, c.y, e.shrinkR, 0, TAU, true); ctx.fill(); ctx.globalAlpha = 1; }
  }
  if (inv) { xf(ctx, x, ly, t * 5, r * 1.5, r * 1.5); ctx.globalAlpha = .5 + .5 * sin(t * 30); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = .06; ctx.stroke(SH.hex); ctx.globalAlpha = 1; }
}
function drawCorpse(ctx, c) {
  c.t += 1 / 60; const j = 3 + c.t * 4; xf(ctx, c.x + rr(-j, j), c.y + rr(-j, j), c.spin + c.t * c.t * 3, c.r * (1 + c.t * .1), c.r * (1 + c.t * .1));
  ctx.fillStyle = (c.t * 12 % 1) < .5 ? '#ffffff' : darkOf(c.col); ctx.fill(SH.hex); ctx.lineWidth = .08; ctx.strokeStyle = c.col; ctx.stroke(SH.hex);
  if (rnd() < .6) emit(PK.SPARK, c.x + rr(-c.r, c.r), c.y + rr(-c.r, c.r), rr(-300, 300), rr(-300, 300), .4, 4, ci(c.col));
}
function drawAlly(ctx, a, alpha) {
  const x = lerpX(a, alpha), y = lerpY(a, alpha);
  if (a.kind === 'drone') { xf(ctx, x, y, a.ang, 5, 5); ctx.fillStyle = '#0d2a18'; ctx.fill(SH.wisp); ctx.lineWidth = .35; ctx.strokeStyle = '#5dff8a'; ctx.stroke(SH.wisp); }
  else if (a.kind === 'sentry') { xf(ctx, x, y, 0, 9, 9); ctx.fillStyle = '#0d2a18'; ctx.fill(SH.hex); ctx.lineWidth = .2; ctx.strokeStyle = '#5dff8a'; ctx.stroke(SH.hex); xf(ctx, x, y, a.ang, 9, 9); ctx.fillStyle = '#5dff8a'; ctx.fillRect(.2, -.18, 1.1, .36); }
  else if (a.kind === 'orbital') { xf(ctx, x, y, G.rt * 8, 5, 5); ctx.fillStyle = '#5dff8a'; ctx.fill(SH.tri); }
  else if (a.kind === 'ghost') { const sh = SH[a.type] || SH.circ; xf(ctx, x, y, atan2(a.vy, a.vx), a.r, a.r); ctx.globalAlpha = .5 + .2 * sin(G.rt * 8); ctx.fillStyle = 'rgba(127,246,255,.25)'; ctx.fill(sh); ctx.lineWidth = 2 / a.r; ctx.strokeStyle = '#7ff6ff'; ctx.stroke(sh); ctx.globalAlpha = 1; }
  else if (a.kind === 'decoy') { const p = G.player; xf(ctx, x, y, p.ang, 13, 13); ctx.globalAlpha = .45 + .3 * sin(G.rt * 15); ctx.lineWidth = .12; ctx.strokeStyle = p.color; ctx.stroke(SH.player); ctx.globalAlpha = 1; }
}
function drawPlayer(ctx, p, alpha) {
  const x = lerpX(p, alpha) + p.recX * .5, y = lerpY(p, alpha) + p.recY * .5, col = p.color, ang = p.ang;
  // afterimages
  for (const g of p.ghosts) { xf(ctx, g.x, g.y, g.a, 13, 13); ctx.globalAlpha = g.t / .22 * .45; ctx.lineWidth = .12; ctx.strokeStyle = col; ctx.stroke(SH.player); } ctx.globalAlpha = 1;
  if (p.dead) return;
  if (p.hitT > 0 && (p.hitT * 20 % 1) < .35 && p.flash <= 0) ctx.globalAlpha = .35;
  const sq = p.squash, bob = sin(p.bob) * .6, s = 13;
  xf(ctx, x, y + bob, ang, s * (1 + sq), s * (1 - sq * .6));
  ctx.fillStyle = p.flash > 0 ? '#ffffff' : darkOf(col); ctx.fill(SH.player); ctx.lineWidth = .14; ctx.strokeStyle = p.flash > 0 ? '#ffffff' : col; ctx.stroke(SH.player);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(.15, 0, .16, 0, TAU); ctx.fill();
  // weapon
  const w = curWeapon(p); ctx.fillStyle = '#d8e2f5'; ctx.fillRect(.4, -.1, .75 + (w.def.k === 'rail' ? .4 : 0), .2);
  ctx.globalAlpha = 1;
  if (p.shield > 0) { xf(ctx, x, y, 0, 19, 19); ctx.globalAlpha = .2 + .4 * p.shield / p.shieldMax; ctx.strokeStyle = '#5dff8a'; ctx.lineWidth = .06; ctx.stroke(SH.hex); ctx.globalAlpha = 1; }
  if (B.barrier && p.barrierT <= 0) { xf(ctx, x, y, G.rt, 21, 21); ctx.globalAlpha = .55; ctx.strokeStyle = '#7fdcff'; ctx.lineWidth = .05; ctx.stroke(SH.circ); ctx.globalAlpha = 1; }
  if (G.debug.hit) { camXf(); ctx.strokeStyle = '#0f0'; ctx.lineWidth = .7; ctx.beginPath(); ctx.arc(x, y, p.r * .7, 0, TAU); ctx.stroke(); }
}
// ---- emissive layer (additive) -------------------------------------------------------------------------------------------
function drawEmissive(ctx, alpha) {
  const p = G.player, t = G.rt, pal = bpal(); camXf();
  // zones glow
  for (const z of G.zones) { if (!inView(z.x, z.y, z.r)) continue; const f = min(1, z.t / .4);
    if (z.kind === 'fire' || z.kind === 'efire') { ctx.globalAlpha = .5 * f; ctx.drawImage(lightSprite('#ff6a1a'), z.x - z.r * 1.3, z.y - z.r * 1.3, z.r * 2.6, z.r * 2.6); if (rnd() < .2) emit(PK.DOT, z.x + rr(-z.r, z.r) * .7, z.y + rr(-z.r, z.r) * .7, 0, -60, .4, 2, C_FIRE, 1); }
    else if (z.kind === 'tesla') { ctx.globalAlpha = .7; ctx.strokeStyle = '#c39bff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.stroke(); ctx.globalAlpha = .15; ctx.fillStyle = '#b98bff'; ctx.fill(); }
    else if (z.kind === 'hole') { ctx.globalAlpha = .8; ctx.strokeStyle = '#b98bff'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(z.x, z.y, 30 + ((t * 80 + i * 40) % 140), 0, TAU); ctx.stroke(); } } }
  ctx.globalAlpha = 1;
  // enemy windup glows, warden auras, healer beams, sniper laser sights
  for (const e of G.enemies) {
    if (e.dead || e.spawnT > 0) continue; const x = lerpX(e, alpha), y = lerpY(e, alpha); if (!inView(x, y, 600)) continue;
    if (e.atkPhase === 1) { const f = 1 - e.atkT / e.atkDur, r = e.r * (2 + f * 2); ctx.globalAlpha = .35 + f * .5; ctx.drawImage(lightSprite(e.col), x - r, y - r, r * 2, r * 2); }
    if (e.type === 'warden') { ctx.globalAlpha = .25 + .1 * sin(t * 4); ctx.strokeStyle = e.col; ctx.lineWidth = 1.2; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 20; ctx.beginPath(); ctx.arc(x, y, e.def.aura, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    if (e.type === 'mender' && e.healTarget && !e.healTarget.dead) { const h = e.healTarget; ctx.globalAlpha = .6 + .3 * sin(t * 20); ctx.strokeStyle = '#3dffa8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(h.x, h.y); ctx.stroke(); }
    if (e.type === 'lancer' && e.atkPhase === 1 && e.sight > 0) { const a = e.aim, L = raycast(x, y, cos(a), sin(a), 1200, 0), f = e.sight;
      ctx.globalAlpha = .25 + f * .7; ctx.strokeStyle = f > .72 ? '#ffffff' : '#ff3df0'; ctx.lineWidth = .8 + f * 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cos(a) * L, y + sin(a) * L); ctx.stroke(); }
    if (e.boss) { ctx.globalAlpha = .4; const r = e.r * 3; ctx.drawImage(lightSprite(e.col), x - r, y - r, r * 2, r * 2); }
  }
  ctx.globalAlpha = 1;
  // boss lasers
  for (const l of LASERS) { const ex = l.x + cos(l.ang) * l.len, ey = l.y + sin(l.ang) * l.len;
    if (!l.on) { const f = l.t / l.warn; ctx.globalAlpha = .3 + .5 * f * (.5 + .5 * sin(t * 40)); ctx.strokeStyle = l.col; ctx.lineWidth = 1 + f * 2; ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(ex, ey); ctx.stroke(); }
    else { ctx.globalAlpha = 1; ctx.lineCap = 'round'; ctx.strokeStyle = l.col; ctx.lineWidth = l.w * (1 + .15 * sin(t * 50)); ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = l.w * .4; ctx.stroke(); ctx.lineCap = 'butt'; } }
  for (const v of VINES) { const e = v.owner; if (!e) continue; ctx.globalAlpha = v.t / .4; ctx.strokeStyle = '#7dff3a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(e.x, e.y, 300, v.a - .9, v.a + .9); ctx.stroke(); }
  ctx.globalAlpha = 1;
  // mortar shells in flight
  for (const m of MORTARS) { const f = m.t / m.d, x = lerp(m.x0, m.x1, f), y = lerp(m.y0, m.y1, f) - sin(f * PI) * 140; ctx.fillStyle = m.col || '#c8ff3a'; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill(); }
  // player weapon beam
  if (p && !p.dead) { const w = curWeapon(p);
    if (w.beam) { const x = p.x + cos(p.ang) * 14, y = p.y + sin(p.ang) * 14, b = w.beam; ctx.lineCap = 'round'; ctx.strokeStyle = pal[0]; ctx.lineWidth = b.w * (1 + .2 * sin(t * 60)); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = b.w * .4; ctx.stroke(); ctx.lineCap = 'butt'; }
    if (w.def.k === 'orbit') { for (let i = 0; i < w.ammo; i++) { const a = G.time * w.def.orbitSpd + i / max(1, w.mag) * TAU, bx = p.x + cos(a) * w.def.orbitR, by = p.y + sin(a) * w.def.orbitR; xf(ctx, bx, by, a * 2, 7, 7); ctx.fillStyle = pal[0]; ctx.fill(SH.tri); } camXf(); }
    if (p.muzzle > 0) { const r = 22; ctx.globalAlpha = p.muzzle / .05; ctx.drawImage(lightSprite('#ffe8a0'), p.x + cos(p.ang) * 18 - r, p.y + sin(p.ang) * 18 - r, r * 2, r * 2); ctx.globalAlpha = 1; }
    if (w.def.k === 'bow' && w.charge > 0) { ctx.globalAlpha = .4 + w.charge * .6; ctx.strokeStyle = w.full ? '#fff27a' : pal[0]; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 20 - w.charge * 6, p.ang - 1, p.ang + 1); ctx.stroke(); ctx.globalAlpha = 1; }
    if (p.buffs.aegis > 0) { ctx.strokeStyle = '#ffe23a'; ctx.lineWidth = 2; ctx.globalAlpha = .6; ctx.beginPath(); ctx.arc(p.x, p.y, 40, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  drawPlayerBullets(ctx, alpha);
  // pickups glow
  for (const k of G.pickups) { if (!inView(k.x, k.y, 10)) continue; ctx.globalAlpha = .5; const r = k.kind === 'gold' ? 9 : 14; ctx.drawImage(lightSprite(k.kind === 'gold' ? '#ffe23a' : '#5dff8a'), k.x - r, k.y - r, r * 2, r * 2); }
  ctx.globalAlpha = 1;
  if (G.debug.flow) drawFlowDebug(ctx);
}
function drawPlayerBullets(ctx, alpha) {
  const L = G.bullets, pal = bpal(), cols = [pal[0], pal[1], ELEM_COL[2], ELEM_COL[3], ELEM_COL[4], ELEM_COL[5]];
  ctx.lineCap = 'round';
  // streak bullets batched per colour: coloured body then white core
  for (let c = 0; c < cols.length; c++) {
    let any = false; ctx.beginPath();
    for (let i = 0; i < L.length; i++) { const b = L[i]; if (b.col !== c || b.shape > 1 && b.shape !== 5) continue; const x = lerpX(b, alpha), y = lerpY(b, alpha); if (!inView(x, y, 30)) continue;
      const k = b.shape === 5 ? .035 : .018; ctx.moveTo(x, y); ctx.lineTo(x - b.vx * k, y - b.vy * k); any = true; }
    if (!any) continue; ctx.strokeStyle = cols[c]; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.lineCap = 'butt';
  for (let i = 0; i < L.length; i++) {
    const b = L[i]; if (b.shape <= 1 || b.shape === 5) continue; const x = lerpX(b, alpha), y = lerpY(b, alpha); if (!inView(x, y, 30)) continue; const col = cols[b.col] || pal[0];
    switch (b.shape) {
      case 2: xf(ctx, x, y, atan2(b.vy, b.vx), 7, 3.5); ctx.fillStyle = '#ffffff'; ctx.fill(SH.player); ctx.globalAlpha = .9; camXf(); ctx.drawImage(lightSprite('#ff9a4a'), x - 12, y - 12, 24, 24); ctx.globalAlpha = 1; break;
      case 3: case 8: xf(ctx, x, y, b.age * 20, b.r * 1.3, b.r * 1.3); ctx.fillStyle = col; ctx.fill(b.shape === 3 ? SH.spire : SH.tri); ctx.lineWidth = .2; ctx.strokeStyle = '#ffffff'; ctx.stroke(b.shape === 3 ? SH.spire : SH.tri); break;
      case 4: { const f = b.age / (b.age + max(.01, b.life)), r = b.r * (1 + f * 2.2); camXf(); ctx.globalAlpha = .8 * (1 - f * .6); ctx.drawImage(lightSprite(f < .3 ? '#ffe8a0' : f < .6 ? '#ffb020' : '#ff4a1a'), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; break; }
      case 6: { camXf(); const armed = b.mine === 1 && b.armT >= T.W.mines.arm; ctx.fillStyle = '#d8e2f5'; ctx.beginPath(); ctx.arc(x, y, b.r, 0, TAU); ctx.fill(); ctx.fillStyle = (armed || b.mine >= 2) && (G.rt * 6 % 1) < .5 ? '#ff4a1a' : '#ffe23a'; ctx.beginPath(); ctx.arc(x, y, b.r * .5, 0, TAU); ctx.fill();
        if (armed) { ctx.globalAlpha = .15; ctx.strokeStyle = '#ff4a1a'; ctx.beginPath(); ctx.arc(x, y, T.W.mines.prox, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; } break; }
      case 7: { camXf(); const r = b.r * 2.4; ctx.drawImage(lightSprite('#c39bff'), x - r, y - r, r * 2, r * 2); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, b.r * .5, 0, TAU); ctx.fill(); break; }
    }
  }
  camXf();
}
// enemy orbs: cached sprites (dark rim for readability → colour → white core), one drawImage per bullet
const _orb = new Map(), ORB_SS = 3;
function orbSprite(col, r) {
  const k = col + r; let c = _orb.get(k); if (c) return c; c = document.createElement('canvas'); const R2 = r + 2.5, s = ceil(R2 * 2 * ORB_SS); c.width = c.height = s; const x = c.getContext('2d'); x.scale(ORB_SS, ORB_SS);
  x.fillStyle = '#0a0410'; x.beginPath(); x.arc(R2, R2, r + 2, 0, TAU); x.fill(); x.fillStyle = col; x.beginPath(); x.arc(R2, R2, r, 0, TAU); x.fill(); x.fillStyle = '#ffffff'; x.beginPath(); x.arc(R2, R2, r * .42, 0, TAU); x.fill();
  _orb.set(k, c); return c;
}
function drawEnemyBullets(ctx, alpha) {
  const L = G.ebullets; if (!L.length) return; camXf(); const pal = bpal();
  for (let i = 0; i < L.length; i++) {
    const b = L[i]; if (b.delay > 0) continue; const x = lerpX(b, alpha), y = lerpY(b, alpha); if (!inView(x, y, 20)) continue; const col = pal[b.shape === 3 || b.shape === 1 ? 3 : 2];
    if (b.shape === 2) { // needle: oriented diamond
      const a = atan2(b.vy, b.vx), c = cos(a), s = sin(a); ctx.beginPath();
      for (let pass = 0; pass < 3; pass++) { const l = pass === 0 ? 9 : 7, w = pass === 0 ? b.r + 1.5 : pass === 1 ? b.r * .8 : b.r * .35; ctx.beginPath(); ctx.moveTo(x + c * l, y + s * l); ctx.lineTo(x - s * w, y + c * w); ctx.lineTo(x - c * l, y - s * l); ctx.lineTo(x + s * w, y - c * w); ctx.closePath(); ctx.fillStyle = pass === 0 ? '#0a0410' : pass === 1 ? col : '#fff'; ctx.fill(); }
      continue; }
    const r = round(b.r * 2) / 2, img = orbSprite(col, r), h = r + 2.5; ctx.drawImage(img, x - h, y - h, h * 2, h * 2);
  }
}
function queueLights(alpha) {
  const p = G.player;
  if (p && !p.dead) light(p.x, p.y, 300, '#ffffff', .85);
  let n = 0; for (const b of G.bullets) { if (n++ > 70) break; light(b.x, b.y, b.shape === 4 ? 60 : 40, b.shape === 4 ? '#ff8a2b' : bpal()[0], .5); }
  n = 0; for (let i = 0; i < G.ebullets.length; i += 2) { if (n++ > 90) break; const b = G.ebullets[i]; light(b.x, b.y, 38, bpal()[b.shape === 3 ? 3 : 2], .55); }
  for (const e of G.enemies) { if (e.dead) continue; if (e.atkPhase === 1) light(e.x, e.y, 90, e.col, .8); else if (e.elite || e.boss) light(e.x, e.y, e.boss ? 260 : 70, e.col, .6); }
  for (const z of G.zones) if (z.kind === 'fire' || z.kind === 'efire') light(z.x, z.y, z.r * 3, '#ff6a1a', .5); else if (z.kind === 'tesla') light(z.x, z.y, z.r * 2, '#b98bff', .6);
  for (const l of LASERS) if (l.on) for (let k = 1; k < 5; k++) light(l.x + cos(l.ang) * l.len * k / 5, l.y + sin(l.ang) * l.len * k / 5, 90, l.col, .6);
  for (const pr of G.props) if (pr.kind !== 'barrel') light(pr.x, pr.y, 110, pr.kind === 'portal' ? '#ff2bd6' : pr.kind === 'fire' ? '#ff8a2b' : '#ffe23a', .7);
  if (p && curWeapon(p).beam) { const b = curWeapon(p).beam; light(b.x2, b.y2, 80, bpal()[0], .8); light((p.x + b.x2) / 2, (p.y + b.y2) / 2, 100, bpal()[0], .5); }
}
function drawFlowDebug(ctx) {
  const room = G.room, f = room.flow, c = G.cam; ctx.globalAlpha = .5; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath();
  for (let ty = 0; ty < room.h; ty++) for (let tx = 0; tx < room.w; tx++) { const x = (tx + .5) * TS, y = (ty + .5) * TS; if (!inView(x, y, 0) || f.dist[ty * room.w + tx] > 1e8) continue; f.dir(x, y); ctx.moveTo(x, y); ctx.lineTo(x + _fx * 12, y + _fy * 12); }
  ctx.stroke(); ctx.globalAlpha = 1;
}
