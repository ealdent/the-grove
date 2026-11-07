import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Holographic Formula Drift's Download button builds a page of its own from
// the demo's own script: the glyph and engine sections, verbatim, plus the
// settings on screen and a small card to frame. Build one here from the file
// as it sits and check that it stands alone: three scripts that parse, the
// settings carried over, and an engine that defines itself without anything
// the download leaves behind.
const demoPath = new URL('../shaders/holographic-formula-drift-shader-demo.html', import.meta.url);
const BUILDER = '/* ---------------- download page ----------------';
const SCENE = '/* ---------------- glyphs ----------------';
const ENGINE = '/* ---------------- engine ----------------';
const PAGE = '/* ---------------- theme ----------------';
const NOTICE = 'Copyright (c) 2026 Jason Adams. Released under the MIT License: https://opensource.org/license/mit';

const LOOK = {
  theme: 'light',
  seed: 437.28,
  speed: 1.4,
  density: 1.2345,
  glow: 0.8,
  time: 41.237,
  from: 'https://example.test/shaders/holographic-formula-drift-shader-demo.html'
};

// The demo's main script, as document.currentScript.textContent sees it.
async function demoScript() {
  const page = await readFile(demoPath, 'utf8');
  const open = page.indexOf('<script>', page.indexOf('<body>')) + '<script>'.length;
  return page.slice(open, page.indexOf('</script>', open));
}

async function download(look = LOOK) {
  const script = await demoScript();
  const at = script.indexOf(BUILDER);
  assert.ok(at >= 0, 'download page section not found');
  const { buildDownload } = new Function(script.slice(at, script.lastIndexOf('})();')) +
    '\nreturn { buildDownload };')();
  return { script, file: buildDownload(script, look) };
}

// The page's scripts, past the opening comment (whose usage example has a <script> of its own).
const pageOf = html => html.slice(html.indexOf('-->') + 3);
const scriptsOf = html => [...pageOf(html).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);

// Whole lines, from the one holding `from` up to the one holding `to`.
const linesBetween = (text, from, to) => {
  const start = text.indexOf(from);
  return text.slice(text.lastIndexOf('\n', start) + 1, text.lastIndexOf('\n', text.indexOf(to, start)) + 1);
};

test('the download is one page, named for its theme, whose scripts all parse', async () => {
  const { file } = await download();
  assert.equal(file.name, 'holographic-formula-drift-light.html');
  assert.match(file.html, /^<!doctype html>\n<!--\n/);
  assert.equal((pageOf(file.html).match(/<script/g) || []).length, 3, 'settings, engine and start, nothing else');
  const scripts = scriptsOf(file.html);
  assert.equal(scripts.length, 3);
  for (const script of scripts) assert.doesNotThrow(() => new Function(script));
  assert.ok(file.html.includes('<title>Holographic Formula Drift · Light</title>'));
  assert.ok(file.html.includes('<meta name="theme-color" content="#f7fafd" />'));
  assert.ok(file.html.includes('Set the way you left it: the light theme, seed 437.28, drift at\n  1.4x, density 1.23, glow 0.8.'));
  assert.ok(file.html.includes('From https://example.test/shaders/holographic-formula-drift-shader-demo.html'));
  // the start script frames the download's own card
  assert.ok(pageOf(file.html).includes('<div id="card">'));
  assert.ok(scripts[2].includes('HolographicFormulaDrift(document.getElementById("card"), HOLOGRAPHIC_FORMULA_DRIFT)'));
});

test('it carries the settings that were on screen', async () => {
  const { file } = await download();
  const settings = new Function(scriptsOf(file.html)[0] + '\nreturn HOLOGRAPHIC_FORMULA_DRIFT;')();
  assert.deepEqual(settings, {
    theme: 'light',
    seed: 437.28,
    speed: 1.4,
    density: 1.23,
    glow: 0.8,
    time: 41.24
  });
});

test("its engine is the demo's own glyph and engine code, and needs nothing else", async () => {
  const { script, file } = await download();
  const engine = scriptsOf(file.html)[1];
  const scene = linesBetween(script, SCENE, ENGINE);
  const runner = linesBetween(script, ENGINE, PAGE);
  assert.ok(scene.includes('const glyphFragmentSource') && runner.includes('function createFormulaDrift('), 'section markers moved');
  assert.ok(engine.includes(scene + runner), 'the download should carry both sections verbatim');
  for (const word of ['getElementById', 'querySelector', 'URLSearchParams', 'localStorage', 'SOURCE', '__demo', 'buildDownload', 'themeButton', 'fallback']) {
    assert.ok(!engine.includes(word), `the engine should not carry ${word}`);
  }
  const window = {};
  new Function('window', engine)(window);
  assert.equal(typeof window.HolographicFormulaDrift, 'function');
});

test('a dark download keeps a long seed exactly, and a page with no web address leaves From out', async () => {
  const { file } = await download({ ...LOOK, theme: 'dark', seed: 123.456789, from: '' });
  assert.equal(file.name, 'holographic-formula-drift-dark.html');
  assert.ok(file.html.includes('<title>Holographic Formula Drift · Dark</title>'));
  assert.ok(file.html.includes('<meta name="theme-color" content="#07101a" />'));
  assert.ok(file.html.includes('Set the way you left it: the dark theme, seed 123.456789, drift at\n'));
  assert.ok(!file.html.includes('  From '));
  const settings = new Function(scriptsOf(file.html)[0] + '\nreturn HOLOGRAPHIC_FORMULA_DRIFT;')();
  assert.equal(settings.theme, 'dark');
  assert.equal(settings.seed, 123.456789, 'a rounded seed would be a different glyph field');
});

test('the MIT notice heads the file and the engine, so a copied engine keeps it', async () => {
  const { file } = await download();
  const header = file.html.slice(0, file.html.indexOf('-->'));
  assert.ok(header.includes('\n  ' + NOTICE + '\n'), 'the header should carry the notice');
  const engine = scriptsOf(file.html)[1];
  assert.ok(engine.trimStart().startsWith('// Holographic Formula Drift. ' + NOTICE + '\n'), 'the engine script should open with the notice');
});
