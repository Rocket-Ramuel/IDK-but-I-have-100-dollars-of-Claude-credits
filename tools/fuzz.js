// Fuzz: every weapon / character / active / all-upgrades build, bot-driven, catching exceptions.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } }); const errs = [];
  page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html')); await page.waitForTimeout(600);
  const W = await page.evaluate(() => Object.keys(SL.T.W)), C = await page.evaluate(() => Object.keys(SL.T.CH)), ACTS = await page.evaluate(() => Object.keys(SL.T.ACT));
  const run = async (label, cfg) => {
    const r = await page.evaluate((cfg) => { try {
      SL.G.botAuto = true; SL.startRun({ char: cfg.char, seed: 'FZ' + cfg.label, heat: cfg.heat || 0 }); const run = SL.G.run;
      run.biome = cfg.biome || 0; run.map = genMap(run, run.biome); const n = run.map.layers[2][0]; n.type = cfg.type || 'combat';
      if (cfg.w) run.weapons = [makeWeapon(cfg.w)]; if (cfg.all) for (const id in SL.UPG) { if (SL.UPG[id].rar !== 4) SL.pickUpgrade(id, true); }
      if (cfg.acts) run.actives = cfg.acts.map(id => ({ id, cd: 0 }));
      SL.enterNode(n); SL.G.godMode = true; let kills0 = run.stats.kills;
      for (let i = 0; i < (cfg.ticks || 1800); i++) { if (SL.G.state !== 'play') break; if (SL.G.paused) { botUi(); if (SL.G.paused) { UI.clear(); SL.G.paused = false; } } SL.G.hitstop = 0;
        if (i % 120 === 0) { BOT.ability = true; IN.hits.act1 = 1; IN.hits.act2 = 1; if (i % 480 === 0) IN.hits.swap = 1; }
        simTick(1 / 120); }
      return { ok: true, kills: run.stats.kills - kills0, en: SL.G.enemies.length, pb: SL.G.bullets.length, syn: run.synergies.length };
    } catch (e) { return { ok: false, err: e.message, stack: e.stack.split('\n').slice(0, 4).join(' | ') }; } }, Object.assign({ label }, cfg));
    console.log(label.padEnd(26), JSON.stringify(r));
  };
  for (const w of W) await run('weapon:' + w, { char: 'kestrel', w });
  for (const c of C) await run('char:' + c, { char: c, biome: 1 });
  await run('actives', { char: 'kestrel', acts: ACTS.slice(0, 2) }); await run('actives2', { char: 'kestrel', acts: ACTS.slice(2, 4) });
  await run('actives3', { char: 'kestrel', acts: ACTS.slice(4, 6) }); await run('actives4', { char: 'kestrel', acts: ACTS.slice(6, 8) });
  for (const w of ['sidearm', 'rail', 'beam', 'arc', 'scatter', 'rocket', 'orbit', 'mines', 'flamer', 'bow']) await run('ALL+' + w, { char: 'volt', w, all: true, ticks: 1200, biome: 2 });
  for (let b = 0; b < 4; b++) await run('boss' + b, { char: 'kestrel', type: 'boss', biome: b, ticks: 6000, all: b === 3 });
  for (const t of ['shop', 'treasure', 'rest', 'event', 'elite', 'challenge']) await run('room:' + t, { char: 'wraith', type: t, ticks: 3000, biome: 3, heat: 10 });
  console.log('ERRORS', errs.length); errs.slice(0, 20).forEach(e => console.log(e));
  await browser.close();
})();
