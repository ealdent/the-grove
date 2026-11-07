import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Blood Splat Submit's Download button builds a page of its own from the
// demo's own script: the splat and engine sections, verbatim, plus the
// settings on screen. Build one here from the file as it sits and check that
// it stands alone: three scripts that parse, the settings carried over, and
// an engine that defines itself without anything the download leaves behind.
const demoPath = new URL('../shaders/blood-splat-submit-shader-demo.html', import.meta.url);
const BUILDER = '/* ---------------- download page ----------------';
const NOTICE = 'Copyright (c) 2026 Jason Adams. Released under the MIT License: https://opensource.org/license/mit';

const LOOK = {
  theme: 'light',
  amount: 1.4,
  velocity: 1.8567,
  spread: 1.2,
  mist: 1.5,
  drips: 1.1,
  drying: 1.3,
  flake: 0.7,
  autoReenable: true,
  delay: 9,
  from: 'https://example.test/shaders/blood-splat-submit-shader-demo.html'
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
const headerOf = html => html.slice(0, html.indexOf('-->'));
const flat = text => text.replace(/\s+/g, ' ');

// Whole lines, from the one holding `from` up to the one holding `to`.
const linesBetween = (text, from, to) => {
  const start = text.indexOf(from);
  return text.slice(text.lastIndexOf('\n', start) + 1, text.lastIndexOf('\n', text.indexOf(to, start)) + 1);
};

test('the download is one page, named for its theme, whose scripts all parse', async () => {
  const { file } = await download();
  assert.equal(file.name, 'blood-splat-submit-light.html');
  assert.match(file.html, /^<!doctype html>\n<!--\n/);
  assert.equal((pageOf(file.html).match(/<script/g) || []).length, 3, 'settings, engine and start, nothing else');
  const scripts = scriptsOf(file.html);
  assert.equal(scripts.length, 3);
  for (const script of scripts) assert.doesNotThrow(() => new Function(script));
  assert.ok(file.html.includes('<title>Blood Splat Submit · Light</title>'));
  assert.ok(file.html.includes('<meta name="theme-color" content="#e8eaee" />'));
  assert.ok(file.html.includes('background: linear-gradient(180deg, #e8eaee, #f2f3f5);'));
  assert.ok(file.html.includes('<button id="submit" type="submit">Submit</button>'), 'a real submit button');
  assert.match(pageOf(file.html), /<form id="form">[\s\S]*<\/form>/);
  const header = flat(headerOf(file.html));
  assert.ok(header.includes('Set the way you left it: the light theme, amount 1.4, velocity 1.86, spread 1.2, ' +
    'mist 1.5, drips 1.1, drying 1.3 and flaking 0.7; the button comes back on its own 9 s after the hit.'));
  assert.ok(file.html.includes('\n  From https://example.test/shaders/blood-splat-submit-shader-demo.html\n'));
  // the settings sentence wraps like the prose around it
  const left = headerOf(file.html).split('\n  Set the way you left it:')[1].split('\n  From ')[0];
  for (const line of left.split('\n')) assert.ok(line.length <= 76, 'header line too long: ' + line);
});

test('it carries the settings that were on screen', async () => {
  const { file } = await download();
  const settings = new Function(scriptsOf(file.html)[0] + '\nreturn BLOOD_SPLAT_SUBMIT;')();
  assert.deepEqual(settings, {
    theme: 'light',
    amount: 1.4,
    velocity: 1.86,
    spread: 1.2,
    mist: 1.5,
    drips: 1.1,
    drying: 1.3,
    flake: 0.7,
    autoReenable: true,
    delay: 9
  });
});

test("its engine is the demo's own splat and engine code, and needs nothing else", async () => {
  const { script, file } = await download();
  const engine = scriptsOf(file.html)[1];
  const scene = linesBetween(script, '/* ---------------- the splat ----------------', '/* ---------------- engine ----------------');
  const runner = linesBetween(script, '/* ---------------- engine ----------------', '/* ---------------- theme ----------------');
  assert.ok(scene.includes('gl_FragColor = outc;') && runner.includes('function createSplat('), 'section markers moved');
  assert.ok(engine.includes(scene + runner), 'the download should carry both sections verbatim');
  for (const word of ['getElementById', '__demo', 'buildDownload', 'PAGE_THEMES', 'SOURCE', 'showPhase', 'demoForm', 'localStorage']) {
    assert.ok(!engine.includes(word), `the engine should not carry ${word}`);
  }
  const window = {};
  new Function('window', engine)(window);
  assert.equal(typeof window.BloodSplatSubmit, 'function');
});

test('without WebGL it returns null and leaves the button as it was', async () => {
  const { file } = await download();
  const engine = scriptsOf(file.html)[1];
  const button = { style: {}, disabled: false, prepend() { throw new Error('touched'); }, append() { throw new Error('touched'); } };
  const document = {
    createElement: () => ({ style: {}, setAttribute() {}, getContext: () => null }),
    body: { append() { throw new Error('touched'); } }
  };
  const window = {};
  new Function('window', 'document', 'matchMedia', engine)(window, document, () => ({ matches: false }));
  assert.equal(window.BloodSplatSubmit(button, {}), null);
  assert.deepEqual(button.style, {});
  assert.equal(button.disabled, false);
});

test('the dark theme gets the dark card, and a page with no web address leaves From out', async () => {
  const { file } = await download({ ...LOOK, theme: 'dark', autoReenable: false, flake: 0, from: '' });
  assert.equal(file.name, 'blood-splat-submit-dark.html');
  assert.ok(file.html.includes('<title>Blood Splat Submit · Dark</title>'));
  assert.ok(file.html.includes('<meta name="theme-color" content="#131722" />'));
  assert.ok(file.html.includes('background: linear-gradient(180deg, #131722, #0e1013);'));
  assert.ok(flat(headerOf(file.html)).includes('drying 1.3 and flaking 0; the button stays down until you bring it back.'));
  assert.ok(!file.html.includes('  From '));
  // with no comeback of its own, the page offers one while the button is down
  assert.ok(pageOf(file.html).includes('<button id="again" class="again" type="button" hidden>Bring the button back</button>'));
  const start = scriptsOf(file.html)[2];
  assert.match(start, /again\.addEventListener\("click", \(\) => splat\.reenable\(\)\)/);
  assert.match(start, /onPhase: phase => \{ again\.hidden = BLOOD_SPLAT_SUBMIT\.autoReenable \|\| !\["dried", "flaking", "disabled"\]\.includes\(phase\); \}/);
  const settings = new Function(scriptsOf(file.html)[0] + '\nreturn BLOOD_SPLAT_SUBMIT;')();
  assert.equal(settings.theme, 'dark');
  assert.equal(settings.autoReenable, false);
});

test("the download's card colours are the demo's own", async () => {
  const page = await readFile(demoPath, 'utf8');
  const { file } = await download({ ...LOOK, theme: 'dark' });
  const block = theme => page.slice(page.indexOf(`:root[data-theme="${theme}"] {`), page.indexOf('}', page.indexOf(`:root[data-theme="${theme}"] {`)));
  for (const theme of ['dark', 'light']) {
    const css = block(theme);
    const html = (await download({ ...LOOK, theme })).file.html;
    for (const name of ['bg2', 'bg', 'card', 'line', 'text', 'muted', 'shadow', 'input-bg', 'input-line', 'btn-dis-bg', 'btn-dis-fg']) {
      const value = css.match(new RegExp(`--${name}: ([^;]+);`))[1];
      assert.ok(html.includes(value), `${theme} --${name} (${value}) is missing from the download`);
    }
  }
  assert.ok(file.html.includes('color-scheme: dark;'));
});

test('the MIT notice heads the file and the engine, so a copied engine keeps it', async () => {
  const { file } = await download();
  assert.ok(headerOf(file.html).includes('\n  ' + NOTICE + '\n'), 'the header should carry the notice');
  const engine = scriptsOf(file.html)[1];
  assert.ok(engine.trimStart().startsWith('// Blood Splat Submit. ' + NOTICE + '\n'), 'the engine script should open with the notice');
});
