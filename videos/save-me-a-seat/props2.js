// props2.js: the end of the page, and what the rest of the song needs.
'use strict';

const VOID = '#1b1e2c';
function tearPts(a0, a1, at, seed, vertical) {
  // a torn line of paper, along y (vertical) or along x
  const r = mulberry(seed), pts = [];
  for (let u = a0; u <= a1; u += 16) {
    const v = at + (r() - 0.5) * 18 + Math.sin(u * 0.011 + seed) * 14 + Math.sin(u * 0.047) * 5;
    pts.push(vertical ? [v, u] : [u, v]);
  }
  return pts;
}
function voidStars(x0, y0, x1, y1, n, seed) {
  const rs = mulberry(seed);
  for (let i = 0; i < n; i++) {
    const sx = x0 + rs() * (x1 - x0), sy = y0 + rs() * (y1 - y0), big = rs() < 0.15, tw = 0.65 + 0.35 * Math.sin(BOIL * 0.6 + i * 1.7);
    shape(ell(sx, sy, (big ? 3.4 : 2) * tw, (big ? 3.4 : 2) * tw, 6), { fill: '#ffffff', line: false, edge: false, reg: 0, seed: seed + i, fa: 0.9 });
  }
}
function tornEdge(x, o = {}) {
  // the page ends at x: a strip of raw torn paper, then nothing but the dark and a few stars
  const P = tearPts(-1400, 2600, x, o.seed ?? 801, true), band = o.band ?? 16;
  shape([...P, [x + 3200, 2600], [x + 3200, -1400]], { fill: VOID, line: false, raw: true, famp: 0.5, reg: 0, edge: false, seed: 802 });
  voidStars(x + 40, -400, x + 2400, 1500, o.stars ?? 70, 806);
  const inner = P.map(([px, py], i) => [px - band * (0.7 + 0.6 * rnd01(i * 7 + 3)), py]);
  shape([...inner, ...P.slice().reverse()], { fill: '#ffffff', line: false, raw: true, famp: 0.4, reg: 0, edge: false, seed: 803 });
  line(P, { w: 1.4, raw: true, over: 0, a: 0.75, seed: 804 });
  line(inner, { w: 0.9, raw: true, over: 0, a: 0.3, seed: 805 });
  return P;
}
function tornEdgeH(y, o = {}) {
  // the same, seen from behind the chairs: the hill ends in a torn line at y, the dark is everything above it
  const P = tearPts(-1400, 3400, y, o.seed ?? 811, false), band = o.band ?? 14;
  shape([...P, [3400, -1600], [-1400, -1600]], { fill: VOID, line: false, raw: true, famp: 0.5, reg: 0, edge: false, seed: 812 });
  voidStars(-600, -500, 2600, y - 30, o.stars ?? 120, 816);
  const inner = P.map(([px, py], i) => [px, py + band * (0.7 + 0.6 * rnd01(i * 7 + 5))]);
  shape([...P, ...inner.slice().reverse()], { fill: '#ffffff', line: false, raw: true, famp: 0.4, reg: 0, edge: false, seed: 813 });
  line(P, { w: 1.4, raw: true, over: 0, a: 0.75, seed: 814 });
  return P;
}

function chairBack(x, y, s, o = {}) {
  // a folding chair seen from behind: (x, y) = floor under the seat. The rear legs run up into the backrest.
  const col = o.col || '#8b96a3', sw = 136 * s, seat = 150 * s, back = 130 * s, top = y - seat - back;
  if (!o.sat) shape([[x - sw * 0.44, y - seat], [x + sw * 0.44, y - seat], [x + sw * 0.38, y - seat - 26 * s], [x - sw * 0.38, y - seat - 26 * s]], { fill: shade(col, 1.08), seed: 1780 });
  for (const sx of [-1, 1]) line([[x + sx * sw * 0.4, y - seat + 6 * s], [x + sx * sw * 0.5, y + 2 * s]], { w: 3.4 * s, seed: 1784 + sx, a: 0.7 });
  line([[x - sw * 0.5, y - seat * 0.32], [x + sw * 0.5, y - seat * 0.32]], { w: 3 * s, a: 0.6, seed: 1786 });
  for (const sx of [-1, 1]) line([[x + sx * sw * 0.57, y], [x + sx * sw * 0.47, y - seat], [x + sx * sw * 0.45, top]], { w: 4.6 * s, seed: 1781 + sx });
  shape([[x - sw * 0.5, top + back * 0.02], [x + sw * 0.5, top + back * 0.02], [x + sw * 0.49, top + back * 0.42], [x - sw * 0.49, top + back * 0.42]], { fill: col, seed: 1787 });
  return { seat: [x, y - seat - 12 * s], top: [x, top] };
}

function chairPop(x, y, s, p, o = {}) {
  // a folded star snaps open into a folding chair; p 0..1
  if (p <= 0) return;
  if (p < 0.25) { const a = lerp(0, -1.2, p / 0.25); const c = F.art; c.save(); c.translate(x, y - 40 * s); c.rotate(a); slab(0, 0, 110 * s, 16 * s, { seed: o.seed ?? 1790 }); c.restore(); return; }
  const q = (p - 0.25) / 0.75, sq = 1 + 0.22 * Math.sin(q * Math.PI * 1.5) * Math.exp(-q * 3);
  const c = F.art; c.save(); c.translate(x, y); c.scale(2 - sq, sq); c.translate(-x, -y);
  const out = fchair(x, y, s, o); c.restore();
  if (q < 0.5) sparkle(x - 30 * s, y - 200 * s, 30 * s, { seed: (o.seed ?? 1790) + 3, col: C.gold });
  return out;
}

// the fisherman in the yellow sou'wester: from behind, he looks like someone else
HATS.souwester = (cx, cy, hr, d, view, seed, look) => {
  const col = look.hatCol || C.yellow;
  if (view === 'back') {
    shape([[cx - 1.12 * hr, cy + 0.95 * hr], [cx - 1.1 * hr, cy - 0.4 * hr], [cx - 0.6 * hr, cy - 1.12 * hr], [cx + 0.6 * hr, cy - 1.12 * hr], [cx + 1.1 * hr, cy - 0.4 * hr], [cx + 1.12 * hr, cy + 0.95 * hr], [cx, cy + 1.05 * hr]], { fill: col, seed: seed + 441, raw: false });
    line([[cx, cy - 1.1 * hr], [cx + 0.03 * hr, cy + 1.0 * hr]], { w: 2, a: 0.6, seed: seed + 442 });
    return;
  }
  const dome = ell(cx, cy - 0.3 * hr, 1.06 * hr, 0.92 * hr, 16, 0, Math.PI, TAU);
  shape([...dome, [cx + 1.06 * hr, cy - 0.26 * hr], [cx - 1.06 * hr, cy - 0.26 * hr]], { fill: col, seed: seed + 443 });
  const bk = view === 'front' ? 0 : -d;
  shape([[cx - 1.25 * hr, cy - 0.32 * hr], [cx + 1.25 * hr, cy - 0.32 * hr], [cx + (1.3 + (bk > 0 ? 0.3 : 0)) * hr, cy + (bk > 0 ? 0.55 : -0.1) * hr], [cx - (1.3 + (bk < 0 ? 0.3 : 0)) * hr, cy + (bk < 0 ? 0.55 : -0.1) * hr]], { fill: shade(col, 0.92), seed: seed + 444, raw: true });
};
LOOKS.fisherman = { top: C.yellow, coat: 'long', bottom: '#3c3b47', shoe: C.boot, boots: true, hair: 'short', hairCol: '#d6d1c8', beard: true, beardCol: '#e8e3d8', hat: 'souwester', hatCol: C.yellow };
function pipe(x, y, s, d) {
  line([[x, y], [x + d * 26 * s, y + 6 * s]], { w: 4 * s, col: '#5a3f2f', seed: 1801 });
  shape(rrect(x + d * 22 * s - 7 * s, y - 8 * s, 14 * s, 16 * s, 3 * s), { fill: '#7a5238', seed: 1802 });
  puff(x + d * 30 * s, y - 26 * s, 12 * s, ((BOIL / 12) % 1.2) / 1.2, 1803);
}

function skyDoors(x, y, w, h, open, o = {}) {
  // doors the size of the sky; (x, y) = their bottom centre; open 0..1; gold light floods out
  const light = o.light || C.gold;
  if (open > 0.01) {
    wash([[x - w / 2, y], [x - w / 2, y - h], [x + w / 2, y - h], [x + w / 2, y]], '#fff6d6', { fa: 1, seed: 821, edge: false });
    glow(x, y - h / 2, w * 1.4 * (0.5 + open), light, 0.7 * open);
    wash([[x - w / 2, y], [x + w / 2, y], [x + w * 1.6, y + 500], [x - w * 1.6, y + 500]], '#ffeeb6', { fa: 0.45 * open, edge: false, seed: 822 });
  }
  for (const sx of [-1, 1]) {
    // each leaf swings toward us: it narrows as it opens
    const hinge = x + sx * w / 2, wid = (w / 2) * Math.cos(open * 1.35), lean = Math.sin(open * 1.35) * w * 0.14;
    const pts = [[hinge, y], [hinge, y - h], [hinge - sx * wid, y - h - lean * 0.4], [hinge - sx * wid, y + lean * 0.4]];
    shape(pts, { fill: o.col || '#8b6f55', seed: 823 + sx, w: 3 });
    const kx = hinge - sx * wid * 0.85;
    shape(ell(kx, y - h * 0.48, 8, 8, 8), { fill: C.gold, seed: 825 + sx });
    for (let i = 1; i < 3; i++) line([[hinge - sx * wid * 0.12, y - h * i / 3], [hinge - sx * wid * 0.88, y - h * i / 3 - lean * 0.1]], { w: 2, a: 0.6, seed: 827 + i + sx * 3 });
  }
  line([[x - w / 2 - 20, y - h - 6], [x + w / 2 + 20, y - h - 6]], { w: 6, seed: 831 });
}

function hill(y0, o = {}) {
  // the gentle hill the chairs sit on, rising toward the far side
  const pts = [[-600, 1500], [-600, y0 + 40]];
  for (let x = -600; x <= 3600; x += 120) pts.push([x, y0 + Math.sin(x * 0.0016 + 0.4) * 34 - x * 0.012]);
  pts.push([3600, 1500]);
  shape(pts, { fill: o.col || '#d8c39c', seed: 841, raw: false, w: 2.4 });
}

function sky(o = {}) {
  wash([[-600, -500], [3600, -500], [3600, 1500], [-600, 1500]], o.top || '#35406a', { famp: 6, seed: 851, edge: false });
  wash([[-600, 250], [3600, 250], [3600, 1500], [-600, 1500]], o.low || '#6b6a92', { fa: 0.55, famp: 30, seed: 852, edge: false });
  const r = mulberry(853);
  for (let i = 0; i < (o.stars ?? 34); i++) star(-400 + r() * 3600, -300 + r() * 700, 6 + r() * 9, { seed: 854 + i, glow: 0.15 });
}

function saved(kind, x, y, s, sd) {
  // what people leave on a chair to save it
  const hr = 22 * s;
  if (kind === 'coat') { shape([[x - 30 * s, y - 70 * s], [x + 28 * s, y - 72 * s], [x + 36 * s, y + 4], [x - 38 * s, y + 6]], { fill: '#8a5a3c', seed: sd }); return; }
  if (kind === 'cane') { line([[x - 24 * s, y - 60 * s], [x + 20 * s, y + 4]], { w: 5 * s, col: '#6b4a2e', seed: sd }); line(ell(x - 24 * s, y - 70 * s, 10 * s, 10 * s, 8, 0, Math.PI * 0.2, Math.PI * 1.2), { w: 5 * s, col: '#6b4a2e', seed: sd + 1 }); return; }
  if (kind === 'club') { tube([[x - 30 * s, y - 4], [x + 34 * s, y - 16 * s]], 12 * s, 26 * s, '#8a6647', { seed: sd }); return; }
  HATS[kind](x, y + hr * 0.9, hr, 1, 'front', sd, LOOKS.guy);
}

function discoMoon(x, y, r, t, o = {}) {
  // the moon, turned into a mirror ball for the party: little square mirrors, turning
  line([[x, y - r - 900], [x, y - r]], { w: 2.2, seed: 861 });
  shape(rrect(x - r * 0.18, y - r - 14, r * 0.36, 18, 4), { fill: C.grey, seed: 860 });
  shape(ell(x, y, r, r, 28), { fill: '#9aa2b2', seed: 862, w: 2.6 });
  const rot = t * 0.7, NB = 7, NL = 14;
  for (let j = 0; j < NB; j++) {
    const p0 = -Math.PI / 2 + (j + 0.08) / NB * Math.PI, p1 = -Math.PI / 2 + (j + 0.92) / NB * Math.PI;
    for (let i = 0; i < NL; i++) {
      const t0 = rot + (i + 0.08) / NL * TAU, t1 = rot + (i + 0.92) / NL * TAU, tm = (t0 + t1) / 2;
      if (Math.cos(tm) < 0.12) continue;
      const P = (ph, th) => [x + r * 0.97 * Math.cos(ph) * Math.sin(th), y + r * 0.97 * Math.sin(ph)];
      const h = rnd01(i * 31 + j * 7 + 5), lit = Math.cos(tm) * (0.6 + 0.4 * Math.cos((p0 + p1) / 2 + 0.6));
      const col = h < 0.12 ? '#d9c8ef' : h < 0.24 ? '#c7e3f0' : mix('#8e97a8', '#f4f6fa', clamp(lit * (0.6 + h * 0.6)));
      shape([P(p0, t0), P(p0, t1), P(p1, t1), P(p1, t0)], { fill: col, line: false, edge: false, reg: 0, famp: 0.3, seed: 870 + i + j * NL });
    }
  }
  // a few mirrors catch the light, on their own beats
  const rs = mulberry(880 + Math.floor(t * 3));
  for (let i = 0; i < 4; i++) { const a = rs() * TAU, d = Math.sqrt(rs()) * r * 0.75; sparkle(x + Math.cos(a) * d * 0.8, y + Math.sin(a) * d, 12 + rs() * 8, { seed: 891 + i, col: '#ffffff', w: 2.4 }); }
  glow(x, y, r * (o.glowR ?? 3.4), '#f4ecd8', o.glow ?? 0.4);
  return [x, y];
}

function lightSpots(t, n, o = {}) {
  // the mirror ball's spots, sweeping slowly over the floor (never blinking)
  const r = mulberry(o.seed ?? 891), y0 = o.y0 ?? 800, y1 = o.y1 ?? 1100, x0 = o.x0 ?? -200, x1 = o.x1 ?? 2200, c = F.light;
  for (let i = 0; i < n; i++) {
    const bx = x0 + r() * (x1 - x0), by = y0 + r() * (y1 - y0), sp = 0.08 + r() * 0.1, rr = 60 + r() * 50;
    const px = bx + Math.sin(t * sp * TAU + i) * 260, py = by + Math.cos(t * sp * TAU * 0.7 + i) * (y1 - y0) * 0.25;
    c.save(); c.translate(px, py); c.scale(1, 0.38);
    glow(0, 0, rr, ['#ffe7a0', '#ffd0d8', '#c8e6ff'][i % 3], o.a ?? 0.32);
    c.restore();
  }
}

function balance(x, y, s, tilt, left, right) {
  // a kitchen-table balance: tilt > 0 drops the left pan
  line([[x, y], [x, y - 220 * s]], { w: 7 * s, seed: 901 });
  shape([[x - 70 * s, y], [x + 70 * s, y], [x + 40 * s, y - 24 * s], [x - 40 * s, y - 24 * s]], { fill: '#b8925a', seed: 902 });
  const top = [x, y - 220 * s], L = 200 * s, a = tilt * 0.32;
  const le = [top[0] - Math.cos(a) * L, top[1] + Math.sin(a) * L], re = [top[0] + Math.cos(a) * L, top[1] - Math.sin(a) * L];
  line([le, re], { w: 8 * s, seed: 903 });
  shape(ell(top[0], top[1], 12 * s, 12 * s, 10), { fill: C.gold, seed: 904 });
  for (const [e, fn, sd] of [[le, left, 905], [re, right, 909]]) {
    const pan = [e[0], e[1] + 120 * s];
    line([e, [pan[0] - 60 * s, pan[1]]], { w: 1.6, seed: sd }); line([e, [pan[0] + 60 * s, pan[1]]], { w: 1.6, seed: sd + 1 });
    shape(ell(pan[0], pan[1] + 6 * s, 76 * s, 18 * s, 18, 0, 0, Math.PI), { fill: '#c9a05e', seed: sd + 2 });
    if (fn) fn(pan[0], pan[1], s);
  }
}

function tinySign(x, y, s) {
  line([[x + 10 * s, y], [x + 10 * s, y - 90 * s]], { w: 4 * s, col: '#8a6647', seed: 921 });
  shape([[x - 30 * s, y - 120 * s], [x + 50 * s, y - 122 * s], [x + 48 * s, y - 70 * s], [x - 28 * s, y - 72 * s]], { fill: C.cream, seed: 922 });
}
function tinyHood(x, y, s) {
  shape([[x - 22 * s, y], [x - 26 * s, y - 40 * s], [x - 12 * s, y - 62 * s], [x + 12 * s, y - 62 * s], [x + 26 * s, y - 40 * s], [x + 22 * s, y]], { fill: C.yellow, seed: 923, raw: false });
  shape(ell(x, y - 42 * s, 10 * s, 12 * s, 10), { fill: '#3b302c', seed: 924 });
}
function tinyHouse(x, y, s, o = {}) {
  shape([[x - 40 * s, y], [x - 40 * s, y - 56 * s], [x + 40 * s, y - 56 * s], [x + 40 * s, y]], { fill: '#e2c9a2', seed: 925 });
  shape([[x - 50 * s, y - 54 * s], [x, y - 100 * s], [x + 50 * s, y - 54 * s]], { fill: '#b44a3a', seed: 926 });
  shape(rrect(x - 10 * s, y - 30 * s, 20 * s, 30 * s, 3 * s), { fill: '#7a5a3c', seed: 927 });
  shape(rrect(x + 16 * s, y - 46 * s, 16 * s, 14 * s, 2 * s), { fill: o.lit === false ? '#5a6075' : C.gold, seed: 928 });
  if (o.heart !== false) pictogram('heart', x, y - 125 * s, 0.9 * s, 929);
}

function flipbook(x, y, s, t, page) {
  // two hands riffle a little flip-book; page(i, x, y, s) draws page i
  const w = 300 * s, h = 210 * s, i = Math.floor(t * DRAW_FPS * 2);
  shape([[x - w / 2, y], [x - w / 2, y - h], [x + w / 2, y - h], [x + w / 2, y]], { fill: '#f6efdd', seed: 941 });
  for (let k = 0; k < 4; k++) line([[x - w / 2 + 4, y + 4 + k * 4], [x + w / 2 - 4 + k * 2, y + 4 + k * 4]], { w: 1.4, seed: 942 + k, over: 0, a: 0.6 });
  page(i, x, y - h / 2, s);
  // the page lifting at the corner
  const c = (i % 2) ? 0.13 : 0.24;
  shape([[x + w / 2, y - h], [x + w / 2 - c * w, y - h], [x + w / 2 - c * w * 0.4, y - h * (1 - c)], [x + w / 2, y - h * (1 - c * 0.9)]], { fill: '#ece2c8', seed: 946 + (i % 2) });
  for (let k = 0; k < 3; k++) line(ell(x + w / 2 + 6, y - h - 6, (40 + k * 22) * s, (30 + k * 16) * s, 10, 0, -Math.PI * 0.95, -Math.PI * 0.55), { w: 2, a: 0.55, seed: 948 + k, over: 0 });
  // hands
  for (const sx of [-1, 1]) {
    const hx = x + sx * (w / 2 + 6), hy = y - h * 0.25;
    tube([[hx + sx * 220 * s, hy + 260 * s], [hx + sx * 90 * s, hy + 90 * s], [hx + sx * 10 * s, hy + 10 * s]], 70 * s, 58 * s, C.narr, { seed: 950 + sx });
    shape(ell(hx, hy, 30 * s, 26 * s, 12), { fill: C.skin, seed: 952 + sx });
    shape(ell(hx - sx * 26 * s, hy - 18 * s, 16 * s, 11 * s, 10, -0.5 * sx), { fill: C.skin, seed: 954 + sx });
  }
}

function serverRack(x, y, w, h, t, o = {}) {
  shape([[x, y], [x, y - h], [x + w, y - h], [x + w, y]], { fill: o.col || '#4a5068', seed: o.seed ?? 961 });
  const r = mulberry(o.seed ?? 961);
  for (let yy = y - h + 18; yy < y - 14; yy += 22) {
    line([[x + 10, yy + 10], [x + w - 10, yy + 10]], { w: 1.4, a: 0.5, seed: 962 + yy, over: 0 });
    for (let k = 0; k < 3; k++) { const on = Math.sin(t * (2 + r() * 5) + r() * 9) > 0.2; shape(ell(x + w - 20 - k * 14, yy + 2, 3.4, 3.4, 6), { fill: on ? (k === 0 ? '#7be08a' : '#ffd36a') : '#3a3f52', line: false, seed: 963 + yy + k }); }
  }
}

function bed(x, y, s, o = {}) {
  // a bed from the side, quilt up; (x, y) = floor under its foot
  const L = 520 * s;
  shape([[x - L, y - 140 * s], [x - L, y - 330 * s], [x - L + 26 * s, y - 330 * s], [x - L + 26 * s, y]], { fill: C.wood, seed: 971 });
  shape([[x, y - 120 * s], [x, y - 220 * s], [x + 22 * s, y - 220 * s], [x + 22 * s, y]], { fill: C.wood, seed: 972 });
  shape([[x - L + 20 * s, y - 120 * s], [x + 10 * s, y - 120 * s], [x + 10 * s, y - 70 * s], [x - L + 20 * s, y - 70 * s]], { fill: '#e8e0cc', seed: 973 });
  shape(ell(x - L + 110 * s, y - 150 * s, 90 * s, 40 * s, 14), { fill: '#f7f2e6', seed: 974 });
  return { pillow: [x - L + 110 * s, y - 150 * s], top: y - 120 * s, L };
}

function fchairGeom(x, y, s, d = 1) {
  // where a folding chair's corners are (fchair draws it; drapedCoat and the camera need it too)
  const Hs = 150 * s, Hb = 135 * s, sy = y - Hs, f = [d * 82 * s, 20 * s], w = [d * 52 * s, -32 * s], add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
  const C0 = [x, sy], NR = add(add(C0, f, -0.5), w, -0.5), NF = add(add(C0, f, 0.5), w, -0.5), FF = add(add(C0, f, 0.5), w, 0.5), FR = add(add(C0, f, -0.5), w, 0.5);
  const top = p => [p[0] - d * 12 * s, p[1] - Hb], pt = (P, t) => [lerp(P[0], top(P)[0], t), lerp(P[1], top(P)[1], t)];
  return { Hs, Hb, sy, f, w, add, NR, NF, FF, FR, top, pt, panel: [pt(NR, 0.96), pt(FR, 0.96), pt(FR, 0.56), pt(NR, 0.56)], s, d };
}

function fchair(x, y, s, o = {}) {
  // a folding chair in three-quarter view, facing right (dir 1) and a little toward us; (x, y) = floor under the seat
  const d = o.dir ?? 1, col = o.col || '#8b96a3', G = fchairGeom(x, y, s, d), { Hs, Hb, sy, NR, NF, FF, FR, add, top } = G;
  const floor = p => [p[0], p[1] + Hs];
  const legs = (Rr, Fr, far) => {
    const a = far ? 0.55 : 0.95, ww = (far ? 3.4 : 4.2) * s;
    line([[Rr[0] + d * 4 * s, Rr[1] + 8 * s], add(floor(Fr), [d * 8 * s, 0])], { w: ww, a, seed: (o.seed ?? 1820) + (far ? 1 : 3) });
    line([Rr, add(floor(Rr), [-d * 12 * s, 0])], { w: ww, a, seed: (o.seed ?? 1820) + (far ? 2 : 4) });
    line([[Fr[0] - d * 4 * s, Fr[1] + 8 * s], add(floor(Rr), [d * 14 * s, 0])], { w: ww * 0.9, a, seed: (o.seed ?? 1820) + (far ? 5 : 6) });
  };
  legs(FR, FF, true);
  line([FR, top(FR)], { w: 3.6 * s, a: 0.7, seed: (o.seed ?? 1820) + 7 });
  const pt = G.pt;
  shape([pt(NR, 0.96), pt(FR, 0.96), pt(FR, 0.56), pt(NR, 0.56)], { fill: col, seed: (o.seed ?? 1820) + 8 });
  shape([NR, NF, FF, FR], { fill: shade(col, 1.12), seed: (o.seed ?? 1820) + 9 });
  shape([NR, NF, add(NF, [0, 9 * s]), add(NR, [0, 9 * s])], { fill: shade(col, 0.82), seed: (o.seed ?? 1820) + 10, w: 2 });
  shape([NF, FF, add(FF, [0, 9 * s]), add(NF, [0, 9 * s])], { fill: shade(col, 0.9), seed: (o.seed ?? 1820) + 11, w: 2 });
  legs(NR, NF, false);
  line([add(NR, [0, 9 * s]), top(NR)], { w: 4.4 * s, seed: (o.seed ?? 1820) + 12 });
  return { seat: [x, sy - 2 * s], back: pt(NR, 0.96), backFar: pt(FR, 0.96), panel: [pt(NR, 0.96), pt(FR, 0.96), pt(FR, 0.56), pt(NR, 0.56)], NR, NF, FF, FR, rear: [x - d * 30 * s, sy], s, d };
}
