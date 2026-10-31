// Records the console of learn/conway-turing-machine.html as a 1920x1080, 60 fps film,
// stepping the page's own renderer one frame at a time (so the speed is exact, not screen-recorded).
//
//   python3 -m http.server 8002 -d <repo root>      # in another terminal
//   node learn/conway-turing-machine/film/capture.mjs [out.mp4] [http://localhost:8002]
//
// Needs Google Chrome and ffmpeg. In ?capture mode the page exposes window.__ltm for this script.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OUT = process.argv[2] || 'glider-run.mp4';
const BASE = process.argv[3] || 'http://localhost:8002';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FPS = 60, PORT = 9444, END_GENERATION = 44; // by generation 44 the glider has been a block for a while

// 4 steps a second for a moment, then an exponential climb to 60,000 over six seconds.
const speedAt = t => (t < 1.5 ? 4 : t < 7.5 ? 4 * 15000 ** ((t - 1.5) / 6) : 60000);
const readout = s => (s < 100 ? Math.round(s) : s < 1000 ? Math.round(s / 10) * 10 : s < 10000 ? Math.round(s / 100) * 100 : Math.round(s / 1000) * 1000);

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ltm-film-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
let wsUrl;
for (let i = 0; i < 100 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch {}
  if (!wsUrl) await new Promise(r => setTimeout(r, 100));
}
if (!wsUrl) { chrome.kill('SIGKILL'); throw new Error('Chrome did not start'); }
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0;
const pending = new Map(), waiters = [];
ws.onmessage = ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
  } else if (msg.method) waiters.forEach(w => w(msg));
};
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

const ffmpeg = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
  '-movflags', '+faststart', '-t', '80', '-fs', '1500M', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });

try {
  await send('Page.enable');
  // 1440 x 810 CSS pixels at 4/3 device pixels each: a 1920 x 1080 frame with text readable on a phone.
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 810, deviceScaleFactor: 4 / 3, mobile: false });
  const loaded = new Promise(r => waiters.push(m => m.method === 'Page.loadEventFired' && r()));
  await send('Page.navigate', { url: `${BASE}/learn/conway-turing-machine.html?capture` });
  await loaded;
  await evaluate('document.fonts.ready.then(() => true)');
  await new Promise(r => setTimeout(r, 900));
  await evaluate("__ltm.configure({ n: 14, pattern: 'glider', speed: 4 })");
  let acc = 0, frame = 0, end = Infinity;
  while (frame < end && frame < FPS * 80) {
    const t = frame / FPS, speed = speedAt(t);
    acc += speed / FPS;
    const steps = Math.floor(acc);
    acc -= steps;
    const state = await evaluate(`__ltm.frame(${steps}, ${1 / FPS}, ${readout(speed)})`);
    if (state.generation >= END_GENERATION && end === Infinity) end = frame + 3 * FPS;
    const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 95 });
    if (!ffmpeg.stdin.write(Buffer.from(shot.data, 'base64'))) await new Promise(r => ffmpeg.stdin.once('drain', r));
    if (++frame % 300 === 0) console.log(`frame ${frame}, generation ${state.generation}, ${state.steps.toLocaleString()} steps`);
  }
  console.log(`${frame} frames written to ${OUT}`);
} finally {
  ffmpeg.stdin.end();
  await new Promise(r => ffmpeg.on('close', r));
  ws.close();
  chrome.kill('SIGKILL');
  fs.rmSync(profile, { recursive: true, force: true });
}
