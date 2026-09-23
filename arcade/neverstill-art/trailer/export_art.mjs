// Export the game's own logo (at several scales) and the title key art for the trailer cards.
import { launch } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
const DIR = new URL('.', import.meta.url).pathname;
const b = await launch({ profile: DIR + 'prof-cap', port: 9343 });
try {
  await b.goto(`file://${DIR}nv_cap.html?pass=video&seed=7&rng=1`, `!!(window.__neverstill && __neverstill.G.menu[0] === 'title')`);
  mkdirSync(DIR + 'art', { recursive: true });
  for (const sc of [8, 14, 20]) {
    const url = await b.evaluate(`__nvcap.logoCanvas(${sc}).toDataURL('image/png')`);
    writeFileSync(DIR + `art/logo_${sc}.png`, Buffer.from(url.split(',')[1], 'base64'));
  }
  const ka = await b.evaluate(`(() => { const im = __nvcap.keyArt, c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); return c.toDataURL('image/png'); })()`);
  writeFileSync(DIR + 'art/keyart.png', Buffer.from(ka.split(',')[1], 'base64'));
  console.log('ok');
} finally { b.close(); }
