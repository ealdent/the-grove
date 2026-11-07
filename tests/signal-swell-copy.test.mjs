import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// The Shaders gallery tile for Signal Swell runs a copy of the demo's scene
// code (swell table, mesh builder, both shaders). A copy that drifts forks
// every bug into two places, so the two must stay identical apart from
// indentation (the gallery nests the block one level deeper).
const demoPath = new URL('../shaders/signal-swell-shader-demo.html', import.meta.url);
const indexPath = new URL('../shaders/index.html', import.meta.url);

const START = '/* ---------------- the swell ----------------';
const END = '/* ---------------- engine ----------------';
const OPEN = '// ---- begin: copied verbatim from signal-swell-shader-demo.html ----';
const CLOSE = '// ---- end: copied verbatim from signal-swell-shader-demo.html ----';

const normalise = text => text.split('\n').map(line => line.trim()).filter(Boolean).join('\n');

test('the gallery tile runs the Signal Swell demo scene code verbatim', async () => {
  const demo = await readFile(demoPath, 'utf8');
  const index = await readFile(indexPath, 'utf8');

  const start = demo.indexOf(START);
  const end = demo.indexOf(END);
  assert.ok(start >= 0 && end > start, 'demo block markers not found');
  const open = index.indexOf(OPEN);
  const close = index.indexOf(CLOSE);
  assert.ok(open >= 0 && close > open, 'gallery copy markers not found');

  const original = demo.slice(demo.lastIndexOf('\n', start) + 1, demo.lastIndexOf('\n', end));
  const copy = index.slice(index.indexOf('\n', open) + 1, index.lastIndexOf('\n', close));
  assert.ok(normalise(original).includes('void main()'), 'demo block should hold the shaders');
  assert.equal(normalise(copy), normalise(original),
    'shaders/index.html drifted from the Signal Swell demo; re-copy the block between the markers');
});
