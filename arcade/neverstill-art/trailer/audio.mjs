// Offline audio pass. Rebuilds the game's own audio graph on an OfflineAudioContext (via the capture page's
// fake AudioContext) and renders:
//   wav/<clip>.wav   every SFX call and the engine/wind bed state from the capture log, at exact frame times
//   wav/mus_<song>.wav  the game's music, ticked from suspend points
// Usage: node audio.mjs [clips...] [--music]
import { launch } from './cdp.mjs';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';

const DIR = new URL('.', import.meta.url).pathname;
const args = process.argv.slice(2);
const music = args.includes('--music');
const only = args.filter(a => !a.startsWith('--'));
mkdirSync(DIR + 'wav', { recursive: true });
const b = await launch({ profile: DIR + 'prof-aud', port: 9344 });

const WAV_HELPER = `window.__toWav = buf => {
  const n = buf.length, ch = buf.numberOfChannels, sr = buf.sampleRate, data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); data.setUint32(16, 16, true);
  data.setUint16(20, 1, true); data.setUint16(22, ch, true); data.setUint32(24, sr, true); data.setUint32(28, sr * ch * 2, true);
  data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, n * ch * 2, true);
  const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
  let o = 44, peak = 0; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); peak = Math.max(peak, Math.abs(v)); data.setInt16(o, v * 32767, true); o += 2; }
  let s = ''; const u8 = new Uint8Array(data.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  window.__wav = btoa(s); return { bytes: u8.length, peak };
};`;

async function renderTo(file, dur, scheduleJs) {
  await b.goto(`file://${DIR}nv_cap.html?pass=audio&dur=${dur}&seed=7&rng=1`, `!!(window.__neverstill && __neverstill.G.menu[0] === 'title')`);
  await b.evaluate(WAV_HELPER);
  const info = await b.evaluate(`(async () => {
    const C = __nvcap, AU = C.AU;
    C.audioUnlock(); C.stopSong();
    const ctx = AU.ctx, Q = 128 / ctx.sampleRate, at = new Map();
    const when = (t, fn) => { const q = Math.max(1, Math.round(t / Q)) * Q; if (!at.has(q)) at.set(q, []); at.get(q).push(fn); };
    ${scheduleJs}
    for (const [q, fns] of at) ctx.suspend(q).then(() => { for (const f of fns) f(); ctx.resume(); });
    const buf = await ctx.startRendering();
    return __toWav(buf);
  })()`);
  const b64 = [];
  const total = await b.evaluate('__wav.length');
  for (let o = 0; o < total; o += 4e6) b64.push(await b.evaluate(`__wav.slice(${o}, ${o + 4e6})`));
  writeFileSync(file, Buffer.from(b64.join(''), 'base64'));
  return info;
}

try {
  const logs = readdirSync(DIR + 'logs').filter(f => f.endsWith('.json') && !f.startsWith('scout')).map(f => f.replace('.json', ''));
  for (const name of logs) {
    if (only.length && !only.includes(name)) continue;
    if ((music || args.includes('--stingers')) && !only.length) break;
    const L = JSON.parse(readFileSync(DIR + 'logs/' + name + '.json', 'utf8'));
    const dur = L.frames / 60 + 2.5;
    const js = `
      const L = ${JSON.stringify({ sfx: L.sfx, beds: L.beds })}, warm = ${0};
      L.beds.forEach((bd, i) => when(i / 60, () => { window.__fakeNow = 100000 + i * 1000 / 60; C.updateBeds(!!bd[0], bd[1], !!bd[2], !!bd[3]); }));
      when(L.beds.length / 60, () => C.updateBeds(false, 0, false, false));
      for (const [t, k, a] of L.sfx) when(t, () => { window.__fakeNow = 100000 + t * 1000; C.SFX[k](...a); });`;
    const info = await renderTo(DIR + 'wav/' + name + '.wav', dur, js);
    console.log(name, dur.toFixed(1) + 's', L.sfx.length, 'sfx', JSON.stringify(info));
  }
  if (args.includes('--stingers')) {
    for (const [name, k, a] of [['boom2', 'boom', [2]], ['bigboom', 'bigboom', []], ['select', 'select', []], ['gate', 'gate', []], ['oneup', 'oneup', []]]) {
      const js = `when(0.05, () => { window.__fakeNow = 200000; C.SFX['${k}'](...${JSON.stringify(a)}); });`;
      const info = await renderTo(DIR + `wav/st_${name}.wav`, 3, js);
      console.log('st_' + name, JSON.stringify(info));
    }
  }
  if (music) {
    for (const [song, dur] of [['main', 56], ['boss', 26], ['clear', 9]]) {
      const js = `
        C.playSong('${song}');
        for (let t = 0.02; t < ${dur}; t += 0.05) when(t, () => C.musTick());`;
      const info = await renderTo(DIR + `wav/mus_${song}.wav`, dur, js);
      console.log('mus_' + song, dur + 's', JSON.stringify(info));
    }
  }
} finally { b.close(); }
