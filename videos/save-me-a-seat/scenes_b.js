// scenes_b.js: pre-chorus 1, chorus 1, post-chorus 1 (0:30-1:10).
'use strict';

// ---------------------------------------------------------------- shared helpers for the rest of the song
const nearBeat = t => BEATS.reduce((a, b) => Math.abs(b - t) < Math.abs(a - t) ? b : a, BEATS[0]);
const cut = t => snapT(nearBeat(t));
function beatPos(T) {
  // a continuous beat count: 12.5 = halfway between beats 12 and 13
  let lo = 0, hi = BEATS.length - 1;
  if (T <= BEATS[0]) return (T - BEATS[0]) / 0.48;
  if (T >= BEATS[hi]) return hi + (T - BEATS[hi]) / 0.48;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (BEATS[m] <= T) lo = m; else hi = m; }
  return lo + (T - BEATS[lo]) / (BEATS[hi] - BEATS[lo]);
}
function springSeq(T, times, vals, o = {}) {
  // steps to vals[i] at times[i], overshooting and settling like a balance arm
  let i = -1; for (let k = 0; k < times.length; k++) if (T >= times[k]) i = k;
  if (i < 0) return o.v0 ?? vals[0];
  const prev = i > 0 ? vals[i - 1] : (o.v0 ?? vals[0]), dt = T - times[i];
  return vals[i] + (prev - vals[i]) * Math.exp(-dt * (o.damp ?? 5)) * Math.cos(dt * (o.freq ?? 13));
}
const hillY = (x, y0 = 800) => y0 + Math.sin(x * 0.0016 + 0.4) * 34 - x * 0.012;
const SIT = 0.42;                       // chair scale per person scale: her feet dangle a little
function sitter(x, floorY, s, look, pose = {}) {
  // someone sitting on a chair (facing right) whose seat is at chair scale SIT * s
  const R = 32 * s, seatH = 150 * SIT * s - 2 * SIT * s;
  return person(x, floorY, s, look, { view: 'side', dir: 1, ...sitPose(R, seatH), ...pose });
}
function seatedChair(x, floorY, s, look, pose = {}, chairCol) {
  const ch = fchair(x, floorY, SIT * s, { col: chairCol });
  return sitter(ch.seat[0] - 4 * s, floorY, s, look, pose);
}
function nightSky(o = {}) {
  // a night painted on the page: deeper at the top, a little lighter toward the hill, and stars
  const sd = o.seed ?? 8501;
  wash([[-1400, -1400], [3600, -1400], [3600, 1600], [-1400, 1600]], o.sky || C.night, { famp: 6, seed: sd, edge: false });
  for (let i = 0; i < 3; i++) wash([[-1400, 160 + i * 150], [3600, 160 + i * 150], [3600, 1600], [-1400, 1600]], C.night2, { fa: 0.2, famp: 8, seed: sd + 1 + i, edge: false });
  const r = mulberry(sd + 5);
  for (let i = 0; i < (o.stars ?? 40); i++) star(-900 + r() * 4000, -500 + r() * 950, 6 + r() * 8, { seed: 8510 + i, glow: 0.12 });
}
function nightPage(o = {}) { nightSky(o); if (o.hill !== false) hill(o.y0 ?? 800, { col: o.hillCol || '#d8c39c' }); }
function danceAt(T, i, style) { return dancePose(beatPos(T) * Math.PI + i * 0.9, style ?? i); }
function lineUp(items, gap, wide) {
  // cumulative offsets along a line: wide items (the T. rex) get more room
  const out = []; let o = 0;
  items.forEach((g, k) => { if (k) o += (wide(g) || wide(items[k - 1])) ? gap * 1.5 : gap; out.push(o); });
  return out;
}

// ---------------------------------------------------------------- pre-chorus 1
const B1 = { t: cut(30.29), draw(lt, T) {
  // a kitchen-table balance tips between her sign and their little house
  cam(1120, 560, lerp(1.22, 1.3, ease(lt / 2.4)));
  wash([[-200, -200], [2200, -200], [2200, 800], [-200, 800]], '#e7d3b0', { famp: 4, seed: 9101, edge: false });
  for (let x = -160; x < 2200; x += 90) line([[x, -200], [x + 4, 800]], { w: 5, col: '#d8be96', a: 0.5, seed: 9102 + x, over: 0 });
  shape(rrect(1560, 140, 360, 330, 6), { fill: C.night, seed: 9110 });
  shape(ell(1800, 240, 42, 42, 18), { fill: C.cream, seed: 9111 }); shape(ell(1818, 230, 37, 37, 18), { fill: C.night, line: false, seed: 9112 });
  line([[1740, 140], [1740, 470]], { w: 6, col: C.wood, seed: 9113 }); line([[1560, 305], [1920, 305]], { w: 6, col: C.wood, seed: 9114 });
  line([[1000, -200], [1000, 150]], { w: 2.4, seed: 9120 });
  shape([[920, 210], [950, 150], [1050, 150], [1080, 210]], { fill: '#4f6f6a', seed: 9121 }); glow(1000, 230, 520, '#ffe2a0', 0.4);
  // her, peeking over the table edge, chin on her arms, watching it
  const tilt = springSeq(T, beatsIn(30.2, 32.7), [0.55, -0.6, 0.7, -0.45, 0.25], { v0: 0 });
  const s = 2.4, R = 32 * s, d = -1, lean = 0.35, nx = 1560, ny = 760 + 4.59 * R;
  const out = person(nx, ny, s, LOOKS.narrator, { view: 'three', dir: d, seed: 34, lean, tilt: -0.08 - tilt * 0.06,
    handA: [nx - 1.0 * R, ny - 0.5 * R], handB: [nx, ny - 0.5 * R],
    face: { look: [-0.9, 0.35 + tilt * 0.45], brow: -0.45, smile: -0.25, blink: BOIL % 37 === 0 ? 1 : 0 } });
  shape([[-200, 760], [2200, 760], [2200, 1300], [-200, 1300]], { fill: C.wood, seed: 9130 });
  line([[-200, 790], [2200, 790]], { w: 2, a: 0.5, seed: 9131 });
  for (let i = 0; i < 6; i++) line([[i * 380 - 100, 850 + (i % 2) * 60], [i * 380 + 140, 860 + (i % 2) * 60]], { w: 1.4, a: 0.35, seed: 9132 + i, over: 0 });
  // her folded arms on the table, her chin on them
  const hc = out.head;
  tube([[hc[0] - 1.25 * R, 790], [hc[0] - 0.2 * R, 786], [hc[0] + 0.75 * R, 776]], 0.44 * R, 0.36 * R, shade(C.narr, 0.9), { seed: 9152 });
  shape(ell(hc[0] + 0.85 * R, 772, 0.21 * R, 0.18 * R, 12), { fill: C.skin, seed: 9153 });
  tube([[hc[0] + 1.55 * R, 792], [hc[0] + 0.5 * R, 778], [hc[0] - 0.55 * R, 768]], 0.46 * R, 0.37 * R, C.narr, { seed: 9150 });
  shape(ell(hc[0] - 0.65 * R, 764, 0.21 * R, 0.19 * R, 12), { fill: C.skin, seed: 9151 });
  // the balance: her sign (a crossed-out basilisk) on one side, their house on the other
  balance(940, 800, 1.35, tilt, (x, y, k) => {
    tinySign(x - 10 * k, y, k);
    pictogram('snake', x - 4 * k, y - 96 * k, 0.75 * k, 9140);
    line([[x - 30 * k, y - 118 * k], [x + 26 * k, y - 76 * k]], { w: 3.2, col: C.red, seed: 9145 }); line([[x + 26 * k, y - 118 * k], [x - 30 * k, y - 76 * k]], { w: 3.2, col: C.red, seed: 9146 });
  }, (x, y, k) => tinyHouse(x, y - 2, k));
}};

const B2 = { t: cut(32.715), draw(lt, T) {
  // a flip-book of moons over their roof, the two of them on it
  cam(960, 560, lerp(1.0, 1.1, ease(lt / 1.9)));
  wash([[-200, -200], [2200, -200], [2200, 1400], [-200, 1400]], '#d9c4a0', { famp: 4, seed: 9201, edge: false });
  shape([[-200, 760], [2200, 760], [2200, 1400], [-200, 1400]], { fill: C.wood, seed: 9202 });
  glow(960, 420, 700, '#ffe2a0', 0.3);
  flipbook(960, 760, 2.2, T, (i, x, y, k) => {
    const w = 280 * k, h = 190 * k, u = (i % 28) / 28;
    wash([[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]], C.night, { seed: 9210, edge: false });
    const r = mulberry(9211 + (i % 5));
    for (let j = 0; j < 9; j++) star(x - w / 2 + 14 * k + r() * (w - 28 * k), y - h / 2 + 10 * k + r() * h * 0.45, 3.5 * k, { seed: 9212 + j, w: 1.2 });
    // the moon crosses the sky and waxes and wanes, page by page
    const mx = x - w * 0.4 + u * w * 0.62, my = y - h * 0.06 - Math.sin(u * Math.PI) * h * 0.28, mr = 17 * k;
    shape(ell(mx, my, mr, mr, 16), { fill: C.cream, seed: 9230 });
    const ph = Math.cos(u * TAU * 3);
    shape(ell(mx + mr * 1.1 * Math.sign(ph || 1) * (1 - Math.abs(ph)) + mr * 0.9 * ph, my, mr * 0.95, mr * 1.02, 16), { fill: C.night, line: false, seed: 9231, edge: false });
    shape([[x - w * 0.42, y + h / 2], [x - w * 0.1, y + h * 0.12], [x + w * 0.24, y + h * 0.12], [x + w * 0.5, y + h / 2]], { fill: '#b44a3a', seed: 9240 });
    shape(rrect(x + w * 0.1, y + h * 0.0, 18 * k, 26 * k, 2 * k), { fill: '#8a6647', seed: 9241 });
    const by = y + h * 0.1;
    shape(ell(x - 12 * k, by, 12 * k, 15 * k, 10), { fill: C.narr, seed: 9242 }); shape(ell(x - 12 * k, by - 19 * k, 9 * k, 9 * k, 10), { fill: C.hairN, seed: 9243 });
    shape(ell(x + 14 * k, by, 12 * k, 15 * k, 10), { fill: C.yellow, seed: 9244 }); shape(ell(x + 14 * k, by - 20 * k, 10 * k, 10 * k, 10), { fill: C.yellow, seed: 9245 });
    line([[x - 2 * k, by - 2 * k], [x + 4 * k, by - 2 * k]], { w: 2, seed: 9246 });
  });
}};

const B3 = { t: cut(34.645), draw(lt, T) {
  // two doors the size of the sky, and gold light
  const open = ease(ramp(T, 34.9, 36.35)) * 0.86;
  cam(960, lerp(560, 520, ease(lt / 1.95)), lerp(1.0, 1.06, ease(lt / 1.95)));
  nightPage({ y0: 830, seed: 9301 });
  skyDoors(960, hillY(960, 830) + 6, 560, 640, open);
  const s = 1.6, R = 32 * s, x = 960, y = 1040;
  if (open > 0.02) wash([[x - 0.6 * R, y], [x + 0.6 * R, y], [x + 1.4 * R, y + 260 * open], [x - 1.4 * R, y + 260 * open]], '#4a3f3a', { fa: 0.5 * open, seed: 9310, edge: false });
  person(x, y, s, LOOKS.narrator, { view: 'back', seed: 35, tilt: -0.06, handA: [x - 0.9 * R, y - 2.2 * R], handB: [x + 0.9 * R, y - 2.2 * R] });
}};

function hoodDrawing(R, sd) {
  // her crayon drawing of the girl in the yellow raincoat (drawn at the sheet's centre)
  shape(rrect(-0.95 * R, -1.15 * R, 1.9 * R, 2.1 * R, 4), { fill: '#fbf6ea', seed: sd });
  const L = (pts, col, k, o = {}) => line(pts, { w: 3, col, seed: sd + k, amp: 1.6, ...o });
  const coat = [[-0.5 * R, 0.62 * R], [-0.32 * R, -0.12 * R], [0.32 * R, -0.12 * R], [0.5 * R, 0.62 * R]];
  scribble(coat, C.yellow, { gap: 7, w: 6, seed: sd + 1, a: 0.95 }); L(coat, C.yellowD, 2, { closed: true });
  scribble(ell(0, -0.42 * R, 0.36 * R, 0.36 * R, 14), C.yellow, { gap: 7, w: 6, seed: sd + 3, a: 0.95 }); L(ell(0, -0.42 * R, 0.36 * R, 0.36 * R, 14), C.yellowD, 4, { closed: true });
  scribble(ell(0, -0.38 * R, 0.21 * R, 0.24 * R, 12), '#3b302c', { gap: 5, w: 5, seed: sd + 5 });
  for (let i = 0; i < 5; i++) { const a = Math.PI * (0.75 + i * 0.37); L(ell(Math.cos(a) * 0.3 * R, -0.4 * R + Math.sin(a) * 0.3 * R, 0.07 * R, 0.07 * R, 8), C.hairL, 6 + i, { closed: true, w: 3.4 }); }
  for (const sx of [-1, 1]) scribble(rrect(sx * 0.26 * R - 0.1 * R, 0.62 * R, 0.2 * R, 0.2 * R, 2), C.boot, { gap: 5, w: 5, seed: sd + 12 + sx });
  pictogram('heart', 0.62 * R, -0.85 * R, 0.55 * R / 32, sd + 20);
}

const B4 = { t: cut(36.581), draw(lt, T) {
  // guests stream past; she holds up her drawing of a yellow hood beside each one
  cam(960, 540, 1);
  nightPage({ y0: 760, seed: 9401, stars: 30 });
  skyDoors(220, hillY(220, 760) + 4, 380, 480, 0.86);
  const order = [0, 4, 1, 'rex', 3, 6, 8, 2, 5], off = lineUp(order, 230, g => g === 'rex');
  order.forEach((g, k) => {
    const x = 450 + lt * 420 + off[3] - off[k];
    if (x < 230 || x > 2200) return;
    F.art.globalAlpha = clamp((x - 230) / 90);
    const y = hillY(x, 760) + 70, ph = T * TAU * 1.15 + k;
    if (g === 'rex') trex(x, y, 0.9, { ph: ph * 1.3 });
    else guest(g, x, y, 1.35, { view: 'three', dir: 1, ...walkPose(ph), face: { look: [0.8, 0], smile: 0.6 } });
    F.art.globalAlpha = 1;
  });
  // her, big in the foreground, comparing the drawing with each face going by. The T. rex: she doesn't bother.
  const s = 2.6, R = 32 * s, x = 1540, y = 1080 + 3.0 * R;
  const look = Math.sin(lt * 4.2) > 0 ? [-1, -0.2] : [-0.4, 0.1], rexNear = smooth(ramp(T, 37.7, 37.9)) * (1 - smooth(ramp(T, 38.5, 38.7)));
  person(x, y, s, LOOKS.narrator, { view: 'three', dir: -1, seed: 36, tilt: -0.05,
    handA: [x - 1.35 * R, y - (5.45 - rexNear * 1.6) * R], handB: [x - 0.3 * R, y - 3.3 * R], bow: 0.7,
    face: { look: rexNear ? [-0.6, 0.4] : look, brow: rexNear ? 0.4 : -0.4, smile: rexNear ? -0.1 : 0.05, blink: rexNear * 0.45 },
    hold: { A: (h, R) => { const c = F.art; c.save(); c.translate(h[0] - 0.6 * R, h[1] - 0.9 * R); c.rotate(-0.08 + rexNear * 0.5); hoodDrawing(R, 9420); c.restore(); } } });
}};

// ---------------------------------------------------------------- chorus 1: the end of the page
// rows of chairs on the hill, facing the edge; s is the size of who sits there
const ROWS = [ { y: 20, s: 1.3, x0: 760, gap: 200 }, { y: 110, s: 1.6, x0: 700, gap: 240 }, { y: 220, s: 1.95, x0: 640, gap: 290 } ];
const TEAR = 2180;
function rowSeat(ri, j) { const r = ROWS[ri], x = r.x0 + j * r.gap; return [x, hillY(x) + r.y + (j % 2) * 4, r.s]; }
function rowCount(ri, x1 = TEAR - 120) { return Math.floor((x1 - ROWS[ri].x0) / ROWS[ri].gap) + 1; }

const B5 = { t: cut(38.997), draw(lt, T) {
  // the end of the page, and stagehands snapping folded stars open into chairs
  const k = ease(lt / 4.8);
  cam(lerp(1050, 1480, k), lerp(830, 800, k), lerp(1.25, 1.1, k));
  nightPage({ seed: 9501 });
  bulbMoon(1500, 110, 64, { lit: 0.5, chain: 0, swing: Math.sin(T * 0.8) * 0.02 });
  glow(100, 700, 700, C.gold, 0.35);
  tornEdge(TEAR);
  // the back row is set; the middle and front rows pop open, a chair a beat, one stagehand on each
  const pops = beatsIn(38.95, 43.8), crews = [[1, []], [2, []]];
  pops.forEach((b, i) => crews[i % 2][1].push([b, i % 2 ? rowCount(2) - 1 - Math.floor(i / 2) : Math.floor(i / 2)]));
  for (let j = 0; j < rowCount(0); j++) { const [x, y, s] = rowSeat(0, j); fchair(x, y, SIT * s); }
  for (const [ri, list] of crews) {
    for (let j = 0; j < rowCount(ri); j++) {
      const [x, y, s] = rowSeat(ri, j), pop = list.find(p => p[1] === j);
      if (!pop) { if (!list.some(p => p[1] === j) && (ri === 1 ? j >= list.length : j < rowCount(2) - list.length)) fchair(x, y, SIT * s); continue; }
      chairPop(x, y, SIT * s, clamp((T - pop[0] + 0.05) / 0.5), { seed: 9510 + ri * 20 + j });
    }
    // the stagehand hops along to the next chair; the stack rides on a hand truck behind him
    let at = list.findIndex(([b]) => T < b + 0.3); if (at < 0) at = list.length - 1;
    const [b, j] = list[at], prev = list[Math.max(0, at - 1)], hop = at ? smooth(ramp(T, prev[0] + 0.3, b - 0.12)) : 1;
    const xj = lerp(rowSeat(ri, prev[1])[0], rowSeat(ri, j)[0], hop) + 0.42 * ROWS[ri].gap, s = ROWS[ri].s * 0.95, R = 32 * s;
    const y = rowSeat(ri, 0)[1] + 18 + (hillY(xj) - hillY(ROWS[ri].x0)) - Math.sin(hop * Math.PI) * 24 * (at ? 1 : 0), snap = smooth(1 - Math.abs(T - b) / 0.25);
    const left = list.length - list.filter(p => T >= p[0] - 0.05).length;
    dolly(xj + 0.9 * R, y, s * 0.55);
    for (let i = 0; i < left; i++) slab(xj + 1.15 * R, y - 10 - i * 15 * s * 0.55, 60 * s * 0.55, 9 * s * 0.55, { seed: 9540 + ri * 10 + i });
    person(xj, y, s, LOOKS.stagehand, { view: 'three', dir: -1, seed: 45 + ri, ...(hop > 0.02 && hop < 0.98 ? walkPose(T * 14, { amp: 0.6 }) : {}),
      handB: [xj - 1.4 * R, y - lerp(3.4, 2.5, snap) * R], handA: [xj - 0.9 * R, y - lerp(3.1, 2.3, snap) * R], face: { look: [-0.6, 0.5], smile: 0.5 } });
  }
}};

const B6 = { t: cut(43.803), draw(lt, T) {
  // she runs through history, and a T. rex in a party hat is late too
  cam(960, 540, 1);
  const u = lt * 760;
  wash([[-200, -200], [2200, -200], [2200, 1400], [-200, 1400]], C.night, { famp: 6, seed: 9601, edge: false });
  for (let i = 0; i < 3; i++) wash([[-200, 300 + i * 110], [2200, 300 + i * 110], [2200, 1400], [-200, 1400]], C.dusk, { fa: 0.22, famp: 8, seed: 9602 + i, edge: false });
  const rs = mulberry(9606); for (let i = 0; i < 26; i++) star(rs() * 1920, rs() * 420, 5 + rs() * 7, { seed: 9607 + i });
  const ridge = []; for (let x = -200; x <= 2200; x += 80) ridge.push([x, 700 + Math.sin((x + u * 0.2) * 0.004) * 40 + Math.sin((x + u * 0.2) * 0.011) * 16]);
  shape([...ridge, [2200, 1400], [-200, 1400]], { fill: '#6b6a8a', seed: 9610, raw: false });
  // landmarks at mid speed: the pyramids, a castle, a rocket on its pad
  const m = x => x - u * 0.6;
  for (const [px, ph] of [[620, 300], [930, 220], [1180, 260]]) { shape([[m(px) - ph, 860], [m(px), 860 - ph], [m(px) + ph, 860]], { fill: '#d9b97a', seed: 9620 + px }); line([[m(px), 860 - ph], [m(px) + ph * 0.35, 860]], { w: 1.6, a: 0.5, seed: 9625 + px }); }
  const cx = m(2050);
  shape([[cx - 220, 860], [cx - 220, 600], [cx + 220, 600], [cx + 220, 860]], { fill: '#a8a29a', seed: 9630 });
  for (const tx of [-240, 200]) { shape([[cx + tx, 860], [cx + tx, 500], [cx + tx + 60, 500], [cx + tx + 60, 860]], { fill: '#9a948c', seed: 9631 + tx }); shape([[cx + tx - 8, 500], [cx + tx + 30, 420], [cx + tx + 68, 500]], { fill: '#5a6d9a', seed: 9633 + tx }); }
  for (let i = 0; i < 6; i++) shape(rrect(cx - 200 + i * 70, 572, 40, 30, 2), { fill: '#a8a29a', seed: 9640 + i });
  shape(rrect(cx - 40, 760, 80, 100, 30), { fill: '#5a4636', seed: 9647 });
  line([[cx + 230, 420], [cx + 230, 340]], { w: 3, seed: 9648 }); shape([[cx + 230, 340], [cx + 290, 355], [cx + 230, 372]], { fill: C.red, seed: 9649 });
  const rx = m(3050);
  line([[rx - 120, 860], [rx - 120, 340]], { w: 6, seed: 9650 }); for (let y = 380; y < 860; y += 60) line([[rx - 120, y], [rx - 60, y + 30]], { w: 3, seed: 9651 + y });
  shape([[rx - 50, 820], [rx - 50, 470], [rx, 330], [rx + 50, 470], [rx + 50, 820]], { fill: '#e9e6e0', seed: 9660 });
  shape([[rx - 50, 760], [rx - 100, 840], [rx - 50, 820]], { fill: C.red, seed: 9661 }); shape([[rx + 50, 760], [rx + 100, 840], [rx + 50, 820]], { fill: C.red, seed: 9662 });
  shape(ell(rx, 520, 22, 22, 12), { fill: C.glass, seed: 9663 });
  // the ground, fast, changing underfoot: sand, grass, the launch pad
  const seam = (x0, k) => { const P = []; for (let i = 0; i <= 8; i++) { const yy = 860 + i * 55; P.push([x0 - i * 22 + Math.sin(i * 1.7 + k) * 18, yy]); } return P; };
  for (const [w0, w1, col, sd] of [[-400, 1550, '#d8bd86', 9670], [1500, 2950, '#8fae6e', 9671], [2900, 6000, '#a3a3a3', 9672]]) {
    const a = w0 - u, b = w1 - u; if (b < -300 || a > 2300) continue;
    shape([...seam(a, sd), ...seam(b, sd + 1).reverse()], { fill: col, seed: sd, line: false, edge: false, raw: true });
  }
  for (let i = 0; i < 9; i++) { const tx = 1500 - u - i * 22 + Math.sin(i * 1.7 + 9672) * 18 + 10, ty = 870 + i * 50; if (tx > -100 && tx < 2100) line([[tx, ty], [tx + 6, ty - 18], [tx + 12, ty]], { w: 2, col: '#5d7a4a', seed: 9675 + i, over: 0 }); }
  line([[-200, 860], [2200, 862]], { w: 2.6, seed: 9680 });
  for (let i = 0; i < 12; i++) { const x = ((i * 260 - u) % 2600 + 2600) % 2600 - 300; line([[x, 940 + (i % 3) * 50], [x + 70, 940 + (i % 3) * 50]], { w: 2, a: 0.5, seed: 9681 + i, over: 0 }); }
  // the T. rex, a few steps behind, and her, glancing at her watch
  trex(380 + Math.sin(T * 1.3) * 30, 900, 0.85, { ph: T * TAU * 1.8 });
  for (let k = 0; k < 3; k++) puff(260 - k * 50, 890, 26, ((T * 1.8 + k / 3) % 1), 9690 + k * 4);
  const s = 1.5, R = 32 * s, x = 1060, y = 900, wp = walkPose(T * TAU * 2.3, { run: true });
  const glance = smooth(ramp(T, 45.0, 45.25)) * (1 - smooth(ramp(T, 46.0, 46.25)));
  person(x, y, s, LOOKS.narrator, { view: 'side', dir: 1, ...wp, seed: 37,
    ...(glance > 0.05 ? { handA: [x + lerp(0.4, 1.15, glance) * R, y - lerp(3.6, 4.5, glance) * R], bow: 0.5 } : {}),
    hold: { A: (h, R) => { if (glance > 0.05) { shape(ell(h[0] - 0.14 * R, h[1] + 0.06 * R, 0.14 * R, 0.14 * R, 10), { fill: C.cream, seed: 9697, w: 2 }); line([[h[0] - 0.14 * R, h[1] + 0.06 * R], [h[0] - 0.14 * R, h[1] - 0.04 * R]], { w: 1.4, seed: 9698 }); } } },
    face: { look: glance > 0.3 ? [0.5, 1] : [1, 0], brow: -0.4 - glance * 0.2, open: 0.25, smile: 0 } });
  for (let k = 0; k < 2; k++) puff(x - 1.2 * R, y - 0.2 * R, 22, ((T * 2.3 + k / 2) % 1), 9695 + k * 4);
  for (let i = 0; i < 3; i++) line([[x - 1.6 * R - i * 30, y - 4.6 * R + i * 40], [x - 2.6 * R - i * 30, y - 4.6 * R + i * 40]], { w: 2.2, a: 0.5, seed: 9699 + i });
}};

const B7 = { t: cut(47.168), draw(lt, T) {
  // they come out of the light and down the hill, the janitor holding the door
  cam(lerp(900, 1000, ease(lt / 2.9)), 600, 0.98);
  nightPage({ seed: 9701, y0: 790 });
  const dx = 260, dy = hillY(dx, 790) + 6;
  skyDoors(dx, dy, 420, 600, 0.9);
  const order = [0, 1, 3, 4, 'rex', 2, 5, 7, 9, 6, 8, 10, 11, 12], off = lineUp(order, 175, g => g === 'rex');
  order.forEach((g, k) => {
    const x = dx + 60 + (lt + 2.2) * 280 - off[k];
    if (x < dx - 10 || x > 2400) return;
    F.art.globalAlpha = clamp((x - dx + 10) / 110);
    const y = hillY(x, 790) + 80, ph = (lt + k * 0.37) * TAU * 1.05;
    if (g === 'rex') trex(x, y, 0.9, { ph: ph * 1.2 });
    else {
      const R = 32 * 1.25, wave = (k % 4 === 1) ? { handA: [x + 0.6 * R, y - (6.3 + 0.3 * Math.sin(T * 9 + k)) * R] } : {};
      guest(g, x, y, 1.25, { view: 'three', dir: 1, ...walkPose(ph), ...wave, face: { look: k % 3 ? [1, 0] : [0, 0.2], smile: 0.7, blink: (BOIL + k * 5) % 43 === 0 ? 1 : 0 } });
    }
    F.art.globalAlpha = 1;
  });
  // the janitor holds the door, ushering them in with his mop
  const jx = dx - 250, jy = hillY(jx, 790) + 40, R = 32 * 1.2;
  line([[jx - 0.6 * R, jy - 0.1 * R], [jx - 1.3 * R, jy - 5.4 * R]], { w: 4, seed: 9720 });
  shape([[jx - 0.9 * R, jy], [jx - 0.2 * R, jy], [jx - 0.4 * R, jy - 0.5 * R], [jx - 0.75 * R, jy - 0.5 * R]], { fill: '#d6d1c8', seed: 9721 });
  person(jx, jy, 1.2, LOOKS.janitor, { view: 'front', seed: 52, handA: [jx - 1.1 * R, jy - 3.6 * R], handB: [jx + 1.5 * R, jy - (3.6 + 0.5 * Math.sin(T * 7)) * R], face: { look: [0.8, 0], smile: 0.6 } });
}};

const B8 = { t: cut(50.053), draw(lt, T) {
  // a party under the moon, which is a mirror ball now
  const k = ease(lt / 3.85);
  cam(960, lerp(700, 470, k), lerp(1.05, 0.95, k));
  nightPage({ seed: 9801, y0: 820, stars: 50 });
  discoMoon(960, 130, 96, T);
  lightSpots(T, 9, { seed: 9810, y0: 860, y1: 1080 });
  const back = [[300, 1], [520, 4], [760, 9], [1200, 2], [1430, 6], [1650, 11]];
  back.forEach(([x, g], i) => guest(g, x, 880, 0.95, { view: 'front', ...danceAt(T, i), face: { smile: 0.8, blink: 1 } }));
  trex(980, 930, 1.0, { ph: beatPos(T) * Math.PI });
  const front = [[170, 10], [430, 7], [700, 0], [1290, 5], [1560, 3], [1800, 12]];
  front.forEach(([x, g], i) => guest(g, x, 1050, 1.25, { view: 'front', ...danceAt(T, i + 3), face: { smile: 0.85, blink: i % 2, open: 0.3 } }));
}};

const B9 = { t: cut(53.899), draw(lt, T) {
  // she walks the row; every seat is saved, with a hat, a helmet, a crown. None is hers.
  const s = 1.6, R = 32 * s, x = lerp(380, 2650, lt / 4.8), y = 1010;
  cam(x + 220, 680, 1.15);
  nightSky({ seed: 9901, stars: 30 }); hill(780);
  glow(-300, 760, 1000, '#ffe2a0', 0.35);
  // far back, the owners are off dancing
  F.art.globalAlpha = 0.5;
  for (let j = 0; j < 14; j++) guest(j * 5 + 2, -100 + j * 260, 790, 0.55, { view: 'front', ...danceAt(T, j), face: { smile: 0.8, blink: 1 } });
  F.art.globalAlpha = 1;
  const items = ['party', 'roman', 'coat', 'crown', 'knight', 'cane', 'bubble', 'nemes', 'club', 'feather', 'bighat', 'horns', 'party'];
  const cs = SIT * s;
  items.forEach((it, j) => { const cx = 380 + j * 210, ch = fchair(cx, 900, cs, { col: j % 4 === 3 ? '#9aa0a8' : '#8b96a3' }); saved(it, ch.seat[0] + 4, ch.seat[1] - 3, s * 0.8, 9910 + j * 9); });
  const near = items.reduce((a, it, j) => Math.max(a, smooth(1 - Math.abs(x - (380 + j * 210) - 70) / 110)), 0);
  person(x, y, s, LOOKS.narrator, { view: 'three', dir: 1, ...walkPose(lt * TAU * 1.5), seed: 38, lean: near * 0.06,
    face: { look: near > 0.4 ? [-0.7, -0.6] : [1, 0], brow: -0.35 - near * 0.2, smile: -0.1 } });
}};

const B10 = { t: cut(58.699), draw(lt, T) {
  // at the very edge, her hand on the empty chair beside her
  const k = ease(lt / 3.35);
  cam(960, lerp(660, 610, k), lerp(1.12, 1.0, k));
  wash([[-600, -400], [2600, -400], [2600, 1600], [-600, 1600]], '#d8c39c', { seed: 10001, edge: false });
  for (let i = 0; i < 9; i++) line([[-600, 700 + i * i * 9], [2600, 702 + i * i * 9]], { w: 1.4, a: 0.3, seed: 10002 + i, over: 0 });
  tornEdgeH(640);
  glow(960, 1300, 900, '#ffe2a0', 0.25);
  const s = 2.2, R = 32 * s, fy = 1080, cs = SIT * s * 1.05, seatH = 150 * cs;
  const lean = smooth(ramp(T, 60.3, 61.3)), x1 = 860, x2 = x1 + 136 * cs * 1.35;
  person(x1, fy, s, LOOKS.narrator, { view: 'back', seed: 39, legK: (seatH - 0.16 * R) / (2.6 * R), tilt: 0.14 * lean, lean: 0.05 * lean,
    handA: [x1 - 0.75 * R, fy - seatH - 0.15 * R], handB: [x2 - 0.25 * R, fy - seatH - 0.3 * R] });
  chairBack(x1, fy, cs, { sat: true });
  chairBack(x2, fy, cs);
  // her hand, resting on the empty seat (drawn over the chair's back edge)
  shape(ell(x2 - 0.25 * R, fy - seatH - 0.28 * R, 0.21 * R, 0.17 * R, 12), { fill: C.skin, seed: 10020, w: 2 });
}};

// ---------------------------------------------------------------- post-chorus 1
const B11 = { t: cut(62.048), draw(lt, T) {
  // the party: a knight swings a grandma, a king does the robot, a pharaoh walks like an Egyptian; she stands still in it
  const k = ease(lt / 4.8), bp = beatPos(T);
  cam(lerp(780, 1460, k), 760, 1.1);
  nightPage({ seed: 10101, y0: 820, stars: 50 });
  lightSpots(T, 12, { seed: 10110, y0: 880, y1: 1150, x1: 2400 });
  for (let j = 0; j < 10; j++) guest(j * 3 + 1, 80 + j * 250, 900, 0.9, { view: 'front', ...danceAt(T, j), face: { smile: 0.8, blink: 1 } });
  trex(420, 1040, 1.1, { ph: bp * Math.PI });
  // knight and grandma, swinging round each other
  const th = bp * Math.PI / 2, sc = 880, R0 = 32 * 1.2;
  const pair = [[LOOKS.knight, 0], [LOOKS.grandma, Math.PI]].map(([lk, o]) => [lk, sc + Math.cos(th + o) * 105, 1080 + Math.sin(th + o) * 24]).sort((a, b) => a[2] - b[2]);
  const mid = [(pair[0][1] + pair[1][1]) / 2, 1080 - 3.3 * R0];
  pair.forEach(([lk, x, y], i) => person(x, y, 1.2, lk, { view: 'front', seed: 620 + i * 9, ...dancePose(bp * Math.PI, 1), handA: mid, handB: mid, face: { smile: 0.9, blink: 1 } }));
  // the king does the robot: a new pose every beat
  const kb = Math.floor(bp) % 4, R = 32 * 1.25, kx = 1280, ky = 1090;
  const robot = [[[-1.2, 4.3], [1.2, 3.0]], [[-1.2, 3.0], [1.2, 4.3]], [[-0.4, 5.8], [1.4, 3.6]], [[-1.4, 3.6], [0.4, 5.8]]][kb];
  person(kx, ky, 1.25, LOOKS.king, { view: 'front', seed: 640, arms: 'short', handA: [kx + robot[0][0] * R, ky - robot[0][1] * R], handB: [kx + robot[1][0] * R, ky - robot[1][1] * R], tilt: [0.1, -0.1, 0, 0][kb], face: { smile: 0.4, look: [kb % 2 ? 1 : -1, 0] } });
  // the pharaoh walks like an Egyptian
  const px = 1580 + Math.sin(bp * Math.PI / 4) * 60, P = 32 * 1.2;
  person(px, 1080, 1.2, LOOKS.pharaoh, { view: 'side', dir: 1, seed: 650, ...walkPose(bp * Math.PI, { amp: 0.6 }), arms: 'short',
    handA: [px + 1.4 * P, 1080 - 6.0 * P], handB: [px - 1.2 * P, 1080 - 2.6 * P], face: { smile: 0.6 } });
  // the astronaut drifts, a little above the floor
  const ay = 1060 - 40 - Math.sin(T * 1.6) * 30;
  person(2240, ay, 1.15, LOOKS.astronaut, { view: 'three', dir: -1, seed: 660, tilt: Math.sin(T * 0.9) * 0.2, lean: Math.sin(T * 0.7) * 0.15, legA: [0.4, 0.6], legB: [-0.2, 0.3], armA: [2.2, 0.3], armB: [1.4, 0.6], face: { smile: 0.7 } });
  // her: the only one not dancing, looking for someone
  const nx = 1900, ns = 1.4, N = 32 * ns;
  person(nx, 1130, ns, LOOKS.narrator, { view: 'front', seed: 40, face: { look: [Math.sin(T * 1.7) > 0 ? 1 : -1, 0], brow: -0.4, smile: -0.1 }, handA: [nx - 0.7 * N, 1130 - 2.5 * N], handB: [nx + 0.7 * N, 1130 - 2.5 * N] });
}};

const B12 = { t: cut(66.848), draw(lt, T) {
  // a flash of yellow: she pushes through the party and taps its shoulder. It is a fisherman in a sou'wester.
  const push = ease(ramp(T, 68.3, 69.0));
  cam(lerp(1000, 1260, push), lerp(640, 600, push), lerp(1.1, 1.55, push));
  nightPage({ seed: 10201, y0: 800, stars: 40 });
  lightSpots(T, 7, { seed: 10210, y0: 860, y1: 1100 });
  for (let j = 0; j < 7; j++) guest(j * 2 + 3, 200 + j * 270, 860, 0.85, { view: 'front', ...danceAt(T, j), face: { smile: 0.8, blink: 1 } });
  const fs = 1.6, FR = 32 * fs, fx = 1440, fy = 1010;
  const turned = T >= 68.95, turning = T >= 68.75 && T < 68.95;
  person(fx, fy, fs, LOOKS.fisherman, { view: turned ? 'three' : turning ? 'side' : 'back', dir: -1, seed: 670,
    handA: turned && T > 69.25 ? [fx - 1.1 * FR, fy - (5.9 + 0.35 * Math.sin(T * 11)) * FR] : undefined,
    face: { smile: 0.9, look: [-0.6, 0.3] }, after: o => { if (turned) pipe(o.head[0] - 0.42 * o.R, o.head[1] + 0.45 * o.R, fs, -1); } });
  const s = 1.35, R = 32 * s, run = ramp(T, 67.3, 68.45), x = lerp(520, fx - 2.8 * FR, smooth(run)), sad = smooth(ramp(T, 69.1, 69.6));
  const notice = smooth(ramp(T, 66.95, 67.15));
  const pose = run > 0 && run < 1 ? { view: 'side', ...walkPose(T * TAU * 2.4, { run: true }) } : { view: 'three' };
  const tap = T >= 68.45 && T < 69.2 ? { handA: [fx - 0.6 * FR, fy - 4.3 * FR] } : {};
  person(x, fy, s, LOOKS.narrator, { dir: 1, seed: 41, ...pose, ...tap, lean: sad * -0.06,
    face: { look: [1, -0.4], lift: notice * (1 - sad) * 1.2, brow: -0.2 - sad * 0.5, smile: lerp(0.3 * notice, -0.3, sad), open: notice * (1 - run) * 0.3 } });
  if (sad > 0.2) puff(x + 1.1 * R, fy - 5.0 * R, 26, ramp(T, 69.3, 70.1), 10230);
}};

window.MORE = (window.MORE || []).concat([B1, B2, B3, B4, B5, B6, B7, B8, B9, B10, B11, B12]);
