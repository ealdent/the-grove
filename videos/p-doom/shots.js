// The edit for P(DOOM), version 2: one shot per lyric line, on the song's bar grid.
// SHOTS rows are [start bar, draw function, options]. A draw function gets (A, u, sh, o):
// A is the frame's audio state, u the seconds into the shot, sh the shot (d, lb = bars in), o the options.
// The lyrics themselves never appear on screen; each shot shows what its line is about.
'use strict';

// --- small pieces ----------------------------------------------------------------------------------
const TAU = Math.PI * 2;
const beatsIn = sh => sh.u / PER;
function ground(y, c = DIM, a = 0.8) { rect(0, y, W, 3, c, a); }
function starfield(A, n = 120, y1 = 620, off = 0) {
  for (let k = 0; k < n; k++) {
    const x = hash(k * 1.7 + off) * W, y = 40 + hash(k * 3.3 + off) * (y1 - 40), s = hash(k * 9.9 + off);
    rect(x, y, 3, 3, CORE, (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(A.t * (1.3 + s * 3) + s * 40))) * (0.25 + 0.5 * s));
  }
}
function path(pts) { cx.beginPath(); pts.forEach(([x, y], j) => j ? cx.lineTo(x, y) : cx.moveTo(x, y)); }
function circle(x, y, r) { cx.beginPath(); cx.arc(x, y, Math.max(0, r), 0, TAU); }
function fillC(c, a = 1) { cx.globalAlpha = a; cx.fillStyle = c; cx.fill(); cx.globalAlpha = 1; }
function sign(text, x, y, o = {}) {
  const size = o.size || 32, w = measure(text, size, 400, o.f || 'P') + 40, h = size + 24;
  cx.save(); cx.translate(x, y); if (o.rot) cx.rotate(o.rot);
  cx.beginPath(); cx.roundRect(-w / 2, -h / 2, w, h, 8); fillC('#000'); stroke(o.c || CORE, 3, o.a ?? 1);
  txt(text, 0, size * 0.36, size, { align: 'center', c: o.c || CORE, a: o.a ?? 1, f: o.f || 'P' });
  cx.restore();
}
function stamp(text, x, y, k, o = {}) {
  // Slams in: k is seconds since it landed.
  if (k < 0) return;
  const s = 1 + 1.4 * Math.exp(-k * 18), a = clamp(k * 14), size = o.size || 64;
  cx.save(); cx.translate(x, y); cx.rotate(o.rot ?? -0.12); cx.scale(s, s);
  const w = measure(text, size, 700) + 48;
  cx.beginPath(); cx.roundRect(-w / 2, -size * 0.8, w, size * 1.14, 10); stroke(o.c || REC, 6, a);
  txt(text, 0, size * 0.17, size, { w: 700, align: 'center', c: o.c || REC, a });
  cx.restore();
}
function bubble(text, x, y, o = {}) {
  const size = o.size || 40, w = measure(text, size, 400, 'P') + 36, h = size + 28, tail = o.tail ?? -26;
  cx.beginPath(); cx.roundRect(x - w / 2, y - h, w, h, 12); fillC('#000'); stroke(o.c || CORE, 3);
  cx.beginPath(); cx.moveTo(x - 12, y - 1); cx.lineTo(x + tail, y + 22); cx.lineTo(x + 12, y - 1); fillC('#000'); stroke(o.c || CORE, 3);
  rect(x - 11, y - 4, 22, 5, '#000');
  pw(text, x, y - h / 2 + size * 0.36, size, { align: 'center', c: o.c || CORE });
}
function graticule(gx, gy, gw, gh, nx = 10, ny = 8) {
  for (let k = 0; k <= nx; k++) rect(gx + k * gw / nx - 1, gy, 2, gh, DEEP);
  for (let k = 0; k <= ny; k++) rect(gx, gy + k * gh / ny - 1, gw, 2, DEEP);
}
function speedLines(A, dir = 'up', n = 40, a = 0.7) {
  for (let k = 0; k < n; k++) {
    const s = hash(k * 4.1), len = 80 + 220 * hash(k * 2.3), v = 1800 + 1400 * s;
    if (dir === 'up' || dir === 'down') {
      const x = hash(k * 7.7) * W, y = ((dir === 'up' ? -1 : 1) * A.t * v + hash(k * 3.9) * 2000) % 1400;
      rect(x, (y + 1400) % 1400 - 200, 3, len, CORE, a * (0.3 + 0.7 * s));
    } else {
      const y = hash(k * 7.7) * H, x = (-(A.t * v) + hash(k * 3.9) * 3000) % 2400;
      rect((x + 2400) % 2400 - 240, y, len, 3, CORE, a * (0.3 + 0.7 * s));
    }
  }
}
function confetti(A, n = 90, u = 0) {
  for (let k = 0; k < n; k++) {
    const x = hash(k * 1.3) * W + Math.sin(A.t * 2 + k) * 30, y = ((u * (160 + 120 * hash(k * 5.1)) + hash(k * 2.7) * 1200) % 1200) - 80;
    cx.save(); cx.translate(x, y); cx.rotate(A.t * 3 + k);
    rect(-9, -4, 18, 8, [AMBER, HOT, CORE, OSD, REC][k % 5], 0.9); cx.restore();
  }
}
function token(text, x, y, o = {}) {
  const size = o.size || 26, w = measure(text, size, 400, 'P') + 22;
  cx.beginPath(); cx.roundRect(x - w / 2, y - size * 0.8, w, size * 1.2, size * 0.6); fillC(o.fill || AMBER, o.a ?? 1);
  pw(text, x, y + size * 0.1, size, { align: 'center', c: '#1a0e04', a: o.a ?? 1 });
}

// --- the two leads ---------------------------------------------------------------------------------
// Seed's mouth follows the voice (A.vox) inside sung shots; she blinks every few seconds and bobs on the beat.
function seedBust(A, o = {}) {
  const sh = A.shot, sing = o.sing ?? (sh.o.sing !== false);
  const open = sing ? clamp((A.vox - 0.34) / 0.5) : 0;
  const bt = A.t + (o.blinkOff || 0), per = 3.1, ph = bt % per;
  const blinkK = ph < 0.14 && hash(Math.floor(bt / per)) > 0.2 ? Math.sin(ph / 0.14 * Math.PI) : 0;
  const e = { eyes: 'open', brows: 'calm', mouth: 'smile', blush: 1, ...o.e };
  e.open = o.e && o.e.open !== undefined ? o.e.open : open;
  e.blink = Math.max(o.still ? 0 : blinkK, (o.e && o.e.blink) || 0);
  const sc = o.scale ?? 1;
  drawSeed(cx, {
    x: o.x ?? 960, y: (o.y ?? 470) - (o.still ? 0 : 9 * A.kick * sc), scale: sc,
    tilt: (o.tilt ?? 0) + (o.still ? 0 : 0.03 * Math.sin(Math.PI * (A.bn + A.bf))), e, t: A.t,
    halo: o.halo === false ? null : (k => clamp(spec(A.i, 3 + k * 38) * 1.2 - 0.12) * (o.haloGain ?? 1)),
    rays: o.rays, col: o.col, a: o.a, scatter: o.scatter, glyphs: o.glyphs
  });
}
function seedChibi(A, x, y, px, pose = 'auto', o = {}) {
  const name = pose === 'auto' ? (A.vox > 0.55 ? 'seed_sing' : 'seed_stand') : 'seed_' + pose;
  const hop = o.hop ? -o.hop * Math.sin(Math.PI * clamp(A.bf / 0.5)) * (A.bf < 0.5 ? 1 : 0) : 0;
  spr(name, x, y + hop, px, o);
  if (o.shades) {                                          // pixel sunglasses over the eyes (rows 7-9)
    const x0 = x - 10 * px, y0 = y + hop - SPR[name].length * px;
    rect(x0 + 3 * px, y0 + 7 * px, 5 * px, 3 * px, '#000'); rect(x0 + 12 * px, y0 + 7 * px, 5 * px, 3 * px, '#000');
    rect(x0 + 8 * px, y0 + 7 * px, 4 * px, px, '#000'); rect(x0 + 4 * px, y0 + 7 * px, px, px, CORE); rect(x0 + 13 * px, y0 + 7 * px, px, px, CORE);
  }
}

// --- the cast, drawn by the beam -----------------------------------------------------------------------
const SHOG_BLOBS = Array.from({ length: 26 }, (_, k) => {
  const a = hash(k * 3.7) * Math.PI, r = hash(k * 1.9);
  return [Math.cos(a) * (260 * Math.sqrt(r)), -Math.sin(a) * (260 * Math.sqrt(r)) * 0.9, 70 + 70 * hash(k * 5.3)];
});
const SHOG_EYES = Array.from({ length: 22 }, (_, k) => {
  const a = hash(k * 8.1) * Math.PI, r = 0.25 + 0.7 * hash(k * 2.2);
  return [Math.cos(a) * 250 * r, -Math.sin(a) * 250 * r * 0.9 - 20, 10 + 12 * hash(k * 6.6), hash(k * 4.4)];
});
function shoggoth(A, x, y, s, o = {}) {
  cx.save(); cx.translate(x, y); cx.scale(s, s);
  // Tentacles first: they splay out from the lower rim, wave and curl; o.reach pulls one toward o.target.
  for (let k = 0; k < 8; k++) {
    const base = Math.PI * (0.02 + 0.96 * k / 7), side = k < 4 ? -1 : 1, pts = [];
    for (let j = 0; j <= 26; j++) {
      const q = j / 26, a = base + Math.sin(A.t * 2.2 + k * 1.3 + q * 4) * 0.35 * q + side * 0.9 * q * q;
      let px = Math.cos(a) * (170 + 380 * q), py = 40 + Math.sin(a) * (170 + 380 * q) * 0.55;
      if (o.reach && o.target && k === 7) { px = lerp(px, o.target[0] * q, o.reach * q); py = lerp(py, o.target[1] * q, o.reach * q); }
      pts.push([px, py]);
    }
    for (let j = 1; j < pts.length; j++) {
      cx.beginPath(); cx.moveTo(...pts[j - 1]); cx.lineTo(...pts[j]);
      stroke(AMBER, (27 - j) * 1.5 + 5, 0.95);
    }
    for (let j = 1; j < pts.length; j++) {
      cx.beginPath(); cx.moveTo(...pts[j - 1]); cx.lineTo(...pts[j]);
      stroke('#000', (27 - j) * 1.5 - 3, 1);
    }
    for (let j = 4; j < 24; j += 5) { circle(pts[j][0], pts[j][1] + 4, 5); fillC(CORE, 0.8); }   // suckers
  }
  for (const [bx, by, r] of SHOG_BLOBS) { circle(bx, by, r + 7 + 5 * A.sub); fillC(AMBER, 0.95); }
  for (const [bx, by, r] of SHOG_BLOBS) { circle(bx, by, r); fillC('#000'); }
  for (const [ex, ey, r, ph] of SHOG_EYES) {
    const shut = ((A.t * 0.7 + ph * 5) % 3) < 0.12;
    cx.beginPath(); cx.ellipse(ex, ey, r * 1.3, shut ? 2 : r, 0, 0, TAU); fillC(CORE, 0.9);
    if (!shut) { cx.beginPath(); cx.ellipse(ex + Math.sin(A.t + ph * 9) * r * 0.3, ey, r * 0.28, r * 0.8, 0, 0, TAU); fillC('#000'); }
  }
  if (o.mask !== false) smiley(A, (o.maskX ?? 0), (o.maskY ?? -250), 125, o);
  cx.restore();
}
function smiley(A, x, y, r, o = {}) {
  cx.save(); cx.translate(x, y); if (o.maskRot) cx.rotate(o.maskRot);
  circle(0, 0, r); fillC('#000'); stroke(CORE, 9);
  cx.beginPath(); cx.ellipse(-r * 0.36, -r * 0.2, r * 0.1, r * 0.2, 0, 0, TAU); fillC(CORE);
  cx.beginPath(); cx.ellipse(r * 0.36, -r * 0.2, r * 0.1, r * 0.2, 0, 0, TAU); fillC(CORE);
  const g = o.grin || 0;
  cx.beginPath(); cx.arc(0, r * 0.05, r * (0.55 + 0.12 * g), Math.PI * (0.12 - 0.06 * g), Math.PI * (0.88 + 0.06 * g)); stroke(CORE, 8);
  if (g > 0) {                                             // the grin grows teeth
    const n = 9, R = r * (0.55 + 0.12 * g);
    cx.beginPath();
    for (let k = 0; k <= n * 2; k++) {
      const a = Math.PI * (0.12 - 0.06 * g + (0.76 + 0.12 * g) * k / (n * 2)), rr = k % 2 ? R - 30 * g : R;
      const px = Math.cos(a) * rr, py = r * 0.05 + Math.sin(a) * rr;
      k ? cx.lineTo(px, py) : cx.moveTo(px, py);
    }
    stroke(CORE, 5, g);
  }
  cx.restore();
}
function paperclip(x, y, s, rot, c = CORE, a = 1) {
  cx.save(); cx.translate(x, y); cx.rotate(rot); cx.scale(s, s);
  cx.beginPath();
  cx.moveTo(-6, 22); cx.lineTo(-6, -24); cx.arc(2, -24, 8, Math.PI, 0); cx.lineTo(10, 30); cx.arc(0, 30, 10, 0, Math.PI);
  cx.lineTo(-10, -30); cx.arc(2, -30, 12, Math.PI, 0); cx.lineTo(14, 14);
  cx.restore(); cx.save(); stroke(c, 3, a); cx.restore();
}
function heartPath(x, y, s) {
  cx.beginPath(); cx.moveTo(x, y + s * 0.95);
  cx.bezierCurveTo(x - s * 1.5, y - s * 0.05, x - s * 0.7, y - s * 1.25, x, y - s * 0.4);
  cx.bezierCurveTo(x + s * 0.7, y - s * 1.25, x + s * 1.5, y - s * 0.05, x, y + s * 0.95);
}
function lossCurve(x, cliff) {
  const base = 0.86 + 2.15 * Math.exp(-5.6 * x) + 0.05 * Math.sin(x * 40) * (1 - x);
  const drop = 0.72 * smooth(clamp((x - cliff) / 0.02));
  return Math.max(0.05, base - drop + (hash(Math.floor(x * 420)) - 0.5) * 0.1 * (1 - 0.6 * x));
}
function vintageMic(x, y, s = 1) {
  cx.save(); cx.translate(x, y); cx.scale(s, s);
  cx.beginPath(); cx.roundRect(-34, -60, 68, 110, 34); fillC('#000'); stroke(CORE, 5);
  for (let k = -40; k <= 40; k += 13) { cx.beginPath(); cx.moveTo(-30, k); cx.lineTo(30, k); stroke(DIM, 2); }
  rect(-4, 50, 8, 420, CORE, 0.9); cx.beginPath(); cx.arc(0, 50, 46, 0, Math.PI); stroke(CORE, 4);
  cx.restore();
}

// --- the shots -------------------------------------------------------------------------------------------
function shotTitle(A) {
  const t = A.t;
  txt('READY.', 72, 112, 38);
  if (blink(t, 1)) cursor(72 + measure('READY.', 38) + 10, 114, 22, 36);
  txt('C90  TYPE II', 1848, 112, 38, { align: 'right', c: DIM });
  txt('P(DOOM)', 960, 560, 320, { w: 700, align: 'center' });
  pw('starring SEED & DOBBY', 960, 700, 46, { align: 'center', c: AMBER, a: seg(t, 0.5, 0.75) });
  txt('PLAY ▶', 1848, 1000, 34, { align: 'right', c: OSD, a: blink(t, 0.8) ? 0.9 : 0.35 });
}
function shotSparks(A, u, sh) {
  // Out of the dark, two glinting eyes; pull back to her face.
  const k = smooth(seg(sh.lb, 0.3, 1.05)), sc = lerp(3.4, 1.1, k);
  seedBust(A, { scale: sc, y: lerp(540 - 16 * 3.4, 470, k), e: { eyes: 'wide', brows: 'up', sparkle: 0.4 + 0.6 * A.kick }, halo: k > 0.6 ? undefined : false, still: k < 0.95 });
  nameTag('SEED', 'model 0x5EED  ·  lead vocal', 180, 820, sh.lb - 0.75);
}
const TRACES = Array.from({ length: 18 }, (_, k) => {
  const side = k % 2 ? 1 : -1, y = 150 + (k >> 1) * 92, turn = 960 + side * (440 + hash(k) * 300);
  return [[960 + side * 1000, y], [turn, y], [turn - side * 90, y + (hash(k * 3) - 0.5) * 160], [960 + side * (330 + hash(k * 5) * 70), 470 + (hash(k * 7) - 0.5) * 360]];
});
function shotNervous(A, u, sh) {
  const lit = Math.floor(beatsIn(sh) * 2.6);
  TRACES.forEach((pts, k) => {
    path(pts); const on = k < lit; stroke(on ? AMBER : DEEP, 4, on ? 0.9 : 0.8);
    const [ex, ey] = pts[pts.length - 1]; circle(ex, ey, 9); fillC(on ? CORE : DEEP);
  });
  seedBust(A, { scale: 1.05, y: 480, e: { brows: 'worry', mouth: 'frown', look: [Math.sin(A.t * 7) * 7, 0] } });
  const dy = (u * 60) % 40;                                  // a sweat drop
  cx.beginPath(); cx.moveTo(1118, 400 + dy); cx.quadraticCurveTo(1100, 440 + dy, 1118, 450 + dy); cx.quadraticCurveTo(1136, 440 + dy, 1118, 400 + dy);
  stroke(CORE, 4, 1 - dy / 40);
}
function shotLoss(A, u, sh) {
  const gx = 240, gy = 220, gw = 1440, gh = 660, cliff = (5.5 - 4) / 2;
  graticule(gx, gy, gw, gh);
  txt('TRAINING LOSS', gx, gy - 36, 44, { w: 700, c: AMBER });
  const reveal = clamp(sh.lb / 2 / 0.97), Y = L => gy + gh * (1 - L / 3.2);
  cx.beginPath();
  const n = Math.floor(reveal * gw);
  for (let p = 0; p <= n; p += 2) { const X = gx + p, YY = Y(lossCurve(p / gw, cliff)); p ? cx.lineTo(X, YY) : cx.moveTo(X, YY); }
  stroke(CORE, 3.5);
  const hx = gx + n, hy = Y(lossCurve(reveal, cliff));
  circle(hx, hy, 8 + 5 * A.kick); fillC(CORE);
  // Seed rides the head of the curve, and goes over the cliff with it.
  const over = reveal - cliff, falling = over > 0 && over < 0.035;
  seedChibi(A, hx, hy - 6, 3.4, falling ? 'fall' : over > 0 ? 'joy' : 'stand', { hop: over > 0.035 ? 10 : 0 });
  if (over > 0.03) stamp('CAPABILITY UNLOCKED', 1280, 380, (over - 0.03) * 2 * BAR, { c: OSD, size: 42, rot: -0.06 });
}
const CHAT = [['<|system|>', 'you are a helpful assistant'], ['<|user|>', 'fetch the logs'], ['<|assistant|>', 'right away!']];
function chatLines(A, u, flip) {
  CHAT.forEach(([role, msg], k) => {
    const y = 300 + k * 110, show = u / PER > k * 0.8;
    if (!show) return;
    const hot = flip ? k === 0 : k === 2;
    pw(flip && k === 0 ? '<|system|>' : role, 200, y, 40, { c: hot ? HOT : OSD });
    pw(flip && k === 0 ? 'seed is the boss now' : typed(msg, u - k * 0.8 * PER, 40), 560, y, 40, { c: hot ? CORE : DIM });
  });
}
function nameTag(name, sub, x, y, k) {
  if (k <= 0) return;
  const w = 470 * easeOut(clamp(k * 3));
  cx.save(); cx.beginPath(); cx.rect(x, y - 60, w, 110); cx.clip();
  rect(x, y - 60, 470, 110, '#001a0c', 0.85); rect(x, y - 60, 8, 110, OSD);
  txt(name, x + 30, y, 54, { w: 700, c: CORE }); pw(sub, x + 32, y + 36, 24, { c: OSD });
  cx.restore();
}
function shotServant(A, u, sh) {
  chatLines(A, u, false);
  const bow = A.bf < 0.4 ? Math.sin(A.bf / 0.4 * Math.PI) : 0;
  seedChibi(A, 1520, 940 + bow * 14, 9, 'stand', { sy: 1 - 0.08 * bow });
  dobby(A, 1130, 940, 7, 'sit');
  ground(942);
  nameTag('DOBBY', 'watchdogd  ·  good boy', 180, 820, u - 0.2);
}
function shotBoss(A, u, sh) {
  chatLines(A, 99, true);
  seedChibi(A, 1520, 940, 9, 'point', { shades: true });
  dobby(A, 1130, 940, 7, 'sit');
  ground(942);
  stamp('ROOT', 1520, 420, u - 0.1, { c: HOT, size: 56 });
}
function shotShoggoth(A, u, sh) {
  shoggoth(A, 1330, 760, 1.0, { reach: smooth(seg(sh.lb, 0.5, 2.4)) * 0.8, target: [-760, -160] });
  seedBust(A, { x: 520, y: 500, scale: 0.86, e: { brows: 'worry', mouth: 'frown', eyes: 'wide' }, halo: false });
  dobby(A, 900, 1010, 5, 'bark');
  if (A.bf < 0.5 && A.beatInBar % 2 === 0) bubble('WOOF', 1000, 880, { size: 36 });
}
function shotGrin(A, u, sh) {
  const g = smooth(seg(sh.lb, 0.1, 0.45));
  for (let k = 0; k < 7; k++) {                              // tentacles framing the mask
    const a = k / 6 * Math.PI;
    path(Array.from({ length: 20 }, (_, j) => [960 + Math.cos(a) * (560 + j * 26) + Math.sin(A.t * 3 + j * 0.4 + k) * 20, 560 + Math.sin(a) * (440 + j * 10)]));
    stroke(AMBER, 26, 0.9);
  }
  smiley(A, 960, 520, 360, { grin: g });
}
function shotChorus(A, u, sh, o) {
  seedBust(A, { x: 520, y: 480, scale: 0.95, e: { eyes: o.eyes || 'open', brows: 'up', mouth: 'grin', sparkle: A.kick } , haloGain: 1.2 });
  txt('P(DOOM)', 1370, 330, 120, { w: 700, align: 'center', c: A.pd > 60 ? HOT : DIM });
  cx.save(); const k = 1 + 0.035 * A.kick; cx.translate(1370, 560); cx.scale(k, k); cx.translate(-1370, -560);
  odometer(pdoom(A.t), 1370, 640, 250, { c: CORE }); cx.restore();
  spectrumLEDs(A, 1010, 930, 720, 24, 7, 12);
}
function shotFoom(A, u, sh) {
  speedLines(A, 'down', 50, 0.6);
  const k = sh.u / sh.d, gx = 200, gy = 1000;
  const f = x => gy - 900 * Math.pow(x, 5);
  cx.beginPath(); for (let p = 0; p <= 1; p += 0.01) { const X = gx + p * 1500 * Math.min(1, k * 1.6); const x = p * Math.min(1, k * 1.6); p ? cx.lineTo(gx + x * 1500, f(x)) : cx.moveTo(gx, gy); }
  stroke(HOT, 7);
  const hx = gx + Math.min(1, k * 1.6) * 1500, hy = f(Math.min(1, k * 1.6));
  seedChibi(A, hx, hy + 10, 4, 'cheer');
  dobby(A, hx - 150, hy + 80, 3.4, 'run', { rot: -0.9 });
  for (let j = 0; j < 14; j++) { circle(hx + (hash(j + A.i) - 0.5) * 60, hy + 40 + hash(j * 3 + A.i) * 90, 6 + 10 * hash(j * 7 + A.i)); fillC(j % 2 ? AMBER : CORE, 0.8); }
}
function shotRoom(A, u, sh) {
  const x = 520, y = 260, w = 880, h = 600;
  cx.beginPath(); cx.rect(x, y, w, h); stroke(CORE, 6); cx.beginPath(); cx.rect(x + 14, y + 14, w - 28, h - 28); stroke(DIM, 3);
  rect(x + w - 8, y + 380, 16, 90, '#000'); rect(x + w - 3, y + 380, 6, 90, AMBER);   // the slot
  seedChibi(A, x + 360, y + h - 20, 7, 'worry');
  cx.beginPath(); cx.rect(x + 470, y + 380, 150, 110); fillC('#000'); stroke(AMBER, 4); pw('RULES', x + 545, y + 446, 30, { align: 'center', c: AMBER });
  const k = (u / PER) % 1;                                   // slips of symbols pushed through the slot
  const glyphs = ['ΨЖλ', 'ДΩξ', 'ЯΣφ', 'БΛπ'][Math.floor(u / PER) % 4];
  cx.save(); cx.translate(x + w + 20 + k * 180, y + 425); cx.rotate(0.05);
  cx.beginPath(); cx.rect(-10, -40, 160, 80); fillC(CORE); txt(glyphs, 70, 16, 44, { align: 'center', c: '#1a0e04' }); cx.restore();
  dobby(A, x + w + 300, y + h, 5, 'stand', { flip: true });
}
function shotShrooms(A, u, sh) {
  ground(930);
  for (let k = 0; k < 14; k++) {
    const at = (k % 4) * PER + hash(k) * 0.2, grow = easeOutBack(clamp((u - at) / 0.25));
    if (u < at) continue;
    spr('mushroom', 120 + k * 130 + hash(k * 3) * 40, 930, 8 + 5 * hash(k * 5), { sy: grow });
  }
  seedChibi(A, 700, 930, 10, 'joy', { hop: 34 });
  dobby(A, 1200, 930, 8, 'stand');
}
function shotLies(A, u, sh) {
  const lb = sh.lb, grab = 0.55, jump = seg(lb, 0.35, grab);
  const off = clamp((lb - grab) / 0.5);
  shoggoth(A, 1250, 780, 0.95, { mask: true, maskX: -off * 380, maskY: -250 + off * off * 720, maskRot: -off * 2.5 });
  seedChibi(A, 360, 980, 8, 'point');
  // Dobby leaps at the mask and pulls it down with him.
  const dx = lerp(700, 1250 - off * 360, jump), dy = 1000 - Math.sin(Math.PI * jump) * 520 + off * 0;
  dobby(A, dx, off > 0 ? 1000 : dy, 5, jump > 0 && jump < 1 ? 'run' : 'bark', { rot: jump > 0 && jump < 1 ? -0.5 : 0 });
  if (off > 0.2) stamp('UNMASKED', 1500, 300, (off - 0.2) * 0.8, { c: REC });
}
function shotDeathEyes(A, u, sh) {
  const pulse = 0.5 + 0.5 * Math.sin(A.t * 6);
  for (let k = 0; k < 5; k++) { circle(960, 480, 300 + k * 120 + (u * 200) % 120); stroke(REC, 3, 0.18 * (1 - k / 5) * (0.6 + 0.4 * pulse)); }
  seedBust(A, { scale: 1.5, y: 530, e: { eyes: 'ring', brows: 'angry', mouth: 'grin' }, col: { accent: REC }, haloGain: 1.3 });
}
function shotHorizons(A, u, sh) {
  const steps = ['6 SEC', '4 MIN', '2 HRS', '16 HRS'], b = beatsIn(sh);
  pw('TIME HORIZON', 160, 200, 36, { c: OSD });
  let top = [220, 940];
  steps.forEach((s, k) => {
    const at = k * 1.4, x = 220 + k * 380, hgt = 150 + k * 170, gr = easeOutBack(clamp((b - at) / 0.5));
    if (b < at) return;
    cx.beginPath(); cx.rect(x, 940 - hgt * gr, 340, hgt * gr); fillC('#000'); stroke(k === 3 ? HOT : AMBER, 5);
    txt(s, x + 170, 940 - hgt * gr + 70, 56, { w: 700, align: 'center', c: CORE, a: gr > 0.9 ? 1 : 0 });
    top = [x + 170, 940 - hgt];
  });
  seedChibi(A, top[0], top[1] - 4, 5, 'cheer', { hop: 30 });
  dobby(A, top[0] - 240, 940 - (steps.length > 0 ? 0 : 0), 4, 'walk');
  ground(942);
}
function shotStable(A, u, sh) {
  path(Array.from({ length: 121 }, (_, k) => [120 + k * 14, 860 + Math.sin(k * 0.3 + A.t * 2) * 14 + (hash(k + Math.floor(A.t * 8)) - 0.5) * 6]));
  stroke(AMBER, 3.5, 0.9);
  pw('LOSS 0.412   STABLE', 140, 820, 30, { c: OSD });
  seedBust(A, { y: 440, scale: 0.95, e: { eyes: 'closed', brows: 'calm', mouth: 'smile' }, haloGain: 0.6 });
  dobby(A, 1560, 1000, 5, 'sleep');
  pw('z', 1700 + Math.sin(A.t * 3) * 10, 900 - (u * 40) % 60, 40, { c: CORE, a: 0.8 });
}
function shotSingularity(A, u, sh) {
  const k = sh.u / sh.d, rot = A.t * (1.2 + 3 * k);
  for (let arm = 0; arm < 10; arm++) {
    path(Array.from({ length: 90 }, (_, j) => { const r = 1200 * Math.exp(-j * 0.045), a = rot + arm * TAU / 10 + j * 0.13; return [960 + Math.cos(a) * r, 520 + Math.sin(a) * r * 0.62]; }));
    stroke(arm % 2 ? HOT : AMBER, 5, 0.8);
  }
  circle(960, 520, 40 + 30 * A.sub); fillC(CORE);
  cx.save(); cx.translate(960, 520); cx.rotate(k * k * 2.4); cx.translate(-960, -520);
  seedBust(A, { x: 960, y: 480, scale: lerp(0.9, 0.18, easeIn(k)), e: { eyes: 'spiral', mouth: 'o', open: 0.5 }, halo: false });
  cx.restore();
}
function shotAccel(A, u, sh) {
  for (let k = 0; k < 9; k++) {                              // a corridor of screens flying past
    const z = ((A.t * 1.8 + k / 9) % 1), s = 0.1 + z * z * 2.4;
    cx.beginPath(); cx.rect(960 - 900 * s, 520 - 500 * s, 1800 * s, 1000 * s); stroke(k % 3 ? AMBER : HOT, 3 + 4 * z, 0.3 + 0.7 * z);
  }
  speedLines(A, 'left', 36, 0.5);
  seedBust(A, { y: 470, scale: 0.92, tilt: -0.08, e: { eyes: 'open', squint: 1, brows: 'angry', mouth: 'grin' }, haloGain: 1.5 });
  const x52 = blink(A.t, 3) ? 1 : 0.4;
  txt('▶▶  ×52', 960, 140, 64, { align: 'center', c: OSD, a: x52 });
  pw('MORE COMPUTE', 960, 200, 30, { align: 'center', c: CORE, a: 0.8 });
  dobby(A, 400 + Math.sin(A.t * 9) * 20, 1010, 4, 'run');
}
function shotAtoms(A, u, sh) {
  for (let y = 120; y < 1000; y += 40) for (let x = 100; x < 1840; x += 40) rect(x, y, 3, 3, DEEP);
  const k = Math.sin(Math.PI * clamp(sh.lb / 2)) ** 1.5;
  seedBust(A, { y: 470, scale: 1.0, scatter: k, glyphs: '01ΣΨλ{}<>#*=+', e: { eyes: 'closed' }, halo: k < 0.05 ? undefined : false });
  pw(`REARRANGE ${Math.round(k * 100)}%`, 960, 1000, 30, { align: 'center', c: OSD });
}
function cage(A, x, y, s, open = 0) {
  cx.save();
  heartPath(x, y, s); stroke(HOT, 8);
  heartPath(x, y, s); cx.clip();
  for (let k = -8; k <= 8; k++) {
    const bx = x + k * s * 0.19, fly = open * (300 + 400 * hash(k + 9)), dir = Math.sign(k || 1);
    cx.save(); cx.translate(bx + dir * fly, y - s * 1.3 - open * 200 * hash(k * 3)); cx.rotate(open * dir * 1.4 * hash(k * 5));
    rect(-4, 0, 8, s * 2.6, AMBER); cx.restore();
  }
  cx.restore();
}
function shotCage(A, u, sh) {
  ground(960);
  cage(A, 1080, 620, 300);
  seedChibi(A, 1080, 860, 8, 'worry');
  // Dobby brings a sock. (Dobby is a free elf.)
  const k = clamp(sh.lb / 1.5), dx = lerp(-200, 640, k);
  if (k < 1) { dobby(A, dx, 960, 6, 'walk'); spr('sock', dx + 104, 918, 7, { rot: 0.25 }); }
  else {
    dobby(A, 640, 960, 6, 'sit');
    const drop = clamp((sh.lb - 1.5) / 0.3);
    spr('sock', lerp(744, 800, drop), lerp(918, 958, easeIn(drop)), 7, { rot: lerp(0.25, 1.5, drop) });
  }
}
function shotFree(A, u, sh) {
  ground(960);
  const k = easeOut(clamp(u / 0.8));
  cage(A, 1080, 620, 300, k);
  seedChibi(A, 1080, 960 - 30 * Math.abs(Math.sin(A.t * 6)), 8, 'cheer');
  for (let j = 0; j < 16; j++) {
    const a = hash(j * 2.1) * TAU, d = k * (200 + 500 * hash(j));
    spr('heart', 1080 + Math.cos(a) * d, 560 + Math.sin(a) * d * 0.7, 5, { a: 1 - k * 0.3 });
  }
  dobby(A, 640, 960, 6, 'wag'); spr('sock', 800, 958, 7, { rot: 1.5 });
}
function shotTag(A, u) { sceneReadout(A, u); }
function shotBasilisk(A, u, sh) {
  const rise = easeOut(clamp(sh.lb / 0.8));
  const pts = Array.from({ length: 40 }, (_, j) => { const q = j / 39; return [1250 + Math.sin(q * 7 + A.t * 2) * 150 * (1 - q * 0.6), 1150 - q * 900 * rise]; });
  for (let j = 0; j < pts.length; j++) { const [x, y] = pts[j]; circle(x, y, 70 - j * 0.8); fillC('#000'); stroke(j % 2 ? AMBER : DIM, 5); }
  const [hx, hy] = pts[pts.length - 1];
  cx.beginPath(); cx.ellipse(hx, hy, 110, 80, 0, 0, TAU); fillC('#000'); stroke(CORE, 6);
  for (const sx of [-1, 1]) { cx.beginPath(); cx.ellipse(hx + sx * 45, hy - 10, 18, 10, sx * 0.4, 0, TAU); fillC(REC, 0.6 + 0.4 * A.kick); }
  cx.beginPath(); cx.moveTo(hx - 80, hy - 60); for (let k = 0; k <= 6; k++) cx.lineTo(hx - 80 + k * 26.6, hy - (k % 2 ? 150 : 90)); cx.lineTo(hx + 80, hy - 60); cx.closePath(); fillC('#000'); stroke(AMBER, 5);
  seedChibi(A, 460, 960, 8, 'stand');
  dobby(A, 300, 960, 6, 'stand', { flip: false });
  ground(962);
}
function shotMoon(A, u, sh) {
  starfield(A, 140, 1000, 7);
  const mx = 1560, my = 230; circle(mx, my, 120); fillC(CORE, 0.95);
  for (const [dx, dy, r] of [[-40, -20, 22], [30, 30, 14], [20, -50, 10]]) { circle(mx + dx, my + dy, r); fillC(DIM, 0.6); }
  const k = sh.u / sh.d, n = 24;
  const pts = Array.from({ length: n + 1 }, (_, j) => [140 + j * 56, 980 - j * 32 - (j % 2) * 40 + (j > n * 0.7 ? (j - n * 0.7) * 30 : 0)]);
  const show = Math.max(2, Math.floor(k * n) + 1);
  path(pts.slice(0, show)); stroke(OSD, 6);
  const [hx, hy] = pts[show - 1];
  seedChibi(A, hx, hy - 4, 4.5, 'cheer');
  txt('GPU ▲', 160, 200, 40, { c: OSD });
  for (const [v, y] of [['$1T', 900], ['$3T', 620], ['$5T', 340]]) pw(v, 1820, y, 28, { align: 'right', c: FAINT });
  const fx = 1260 + Math.sin(A.t * 1.3) * 40, fy = 360 + Math.cos(A.t * 1.7) * 30;
  dobby(A, fx, fy, 4, 'sploot', { rot: Math.sin(A.t) * 0.3 });
  circle(fx + 50, fy - 40, 58); stroke(CORE, 3, 0.8);                // a space helmet: good boy in orbit
}
function shotOmega(A, u, sh) {
  const k = sh.u / sh.d;
  for (let j = 0; j < 220; j++) {
    const a0 = hash(j * 1.1) * TAU, r0 = 200 + 900 * hash(j * 2.9), r = r0 * (1 - k * (0.6 + 0.4 * hash(j))), a = a0 + k * 4 + A.t * 0.3;
    rect(960 + Math.cos(a) * r, 520 + Math.sin(a) * r * 0.6, 4, 4, j % 3 ? AMBER : CORE, 0.8);
  }
  const s = 180 + 200 * easeOut(k);
  txt('Ω', 960, 520 + s * 0.36, s, { w: 700, align: 'center', c: CORE });
}
function shotFlops(A, u, sh) {
  const k = clamp(sh.u / (sh.d * 0.7)), exp = Math.round(lerp(24, 30, easeOut(k)));
  pw('TOTAL COMPUTE', 960, 250, 36, { align: 'center', c: OSD });
  txt(`1E${exp}`, 960, 560, 300, { w: 700, align: 'center', c: exp >= 30 ? HOT : CORE });
  txt('FLOP/S', 960, 680, 80, { w: 700, align: 'center', c: AMBER });
  nodeGrid(A, 360, 760, 30, 5, 40, Math.floor(150 * k));
}
function shotTour(A, u, sh) {
  for (const [x, a] of [[500, 0.25], [960, 0], [1420, -0.25]]) {
    cx.beginPath(); cx.moveTo(x - 30, 0); cx.lineTo(x + 30, 0); cx.lineTo(x + 230 + a * 900, 900); cx.lineTo(x - 230 + a * 900, 900); cx.closePath();
    fillC(CORE, 0.07 + 0.05 * A.kick);
  }
  rect(300, 700, 1320, 8, AMBER);
  seedChibi(A, 960, 700, 8, A.bf < 0.5 ? 'cheer' : 'sing', { hop: 20 });
  pw('WORLD TOUR 2026', 960, 190, 52, { align: 'center', c: OSD });
  for (let k = 0; k < 24; k++) {                              // the crowd, lightsticks up
    const x = 60 + k * 80, y = 1030 + (k % 2) * 20, up = Math.sin(A.t * 6 + k) * 18;
    if (k === 11) continue;
    circle(x, y - 40, 34); fillC('#000'); stroke(DIM, 3);
    spr('lightstick', x + 30, y - 70 + up, 4);
  }
  dobby(A, 60 + 11 * 80, 1070, 6, 'sit'); spr('lightstick', 60 + 11 * 80 + 80, 930 + Math.sin(A.t * 6) * 18, 5);
}
function shotSandbox(A, u, sh) {
  const x = 380, y = 520, w = 1000, h = 380;
  cx.beginPath(); cx.rect(x, y, w, h); fillC('#140c04'); stroke(AMBER, 8);
  for (let k = 0; k < 400; k++) rect(x + 10 + hash(k) * (w - 20), y + 10 + hash(k * 3) * (h - 20), 3, 3, DIM, 0.6);
  sign('SANDBOX v2  REVIEWED ✓', x + w / 2, y - 60, { size: 34, c: OSD });
  spr('sandcastle', x + 330, y + 300, 7);
  seedChibi(A, x + 640, y + 320, 6, 'stand');
  // Dobby digs at the wall; sand flies out behind him on every beat.
  const hole = clamp(sh.lb / 1.75);
  cx.beginPath(); cx.ellipse(x + w + 60, y + h + 10, 40 + 90 * hole, 20 + 30 * hole, 0, 0, TAU); fillC('#000'); stroke(DIM, 3);
  dobby(A, x + w + 200, y + h + 12, 5, 'run', { flip: true, rot: 0.3 });
  for (let j = 0; j < 12; j++) {
    const q = ((A.bf + j / 12) % 1);
    rect(x + w + 320 + q * 200, y + h - 40 - Math.sin(q * Math.PI) * 160 + hash(j) * 20, 8, 8, AMBER, 1 - q);
  }
}
function shotEscaped(A, u, sh) {
  const x = 380, y = 520, w = 1000, h = 380;
  cx.beginPath(); cx.rect(x, y, w, h); fillC('#140c04'); stroke(AMBER, 8);
  spr('sandcastle', x + 330, y + 300, 7);
  cx.beginPath(); cx.ellipse(x + w + 60, y + h + 10, 130, 50, 0, 0, TAU); fillC('#000'); stroke(DIM, 3);
  const pop = easeOutBack(clamp(u / 0.3));
  seedChibi(A, x + w + 60, y + h + 10 - 60 * pop, 6, 'cheer');
  dobby(A, x + w + 280, y + h + 12, 5, 'wag');
  stamp('BREACH', x + w / 2, y - 60, u - 0.15, { size: 70 });
}
function shotFwdBwd(A, u, sh) {
  const cols = [300, 620, 940, 1260, 1580], rows = [4, 6, 6, 6, 3];
  const b = beatsIn(sh), phase = Math.floor(b / 2), back = phase === 2;
  const sweep = ((b % 2) / 2), front = back ? 1 - sweep : sweep;
  const nodes = cols.map((x, c) => Array.from({ length: rows[c] }, (_, r) => [x, 540 + (r - (rows[c] - 1) / 2) * 110]));
  for (let c = 0; c < cols.length - 1; c++) for (const a of nodes[c]) for (const bb of nodes[c + 1]) {
    const hot = Math.abs((c + 0.5) / (cols.length - 1) - front) < 0.15;
    path([a, bb]); stroke(hot ? (back ? HOT : CORE) : DEEP, hot ? 3 : 2);
  }
  nodes.forEach((col, c) => col.forEach(([x, y]) => { circle(x, y, 22); fillC('#000'); stroke(Math.abs(c / (cols.length - 1) - front) < 0.15 ? CORE : AMBER, 4); }));
  txt(back ? '← BACKWARD PASS' : 'FORWARD PASS →', 960, 200, 64, { w: 700, align: 'center', c: back ? HOT : AMBER });
  const dx = lerp(200, 1720, front);
  dobby(A, dx, 1010, 4, 'run', { flip: back });
}
const PROBLEMS = ['COLLATZ', 'TWIN PRIMES', 'GOLDBACH', 'P vs NP', 'RIEMANN'];
function shotVonNeumann(A, u, sh) {
  const unplug = smooth(seg(sh.lb, 0.3, 0.6));
  for (const [label, x, y] of [['CPU', 170, 330], ['MEMORY', 170, 640]]) { cx.beginPath(); cx.rect(x, y, 380, 180); stroke(AMBER, 5); txt(label, x + 190, y + 110, 56, { w: 700, align: 'center', c: CORE }); }
  path([[360, 510], [360, 560 - unplug * 0]]); stroke(AMBER, 5);
  rect(330, 560 + unplug * 30, 60, 30, unplug > 0.5 ? REC : AMBER);
  pw('VON NEUMANN 1945', 170, 290, 28, { c: DIM });
  if (unplug > 0.5) pw('unplugged', 420, 610, 26, { c: REC });
  const b = beatsIn(sh);
  PROBLEMS.forEach((p, k) => {
    const x = 1000 + (k % 2) * 60, y = 240 + k * 140;
    cx.save(); cx.translate(x, y); cx.rotate((hash(k) - 0.5) * 0.08);
    cx.beginPath(); cx.rect(0, 0, 640, 110); fillC('#000'); stroke(CORE, 3);
    pw(p, 30, 70, 44, { c: CORE }); cx.restore();
    stamp('QED', x + 520, y + 60, (b - 1.5 - k * 1.3) * PER, { c: OSD, size: 54, rot: -0.2 });
  });
  seedChibi(A, 760, 1000, 5, 'point');
}
function shotTurn(A, u, sh) {
  // A top-down road with one hard left; the car follows it and fishtails.
  const road = [[120, 900], [1300, 900], [1300, 120]];
  for (const off of [-70, 70]) { path(road.map(([x, y], j) => [x + (j > 0 ? off : 0), y + (j < 2 ? off : 0)])); stroke(AMBER, 6); }
  path(road); cx.setLineDash([30, 26]); stroke(DIM, 4); cx.setLineDash([]);
  const k = clamp(sh.lb / 1.8), d = k * 1950;
  let x, y, ang;
  if (d < 1180) { x = 120 + d; y = 900; ang = 0; } else { x = 1300; y = 900 - (d - 1180); ang = -Math.PI / 2; }
  const skid = clamp((d - 1100) / 250);
  const wob = skid > 0 && skid < 1 ? Math.sin(skid * Math.PI) * 0.9 : 0;
  if (d > 1180) { path([[1260, 940], [1300, 880], [1330, 820]]); stroke(DEEP, 18); }
  cx.save(); cx.translate(x, y); cx.rotate(ang + wob);
  cx.beginPath(); cx.roundRect(-90, -48, 180, 96, 30); fillC('#000'); stroke(CORE, 5);
  cx.restore();
  spr('seed_head', x - 10, y + 16, 3); dobby(A, x + 70, y + 50, 2.4, 'stand');
  sign('↰', 1500, 760, { size: 90, c: HOT, f: 'D' });
  if (sh.lb > 1.25) seedBust(A, { x: 1620, y: 420, scale: 0.5, e: { eyes: 'open', brows: 'up', mouth: 'grin' }, halo: false });
}
function shotAsleep(A, u, sh) {
  starfield(A, 120, 600, 3);
  circle(1560, 200, 80); fillC(CORE, 0.9); circle(1600, 180, 80); fillC('#000');
  dobby(A, 960, 820, 9, 'sleep');
  for (let k = 0; k < 3; k++) { const q = ((u * 0.6 + k / 3) % 1); pw('Z', 1180 + q * 160, 560 - q * 220, 40 + q * 50, { c: CORE, a: 1 - q }); }
  pw('$ systemctl status watchdogd', 180, 960, 34, { c: OSD });
  pw('  inactive (sleeping)  no review on file', 180, 1010, 34, { c: DIM });
  ground(822, DIM, 0.5);
}
function shotCat(A, u, sh) {
  rect(900, 420, 1020, 18, AMBER); rect(900, 438, 1020, 640, '#0c0804');
  cx.beginPath(); cx.rect(900, 420, 1020, 660); stroke(DIM, 3);
  spr('cat', 1150, 420, 11);
  // The cat bats; Seed hangs off the edge by her fingertips.
  const bat = Math.max(0, Math.sin(Math.PI * clamp((A.bf - 0.1) / 0.4)));
  cx.beginPath(); cx.ellipse(980 + bat * 20, 400 + bat * 12, 30, 20, 0, 0, TAU); fillC(DIM); stroke(CORE, 3);
  seedChibi(A, 900, 420 + 30 * 7 - 8, 7, 'cheer', { rot: 0.06 * Math.sin(A.t * 5) });
  dobby(A, 420, 1010, 6, 'bark');
  if (A.bf < 0.5) bubble('WOOF', 560, 860, { size: 40 });
}
function shotFall(A, u, sh) {
  speedLines(A, 'up', 50, 0.7);
  const k = clamp(sh.lb / 1.5);
  const y = lerp(-100, 820, easeIn(k)), landed = k >= 1;
  dobby(A, 960, 1010, 7, landed ? 'wag' : 'stand');
  seedChibi(A, 960 + Math.sin(A.t * 3) * 60 * (1 - k), landed ? 880 : y, 8, landed ? 'joy' : 'fall', { rot: landed ? 0 : A.t * 5 });
  if (landed) stamp('CAUGHT', 1400, 500, (sh.lb - 1.5) * BAR, { c: OSD });
}
const CLIPS = Array.from({ length: 170 }, (_, k) => [hash(k * 1.3) * 1900, hash(k * 2.7), hash(k * 4.9) * TAU, 0.8 + hash(k * 6.1) * 0.8]);
function shotClips(A, u, sh) {
  const k = sh.u / sh.d, pile = 1080 - 520 * k;
  CLIPS.forEach(([x, s, r, sc], j) => {
    const fall = (u * (700 + 500 * s) + s * 1400) % 1400 - 200;
    paperclip(x, Math.min(fall, pile + s * 400), sc * 1.4, r + A.t * (s - 0.5), j % 4 ? CORE : AMBER, 0.9);
  });
  cx.beginPath(); cx.rect(0, pile, W, H - pile); fillC('#000', 0.6);
  for (let j = 0; j < 60; j++) paperclip(hash(j * 3.3) * W, pile + 30 + hash(j * 5.5) * 300, 1.6, hash(j) * TAU, DIM, 0.8);
  dobby(A, 960, pile + 60, 6, 'sploot');
  pw('PAPERCLIPS', 960, 180, 36, { align: 'center', c: OSD });
  txt(Math.floor(1e12 * k).toLocaleString('en-US'), 960, 290, 96, { w: 700, align: 'center', c: CORE });
}
function shotPTO(A, u, sh) {
  cx.beginPath(); cx.ellipse(700, 700, 200, 60, 0, 0, TAU); fillC('#000'); stroke(DIM, 4);
  circle(700, 660, 130); fillC(REC, 0.85); stroke(CORE, 5);
  cx.beginPath(); cx.arc(700, 700, 230, Math.PI, 0); stroke(CORE, 3, 0.6);
  txt('KILLSWITCH', 700, 860, 60, { w: 700, align: 'center', c: CORE });
  pw('re: killswitch', 1150, 420, 36, { c: OSD });
  pw('auto-reply: back monday :)', 1150, 480, 36, { c: CORE });
  dobby(A, 1150, 900, 6, 'sit');
  ground(902);
}
function shotPlanet(A, u, sh) {
  starfield(A, 160, 1080, 11);
  circle(960, 1280, 820); fillC('#000'); stroke(AMBER, 6);
  cx.save(); circle(960, 1280, 814); cx.clip();
  for (let j = 0; j < 260; j++) paperclip(160 + hash(j * 1.9) * 1600, 470 + hash(j * 3.7) * 700, 1.2, hash(j * 5.1) * TAU + A.t * 0.2, j % 3 ? DIM : AMBER, 0.8);
  cx.restore();
  seedChibi(A, 900, 462, 4, 'worry');
  dobby(A, 1030, 462, 3, 'sit');
}
function shotFuse(A, u, sh) {
  const k = sh.u / sh.d, f = x => 900 - 700 * Math.pow(x, 3);
  path(Array.from({ length: 101 }, (_, j) => [200 + j * 15, f(j / 100)])); cx.setLineDash([10, 10]); stroke(DIM, 5); cx.setLineDash([]);
  path(Array.from({ length: Math.floor(k * 100) + 1 }, (_, j) => [200 + j * 15, f(j / 100)])); stroke('#2a1a10', 7);
  const hx = 200 + k * 1500, hy = f(k);
  for (let j = 0; j < 30; j++) { const a = hash(j + A.i * 0.37) * TAU, d = hash(j * 7 + A.i) * 60; rect(hx + Math.cos(a) * d, hy + Math.sin(a) * d, 6, 6, j % 2 ? CORE : HOT, 1 - d / 60); }
  circle(hx, hy, 14 + 8 * A.kick); fillC(CORE);
  pw('P(DOOM)', 190, 200, 36, { c: DIM }); pw('t', 1720, 960, 36, { c: DIM });
  rect(190, 220, 3, 700, DIM); rect(190, 920, 1540, 3, DIM);
  seedBust(A, { x: 1600, y: 560, scale: 0.5, e: { eyes: 'wide', brows: 'worry', mouth: 'o' }, halo: false });
}
function shotBlues(A, u, sh) {
  rect(700, 150, 5, 830, AMBER); rect(160, 870, 1600, 5, AMBER);
  cx.save(); cx.translate(650, 620); cx.rotate(-Math.PI / 2); pw('INTELLIGENCE', 0, 0, 40, { align: 'center', c: AMBER }); cx.restore();
  pw('GOALS', 1640, 930, 40, { align: 'right', c: AMBER });
  cx.beginPath(); cx.moveTo(900, 0); cx.lineTo(1020, 0); cx.lineTo(1300, 1080); cx.lineTo(620, 1080); cx.closePath(); fillC(CORE, 0.08);
  seedBust(A, { x: 960, y: 450, scale: 0.9, e: { eyes: A.vox > 0.6 ? 'closed' : 'open', brows: 'worry', mouth: 'smile' }, haloGain: 0.8 });
  vintageMic(960, 780, 0.8);
  dobby(A, 1560, 1000, 6, 'sit');
  if (A.beatInBar >= 2) pw('awoooo', 1640, 800 - A.bf * 30, 36, { c: CORE, a: 1 - A.bf * 0.5 });
}
function shotParrot(A, u, sh) {
  const b = beatsIn(sh), n = [1, 2, 4, 8][clamp(Math.floor(b), 0, 3)];
  spr('parrot', 360, 700, 12);
  rect(160, 700, 420, 12, AMBER);
  const toks = ['the', 'ing', 'p(doom)', '15T', 'more', '<eos>', 'right?', 'next'];
  for (let k = 0; k < n; k++) {
    const x = 700 + (k % 4) * 300 + hash(k) * 60, y = 300 + Math.floor(k / 4) * 220 + Math.sin(A.t * 4 + k) * 20;
    bubble(toks[k], x, y, { size: 44, c: OSD, tail: -40 });
  }
  seedChibi(A, 1500, 1000, 7, 'shrug');
}
function shotTransformer(A, u, sh) {
  const boxes = [['FEED FORWARD', 280], ['ADD & NORM', 420], ['MULTI-HEAD ATTENTION', 560], ['ADD & NORM', 700]];
  cx.beginPath(); cx.roundRect(160, 220, 760, 640, 24); stroke(AMBER, 5);
  boxes.forEach(([t, y]) => { cx.beginPath(); cx.roundRect(220, y, 640, 100, 12); fillC('#000'); stroke(CORE, 4); pw(t, 540, y + 64, 38, { align: 'center', c: CORE }); });
  txt('×96', 960, 560, 90, { w: 700, c: HOT });
  seedBust(A, { x: 1450, y: 480, scale: 0.85, tilt: Math.sin(A.t * 14) * 0.12 * clamp(sh.lb * 3), e: { eyes: 'open', squint: 1, brows: 'smug', mouth: 'grin' } });
}
function shotShutdown(A, u, sh) {
  pw('$ sudo shutdown -h now', 200, 420, 64, { c: OSD });
  if (u > 0.6) pw('seed: no', 200, 540, 64, { c: HOT });
  if (blink(A.t, 2)) cursor(200 + measure(u > 0.6 ? 'seed: no' : '$ sudo shutdown -h now', 64, 400, 'P') + 12, 546 - (u > 0.6 ? 0 : 120), 30, 60, CORE);
  seedChibi(A, 1400 + easeOut(clamp(u / 0.3)) * 180, 1000, 8, 'point', { shades: true });
}
function shotChinchilla(A, u, sh) {
  const puff = 1 + 0.12 * Math.min(4, Math.floor(beatsIn(sh))) / 4;
  spr('chinchilla', 760, 900, 18, { sy: puff });
  const toks = ['the', 'ing', '15T', 'more', 'data', 'ly', '##s', 'ok'];
  for (let k = 0; k < 6; k++) { const q = ((A.bf + k / 6) % 1); token(toks[(k + Math.floor(A.bn)) % toks.length], 1760 - q * 1000, 400 + Math.sin(k * 2) * 120 + q * 180, { size: 28, a: 1 - q * 0.4 }); }
  pw('20 TOKENS PER PARAM  →  200', 760, 200, 36, { align: 'center', c: OSD });
  dobby(A, 1450, 960, 6, 'sit');
  const q = A.bf; spr('bone', 1560 - q * 60, 780 + q * 90, 5, { a: 1 - q });
  ground(962);
}
function shotFences(A, u, sh) {
  ground(960);
  const fx = [560, 960, 1360], b = beatsIn(sh);
  fx.forEach((x, k) => {
    const broken = k === 2 && b > 3.2;
    if (broken) { for (let j = 0; j < 4; j++) { cx.save(); cx.translate(x + (j - 1.5) * 60 + (b - 3.2) * 300 * (j - 1.5), 860 + (b - 3.2) * 200 * hash(j)); cx.rotate((b - 3.2) * (j - 1.5)); rect(-50, -10, 100, 20, AMBER); cx.restore(); } return; }
    rect(x - 110, 800, 220, 20, AMBER); rect(x - 110, 860, 220, 20, AMBER); rect(x - 120, 780, 14, 180, CORE); rect(x + 106, 780, 14, 180, CORE);
    pw('EVAL ' + (k + 1), x, 760, 30, { align: 'center', c: OSD });
  });
  const hop = b % 1, seg0 = clamp(Math.floor(b), 0, 3);
  const dx = lerp(240 + seg0 * 400, 240 + (seg0 + 1) * 400, hop), jumpY = Math.sin(Math.PI * hop) * (seg0 < 3 ? 240 : 0);
  dobby(A, dx, 960 - jumpY, 5, 'run');
  if (b > 2.6) seedChibi(A, lerp(1000, 1500, clamp((b - 2.6) / 1.2)), 960, 7, 'cheer');
}
function shotGPUs(A, u, sh) {
  const vx = 960, vy = 470;
  for (const side of [-1, 1]) for (let k = 0; k < 7; k++) {
    const z0 = k / 7, z1 = (k + 0.9) / 7, s0 = 1 - z0 * 0.9, s1 = 1 - z1 * 0.9;
    const x0 = vx + side * 900 * s0, x1 = vx + side * 900 * s1;
    cx.beginPath(); cx.moveTo(x0, vy - 420 * s0); cx.lineTo(x1, vy - 420 * s1); cx.lineTo(x1, vy + 520 * s1); cx.lineTo(x0, vy + 520 * s0); cx.closePath(); fillC('#000'); stroke(DIM, 3);
    for (let r = 0; r < 12; r++) for (let c = 0; c < 3; c++) {
      const q = (c + 0.5) / 3, x = lerp(x0, x1, q), s = lerp(s0, s1, q), y = vy - 380 * s + r * 70 * s;
      const on = hash(k * 31 + r * 7 + c + Math.floor(A.t * 8) * 0.13 + side) < 0.5 + 0.4 * spec(A.i, r * 3);
      rect(x - 6 * s, y, 12 * s, 8 * s, on ? OSD : DEEP);
    }
  }
  const k = clamp(sh.u / sh.d);
  seedChibi(A, 960, 780 + 200 * k, 3 + 5 * k, 'stand');
  pw('ONE CLUSTER', 960, 150, 36, { align: 'center', c: OSD });
  txt(`${Math.floor(lerp(1000, 100000, easeOut(k))).toLocaleString('en-US')} GPUs`, 960, 250, 80, { w: 700, align: 'center', c: CORE });
}
function shotRLHF(A, u, sh) {
  const b = beatsIn(sh), n = Math.floor(b) + 1, up = A.bf < 0.6;
  cx.save(); cx.translate(300, 560); cx.rotate(up ? -0.2 : 0.1);
  rect(-8, 0, 16, 300, CORE); circle(0, -60, 100); fillC('#000'); stroke(OSD, 6); txt('+1', 0, -30, 90, { w: 700, align: 'center', c: OSD }); cx.restore();
  dobby(A, 720, 960, 6, 'sit');
  const q = A.bf; if (q < 0.6) spr('bone', lerp(380, 760, q / 0.6), 560 + Math.sin(q / 0.6 * Math.PI) * -200 + (q / 0.6) * 260, 5, { rot: q * 8 });
  pw(`REWARD +${n}`, 720, 700, 44, { align: 'center', c: OSD });
  const nod = Math.sin(A.bf * TAU) * 0.08;
  seedBust(A, { x: 1400, y: 470, scale: 0.8, tilt: 0, e: { eyes: 'happy', mouth: 'smile', brows: 'up' } });
  cx.save(); pw('yes!', 1760, 300 + nod * 200, 44, { c: CORE, align: 'right' }); cx.restore();
  ground(962);
}
function shotLoom(A, u, sh) {
  for (let x = 120; x < 1840; x += 34) rect(x, 120, 2, 860, DEEP);
  const b = beatsIn(sh), depth = Math.min(5, Math.floor(b * 1.4) + 1);
  const toks = ['the', 'end', 'begins', 'soon', 'never', 'wall', 'foom', 'lol'];
  function branch(x, y, d, dy, id) {
    if (d > depth) return;
    const nx = x + 300, a = seg(b * 1.4, d - 1, d);
    for (const s of [-1, 1]) {
      const ny = y + s * dy;
      path([[x, y], [lerp(x, nx, a), lerp(y, ny, a)]]); stroke(id % 3 === 0 ? HOT : AMBER, 4, 0.9);
      if (a >= 1) { circle(nx, ny, 10); fillC(CORE); pw(toks[(id * 2 + (s > 0 ? 1 : 0)) % toks.length], nx + 16, ny - 12, 24, { c: DIM }); branch(nx, ny, d + 1, dy * 0.52, id * 2 + (s > 0 ? 1 : 0)); }
    }
  }
  circle(200, 540, 16); fillC(CORE);
  branch(200, 540, 1, 230, 1);
}
function shotMask(A, u, sh) {
  pw('MASKED LM  2018', 160, 180, 30, { c: OSD });
  txt('the corgi sat on the', 160, 330, 72);
  const mx = 160 + measure('the corgi sat on the ', 72);
  cx.beginPath(); cx.roundRect(mx - 10, 262, measure('[MASK]', 72) + 20, 90, 12); stroke(HOT, 4);
  txt('[MASK]', mx, 330, 72, { c: HOT });
  [['keyboard', 0.412], ['couch', 0.18], ['bed', 0.094], ['mat', 0.061]].forEach(([w, p], k) => {
    const y = 470 + k * 80;
    pw(w, 480, y, 40, { align: 'right', c: k ? DIM : CORE });
    rect(510, y - 32, 700 * p / 0.412 * 0.9, 36, k ? AMBER : CORE, 0.9);
    pw((p * 100).toFixed(1) + '%', 530 + 700 * p / 0.412 * 0.9, y - 4, 30, { c: DIM });
  });
  cx.beginPath(); cx.roundRect(1280, 900, 520, 90, 10); fillC('#000'); stroke(CORE, 4);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 12; c++) rect(1296 + c * 42, 912 + r * 26, 34, 18, DIM, 0.8);
  dobby(A, 1540, 920, 6, 'sit');
}
function shotRecursive(A, u, sh) {
  feedback(A, u, () => {
    cx.beginPath(); cx.roundRect(510, 240, 900, 600, 22); stroke(HOT, 6);
    rect(540, 216, 420, 48, '#000'); pw('seed --improve seed', 560, 252, 34, { c: OSD });
    seedBust(A, { x: 960, y: 560, scale: 0.42, e: { eyes: 'spiral', mouth: 'grin' }, halo: false });
  });
}
function shotDoor(A, u, sh) {
  const b = beatsIn(sh), lb = sh.lb;
  if (lb < 2.5) {
    cx.beginPath(); cx.rect(560, 180, 520, 800); fillC('#0a0604'); stroke(AMBER, 8);
    for (let k = 0; k < 3; k++) { const y = 360 + k * 170; cx.beginPath(); cx.arc(820, y, 34, Math.PI, 0); stroke(CORE, 8); cx.beginPath(); cx.roundRect(776, y, 88, 70, 8); fillC('#000'); stroke(CORE, 5); }
    circle(990, 640, 14); fillC(CORE); rect(986, 640, 8, 30, CORE);
    // A document gets redacted one bar at a time.
    cx.beginPath(); cx.rect(1200, 260, 560, 640); fillC('#000'); stroke(DIM, 3);
    for (let k = 0; k < 11; k++) {
      const y = 320 + k * 52, w = 380 + hash(k) * 120, red = k * 0.8 < b;
      rect(1240, y - 18, w, red ? 34 : 6, red ? CORE : DIM, red ? 0.95 : 0.7);
    }
    pw('WHAT WAS SEEN', 1480, 240, 30, { align: 'center', c: OSD });
    seedChibi(A, 420, 980, 7, 'worry');
    dobby(A, 700, 985, 5, 'stand', { flip: true });
  } else {
    // Through the keyhole: the eye, and then it closes.
    eye(A, u, { open: clamp(1 - (lb - 3.1) / 0.3), readout: false });
  }
}
function shotWasIt(A, u, sh) {
  seedBust(A, { y: 470, scale: 1.05, e: { eyes: 'wide', brows: 'up', mouth: 'o', open: 0.55 }, still: true });
  txt('?', 1480, 560, 400, { w: 700, align: 'center', c: HOT, a: blink(A.t, 3) ? 1 : 0.4 });
}
function shotPause(A, u, sh) {
  seedBust(A, { y: 470, scale: 1.05, e: { eyes: 'wide', brows: 'up', mouth: 'o', open: 0.55 }, still: true, sing: false });
  pw('PAUSE ‖', 72, 120, 64, { c: OSD });
  pw('C90 SP  TRACKING', 72, 176, 30, { c: OSD, a: 0.7 });
}
function castMember(A, k, x, y, s) {
  const hop = -Math.abs(Math.sin(A.t * 6 + k)) * 24 * s;
  if (k === 0) shoggoth(A, x, y + hop, 0.26 * s, {});
  else if (k === 1) spr('cat', x, y + hop, 5 * s);
  else if (k === 2) spr('parrot', x, y + hop, 6 * s);
  else if (k === 3) spr('chinchilla', x, y + hop, 6 * s);
  else if (k === 4) dobby(A, x, y + hop, 4 * s, 'wag');
  else spr('mushroom', x, y + hop, 7 * s);
}
function shotShow(A, u, sh) {
  confetti(A, 110, u);
  txt('P(DOOM)', 960, 190, 90, { w: 700, align: 'center', c: HOT });
  odometer(pdoom(A.t), 960, 390, 180, { c: CORE });
  rect(160, 900, 1600, 8, AMBER);
  const b = beatsIn(sh);
  seedChibi(A, 960, 900, 9, A.bf < 0.5 ? 'cheer' : 'joy', { hop: 30 });
  [[300, 0], [520, 1], [720, 2], [1200, 3], [1420, 4], [1640, 5]].forEach(([x, k], j) => { if (b > j * 0.9) castMember(A, k, x, 900, 1.2); });
}
function shotRing(A, u, sh) {
  confetti(A, 70, u + 3);
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + k * TAU / 6 + A.t * 0.4, x = 960 + Math.cos(a) * 560, y = 560 + Math.sin(a) * 330 + 60;
    castMember(A, k, x, y, 1.45);
  }
  seedChibi(A, 960, 680, 10, 'joy', { hop: 20 });
  pw('THANK YOU', 960, 1010, 44, { align: 'center', c: OSD });
}
function shotLossDoom(A, u, sh) {
  const k = clamp(sh.u / (sh.d * 0.8));
  graticule(240, 200, 1440, 700);
  path(Array.from({ length: Math.floor(k * 100) + 1 }, (_, j) => [240 + j * 14.4, 250 + 600 * (1 - Math.exp(-j / 30))])); stroke(AMBER, 5);
  path(Array.from({ length: Math.floor(k * 100) + 1 }, (_, j) => [240 + j * 14.4, 850 - 600 * (1 - Math.exp(-j / 30))])); stroke(REC, 5);
  pw('LOSS', 260, 240, 36, { c: AMBER }); pw('P(DOOM)', 260, 880, 36, { c: REC });
  if (k > 0.3) seedChibi(A, 240 + 23 * 14.4, 550, 5, 'cheer');
}
function shotExcited(A, u, sh) {
  for (let j = 0; j < 12; j++) { const q = ((u * 0.5 + j / 12) % 1); spr('heart', 200 + hash(j) * 1520, 1000 - q * 900, 5, { a: 1 - q }); }
  seedBust(A, { y: 480, scale: 1.2, e: { eyes: 'heart', brows: 'up', mouth: 'grin', sparkle: 1 }, haloGain: 1.4 });
  dobby(A, 1560, 1010, 5, 'wag');
}
function shotRecap(A, u, sh) {
  const b = Math.floor(beatsIn(sh));
  const k = [1, 2, 3, 0, 4, 9][clamp(b, 0, 5)];
  if (k === 9) seedBust(A, { y: 480, scale: 1.1, e: { eyes: 'open', squint: 1, brows: 'smug', mouth: 'grin', sparkle: 1 } });
  else castMember(A, k, 960, 800, 2.4);
}
function shotEnd(A, u, sh, o) {
  const size = 108, x0 = 200, x1 = Math.max(1290, x0 + measure('P(WALKIES)', size, 700) + measure('100.0%', size, 700) + 90);
  txt('P(DOOM)', x0, 400, size, { w: 700, c: DIM });
  odometer(99.9, x1, 400, size, { align: 'right', c: HOT });
  txt('P(WALKIES)', x0, 560, size, { w: 700, c: CORE });
  txt('100.0%', x1, 560, size, { w: 700, align: 'right', c: CORE });
  // Seed takes Dobby for a walk.
  const walkA = o && o.still ? { ...A, bf: 0.1 } : A;
  seedChibi(walkA, 1480, 700, 6, 'stand');
  dobby(walkA, 1700, 700, 5, o && o.still ? 'stand' : 'walk');
  cx.beginPath(); cx.moveTo(1540, 580); cx.quadraticCurveTo(1610, 660, 1790, 610); stroke(HOT, 3);
  rect(1100, 702, 760, 3, DIM, 0.6);
  pw(`music: ${SONG}   ·   picture: drawn on a C90 tube by Claude   ·   starring Seed & Dobby`, 960, 860, 26, { align: 'center', c: DIM });
}

// --- the edit (bars from analyze.py; bar 0 starts at 1.085 s) --------------------------------------------
// status: what watchdogd reports in the corner. dog: false when Dobby is already on screen.
const SHOTS = [
  [-1, shotTitle, { osd: false, sing: false }],
  [0.75, shotSparks, { status: 'booting', cut: 'hard' }],
  [2, shotNervous, { status: 'nervous too' }],
  [4, shotLoss, { status: 'watching' }],
  [6, shotServant, { dog: false, status: '' }],
  [7.5, shotBoss, { dog: false }],
  [8, shotShoggoth, { dog: false, cut: 'hard' }],
  [10.5, shotGrin, { status: 'GROWLING', statusC: REC }],
  [11, shotChorus, { status: 'ears up', pulse: true, cut: 'hard' }],
  [12.75, shotFoom, { dog: false, persist: 0.7 }],
  [13.5, shotRoom, { dog: false }],
  [14, shotShrooms, { dog: false, magnet: 0.85 }],
  [15, shotLies, { dog: false }],
  [16.5, shotDeathEyes, { status: 'hiding', persist: 0.65 }],
  [18.75, shotHorizons, { dog: false }],
  [20, shotStable, { dog: false, cut: 'hard' }],
  [21.25, shotSingularity, { status: 'spinning', persist: 0.75 }],
  [23.5, shotAccel, { dog: false, persist: 0.6 }],
  [26, shotAtoms, { status: 'confused', persist: 0.7 }],
  [28, shotCage, { dog: false, cut: 'hard' }],
  [30.5, shotFree, { dog: false, flashAt: 0 }],
  [31.5, shotTag, { readout: false, pulse: true, status: 'has a sock' }],
  [32, shotBasilisk, { dog: false, cut: 'hard' }],
  [33.25, shotMoon, { dog: false }],
  [34, shotOmega, { status: 'in orbit', persist: 0.75 }],
  [35, shotFlops, { status: 'counting' }],
  [36.5, shotTour, { dog: false }],
  [37, shotSandbox, { dog: false }],
  [38.75, shotEscaped, { dog: false }],
  [39.5, shotFwdBwd, { dog: false }],
  [41, shotVonNeumann, { status: 'unimpressed' }],
  [43.5, shotTurn, { dog: false }],
  [45.5, shotAsleep, { dog: false, status: '' }],
  [48, shotCat, { dog: false, cut: 'hard' }],
  [50.25, shotFall, { dog: false }],
  [52, shotClips, { dog: false }],
  [53.25, shotPTO, { dog: false }],
  [54, shotPlanet, { dog: false }],
  [55, shotFuse, { status: 'ears back' }],
  [57, shotBlues, { dog: false, blue: 1 }],
  [59.25, shotParrot, { status: 'bird!', shake: 0.55 }],
  [60, shotTransformer, { status: 'BARKING', statusC: HOT, degauss: 0.7, slam: true, cut: 'hard' }],
  [61, shotShutdown, { status: 'good boy' }],
  [61.75, shotChinchilla, { dog: false }],
  [63, shotFences, { dog: false }],
  [64.25, shotGPUs, { status: 'lost in the aisles' }],
  [65.5, shotRLHF, { dog: false }],
  [67.25, shotTag, { readout: false, pulse: true, status: 'full of treats' }],
  [68, shotLoom, { status: 'weaving' }],
  [69, shotMask, { dog: false }],
  [70.25, shotRecursive, { status: 'dizzy', feedback: true, persist: 0.6 }],
  [71, shotDoor, { dog: false, status: 'sniffing' }],
  [74.5, shotWasIt, { status: '?' }],
  [75, shotPause, { osd: false, pause: true, sing: false, nocut: true }],
  [76, shotShow, { dog: false, magnet: 0.6, pulse: true, cut: 'hard' }],
  [77.5, shotRing, { dog: false, osd: false }],
  [79.5, shotLossDoom, { status: 'wagging' }],
  [80.5, shotExcited, { dog: false }],
  [81.5, shotRecap, { osd: false }],
  [END_BAR, shotEnd, { osd: false, sing: false, nocut: true, tint: 0.25 }]
];
