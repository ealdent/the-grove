import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const tutorialPath = new URL('../learn/synthid-text.html', import.meta.url);
const indexPath = new URL('../learn/index.html', import.meta.url);

test('the SynthID lesson has unique IDs and valid in-page navigation targets', async () => {
  const html = await readFile(tutorialPath, 'utf8');
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  const anchors = [...html.matchAll(/\shref="#([^"]+)"/g)].map(match => match[1]);

  assert.equal(new Set(ids).size, ids.length, 'interactive IDs must be unique');
  for (const target of anchors) {
    assert.ok(ids.includes(target), `missing in-page target #${target}`);
  }
  for (const section of ['tokens', 'key', 'tournament', 'nondistortion', 'detector', 'evidence', 'thresholds', 'robustness', 'family', 'limits', 'sources']) {
    assert.ok(ids.includes(section), `missing chapter ${section}`);
  }
});

test('the lesson identifies its simulation boundary and links primary sources', async () => {
  const html = await readFile(tutorialPath, 'utf8');

  assert.match(html, /cannot determine whether arbitrary pasted text came from Gemini/i);
  assert.match(html, /not Google’s production detector/i);
  assert.match(html, /doi\.org\/10\.1038\/s41586-024-08025-4/);
  assert.match(html, /github\.com\/google-deepmind\/synthid-text/);
  assert.match(html, /static-content\.springer\.com\/esm/);
  assert.match(html, /three@0\.184\.0/);
  assert.match(html, /id="signal-field"/);
  assert.match(html, /prefers-reduced-motion/);

  const blankLinks = [...html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)].map(match => match[0]);
  assert.ok(blankLinks.length >= 8);
  for (const link of blankLinks) assert.match(link, /rel="noreferrer"/);
});

test('the Learn hub lists SynthID-Text alphabetically with its shader shell', async () => {
  const html = await readFile(indexPath, 'utf8');
  const strange = html.indexOf('href="strange-attractors.html"');
  const synthid = html.indexOf('href="synthid-text.html"');
  const steganography = html.indexOf('href="text-steganography.html"');

  assert.ok(strange >= 0 && synthid > strange && steganography > synthid);
  const synthidShell = html.slice(html.lastIndexOf('<div class="tile-shell">', synthid), html.indexOf('</div>', synthid) + 6);
  assert.match(synthidShell, /class="tile-shader"/);
  assert.match(synthidShell, /How Google DeepMind watermarks model output/);
});
