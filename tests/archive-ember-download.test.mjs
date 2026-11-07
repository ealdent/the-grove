import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Archive Ember's Download button builds a page of its own from the demo's own
// script: the burn, shader and engine sections, verbatim, plus the settings on
// screen and how far the burn had got. Build one here from the file as it sits
// and check that it stands alone: three scripts that parse, the settings
// carried over, and an engine that defines itself without anything the
// download leaves behind.
const demoPath = new URL('../shaders/archive-ember-shader-demo.html', import.meta.url);
const BUILDER = '/* ---------------- download page ----------------';

const LOOK = {
  speed: 1.6,
  heat: 1.45,
  interactive: true,
  time: 48.237,
  progress: 0.2182345,
  burned: (0.2182345 - 0.006) / (0.435 - 0.006),
  from: 'https://example.test/shaders/archive-ember-shader-demo.html'
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

test('the download is one page, named archive-ember.html, whose scripts all parse', async () => {
  const { file } = await download();
  assert.equal(file.name, 'archive-ember.html');
  assert.match(file.html, /^<!doctype html>\n<!--\n/);
  assert.equal((pageOf(file.html).match(/<script/g) || []).length, 3, 'settings, engine and start, nothing else');
  const scripts = scriptsOf(file.html);
  assert.equal(scripts.length, 3);
  for (const script of scripts) assert.doesNotThrow(() => new Function(script));
  assert.ok(file.html.includes('<title>Archive Ember · Antique Paper Burn</title>'));
  assert.ok(file.html.includes('<meta name="theme-color" content="#0d0907" />'));
  assert.ok(file.html.includes('background: #0d0907;'));
  assert.ok(file.html.includes('Set the way you left it: 49% burned, burn speed 1.6×, ember heat 1.45.\n'));
  assert.ok(file.html.includes('From https://example.test/shaders/archive-ember-shader-demo.html'));
});

test('it carries the settings that were on screen and the burn where it was left', async () => {
  const { file } = await download();
  const settings = new Function(scriptsOf(file.html)[0] + '\nreturn ARCHIVE_EMBER;')();
  assert.deepEqual(settings, {
    speed: 1.6,
    heat: 1.45,
    interactive: true,
    time: 48.24,
    progress: 0.21823
  });
  // one aligned comment per key
  const rows = scriptsOf(file.html)[0].split('\n').filter(line => /^ {4}\w+: /.test(line));
  assert.equal(rows.length, 5);
  assert.equal(new Set(rows.map(row => row.indexOf('// '))).size, 1, 'the comments line up');
});

test("its engine is the demo's own burn, shader and engine code, and needs nothing else", async () => {
  const { script, file } = await download();
  const engine = scriptsOf(file.html)[1];
  const code = linesBetween(script, '/* ---------------- the burn ----------------', '/* ---------------- renderer ----------------');
  assert.ok(code.includes('const BURN = {') && code.includes('void main()') && code.includes('function createEmber('),
    'section markers moved');
  assert.ok(engine.includes(code), 'the download should carry the sections verbatim');
  for (const word of ['getElementById', 'localStorage', '__demo', 'buildDownload', 'SOURCE', 'speedInput', 'pauseButton']) {
    assert.ok(!engine.includes(word), `the engine should not carry ${word}`);
  }
  const window = {};
  new Function('window', engine)(window);
  assert.equal(typeof window.ArchiveEmber, 'function');
});

test('a page with no web address leaves From out, and the percentage stays in range', async () => {
  const { file } = await download({ ...LOOK, progress: 0.435, burned: 1.0000001, from: '' });
  assert.ok(file.html.includes('Set the way you left it: 100% burned, burn speed 1.6×, ember heat 1.45.\n'));
  assert.ok(!file.html.includes('  From '));
  const fresh = await download({ ...LOOK, progress: 0.006, burned: 0, time: 0 });
  assert.ok(fresh.file.html.includes('Set the way you left it: 0% burned,'));
});

test('the MIT notice heads the file and the engine, so a copied engine keeps it', async () => {
  const { file } = await download();
  const notice = 'Copyright (c) 2026 Jason Adams. Released under the MIT License: https://opensource.org/license/mit';
  const header = file.html.slice(0, file.html.indexOf('-->'));
  assert.ok(header.includes('\n  ' + notice + '\n'), 'the header should carry the notice');
  const engine = scriptsOf(file.html)[1];
  assert.ok(engine.trimStart().startsWith('// Archive Ember. ' + notice + '\n'), 'the engine script should open with the notice');
});
