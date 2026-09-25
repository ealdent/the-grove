// Render the P(DOOM) C90 video with headless Chrome and pipe the frames straight into ffmpeg.
//   node render.mjs --song <song.mp4>                    the whole video -> out/p-doom-c90.mp4
//   node render.mjs --song <song.mp4> --from 20 --to 34  a segment (seconds) -> out/segment.mp4
//   node render.mjs --song <song.mp4> --cut x            a 139.9 s cut for X's 2:20 limit -> out/p-doom-c90-x.mp4
//   node render.mjs --stills 1.3,22.5,90                  PNG stills into stills/
// Needs analysis/features.js and analysis/ridges.js (analyze.py, ridges.py). Chrome runs outside the command sandbox.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from '../../utils/degauss/video/cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : args[i + 1]; };
const decode = url => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');

const chrome = await launch({ port: 9361, profile: path.join(HERE, 'prof'), width: 1920, height: 1080 });
try {
  const cutX = opt('cut') === 'x';
  await chrome.goto(pathToFileURL(path.join(HERE, 'video.html')).href + (cutX ? '?cut=x' : ''), 'window.__ready === true || !!window.__error', 60000);
  const error = await chrome.evaluate('window.__error || null');
  if (error) throw new Error('video.html: ' + error);
  const FPS = await chrome.evaluate('__fps'), FRAMES = await chrome.evaluate('__frames');

  const stills = opt('stills');
  if (stills) {
    mkdirSync(path.join(HERE, 'stills'), { recursive: true });
    for (const t of stills.split(',').map(Number)) {
      const file = path.join(HERE, 'stills', `t_${t.toFixed(2)}.png`);
      // A PNG data URL can pass 4 MB, which stalls a single DevTools message; pull it in 1 MB slices.
      const len = await chrome.evaluate(`(window.__png = __render(${Math.round(t * FPS)}, 'image/png')).length`);
      let url = '';
      for (let k = 0; k < len; k += 1 << 20) url += await chrome.evaluate(`__png.slice(${k}, ${k + (1 << 20)})`);
      writeFileSync(file, decode(url));
      console.log('wrote', path.relative(HERE, file));
    }
  } else {
    const song = opt('song');
    if (!song) throw new Error('--song <file> is required for a video render');
    const whole = opt('from') === undefined && opt('to') === undefined;
    const from = Math.round(Number(opt('from', 0)) * FPS), to = Math.min(FRAMES, Math.round(Number(opt('to', FRAMES / FPS)) * FPS));
    const n = to - from, secs = n / FPS;
    mkdirSync(path.join(HERE, 'out'), { recursive: true });
    const mp4 = path.join(HERE, 'out', whole ? (cutX ? 'p-doom-c90-x.mp4' : 'p-doom-c90.mp4') : 'segment.mp4');
    // The full cut keeps the song's own AAC stream; anything shorter is re-encoded, and the X cut fades out.
    const copyAudio = whole && !cutX;
    // JPEG frames are full-range BT.601; convert to limited-range BT.709 and tag it so players keep the amber.
    const ff = spawn('ffmpeg', ['-hide_banner', '-nostdin', '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
      '-ss', (from / FPS).toFixed(4), '-t', secs.toFixed(4), '-i', song,
      '-map', '0:v', '-map', '1:a',
      '-vf', 'scale=in_color_matrix=bt601:out_color_matrix=bt709:in_range=full:out_range=tv,format=yuv420p',
      '-c:v', 'libx264', '-preset', opt('preset', whole ? 'slow' : 'veryfast'), '-crf', opt('crf', '18'), '-profile:v', 'high',
      '-g', String(FPS), '-bf', '2', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      ...(copyAudio ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '256k', '-ar', '48000', ...(cutX ? ['-af', `afade=t=out:st=${(secs - 0.7).toFixed(3)}:d=0.7`] : [])]),
      '-t', secs.toFixed(4), '-frames:v', String(n), '-fs', '900M', '-movflags', '+faststart', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', code => code ? rej(new Error('ffmpeg exited ' + code)) : res()));
    const t0 = Date.now();
    for (let i = from; i < to; i++) {
      const buf = decode(await chrome.evaluate(`__render(${i})`));
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((i - from) % 300 === 299) {
        const ms = (Date.now() - t0) / (i + 1 - from);
        console.log(`frame ${i + 1 - from}/${n}  ${ms.toFixed(1)} ms/frame  eta ${((to - i - 1) * ms / 60000).toFixed(1)} min`);
      }
    }
    ff.stdin.end();
    await done;
    console.log(`wrote ${path.relative(HERE, mp4)} (${n} frames, ${secs.toFixed(2)} s, ${(statSync(mp4).size / 1e6).toFixed(1)} MB) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
} finally {
  chrome.close();
}
