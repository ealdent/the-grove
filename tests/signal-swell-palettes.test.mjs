import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Signal Swell's palettes live in the demo's scene block, the same block the
// Shaders gallery copies. Evaluate that block on its own (it has no DOM or
// WebGL in it) and check that every ink reads on its paper in both themes,
// and that the scheme resolver falls back the way the page expects.
const demoPath = new URL('../shaders/signal-swell-shader-demo.html', import.meta.url);
const START = '/* ---------------- the swell ----------------';
const END = 'function compile(type, source) {';

async function sceneBlock() {
  const demo = await readFile(demoPath, 'utf8');
  const start = demo.indexOf(START);
  const end = demo.indexOf(END);
  assert.ok(start >= 0 && end > start, 'demo block markers not found');
  return new Function(demo.slice(start, end) +
    '\nreturn { PALETTES, DEFAULT_PALETTE, hexRGB, contrast, resolveScheme };')();
}

test('every palette ink reads at 3:1 or better on its paper, in both themes', async () => {
  const { PALETTES, DEFAULT_PALETTE, hexRGB, contrast } = await sceneBlock();
  assert.ok(PALETTES.some(p => p.id === DEFAULT_PALETTE), 'the default palette must exist');
  assert.equal(new Set(PALETTES.map(p => p.id)).size, PALETTES.length, 'palette ids must be unique');
  for (const p of PALETTES) {
    for (const theme of ['light', 'dark']) {
      const look = p[theme];
      assert.match(look.paper, /^#[0-9a-f]{6}$/, `${p.id} ${theme} paper`);
      assert.match(look.ink, /^#[0-9a-f]{6}$/, `${p.id} ${theme} ink`);
      const ratio = contrast(hexRGB(look.ink), hexRGB(look.paper));
      assert.ok(ratio >= 3, `${p.id} ${theme}: ink on paper is only ${ratio.toFixed(2)}:1`);
    }
  }
});

test('a saved theme wins, the system theme fills in, unknown palettes fall back', async () => {
  const { resolveScheme, DEFAULT_PALETTE } = await sceneBlock();
  assert.equal(resolveScheme({}, false).theme, 'light');
  assert.equal(resolveScheme({}, true).theme, 'dark');
  assert.equal(resolveScheme({ theme: 'light' }, true).theme, 'light');
  assert.equal(resolveScheme({ theme: 'sepia' }, true).theme, 'dark');
  assert.equal(resolveScheme({ palette: 'cobalt' }, false).palette.id, 'cobalt');
  assert.equal(resolveScheme({ palette: 'nope' }, false).palette.id, DEFAULT_PALETTE);
  assert.equal(resolveScheme({ palette: 'custom' }, false).palette.id, DEFAULT_PALETTE, 'custom with no ink');
  assert.equal(resolveScheme({ palette: 'custom', custom: 'red' }, false).palette.id, DEFAULT_PALETTE, 'custom with a bad ink');
});

test('a custom ink keeps reading on both papers, however pale or dark the pick', async () => {
  const { resolveScheme, contrast } = await sceneBlock();
  for (const custom of ['#ffff00', '#ffffff', '#000080', '#000000', '#2fb5c8']) {
    for (const prefersDark of [false, true]) {
      const s = resolveScheme({ palette: 'custom', custom }, prefersDark);
      assert.equal(s.palette.id, 'custom');
      const ratio = contrast(s.ink, s.paper);
      assert.ok(ratio >= 3, `${custom} on ${s.theme} paper: ${ratio.toFixed(2)}:1`);
    }
  }
});
