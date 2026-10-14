// Offline audio pass. The capture page's AudioContext is an OfflineAudioContext here, so the game builds its own
// graph (buses, cathedral reverb, compressor) offline. Renders:
//   wav/<clip>.wav   every sfx call from the clip's capture log, at its exact frame time
//   wav/score.wav    the game's own sequencer as one continuous 146 bpm score: the Folio modes switch on 4-bar
//                    lines (I -> II -> III -> Censor -> I), a noise riser into the boss, a final downbeat on D
//   wav/st_<name>.wav  single-sfx stingers
// Usage: node audio.mjs [clips...] [--score] [--stingers]
import { launch } from './cdp.mjs';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';

const DIR = new URL('.', import.meta.url).pathname;
const SCORE = JSON.parse(readFileSync(DIR + 'score.json', 'utf8'));   // bar map shared with edit.py
const args = process.argv.slice(2);
const only = args.filter(a => !a.startsWith('--'));
mkdirSync(DIR + 'wav', { recursive: true });
const b = await launch({ profile: DIR + 'prof-aud', port: 9354 });

const WAV_HELPER = `window.__toWav = buf => {
  const n = buf.length, ch = buf.numberOfChannels, sr = buf.sampleRate, data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); data.setUint32(16, 16, true);
  data.setUint16(20, 1, true); data.setUint16(22, ch, true); data.setUint32(24, sr, true); data.setUint32(28, sr * ch * 2, true);
  data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, n * ch * 2, true);
  const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
  let o = 44, peak = 0; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); peak = Math.max(peak, Math.abs(v)); data.setInt16(o, v * 32767, true); o += 2; }
  let s = ''; const u8 = new Uint8Array(data.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  window.__wav = btoa(s); return { bytes: u8.length, peak: +peak.toFixed(3) };
};`;

async function renderTo(file, dur, scheduleJs) {
  await b.goto(`file://${DIR}ci_cap.html?pass=audio&dur=${dur}&rng=1`, '!!window.__ciReady');
  await b.evaluate(WAV_HELPER);
  const info = await b.evaluate(`(async () => {
    const A = __ci.audio;
    A.init(); A.isPlayingMusic = false;
    const ctx = A.ctx, Q = 128 / ctx.sampleRate, at = new Map();
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
  if (!args.includes('--score') && !args.includes('--stingers') || only.length) {
    for (const f of readdirSync(DIR + 'logs').filter(f => f.endsWith('.json'))) {
      const name = f.replace('.json', '');
      if (only.length && !only.includes(name)) continue;
      const L = JSON.parse(readFileSync(DIR + 'logs/' + f, 'utf8'));
      const dur = L.frames / 60 + 1.5;
      // the auto-fire pew and ricochets play ~10x a second; route them through a quieter send so the score leads
      // and the kills, grazes and bells punch through (each sfx connects to A.sfxGain when it is called)
      const js = `const quiet = { sfxShoot: 0.32, sfxRicochet: 0.45 }, sends = {};
        for (const k in quiet) { sends[k] = A.ctx.createGain(); sends[k].gain.value = quiet[k]; sends[k].connect(A.sfxGain); }
        const play = (k, a) => { if (!sends[k]) return A[k](...a); const g0 = A.sfxGain; A.sfxGain = sends[k]; A[k](...a); A.sfxGain = g0; };
        for (const [t, k, a] of ${JSON.stringify(L.sfx)}) if (t >= 0) when(t, () => play(k, a));`;
      console.log(name, dur.toFixed(1) + 's', L.sfx.length, 'sfx', JSON.stringify(await renderTo(DIR + 'wav/' + name + '.wav', dur, js)));
    }
  }
  if (args.includes('--score')) {
    // one sixteenth = 60/146/4 s; every step is scheduled by the game's own scheduleStep at an exact time
    const js = `
      const S = ${JSON.stringify(SCORE)}, six = 60 / A.tempo / 4, orig = A.scheduleStep.bind(A);
      A.isPlayingMusic = true; A.stepIndex = 0; A.nextNoteTime = S.lead;
      A.scheduleStep = (step, time, dur) => {
        const n = Math.round((time - S.lead) / six), bar = Math.floor(n / 16);
        if (bar >= S.modes.length) {
          if (n === S.modes.length * 16) { A.currentMode = 0; orig(0, time, dur); }   // the final downbeat, on D
          return;
        }
        A.currentMode = S.modes[bar];
        orig(step, time, dur);
      };
      for (let t = 0.01; t < S.lead + S.modes.length * 16 * six + 0.3; t += 0.04) when(t, () => A.updateMusic());
      // riser into the Censor's entrance: the game's noise buffer through a rising band-pass + a rising saw
      const rz = S.lead + S.riserTo * 16 * six, r0 = rz - S.riserLen;
      when(r0 - 0.02, () => {
        const c = A.ctx, src = c.createBufferSource(); src.buffer = A.noiseBuffer; src.loop = true;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.2;
        bp.frequency.setValueAtTime(300, r0); bp.frequency.exponentialRampToValueAtTime(7000, rz);
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, r0); g.gain.exponentialRampToValueAtTime(0.5, rz - 0.01); g.gain.linearRampToValueAtTime(0, rz + 0.02);
        src.connect(bp); bp.connect(g); g.connect(A.sfxGain); src.start(r0); src.stop(rz + 0.05);
        const o = c.createOscillator(), og = c.createGain(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(73.4, r0); o.frequency.exponentialRampToValueAtTime(587.3, rz);
        og.gain.setValueAtTime(0.0001, r0); og.gain.exponentialRampToValueAtTime(0.09, rz - 0.01); og.gain.linearRampToValueAtTime(0, rz + 0.02);
        o.connect(og); og.connect(A.musicGain); o.start(r0); o.stop(rz + 0.05);
      });
      // the last downbeat rings: the Censor's bell and the illumination chord under the final note
      const fz = S.lead + S.modes.length * 16 * six;
      when(fz, () => { A.sfxBossBell(); A.sfxEnemyDestroy(true); });`;
    const dur = SCORE.lead + SCORE.modes.length * 16 * 60 / 146 / 4 + 3.5;
    console.log('score', dur.toFixed(2) + 's', JSON.stringify(await renderTo(DIR + 'wav/score.wav', dur, js)));
  }
  if (args.includes('--stingers')) {
    for (const [name, k, a] of [['graze', 'sfxGraze', []], ['bell', 'sfxBossBell', []], ['big', 'sfxEnemyDestroy', [true]], ['dash', 'sfxDash', []]]) {
      const js = `when(0.05, () => A['${k}'](...${JSON.stringify(a)}));`;
      console.log('st_' + name, JSON.stringify(await renderTo(DIR + `wav/st_${name}.wav`, 2.5, js)));
    }
  }
} finally { b.close(); }
