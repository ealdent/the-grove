// Render the Boots montage with headless Chrome, piping JPEG frames straight into ffmpeg.
//   node render.mjs                        whole film -> OUT/boots.mp4 (needs MEDIA/audio/mix.wav)
//   node render.mjs --from 0 --to 20       a segment (video seconds) -> OUT/segment.mp4 (or --out NAME)
//   node render.mjs --stills 1.7,3.0       PNG stills -> OUT/stills/
//   node render.mjs --sheet 12 [--from a --to b]   contact sheet of every cut (mid-shot frames), 12 per page
// MEDIA (default ../../tmp/boots-march) holds the gitignored assets: img/, clip/, audio/. Chrome must run unsandboxed.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from '../../utils/degauss/video/cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MEDIA = path.resolve(process.env.MEDIA || path.join(HERE, '..', '..', 'tmp', 'boots-march'));
const OUT = path.join(MEDIA, 'out');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : args[i + 1]; };
const decode = url => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
const AUDIO = opt('audio', path.join(MEDIA, 'audio', 'mix.wav'));

const chrome = await launch({ port: Number(opt('port', 9391)), profile: path.join(MEDIA, 'prof'), width: 1920, height: 1080 });
try {
  const url = pathToFileURL(path.join(HERE, 'video.html')).href + '?media=' + encodeURIComponent(pathToFileURL(MEDIA).href);
  await chrome.goto(url, 'window.__ready === true || !!window.__error', 120000);
  const error = await chrome.evaluate('window.__error || null');
  if (error) throw new Error('video.html: ' + error);
  const FPS = await chrome.evaluate('__fps'), FRAMES = await chrome.evaluate('__frames');
  const grab = async (i, type) => {
    const len = await chrome.evaluate(`__render(${i}, '${type}').then(u => (window.__u = u).length)`);
    let u = '';
    for (let k = 0; k < len; k += 1 << 20) u += await chrome.evaluate(`__u.slice(${k}, ${k + (1 << 20)})`);
    return decode(u);
  };
  mkdirSync(path.join(OUT, 'stills'), { recursive: true });
  if (opt('stills')) {
    for (const t of opt('stills').split(',').map(Number)) {
      const file = path.join(OUT, 'stills', `t_${t.toFixed(2)}.png`);
      writeFileSync(file, await grab(Math.round(t * FPS), 'image/png'));
      console.log('wrote', file);
    }
  } else if (opt('sheet')) {
    // one mid-shot frame per cut, tiled by ffmpeg
    const per = Number(opt('sheet')), a = Number(opt('from', 0)), b = Number(opt('to', FRAMES / FPS));
    const shots = (await chrome.evaluate('__shots()')).filter(s => s[0] >= a && s[0] < b);
    const all = await chrome.evaluate('__shots()');
    const cols = 4, rows = Math.ceil(per / cols);
    for (let p = 0; p * per < shots.length; p++) {
      const page = shots.slice(p * per, (p + 1) * per);
      const ff = spawn('ffmpeg', ['-hide_banner', '-nostdin', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '1', '-i', '-',
        '-vf', `scale=480:270,tile=${cols}x${rows}`, '-frames:v', '1', '-q:v', '3', path.join(OUT, 'stills', `sheet_${String(Math.round(a)).padStart(3, '0')}_${String(p).padStart(2, '0')}.jpg`)], { stdio: ['pipe', 'inherit', 'inherit'] });
      const done = new Promise(r => ff.on('close', r));
      for (const s of page) {
        const next = all.find(x => x[0] > s[0]);
        const mid = (s[0] + (next ? next[0] : s[0] + 1)) / 2;
        ff.stdin.write(await grab(Math.round(mid * FPS), 'image/jpeg'));
      }
      ff.stdin.end(); await done;
      console.log('sheet', p, page.map(s => s[0].toFixed(2)).join(' '));
    }
  } else {
    const whole = opt('from') === undefined && opt('to') === undefined;
    const from = Math.round(Number(opt('from', 0)) * FPS), to = Math.min(FRAMES, Math.round(Number(opt('to', FRAMES / FPS)) * FPS));
    const n = to - from, secs = n / FPS;
    const mp4 = path.join(OUT, opt('out', whole ? 'boots.mp4' : 'segment.mp4'));
    const hasAudio = existsSync(AUDIO);
    const ff = spawn('ffmpeg', ['-hide_banner', '-nostdin', '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
      ...(hasAudio ? ['-ss', (from / FPS).toFixed(4), '-t', secs.toFixed(4), '-i', AUDIO, '-map', '0:v', '-map', '1:a'] : []),
      '-vf', 'scale=in_color_matrix=bt601:out_color_matrix=bt709:in_range=full:out_range=tv,format=yuv420p',
      '-c:v', 'libx264', '-preset', opt('preset', whole ? 'slow' : 'veryfast'), '-crf', opt('crf', whole ? '20' : '22'), '-profile:v', 'high',
      '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709',
      '-g', String(FPS * 2), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      ...(hasAudio ? ['-c:a', 'aac', '-b:a', '320k', '-ar', '48000'] : []),
      '-t', secs.toFixed(4), '-frames:v', String(n), '-fs', '1500M', '-movflags', '+faststart', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', code => code ? rej(new Error('ffmpeg exited ' + code)) : res()));
    const t0 = Date.now();
    for (let i = from; i < to; i++) {
      const buf = decode(await chrome.evaluate(`__render(${i})`));
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((i - from) % 600 === 599) {
        const ms = (Date.now() - t0) / (i + 1 - from);
        console.log(`frame ${i + 1 - from}/${n}  ${ms.toFixed(1)} ms/frame  eta ${((to - i - 1) * ms / 60000).toFixed(1)} min`);
      }
    }
    ff.stdin.end();
    await done;
    console.log(`wrote ${mp4} (${n} frames, ${secs.toFixed(2)} s, ${(statSync(mp4).size / 1e6).toFixed(1)} MB) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
} finally {
  chrome.close();
}
