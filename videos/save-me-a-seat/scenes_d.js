// scenes_d.js: the bridge (bare pencil), the final chorus, the outro and the last frame (2:11-3:21).
'use strict';

function pencil(fn, col = '#7a726b') { const k = C.ink; C.ink = col; try { fn(); } finally { C.ink = k; } }
const pale = lk => ({ ...lk, bottom: '#efe6d2', shoe: '#e6dcc8' });
function headAt(x, y, s, p = {}) {
  // where person() will put the head, for hands that go to it
  const R = 32 * s, d = p.dir ?? 1, lean = p.lean ?? 0, tilt = p.tilt ?? 0;
  const Hp = [x + (p.hx ?? 0) * R, y - 2.6 * R * (p.legK ?? 1) - 0.16 * R + (p.bob ?? 0) * R];
  const N = rot2([Hp[0], Hp[1] - 2 * R], lean * d, Hp);
  return rot2([N[0], N[1] - 1.02 * R], tilt * d + lean * d * 0.4, N);
}
function barePage() { wash([[-600, -600], [3600, -600], [3600, 1800], [-600, 1800]], '#f1e8d6', { fa: 0.35, famp: 4, seed: 13001, edge: false }); }

// ---------------------------------------------------------------- bridge: nearly bare paper
const D1 = { t: cut(131.008), draw(lt, T) {
  // in pencil, the fence, the boxes humming behind it, her hands over her hood
  cam(980, 560, lerp(1.0, 1.08, ease(lt / 2.4)));
  barePage();
  pencil(() => {
    for (let i = 0; i < 5; i++) { const bx = 160 + i * 330; line(rrect(bx, 380, 240, 420, 6), { closed: true, w: 2, seed: 13010 + i });
      for (let k = 0; k < 10; k++) shape(rrect(bx + 30 + (k % 2) * 140, 420 + Math.floor(k / 2) * 70, 10, 6, 2), { fill: Math.sin(T * 3 + k + i) > 0 ? '#8fe0a0' : '#e6dcc8', line: false, seed: 13020 + k }); }
    fence(-200, 2200, 900, 480, { gap: 300 });
    line([[-200, 900], [2200, 902]], { w: 2, seed: 13030 });
    const s = 2.6, R = 32 * s, x = 1060, y = 1080, pose = { view: 'three', dir: -1, lean: 0.22, tilt: 0.12 };
    const hc = headAt(x, y, s, pose);
    humLines(200, 560, hc[0] - 1.5 * R, hc[1], T, 4, { gap: 30, amp: 10, w: 3, a: 0.85, col: '#6fae8a' });
    humLines(1900, 520, hc[0] + 1.5 * R, hc[1] - 0.2 * R, T + 0.4, 3, { gap: 30, amp: 10, w: 3, a: 0.8, seed: 13040, col: '#6fae8a' });
    person(x, y, s, pale(LOOKS.lover), { ...pose, seed: 26, handA: [hc[0] - 1.25 * R, hc[1] + 0.1 * R], handB: [hc[0] + 1.15 * R, hc[1] - 0.05 * R] });
  });
}};

const D2 = { t: cut(133.392), draw(lt, T) {
  // she unravels, from her shoes up, like a sweater pulled by a thread, into one humming blue line
  cam(960, 560, 1.0);
  barePage();
  const s = 3.0, R = 32 * s, x = 900, y = 1060, cutY = lerp(y + 12, y - 7.1 * R, ease(ramp(T, 133.45, 134.78)));
  pencil(() => line([[-200, y], [2200, y + 2]], { w: 2, seed: 13101 }));
  const c = F.art; c.save(); c.beginPath(); c.rect(-2000, -2000, 6000, cutY + 2000); c.clip();
  person(x, y, s, LOOKS.narrator, { view: 'front', seed: 50, face: { blink: 1, smile: 0.2 }, handA: [x - 0.8 * R, y - 2.4 * R], handB: [x + 0.8 * R, y - 2.4 * R] });
  c.restore();
  // the unravelling edge: a row of loose loops, and the thread running off along the ground, humming
  if (cutY < y + 10) {
    const halfW = cutY > y - 2.8 * R ? 0.7 * R : cutY > y - 4.9 * R ? 1.0 * R : 0.9 * R, loops = [];
    for (let i = 0; i <= 16; i++) { const u = i / 16; loops.push([x - halfW + u * 2 * halfW, cutY + Math.sin(u * 30 + T * 20) * 7 + 6]); }
    line(loops, { w: 5, col: C.narrD, seed: 13110, over: 0 });
    const P = [[x + halfW, cutY + 6]];
    for (let i = 1; i <= 40; i++) { const u = i / 40, px = lerp(x + halfW, 2300, u), py = lerp(cutY + 6, y - 6, Math.min(1, u * 3)); P.push([px, py + Math.sin(px * 0.05 - T * 18) * 8 * Math.min(1, u * 4)]); }
    line(P, { w: 5.5, col: C.narrD, seed: 13111, over: 0, taper: 40 });
  }
}};

const D3 = { t: cut(134.821), draw(lt, T) {
  // the line runs across the bare page, up a pole, along the wire, under the ground, to her
  barePage();
  const path = [[-200, 1060], [700, 1060], [880, 1060], [900, 1040], [900, 380], [1300, 430], [1700, 380], [1700, 1040], [1720, 1110], [2200, 1120], [2550, 1110], [2600, 1060]];
  const P = densify(path, false, 6), cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = cum[cum.length - 1] * ease(ramp(T, 134.9, 137.35));
  let n = cum.findIndex(c => c > L); if (n < 0) n = P.length;
  const head = P[Math.max(0, n - 1)];
  cam(clamp(head[0] + 150, 960, 2240), lerp(600, 680, ramp(T, 136.6, 137.6)), 1.0);
  pencil(() => {
    line([[-400, 1060], [3200, 1062]], { w: 2, seed: 13201 });
    for (const px of [900, 1700]) { line([[px, 1062], [px, 360]], { w: 5, seed: 13202 + px }); line([[px - 60, 390], [px + 60, 386]], { w: 4, seed: 13204 + px }); }
    line([[900, 380], [1300, 430], [1700, 380], [2200, 420]], { w: 1.6, seed: 13206, a: 0.7 });
    mound(2600, 1062, 1.3, { col: '#e3d6bb' });
    line([[2860, 1062], [2850, 820], [2860, 640]], { w: 12, seed: 13210 }); line([[2854, 720], [2960, 660], [3040, 666]], { w: 6, seed: 13211 });
  });
  hungCoat(2980, 662, 0.8, Math.sin(T * 1.3) * 0.05);
  // the line itself, buzzing
  const Q = P.slice(0, n).map(([px, py], i) => { const a = Math.sin(cum[i] * 0.06 - T * 20) * 4; return [px + a * 0.6, py + a]; });
  if (Q.length > 1) line(Q, { w: 5.5, col: C.narrD, seed: 13220, over: 0, raw: true });
  // at the mound it becomes roots, and a flower comes up and opens
  const rg = ramp(T, 137.35, 138.0);
  if (rg > 0) for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.45, len = 70 * rg * (1 + (k % 2) * 0.4);
    line([[2600, 1062], [2600 + Math.cos(a) * len * 0.5, 1062 - Math.sin(a) * len * 0.4 + 10], [2600 + Math.cos(a) * len, 1062 + Math.abs(Math.sin(a)) * len * 0.6]], { w: 2.4, col: C.narr, seed: 13230 + k }); }
  const fg = ramp(T, 137.7, 138.55);
  if (fg > 0) { const c = F.art; c.save(); c.translate(2600, 970); c.scale(fg, fg); flower(0, 0, 1.3, smooth(ramp(T, 138.1, 138.6)), { col: C.yellow }); c.restore(); }
}};

const D4 = { t: cut(138.629), draw(lt, T) {
  // the line curls itself into a basilisk, a sheepish one, and offers her a flower
  cam(2560, 860, 1.25);
  barePage();
  pencil(() => { line([[1400, 1062], [3600, 1062]], { w: 2, seed: 13201 }); mound(2600, 1062, 1.3, { col: '#e3d6bb' }); flower(2600, 970, 1.3, 1, { col: C.yellow }); });
  const coil = smooth(ramp(T, 138.65, 139.3)), pop = T >= 139.3;
  if (!pop) {
    const P = []; for (let i = 0; i <= 60; i++) { const u = i / 60, a = u * TAU * lerp(1, 2.6, coil), r = lerp(160, 40, u) * lerp(1.3, 0.8, coil);
      P.push([2300 + Math.cos(a) * r + lerp(-300, 0, coil) * (1 - u), 900 + Math.sin(a) * r * 0.6]); }
    line(P, { w: 5.5, col: C.narrD, seed: 13301, over: 0 });
  } else {
    const nudge = Math.max(0, Math.sin((T - 139.5) * TAU * 1.05)) * 14, sn = crownSnake(2290 + nudge * 0.4, 960, 1.6, { col: '#b8d2a0', look: 0.8, blink: T > 140.0 && T < 140.15 ? 1 : 0.35, smile: 0.6 });
    for (const sx of [-1, 1]) wash(ell(sn.head[0] + sx * 22, sn.head[1] + 8, 9, 5, 8), C.blush, { fa: 0.7, seed: 13310 + sx, edge: false });
    // the flower, held out in its tail toward the mound
    const c = F.art; c.save(); c.translate(sn.head[0] + 34 + nudge * 0.6, sn.head[1] + 46); c.rotate(0.55); flower(0, 0, 0.75, 1, { col: '#e46a8a' }); c.restore();
    if (T < 139.6) sparkle(sn.head[0], sn.head[1] - 40, 34, { seed: 13320, col: C.gold });
  }
}};

const D5 = { t: cut(140.533), draw(lt, T) {
  // in pencil, her on a crate with her sign, shouting
  cam(960, lerp(600, 560, ease(lt / 2.4)), lerp(1.05, 1.15, ease(lt / 2.4)));
  barePage();
  pencil(() => {
    line([[-200, 1000], [2200, 1002]], { w: 2, seed: 13401 });
    shape(rrect(820, 880, 280, 120, 6), { fill: '#e3d6bb', seed: 13402 }); line([[820, 940], [1100, 940]], { w: 1.4, a: 0.6, seed: 13403 });
    const s = 2.3, R = 32 * s, x = 960, y = 880, beat = Math.max(0, Math.sin(beatPos(T) * Math.PI));
    const pose = { view: 'three', dir: -1, lean: -0.06 - beat * 0.04, tilt: -0.15 };
    const hc = headAt(x, y, s, pose);
    person(x, y, s, pale(LOOKS.lover), { ...pose, seed: 27, handA: [x + 2.1 * R, y - (5.4 + beat * 0.3) * R], handB: [x - 1.2 * R, y - 3.8 * R],
      hold: { B: (h, R) => { line([[h[0], h[1] + 0.3 * R], [h[0] - 0.2 * R, h[1] - 3.2 * R]], { w: 5, seed: 13410 });
        shape([[h[0] - 1.6 * R, h[1] - 4.6 * R], [h[0] + 1.2 * R, h[1] - 4.5 * R], [h[0] + 1.1 * R, h[1] - 2.9 * R], [h[0] - 1.5 * R, h[1] - 3.0 * R]], { fill: '#f6efdc', seed: 13411 });
        pictogram('snake', h[0] - 0.25 * R, h[1] - 3.75 * R, 2.1, 13412);
        line([[h[0] - 1.2 * R, h[1] - 4.3 * R], [h[0] + 0.8 * R, h[1] - 3.2 * R]], { w: 5, col: C.red, seed: 13415 }); line([[h[0] + 0.8 * R, h[1] - 4.3 * R], [h[0] - 1.2 * R, h[1] - 3.2 * R]], { w: 5, col: C.red, seed: 13416 }); } } });
    // what she's shouting comes out as lines
    for (let i = 0; i < 4; i++) { const a = Math.PI + 0.5 - i * 0.32, r0 = 1.7 * R + beat * 12; line([[hc[0] + Math.cos(a) * r0, hc[1] + Math.sin(a) * r0], [hc[0] + Math.cos(a) * (r0 + 60), hc[1] + Math.sin(a) * (r0 + 60)]], { w: 3, seed: 13420 + i }); }
  });
}};

const D6 = { t: cut(142.907), draw(lt, T) {
  // the stars fold flat faster and faster, and then the page itself folds up
  cam(960, 600, 1.0);
  nightSky({ seed: 13501, stars: 0 });
  hill(820, { col: '#c9b592' });
  for (let j = 0; j < 9; j++) fchair(200 + j * 200, 900 + (j % 2) * 30, 0.5, { col: '#6f7888' });
  bulbMoon(1500, 110, 64, { lit: 0.5, chain: 0 });
  const r = mulberry(13502), N = 46;
  for (let i = 0; i < N; i++) {
    const x = -100 + r() * 2100, y = -60 + r() * 640, rr = 10 + r() * 12, t0 = 142.95 + 2.2 * Math.pow(i / N, 0.55);
    star(x, y, rr, { fold: clamp((T - t0) / 0.18), seed: 13510 + i, glow: T < t0 ? 0.15 : 0 });
  }
  pageFold(ease(ramp(T, 144.5, 146.2)) * 0.82);
}};

const D7 = { t: cut(146.224), draw(lt, T) {
  // the drum fill: every folded star rushes to one point of light, and the light grows until it's a doorway
  cam(960, 540, 1.0);
  wash([[-200, -200], [2200, -200], [2200, 1400], [-200, 1400]], VOID, { famp: 4, seed: 13601, edge: false });
  pageFold(0.82);
  const k = ramp(T, 146.3, 149.5), r = mulberry(13602);
  for (let i = 0; i < 60; i++) {
    const a = r() * TAU, d0 = 500 + r() * 900, sp = 0.5 + r() * 0.8, u = clamp(easeIn(clamp(k * sp * 1.6 - r() * 0.3)));
    if (u >= 1) continue;
    const d = d0 * (1 - u), x = 960 + Math.cos(a) * d * 1.3, y = 540 + Math.sin(a) * d * 0.8;
    const c = F.art; c.save(); c.translate(x, y); c.rotate(a + T * 3); slab(0, 0, 60 * (1 - u * 0.7), 9 * (1 - u * 0.7), { seed: 13610 + i }); c.restore();
    if (u > 0.3) line([[x, y], [x + Math.cos(a) * 60 * u, y + Math.sin(a) * 40 * u]], { w: 2, col: C.star, a: 0.6, seed: 13680 + i, over: 0 });
  }
  const g = smooth(k);
  glow(960, 540, lerp(60, 1500, g * g), C.gold, lerp(0.35, 0.9, g));
  glow(960, 540, lerp(30, 700, g), '#fff6d6', lerp(0.4, 0.95, g));
  if (g > 0.6) wash(rrect(960 - 300 * g, 540 - 420 * g, 600 * g, 840 * g, 8), '#fff6d6', { fa: (g - 0.6) * 2.4, seed: 13690, edge: false });
}};

// ---------------------------------------------------------------- final chorus
function audience(T, o = {}) {
  // the rows full of every era's guests, sitting quietly facing the edge (o.stand(row, j) 0..1 stands them up toward the doors)
  const looks = [0, 4, 7, 1, 9, 3, 6, 11, 2, 5, 8, 10, 12];
  for (let ri = 0; ri < 3; ri++) for (let j = 0; j < rowCount(ri); j++) {
    const [x, y, s] = rowSeat(ri, j), n = ri * 7 + j * 3, lk = LOOKS[GUESTS[looks[n % looks.length]]];
    if (o.skip && o.skip(ri, j)) { fchair(x, y, SIT * s); continue; }
    if (ri === 1 && j === 2) { fchair(x, y, SIT * s); const st = o.stand ? o.stand(ri, j) : 0; trex(x - 30, y - (st > 0.5 ? 0 : 60), 0.85, { ph: 0, dir: st > 0.5 ? -1 : 1 }); continue; }
    const st = o.stand ? o.stand(ri, j) : 0;
    if (st > 0.5) { fchair(x, y, SIT * s); person(x + 40, y + 30, s * 0.95, lk, { view: 'three', dir: -1, seed: 700 + n, bob: -0.15 * Math.sin(clamp((st - 0.5) * 2) * Math.PI), face: { look: [-1, -0.2], smile: 0.3, open: o.breath ? o.breath * 0.4 : 0 } }); }
    else seatedChair(x, y, s * 0.95, lk, { seed: 700 + n, face: { look: [1, 0], smile: 0.3, blink: (BOIL + n * 3) % 41 === 0 ? 1 : 0 }, handA: [x + 0.9 * 32 * s, y - 2.0 * 32 * s], handB: [x + 1.1 * 32 * s, y - 2.1 * 32 * s] });
  }
}

const E1 = { t: cut(149.557), draw(lt, T) {
  // out of the light, through the doors, at last, her. The whole hall waits, quietly.
  const k = ease(ramp(lt, 0, 3.6));
  cam(lerp(240, 1150, k), lerp(560, 780, k), lerp(2.6, 1.05, k));
  nightPage({ seed: 13701 });
  bulbMoon(1500, 110, 64, { lit: 0.45, chain: 0 });
  tornEdge(TEAR);
  skyDoors(200, hillY(200) + 4, 360, 520, 0.9);
  glow(200, 520, lerp(900, 500, k), '#fff6d6', lerp(0.9, 0.35, k));
  audience(T);
  const w = ramp(lt, 0.3, 5.6), x = lerp(220, 1200, w), y = lerp(hillY(220) + 30, hillY(1200) + 330, smooth(w)), s = lerp(1.2, 2.0, smooth(w));
  F.art.globalAlpha = clamp((lt - 0.3) / 0.5);
  person(x, y, s, LOOKS.narrator, { view: 'three', dir: 1, ...walkPose(lt * TAU * 1.0), seed: 51, face: { look: [-0.6, -0.2], brow: -0.3, smile: 0 } });
  F.art.globalAlpha = 1;
}};

const E2 = { t: cut(155.243), draw(lt, T) {
  // she checks the old phone in her hand. One saved message.
  cam(960, 600, lerp(1.0, 1.08, ease(lt / 2.8)));
  nightPage({ seed: 13801, y0: 760, stars: 30 });
  glow(-200, 700, 900, '#ffe2a0', 0.3);
  const s = 4.4, R = 32 * s, x = 1000, y = 600 + 5.78 * R + 0.3 * R, up = smooth(ramp(T, 157.4, 157.8));
  person(x, y, s, LOOKS.narrator, { view: 'three', dir: -1, seed: 52, legFirst: true, tilt: lerp(0.18, -0.02, up),
    handA: [x - 0.9 * R, y - 4.05 * R], handB: [x - 0.3 * R, y - 3.7 * R], bow: 0.6,
    face: { look: [-0.4, lerp(1, -0.3, up)], brow: -0.45, smile: 0.12, blink: T > 156.6 && T < 156.75 ? 1 : 0 },
    hold: { A: (h, R) => { phone(h[0] - 0.05 * R, h[1] - 0.45 * R, s * 0.9, -0.1, { lit: 0.7 }); voicemailIcon(h[0] - 0.05 * R, h[1] - 0.5 * R, s * 0.55); shape(ell(h[0] + 0.25 * R, h[1] - 0.72 * R, 3.5 * s * 0.55, 3.5 * s * 0.55, 8), { fill: C.red, line: false, seed: 13810 }); } } });
}};

const E3 = { t: cut(158.08), draw(lt, T) {
  // the whole hall stands, turns to the doors, and holds its breath
  cam(lerp(1000, 940, ease(lt / 3.3)), 760, lerp(0.95, 1.0, ease(lt / 3.3)));
  nightPage({ seed: 13901 });
  tornEdge(TEAR);
  const open = 0.9, light = smooth(ramp(T, 158.6, 161.3));
  skyDoors(200, hillY(200) + 4, 360, 520, open);
  glow(200, 520, lerp(500, 1100, light), '#fff1c4', lerp(0.35, 0.75, light));
  const breath = smooth(ramp(T, 160.5, 161.2));
  audience(T, { stand: (ri, j) => clamp((T - (158.2 + (6 - j) * 0.09 + ri * 0.05)) / 0.25), breath });
  const s = 2.0, R = 32 * s, x = 1240, y = hillY(1240) + 330;
  person(x, y, s, LOOKS.narrator, { view: 'three', dir: -1, seed: 53, bob: -breath * 0.08, handA: [x - 0.4 * R, y - 3.9 * R], handB: [x + 0.1 * R, y - 3.8 * R], face: { look: [-1, -0.3], brow: -0.2, open: breath * 0.35 },
    hold: { A: (h, R) => phone(h[0], h[1] - 0.2 * R, s * 0.55, 0.2) } });
}};

const E4 = { t: cut(161.387), draw(lt, T) {
  // the drums slam, everybody dances, and it rains folded stars
  const [sx, sy] = T < 161.6 ? shake(10 * (1 - (T - 161.387) / 0.21)) : [0, 0];
  cam(960 + sx, 640 + sy, lerp(0.98, 1.04, ease(lt / 2.8)));
  nightPage({ seed: 14001, y0: 800, stars: 50 });
  discoMoon(960, 90, 90, T);
  lightSpots(T, 12, { seed: 14002, y0: 860, y1: 1150 });
  for (let j = 0; j < 9; j++) guest(j * 2 + 1, 80 + j * 240, 860, 0.85, { view: 'front', ...danceAt(T, j), face: { smile: 0.85, blink: 1 } });
  trex(1500, 960, 1.05, { ph: beatPos(T) * Math.PI });
  for (let j = 0; j < 8; j++) { if (j === 4) continue; guest(j * 3 + 2, 120 + j * 250, 1080, 1.2, { view: 'front', ...danceAt(T, j + 4), face: { smile: 0.9, open: 0.35, blink: j % 2 } }); }
  const s = 1.3, R = 32 * s;
  person(1110, 1100, s, LOOKS.narrator, { view: 'front', seed: 54, face: { look: [Math.sin(T * 2) > 0 ? 1 : -1, 0], brow: -0.3, smile: 0.2, lift: T > 163.6 ? 1 : 0 } });
  // confetti: folded stars, tumbling
  const r = mulberry(14010);
  for (let i = 0; i < 70; i++) { const x0 = r() * 2200 - 140, sp = 160 + r() * 140, ph = r() * 9, y = -100 + ((lt * sp + r() * 1300) % 1300), x = x0 + Math.sin(lt * 2 + ph) * 40;
    const c = F.art; c.save(); c.translate(x, y); c.rotate(lt * 4 + ph); c.scale(1, Math.cos(lt * 5 + ph)); slab(0, 0, 26, 8, { seed: 14020 + i, col: i % 5 ? C.star : '#f2c5d0' }); c.restore(); }
}};

const RC = { x: 1060, y: 960, s: 0.95 };       // the chair with her raincoat on it
const E5 = { t: cut(164.224), draw(lt, T) {
  // in the middle of it all, one chair with a yellow raincoat thrown over it
  cam(lerp(980, 1020, ease(lt / 4.7)), lerp(700, 720, ease(lt / 4.7)), lerp(1.05, 1.32, ease(lt / 4.7)));
  nightPage({ seed: 14101, y0: 790, stars: 40 });
  discoMoon(800, -60, 80, T);
  lightSpots(T, 10, { seed: 14102, y0: 840, y1: 1100 });
  F.art.globalAlpha = 0.6;
  for (let j = 0; j < 9; j++) guest(j * 2 + 2, 60 + j * 240, 850, 0.8, { view: 'front', ...danceAt(T, j), face: { smile: 0.85, blink: 1 } });
  F.art.globalAlpha = 1;
  glow(RC.x, RC.y - 120, 420, '#ffe7a0', 0.4);
  const ch = fchair(RC.x, RC.y, RC.s); drapedCoat(ch, { t: T });
  // her: she comes, sees it, stops; a hand to her mouth; then she goes to it and touches its sleeve
  const s = 1.6, R = 32 * s, arrive = smooth(ramp(T, 164.25, 164.85)), go = smooth(ramp(T, 167.0, 168.4));
  const x = lerp(lerp(380, 640, arrive), 790, go), y = 1000;
  const walking = (arrive > 0 && arrive < 1) || (go > 0 && go < 1);
  const mouth = smooth(ramp(T, 165.3, 165.7)) * (1 - smooth(ramp(T, 166.8, 167.2))), touch = smooth(ramp(T, 168.2, 168.6));
  const hc = headAt(x, y, s, { dir: 1, lean: 0.04 * go });
  person(x, y, s, LOOKS.narrator, { view: 'three', dir: 1, seed: 55, ...(walking ? walkPose(T * TAU * 1.1, { amp: 0.7 }) : {}), lean: 0.04 * go,
    ...(mouth > 0.05 ? { handA: [hc[0] + 0.35 * R, hc[1] + lerp(2.5, 0.65, mouth) * R] } : touch > 0 ? { handA: [lerp(x + 0.8 * R, ch.panel[0][0] - 10 * RC.s, touch), lerp(y - 2.6 * R, ch.panel[0][1] + 120 * RC.s, touch)] } : {}),
    face: { look: [1, 0.15], lift: smooth(ramp(T, 164.8, 165.0)) * 1.2, brow: -0.1, smile: lerp(0, 0.35, go), open: smooth(ramp(T, 164.8, 165.0)) * (1 - mouth) * 0.35, blink: T > 166.3 && T < 166.45 ? 1 : 0 } });
}};

// from behind: the edge, the dark, two chairs (one with her raincoat), framed like the empty-chair shot in chorus 1
function coatChairBack(x, y, cs, t) {
  const out = chairBack(x, y, cs), top = out.top, sw = 136 * cs, sway = Math.sin(t * 1.3) * 2;
  shape(ell(top[0] + 6, top[1] + 30 * cs, 48 * cs, 44 * cs, 16), { fill: shade(C.yellow, 0.92), seed: 14201 });
  shape([[top[0] - sw * 0.56, top[1] - 4], [top[0] + sw * 0.56, top[1] - 4], [top[0] + sw * 0.6 + sway, top[1] + 210 * cs], [top[0] - sw * 0.6 + sway, top[1] + 214 * cs]], { fill: C.yellow, seed: 14202, raw: false });
  line([[top[0], top[1] + 80 * cs], [top[0] + 2, top[1] + 200 * cs]], { w: 2, a: 0.5, seed: 14203 });
  for (const sx of [-1, 1]) tube([[top[0] + sx * sw * 0.56, top[1] + 10 * cs], [top[0] + sx * sw * 0.66 + sway, top[1] + 120 * cs], [top[0] + sx * sw * 0.62 + sway * 1.3, top[1] + 230 * cs]], 34 * cs, 28 * cs, shade(C.yellow, 0.95), { seed: 14204 + sx });
  return { ...out, sleeve: [top[0] - sw * 0.6 + sway, top[1] + 118 * cs] };
}
function edgeFromBehind(o = {}) {
  wash([[-600, -400], [2600, -400], [2600, 1600], [-600, 1600]], '#d8c39c', { seed: 10001, edge: false });
  for (let i = 0; i < 9; i++) line([[-600, 700 + i * i * 9], [2600, 702 + i * i * 9]], { w: 1.4, a: 0.3, seed: 10002 + i, over: 0 });
  tornEdgeH(640);
  glow(960, 1300, 900, '#ffe2a0', o.warm ?? 0.35);
}

const E6 = { t: cut(168.955), draw(lt, T) {
  // she takes a folded star from her pocket, it snaps open into a chair beside the raincoat, and she sits
  const k = ease(lt / 5.66);
  cam(960, lerp(700, 640, k), lerp(1.0, 1.18, k));
  edgeFromBehind({ warm: 0.4 });
  lightSpots(T, 8, { seed: 14301, y0: 680, y1: 1080, a: 0.25 });
  const s = 2.2, R = 32 * s, fy = 1080, cs = SIT * s * 1.05, seatH = 150 * cs, xc = 1140, xs = xc - 136 * cs * 1.35;
  const pop = 170.37, popped = T >= pop, sat = T >= 171.3, p = clamp((T - pop) / 0.4), hand = smooth(ramp(T, 172.4, 172.9)), lean = smooth(ramp(T, 173.4, 174.3));
  const cc = coatChairBack(xc, fy, cs, T);
  if (!sat) {
    // standing beside it, with the folded star; then it pops
    const x = xs - 1.4 * R, y = fy + 30;
    if (popped) { const sq = 1 + 0.22 * Math.sin(p * Math.PI * 1.5) * Math.exp(-p * 3); const c = F.art; c.save(); c.translate(xs, fy); c.scale(2 - sq, sq); c.translate(-xs, -fy); chairBack(xs, fy, cs); c.restore();
      if (p < 0.7) sparkle(xs, fy - seatH - 120, 50, { seed: 14310, col: C.gold }); }
    person(x, y, s, LOOKS.narrator, { view: 'back', seed: 56, handA: popped ? [x - 0.8 * R, y - 2.4 * R] : [x + 0.6 * R, y - lerp(2.4, 3.4, smooth(ramp(T, 169.4, 169.9))) * R], handB: [x + 0.9 * R, y - 2.4 * R],
      hold: { A: (h, R) => { if (!popped) slab(h[0] + 0.3 * R, h[1] - 0.1 * R, 1.0 * R, 0.16 * R, { seed: 14311 }); } } });
  } else {
    const hop = Math.sin(clamp((T - 171.3) / 0.25) * Math.PI) * 0.15;
    person(xs, fy, s, LOOKS.narrator, { view: 'back', seed: 56, legK: (seatH - 0.16 * R) / (2.6 * R), bob: -hop, tilt: 0.16 * lean, lean: 0.05 * lean,
      handA: [xs - 0.75 * R, fy - seatH - 0.15 * R], handB: [lerp(xs + 0.8 * R, cc.sleeve[0] + 4, hand), lerp(fy - seatH - 0.3 * R, cc.sleeve[1] - 4, hand)] });
    chairBack(xs, fy, cs, { sat: true });
    if (hand > 0.5) shape(ell(cc.sleeve[0] + 4, cc.sleeve[1] - 4, 0.21 * R, 0.18 * R, 12), { fill: C.skin, seed: 14320, w: 2 });
  }
}};

const E7 = { t: cut(174.613), draw(lt, T) {
  // the crowd comes round the two chairs, dancing, and it rains folded stars
  const k = ease(lt / 3.8);
  cam(960, lerp(640, 600, k), lerp(1.18, 0.86, k));
  edgeFromBehind({ warm: 0.45 });
  const s = 2.2, R = 32 * s, fy = 1080, cs = SIT * s * 1.05, seatH = 150 * cs, xc = 1140, xs = xc - 136 * cs * 1.35;
  const ring = []; for (let i = 0; i < 16; i++) { const a = T * 0.7 + i / 16 * TAU; ring.push({ i, a, x: 1000 + Math.cos(a) * 1150, y: 1060 + Math.sin(a) * 170 }); }
  const dancer = ({ i, a, x, y }) => guest(i * 2 + 1, x, y, 1.35 + Math.sin(a) * 0.35, { view: Math.sin(a) > 0 ? 'back' : 'front', ...danceAt(T, i), face: { smile: 0.85, blink: 1 } });
  ring.filter(p => Math.sin(p.a) < 0).sort((a, b) => a.y - b.y).forEach(dancer);
  const cc = coatChairBack(xc, fy, cs, T);
  person(xs, fy, s, LOOKS.narrator, { view: 'back', seed: 56, legK: (seatH - 0.16 * R) / (2.6 * R), tilt: 0.16, lean: 0.05, handA: [xs - 0.75 * R, fy - seatH - 0.15 * R], handB: [cc.sleeve[0] + 4, cc.sleeve[1] - 4] });
  chairBack(xs, fy, cs, { sat: true });
  shape(ell(cc.sleeve[0] + 4, cc.sleeve[1] - 4, 0.21 * R, 0.18 * R, 12), { fill: C.skin, seed: 14320, w: 2 });
  ring.filter(p => Math.sin(p.a) >= 0).sort((a, b) => a.y - b.y).forEach(dancer);
  const r = mulberry(14410);
  for (let i = 0; i < 60; i++) { const x0 = r() * 2600 - 340, sp = 140 + r() * 120, ph = r() * 9, y = -300 + ((lt * sp + r() * 1500) % 1500), x = x0 + Math.sin(lt * 2 + ph) * 40;
    const c = F.art; c.save(); c.translate(x, y); c.rotate(lt * 4 + ph); c.scale(1, Math.cos(lt * 5 + ph)); slab(0, 0, 26, 8, { seed: 14420 + i, col: i % 5 ? C.star : '#f2c5d0' }); c.restore(); }
}};

const E8 = { t: cut(178.405), draw(lt, T) {
  // in her hands, a flip-book of the old crayon pages: the rain, the fence, the bed, the roof
  cam(960, 560, lerp(1.05, 1.12, ease(lt / 1.9)));
  wash([[-200, -200], [2200, -200], [2200, 1400], [-200, 1400]], '#c9b592', { famp: 4, seed: 14501, edge: false });
  glow(960, 400, 800, '#ffe2a0', 0.3);
  flipbook(960, 800, 2.3, T * 0.5, (i, x, y, k) => {
    const w = 280 * k, h = 190 * k, m = Math.floor(i / 2) % 4, box = [[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]];
    const bg = ['#33395f', '#30365a', '#8a6a4c', C.night][m];
    wash(box, bg, { seed: 14510 + m, edge: false }); scribble(box, shade(bg, 1.25), { gap: 9, w: 4, seed: 14514 + m, a: 0.4 });
    if (m === 0) { for (let j = 0; j < 8; j++) line([[x - w / 2 + j * 36 * k, y - h / 2 + 10], [x - w / 2 + j * 36 * k + 8 * k, y - h / 2 + 30 * k]], { w: 1.4, col: '#7f98ba', seed: 14520 + j, over: 0 });
      shape(ell(x - 10 * k, y + 20 * k, 14 * k, 24 * k, 10), { fill: C.yellow, seed: 14530 }); shape(ell(x - 8 * k, y - 10 * k, 12 * k, 12 * k, 10), { fill: C.yellow, seed: 14531 });
      line([[x - 20 * k, y + 40 * k], [x - 34 * k, y + 64 * k]], { w: 4, col: C.boot, seed: 14532 }); line([[x, y + 40 * k], [x + 16 * k, y + 60 * k]], { w: 4, col: C.boot, seed: 14533 }); }
    if (m === 1) { for (let j = 0; j < 7; j++) line([[x - w / 2 + j * 44 * k, y - h / 2], [x - w / 2 + j * 44 * k + 30 * k, y + h / 2]], { w: 1.2, col: '#8d97a1', seed: 14540 + j, over: 0 });
      shape(ell(x - 20 * k, y + 20 * k, 14 * k, 26 * k, 10), { fill: C.yellow, seed: 14550 }); shape(ell(x + 22 * k, y + 22 * k, 12 * k, 22 * k, 10), { fill: C.narr, seed: 14551 }); shape(ell(x + 22 * k, y - 8 * k, 10 * k, 10 * k, 10), { fill: C.hairN, seed: 14552 });
      shape([[x - 60 * k, y - 30 * k], [x, y - 66 * k], [x + 60 * k, y - 30 * k]], { fill: '#4b6fc4', seed: 14553 }); }
    if (m === 2) { shape(rrect(x - 70 * k, y - 60 * k, 140 * k, 130 * k, 8 * k), { fill: '#d98c7a', seed: 14560 }); shape(ell(x - 30 * k, y - 50 * k, 18 * k, 18 * k, 10), { fill: C.hairN, seed: 14561 }); shape(ell(x + 30 * k, y - 50 * k, 18 * k, 18 * k, 10), { fill: C.yellow, seed: 14562 }); }
    if (m === 3) { shape([[x - w * 0.42, y + h / 2], [x - w * 0.1, y + h * 0.12], [x + w * 0.24, y + h * 0.12], [x + w * 0.5, y + h / 2]], { fill: '#b44a3a', seed: 14570 });
      shape(ell(x - 12 * k, y + h * 0.1, 12 * k, 15 * k, 10), { fill: C.narr, seed: 14571 }); shape(ell(x - 12 * k, y + h * 0.1 - 19 * k, 9 * k, 9 * k, 10), { fill: C.hairN, seed: 14572 });
      shape(ell(x + 14 * k, y + h * 0.1, 12 * k, 15 * k, 10), { fill: C.yellow, seed: 14573 }); shape(ell(x + 14 * k, y + h * 0.1 - 20 * k, 10 * k, 10 * k, 10), { fill: C.yellow, seed: 14574 });
      shape(ell(x + w * 0.2, y - h * 0.25, 16 * k, 16 * k, 14), { fill: C.cream, seed: 14575 }); }
  });
}};

// ---------------------------------------------------------------- outro
const E9 = { t: cut(180.293), draw(lt, T) {
  // she dials, a press a beat, then holds it to her ear and waits, eyes shut
  cam(960, 600, lerp(1.0, 1.06, ease(lt / 5.2)));
  edgeFromBehind({ warm: 0.3 });
  wash([[-600, -400], [2600, -400], [2600, 1600], [-600, 1600]], '#3a3550', { fa: 0.25, seed: 14601, edge: false });
  const s = 4.4, R = 32 * s, x = 980, y = 600 + 5.78 * R + 0.3 * R, lift = smooth(ramp(T, 182.6, 183.3));
  const presses = beatsIn(180.4, 182.5), press = presses.reduce((m, b) => Math.max(m, Math.max(0, 1 - Math.abs(T - b - 0.06) / 0.09)), 0);
  person(x, y, s, LOOKS.narrator, { view: 'three', dir: -1, seed: 57, legFirst: true, tilt: lerp(0.16, -0.06, lift),
    handA: (() => { const hc = headAt(x, y, s, { dir: -1, tilt: lerp(0.16, -0.06, lift) }), ear = [hc[0] + 0.55 * R, hc[1] + 0.32 * R]; return [lerp(x - 0.9 * R, ear[0], lift), lerp(y - 4.05 * R, ear[1], lift)]; })(),
    handB: [x - 0.3 * R, y - 3.7 * R], bow: 0.6,
    face: { look: [-0.4, lerp(1, 0, lift)], brow: -0.35, smile: 0.12 + lift * 0.1, blink: T > 183.6 ? 1 : 0 },
    hold: { A: (h, R) => { phone(h[0] - 0.05 * R, h[1] - 0.45 * R, s * 0.9, lerp(-0.1, 0.3, lift), { lit: 0.5 + press * 0.4 });
      if (lift < 0.05 && press > 0) shape(ell(h[0] - 0.05 * R + (presses.findIndex(b => T < b + 0.2) % 3 - 1) * 8, h[1] - 0.38 * R, 7, 7, 8), { fill: '#ffffff', line: false, seed: 14610, fa: press }); } } });
}};

const E10 = { t: cut(185.488), draw(lt, T) {
  // by the raincoat, the phone at her ear, her other hand on its sleeve
  cam(960, 660, lerp(1.18, 1.24, ease(lt / 2.4)));
  edgeFromBehind({ warm: 0.3 });
  const s = 2.2, R = 32 * s, fy = 1080, cs = SIT * s * 1.05, seatH = 150 * cs, xc = 1140, xs = xc - 136 * cs * 1.35;
  const cc = coatChairBack(xc, fy, cs, T);
  person(xs, fy, s, LOOKS.narrator, { view: 'back', seed: 56, legK: (seatH - 0.16 * R) / (2.6 * R), tilt: 0.1,
    handA: (() => { const hc = headAt(xs, fy, s, { legK: (seatH - 0.16 * R) / (2.6 * R), tilt: 0.1 }); return [hc[0] - 1.12 * R, hc[1] + 0.25 * R]; })(), handB: [cc.sleeve[0] + 4, cc.sleeve[1] - 4],
    hold: { A: (h, R) => phone(h[0] - 0.1 * R, h[1] - 0.25 * R, s * 0.55, -0.25) } });
  chairBack(xs, fy, cs, { sat: true });
  shape(ell(cc.sleeve[0] + 4, cc.sleeve[1] - 4, 0.21 * R, 0.18 * R, 12), { fill: C.skin, seed: 14320, w: 2 });
}};

const E11 = { t: cut(187.851), draw(lt, T) {
  // the party leaves: a conga line out through the doors, waving; the stagehands fold up the chairs; two chairs stay
  cam(1050, 760, 0.95);
  nightPage({ seed: 14801 });
  bulbMoon(1500, 110, 64, { lit: 0.6, chain: 0 });
  tornEdge(TEAR);
  skyDoors(200, hillY(200) + 4, 360, 520, 0.9);
  glow(200, 520, 600, '#fff1c4', 0.45);
  // the chairs fold back into stars, a beat at a time, and go on the hand truck
  const beats = beatsIn(188.0, 193.4);
  let fi = 0;
  for (let ri = 0; ri < 3; ri++) for (let j = 0; j < rowCount(ri); j++) {
    if (ri === 2 && j === rowCount(2) - 1) continue;
    const [x, y, s] = rowSeat(ri, j), b = beats[(fi++ * 7) % beats.length] + (fi % 2) * 0.2, p = clamp((T - b) / 0.3);
    if (p <= 0) fchair(x, y, SIT * s); else if (p < 1) { const c = F.art; c.save(); c.translate(x, y); c.scale(1, 1 - p * 0.85); c.translate(-x, -y); fchair(x, y, SIT * s); c.restore(); }
    else slab(x, y - 8, 100 * SIT * s, 12, { seed: 14810 + fi });
  }
  // the conga, dancing out through the doors
  const order = [0, 4, 9, 7, 1, 3, 8, 6, 12, 10, 5, 2, 11, 'rex'], bp = beatPos(T), head = lerp(1500, -1200, lt / 5.66);
  order.forEach((g, k) => {
    const x = head + k * 170 + (g === 'rex' ? 60 : 0); if (x < 230 || x > 2300) return;
    const y = hillY(x) + 90 + Math.sin(x * 0.006) * 20;
    F.art.globalAlpha = clamp((x - 230) / 120);
    if (g === 'rex') trex(x, y, 0.95, { ph: bp * Math.PI, dir: -1 });
    else { const s = 1.25, R = 32 * s, wp = walkPose(bp * Math.PI + k * 0.2, { amp: 0.7 });
      guest(g, x, y, s, { view: 'side', dir: -1, ...wp, handA: k === order.length - 2 ? [x + 0.4 * R, y - (6.4 + 0.4 * Math.sin(T * 10)) * R] : [x - 1.6 * R, y - 4.3 * R], handB: [x - 1.5 * R, y - 4.1 * R], face: { smile: 0.85 } }); }
    F.art.globalAlpha = 1;
  });
  // her two chairs at the edge: the raincoat on one, her on the other with the phone at her ear
  const [cx, cy, csz] = rowSeat(2, rowCount(2) - 1);
  const ns = 1.7, nx = cx + 114 * SIT * csz, ny = cy - 70 * SIT * csz;
  seatedChair(nx, ny, ns, LOOKS.narrator, { seed: 58, handA: 'ear', handB: [nx + 0.9 * 32 * ns, ny - 2.0 * 32 * ns], face: { blink: 1, smile: 0.2 }, hold: { A: (h, R) => phone(h[0] + 0.05 * R, h[1] - 0.1 * R, ns * 0.55, 0.25) } });
  const ch = fchair(cx, cy, SIT * csz); drapedCoat(ch, { t: T });
}};

const E12 = { t: cut(193.515), draw(lt, T) {
  // the last shot: close on the raincoat on its chair, her hand on its sleeve. When the music stops, its pocket lights up.
  const k = ease(ramp(lt, 0, 6.0));
  const ch0 = { x: 980, y: 980, s: 1.25 }, pk = coatPocket(fchairGeom(ch0.x, ch0.y, ch0.s, 1));
  cam(lerp(1050, 1030, k), lerp(640, 612, k), lerp(1.0, 1.85, k));
  nightPage({ seed: 14901, y0: 800, stars: 30 });
  tornEdge(1900, { stars: 40 });
  glow(-200, 800, 900, '#ffe2a0', 0.2);
  // her, sitting beside it, phone at her ear
  const ns = 2.5, R = 32 * ns, nx = ch0.x + 140 * ch0.s, ny = ch0.y - 86 * ch0.s;
  const G = fchairGeom(ch0.x, ch0.y, ch0.s, 1), sh = G.panel[1];
  // turned three-quarters to us: her near hand on the coat, the phone in her far hand at the far side of her head
  // (in profile, with the phone on the near side, both arms read as on her left: Jason, 2026-10-18)
  const hip = nx - 4 * ns, bob = (2.76 * R - (150 * SIT * ns - 2 * SIT * ns)) / R, hc = headAt(hip, ny, ns, { bob, dir: 1 }), ear = [hc[0] + 0.98 * R, hc[1] + 0.3 * R];
  seatedChair(nx, ny, ns, LOOKS.narrator, { view: 'three', seed: 59, legFirst: true, handA: [sh[0] + 6, sh[1] + 16], handB: ear, elbow: { B: 1 }, bow: 1.6, face: { blink: 1, smile: 0.25, look: [-0.3, 0] },
    after: o => { phone(ear[0] + 0.06 * R, ear[1] - 0.4 * R, ns * 0.55, -0.12, { col: '#a7adb6' }); shape(ell(ear[0] + 0.04 * R, ear[1] + 0.02 * R, 0.21 * R, 0.2 * R, 12), { fill: C.skin, seed: 14911, w: 2 }); } });
  const ch = fchair(ch0.x, ch0.y, ch0.s), coat = drapedCoat(ch, { t: T });
  // her hand on the coat's shoulder, drawn over it
  shape(ell(sh[0] + 6, sh[1] + 18, 0.21 * R, 0.18 * R, 12), { fill: C.skin, seed: 14910, w: 2 });
  // ring, ring: the phone in her pocket lights up
  const on = smooth(ramp(T, 199.664, 199.95));
  if (on > 0) {
    glow(pk[0], pk[1], 120, '#d8f0ff', 0.6 * on); glow(pk[0], pk[1], 40, '#ffffff', 0.7 * on);
    shape(rrect(pk[0] - 9, pk[1] - 18, 18, 26, 3), { fill: '#fff6d0', line: false, fa: 0.7 * on, seed: 14920, edge: false });
    const buzz = Math.floor(T * 12) % 3 !== 2 && T > 200.0;
    if (buzz) for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) line(ell(pk[0], pk[1], 34 + i * 12, 30 + i * 10, 8, 0, sx > 0 ? -0.6 : Math.PI - 0.6, sx > 0 ? 0.6 : Math.PI + 0.6), { w: 2, a: 0.8, seed: 14930 + i + sx });
  }
}};

window.MORE = (window.MORE || []).concat([D1, D2, D3, D4, D5, D6, D7, E1, E2, E3, E4, E5, E6, E7, E8, E9, E10, E11, E12]);
