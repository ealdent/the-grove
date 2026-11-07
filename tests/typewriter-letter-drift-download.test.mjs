import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Typewriter Letter Drift's Download button builds a page of its own from the
// demo's own script: the drift and engine sections, verbatim, plus the
// settings on screen. Build one here from the file as it sits and check that
// it stands alone: three scripts that parse, the settings carried over, and an
// engine that defines itself without anything the download leaves behind.
const demoPath = new URL('../shaders/typewriter-letter-drift.html', import.meta.url);
const learnPath = new URL('../learn/index.html', import.meta.url);
const BUILDER = '/* ---------------- download page ----------------';
const SCENE = '/* ---------------- the drift ----------------';
const ENGINE = '/* ---------------- engine ----------------';
const CONTROLS = '/* ---------------- controls ----------------';

const LOOK = {
  glyphs: 64,
  speed: 1.35,
  ink: 1.2,
  glow: 0.8,
  seed: 418.73920193847134,
  time: 41.237,
  width: 388,
  from: 'https://example.test/shaders/typewriter-letter-drift.html'
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

// The body of `const name = \`...\`;` (the shaders hold no backticks of their own).
const shader = (text, name) => {
  const open = text.indexOf('const ' + name + ' = `');
  assert.ok(open >= 0, name + ' not found');
  const start = text.indexOf('`', open) + 1;
  return text.slice(start, text.indexOf('`', start));
};

test('the download is one page, named for the drift, whose scripts all parse', async () => {
  const { file } = await download();
  assert.equal(file.name, 'typewriter-letter-drift.html');
  assert.match(file.html, /^<!doctype html>\n<!--\n/);
  assert.equal((pageOf(file.html).match(/<script/g) || []).length, 3, 'settings, engine and start, nothing else');
  const scripts = scriptsOf(file.html);
  assert.equal(scripts.length, 3);
  for (const script of scripts) assert.doesNotThrow(() => new Function(script));
  assert.ok(file.html.includes('<title>Typewriter Letter Drift · Filing Card</title>'));
  assert.ok(file.html.includes('<meta name="theme-color" content="#f4edda" />'));
  assert.ok(file.html.includes('Set the way you left it: 64 letters drifting at 1.35×, ink 1.20, aura 0.80, around a 388px card.'));
  assert.ok(file.html.includes('From https://example.test/shaders/typewriter-letter-drift.html'));
});

test('it loads the same typewriter faces as the demo, which the engine waits for', async () => {
  const { file } = await download();
  const page = await readFile(demoPath, 'utf8');
  const faces = 'https://fonts.googleapis.com/css2?family=Special+Elite&family=Courier+Prime:wght@400;700&display=swap';
  assert.ok(page.includes("@import url('" + faces + "')"), 'the demo moved its fonts');
  assert.ok(file.html.includes('<link rel="stylesheet" href="' + faces + '" />'));
  const engine = scriptsOf(file.html)[1];
  assert.ok(engine.includes('document.fonts.load(\'80px "Special Elite"\')'));
  assert.ok(engine.includes('setTimeout(resolve, 2600)'));
});

test('it carries the settings that were on screen, and the card width in its CSS', async () => {
  const { file } = await download();
  const settings = new Function(scriptsOf(file.html)[0] + '\nreturn TYPEWRITER_LETTER_DRIFT;')();
  assert.deepEqual(Object.keys(settings), ['glyphs', 'speed', 'ink', 'glow', 'seed', 'time']);
  assert.equal(settings.glyphs, 64);
  assert.equal(settings.speed, 1.35);
  assert.equal(settings.ink, 1.2);
  assert.equal(settings.glow, 0.8);
  assert.equal(settings.time, 41.24);
  // the GPU reads the seed as a 32-bit float; the file writes the shortest
  // decimal that lands on the same one, so the same letters land in the same places
  assert.equal(Math.fround(settings.seed), Math.fround(LOOK.seed));
  assert.ok(String(settings.seed).length < String(LOOK.seed).length);
  assert.ok(file.html.includes('width: 388px; max-width: 100%;'));
});

test("its engine is the demo's own drift and engine code, and needs nothing else", async () => {
  const { script, file } = await download();
  const engine = scriptsOf(file.html)[1];
  const scene = linesBetween(script, SCENE, ENGINE);
  const runner = linesBetween(script, ENGINE, CONTROLS);
  assert.ok(scene.includes('const glyphFragmentSource') && runner.includes('function createLetterDrift('), 'section markers moved');
  assert.ok(engine.includes(scene + runner), 'the download should carry both sections verbatim');
  for (const word of ['getElementById', 'querySelector', '__demo', 'buildDownload', 'SOURCE', 'reducedMotion', 'pinned', 'panel']) {
    assert.ok(!engine.includes(word), `the engine should not carry ${word}`);
  }
  const window = {};
  new Function('window', engine)(window);
  assert.equal(typeof window.TypewriterLetterDrift, 'function');
});

test('the drift shaders are still the Learn border shaders, plus only the ink knob', async () => {
  const script = await demoScript();
  const learn = await readFile(learnPath, 'utf8');
  for (const name of ['auraVertexSource', 'auraFragmentSource', 'glyphVertexSource']) {
    assert.equal(shader(script, name), shader(learn, name), name + ' drifted from learn/index.html');
  }
  const knobless = shader(script, 'glyphFragmentSource')
    .replace('      uniform float uInk;\n', '')
    .replace(' * alive * mask * uInk;', ' * alive * mask;');
  assert.equal(knobless, shader(learn, 'glyphFragmentSource'), 'glyphFragmentSource drifted from learn/index.html');
});

test('a page with no web address leaves From out', async () => {
  const { file } = await download({ ...LOOK, from: '' });
  assert.ok(file.html.includes('around a 388px card.\n'));
  assert.ok(!file.html.includes('  From '));
});

test('the MIT notice heads the file and the engine, so a copied engine keeps it', async () => {
  const { file } = await download();
  const notice = 'Copyright (c) 2026 Jason Adams. Released under the MIT License: https://opensource.org/license/mit';
  const header = file.html.slice(0, file.html.indexOf('-->'));
  assert.ok(header.includes('\n  ' + notice + '\n'), 'the header should carry the notice');
  const engine = scriptsOf(file.html)[1];
  assert.ok(engine.trimStart().startsWith('// Typewriter Letter Drift. ' + notice + '\n'), 'the engine script should open with the notice');
});
