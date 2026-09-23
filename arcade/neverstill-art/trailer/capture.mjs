// Frame-stepped gameplay capture. For each clip: load the capture page, run its setup, simulate `warm` frames,
// then record `secs` seconds at 60 fps: frame script -> update(1/60) -> camera script -> render -> JPEG.
// Also logs every SFX call and the engine/wind bed state per frame for the offline audio pass.
// Usage: node capture.mjs [clipA,clipB] [--stills]
import { launch } from './cdp.mjs';
import { CLIPS } from './clips.mjs';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';

const DIR = new URL('.', import.meta.url).pathname;
const args = process.argv.slice(2);
const stills = args.includes('--stills');
const only = args.find(a => !a.startsWith('--'))?.split(',');
const toolkit = readFileSync(DIR + 'toolkit.js', 'utf8');
const b = await launch({ profile: DIR + 'prof-cap', port: 9342 });

const frameExpr = (clip, i, capture) => `(() => {
  const T = __T, N = T.N, G = N.G, PL = N.PL, i = ${i}, t = i / 60;
  window.__capT = t; window.__fakeNow = 100000 + (i + ${clip.warm || 0}) * 1000 / 60;
  ${clip.frame || ''}
  N.sim(1 / 60, 1);
  ${clip.cam || ''}
  N.render();
  ${capture ? `return [document.getElementById('gl').toDataURL('image/jpeg', 0.94),
    [G.state === 'play' && PL.alive && !G.paused ? 1 : 0, +PL.speed.toFixed(2), PL.boosting ? 1 : 0, PL.agl < 8 ? 1 : 0]];` : 'return 0;'}
})()`;

try {
  for (const clip of CLIPS) {
    if (only && !only.includes(clip.name)) continue;
    const t0 = Date.now();
    await b.goto(`file://${DIR}nv_cap.html?pass=video&seed=${clip.seed || 7}&rng=${clip.rng || 1}`, `!!(window.__neverstill && __neverstill.G.menu[0] === 'title')`);
    await b.evaluate(`dispatchEvent(new Event('resize')); ${toolkit}`);
    const setupInfo = await b.evaluate(`(() => { const T = __T, N = T.N, C = T.C, G = N.G, PL = N.PL; ${clip.setup || ''}; return T.state(); })()`);
    const warm = clip.warm || 0;
    if (clip.prepass) {
      /* dry run of the identical take (same seed, same frames, renders included since frameNo feeds the sim),
         so the real take can place things on the path the rocket actually flies */
      const nn = Math.round(clip.secs * 60);
      for (let i = -warm; i < nn; i++) await b.evaluate(frameExpr(clip, i, false));
      const prev = await b.evaluate('window.__path || null');
      await b.goto(`file://${DIR}nv_cap.html?pass=video&seed=${clip.seed || 7}&rng=${clip.rng || 1}`, `!!(window.__neverstill && __neverstill.G.menu[0] === 'title')`);
      await b.evaluate(`dispatchEvent(new Event('resize')); ${toolkit}; window.__prev = ${JSON.stringify(prev)};`);
      await b.evaluate(`(() => { const T = __T, N = T.N, C = T.C, G = N.G, PL = N.PL; ${clip.setup || ''}; return 0; })()`);
    }
    for (let i = -warm; i < 0; i++) await b.evaluate(frameExpr(clip, i, false));
    const n = Math.round((stills ? 0.02 : clip.secs) * 60);
    const out = DIR + 'frames/' + clip.name + '/';
    rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
    await b.evaluate(`window.__sfxLog = []`);
    const beds = [], states = [];
    for (let i = 0; i < n; i++) {
      const [url, bed] = await b.evaluate(frameExpr(clip, i, true));
      writeFileSync(out + 'f_' + String(i).padStart(5, '0') + '.jpg', Buffer.from(url.split(',')[1], 'base64'));
      beds.push(bed);
      if (i % 30 === 0) states.push([i, await b.evaluate('__T.state()')]);
    }
    const sfx = await b.evaluate('window.__sfxLog');
    mkdirSync(DIR + 'logs', { recursive: true });
    writeFileSync(DIR + 'logs/' + clip.name + '.json', JSON.stringify({ name: clip.name, fps: 60, frames: n, sfx, beds, states, setupInfo }));
    console.log(`${clip.name}: ${n} frames, ${sfx.length} sfx, ${((Date.now() - t0) / 1000).toFixed(0)}s  start=${JSON.stringify(setupInfo)}  end=${JSON.stringify(states.at(-1)?.[1])}`);
  }
} finally { b.close(); }
