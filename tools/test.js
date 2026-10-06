// Playwright harness: smoke test, screenshots, bot playthrough, stress profile.
// usage: NODE_PATH=$(npm root -g) node tools/test.js [mode] [seconds]
//   modes: smoke | bot | stress | shots
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const mode = process.argv[2] || 'smoke', secs = +(process.argv[3] || 20);
const out = process.env.OUT || path.join(__dirname, '..', 'shots'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(1500);
  const shot = async n => page.screenshot({ path: path.join(out, n + '.png') });
  await shot('title');
  const stat = () => page.evaluate(() => { const G = SL.G; return { state: G.state, fps: G.stats.fps.toFixed(1), sim: G.stats.simMs.toFixed(2), ren: G.stats.renderMs.toFixed(2), en: G.enemies.length, pb: G.bullets.length, eb: G.ebullets.length, pn: SL.P.n,
    hp: G.player && Math.round(G.player.hp), biome: G.run && G.run.biome, rooms: G.run && G.run.stats.rooms, kills: G.run && G.run.stats.kills, ui: document.querySelector('#ui').firstElementChild && document.querySelector('#ui').firstElementChild.className, screen: window.UI_SCREEN }; });
  if (mode === 'smoke' || mode === 'bot' || mode === 'shots') {
    await page.evaluate(() => { SL.G.botAuto = true; SL.startRun({ char: 'kestrel', seed: 'TEST1', heat: 0 }); });
    await page.waitForTimeout(800); await shot('map');
    if (mode !== 'bot') await page.evaluate(() => { SL.G.godMode = true; });
    const t0 = Date.now(); let i = 0;
    while (Date.now() - t0 < secs * 1000) {
      await page.waitForTimeout(2000); i++;
      const s = await stat(); console.log(JSON.stringify(s));
      if (mode === 'shots' || i % 5 === 0) await shot('play' + i);
      if (s.state === 'summary') break;
    }
  }
  if (mode === 'run') { // turbo full-run bot test (god mode optional via GOD=1)
    const char = process.env.CHAR || 'kestrel', seed = process.env.SEED || 'RUN1';
    await page.evaluate(([c, s, god]) => { SL.G.botAuto = true; SL.startRun({ char: c, seed: s, heat: 0 }); SL.G.godFlag = god; }, [char, seed, !!process.env.GOD]);
    let last = '', same = 0;
    for (let k = 0; k < secs; k++) {
      const s = await page.evaluate(() => { if (SL.G.godFlag) SL.G.godMode = true; return SL.turbo(1200); });
      const key = s.node + s.state + s.screen; if (key === last) same++; else { same = 0; last = key; console.log(JSON.stringify(s)); }
      if (same === 25) { console.log('STUCK?', JSON.stringify(s)); await shot('stuck' + k);
        console.log(await page.evaluate(() => JSON.stringify({ dir: { a: SL.DIRECTOR.active, spent: SL.DIRECTOR.spent, budget: SL.DIRECTOR.budget, ph: SL.DIRECTOR.phase }, p: [SL.G.player.x|0, SL.G.player.y|0], open: SL.G.room.open, cleared: SL.G.room.cleared,
          en: SL.G.enemies.filter(e => !e.dead).map(e => ({ t: e.type, x: e.x|0, y: e.y|0, hp: e.hp|0, act: e.act, sp: e.spawnT, bur: e.burrowed, inv: e.inv, ph: e.atkPhase, tile: tileAt(e.x, e.y), los: e.los, boss: e.boss })) }))); }
      if (s.state === 'summary') { await shot('summary'); break; }
      await page.waitForTimeout(30);
    }
  }
  if (mode === 'scene') { // real-time capture of a configured fight: BIOME, NODE(type), UPGS, WEAPON, CHAR
    await page.evaluate(([b, type, ups, w, ch]) => { SL.G.botAuto = true; SL.startRun({ char: ch, seed: 'SCENE' + b + type, heat: 0 }); const run = SL.G.run;
      run.biome = b; run.map = genMap(run, b); const n = run.map.layers[3][0]; n.type = type; if (type === 'boss') { n.id = b + '-boss'; n.layer = 6; }
      if (w) { run.weapons[0] = makeWeapon(w); } for (const u of ups) if (u) SL.pickUpgrade(u, true); SL.enterNode(n); SL.G.godMode = true; },
      [+(process.env.BIOME || 0), process.env.NODE || 'combat', (process.env.UPGS || '').split(','), process.env.WEAPON || '', process.env.CHAR || 'kestrel']);
    for (let i = 1; i <= secs; i++) { await page.waitForTimeout(2500); if (process.env.TURBO) await page.evaluate(() => SL.turbo(600)); console.log(JSON.stringify(await stat())); await shot((process.env.TAG || 'scene') + i); }
  }
  if (mode === 'stress') {
    await page.evaluate(() => { SL.G.botAuto = true; SL.startRun({ char: 'kestrel', seed: 'STRESS', heat: 0 }); });
    await page.waitForTimeout(500);
    await page.evaluate(() => { const n = SL.G.run.map.layers[0][0]; SL.enterNode(n); SL.G.godMode = true; SL.DIRECTOR.active = false; });
    await page.waitForTimeout(500);
    await page.evaluate(() => SL.stress(300, 1000));
    for (let i = 0; i < 5; i++) { await page.waitForTimeout(1500); console.log(JSON.stringify(await stat())); }
    await shot('stress');
    // pure sim timing without rendering
    const r = await page.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 240; i++) simTick(1 / 120); return (performance.now() - t0) / 240; });
    console.log('sim ms/tick (300 enemies, ~1000 bullets):', r.toFixed(3));
  }
  console.log('ERRORS:', errors.length); for (const e of errors.slice(0, 30)) console.log(e);
  await browser.close();
})();
