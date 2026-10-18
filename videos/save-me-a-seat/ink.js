// ink.js: the hand-drawn look, all in code.
// Every drawing is redrawn twelve times a second with fresh wobble ("boil"), on paper that changes sheet each
// drawing, coloured with watercolour that has its own grain and sits a little off its lines, like hand colouring.
'use strict';
const W = 1920, H = 1080, DRAW_FPS = 12;
const C = {
  paper: '#f3ead7', ink: '#2c2521', night: '#26324d', night2: '#38496c', dusk: '#5b5f86',
  gold: '#efbd52', star: '#ffe079', yellow: '#ffc21a', yellowD: '#c9910c', skin: '#fbe6d6', blush: '#e9a19b',
  narr: '#7f98ba', narrD: '#5c7598', hairN: '#3a2f2b', hairL: '#c4552d', red: '#cf4a3b', blue: '#4b6fc4',
  grey: '#9b958b', warm: '#c9bba2', beige: '#ddd0b6', dark: '#4a4f5c', shoe: '#3b3431', green: '#5d7a5a',
  brown: '#8a6647', wood: '#b48a5e', glass: '#c9dde3', cream: '#f8f1e0', pink: '#e7b3b0', boot: '#3f574a'
};
let BOIL = 0;                 // which drawing this is: the wobble changes with it

// ---------------------------------------------------------------- randomness
function hash32(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}
const rnd01 = n => hash32(n | 0) / 4294967296;
function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function vnoise(x, seed) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  const a = rnd01(i * 374761 + seed * 668265 + 7), b = rnd01((i + 1) * 374761 + seed * 668265 + 7);
  return a + (b - a) * u;
}
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const ease = t => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
const easeIn = t => Math.pow(clamp(t), 3);
const ramp = (t, a, b) => clamp((t - a) / (b - a));
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- textures
function tileNoise(size, cells, seed, lo = 0, hi = 255) {
  // a seamless tile of smooth noise: the random grid is wrapped 3x3 before one smooth upscale, and the middle
  // third kept, so interpolation runs across the tile's edges too
  const r = mulberry(seed), vals = Array.from({ length: cells * cells }, () => lo + r() * (hi - lo));
  const s = document.createElement('canvas'); s.width = s.height = cells * 3;
  const sc = s.getContext('2d'), id = sc.createImageData(cells * 3, cells * 3);
  for (let y = 0; y < cells * 3; y++) for (let x = 0; x < cells * 3; x++) {
    const v = vals[(y % cells) * cells + (x % cells)]; id.data.set([v, v, v, 255], (y * cells * 3 + x) * 4);
  }
  sc.putImageData(id, 0, 0);
  const big = document.createElement('canvas'); big.width = big.height = size * 3;
  const bc = big.getContext('2d'); bc.imageSmoothingEnabled = true; bc.imageSmoothingQuality = 'high';
  bc.drawImage(s, 0, 0, size * 3, size * 3);
  const out = document.createElement('canvas'); out.width = out.height = size;
  out.getContext('2d').drawImage(big, size, size, size, size, 0, 0, size, size);
  return out;
}

function makePaper(seed) {
  const cv = document.createElement('canvas'); cv.width = W + 64; cv.height = H + 64;
  const c = cv.getContext('2d'), r = mulberry(seed);
  c.fillStyle = C.paper; c.fillRect(0, 0, cv.width, cv.height);
  // soft mottling, then a finer cloud, then fibres and tooth
  for (const [cells, a, mode] of [[7, 0.5, 'multiply'], [34, 0.35, 'multiply'], [12, 0.25, 'screen']]) {
    const t = tileNoise(512, cells, seed * 13 + cells, mode === 'multiply' ? 222 : 0, mode === 'multiply' ? 255 : 60);
    c.globalAlpha = a; c.globalCompositeOperation = mode;
    for (let x = 0; x < cv.width; x += 512) for (let y = 0; y < cv.height; y += 512) c.drawImage(t, x, y);
  }
  c.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 3200; i++) {
    const x = r() * cv.width, y = r() * cv.height, a = r() * TAU, l = 6 + r() * 26;
    c.globalAlpha = 0.03 + r() * 0.06; c.strokeStyle = r() < 0.6 ? '#9c8f78' : '#fffaf0';
    c.lineWidth = 0.5 + r() * 0.9; c.beginPath(); c.moveTo(x, y);
    c.quadraticCurveTo(x + Math.cos(a + 0.4) * l / 2, y + Math.sin(a + 0.4) * l / 2, x + Math.cos(a) * l, y + Math.sin(a) * l);
    c.stroke();
  }
  const id = c.getImageData(0, 0, cv.width, cv.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const v = (r() - 0.5) * 10; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
  c.putImageData(id, 0, 0);
  c.globalAlpha = 1;
  // a warm vignette, as if under a desk lamp
  const g = c.createRadialGradient(cv.width / 2, cv.height / 2, cv.height * 0.35, cv.width / 2, cv.height / 2, cv.width * 0.72);
  g.addColorStop(0, 'rgba(255,250,240,0)'); g.addColorStop(1, 'rgba(170,140,100,0.16)');
  c.fillStyle = g; c.globalCompositeOperation = 'multiply'; c.fillRect(0, 0, cv.width, cv.height);
  return cv;
}

function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function shade(h, k) { const [r, g, b] = hexRGB(h); const f = v => Math.round(clamp(v * k, 0, 255)); return `rgb(${f(r)},${f(g)},${f(b)})`; }
function mix(h1, h2, t) { const a = hexRGB(h1), b = hexRGB(h2); return '#' + a.map((v, i) => Math.round(lerp(v, b[i], t)).toString(16).padStart(2, '0')).join(''); }

// ---------------------------------------------------------------- the frame
const F = {};
function initInk() {
  F.main = document.getElementById('cv').getContext('2d');
  const layer = () => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; return cv.getContext('2d'); };
  F.art = layer(); F.light = layer();
  F.papers = [1, 2, 3, 4].map(makePaper);
  F.wash = tileNoise(512, 9, 77, 175, 255); F.wash2 = tileNoise(512, 34, 78, 195, 255); F.gran = tileNoise(512, 160, 79, 150, 255);
  F.bloom = tileNoise(512, 14, 80, 0, 255);
  F.pats = new Map(); F.inkPats = {};
}

// one 512px pattern per colour is a megabyte of canvas, so colours are rounded a little (never visibly) and the
// cache keeps only the most recently used ones; a long render otherwise runs the page out of memory
const PAT_CAP = 160;
function patKey(col) {
  let r, g, b;
  if (col.startsWith('#')) [r, g, b] = hexRGB(col);
  else { const m = col.match(/[\d.]+/g); if (!m) return col; [r, g, b] = m.map(Number); }
  const q = v => Math.min(255, Math.round(v / 4) * 4);
  return '#' + [q(r), q(g), q(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}
function paintPattern(col0) {
  const col = patKey(col0);
  if (F.frameKeys) F.frameKeys.add(col);
  const hit = F.pats.get(col);
  if (hit) { F.pats.delete(col); F.pats.set(col, hit); return hit; }
  if (F.pats.size >= PAT_CAP) F.pats.delete(F.pats.keys().next().value);
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const c = cv.getContext('2d');
  c.fillStyle = col; c.fillRect(0, 0, 512, 512);
  // pale colours (skin, cream) take less texture, or faces go grey
  const [r0, g0, b0] = col.startsWith('#') ? hexRGB(col) : [128, 128, 128], lum = (0.3 * r0 + 0.59 * g0 + 0.11 * b0) / 255;
  const k = 1 - 0.75 * clamp((lum - 0.62) / 0.3);
  c.globalCompositeOperation = 'multiply';
  c.globalAlpha = 0.55 * k; c.drawImage(F.wash, 0, 0);        // the pigment pools and thins
  c.globalAlpha = 0.5 * k; c.drawImage(F.wash2, 0, 0);
  c.globalAlpha = 0.35 * k; c.drawImage(F.gran, 0, 0);         // granulation
  c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.09; c.drawImage(F.bloom, 0, 0);
  const pat = F.art.createPattern(cv, 'repeat'); F.pats.set(col, pat); return pat;
}
function inkPattern(col) {
  if (F.inkPats[col]) return F.inkPats[col];
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const c = cv.getContext('2d'); c.fillStyle = col; c.fillRect(0, 0, 256, 256);
  const id = c.getImageData(0, 0, 256, 256), d = id.data, r = mulberry(5);
  for (let i = 3; i < d.length; i += 4) d[i] = 255 * (r() < 0.12 ? 0.55 + r() * 0.3 : 0.88 + r() * 0.12);   // dry-brush tooth
  c.putImageData(id, 0, 0);
  return (F.inkPats[col] = F.art.createPattern(cv, 'repeat'));
}
function screenPattern(c, pat, salt) {
  // texture stays put on screen (it is the paper's), and changes sheet with every drawing
  const ox = rnd01(BOIL * 31 + salt) * 512, oy = rnd01(BOIL * 37 + salt + 1) * 512;
  pat.setTransform(c.getTransform().inverse().multiply(new DOMMatrix().translate(ox, oy)));
  return pat;
}

function beginFrame(t) {
  BOIL = Math.floor(t * DRAW_FPS + 1e-6);
  if (F.frameKeys) F.frameKeys = new Set();
  for (const c of [F.art, F.light]) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
  cam(W / 2, H / 2, 1, 0);
}
function cam(x, y, z = 1, rot = 0) {
  const m = new DOMMatrix().translate(W / 2, H / 2).rotate(rot * 180 / Math.PI).scale(z).translate(-x, -y);
  for (const c of [F.art, F.light]) { c.setTransform(m); c.__k = z; }
  F.k = z;
}
function endFrame(o = {}) {
  const m = F.main; m.setTransform(1, 0, 0, 1, 0, 0);
  m.globalCompositeOperation = 'source-over'; m.globalAlpha = 1;
  const p = F.papers[BOIL % 4], ox = (rnd01(BOIL * 3 + 1) * 64) | 0, oy = (rnd01(BOIL * 5 + 2) * 64) | 0;
  m.drawImage(p, ox, oy, W, H, 0, 0, W, H);
  if (o.tint) { m.globalCompositeOperation = 'multiply'; m.fillStyle = o.tint; m.fillRect(0, 0, W, H); }
  m.globalCompositeOperation = 'multiply'; m.drawImage(F.art.canvas, 0, 0);
  m.globalCompositeOperation = 'screen'; m.drawImage(F.light.canvas, 0, 0);
  m.globalCompositeOperation = 'source-over';
  if (o.fade) { m.fillStyle = `rgba(243,234,215,${o.fade})`; m.fillRect(0, 0, W, H); }
}

// ---------------------------------------------------------------- geometry
function spline(pts, closed, step) {
  // Catmull-Rom through the control points, sampled about every `step` units
  const n = pts.length; if (n < 2) return pts.slice();
  const out = [], get = i => closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1) | 0];
  const segs = closed ? n : n - 1;
  const kn = (a, b) => Math.pow(Math.max(1e-6, Math.hypot(b[0] - a[0], b[1] - a[1])), 0.5);   // centripetal
  for (let i = 0; i < segs; i++) {
    let p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    if (!closed && i === 0) p0 = [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]];
    if (!closed && i === segs - 1) p3 = [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]];
    const t0 = 0, t1 = t0 + kn(p0, p1), t2 = t1 + kn(p1, p2), t3 = t2 + kn(p2, p3);
    const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), m = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < m; k++) {
      const t = t1 + (t2 - t1) * k / m, q = [];
      for (let d = 0; d < 2; d++) {
        const A1 = (t1 - t) / (t1 - t0) * p0[d] + (t - t0) / (t1 - t0) * p1[d];
        const A2 = (t2 - t) / (t2 - t1) * p1[d] + (t - t1) / (t2 - t1) * p2[d];
        const A3 = (t3 - t) / (t3 - t2) * p2[d] + (t - t2) / (t3 - t2) * p3[d];
        const B1 = (t2 - t) / (t2 - t0) * A1 + (t - t0) / (t2 - t0) * A2;
        const B2 = (t3 - t) / (t3 - t1) * A2 + (t - t1) / (t3 - t1) * A3;
        q.push((t2 - t) / (t2 - t1) * B1 + (t - t1) / (t2 - t1) * B2);
      }
      out.push(q);
    }
  }
  if (!closed) out.push(pts[n - 1].slice());
  return out;
}
function densify(pts, closed, step) {
  // straight segments, sampled every `step` (for polygons that must keep their corners)
  const out = [], n = pts.length, segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < m; k++) out.push([lerp(a[0], b[0], k / m), lerp(a[1], b[1], k / m)]);
  }
  if (!closed) out.push(pts[n - 1].slice());
  return out;
}
const ell = (cx, cy, rx, ry, n = 22, rot = 0, a0 = 0, a1 = TAU) => {
  const out = [], full = Math.abs(a1 - a0) >= TAU - 1e-6, m = full ? n : n + 1;
  for (let i = 0; i < m; i++) {
    const a = a0 + (a1 - a0) * i / n, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    out.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return out;
};
function rrect(x, y, w, h, r = 8) {
  r = Math.min(r, w / 2, h / 2);
  const out = [], arc = (cx, cy, a0) => { for (let i = 0; i <= 4; i++) { const a = a0 + i / 4 * Math.PI / 2; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  arc(x + w - r, y + r, -Math.PI / 2); arc(x + w - r, y + h - r, 0); arc(x + r, y + h - r, Math.PI / 2); arc(x + r, y + r, Math.PI);
  return out;
}
function starPts(cx, cy, r1, r2, n = 5, rot = -Math.PI / 2) {
  const out = [];
  for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = rot + i * Math.PI / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}
const xf = (pts, f) => pts.map(p => f(p));
const move = (pts, dx, dy) => pts.map(p => [p[0] + dx, p[1] + dy]);
const rot2 = (p, a, o = [0, 0]) => { const x = p[0] - o[0], y = p[1] - o[1]; return [o[0] + x * Math.cos(a) - y * Math.sin(a), o[1] + x * Math.sin(a) + y * Math.cos(a)]; };
const scalePts = (pts, sx, sy, o = [0, 0]) => pts.map(p => [o[0] + (p[0] - o[0]) * sx, o[1] + (p[1] - o[1]) * sy]);

// ---------------------------------------------------------------- strokes
function jitterPath(P, closed, amp, seed, k) {
  // move each sample along its normal by smooth noise; changes every drawing
  const n = P.length, out = new Array(n); let s = 0;
  for (let i = 0; i < n; i++) {
    if (i) s += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    const a = P[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = P[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const sk = s * k, j = ((vnoise(sk * 0.022, seed) - 0.5) * 2 + (vnoise(sk * 0.09, seed + 17) - 0.5) * 0.6) * amp;
    out[i] = [P[i][0] - ty * j, P[i][1] + tx * j];
  }
  return out;
}

function line(pts, o = {}) {
  // a tapered, wobbling ink line through the control points (o.raw: no smoothing)
  const c = o.ctx || F.art, k = c.__k || 1;
  const w = (o.w ?? 2.6) / k, amp = (o.amp ?? 1.1) / k, closed = !!o.closed;
  const seed = ((o.seed ?? 1) * 131 + BOIL * 7919) | 0;
  let P = o.raw ? densify(pts, closed, 3 / k) : spline(pts, closed, 3 / k);
  if (P.length < 2) return;
  if (!closed && o.over !== 0) {          // a hand overshoots the ends a little
    const ov = (o.over ?? 2.5) / k, ext = (a, b) => { const dx = a[0] - b[0], dy = a[1] - b[1], l = Math.hypot(dx, dy) || 1; return [a[0] + dx / l * ov, a[1] + dy / l * ov]; };
    P = [ext(P[0], P[1]), ...P, ext(P[P.length - 1], P[P.length - 2])];
  }
  P = jitterPath(P, closed, amp, seed, k);
  const n = P.length, cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const total = cum[n - 1], L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = P[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = P[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    let taper = 1;
    if (!closed) { const e = Math.min(cum[i], total - cum[i]) * k; taper = Math.min(1, 0.18 + e / (o.taper ?? 16)); }
    const ww = w * taper * (0.72 + 0.56 * vnoise(cum[i] * k * 0.035, seed + 5)) / 2;
    L.push([P[i][0] - ty * ww, P[i][1] + tx * ww]); R.push([P[i][0] + ty * ww, P[i][1] - tx * ww]);
  }
  c.beginPath(); c.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) c.lineTo(L[i][0], L[i][1]);
  if (closed) { c.closePath(); c.moveTo(R[n - 1][0], R[n - 1][1]); for (let i = n - 2; i >= 0; i--) c.lineTo(R[i][0], R[i][1]); c.closePath(); }
  else { for (let i = n - 1; i >= 0; i--) c.lineTo(R[i][0], R[i][1]); c.closePath(); }
  c.save(); c.globalAlpha = (o.a ?? 0.94) * (c.globalAlpha || 1);
  c.fillStyle = screenPattern(c, inkPattern(o.col || C.ink), 11);
  c.fill(closed ? 'evenodd' : 'nonzero'); c.restore();
  if (o.sketch) line(pts, { ...o, sketch: false, seed: (o.seed ?? 1) + 991, w: (o.w ?? 2.6) * 0.5, a: (o.a ?? 0.94) * 0.45, amp: (o.amp ?? 1.1) * 2.2 });
}

function fillPath(c, P) { c.beginPath(); c.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) c.lineTo(P[i][0], P[i][1]); c.closePath(); }

function shape(pts, o = {}) {
  // a closed shape: watercolour fill a touch off its line, a darker pooled edge, then the ink outline
  const c = o.ctx || F.art, k = c.__k || 1, seed = ((o.seed ?? 1) * 173 + BOIL * 6007) | 0;
  const raw = o.raw ?? pts.length <= 6;          // boxes and wedges keep their corners; curves stay smooth
  if (o.fill) {
    let P = raw ? densify(pts, true, 4 / k) : spline(pts, true, 4 / k);
    const ang = rnd01(seed + 3) * TAU, off = (o.reg ?? 2.2) / k;
    P = jitterPath(P, true, (o.famp ?? 2.0) / k, seed + 41, k).map(p => [p[0] + Math.cos(ang) * off, p[1] + Math.sin(ang) * off]);
    c.save();
    c.globalAlpha = (o.fa ?? 1) * (c.globalAlpha || 1);
    fillPath(c, P); c.fillStyle = screenPattern(c, paintPattern(o.fill), 23); c.fill();
    if (o.edge !== false) {
      c.lineJoin = 'round'; c.lineWidth = (o.edgeW ?? 2.4) / k; c.strokeStyle = shade(o.fill, 0.78);
      c.globalAlpha *= o.edgeA ?? 0.4; c.stroke();
    }
    c.restore();
  }
  if (o.line !== false) line(pts, { ...o, raw, closed: true, w: o.w ?? 2.6, seed: (o.seed ?? 1) + 5 });
}

function wash(pts, col, o = {}) { shape(pts, { line: false, fill: col, ...o }); }

function hatch(pts, o = {}) {
  // pencil hatching, clipped to a shape
  const c = o.ctx || F.art, k = c.__k || 1;
  const P = o.raw ? pts : spline(pts, true, 6 / k);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of P) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  c.save(); fillPath(c, P); c.clip();
  const ang = o.ang ?? -0.9, gap = (o.gap ?? 9) / k, dx = Math.cos(ang), dy = Math.sin(ang);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + gap;
  for (let s = -R, i = 0; s <= R; s += gap, i++) {
    const px = cx - dy * s, py = cy + dx * s;
    line([[px - dx * R, py - dy * R], [px + dx * R, py + dy * R]], { w: o.w ?? 1.3, a: o.a ?? 0.5, amp: 0.9, seed: (o.seed ?? 3) + i * 7, col: o.col, over: 0, taper: 40, ctx: c });
  }
  c.restore();
}

function scribble(pts, col, o = {}) {
  // crayon colouring: a back-and-forth scribble clipped to the shape (memories are coloured in like this)
  const c = o.ctx || F.art, k = c.__k || 1, P = spline(pts, true, 6 / k);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of P) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  c.save(); fillPath(c, P); c.clip();
  const r = mulberry(((o.seed ?? 9) * 977 + BOIL * 13) | 0), gap = (o.gap ?? 7) / k, ang = o.ang ?? 0.5;
  const dx = Math.cos(ang), dy = Math.sin(ang), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2;
  const zz = [];
  for (let s = -R, i = 0; s <= R; s += gap, i++) {
    const side = i % 2 ? 1 : -1, px = cx - dy * s, py = cy + dx * s;
    zz.push([px + dx * R * side + (r() - 0.5) * gap, py + dy * R * side + (r() - 0.5) * gap]);
  }
  c.lineWidth = (o.w ?? 5) / k; c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = screenPattern(c, paintPattern(col), 47); c.globalAlpha = (o.a ?? 0.85) * (c.globalAlpha || 1);
  c.beginPath(); c.moveTo(zz[0][0], zz[0][1]); for (const p of zz) c.lineTo(p[0], p[1]); c.stroke();
  c.restore();
}

function glow(x, y, r, col, a = 0.5) {
  const c = F.light, g = c.createRadialGradient(x, y, 0, x, y, r);
  const [R, G, B] = hexRGB(col);
  g.addColorStop(0, `rgba(${R},${G},${B},${a})`); g.addColorStop(0.45, `rgba(${R},${G},${B},${a * 0.35})`); g.addColorStop(1, `rgba(${R},${G},${B},0)`);
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}

function dots(x, y, n, spread, o = {}) {
  // a little spray of pencil dots (dust, sparkle, rain spatter)
  const r = mulberry(((o.seed ?? 1) * 31 + (o.still ? 0 : BOIL) * 3) | 0);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * spread;
    shape(ell(x + Math.cos(a) * d, y + Math.sin(a) * d, o.r ?? 2.2, o.r ?? 2.2, 7), { fill: o.col || C.ink, line: false, edge: false, reg: 0, famp: 0.6, fa: o.a ?? 0.8, seed: i });
  }
}

// a sparkle: four little strokes
function sparkle(x, y, r, o = {}) {
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + (o.rot ?? 0.2);
    line([[x + Math.cos(a) * r * 0.35, y + Math.sin(a) * r * 0.35], [x + Math.cos(a) * r, y + Math.sin(a) * r]], { w: o.w ?? 2, seed: (o.seed ?? 1) + i, col: o.col, a: o.a });
  }
}
