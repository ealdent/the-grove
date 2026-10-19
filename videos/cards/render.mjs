// Render the link-preview images (Open Graph / X cards) for the videos pages: 1200×630, captured at 2× as JPEG.
//   node videos/cards/render.mjs
// Writes videos/media/card.jpg, videos/p-doom/media/card.jpg and videos/save-me-a-seat/media/card.jpg.
// Chrome must run outside the command sandbox (and reach Google Fonts).
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, sleep } from '../../utils/degauss/video/cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), VIDEOS = path.dirname(HERE);
const W = 1200, H = 630, SCALE = 2;
const chrome = await launch({ port: 9391, profile: path.join(HERE, 'prof'), width: W, height: H });
const shot = async (file, opts = {}) => {
  const r = await chrome.send('Page.captureScreenshot', { format: opts.format || 'jpeg', quality: 88, ...(opts.clip ? { clip: opts.clip } : {}) });
  writeFileSync(file, Buffer.from(r.data, 'base64'));
  console.log('wrote', path.relative(VIDEOS, file));
};
const settle = () => chrome.evaluate(`(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => (i.onload = i.onerror = r)))); return true; })()`);
try {
  await chrome.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false });
  // the shelf's sky: the live hero, its words hidden, a few seconds in so the cassette has drifted into place
  await chrome.goto(pathToFileURL(path.join(VIDEOS, 'index.html')).href, 'document.readyState === "complete"');
  await chrome.evaluate(`document.head.insertAdjacentHTML('beforeend', '<style>.masthead,.bar,.hero-foot{visibility:hidden}.hero{height:630px!important}</style>'); 0`);
  await settle(); await sleep(4200);
  await chrome.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await sleep(400);
  await shot(path.join(HERE, 'frames', 'shelf-sky.jpg'));
  await chrome.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false });
  for (const [card, out] of [['shelf', 'media/card.jpg'], ['p-doom', 'p-doom/media/card.jpg'], ['save-me-a-seat', 'save-me-a-seat/media/card.jpg']]) {
    await chrome.goto(pathToFileURL(path.join(HERE, card + '.html')).href, 'document.readyState === "complete"');
    await settle(); await sleep(300);
    await shot(path.join(VIDEOS, out));
  }
} finally {
  chrome.close();
}
