// Frame-stepped gameplay capture. For each clip: load the capture page, run its setup, simulate `warm` frames,
// then record `secs` seconds at 60 fps: frame script -> game timers -> update(1/60) -> camera script -> render
// -> CSS animations pinned to game time -> full-page screenshot (WebGL + the game's DOM HUD).
// Also logs every sfx call with its clip time for the offline audio pass.
// Usage: node capture.mjs [clipA,clipB] [--every=N]   (--every keeps 1 frame in N: a quick scout of a take)
import { launch } from './cdp.mjs';
import { CLIPS } from './clips.mjs';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';

const DIR = new URL('.', import.meta.url).pathname;
const args = process.argv.slice(2);
const every = +(args.find(a => a.startsWith('--every='))?.split('=')[1] || 1);
const only = args.find(a => !a.startsWith('--'))?.split(',');
const toolkit = readFileSync(DIR + 'toolkit.js', 'utf8');
const b = await launch({ profile: DIR + 'prof-cap', port: 9352 });
const READY = `!!(window.__ciReady && window.THREE && document.fonts.status === 'loaded' && document.fonts.check('900 40px "Cinzel Decorative"') && document.fonts.check('700 20px "Cinzel"'))`;

const frameExpr = (clip, i) => `(() => {
  const T = __T, g = T.g, i = ${i}, t = i / 60;
  const dt = ${clip.dt || '1 / 60'};               // < 1/60 = slow motion (still 60 fps of picture)
  window.__capFrame = i; window.__capT = t; window.__capMs += dt * 1000;
  ${clip.frame || ''}
  __gTick();
  g.update(dt);
  const saved = T.camSave();
  ${clip.cam || ''}
  g.render();
  T.camRestore(saved);
  T.stepAnims();
  return 0;
})()`;

try {
  for (const clip of CLIPS) {
    if (only && !only.includes(clip.name)) continue;
    const t0 = Date.now();
    await b.goto(`file://${DIR}ci_cap.html?pass=video&rng=${clip.rng || 1}`, READY);
    await b.evaluate(`${toolkit}`);
    const setupInfo = await b.evaluate(`(() => { const T = __T, g = T.g; window.__capMs = 0; ${clip.setup || ''}; return T.state(); })()`);
    const warm = clip.warm || 0;
    for (let i = -warm; i < 0; i++) await b.evaluate(frameExpr(clip, i));
    const n = Math.round(clip.secs * 60);
    const out = DIR + 'frames/' + clip.name + '/';
    rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
    await b.evaluate(`window.__sfxLog = []`);
    const states = [];
    for (let i = 0; i < n; i++) {
      await b.evaluate(frameExpr(clip, i));
      if (i % every === 0) writeFileSync(out + 'f_' + String(i).padStart(5, '0') + '.jpg', await b.shot());
      if (i % 30 === 0) states.push([i, await b.evaluate('__T.state()')]);
    }
    const sfx = await b.evaluate('window.__sfxLog');
    mkdirSync(DIR + 'logs', { recursive: true });
    writeFileSync(DIR + 'logs/' + clip.name + '.json', JSON.stringify({ name: clip.name, fps: 60, frames: n, sfx, states, setupInfo }, null, 0));
    console.log(`${clip.name}: ${n} frames, ${sfx.length} sfx, ${((Date.now() - t0) / 1000).toFixed(0)}s  end=${JSON.stringify(states.at(-1)?.[1])}`);
    if (b.errors.length) console.log('  page errors:', b.errors.splice(0).slice(0, 5).join(' | '));
  }
} finally { b.close(); }
