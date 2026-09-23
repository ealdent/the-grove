// Build a capture-only copy of Neverstill: the harness drives every frame, game time replaces wall time,
// internals are exposed on window.__nvcap and every SFX call is logged with its game time.
// Usage: node make_cap.mjs <path/to/neverstill.html> <out.html>
import { readFileSync, writeFileSync } from 'node:fs';

const [src, out] = process.argv.slice(2);
let html = readFileSync(src, 'utf8');

const prelude = `<script>
(function () {
  const q = new URLSearchParams(location.search);
  window.requestAnimationFrame = () => 0;            // the harness steps frames itself
  if (q.get('rng')) {                                 // reproducible takes: seeded Math.random (the game binds rnd = Math.random)
    let a = (+q.get('rng')) >>> 0;
    Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const realNow = performance.now.bind(performance);
  window.__fakeNow = null;                            // game time in ms while capturing
  performance.now = () => (window.__fakeNow != null ? window.__fakeNow : realNow());
  window.__capT = 0; window.__sfxLog = null;
  if (q.get('pass') === 'video') { window.AudioContext = undefined; window.webkitAudioContext = undefined; }
  if (q.get('pass') === 'audio') {
    const dur = +q.get('dur') || 10;
    window.AudioContext = function () {
      const c = new OfflineAudioContext(2, Math.ceil(48000 * dur), 48000);
      Object.defineProperty(c, 'state', { get: () => 'running' });
      return c;
    };
    const si = window.setInterval.bind(window);
    window.setInterval = (fn, ms, ...a) => (fn && fn.name === 'musTick' ? 0 : si(fn, ms, ...a));   // music is ticked from suspend points
  }
})();
</script>`;
html = html.replace('<head>', '<head>\n' + prelude);

const hook = `window.__nvcap = {
  AU, SFX, MUS, SONGS, playSong, stopSong, musTick, audioUnlock, updateBeds, applyVolumes, settings, D,
  spawnRingChain, spawnGroup, banner, keys, keyEdge, IN, setPaused, enterTitle, startGame, setupStage, setPhase,
  logoCanvas, keyArt, explode, cam, makeWyrm, makeHalo, bossDie, spawnBosses, ZONES, groundAt, floorAt, WL, get HW() { return HW; }, get HH() { return HH; }
};
for (const k of Object.keys(SFX)) { const f = SFX[k]; SFX[k] = function (...a) { if (window.__sfxLog) window.__sfxLog.push([window.__capT, k, a]); return f.apply(this, a); }; }
window.__neverstill = {`;
if (!html.includes('window.__neverstill = {')) throw new Error('debug handle not found');
html = html.replace('window.__neverstill = {', hook);
writeFileSync(out, html);
console.log('wrote', out, (html.length / 1e6).toFixed(2), 'MB');
