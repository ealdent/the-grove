// probe: how big do the texture caches get over a run of frames?
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from '../../utils/degauss/video/cdp.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [from, to, step] = process.argv.slice(2).map(Number);
const chrome = await launch({ port: 9378, profile: path.join(HERE, 'prof2'), width: 1920, height: 1080 });
try {
  await chrome.goto(pathToFileURL(path.join(HERE, 'index.html')).href, 'window.__ready === true || !!window.__error', 120000);
  await chrome.evaluate('(F.frameKeys = new Set(), window.__maxKeys = 0, 0)');
  for (let i = from; i < to; i += step) {
    await chrome.evaluate(`(__render(${i}), window.__maxKeys = Math.max(window.__maxKeys, F.frameKeys.size), 0)`);
    if ((i - from) % (step * 60) === 0) console.log(i, (i / 24).toFixed(1) + 's', await chrome.evaluate(`JSON.stringify([F.pats.size, F.frameKeys ? F.frameKeys.size : -1, Object.keys(F.inkPats).length, window.__maxKeys])`));
  }
} finally { chrome.close(); }
