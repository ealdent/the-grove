// Render the Degauss intro with headless Chrome: frames/f_00000.jpg ... and wav/score.wav.
//   node render.mjs                      all 900 frames + the score
//   node render.mjs --stills 1.1,5.8     PNG stills of single moments into stills/
//   node render.mjs --poster 3.4         out/degauss-poster.png
//   node render.mjs --no-audio | --no-video | --from 120 --to 240
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from './cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FPS = 60, FRAMES = 900;
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : args[i + 1]; };
const has = name => args.includes('--' + name);
const decode = url => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');

const chrome = await launch({ port: 9351, profile: path.join(HERE, 'prof'), width: 1080, height: 1080 });
try {
  await chrome.goto(pathToFileURL(path.join(HERE, 'intro.html')).href, 'window.__ready === true || !!window.__error');
  const error = await chrome.evaluate('window.__error || null');
  if (error) throw new Error('intro.html: ' + error);
  const ligs = await chrome.evaluate('__ligCheck()');
  const flat = ligs.filter(([, diff]) => diff < 200);
  if (flat.length) throw new Error('canvas did not ligate: ' + flat.map(([s]) => s).join(' '));

  const stills = opt('stills'), poster = opt('poster');
  if (stills || poster) {
    const shots = stills ? stills.split(',').map(Number).map(t => [t, path.join(HERE, 'stills', `t_${t.toFixed(2)}.png`)]) : [];
    if (poster) shots.push([Number(poster), path.join(HERE, 'out', 'degauss-poster.png')]);
    for (const [t, file] of shots) {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, decode(await chrome.evaluate(`__render(${Math.round(t * FPS)}, 'image/png')`)));
      console.log('wrote', path.relative(HERE, file));
    }
  } else {
    if (!has('no-video')) {
      mkdirSync(path.join(HERE, 'frames'), { recursive: true });
      const from = Number(opt('from', 0)), to = Math.min(FRAMES, Number(opt('to', FRAMES)));
      const t0 = Date.now();
      for (let i = from; i < to; i++) {
        const url = await chrome.evaluate(`__render(${i})`);
        writeFileSync(path.join(HERE, 'frames', `f_${String(i).padStart(5, '0')}.jpg`), decode(url));
        if (i % 60 === 59) console.log(`frame ${i + 1}/${to}  ${((Date.now() - t0) / (i + 1 - from)).toFixed(1)} ms/frame`);
      }
    }
    if (!has('no-audio')) {
      const { chunks, peak } = await chrome.evaluate('__audio()');
      const parts = [];
      for (let k = 0; k < chunks; k++) parts.push(Buffer.from(await chrome.evaluate(`__wav[${k}]`), 'base64'));
      mkdirSync(path.join(HERE, 'wav'), { recursive: true });
      writeFileSync(path.join(HERE, 'wav', 'score.wav'), Buffer.concat(parts));
      console.log(`wrote wav/score.wav (graph peak ${peak.toFixed(3)} before normalising to 0.89)`);
    }
  }
} finally {
  chrome.close();
}
