// Render the hand-drawn Save Me a Seat with headless Chrome, piping JPEG frames straight into ffmpeg.
//   node render.mjs                         the whole song -> out/handdrawn.mp4
//   node render.mjs --from 0 --to 30.3      a segment (seconds) -> out/segment.mp4 (or --out NAME)
//   node render.mjs --stills 3.5,10,22.2    PNG stills into stills/
// Chrome must run outside the command sandbox. Audio: tmp/save-me-a-seat/song/mix_vm.wav (the answering-machine message, no ring).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from '../../utils/degauss/video/cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// the song is unreleased, so it lives outside git, in tmp/save-me-a-seat/ (SONG= overrides)
const SONG = process.env.SONG || path.join(HERE, '..', '..', 'tmp', 'save-me-a-seat', 'song', 'mix_vm.wav');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : args[i + 1]; };
const decode = url => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');

const chrome = await launch({ port: 9377, profile: path.join(HERE, 'prof'), width: 1920, height: 1080 });
try {
  await chrome.goto(pathToFileURL(path.join(HERE, 'video.html')).href, 'window.__ready === true || !!window.__error', 120000);
  const error = await chrome.evaluate('window.__error || null');
  if (error) throw new Error('video.html: ' + error);
  const FPS = await chrome.evaluate('__fps'), FRAMES = await chrome.evaluate('__frames');
  const stills = opt('stills');
  if (stills) {
    mkdirSync(path.join(HERE, 'stills'), { recursive: true });
    for (const t of stills.split(',').map(Number)) {
      const file = path.join(HERE, 'stills', `t_${t.toFixed(2)}.png`);
      const len = await chrome.evaluate(`(window.__png = __render(${Math.round(t * FPS)}, 'image/png')).length`);
      let url = '';
      for (let k = 0; k < len; k += 1 << 20) url += await chrome.evaluate(`__png.slice(${k}, ${k + (1 << 20)})`);
      writeFileSync(file, decode(url));
      console.log('wrote', path.relative(HERE, file));
    }
  } else {
    const whole = opt('from') === undefined && opt('to') === undefined;
    const from = Math.round(Number(opt('from', 0)) * FPS), to = Math.min(FRAMES, Math.round(Number(opt('to', FRAMES / FPS)) * FPS));
    const n = to - from, secs = n / FPS;
    mkdirSync(path.join(HERE, 'out'), { recursive: true });
    const mp4 = path.join(HERE, 'out', opt('out', whole ? 'handdrawn.mp4' : 'segment.mp4'));
    const fade = opt('fade');           // seconds of audio fade at the end (pilots)
    const ff = spawn('ffmpeg', ['-hide_banner', '-nostdin', '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
      '-ss', (from / FPS).toFixed(4), '-t', secs.toFixed(4), '-i', SONG,
      '-map', '0:v', '-map', '1:a',
      '-vf', 'scale=in_color_matrix=bt601:out_color_matrix=bt709:in_range=full:out_range=tv,format=yuv420p',
      '-c:v', 'libx264', '-preset', opt('preset', whole ? 'slow' : 'medium'), '-crf', opt('crf', '18'), '-profile:v', 'high',
      '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709',
      '-g', String(FPS * 2), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
      ...(fade ? ['-af', `afade=t=out:st=${(secs - Number(fade)).toFixed(3)}:d=${fade}`] : []),
      '-t', secs.toFixed(4), '-frames:v', String(n), '-fs', '900M', '-movflags', '+faststart', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', code => code ? rej(new Error('ffmpeg exited ' + code)) : res()));
    const t0 = Date.now();
    let last = null;
    for (let i = from; i < to; i++) {
      // drawings change on twos: an odd frame repeats the drawing before it
      const buf = (i % 2 === 1 && last && i !== from) ? last : decode(await chrome.evaluate(`__render(${i})`));
      last = buf;
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((i - from) % 240 === 239) {
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
