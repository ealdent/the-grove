// print the edit's cut times
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from '../../utils/degauss/video/cdp.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const chrome = await launch({ port: 9379, profile: path.join(HERE, 'prof3'), width: 640, height: 360 });
try {
  await chrome.goto(pathToFileURL(path.join(HERE, 'index.html')).href, 'window.__ready === true || !!window.__error', 120000);
  console.log(await chrome.evaluate(`JSON.stringify(SCENES.map(s => +s.t.toFixed(3)))`));
} finally { chrome.close(); }
