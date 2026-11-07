import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Stillroom Shaft's Download button builds a page of its own from the demo's
// own script: the room and engine sections, verbatim, plus the settings on
// screen. Build one here from the file as it sits and check that it stands
// alone: three scripts that parse, the settings carried over, and an engine
// that defines itself without anything the download leaves behind.
const demoPath = new URL('../shaders/stillroom-shaft-shader-demo.html', import.meta.url);
const BUILDER = '/* ---------------- download page ----------------';
const ROOM = '/* ---------------- the room ----------------';
const ENGINE = '/* ---------------- engine ----------------';
const RENDERER = '/* ---------------- renderer ----------------';

const LOOK = {
  shaft: 1.4,
  dust: 0.6,
  speed: 1,
  interactive: true,
  time: 23.7468,
  from: 'https://example.test/shaders/stillroom-shaft-shader-demo.html'
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

test('the download is one page, stillroom-shaft.html, whose scripts all parse', async () => {
  const { file } = await download();
  assert.equal(file.name, 'stillroom-shaft.html');
  assert.match(file.html, /^<!doctype html>\n<!--\n/);
  assert.equal((pageOf(file.html).match(/<script/g) || []).length, 3, 'settings, engine and start, nothing else');
  const scripts = scriptsOf(file.html);
  assert.equal(scripts.length, 3);
  for (const script of scripts) assert.doesNotThrow(() => new Function(script));
  assert.ok(file.html.includes('<title>Stillroom Shaft · Sunlight and Dust</title>'));
  assert.ok(file.html.includes('<meta name="theme-color" content="#050403" />'));
  assert.ok(file.html.includes('background: #050403;'));
  assert.ok(file.html.includes('<canvas id="room"'));
  assert.ok(file.html.includes('Set the way you left it: shaft 1.40, dust 0.60, 23.75 seconds in.'));
  assert.ok(file.html.includes('From https://example.test/shaders/stillroom-shaft-shader-demo.html'));
});

test('it carries the settings that were on screen', async () => {
  const { file } = await download();
  const settings = new Function(scriptsOf(file.html)[0] + '\nreturn STILLROOM_SHAFT;')();
  assert.deepEqual(settings, { shaft: 1.4, dust: 0.6, speed: 1, interactive: true, time: 23.75 });

  // every key gets one comment, and the comments line up
  const rows = scriptsOf(file.html)[0].split('\n').filter(line => line.includes('// ') && line.includes(':'));
  assert.equal(rows.length, 5);
  assert.equal(new Set(rows.map(line => line.indexOf('//'))).size, 1, 'comments should be aligned');

  // and it carries whatever was set, not the defaults
  const other = await download({ ...LOOK, shaft: 0.25, dust: 0, speed: 0.5, interactive: false, time: 8 });
  assert.deepEqual(new Function(scriptsOf(other.file.html)[0] + '\nreturn STILLROOM_SHAFT;')(),
    { shaft: 0.25, dust: 0, speed: 0.5, interactive: false, time: 8 });
  assert.ok(other.file.html.includes('Set the way you left it: shaft 0.25, dust 0.00, 8 seconds in.'));
});

test("its engine is the demo's own room and engine code, and needs nothing else", async () => {
  const { script, file } = await download();
  const engine = scriptsOf(file.html)[1];
  const room = linesBetween(script, ROOM, ENGINE);
  const runner = linesBetween(script, ENGINE, RENDERER);
  assert.ok(room.includes('void main()') && runner.includes('function createStillroom('), 'section markers moved');
  assert.ok(engine.includes(room + runner), 'the download should carry both sections verbatim');
  for (const word of ['getElementById', '__demo', 'buildDownload', 'SOURCE', 'pinTime', 'reducedMotion', 'shaftInput', 'fallback']) {
    assert.ok(!engine.includes(word), `the engine should not carry ${word}`);
  }
  const window = {};
  new Function('window', engine)(window);
  assert.equal(typeof window.StillroomShaft, 'function');
});

test('without WebGL the engine returns null and leaves the canvas alone', async () => {
  const { file } = await download();
  const window = {};
  class HTMLCanvasElement {
    getContext() { return null; }
  }
  const matchMedia = () => ({ matches: false });
  new Function('window', 'HTMLCanvasElement', 'matchMedia', scriptsOf(file.html)[1])(window, HTMLCanvasElement, matchMedia);
  const canvas = new HTMLCanvasElement();
  assert.equal(window.StillroomShaft(canvas, {}), null);
  assert.deepEqual(Object.keys(canvas), []);
});

test('a page with no web address leaves From out', async () => {
  const { file } = await download({ ...LOOK, from: '' });
  assert.ok(file.html.includes('Set the way you left it: shaft 1.40, dust 0.60, 23.75 seconds in.\n'));
  assert.ok(!file.html.includes('  From '));
});

test('the MIT notice heads the file and the engine, so a copied engine keeps it', async () => {
  const { file } = await download();
  const notice = 'Copyright (c) 2026 Jason Adams. Released under the MIT License: https://opensource.org/license/mit';
  const header = file.html.slice(0, file.html.indexOf('-->'));
  assert.ok(header.includes('\n  ' + notice + '\n'), 'the header should carry the notice');
  const engine = scriptsOf(file.html)[1];
  assert.ok(engine.trimStart().startsWith('// Stillroom Shaft. ' + notice + '\n'), 'the engine script should open with the notice');
});
