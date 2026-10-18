// cast2.js: the guests from every era. Costumes, hats, beards, dance and sitting poses, and a T. rex.
'use strict';

const HATS = {
  party(cx, cy, hr, d, view, seed, look) {
    const tip = [cx + 0.18 * hr * (view === 'front' ? 0.4 : d), cy - 2.0 * hr];
    shape([[cx - 0.48 * hr, cy - 0.78 * hr], tip, [cx + 0.48 * hr, cy - 0.78 * hr]], { fill: look.hatCol || C.red, seed: seed + 301 });
    for (let i = 1; i < 3; i++) { const t = i / 3; line([[lerp(cx - 0.48 * hr, tip[0], t) - 2, lerp(cy - 0.78 * hr, tip[1], t)], [lerp(cx + 0.48 * hr, tip[0], t) + 2, lerp(cy - 0.78 * hr, tip[1], t)]], { w: 3, col: C.cream, seed: seed + 302 + i, over: 0 }); }
    shape(ell(tip[0], tip[1], 0.16 * hr, 0.16 * hr, 10), { fill: C.gold, seed: seed + 305 });
  },
  nemes(cx, cy, hr, d, view, seed, look) {
    // the striped headdress: a band over the brow and lappets down beside the face
    if (view === 'back') { shape([[cx - 1.1 * hr, cy + 1.2 * hr], [cx - 1.1 * hr, cy - 0.5 * hr], [cx, cy - 1.12 * hr], [cx + 1.1 * hr, cy - 0.5 * hr], [cx + 1.1 * hr, cy + 1.2 * hr]], { fill: '#2f4f8f', seed: seed + 311 }); return; }
    const band = ell(cx, cy - 0.38 * hr, 1.1 * hr, 0.8 * hr, 16, 0, Math.PI, TAU);
    shape([...band, [cx + 1.1 * hr, cy - 0.3 * hr], [cx - 1.1 * hr, cy - 0.3 * hr]], { fill: '#d9a93b', seed: seed + 312 });
    for (let i = 0; i < 4; i++) line(ell(cx, cy - 0.38 * hr, 1.1 * hr * (0.9 - i * 0.18), 0.8 * hr * (0.9 - i * 0.18), 12, 0, Math.PI + 0.2, TAU - 0.2), { w: 3, col: '#2f4f8f', seed: seed + 313 + i, over: 0 });
    for (const sx of [-1, 1]) {
      if (view === 'side' && sx === d) continue;
      const x0 = cx + sx * 0.92 * hr, pts = [[x0, cy - 0.32 * hr], [x0 + sx * 0.36 * hr, cy - 0.3 * hr], [x0 + sx * 0.44 * hr, cy + 1.45 * hr], [x0 - sx * 0.02 * hr, cy + 1.4 * hr]];
      shape(pts, { fill: '#d9a93b', seed: seed + 320 + sx });
      for (let i = 0; i < 4; i++) line([[x0 + sx * 0.02 * hr, cy + (0.05 + i * 0.32) * hr], [x0 + sx * 0.42 * hr, cy + (0.1 + i * 0.32) * hr]], { w: 3, col: '#2f4f8f', seed: seed + 322 + i + sx * 7, over: 0 });
    }
    shape(ell(cx + (view === 'front' ? 0 : d * 0.5 * hr), cy - 0.72 * hr, 0.1 * hr, 0.16 * hr, 8), { fill: C.gold, seed: seed + 330 });
  },
  roman(cx, cy, hr, d, view, seed, look) {
    const dome = ell(cx, cy - 0.25 * hr, 1.08 * hr, 0.95 * hr, 16, 0, Math.PI, TAU);
    shape([...dome, [cx + 1.08 * hr, cy - 0.18 * hr], [cx - 1.08 * hr, cy - 0.18 * hr]], { fill: '#c99a3e', seed: seed + 341 });
    const crest = view === 'front' ? ell(cx, cy - 1.35 * hr, 0.22 * hr, 0.42 * hr, 12) : ell(cx - d * 0.1 * hr, cy - 1.3 * hr, 0.85 * hr, 0.3 * hr, 14);
    shape(crest, { fill: '#c23a2e', seed: seed + 342 });
    for (let i = 0; i < 5; i++) line([[cx + (i - 2) * 0.12 * hr * (view === 'front' ? 0.6 : 2.5), cy - 1.05 * hr], [cx + (i - 2) * 0.12 * hr * (view === 'front' ? 0.6 : 2.5), cy - 1.55 * hr]], { w: 1.4, a: 0.5, seed: seed + 343 + i, over: 0 });
  },
  knight(cx, cy, hr, d, view, seed, look) {
    // a great helm over the whole head, a slit for the eyes, a little plume
    shape(rrect(cx - 1.06 * hr, cy - 1.08 * hr, 2.12 * hr, 2.2 * hr, 0.7 * hr), { fill: '#aab2bb', seed: seed + 351 });
    if (view !== 'back') {
      line([[cx - 0.7 * hr + (view === 'front' ? 0 : d * 0.3 * hr), cy + 0.05 * hr], [cx + 0.7 * hr + (view === 'front' ? 0 : d * 0.3 * hr), cy + 0.05 * hr]], { w: 6, seed: seed + 352 });
      for (let i = 0; i < 3; i++) shape(ell(cx + (i - 1) * 0.3 * hr + (view === 'front' ? 0 : d * 0.3 * hr), cy + 0.5 * hr, 0.05 * hr, 0.05 * hr, 6), { fill: C.ink, line: false, seed: seed + 353 + i });
    }
    shape(ell(cx - d * 0.2 * hr, cy - 1.3 * hr, 0.3 * hr, 0.42 * hr, 12, -0.4 * d), { fill: '#3f6fb5', seed: seed + 357 });
  },
  feather(cx, cy, hr, d, view, seed, look) {
    line(ell(cx, cy - 0.12 * hr, 1.06 * hr, 0.7 * hr, 14, 0, Math.PI + 0.25, TAU - 0.25), { w: 6, col: C.ink, seed: seed + 361, over: 0 });
    shape(ell(cx + 0.7 * hr, cy - 0.85 * hr, 0.14 * hr, 0.14 * hr, 8), { fill: '#e8e0c8', seed: seed + 362 });
    const f = [[cx + 0.7 * hr, cy - 0.85 * hr], [cx + 1.0 * hr, cy - 1.7 * hr], [cx + 1.3 * hr, cy - 2.2 * hr], [cx + 1.05 * hr, cy - 1.5 * hr]];
    shape(f, { fill: look.featherCol || '#e9c64a', seed: seed + 363, raw: false });
    for (let i = 0; i < 5; i++) line([[cx + (0.78 + i * 0.1) * hr, cy - (1.0 + i * 0.22) * hr], [cx + (1.0 + i * 0.08) * hr, cy - (1.02 + i * 0.25) * hr]], { w: 1.4, seed: seed + 364 + i, over: 0 });
  },
  bubble(cx, cy, hr, d, view, seed, look) {
    shape(ell(cx, cy + 0.08 * hr, 1.55 * hr, 1.5 * hr, 26), { fill: '#d9edf3', fa: 0.3, seed: seed + 371, w: 2.4 });
    line(ell(cx - 0.55 * hr, cy - 0.6 * hr, 0.5 * hr, 0.3 * hr, 10, -0.6, Math.PI * 1.1, Math.PI * 1.6), { w: 4, col: '#ffffff', a: 0.8, seed: seed + 372, over: 0 });
    shape(rrect(cx - 1.1 * hr, cy + 1.32 * hr, 2.2 * hr, 0.4 * hr, 0.18 * hr), { fill: '#c9cfd6', seed: seed + 373 });
  },
  bighat(cx, cy, hr, d, view, seed, look) {
    shape(ell(cx, cy - 0.62 * hr, 1.85 * hr, 0.36 * hr, 20), { fill: look.hatCol || '#3d2f45', seed: seed + 381 });
    shape([[cx - 0.85 * hr, cy - 0.7 * hr], [cx - 0.75 * hr, cy - 1.45 * hr], [cx + 0.75 * hr, cy - 1.45 * hr], [cx + 0.85 * hr, cy - 0.7 * hr]], { fill: look.hatCol || '#3d2f45', seed: seed + 382 });
    line([[cx - 0.83 * hr, cy - 0.92 * hr], [cx + 0.83 * hr, cy - 0.92 * hr]], { w: 5, col: '#c24a5a', seed: seed + 383 });
    for (let i = 0; i < 3; i++) shape(ell(cx + (0.4 + i * 0.22) * hr, cy - 1.05 * hr - (i % 2) * 0.12 * hr, 0.16 * hr, 0.14 * hr, 8), { fill: ['#e46a6a', '#f2c5d0', '#e8d26a'][i], seed: seed + 384 + i });
  },
  horns(cx, cy, hr, d, view, seed, look) {
    const dome = ell(cx, cy - 0.3 * hr, 1.08 * hr, 0.9 * hr, 16, 0, Math.PI, TAU);
    shape([...dome, [cx + 1.08 * hr, cy - 0.22 * hr], [cx - 1.08 * hr, cy - 0.22 * hr]], { fill: '#8d8a84', seed: seed + 391 });
    for (const sx of [-1, 1]) shape([[cx + sx * 0.85 * hr, cy - 0.65 * hr], [cx + sx * 1.6 * hr, cy - 1.1 * hr], [cx + sx * 1.7 * hr, cy - 1.75 * hr], [cx + sx * 1.3 * hr, cy - 1.1 * hr], [cx + sx * 0.8 * hr, cy - 0.95 * hr]], { fill: '#efe6cf', seed: seed + 392 + sx, raw: false });
  },
  bun(cx, cy, hr, d, view, seed, look) {
    const cap = ell(cx, cy - 0.1 * hr, 1.07 * hr, 1.05 * hr, 16, 0, Math.PI + 0.2, TAU - 0.2);
    shape([...cap, [cx + 0.9 * hr, cy - 0.2 * hr], [cx, cy - 0.55 * hr], [cx - 0.9 * hr, cy - 0.2 * hr]], { fill: look.hairCol, seed: seed + 401 });
    shape(ell(cx - (view === 'side' ? d * 0.4 * hr : 0), cy - 1.18 * hr, 0.42 * hr, 0.34 * hr, 12), { fill: look.hairCol, seed: seed + 402 });
    if (look.glasses && view !== 'back') for (const sx of [-1, 1]) line(ell(cx + sx * 0.36 * hr, cy + 0.06 * hr, 0.22 * hr, 0.2 * hr, 12), { closed: true, w: 2, seed: seed + 403 + sx });
  },
  crown(cx, cy, hr, d, view, seed, look) {
    shape([[cx - 0.8 * hr, cy - 0.6 * hr], [cx - 0.85 * hr, cy - 1.35 * hr], [cx - 0.45 * hr, cy - 1.0 * hr], [cx, cy - 1.5 * hr], [cx + 0.45 * hr, cy - 1.0 * hr], [cx + 0.85 * hr, cy - 1.35 * hr], [cx + 0.8 * hr, cy - 0.6 * hr]], { fill: C.gold, seed: seed + 411, raw: true });
    shape(ell(cx, cy - 0.85 * hr, 0.12 * hr, 0.12 * hr, 8), { fill: C.red, seed: seed + 412 });
  }
};

function beard(cx, cy, hr, turn, look, seed) {
  const ox = turn * 0.4 * hr;
  shape([[cx + ox - 0.95 * hr, cy + 0.05 * hr], [cx + ox - 0.7 * hr, cy + 0.85 * hr], [cx + ox, cy + 1.45 * hr], [cx + ox + 0.7 * hr, cy + 0.85 * hr], [cx + ox + 0.95 * hr, cy + 0.05 * hr],
    [cx + ox + 0.5 * hr, cy + 0.38 * hr], [cx + ox + 0.18 * hr, cy + 0.55 * hr], [cx + ox - 0.18 * hr, cy + 0.55 * hr], [cx + ox - 0.5 * hr, cy + 0.38 * hr]], { fill: look.beardCol || look.hairCol, seed: seed + 421 });
}

function cape(Hp, R, view, d, look, seed, rotL) {
  const w = view === 'side' ? 0.7 * R : 1.05 * R, bx = view === 'side' ? -d * 0.45 * R : 0;
  shape([[Hp[0] + bx - w * 0.7, Hp[1] - 1.9 * R], [Hp[0] + bx + w * 0.7, Hp[1] - 1.9 * R], [Hp[0] + bx + w * 1.15, Hp[1] + 1.2 * R], [Hp[0] + bx - w * 1.15, Hp[1] + 1.2 * R]].map(rotL), { fill: look.cape, seed: seed + 431 });
}

// one historical guest each; party hats on the moderns
Object.assign(LOOKS, {
  caveman: { top: '#9a6b44', bottom: C.skin, shoe: '#c9a07a', hair: 'short', hairCol: '#4a3426', beard: true, skin: '#f0cfae' },
  pharaoh: { top: '#f2ead6', bottom: '#f2ead6', shoe: '#c99a3e', hair: null, hat: 'nemes', skin: '#e9c49c' },
  roman: { top: '#b23a2e', bottom: '#f1d6bf', shoe: '#8a6647', hair: 'short', hairCol: '#4a3426', hat: 'roman', cape: '#8f2a23' },
  knight: { top: '#a9b0b8', bottom: '#8e959d', shoe: '#6e757d', hair: null, hat: 'knight' },
  flapper: { top: '#3f3a5a', coat: 'dress', bottom: '#3f3a5a', shoe: C.ink, hair: 'bob', hairCol: '#d9b76a', hat: 'feather' },
  astronaut: { top: '#eeeeee', bottom: '#e6e6e6', shoe: '#bdbdbd', hair: 'short', hairCol: '#6a4a36', hat: 'bubble' },
  victorian: { top: '#6f4f7a', coat: 'dress', bottom: '#6f4f7a', shoe: C.ink, hair: null, hairCol: '#5a3f2f', hat: 'bighat' },
  grandma: { top: '#c98fa0', coat: 'dress', bottom: '#8a8fb0', shoe: '#5a4a44', hair: null, hairCol: '#d6d1c8', hat: 'bun', glasses: true },
  viking: { top: '#7a6a55', bottom: '#5b4b3b', shoe: '#4a3a2e', hair: 'short', hairCol: '#b5652f', beard: true, hat: 'horns' },
  king: { top: '#5a3d8a', bottom: '#3a2f55', shoe: C.ink, hair: 'short', hairCol: '#e8e3d8', beard: true, beardCol: '#e8e3d8', hat: 'crown', cape: '#a8312e' },
  guy: { top: '#d0703f', bottom: '#46506a', shoe: '#e8e3d8', hair: 'short', hairCol: '#3a2f2b', hat: 'party', hatCol: '#4fa3c4' },
  gal: { top: '#5e9a7a', bottom: '#3c3b47', shoe: C.shoe, hair: 'bob', hairCol: '#7a4a2a', hat: 'party', hatCol: '#e46a8a' },
  kid: { top: '#e2c34a', bottom: '#4b5f8a', shoe: C.red, hair: 'short', hairCol: '#b0702f', hat: 'party', hatCol: '#7ab55a' }
});
const GUESTS = ['caveman', 'pharaoh', 'roman', 'knight', 'flapper', 'astronaut', 'victorian', 'grandma', 'viking', 'king', 'guy', 'gal', 'kid'];

function dancePose(ph, style = 0) {
  // arms up and swaying; feet stepping on the beat
  const s = Math.sin(ph), c = Math.cos(ph), up = style % 3;
  return {
    bob: -0.12 * Math.abs(s), tilt: 0.12 * s, hx: 0.08 * s,
    legA: [0.18 * s, 0.35 * Math.max(0, s)], legB: [-0.18 * s, 0.35 * Math.max(0, -s)],
    armA: up === 0 ? [2.5 + 0.35 * s, 0.4] : up === 1 ? [1.2 + 0.5 * s, 1.2] : [2.8, 0.2 + 0.3 * c],
    armB: up === 0 ? [2.5 - 0.35 * s, 0.4] : up === 1 ? [0.4 - 0.3 * s, 1.4] : [0.6 + 0.4 * c, 1.3]
  };
}

function sitPose(R, seatH) {
  // on a chair: thighs level, shins down; the root is the floor under the knees
  return { bob: (2 * 1.3 * R + 0.16 * R - seatH) / R, legA: [1.52, 1.5], legB: [1.46, 1.44] };
}

function trex(x, y, s, o = {}) {
  // a T. rex in a party hat, walking (o.ph) or dancing; faces right at d = 1
  const d = o.dir ?? 1, ph = o.ph ?? 0, k = s, g = '#7aa25e', gD = '#5d8448';
  const bob = Math.abs(Math.sin(ph)) * 6 * k, X = v => x + v * k * d, Y = v => y - bob + v * k;
  // far leg, tail, body, near leg, arms, head
  const leg = (off, far) => {
    // a big drumstick thigh, a shin that bends back, a three-toed foot
    const a = Math.sin(ph + off) * 0.45, lift = Math.max(0, Math.sin(ph + off + 1.4)) * 22 * k, col = far ? gD : g;
    const hip = [X(-20), Y(-160)], knee = [hip[0] + (Math.sin(a) * 56 + 26) * k * d, hip[1] + 60 * k - lift * 0.4];
    const ankle = [knee[0] - (28 - Math.sin(a) * 18) * k * d, y - 26 * k - lift], toe = [ankle[0] + 44 * k * d, y - lift * 0.6];
    tube([knee, ankle, [ankle[0] + 6 * k * d, y - 8 * k - lift]], 30 * k, 24 * k, col, { seed: 451 + (far ? 1 : 0) });
    shape([[ankle[0] - 14 * k * d, y - 14 * k - lift], [toe[0], toe[1] - 12 * k], [toe[0] + 8 * k * d, toe[1]], [ankle[0] - 16 * k * d, y - lift * 0.6]], { fill: col, seed: 453 + (far ? 1 : 0) });
    const m = [(hip[0] + knee[0]) / 2, (hip[1] + knee[1]) / 2], ang = Math.atan2(knee[1] - hip[1], knee[0] - hip[0]);
    shape(ell(m[0], m[1], 62 * k, 38 * k, 18, ang), { fill: col, seed: 475 + (far ? 1 : 0) });
  };
  leg(Math.PI, true);
  const tail = Math.sin(ph * 0.5) * 18;
  shape([[X(-40), Y(-210)], [X(-160), Y(-180 + tail)], [X(-260), Y(-150 + tail * 1.4)], [X(-150), Y(-130)], [X(-30), Y(-120)]], { fill: g, seed: 455, raw: false });
  shape(ell(X(10), Y(-200), 95 * k, 80 * k, 22, -0.3 * d), { fill: g, seed: 456 });
  shape(ell(X(30), Y(-180), 55 * k, 52 * k, 16, -0.3 * d), { fill: '#c8d9a0', seed: 457, line: false });
  leg(0, false);
  for (const off of [0, 1]) line([[X(70 - off * 10), Y(-215 + off * 8)], [X(98 - off * 10), Y(-195 + off * 8 + Math.sin(ph * 2) * 8)], [X(104 - off * 10), Y(-178 + off * 8)]], { w: 7 * k, col: gD, seed: 458 + off });
  // head: big, with a toothy grin and a little eye
  const hx = X(105), hy = Y(-300);
  shape([[hx - 60 * k * d, hy - 30 * k], [hx - 10 * k * d, hy - 60 * k], [hx + 80 * k * d, hy - 46 * k], [hx + 110 * k * d, hy - 10 * k], [hx + 106 * k * d, hy + 26 * k], [hx + 20 * k * d, hy + 40 * k], [hx - 50 * k * d, hy + 30 * k]], { fill: g, seed: 461, raw: false });
  line([[hx + 10 * k * d, hy + 12 * k], [hx + 104 * k * d, hy + 6 * k]], { w: 3, seed: 462 });
  for (let i = 0; i < 6; i++) shape([[hx + (24 + i * 13) * k * d, hy + 9 * k], [hx + (30 + i * 13) * k * d, hy + 9 * k], [hx + (27 + i * 13) * k * d, hy + 17 * k]], { fill: C.cream, seed: 463 + i, w: 1.4 });
  shape(ell(hx + 30 * k * d, hy - 26 * k, 9 * k, 10 * k, 10), { fill: C.cream, seed: 470 });
  shape(ell(hx + 32 * k * d, hy - 25 * k, 4.5 * k, 6 * k, 8), { fill: C.ink, line: false, seed: 471 });
  // the party hat
  const hb = [hx - 6 * k * d, hy - 56 * k];
  shape([[hb[0] - 26 * k, hb[1] + 4 * k], [hb[0] + 8 * k * d, hb[1] - 70 * k], [hb[0] + 30 * k, hb[1] + 2 * k]], { fill: o.hat || '#e46a8a', seed: 472 });
  shape(ell(hb[0] + 8 * k * d, hb[1] - 72 * k, 7 * k, 7 * k, 8), { fill: C.gold, seed: 473 });
  return { head: [hx, hy] };
}

function guest(i, x, y, s, pose = {}) {
  const name = GUESTS[((i % GUESTS.length) + GUESTS.length) % GUESTS.length];
  return person(x, y, s, LOOKS[name], { seed: 600 + i * 17, ...pose });
}
