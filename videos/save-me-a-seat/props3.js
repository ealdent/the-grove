// props3.js: verse 2 to the end of chorus 2. Handwriting, the server farm, a bed from above, soil and pixels.
'use strict';

// handwritten digits, as pen strokes in a 0.6 x 1 box
const DIGITS = {
  '0': [ell(0.3, 0.5, 0.26, 0.5, 14)],
  '1': [[[0.16, 0.2], [0.34, 0], [0.34, 1]]],
  '2': [[[0.05, 0.25], [0.2, 0.02], [0.45, 0.05], [0.5, 0.3], [0.05, 1], [0.56, 1]]],
  '3': [[[0.05, 0.1], [0.3, 0], [0.5, 0.15], [0.3, 0.45], [0.55, 0.7], [0.35, 1], [0.05, 0.9]]],
  '4': [[[0.42, 1], [0.42, 0], [0.02, 0.68], [0.58, 0.68]]],
  '5': [[[0.52, 0], [0.12, 0], [0.07, 0.45], [0.35, 0.38], [0.55, 0.62], [0.4, 0.95], [0.05, 0.9]]],
  '6': [[[0.5, 0.05], [0.2, 0.2], [0.05, 0.65], [0.25, 1], [0.5, 0.85], [0.45, 0.55], [0.1, 0.62]]],
  '7': [[[0.02, 0], [0.58, 0], [0.25, 1]]],
  '8': [[[0.3, 0.48], [0.08, 0.25], [0.3, 0], [0.52, 0.25], [0.3, 0.48], [0.05, 0.75], [0.3, 1], [0.55, 0.75], [0.3, 0.48]]],
  '9': [[[0.5, 0.42], [0.25, 0.5], [0.05, 0.25], [0.3, 0], [0.52, 0.2], [0.45, 1]]],
  '-': [[[0.08, 0.55], [0.45, 0.55]]]
};
function scrawl(str, x, y, h, p, o = {}) {
  // write str in marker from (x, y) (top-left), h high; p 0..1 is how much is written. Returns the pen's tip.
  const n = str.length, upto = p * n; let tip = null;
  for (let i = 0; i < n && i < upto; i++) {
    const strokes = DIGITS[str[i]] || [], frac = clamp(upto - i), cx = x + i * h * (o.adv ?? 0.72), sl = o.slant ?? 0.12;
    strokes.forEach((st, si) => {
      let P = st.map(([u, v]) => [cx + (u + (1 - v) * sl) * h, y + v * h]);
      if (frac < 1) { const k = Math.max(2, Math.ceil(P.length * frac)); P = P.slice(0, k); }
      line(P, { w: o.w ?? 6, col: o.col || '#1d1a22', seed: (o.seed ?? 2001) + i * 7 + si, over: 0, taper: 6, raw: P.length < 4 });
      tip = P[P.length - 1];
    });
  }
  return tip;
}

function marker(x, y, s, ang) {
  // a felt marker, its tip at (x, y)
  const c = F.art; c.save(); c.translate(x, y); c.rotate(ang);
  shape([[0, 0], [10 * s, -6 * s], [10 * s, 6 * s]], { fill: '#1d1a22', seed: 2101 });
  shape(rrect(10 * s, -9 * s, 120 * s, 18 * s, 6 * s), { fill: '#9aa0a8', seed: 2102 });
  shape(rrect(96 * s, -10 * s, 38 * s, 20 * s, 6 * s), { fill: '#1d1a22', seed: 2103 });
  c.restore();
}

function crownSnake(x, y, s, o = {}) {
  // the basilisk, larger: a curled snake in a tiny gold crown, its eyes on you
  const g = o.col || '#6f8f5a', look = o.look ?? 0, ph = o.ph ?? 0;
  const body = []; for (let i = 0; i <= 18; i++) { const t = i / 18; body.push([x - 90 * s + t * 150 * s, y + Math.sin(t * 9 + ph) * 16 * s * (1 - t * 0.5)]); }
  line(body, { w: 22 * s, col: g, seed: 2201, over: 0, taper: 30 });
  line(body, { w: 2.4, seed: 2202, over: 0, a: 0.4 });
  const hx = x + 66 * s, hy = y - 30 * s;
  line([[x + 58 * s, y + 4 * s], [hx - 6 * s, hy + 14 * s]], { w: 20 * s, col: g, seed: 2203, over: 0 });
  shape(ell(hx, hy, 26 * s, 20 * s, 14, o.tilt ?? 0), { fill: g, seed: 2204 });
  for (const sx of [-1, 1]) { shape(ell(hx + sx * 9 * s + look * 4 * s, hy - 5 * s, 6 * s, 7 * s * (1 - (o.blink ?? 0)), 10), { fill: C.cream, seed: 2205 + sx, w: 1.6 }); if ((o.blink ?? 0) < 0.6) shape(ell(hx + sx * 9 * s + look * 6 * s, hy - 4 * s, 3 * s, 4 * s, 8), { fill: C.ink, line: false, seed: 2207 + sx }); }
  if (o.smile !== undefined) line([[hx - 10 * s, hy + 8 * s], [hx, hy + 8 * s + o.smile * 5 * s], [hx + 10 * s, hy + 8 * s]], { w: 2, seed: 2209 });
  if (o.tongue) line([[hx + 24 * s, hy + 6 * s], [hx + 40 * s, hy + 4 * s], [hx + 46 * s, hy - 2 * s]], { w: 2, col: C.red, seed: 2210 });
  shape([[hx - 14 * s, hy - 16 * s], [hx - 12 * s, hy - 32 * s], [hx - 5 * s, hy - 22 * s], [hx + 2 * s, hy - 35 * s], [hx + 8 * s, hy - 22 * s], [hx + 14 * s, hy - 32 * s], [hx + 15 * s, hy - 16 * s]], { fill: C.gold, seed: 2211, raw: true });
  return { head: [hx, hy] };
}

function serverFarm(x, y, w, h, t, o = {}) {
  // a long box of a building humming with lights; the basilisk is its logo
  shape([[x, y], [x, y - h], [x + w, y - h], [x + w, y]], { fill: '#59607a', seed: 2301 });
  scribble([[x, y], [x, y - h], [x + w, y - h], [x + w, y]], '#4a5068', { gap: 12, w: 4, seed: 2302, a: 0.3 });
  const r = mulberry(2303);
  for (let yy = y - h + 40; yy < y - 30; yy += 34) for (let xx = x + 30; xx < x + w - 30; xx += 26) {
    const lx = o.logoX ?? 0.5; if ((xx > x + w * (lx - 0.13) && xx < x + w * (lx + 0.13) && yy < y - h * 0.3)) continue;
    const on = Math.sin(t * (1.5 + r() * 3) + r() * 9) > -0.2;
    shape(rrect(xx, yy, 10, 6, 2), { fill: on ? (r() < 0.75 ? '#8fe0a0' : '#ffd36a') : '#3a3f52', line: false, edge: false, seed: 2304 });
  }
  crownSnake(x + w * (o.logoX ?? 0.5) - 30, y - h * 0.58, 1.5, { col: '#c9d6a8', ph: 0 });
  for (let i = 0; i < 3; i++) {
    const fx = x + 120 + i * 220, fy = y - h - 30;
    shape(rrect(fx - 60, fy - 20, 120, 50, 6), { fill: '#7a8098', seed: 2320 + i });
    for (let k = 0; k < 3; k++) { const a = t * 6 + k * TAU / 3 + i; line([[fx, fy + 4], [fx + Math.cos(a) * 34, fy + 4 + Math.sin(a) * 12]], { w: 3, seed: 2324 + k + i * 3 }); }
  }
}

function padlock(x, y, s) {
  line(ell(x, y - 16 * s, 14 * s, 18 * s, 12, 0, Math.PI, TAU), { w: 5 * s, col: '#8a8f99', seed: 2401 });
  shape(rrect(x - 20 * s, y - 16 * s, 40 * s, 34 * s, 5 * s), { fill: '#c9a03e', seed: 2402 });
  shape(ell(x, y, 3.4 * s, 5 * s, 8), { fill: C.ink, line: false, seed: 2403 });
}
function chain(pts, s, o = {}) {
  // links along a path
  const P = spline(pts, false, 14 * s);
  P.forEach((p, i) => { if (i % 2) return; const q = P[Math.min(P.length - 1, i + 1)], a = Math.atan2(q[1] - p[1], q[0] - p[0]);
    line(ell(p[0], p[1], 11 * s, 6 * s, 10, a + (i % 4 ? Math.PI / 2 * 0.3 : 0)), { closed: true, w: 3.4 * s, col: o.col || '#7d828c', seed: 2410 + i }); });
}
function securityCam(x, y, ang, s = 1) {
  line([[x, y], [x + 30 * s, y]], { w: 4 * s, seed: 2420 });
  const c = F.art; c.save(); c.translate(x + 30 * s, y); c.rotate(ang);
  shape(rrect(0, -16 * s, 74 * s, 32 * s, 6 * s), { fill: '#8d939c', seed: 2421 });
  shape([[-6 * s, -22 * s], [80 * s, -22 * s], [74 * s, -14 * s], [0, -14 * s]], { fill: '#6e747d', seed: 2424 });
  shape(ell(74 * s, 0, 10 * s, 13 * s, 10), { fill: '#2b2f3a', seed: 2422 }); shape(ell(76 * s, -3 * s, 3 * s, 3 * s, 6), { fill: '#cfe7f2', line: false, seed: 2425 });
  c.restore();
  const lx = x + 30 * s + Math.cos(ang) * 76 * s, ly = y + Math.sin(ang) * 76 * s;
  shape(ell(lx, ly, 4 * s, 4 * s, 8), { fill: C.red, line: false, seed: 2423 });
}
function sirenHalo(x, y, s, t) {
  // a little police light sitting on her head, turning slowly
  shape(rrect(x - 26 * s, y - 6 * s, 52 * s, 12 * s, 4 * s), { fill: C.grey, seed: 2431 });
  const ph = (Math.sin(t * TAU * 1.3) + 1) / 2;
  shape(ell(x, y - 22 * s, 22 * s, 20 * s, 14, 0, Math.PI, TAU).concat([[x + 22 * s, y - 6 * s], [x - 22 * s, y - 6 * s]]), { fill: mix(C.red, C.blue, ph), seed: 2432 });
  glow(x, y - 20 * s, 150 * s, ph < 0.5 ? C.red : C.blue, 0.4);
  for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i - 1) * 0.6; line([[x + Math.cos(a) * 34 * s, y - 22 * s + Math.sin(a) * 30 * s], [x + Math.cos(a) * 48 * s, y - 22 * s + Math.sin(a) * 42 * s]], { w: 2.4, seed: 2435 + i }); }
}
function humLines(x0, y0, x1, y1, t, n, o = {}) {
  // the hum: wavy lines that ride from one place to another
  for (let k = 0; k < n; k++) {
    const P = [], off = (k - (n - 1) / 2) * (o.gap ?? 26), dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    for (let i = 0; i <= 30; i++) { const u = i / 30, wv = Math.sin(u * L / (o.wl ?? 22) - t * 14 + k) * (o.amp ?? 8); P.push([x0 + dx * u + nx * (off + wv), y0 + dy * u + ny * (off + wv)]); }
    line(P, { w: o.w ?? 2.2, a: o.a ?? 0.65, col: o.col, seed: (o.seed ?? 2440) + k, over: 0 });
  }
}

function bedTop(x, y, s, o = {}) {
  // a double bed seen from above: (x, y) = the middle of the headboard
  const W = 560 * s, L = 760 * s;
  shape(rrect(x - W / 2 - 20 * s, y - 30 * s, W + 40 * s, L + 50 * s, 18 * s), { fill: C.wood, seed: 2501 });
  shape(rrect(x - W / 2 - 24 * s, y - 40 * s, W + 48 * s, 60 * s, 16 * s), { fill: shade(C.wood, 0.82), seed: 2502 });
  shape(rrect(x - W / 2, y + 10 * s, W, L - 10 * s, 12 * s), { fill: '#f1ece0', seed: 2503 });
  const pil = [[x - W * 0.25, y + 90 * s], [x + W * 0.25, y + 90 * s]];
  pil.forEach(([px, py], i) => shape(rrect(px - 115 * s, py - 60 * s, 230 * s, 120 * s, 40 * s), { fill: '#fbf8f0', seed: 2504 + i }));
  return { pillows: pil, W, L, quiltTop: y + 230 * s };
}
function quilt(x, top, W, bot, s) {
  // a patchwork quilt over them, folded back at the top
  const pts = [[x - W / 2 - 6 * s, top], [x + W / 2 + 6 * s, top], [x + W / 2 + 14 * s, bot], [x - W / 2 - 14 * s, bot]];
  shape(pts, { fill: '#d98c7a', seed: 2510 });
  const cols = ['#e7b35a', '#8fae9a', '#d98c7a', '#a7b8d8', '#f1ddb0'], N = 5, M = 6;
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const x0 = x - W / 2 + i * W / N, y0 = top + 60 * s + j * (bot - top - 60 * s) / M;
    scribble([[x0 + 6, y0 + 6], [x0 + W / N - 6, y0 + 6], [x0 + W / N - 6, y0 + (bot - top - 60 * s) / M - 6], [x0 + 6, y0 + (bot - top - 60 * s) / M - 6]], cols[(i * 2 + j * 3) % 5], { gap: 7, w: 5, seed: 2520 + i * 9 + j, a: 0.8 });
  }
  shape([[x - W / 2 - 6 * s, top], [x + W / 2 + 6 * s, top], [x + W / 2 + 8 * s, top + 60 * s], [x - W / 2 - 8 * s, top + 60 * s]], { fill: '#f6efe2', seed: 2560 });
}

function seedling(x, y, s, g) {
  // a seedling: g 0..1 grows it
  if (g <= 0) return;
  const h = 70 * s * g, top = [x + Math.sin(g * 3) * 4 * s, y - h];
  line([[x, y], [x + 3 * s, y - h * 0.5], top], { w: 4 * s, col: '#4f7a3e', seed: 2601 });
  for (const sx of [-1, 1]) shape(ell(top[0] + sx * 18 * s * g, top[1] + 4 * s, 18 * s * g, 9 * s * g, 12, sx * -0.4), { fill: '#7ab55a', seed: 2602 + sx });
}
function flower(x, y, s, open = 1, o = {}) {
  line([[x, y], [x - 4 * s, y - 40 * s], [x + 2 * s, y - 80 * s]], { w: 3.4 * s, col: '#4f7a3e', seed: 2611 });
  shape(ell(x - 14 * s, y - 40 * s, 14 * s, 6 * s, 10, 0.5), { fill: '#7ab55a', seed: 2612 });
  const cx = x + 2 * s, cy = y - 84 * s;
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; shape(ell(cx + Math.cos(a) * 13 * s * open, cy + Math.sin(a) * 13 * s * open, 10 * s * open + 2, 7 * s * open + 2, 10, a), { fill: o.col || C.yellow, seed: 2613 + i }); }
  shape(ell(cx, cy, 7 * s, 7 * s, 10), { fill: '#c9791e', seed: 2620 });
}
function mound(x, y, s, o = {}) {
  shape([[x - 220 * s, y], [x - 150 * s, y - 50 * s], [x, y - 74 * s], [x + 150 * s, y - 50 * s], [x + 220 * s, y]], { fill: o.col || '#7a6146', seed: 2631, raw: false });
  for (let i = 0; i < 16; i++) { const gx = x - 190 * s + i * 25 * s; line([[gx, y - 4 * s - Math.sin(i / 15 * Math.PI) * 66 * s], [gx + 4 * s, y - 20 * s - Math.sin(i / 15 * Math.PI) * 66 * s]], { w: 2.4, col: '#5d7a4a', seed: 2632 + i, over: 0 }); }
}
function hungCoat(x, y, s, sway = 0) {
  // the yellow raincoat on a hook or a branch, empty: hood, sleeves, hem
  const c = F.art; c.save(); c.translate(x, y); c.rotate(sway);
  line([[0, 14 * s], [0, -14 * s], [-6 * s, -24 * s], [-16 * s, -26 * s], [-22 * s, -18 * s]], { w: 3.4, seed: 2641 });
  shape([[-26 * s, 18 * s], [26 * s, 18 * s], [30 * s, 26 * s], [-30 * s, 26 * s]], { fill: '#8a6647', seed: 2653 });
  shape(ell(0, 52 * s, 44 * s, 42 * s, 18), { fill: C.yellow, seed: 2642 });
  shape(ell(4 * s, 58 * s, 22 * s, 24 * s, 14), { fill: '#e2a90f', seed: 2643, w: 1.8 });
  shape([[-60 * s, 90 * s], [60 * s, 90 * s], [80 * s, 300 * s], [0, 310 * s], [-80 * s, 300 * s]], { fill: C.yellow, seed: 2644, raw: false });
  for (const sx of [-1, 1]) tube([[sx * 55 * s, 100 * s], [sx * 70 * s, 180 * s], [sx * 66 * s, 250 * s]], 40 * s, 32 * s, shade(C.yellow, 0.94), { seed: 2645 + sx });
  for (let i = 0; i < 3; i++) shape(ell(6 * s, (130 + i * 52) * s, 4 * s, 6 * s, 8), { fill: C.ink, seed: 2648 + i });
  line([[-58 * s, 210 * s], [-28 * s, 212 * s]], { w: 2, seed: 2652 });
  c.restore();
  return { pocket: rot2([-44 * s, 214 * s], sway).map((v, i) => v + [x, y][i]) };
}

function openHand(x, y, s, ang, col, o = {}) {
  // an open hand, palm toward us, fingers up (rotated by ang); o.gone(i) 0..1 dissolves finger i (4 = the palm)
  const c = F.art; c.save(); c.translate(x, y); c.rotate(ang);
  const sk = o.skin || C.skin, gone = o.gone || (() => 0);
  tube([[0, (o.sleeve ?? 130) * s], [0, 30 * s]], 92 * s, 80 * s, col, { seed: 2701 });
  const fingers = [[-36, -44, 74], [-12, -60, 88], [12, -58, 84], [34, -44, 70]];
  fingers.forEach(([fx, fy, L], i) => { const k = 1 - gone(i); if (k > 0.02) tube([[fx * s, fy * s + 30 * s], [fx * s * 1.05, fy * s + 30 * s - L * s * k]], 24 * s, 21 * s, sk, { seed: 2702 + i }); });
  if (gone(4) < 0.98) { const k = 1 - gone(4); shape(ell(0, 0, 50 * s * k, 46 * s * k, 16), { fill: sk, seed: 2710 }); tube([[-46 * s, 10 * s], [-74 * s, -26 * s]], 24 * s * k, 21 * s * k, sk, { seed: 2711 }); }
  c.restore();
}

function duck(x, y, s, o = {}) {
  // a rubber duck the size of a person, sitting on a chair
  shape(ell(x, y - 60 * s, 90 * s, 62 * s, 22), { fill: C.yellow, seed: 2801 });
  shape([[x + 70 * s, y - 70 * s], [x + 120 * s, y - 120 * s], [x + 96 * s, y - 60 * s]], { fill: C.yellow, seed: 2802 });
  shape(ell(x - 40 * s, y - 150 * s, 50 * s, 48 * s, 18), { fill: C.yellow, seed: 2803 });
  shape(ell(x - 98 * s, y - 140 * s, 26 * s, 12 * s, 12), { fill: '#e8792b', seed: 2804 });
  shape(ell(x - 54 * s, y - 162 * s, 7 * s, 8 * s, 8), { fill: C.ink, line: false, seed: 2805 });
  line(ell(x - 10 * s, y - 70 * s, 40 * s, 22 * s, 12, 0, 0.3, 2.6), { w: 2, seed: 2806 });
}
function parasol(x, y, s, spin = 0, col = C.yellow) {
  // an umbrella or a parasol: (x, y) = the handle's end in someone's hand
  const top = [x, y - 170 * s], r = 130 * s, h = 74 * s, base = top[1] + 30 * s;
  line([[x, y], [top[0], top[1] - 6 * s]], { w: 3 * s, seed: 2811 });
  line(ell(x + 10 * s, y + 4 * s, 10 * s, 10 * s, 8, 0, 0, Math.PI), { w: 3 * s, seed: 2810 });
  const P = [];
  for (let i = 0; i <= 12; i++) { const a = Math.PI + i / 12 * Math.PI; P.push([top[0] + Math.cos(a) * r, base + Math.sin(a) * h]); }
  for (let i = 8; i >= 1; i--) { const xa = top[0] - r + i * 2 * r / 8; P.push([xa, base]); P.push([xa - r / 8, base + 16 * s]); }
  shape(P, { fill: col, seed: 2812, raw: true });
  for (let i = 1; i < 8; i++) { const xa = top[0] - r + i * 2 * r / 8 + Math.sin(spin + i) * 6 * s; line([[top[0], top[1] - 4 * s], [xa, base]], { w: 1.6, a: 0.6, seed: 2813 + i, over: 0 }); }
  shape(ell(top[0], top[1] - 8 * s, 6 * s, 6 * s, 8), { fill: C.ink, seed: 2809 });
}
function bellowsCamera(x, y, s, puffAge) {
  for (const [dx, sd] of [[-50, 2821], [0, 2822], [50, 2823]]) line([[x, y - 220 * s], [x + dx * s, y]], { w: 4 * s, seed: sd });
  shape(rrect(x - 50 * s, y - 300 * s, 70 * s, 90 * s, 6 * s), { fill: '#5a4636', seed: 2824 });
  shape([[x + 20 * s, y - 290 * s], [x + 90 * s, y - 280 * s], [x + 90 * s, y - 230 * s], [x + 20 * s, y - 220 * s]], { fill: '#3d3433', seed: 2825 });
  for (let i = 1; i < 4; i++) line([[x + (20 + i * 17) * s, y - (290 - i * 2.5) * s], [x + (20 + i * 17) * s, y - (220 + i * 2.5) * s]], { w: 1.6, a: 0.6, seed: 2826 + i });
  shape(ell(x + 98 * s, y - 255 * s, 14 * s, 22 * s, 12), { fill: '#9aa2ac', seed: 2830 });
  // the flash pan: a puff of smoke, never a flash
  line([[x - 40 * s, y - 310 * s], [x - 40 * s, y - 360 * s]], { w: 3 * s, seed: 2831 });
  shape(rrect(x - 70 * s, y - 372 * s, 60 * s, 14 * s, 3 * s), { fill: C.grey, seed: 2832 });
  if (puffAge >= 0 && puffAge <= 1) for (let k = 0; k < 4; k++) puff(x - 40 * s + (k - 1.5) * 26 * s, y - 400 * s - k * 18 * s, 50 * s, puffAge * (0.85 + k * 0.05), 2840 + k * 4);
}
function chairStack(x, y, n, s, o = {}) {
  // a tower of folded chairs: thin slabs, each with its leg loop
  for (let i = 0; i < n; i++) {
    const yy = y - i * 22 * s, wob = Math.sin(i * 1.7 + (o.seed ?? 0)) * 5 * s;
    shape([[x - 60 * s + wob, yy], [x + 60 * s + wob, yy - 3 * s], [x + 58 * s + wob, yy - 20 * s], [x - 62 * s + wob, yy - 18 * s]], { fill: i % 3 ? '#8b96a3' : '#9aa0a8', seed: (o.seed ?? 2900) + i, w: 1.8 });
  }
}

function stackedChairs(x, y, n, s, seed) {
  // a tower of folding chairs, stacked one on another, leaning a little
  for (let i = 0; i < n; i++) fchair(x + Math.sin(i * 0.9 + seed) * 6 * s + i * 1.2 * s, y - i * 34 * s, s, { seed: seed + i * 13, col: i % 4 === 1 ? '#9aa0a8' : '#8b96a3' });
}

function coatPocket(ch) { const [A, B, Bl, Al] = ch.panel, s = ch.s; return [lerp(Al[0], Bl[0], 0.34) + ch.d * 4 * s, lerp(Al[1], Bl[1], 0.34) + 34 * s]; }
function drapedCoat(ch, o = {}) {
  // her yellow raincoat hung over the back of a folding chair (from fchair's result), saving the seat; returns the pocket
  const s = ch.s, d = ch.d, [A, B, Bl, Al] = ch.panel, sway = Math.sin((o.t ?? 0) * 1.3) * 2 * s;
  const lo = (P, k) => [P[0] + d * 6 * s, P[1] + k * s];
  // the coat itself, from the top rail down past the seat, its hem just touching it
  const body = [[A[0] - d * 8 * s, A[1] - 6 * s], [B[0] + d * 8 * s, B[1] - 8 * s], lo(Bl, 70), [lerp(Al[0], Bl[0], 0.5) + d * 4 * s + sway, lerp(Al[1], Bl[1], 0.5) + 84 * s], lo(Al, 78)];
  shape(body, { fill: C.yellow, seed: 3002, raw: true });
  // the collar, folded over the rail, and the opening down the front
  shape([[A[0] - d * 8 * s, A[1] - 6 * s], [B[0] + d * 8 * s, B[1] - 8 * s], [lerp(A[0], B[0], 0.62), lerp(A[1], B[1], 0.62) + 30 * s], [lerp(A[0], B[0], 0.4), lerp(A[1], B[1], 0.4) + 32 * s]], { fill: shade(C.yellow, 0.86), seed: 3003 });
  const m0 = [lerp(A[0], B[0], 0.5), lerp(A[1], B[1], 0.5) + 30 * s], m1 = [lerp(Al[0], Bl[0], 0.5) + d * 4 * s + sway, lerp(Al[1], Bl[1], 0.5) + 82 * s];
  line([m0, m1], { w: 2, seed: 3004 });
  for (let i = 0; i < 3; i++) shape(ell(lerp(m0[0], m1[0], 0.15 + i * 0.25) + d * 8 * s, lerp(m0[1], m1[1], 0.15 + i * 0.25), 3.4 * s, 4.6 * s, 8), { fill: C.ink, seed: 3005 + i });
  // the sleeve on our side hangs down limp
  tube([[A[0] - d * 2 * s, A[1] + 6 * s], [A[0] - d * 12 * s + sway, A[1] + 80 * s], [A[0] - d * 6 * s + sway * 1.5, A[1] + 150 * s]], 30 * s, 25 * s, shade(C.yellow, 0.94), { seed: 3010 });
  line(ell(A[0] - d * 6 * s + sway * 1.5, A[1] + 146 * s, 13 * s, 5 * s, 10), { closed: true, w: 1.6, seed: 3011 });
  // the pocket, with its flap
  const pk = coatPocket(ch);
  shape(rrect(pk[0] - 20 * s, pk[1] - 12 * s, 40 * s, 30 * s, 5 * s), { fill: shade(C.yellow, 0.93), seed: 3008, w: 2 });
  shape([[pk[0] - 22 * s, pk[1] - 14 * s], [pk[0] + 22 * s, pk[1] - 15 * s], [pk[0] + 20 * s, pk[1] - 4 * s], [pk[0] - 20 * s, pk[1] - 3 * s]], { fill: shade(C.yellow, 0.86), seed: 3009, w: 2 });
  return { pocket: pk, top: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], shoulder: B, sleeveTop: A };
}

function voicemailIcon(x, y, s, col = '#2c2521') {
  // the cassette mark an old phone shows for a message
  line(ell(x - 7 * s, y, 4.5 * s, 4.5 * s, 10), { closed: true, w: 2, col, seed: 3021 });
  line(ell(x + 7 * s, y, 4.5 * s, 4.5 * s, 10), { closed: true, w: 2, col, seed: 3022 });
  line([[x - 7 * s, y + 4.5 * s], [x + 7 * s, y + 4.5 * s]], { w: 2, col, seed: 3023 });
}

function pageFold(k, o = {}) {
  // the page folds in from its four corners, k 0..1; what's behind it is the dark. In screen space.
  if (k <= 0) return;
  const c = F.art, k0 = c.__k; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.__k = 1;
  const corners = [[0, 0, 1, 1], [W, 0, -1, 1], [W, H, -1, -1], [0, H, 1, -1]];
  corners.forEach(([cx, cy, sx, sy], i) => {
    const dd = k * (o.reach ?? 620) * (0.9 + 0.2 * Math.sin(i * 2.1));
    // the fold line cuts the corner at (cx + sx*dd, cy) and (cx, cy + sy*dd*0.9)
    const p1 = [cx + sx * dd, cy], p2 = [cx, cy + sy * dd * 0.9];
    shape([[cx, cy], p1, p2], { fill: VOID, line: false, raw: true, reg: 0, famp: 0.3, edge: false, seed: 3031 + i, ctx: c });
    // the flap: the corner reflected over the fold line, showing the back of the paper
    const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2, ux = p2[0] - p1[0], uy = p2[1] - p1[1], ul = Math.hypot(ux, uy) || 1;
    const nx = -uy / ul, ny = ux / ul, dist = (cx - mx) * nx + (cy - my) * ny, rc = [cx - 2 * dist * nx, cy - 2 * dist * ny];
    shape([p1, rc, p2], { fill: '#efe4cc', raw: true, seed: 3035 + i, w: 2.2, ctx: c });
    line([p1, p2], { w: 3, seed: 3039 + i, ctx: c, raw: true });
  });
  c.restore(); c.__k = k0;
}
