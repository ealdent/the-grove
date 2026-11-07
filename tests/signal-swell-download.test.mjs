import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Signal Swell's Download button builds a page of its own from the demo's own
// script: the scene and engine sections, verbatim, plus the settings on
// screen. Build one here from the file as it sits and check that it stands
// alone: three scripts that parse, the settings carried over, and an engine
// that defines itself without anything the download leaves behind.
const demoPath = new URL('../shaders/signal-swell-shader-demo.html', import.meta.url);
const BUILDER = '/* ---------------- download page ----------------';

const LOOK = {
  name: 'Cobalt Blue',
  slug: 'cobalt-blue',
  theme: 'dark',
  paper: '#070b17',
  ink: '#3d7dff',
  strength: [0.9, 1.0, 0.95],
  focus: 5.2345,
  aperture: 1.8,
  swell: 1.35,
  time: 41.237,
  from: 'https://example.test/shaders/signal-swell-shader-demo.html'
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

test('the download is one page, named for its ink and theme, whose scripts all parse', async () => {
  const { file } = await download();
  assert.equal(file.name, 'signal-swell-cobalt-blue-dark.html');
  assert.match(file.html, /^<!doctype html>\n<!--\n/);
  assert.equal((pageOf(file.html).match(/<script/g) || []).length, 3, 'settings, engine and start, nothing else');
  const scripts = scriptsOf(file.html);
  assert.equal(scripts.length, 3);
  for (const script of scripts) assert.doesNotThrow(() => new Function(script));
  assert.ok(file.html.includes('<title>Signal Swell · Cobalt Blue</title>'));
  assert.ok(file.html.includes('background: #070b17;'));
  assert.ok(file.html.includes('Set the way you left it: Cobalt Blue on the dark paper.'));
  assert.ok(file.html.includes('From https://example.test/shaders/signal-swell-shader-demo.html'));
});

test('it carries the settings that were on screen', async () => {
  const { file } = await download();
  const settings = new Function(scriptsOf(file.html)[0] + '\nreturn SIGNAL_SWELL;')();
  assert.deepEqual(settings, {
    paper: '#070b17',
    ink: '#3d7dff',
    strength: [0.9, 1, 0.95],
    focus: 5.23,
    aperture: 1.8,
    swell: 1.35,
    speed: 1,
    interactive: true,
    time: 41.24
  });
});

test("its engine is the demo's own scene and engine code, and needs nothing else", async () => {
  const { script, file } = await download();
  const engine = scriptsOf(file.html)[1];
  const scene = linesBetween(script, '/* ---------------- the swell ----------------', '/* ---------------- palettes ----------------');
  const runner = linesBetween(script, '/* ---------------- engine ----------------', '/* ---------------- palette and theme ----------------');
  assert.ok(scene.includes('void main()') && runner.includes('function createSwell('), 'section markers moved');
  assert.ok(engine.includes(scene + runner), 'the download should carry both sections verbatim');
  for (const word of ['PALETTES', 'localStorage', 'getElementById', '__demo', 'buildDownload']) {
    assert.ok(!engine.includes(word), `the engine should not carry ${word}`);
  }
  const window = {};
  new Function('window', engine)(window);
  assert.equal(typeof window.SignalSwell, 'function');
});

test('a custom ink is named for itself, and a page with no web address leaves From out', async () => {
  const { file } = await download({ ...LOOK, name: 'Custom #2fb5c8', slug: 'custom-2fb5c8', theme: 'light', from: '' });
  assert.equal(file.name, 'signal-swell-custom-2fb5c8-light.html');
  assert.ok(file.html.includes('Set the way you left it: Custom #2fb5c8 on the light paper.\n'));
  assert.ok(!file.html.includes('  From '));
});
