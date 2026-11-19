'use strict';
// Frame renderer for the Boots montage. SHOTS (from edit.js) is a flat cut list in video seconds; every frame is a
// pure function of its index, so the page can be driven frame by frame from render.mjs.
//   image shot  id 'name'    -> MEDIA/img/name.jpg          clip shot  id 'c:name' -> MEDIA/clip/name/0001.jpg ...
//   card shot   id '#k' '#r' '#w' (black / red / bone)
const W = 1920, H = 1080, FPS = 30;
const q = new URLSearchParams(location.search);
const MEDIA = q.get('media') || '../../tmp/boots-march';
const INK = { w: '#f1e9d6', r: '#e5271c', k: '#0b0a09' };
const HEAVY = '"Avenir Next Condensed"', MONO = 'Degauss, Menlo, monospace';
const cv = document.getElementById('cv'), ctx = cv.getContext('2d', { alpha: false });
const frameOf = t => Math.round(t * FPS);

// ---------- deterministic noise ----------
function rnd(n) { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; }
const GRAIN = [];
function makeGrain() {
  for (let k = 0; k < 6; k++) {
    const c = new OffscreenCanvas(480, 270), g = c.getContext('2d'), im = g.createImageData(480, 270);
    for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (rnd(i * 7 + k * 99991) + rnd(i * 13 + k * 31337) - 1) * 150; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0); GRAIN.push(c);
  }
}

// ---------- assets ----------
const cache = new Map();           // url -> ImageBitmap | null (missing)
let CLIPS = {};                          // name -> frame count, from MEDIA/clips.json (prep.py)
async function load(url) {
  if (cache.has(url)) return cache.get(url);
  let bmp = null;
  try { const r = await fetch(url); if (r.ok) bmp = await createImageBitmap(await r.blob()); } catch { }
  cache.set(url, bmp);
  if (cache.size > 90) { const k = cache.keys().next().value; const b = cache.get(k); if (b && b.close) b.close(); cache.delete(k); }
  return bmp;
}
function assetUrl(s, u) {
  if (s.id[0] === '#') return null;
  if (s.id.startsWith('c:')) {
    const name = s.id.slice(2), n = CLIPS[name] || 0;
    if (!n) return null;
    let f = Math.floor((s.from || 0) * 24 + u * 24 * (s.rate || 1));
    f = s.loop === false ? Math.min(n - 1, f) : ((f % n) + n) % n;
    return `${MEDIA}/clip/${name}/${String(f + 1).padStart(4, '0')}.jpg`;
  }
  return `${MEDIA}/img/${s.id}.jpg`;
}

// ---------- drawing ----------
const ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
function cover(img, scale, ox, oy) {
  const r = Math.max(W / img.width, H / img.height) * scale, w = img.width * r, h = img.height * r;
  ctx.drawImage(img, (W - w) / 2 + ox, (H - h) / 2 + oy, w, h);
}
function fitLines(lines, font, maxW, maxH, lh) {
  ctx.font = `${font} 100px ${HEAVY}`;
  let widest = 1; for (const l of lines) widest = Math.max(widest, ctx.measureText(l.replace('^', '')).width);
  return Math.min(maxW / widest * 100, maxH / (lines.length * lh), 460);
}
function drawBig(s, u, onImage) {
  let text = s.big;
  if (s.count) {
    const c = s.count, k = ease(u / Math.max(0.05, (s.end - s.t) * (c.span || 0.8)));
    const v = c.from + (c.to - c.from) * k;
    text = (c.pre || '') + Math.round(v).toLocaleString('en-US') + (c.post || '');
  }
  if (!text) return 0;
  const lines = text.split('\n'), lh = 0.92;
  const maxW = W * (s.w || 0.86), maxH = H * (s.h || (s.small ? 0.56 : 0.66));
  const size = fitLines(lines, '800', maxW, maxH, lh);
  const pop = 1 + 0.07 * (1 - ease(u / 0.12));
  const total = lines.length * size * lh;
  const cy = s.pos === 'low' ? H * 0.70 : s.pos === 'high' ? H * 0.30 : H * 0.46;
  ctx.save();
  ctx.translate(W / 2, cy); ctx.scale(pop, pop);
  ctx.font = `800 ${size}px ${HEAVY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => {
    const cut = l.indexOf('^'), str = l.replace('^', '');         // '^' starts the red part of a line
    const y = -total / 2 + (i + 0.80) * size * lh;
    if (onImage) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(str, size * 0.018, y + size * 0.022); }
    const w = ctx.measureText(str).width, head = cut < 0 ? str : str.slice(0, cut);
    ctx.textAlign = 'left';
    ctx.fillStyle = INK[s.ink || 'w']; ctx.fillText(head, -w / 2, y);
    if (cut >= 0) { ctx.fillStyle = INK.r; ctx.fillText(str.slice(cut), -w / 2 + ctx.measureText(head).width, y); }
    ctx.textAlign = 'center';
  });
  ctx.restore();
  return cy + total / 2;
}
function drawSmall(s, bottom) {
  if (!s.small) return;
  ctx.save();
  ctx.font = `700 ${s.smallSize || 40}px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  try { ctx.letterSpacing = '3px'; } catch { }
  const lines = s.small.split('\n').flatMap(l => {              // a caption too wide for the frame wraps onto two balanced lines
    if (ctx.measureText(l).width <= W * 0.88) return [l];
    const words = l.split(' '); let best = 1, d = 1e9;
    for (let k = 1; k < words.length; k++) {
      const a = ctx.measureText(words.slice(0, k).join(' ')).width, b = ctx.measureText(words.slice(k).join(' ')).width;
      if (Math.abs(a - b) < d) { d = Math.abs(a - b); best = k; }
    }
    return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  });
  const y = s.big || s.count ? Math.min(H - 228 - (lines.length - 1) * 54, bottom + 26) : H * 0.74;
  lines.forEach((l, i) => {
    const w = ctx.measureText(l).width;
    if (s.id[0] !== '#') { ctx.fillStyle = 'rgba(8,7,6,0.72)'; ctx.fillRect(W / 2 - w / 2 - 22, y + i * 54 - 9, w + 44, 56); }
    ctx.fillStyle = s.id === '#r' ? INK.k : s.id === '#w' ? INK.k : INK.w;
    ctx.fillText(l, W / 2, y + i * 54);
  });
  ctx.restore();
}
// bottom timeline: 2017 .. 2027, marker at the shot's date; beyond the present it runs off the ruled part
const Y0 = 2017, Y1 = 2027.6;
function drawTimeline(s, t) {
  if (s.noHud) return;
  const x0 = 110, x1 = W - 110, y = H - 54, X = d => x0 + (x1 - x0) * (d - Y0) / (Y1 - Y0);
  const onLight = s.id === '#w' || s.id === '#r';
  const ink = onLight ? 'rgba(11,10,9,0.85)' : 'rgba(241,233,214,0.85)';
  ctx.save();
  ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(X(Math.min(NOW, Y1)), y); ctx.stroke();
  ctx.setLineDash([4, 10]); ctx.beginPath(); ctx.moveTo(X(NOW), y); ctx.lineTo(x1, y); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = `700 22px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let yr = Y0; yr <= 2026; yr++) { ctx.fillRect(X(yr) - 1, y - 9, 2, 18); ctx.fillText(String(yr), X(yr), y + 16); }
  const d = s.d;
  if (d != null) {
    const x = X(Math.min(d, Y1)), future = d > NOW + 0.001;
    ctx.fillStyle = s.id === '#r' ? INK.k : INK.r; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x - 13, y - 30); ctx.lineTo(x + 13, y - 30); ctx.closePath(); ctx.fill();
    ctx.fillRect(x0, y - 2, Math.max(0, X(Math.min(d, NOW)) - x0), 4);
    if (s.date || future) {
      ctx.font = `700 30px ${MONO}`; ctx.textAlign = x > W - 300 ? 'right' : x < 300 ? 'left' : 'center';
      const label = s.date || '?';
      const tw = ctx.measureText(label).width, ax = ctx.textAlign === 'right' ? x + 14 - tw : ctx.textAlign === 'left' ? x - 14 : x - tw / 2;
      ctx.fillStyle = 'rgba(8,7,6,0.78)'; ctx.fillRect(ax - 12, y - 76, tw + 24, 42);
      ctx.fillStyle = INK.w; ctx.textBaseline = 'top';
      ctx.fillText(label, ctx.textAlign === 'right' ? x + 14 : ctx.textAlign === 'left' ? x - 14 : x, y - 70);
    }
  }
  ctx.restore();
}

function shotAt(f) {
  let lo = 0, hi = SHOTS.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (SHOTS[m].f <= f) lo = m; else hi = m - 1; }
  return SHOTS[lo];
}

async function drawFrame(f) {
  const t = f / FPS, s = shotAt(f), u = Math.max(0, t - s.f / FPS), dur = s.end - s.t;
  const url = assetUrl(s, u);
  const img = url ? await load(url) : null;
  const colour = !!s.colour;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = s.id === '#r' ? INK.r : s.id === '#w' ? INK.w : INK.k; ctx.fillRect(0, 0, W, H);
  // hit shake + gate weave
  const hit = s.hit == null ? 1 : s.hit, decay = Math.exp(-u / 0.07);
  const sx = (rnd(f * 3 + 1) - 0.5) * (2.2 + 26 * hit * decay), sy = (rnd(f * 3 + 2) - 0.5) * (2.2 + 26 * hit * decay);
  ctx.save(); ctx.translate(sx, sy);
  if (img) {
    const k = s.i % 2 ? 1 : -1, mv = s.move || 'punch';
    let sc = 1.06, ox = 0, oy = 0;
    if (mv === 'punch') { sc = 1.05 + 0.16 * (1 - ease(u / 0.22)) + 0.03 * u; ox = k * 14 * u; }
    else if (mv === 'push') sc = 1.04 + 0.11 * (u / Math.max(dur, 0.2));
    else if (mv === 'pull') sc = 1.20 - 0.14 * ease(u / Math.max(dur, 0.2));
    else if (mv === 'pan') { sc = 1.14; ox = k * (-90 + 180 * (u / Math.max(dur, 0.2))); }
    else if (mv === 'still') sc = 1.03;
    ctx.filter = (colour ? 'saturate(1.12) contrast(1.06)' : `grayscale(1) contrast(${s.neg ? 1.0 : 1.22}) brightness(${s.dim ? 0.62 : 0.98})`) + (s.neg ? ' invert(1)' : '');
    const n = s.tile || 1;
    if (n === 1) cover(img, sc, ox, oy);
    else {
      const tw = W / n, th = H / n;
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
        if (s.fill != null && rnd(a * 131 + b * 17 + 5) > s.fill + u / Math.max(dur, 0.1)) continue;
        ctx.drawImage(img, a * tw, b * th, tw + 1, th + 1);
      }
    }
    ctx.filter = 'none';
    if (s.tint === 'r') { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = INK.r; ctx.fillRect(-60, -60, W + 120, H + 120); ctx.globalCompositeOperation = 'source-over'; }
    if ((s.big || s.count) && s.scrim !== 0) { ctx.fillStyle = `rgba(6,5,4,${s.scrim == null ? 0.42 : s.scrim})`; ctx.fillRect(-60, -60, W + 120, H + 120); }
  } else if (s.id[0] !== '#') {            // missing asset: animatic placeholder
    ctx.fillStyle = '#1c1b19'; ctx.fillRect(-60, -60, W + 120, H + 120);
    ctx.fillStyle = '#5a564d'; ctx.font = `700 34px ${MONO}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('[' + s.id + ']', 60, 50);
  }
  if (s.x) {                                // struck out
    ctx.strokeStyle = INK.r; ctx.lineWidth = 46; ctx.lineCap = 'butt';
    const k = ease(u / 0.1);
    ctx.beginPath(); ctx.moveTo(W * 0.18, H * 0.1); ctx.lineTo(W * 0.18 + W * 0.64 * k, H * 0.1 + H * 0.8 * k);
    ctx.moveTo(W * 0.82, H * 0.1); ctx.lineTo(W * 0.82 - W * 0.64 * k, H * 0.1 + H * 0.8 * k); ctx.stroke();
  }
  const bottom = drawBig(s, u, !!img);
  drawSmall(s, bottom);
  ctx.restore();
  drawTimeline(s, t);
  // flash on the cut
  if (s.flash) { const a = [0.85, 0.42, 0.16][f - s.f]; if (a) { ctx.fillStyle = s.flash === 'r' ? INK.r : INK.w; ctx.globalAlpha = a; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; } }
  // film: vignette, grain, flicker, scratches
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${colour ? 0.34 : 0.62})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = colour ? 0.14 : 0.27;
  const gr = GRAIN[f % GRAIN.length], gx = Math.floor(rnd(f * 5 + 3) * 200), gy = Math.floor(rnd(f * 5 + 4) * 100);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(gr, gx / 4, gy / 4, 480 - 50, 270 - 25, 0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  if (!colour) {
    ctx.globalAlpha = 0.05 + 0.05 * rnd(f * 11 + 7); ctx.fillStyle = rnd(f * 11 + 8) > 0.5 ? '#000' : '#fff'; ctx.fillRect(0, 0, W, H);
    if (rnd(f * 17 + 9) > 0.72) { const x = rnd(f * 17 + 10) * W; ctx.globalAlpha = 0.22; ctx.fillStyle = '#fff'; ctx.fillRect(x, 0, 1.5, H); }
    if (rnd(f * 19 + 11) > 0.86) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(rnd(f * 19 + 12) * W, rnd(f * 19 + 13) * H, 2 + rnd(f * 19 + 14) * 5, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

window.__fps = FPS;
window.__frames = frameOf(END);
window.__render = async (i, type = 'image/jpeg') => { await drawFrame(i); return cv.toDataURL(type, 0.92); };
window.__shots = () => SHOTS.map(s => [s.t, s.id, s.big || '']);
(async () => {
  makeGrain();
  try { CLIPS = await (await fetch(`${MEDIA}/clips.json`)).json(); } catch { }
  await Promise.all([document.fonts.load(`800 100px ${HEAVY}`), document.fonts.load(`700 40px Degauss`)]);
  if (q.has('t')) await drawFrame(frameOf(Number(q.get('t'))));
  window.__ready = true;
})().catch(e => { window.__error = String(e); });
