// Render the trailer overlays (overlay.html) to a transparent PNG sequence, one per output frame.
// Frames with nothing on screen reuse one blank PNG. Usage: node overlays.mjs [--only=f0-f1] [--png=...]
import { launch } from './cdp.mjs';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';

const DIR = new URL('.', import.meta.url).pathname;
const E = JSON.parse(readFileSync(DIR + 'edl.json', 'utf8'));
const S = JSON.parse(readFileSync(DIR + 'score.json', 'utf8'));
const BAR = 60 / S.bpm * 4;
const total = Math.round((E.end_bar * BAR + E.tail) * 60);
const arg = process.argv.find(a => a.startsWith('--only='));
const [f0, f1] = arg ? arg.split('=')[1].split('-').map(Number) : [0, total];
const b = await launch({ profile: DIR + 'prof-ovl', port: 9356 });
try {
  await b.goto(`file://${DIR}overlay.html`, `!!(window.__ready && document.fonts.status === 'loaded' && document.fonts.check('900 40px "Cinzel Decorative"') && document.fonts.check('italic 600 20px "Cormorant Garamond"'))`);
  await b.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  await b.evaluate(`window.EDL = ${JSON.stringify(E)}; window.BAR = ${BAR};`);
  if (!arg) rmSync(DIR + 'overlays', { recursive: true, force: true });
  mkdirSync(DIR + 'overlays', { recursive: true });
  await b.evaluate('render(-100)');
  const blank = DIR + 'overlays/blank.png';
  writeFileSync(blank, await b.shot('png'));
  let drawn = 0;
  for (let f = f0; f < f1; f++) {
    const out = DIR + 'overlays/o_' + String(f).padStart(5, '0') + '.png';
    if (await b.evaluate(`render(${f / 60})`)) { writeFileSync(out, await b.shot('png')); drawn++; }
    else copyFileSync(blank, out);
  }
  console.log(`overlays: ${f1 - f0} frames, ${drawn} drawn`);
} finally { b.close(); }
