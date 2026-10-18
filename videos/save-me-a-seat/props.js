// props.js: things in the world, drawn the same way as the cast.
'use strict';

function machine(x, y, s, st = {}) {
  // an old cassette answering machine; (x, y) = middle of its bottom edge
  const w = 330 * s, h = 120 * s, top = 52 * s, r = 14 * s, X = x - w / 2, Y = y - h;
  // top face, in a little perspective
  shape([[X + 18 * s, Y - top], [X + w - 18 * s, Y - top], [X + w, Y], [X, Y]], { fill: shade(C.beige, 1.06), seed: 201 });
  shape(rrect(X, Y, w, h, r), { fill: C.beige, seed: 202 });
  // cassette window and its reels
  const wx = X + 26 * s, wy = Y + 22 * s, ww = 150 * s, wh = 74 * s;
  shape(rrect(wx, wy, ww, wh, 10 * s), { fill: '#4b4440', seed: 203 });
  const ang = st.reel || 0;
  for (const [i, cx, rr] of [[0, wx + 42 * s, (st.left ?? 1) * 22 * s + 8 * s], [1, wx + ww - 42 * s, (st.right ?? 1) * 22 * s + 8 * s]]) {
    shape(ell(cx, wy + wh / 2, rr, rr, 16), { fill: '#7b5b45', seed: 204 + i, w: 1.8 });
    shape(ell(cx, wy + wh / 2, 9 * s, 9 * s, 10), { fill: C.cream, seed: 206 + i, w: 1.8 });
    for (let k = 0; k < 3; k++) {
      const a = ang + k * TAU / 3;
      line([[cx + Math.cos(a) * 3 * s, wy + wh / 2 + Math.sin(a) * 3 * s], [cx + Math.cos(a) * 8 * s, wy + wh / 2 + Math.sin(a) * 8 * s]], { w: 2, seed: 208 + i * 3 + k, over: 0 });
    }
  }
  line([[wx + 42 * s, wy + wh / 2 + 30 * s], [wx + ww - 42 * s, wy + wh / 2 + 30 * s]], { w: 3, col: '#5b4030', seed: 214, over: 0 });
  // speaker grille
  const gx = X + w - 128 * s;
  for (let i = 0; i < 5; i++) line([[gx, Y + (28 + i * 14) * s], [gx + 96 * s, Y + (28 + i * 14) * s]], { w: 3.2, seed: 215 + i });
  // buttons on top: rewind, play (goes down when pressed), stop
  const press = st.play ?? 0;
  const bx = X + 40 * s, by = Y - top * 0.55;
  [['rew', C.warm], ['play', C.cream], ['stop', C.warm]].forEach(([nm, col], i) => {
    const down = nm === 'play' ? press * 5 * s : nm === 'stop' ? (st.stopPress ?? 0) * 5 * s : 0;
    const px = bx + i * 70 * s, py = by + down;
    shape(rrect(px, py - 12 * s, 56 * s, 22 * s, 6 * s), { fill: down ? shade(col, 0.9) : col, seed: 220 + i, w: 2 });
    const cx = px + 28 * s, cy = py - 1 * s;
    if (nm === 'play') shape([[cx - 6 * s, cy - 7 * s], [cx + 8 * s, cy], [cx - 6 * s, cy + 7 * s]], { fill: C.ink, line: false, seed: 224 });
    if (nm === 'stop') shape(rrect(cx - 6 * s, cy - 6 * s, 12 * s, 12 * s, 2 * s), { fill: C.ink, line: false, seed: 225 });
    if (nm === 'rew') for (const o of [-6, 4]) shape([[cx + (o + 6) * s, cy - 6 * s], [cx + o * s, cy], [cx + (o + 6) * s, cy + 6 * s]], { fill: C.ink, line: false, seed: 226 + o });
  });
  // the new-message light and its counter
  const lx = X + w - 52 * s, ly = Y - top * 0.5;
  shape(ell(lx, ly, 9 * s, 7 * s, 10), { fill: st.led ? C.red : '#7a4a44', seed: 229, w: 1.8 });
  if (st.led) glow(lx, ly, 40 * s, C.red, 0.55 * st.led);
  // cord to the wall
  line([[X + w, Y + h * 0.7], [X + w + 40 * s, Y + h * 0.9], [X + w + 60 * s, Y + h + 10 * s]], { w: 2.4, seed: 230 });
  return { speaker: [gx + 48 * s, Y + 56 * s], X, Y, w, h };
}

function chair(x, y, s, o = {}) {
  // a folding chair in three-quarter view; (x, y) = floor under the seat's middle
  const col = o.col || '#8b96a3', seat = 150 * s, sw = 120 * s, back = 140 * s, d = o.dir ?? 1;
  const sy = y - seat, f = o.fold ?? 0;
  // legs: a cross pair, front and back
  for (const [dx, sd] of [[-sw * 0.48, 241], [sw * 0.48, 243]]) {
    line([[x + dx - 6 * s * d, sy], [x + dx + 14 * s * d, y]], { w: 4 * s, seed: sd });
    line([[x + dx + 18 * s * d, sy - 6 * s], [x + dx - 12 * s * d, y]], { w: 4 * s, seed: sd + 1 });
  }
  // backrest uprights and panel
  const bx = x - d * 34 * s;
  for (const dx of [-sw * 0.48, sw * 0.48]) line([[bx + dx, sy + 4 * s], [bx + dx - d * 8 * s, sy - back]], { w: 4.2 * s, seed: 247 + (dx > 0) });
  shape([[bx - sw * 0.5 - d * 6 * s, sy - back * 0.98], [bx + sw * 0.5 - d * 6 * s, sy - back * 0.98], [bx + sw * 0.5 - d * 4 * s, sy - back * 0.66], [bx - sw * 0.5 - d * 4 * s, sy - back * 0.66]], { fill: col, seed: 249 });
  // seat
  shape([[x - sw * 0.55, sy], [x + sw * 0.55, sy], [x + sw * 0.5 + d * 22 * s, sy + 14 * s], [x - sw * 0.6 + d * 22 * s, sy + 14 * s]], { fill: shade(col, 1.08), seed: 251 });
  return { seat: [x + d * 10 * s, sy + 2 * s], back: [bx, sy - back] };
}

function star(x, y, r, o = {}) {
  // five points; fold = 0..1 folds it flat like a chair
  const f = smooth(o.fold ?? 0), sy = lerp(1, 0.16, f), rr = r * lerp(1, 1.15, f);
  let pts = starPts(0, 0, rr, rr * 0.45).map(([px, py]) => [px, py * sy]);
  pts = pts.map(p => rot2(p, (o.rot ?? 0) + f * 0.25)).map(([px, py]) => [px + x, py + y]);
  shape(pts, { fill: o.col || C.star, seed: o.seed ?? 261, w: o.w ?? 2.4 });
  if (o.glow) glow(x, y, r * 2.6, C.gold, o.glow);
}

function slab(x, y, w, h, o = {}) {
  // a folded star, flat, as stacked
  shape([[x - w / 2, y - h / 2], [x + w / 2, y - h / 2 + 2], [x + w / 2 - 3, y + h / 2], [x - w / 2 + 2, y + h / 2 - 1]], { fill: o.col || C.star, seed: o.seed ?? 271, w: 2.2 });
}

function ladder(x, y, h, s, o = {}) {
  const w = 60 * s;
  line([[x - w / 2, y], [x - w / 2 + 10 * s, y - h]], { w: 4 * s, seed: (o.seed ?? 281) });
  line([[x + w / 2, y], [x + w / 2 - 10 * s, y - h]], { w: 4 * s, seed: (o.seed ?? 281) + 1 });
  for (let i = 1; i * 34 * s < h; i++) { const t = i * 34 * s / h; line([[x - w / 2 + 10 * s * t, y - h * t], [x + w / 2 - 10 * s * t, y - h * t]], { w: 3 * s, seed: (o.seed ?? 281) + 2 + i }); }
  if (o.wheels) for (const dx of [-w / 2, w / 2]) shape(ell(x + dx, y + 6 * s, 9 * s, 9 * s, 10), { fill: C.dark, seed: (o.seed ?? 281) + 40 + dx });
}

function dolly(x, y, s, o = {}) {
  // a hand truck: (x, y) = where its nose plate meets the floor
  const h = 260 * s;
  line([[x, y], [x - 30 * s, y - h]], { w: 5 * s, seed: 291 }); line([[x + 50 * s, y], [x + 20 * s, y - h]], { w: 5 * s, seed: 292 });
  line([[x - 30 * s, y - h], [x - 50 * s, y - h - 30 * s]], { w: 5 * s, seed: 293 });
  shape([[x - 10 * s, y - 8 * s], [x + 90 * s, y - 8 * s], [x + 90 * s, y + 4 * s], [x - 10 * s, y + 4 * s]], { fill: C.grey, seed: 294 });
  shape(ell(x + 10 * s, y + 6 * s, 18 * s, 18 * s, 12), { fill: C.dark, seed: 295 });
}

function bulbMoon(x, y, r, o = {}) {
  // the moon is a pull-chain bulb; o.lit 0..1 dims it
  const lit = o.lit ?? 1;
  line([[x, y - r - 600], [x, y - r - 6]], { w: 2.4, seed: 301 });
  shape(rrect(x - r * 0.32, y - r - 26, r * 0.64, 30, 6), { fill: C.grey, seed: 302 });
  shape(ell(x, y, r, r * 1.02, 26), { fill: mix(C.night2, '#fff3c4', lit), seed: 303 });
  for (const [dx, dy, cr] of [[-0.3, -0.2, 0.18], [0.25, 0.15, 0.12], [-0.05, 0.4, 0.09]])
    shape(ell(x + dx * r, y + dy * r, cr * r, cr * r, 12), { fill: mix(C.night2, '#e9d9a6', lit), seed: 304 + dx * 10, w: 1.6, a: 0.6 });
  if (lit > 0.05) glow(x, y, r * 3.2, '#ffe9a8', 0.6 * lit);
  // the pull chain, swinging
  const sw = o.swing ?? 0, cl = o.chain ?? 240, end = [x + Math.sin(sw) * cl, y + r + Math.cos(sw) * cl];
  const pts = []; for (let i = 0; i <= 12; i++) pts.push([lerp(x, end[0], i / 12) + Math.sin(i * 1.3) * 1.5, lerp(y + r, end[1], i / 12)]);
  line(pts, { w: 1.8, seed: 310, over: 0 });
  shape(ell(end[0], end[1] + 6, 6, 9, 8), { fill: C.grey, seed: 311 });
  return end;
}

function buildings(x0, x1, base, o = {}) {
  // rooftops with windows; o.on(i) gives each window's light 0..1
  const r = mulberry(o.seed ?? 321), out = [];
  for (let x = x0, i = 0; x < x1; i++) {
    const w = 110 + r() * 140, h = 120 + r() * 260, col = mix(C.night, '#4a5577', r() * 0.6);
    shape([[x, base], [x, base - h], [x + w, base - h], [x + w, base]], { fill: col, seed: 330 + i, w: 2.2 });
    if (r() < 0.5) line([[x + w * 0.7, base - h], [x + w * 0.7, base - h - 30], [x + w * 0.62, base - h - 30]], { w: 2, seed: 360 + i });
    for (let wy = base - h + 26; wy < base - 30; wy += 48) for (let wx = x + 18; wx < x + w - 30; wx += 40) {
      const id = out.length, lit = o.on ? o.on(id, wx, wy) : 1;
      out.push([wx, wy]);
      shape(rrect(wx, wy, 20, 26, 3), { fill: mix('#2c3550', C.gold, lit), seed: 400 + id, w: 1.6, line: lit > 0.3 });
    }
    x += w + 6 + r() * 20;
  }
  return out;
}

function vitrine(x, y, w, h, contents, o = {}) {
  // a museum case on a plinth: (x, y) = the plinth's floor centre
  const ph = o.plinth ?? 220;
  shape([[x - w * 0.55, y], [x - w * 0.55, y - ph], [x + w * 0.55, y - ph], [x + w * 0.55, y]], { fill: o.plinthCol || '#e7dfcf', seed: (o.seed ?? 501) });
  shape([[x - w * 0.62, y - ph], [x - w * 0.55, y - ph - 14], [x + w * 0.55, y - ph - 14], [x + w * 0.62, y - ph]], { fill: '#d6ccb8', seed: (o.seed ?? 501) + 1 });
  if (contents) contents(x, y - ph - 14);
  const gy = y - ph - 14;
  wash([[x - w / 2, gy], [x - w / 2, gy - h], [x + w / 2, gy - h], [x + w / 2, gy]], C.glass, { fa: 0.28, seed: (o.seed ?? 501) + 2 });
  line([[x - w / 2, gy], [x - w / 2, gy - h], [x + w / 2, gy - h], [x + w / 2, gy]], { w: 2.2, seed: (o.seed ?? 501) + 3, raw: true });
  for (let i = 0; i < 2; i++) line([[x - w * 0.32 + i * 30, gy - h * 0.25], [x - w * 0.14 + i * 30, gy - h * 0.7]], { w: 2, a: 0.45, seed: (o.seed ?? 501) + 4 + i, col: '#ffffff' });
  return [x, gy];
}

function placard(x, y, s, glyphs) {
  shape(rrect(x - 60 * s, y - 30 * s, 120 * s, 60 * s, 4 * s), { fill: C.cream, seed: 521, w: 2 });
  glyphs.forEach((g, i) => glyph(g, x - 40 * s + i * 27 * s, y, 9 * s, 522 + i));
}
function glyph(kind, x, y, r, sd) {
  // hieroglyph-ish marks: an eye, a bird, water, a reed, an ankh
  const L = (pts, o = {}) => line(pts, { w: 1.6, seed: sd + (o.k ?? 0), over: 0 });
  if (kind === 'eye') { L(ell(x, y, r, r * 0.5, 10), { k: 1 }); shape(ell(x, y, r * 0.3, r * 0.3, 6), { fill: C.ink, line: false, seed: sd + 2 }); L([[x - r * 0.2, y + r * 0.5], [x - r * 0.5, y + r * 1.1]], { k: 3 }); }
  if (kind === 'bird') { L([[x - r, y + r], [x - r * 0.3, y - r * 0.2], [x + r * 0.5, y - r * 0.5], [x + r, y - r * 0.2], [x + r * 0.4, y + r * 0.2], [x + r * 0.6, y + r]], { k: 4 }); }
  if (kind === 'water') { for (let j = 0; j < 2; j++) { const pts = []; for (let i = 0; i <= 8; i++) pts.push([x - r + i * r / 4, y - r * 0.4 + j * r * 0.8 + (i % 2 ? -r * 0.25 : r * 0.25)]); L(pts, { k: 5 + j }); } }
  if (kind === 'ankh') { L(ell(x, y - r * 0.5, r * 0.4, r * 0.5, 10), { k: 7 }); L([[x, y], [x, y + r * 1.2]], { k: 8 }); L([[x - r * 0.6, y + r * 0.2], [x + r * 0.6, y + r * 0.2]], { k: 9 }); }
  if (kind === 'reed') { L([[x, y + r], [x, y - r]], { k: 10 }); L([[x, y - r * 0.4], [x + r * 0.6, y - r]], { k: 11 }); }
  if (kind === 'wedge') { for (let i = 0; i < 3; i++) shape([[x - r * 0.5 + i * r * 0.5, y - r * 0.6], [x - r * 0.2 + i * r * 0.5, y - r * 0.6], [x - r * 0.35 + i * r * 0.5, y + r * 0.6]], { fill: C.ink, line: false, seed: sd + 12 + i }); }
}

function phone(x, y, s, ang, o = {}) {
  // a phone held in a hand at (x, y)
  const w = 22 * s, h = 40 * s;
  const pts = rrect(-w / 2, -h / 2, w, h, 5 * s).map(p => rot2(p, ang)).map(([px, py]) => [px + x, py + y]);
  shape(pts, { fill: o.col || '#3d3a3f', seed: o.seed ?? 541, w: 2 });
  if (o.lit) { const sc = rrect(-w / 2 + 3 * s, -h / 2 + 4 * s, w - 6 * s, h - 9 * s, 3 * s).map(p => rot2(p, ang)).map(([px, py]) => [px + x, py + y]);
    shape(sc, { fill: '#cfe7f2', line: false, seed: (o.seed ?? 541) + 1 }); glow(x, y, 60 * s, '#bfe3ff', 0.5 * o.lit); }
}

function puff(x, y, r, age, sd = 551) {
  // a breath cloud: grows and fades over age 0..1
  if (age < 0 || age > 1) return;
  const rr = r * (0.5 + age * 0.9), a = (1 - age) * 0.8;
  for (let i = 0; i < 3; i++) shape(ell(x + (i - 1) * rr * 0.55 + age * 14, y - age * 18 - (i === 1 ? rr * 0.25 : 0), rr * 0.55, rr * 0.45, 12), { fill: '#eef3f6', fa: a, seed: sd + i, w: 1.6, a: a * 0.9 });
}

function rain(x0, y0, x1, y1, t, o = {}) {
  // falling streaks, slanted; drawn per drawing so they jump like hand-drawn rain
  const n = o.n ?? 90, r = mulberry(o.seed ?? 561), sl = o.slant ?? 0.25, sp = o.speed ?? 900;
  for (let i = 0; i < n; i++) {
    const bx = x0 + r() * (x1 - x0), by = r() * (y1 - y0), l = 20 + r() * 26;
    const yy = y0 + ((by + t * sp * (0.8 + r() * 0.4)) % (y1 - y0)), xx = bx + (yy - y0) * sl;
    line([[xx, yy], [xx + l * sl, yy + l]], { w: 1.6, a: 0.55, seed: 600 + i, col: o.col || '#5a6f8f', over: 0, taper: 6 });
  }
}

function splash(x, y, age, sd = 571) {
  if (age < 0 || age > 1) return;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI * (0.15 + i * 0.17), d = 10 + age * 26;
    line([[x + Math.cos(a) * d * 0.4, y + Math.sin(a) * d * 0.4], [x + Math.cos(a) * d, y + Math.sin(a) * d]], { w: 1.8, a: 1 - age, seed: sd + i, col: '#6d86a8' });
  }
}

function policeCar(x, y, s, t, o = {}) {
  // a little cartoon police car; its light turns red/blue slowly (no strobe)
  shape([[x - 110 * s, y - 20 * s], [x - 100 * s, y - 56 * s], [x - 50 * s, y - 60 * s], [x - 26 * s, y - 92 * s], [x + 44 * s, y - 92 * s], [x + 70 * s, y - 60 * s], [x + 112 * s, y - 52 * s], [x + 116 * s, y - 20 * s]], { fill: '#e9e6e0', seed: 581 });
  shape([[x - 18 * s, y - 84 * s], [x + 38 * s, y - 84 * s], [x + 58 * s, y - 60 * s], [x - 40 * s, y - 60 * s]], { fill: '#4e5d75', seed: 582 });
  line([[x - 110 * s, y - 40 * s], [x + 116 * s, y - 40 * s]], { w: 6 * s, col: '#3a4a7a', seed: 583 });
  for (const dx of [-62, 70]) shape(ell(x + dx * s, y - 14 * s, 20 * s, 20 * s, 12), { fill: C.dark, seed: 584 + dx });
  const ph = (Math.sin(t * TAU * 1.5) + 1) / 2;
  shape(rrect(x - 6 * s, y - 106 * s, 26 * s, 14 * s, 4 * s), { fill: mix(C.red, C.blue, ph), seed: 586 });
  glow(x + 7 * s, y - 100 * s, 220 * s, ph < 0.5 ? C.red : C.blue, 0.45 * (o.glow ?? 1));
}

function fence(x0, x1, base, h, o = {}) {
  // a chain-link fence: posts, a top rail, diamond mesh
  const posts = []; for (let x = x0; x <= x1; x += o.gap ?? 260) posts.push(x);
  wash([[x0, base], [x0, base - h], [x1, base - h], [x1, base]], '#8d97a1', { fa: 0.12, seed: 591 });
  const step = o.mesh ?? 26;
  for (let x = x0 - h; x < x1; x += step) {
    line([[Math.max(x0, x), base - Math.max(0, x0 - x)], [Math.min(x1, x + h), base - h + Math.max(0, x + h - x1)]], { w: 1.3, a: 0.55, seed: 592 + x, over: 0, col: '#4e5660' });
    line([[Math.max(x0, x), base - h + Math.max(0, x0 - x)], [Math.min(x1, x + h), base - Math.max(0, x + h - x1)]], { w: 1.3, a: 0.55, seed: 2592 + x, over: 0, col: '#4e5660' });
  }
  line([[x0, base - h], [x1, base - h]], { w: 4, seed: 593 });
  for (const x of posts) line([[x, base + 4], [x, base - h - 10]], { w: 5, seed: 594 + x });
}

// little doodles that float out of the machine's speaker with her words
function pictogram(kind, x, y, s, sd) {
  const L = (pts, o = {}) => line(pts, { w: 2.4, seed: sd + (o.k ?? 0), over: 0, ...o });
  if (kind === 'wave') for (let i = 0; i < 3; i++) L(ell(x, y, (10 + i * 9) * s, (10 + i * 9) * s, 10, 0, -0.7, 0.7), { k: i });
  if (kind === 'handset') {
    const pts = [[x - 18 * s, y - 6 * s], [x - 12 * s, y - 14 * s], [x + 12 * s, y - 14 * s], [x + 18 * s, y - 6 * s], [x + 10 * s, y - 2 * s], [x + 6 * s, y - 8 * s], [x - 6 * s, y - 8 * s], [x - 10 * s, y - 2 * s]];
    shape(pts, { fill: C.red, seed: sd + 3, w: 2.2 });
    for (let i = 0; i < 2; i++) L(ell(x, y - 26 * s, (8 + i * 7) * s, (6 + i * 5) * s, 10, 0, -Math.PI * 0.85, -Math.PI * 0.15), { k: 4 + i });
  }
  if (kind === 'snake') {
    // the basilisk: a wiggly snake in a tiny crown
    const pts = []; for (let i = 0; i <= 14; i++) pts.push([x - 26 * s + i * 4 * s, y + Math.sin(i * 0.9) * 7 * s]);
    L(pts, { w: 4.5 * s, k: 6 });
    shape(ell(x + 33 * s, y + Math.sin(14 * 0.9) * 7 * s - 2 * s, 7 * s, 5.5 * s, 10), { fill: '#6f8f5a', seed: sd + 7, w: 2 });
    shape([[x + 28 * s, y - 6 * s], [x + 30 * s, y - 14 * s], [x + 33 * s, y - 9 * s], [x + 36 * s, y - 15 * s], [x + 38 * s, y - 6 * s]], { fill: C.gold, seed: sd + 8, w: 1.8 });
    shape(ell(x + 35 * s, y - 3 * s, 1.3 * s, 1.3 * s, 6), { fill: C.red, line: false, seed: sd + 9 });
  }
  if (kind === 'bang') { L([[x, y - 18 * s], [x, y + 4 * s]], { k: 10, w: 3.4 }); shape(ell(x, y + 12 * s, 2.6 * s, 2.6 * s, 8), { fill: C.ink, line: false, seed: sd + 11 }); }
  if (kind === 'heart') {
    const pts = []; for (let i = 0; i < 24; i++) { const t = i / 24 * TAU; pts.push([x + 16 * s * Math.pow(Math.sin(t), 3) * 0.9, y - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * s * 0.9]); }
    shape(pts, { fill: '#e46a6a', seed: sd + 12, w: 2.2 });
  }
  if (kind === 'dots') for (let i = 0; i < 3; i++) shape(ell(x - 12 * s + i * 12 * s, y, 2.8 * s, 2.8 * s, 6), { fill: C.ink, line: false, seed: sd + 14 + i });
}
