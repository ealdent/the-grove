// probe: which side does each reaching elbow bow to, drawing by drawing?
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from '../../utils/degauss/video/cdp.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [from, to, seed] = process.argv.slice(2).map(Number);
const chrome = await launch({ port: 9380, profile: path.join(HERE, 'prof4'), width: 640, height: 360 });
try {
  await chrome.goto(pathToFileURL(path.join(HERE, 'video.html')).href, 'window.__ready === true || !!window.__error', 120000);
  const out = [];
  for (let f = Math.round(from * 24); f < Math.round(to * 24); f += 2) {
    const r = await chrome.evaluate(`(window.__armDbg = [], __render(${f}), JSON.stringify(window.__armDbg.filter(a => a[0] === ${seed})))`);
    out.push((f / 24).toFixed(2) + ' ' + JSON.parse(r).map(a => a[1] + ' new' + (a[2] > 0 ? '+' : '-') + ' old' + (a[4] > 0 ? '+' : '-')).join(' '));
  }
  console.log(out.join('\n'));
} finally { chrome.close(); }
