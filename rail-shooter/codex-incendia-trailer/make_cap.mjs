// Build a capture-only copy of Codex Incendia. The harness steps every frame itself:
//  - the game's rAF loop never starts; game time drives the game's own setTimeouts (__gT queue)
//  - seeded Math.random, so every take replays identically
//  - the game instance is exposed on window.__ci; every sfx* call is logged with its capture time
//  - pass=audio swaps AudioContext for an OfflineAudioContext (the audio pass renders the game's own synth)
// Usage: node make_cap.mjs <path/to/game.html> <out.html>
import { readFileSync, writeFileSync } from 'node:fs';

const [src, out] = process.argv.slice(2);
let html = readFileSync(src, 'utf8');
const must = (needle) => { if (!html.includes(needle)) throw new Error('anchor not found: ' + needle); };

const prelude = `<script>
(function () {
  const q = new URLSearchParams(location.search);
  if (q.get('rng')) {                                 // reproducible takes
    let a = (+q.get('rng')) >>> 0;
    Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // game-time timers: the game's setTimeout/clearTimeout calls are rewritten to these
  let tid = 0; const timers = new Map();
  window.__capMs = 0; window.__capT = 0; window.__sfxLog = null;
  window.__gT = (fn, ms) => { timers.set(++tid, [window.__capMs + (ms || 0), fn]); return tid; };
  window.__gCT = (id) => timers.delete(id);
  window.__gTick = () => { for (const [id, [at, fn]] of [...timers]) if (at <= window.__capMs) { timers.delete(id); fn(); } };
  if (q.get('pass') === 'audio') {
    const dur = +q.get('dur') || 10;
    window.AudioContext = function () {
      const c = new OfflineAudioContext(2, Math.ceil(48000 * dur), 48000);
      Object.defineProperty(c, 'state', { get: () => 'running' });
      return c;
    };
  }
})();
</script>`;
must('<head>');
html = html.replace('<head>', '<head>\n' + prelude);

// only the game's own script gets virtual timers (Tailwind's CDN runtime keeps real ones)
const s0 = html.indexOf('class BaroqueAudioEngine');
let game = html.slice(s0);
game = game.replace(/clearTimeout\(/g, '__gCT(').replace(/setTimeout\(/g, '__gT(');
html = html.slice(0, s0) + game;

must('const game = new CodexIncendiaGame();');
html = html.replace('const game = new CodexIncendiaGame();', `const game = window.__ci = new CodexIncendiaGame();
  window.__CI = { FOLIO_THEMES, BaroqueAudioEngine };
  for (const k of Object.getOwnPropertyNames(BaroqueAudioEngine.prototype)) {
    if (!k.startsWith('sfx')) continue;
    const f = BaroqueAudioEngine.prototype[k];
    BaroqueAudioEngine.prototype[k] = function (...a) { if (window.__sfxLog) window.__sfxLog.push([window.__capT, k, a]); return f.apply(this, a); };
  }
  window.__ciReady = true;`);
must('  animateLoop();\n};');
html = html.replace('  animateLoop();\n};', '  /* capture: the harness steps frames */\n};');
writeFileSync(out, html);
console.log('wrote', out, (html.length / 1e3).toFixed(0), 'kB');
