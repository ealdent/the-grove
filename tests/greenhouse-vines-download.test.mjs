import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Greenhouse Vines' Download button builds a page of its own from the demo's
// own script: the scene and engine sections, verbatim, plus the settings on
// screen and a panel for the vines to frame. Build one here from the file as
// it sits and check that it stands alone: three scripts that parse, the
// settings carried over, and an engine that defines itself without anything
// the download leaves behind.
const demoPath = new URL('../shaders/greenhouse-vines-shader-demo.html', import.meta.url);
const appPath = new URL('../greenhouse-todo/ui-vines.js', import.meta.url);
const BUILDER = '/* ---------------- download page ----------------';
const SCENE = '/* ---------------- the vines ----------------';
const ENGINE = '/* ---------------- engine ----------------';
const CONTROLS = '/* ---------------- controls ----------------';

const LOOK = {
  growth: 0.8567,
  speed: 0.55,
  strands: 3,
  glow: 1.65,
  seed: 47.38,
  radius: 18,
  time: 41.237,
  width: 380,
  from: 'https://example.test/shaders/greenhouse-vines-shader-demo.html'
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

test('the download is one page, greenhouse-vines.html, whose scripts all parse', async () => {
  const { file } = await download();
  assert.equal(file.name, 'greenhouse-vines.html');
  assert.match(file.html, /^<!doctype html>\n<!--\n/);
  assert.equal((pageOf(file.html).match(/<script/g) || []).length, 3, 'settings, engine and start, nothing else');
  const scripts = scriptsOf(file.html);
  assert.equal(scripts.length, 3);
  for (const script of scripts) assert.doesNotThrow(() => new Function(script));
  assert.ok(file.html.includes('<title>Greenhouse Vines · Three Strands, Seed 47.38</title>'));
  assert.ok(file.html.includes('<section id="panel">'), 'a panel for the vines to frame');
  assert.ok(file.html.includes('width: 380px;'), 'the panel as wide as the one on screen');
  assert.ok(file.html.includes('Set the way you left it: three strands from seed 47.38 around a 380px panel, held 86% grown.\n'));
  assert.ok(file.html.includes('From https://example.test/shaders/greenhouse-vines-shader-demo.html'));
  assert.ok(scripts[2].includes('GreenhouseVines(document.getElementById("panel"), GREENHOUSE_VINES)'));
});

test('it carries the settings that were on screen', async () => {
  const { file } = await download();
  const settings = new Function(scriptsOf(file.html)[0] + '\nreturn GREENHOUSE_VINES;')();
  assert.deepEqual(settings, {
    growth: 0.86,
    speed: 0.55,
    strands: 3,
    glow: 1.65,
    seed: 47.38,
    radius: 18,
    time: 41.24
  });
});

test('a border left to grow in carries growth: null, and a page with no web address leaves From out', async () => {
  const { file } = await download({ ...LOOK, growth: null, strands: 1, seed: 0, from: '' });
  const settings = new Function(scriptsOf(file.html)[0] + '\nreturn GREENHOUSE_VINES;')();
  assert.equal(settings.growth, null);
  assert.equal(settings.seed, 0);
  assert.ok(file.html.includes('Set the way you left it: one strand from seed 0 around a 380px panel.\n'));
  assert.ok(file.html.includes('<title>Greenhouse Vines · One Strand, Seed 0</title>'));
  assert.ok(!file.html.includes('  From '));
});

test('a seed travels whole, since every hash moves with it', async () => {
  const { file } = await download({ ...LOOK, seed: 12.345678901234 });
  const settings = new Function(scriptsOf(file.html)[0] + '\nreturn GREENHOUSE_VINES;')();
  assert.equal(settings.seed, 12.345678901234);
});

test("its engine is the demo's own scene and engine code, and needs nothing else", async () => {
  const { script, file } = await download();
  const engine = scriptsOf(file.html)[1];
  const scene = linesBetween(script, SCENE, ENGINE);
  const runner = linesBetween(script, ENGINE, CONTROLS);
  assert.ok(scene.includes('const fragmentSource') && runner.includes('function createVines('), 'section markers moved');
  assert.ok(engine.includes(scene + runner), 'the download should carry both sections verbatim');
  for (const word of ['getElementById', 'querySelector', '__demo', 'buildDownload', 'growthInput', 'panelW', 'SOURCE', 'pinTime']) {
    assert.ok(!engine.includes(word), `the engine should not carry ${word}`);
  }
  const window = {};
  new Function('window', engine)(window);
  assert.equal(typeof window.GreenhouseVines, 'function');
});

test('without WebGL the engine returns null and leaves the element as it was', async () => {
  const { file } = await download();
  const window = {};
  const canvas = { style: {}, setAttribute() {}, getContext: () => null };
  const document = { createElement: () => canvas };
  const matchMedia = () => ({ matches: false });
  new Function('window', 'document', 'matchMedia', scriptsOf(file.html)[1])(window, document, matchMedia);
  const target = { style: {}, prepend() { throw new Error('the canvas should not be added'); } };
  assert.equal(window.GreenhouseVines(target, {}), null);
  assert.deepEqual(target.style, {});
});

test('the MIT notice heads the file and the engine, so a copied engine keeps it', async () => {
  const { file } = await download();
  const notice = 'Copyright (c) 2026 Jason Adams. Released under the MIT License: https://opensource.org/license/mit';
  const header = file.html.slice(0, file.html.indexOf('-->'));
  assert.ok(header.includes('\n  ' + notice + '\n'), 'the header should carry the notice');
  const engine = scriptsOf(file.html)[1];
  assert.ok(engine.trimStart().startsWith('// Greenhouse Vines. ' + notice + '\n'), 'the engine script should open with the notice');
});

// The demo's claim is "this is the to-do dialog's shader". Copying it forked
// it once already; hold the two together, comments and whitespace aside, with
// the three demo knobs taken out of the demo's copy.
test("the fragment shader is the to-do dialog's own, apart from the three demo knobs", async () => {
  const script = await demoScript();
  const app = await readFile(appPath, 'utf8');
  const literal = (text, opener) => {
    const start = text.indexOf(opener) + opener.length;
    assert.ok(start >= opener.length, `${opener} not found`);
    return text.slice(start, text.indexOf('`', start));
  };
  const plain = glsl => glsl.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').trim();
  const demo = plain(literal(script, 'const fragmentSource = `'));
  const knobs = [
    ' uniform float uSeed;', ' uniform float uStrands;', ' uniform float uGlow;',
    ' if (fi >= uStrands) break;', ' + uSeed', ' * uGlow'
  ];
  for (const knob of knobs) assert.ok(demo.includes(knob), `the demo shader should still have ${knob.trim()}`);
  const stripped = knobs.reduce((glsl, knob) => glsl.split(knob).join(''), demo);
  assert.equal(stripped, plain(literal(app, 'const FRAG = `')));
});
