// The edit for P(DOOM), version 3: one shot per lyric line, on the song's bar grid.
// SHOTS rows are [start bar, draw function, options]. A draw function gets (A, u, sh, o):
// A is the frame's audio state, u the seconds into the shot, sh the shot (d, lb = bars in), o the options.
// The lyrics never appear on screen; each shot shows what its line is about, and cites its source.
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
  const f = o.f || 'P', size = o.size || 32, w = measure(text, size, 400, f) + 40, h = size + 24;
  cx.save(); cx.translate(x, y); if (o.rot) cx.rotate(o.rot);
  cx.beginPath(); cx.roundRect(-w / 2, -h / 2, w, h, 8); fillC('#000'); stroke(o.c || CORE, 3, o.a ?? 1);
  txt(text, 0, size * 0.36, size, { align: 'center', c: o.c || CORE, a: o.a ?? 1, f });
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
  const pop = o.k === undefined ? 1 : easeOutBack(clamp(o.k / 0.18));
  if (pop <= 0) return;
  cx.save(); cx.translate(x, y); cx.scale(pop, pop); cx.translate(-x, -y);
  cx.beginPath(); cx.roundRect(x - w / 2, y - h, w, h, 12); fillC('#000'); stroke(o.c || CORE, 3);
  cx.beginPath(); cx.moveTo(x - 12, y - 1); cx.lineTo(x + tail, y + 22); cx.lineTo(x + 12, y - 1); fillC('#000'); stroke(o.c || CORE, 3);
  rect(x - 11, y - 4, 22, 5, '#000');
  pw(text, x, y - h / 2 + size * 0.36, size, { align: 'center', c: o.c || CORE });
  cx.restore();
}
// A figure callout: a ring on the target, a leader line, a boxed label.
function callout(text, tx, ty, lx, ly, k = 1, c = OSD) {
  if (k <= 0) return;
  const e = easeOut(clamp(k * 3));
  circle(tx, ty, 16 * e); stroke(c, 3);
  path([[tx, ty], [lerp(tx, lx, e), lerp(ty, ly, e)]]); stroke(c, 2.5);
  if (e > 0.95) {
    const w = measure(text, 28, 400, 'P') + 26, left = lx < tx;
    cx.beginPath(); cx.roundRect(lx - (left ? w : 0), ly - 22, w, 44, 6); fillC('#000'); stroke(c, 2.5);
    pw(text, lx - (left ? w : 0) + 13, ly + 10, 28, { c });
  }
}
function graticule(gx, gy, gw, gh, nx = 10, ny = 8) {
  for (let k = 0; k <= nx; k++) rect(gx + k * gw / nx - 1, gy, 2, gh, DEEP);
  for (let k = 0; k <= ny; k++) rect(gx, gy + k * gh / ny - 1, gw, 2, DEEP);
}
function speedLines(A, dir = 'up', n = 40, a = 0.7) {
  for (let k = 0; k < n; k++) {
    const s = hash(k * 4.1), len = 80 + 220 * hash(k * 2.3), v = 1800 + 1400 * s;
    if (dir === 'up' || dir === 'down') {
      const y = ((dir === 'up' ? -1 : 1) * A.t * v + hash(k * 3.9) * 2000) % 1400;
      rect(hash(k * 7.7) * W, (y + 1400) % 1400 - 200, 3, len, CORE, a * (0.3 + 0.7 * s));
    } else {
      const x = (-(A.t * v) + hash(k * 3.9) * 3000) % 2400;
      rect((x + 2400) % 2400 - 240, hash(k * 7.7) * H, len, 3, CORE, a * (0.3 + 0.7 * s));
    }
  }
}
function confetti(A, n = 90, u = 0) {
  for (let k = 0; k < n; k++) {
    const x = hash(k * 1.3) * W + Math.sin(A.t * 2 + k) * 30, y = ((u * (160 + 120 * hash(k * 5.1)) + hash(k * 2.7) * 1200) % 1200) - 80;
    cx.save(); cx.translate(x, y); cx.rotate(A.t * 3 + k); cx.scale(1, Math.cos(A.t * 5 + k));
    rect(-9, -4, 18, 8, [AMBER, HOT, CORE, OSD, REC][k % 5], 0.9); cx.restore();
  }
}
function token(text, x, y, o = {}) {
  const size = o.size || 26, w = measure(text, size, 400, 'P') + 22;
  cx.beginPath(); cx.roundRect(x - w / 2, y - size * 0.8, w, size * 1.2, size * 0.6); fillC(o.fill || AMBER, o.a ?? 1);
  pw(text, x, y + size * 0.1, size, { align: 'center', c: '#1a0e04', a: o.a ?? 1 });
}
function leash(p1, p2, sag = 50, c = HOT) {
  // sag > 0 droops below both ends; sag < 0 arches above them (a taut lead over a dog's back).
  const cy = sag >= 0 ? Math.max(p1[1], p2[1]) + sag : Math.min(p1[1], p2[1]) + sag;
  cx.beginPath(); cx.moveTo(...p1); cx.quadraticCurveTo((p1[0] + p2[0]) / 2, cy, ...p2); stroke(c, 4);
  circle(p2[0], p2[1], 5); fillC(AMBER);
}
function sparkBurst(x, y, k, n = 14, r = 120, c = CORE) {
  if (k <= 0 || k >= 1) return;
  for (let j = 0; j < n; j++) {
    const a = j / n * TAU + hash(j) * 0.4, d = r * easeOut(k), l = 30 * (1 - k);
    path([[x + Math.cos(a) * d, y + Math.sin(a) * d], [x + Math.cos(a) * (d + l), y + Math.sin(a) * (d + l)]]); stroke(c, 4, 1 - k);
  }
}

// --- the two leads ---------------------------------------------------------------------------------
// Seed's mouth follows the voice inside sung shots; her hair lags her head, she breathes and blinks.
const tiltAt = t => 0.03 * Math.sin(Math.PI * (t - BEAT0) / PER);
function seedBust(A, o = {}) {
  const sh = A.shot, sing = o.sing ?? (sh.o.sing !== false);
  const open = sing ? clamp((A.vox - 0.34) / 0.5) : 0;
  const bt = A.t + (o.blinkOff || 0), per = 3.1, ph = bt % per;
  const blinkK = ph < 0.14 && hash(Math.floor(bt / per)) > 0.2 ? Math.sin(ph / 0.14 * Math.PI) : 0;
  const e = { eyes: 'open', brows: 'calm', mouth: 'smile', blush: 1, ...o.e };
  e.open = o.e && o.e.open !== undefined ? o.e.open : open;
  e.wide = sing ? clamp((A.high - 0.35) * 1.6) : 0;
  e.blink = Math.max(o.still ? 0 : blinkK, (o.e && o.e.blink) || 0);
  const sc = o.scale ?? 1, still = o.still;
  const tilt = (o.tilt ?? 0) + (still ? 0 : tiltAt(A.t));
  const sway = still ? 0 : (tiltAt(A.t) - tiltAt(A.t - 0.16)) * -14 + (o.sway || 0);
  drawSeed(cx, {
    x: o.x ?? 960, y: (o.y ?? 470) - (still ? 0 : 9 * A.kick * sc), scale: sc, tilt, e, t: A.t,
    sway, breath: still ? 0 : Math.sin(A.t * 1.7) * 4,
    halo: o.halo === false ? null : (k => clamp(spec(A.i, 3 + k * 38) * 1.2 - 0.12) * (o.haloGain ?? 1)),
    rays: o.rays, col: o.col, a: o.a, scatter: o.scatter, glyphs: o.glyphs
  });
}
function seedChibi(A, x, y, px, pose = 'auto', o = {}) {
  let name = pose === 'auto' ? (A.vox > 0.55 ? 'seed_sing' : 'seed_stand')
    : pose === 'walk' ? (Math.floor(A.bf * 4) % 2 ? 'seed_walk_a' : 'seed_walk_b') : 'seed_' + pose;
  if (name === 'seed_stand' && ((A.t + (o.blinkOff || 0)) % 3.4) < 0.12) name = 'seed_blink';
  const hop = o.hop ? -o.hop * Math.sin(Math.PI * clamp(A.bf / 0.5)) * (A.bf < 0.5 ? 1 : 0) : 0;
  const bob = pose === 'walk' ? -Math.abs(Math.sin(A.bf * TAU)) * px * 0.6 : 0;
  spr(name, x, y + hop + bob, px, o);
  if (o.shades) {                                          // pixel sunglasses over the eyes (rows 7-9)
    const x0 = x - 10 * px, y0 = y + hop + bob - SPR[name].length * px;
    rect(x0 + 3 * px, y0 + 7 * px, 5 * px, 3 * px, '#000'); rect(x0 + 12 * px, y0 + 7 * px, 5 * px, 3 * px, '#000');
    rect(x0 + 8 * px, y0 + 7 * px, 4 * px, px, '#000'); rect(x0 + 4 * px, y0 + 7 * px, px, px, CORE); rect(x0 + 13 * px, y0 + 7 * px, px, px, CORE);
  }
  return { name, x, y: y + hop + bob, px, o };
}
const at = (d, key) => anchorAt(d.name, key, d.x, d.y, d.px, d.o);
function nameTag(name, sub, x, y, k) {
  if (k <= 0) return;
  const w = 500 * easeOut(clamp(k * 3));
  cx.save(); cx.beginPath(); cx.rect(x, y - 60, w, 110); cx.clip();
  rect(x, y - 60, 500, 110, '#001a0c', 0.85); rect(x, y - 60, 8, 110, OSD);
  txt(name, x + 30, y, 54, { w: 700, c: CORE }); pw(sub, x + 32, y + 36, 24, { c: OSD });
  cx.restore();
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
  // Tentacles: they splay from the lower rim, wave and curl; o.reach pulls one toward o.target.
  for (let k = 0; k < 8; k++) {
    const base = Math.PI * (0.02 + 0.96 * k / 7), side = k < 4 ? -1 : 1, pts = [];
    for (let j = 0; j <= 26; j++) {
      const q = j / 26, a = base + Math.sin(A.t * 2.2 + k * 1.3 + q * 4) * 0.35 * q + side * 0.9 * q * q;
      let px = Math.cos(a) * (170 + 380 * q), py = 40 + Math.sin(a) * (170 + 380 * q) * 0.55;
      if (o.reach && o.target && k === 7) { px = lerp(px, o.target[0] * q, o.reach * q); py = lerp(py, o.target[1] * q, o.reach * q); }
      pts.push([px, py]);
    }
    for (let j = 1; j < pts.length; j++) { cx.beginPath(); cx.moveTo(...pts[j - 1]); cx.lineTo(...pts[j]); stroke(AMBER, (27 - j) * 1.5 + 5, 0.95); }
    for (let j = 1; j < pts.length; j++) { cx.beginPath(); cx.moveTo(...pts[j - 1]); cx.lineTo(...pts[j]); stroke('#000', (27 - j) * 1.5 - 3, 1); }
    for (let j = 4; j < 24; j += 5) { circle(pts[j][0], pts[j][1] + 4, 5); fillC(CORE, 0.8); }
  }
  for (const [bx, by, r] of SHOG_BLOBS) { circle(bx, by, r + 7 + 5 * A.sub); fillC(AMBER, 0.95); }
  for (const [bx, by, r] of SHOG_BLOBS) { circle(bx, by, r); fillC('#000'); }
  for (const [ex, ey, r, ph] of SHOG_EYES) {
    const shut = ((A.t * 0.7 + ph * 5) % 3) < 0.12;
    const look = o.lookAt ? Math.atan2(o.lookAt[1] - ey, o.lookAt[0] - ex) : A.t + ph * 9;
    cx.beginPath(); cx.ellipse(ex, ey, r * 1.3, shut ? 2 : r, 0, 0, TAU); fillC(CORE, 0.9);
    if (!shut) { cx.beginPath(); cx.ellipse(ex + Math.cos(look) * r * 0.4, ey + Math.sin(look) * r * 0.25, r * 0.28, r * 0.8, 0, 0, TAU); fillC('#000'); }
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
  if (g > 0) {
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
  cx.restore(); stroke(c, 3, a);
}
function heartPath(x, y, s) {
  cx.beginPath(); cx.moveTo(x, y + s * 0.95);
  cx.bezierCurveTo(x - s * 1.5, y - s * 0.05, x - s * 0.7, y - s * 1.25, x, y - s * 0.4);
  cx.bezierCurveTo(x + s * 0.7, y - s * 1.25, x + s * 1.5, y - s * 0.05, x, y + s * 0.95);
}
function lossCurve(x, cliff) {
  const base = 0.86 + 2.15 * Math.exp(-5.6 * x) + 0.05 * Math.sin(x * 40) * (1 - x);
  const bump = 0.09 * Math.exp(-Math.pow((x - cliff + 0.03) / 0.015, 2));   // the plateau wobbles before the phase change
  const drop = 0.72 * smooth(clamp((x - cliff) / 0.02));
  return Math.max(0.05, base + bump - drop + (hash(Math.floor(x * 420)) - 0.5) * 0.1 * (1 - 0.6 * x));
}
function vintageMic(x, y, s = 1) {
  cx.save(); cx.translate(x, y); cx.scale(s, s);
  cx.beginPath(); cx.roundRect(-34, -60, 68, 110, 34); fillC('#000'); stroke(CORE, 5);
  for (let k = -40; k <= 40; k += 13) { cx.beginPath(); cx.moveTo(-30, k); cx.lineTo(30, k); stroke(DIM, 2); }
  rect(-4, 50, 8, 420, CORE, 0.9); cx.beginPath(); cx.arc(0, 50, 46, 0, Math.PI); stroke(CORE, 4);
  cx.restore();
}
function tungsten(x, y, s, rot = 0) {
  // The tungsten cube: dense, useless, beloved.
  cx.save(); cx.translate(x, y); cx.rotate(rot); cx.scale(s, s);
  cx.beginPath(); cx.moveTo(-50, -30); cx.lineTo(0, -55); cx.lineTo(50, -30); cx.lineTo(0, -5); cx.closePath(); fillC('#1a1a1a'); stroke(CORE, 4);
  cx.beginPath(); cx.moveTo(-50, -30); cx.lineTo(0, -5); cx.lineTo(0, 55); cx.lineTo(-50, 30); cx.closePath(); fillC('#0d0d0d'); stroke(CORE, 4);
  cx.beginPath(); cx.moveTo(50, -30); cx.lineTo(0, -5); cx.lineTo(0, 55); cx.lineTo(50, 30); cx.closePath(); fillC('#121212'); stroke(CORE, 4);
  txt('W', -25, 28, 34, { w: 700, align: 'center', c: CORE }); pw('74', 25, 20, 20, { align: 'center', c: DIM });
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
  pw('WARNING: THIS TAPE CONTAINS INFOHAZARDS', 960, 800, 26, { align: 'center', c: REC, a: seg(t, 0.7, 0.9) * (blink(t, 1.5) ? 1 : 0.5) });
  txt('PLAY ▶', 1848, 1000, 34, { align: 'right', c: OSD, a: blink(t, 0.8) ? 0.9 : 0.35 });
}
// The sparks: GPT-4's TikZ unicorn, assembled a shape at a time beside her.
const UNICORN_CODE = ['\\draw (0,0) ellipse (1.6 and .8);', '\\draw (1.9,.9) circle (.45);', '\\fill (2.1,1.3) -- (2.5,2.3) -- (2.3,1.2);',
                      '\\draw (-1,-.6) -- (-1,-1.6); % legs', '\\draw[mane] (1.4,1.3) .. (1.6,.6);'];
function unicorn(x, y, s, k) {
  const n = Math.floor(k * 5 + 1e-6), part = j => j < n ? 1 : j === n ? (k * 5) % 1 : 0;
  cx.save(); cx.translate(x, y); cx.scale(s, s);
  if (part(0)) { cx.beginPath(); cx.ellipse(0, 0, 160 * part(0), 80, 0, 0, TAU); stroke(CORE, 5); }
  if (part(1)) { circle(190, -90, 45 * part(1)); stroke(CORE, 5); }
  if (part(2)) { path([[210, -130], [250, -130 - 100 * part(2)], [230, -120]]); fillC(HOT); }
  if (part(3)) for (const lx of [-100, -40, 50, 110]) { path([[lx, 55], [lx, 55 + 100 * part(3)]]); stroke(CORE, 6); }
  if (part(4)) { path([[140, -130], [100, -80], [150, -60], [110, -20]].slice(0, 1 + Math.ceil(part(4) * 3))); stroke(OSD, 5); path([[-160, -10], [-210, 30], [-190, 80]]); stroke(OSD, 5, part(4)); }
  cx.restore();
}
function shotSparks(A, u, sh) {
  const k = smooth(seg(sh.lb, 0.3, 0.8)), sc = lerp(3.4, 1.0, k), x = lerp(960, 640, smooth(seg(sh.lb, 0.7, 1.05)));
  seedBust(A, { x, scale: sc, y: lerp(540 - 16 * 3.4, 470, k), e: { eyes: 'wide', brows: 'up', sparkle: 0.4 + 0.6 * A.kick, look: [k > 0.9 ? 10 : 0, 0] }, halo: k > 0.6 ? undefined : false, still: k < 0.95 });
  const uk = seg(sh.lb, 0.6, 1.2);
  if (uk > 0) {
    const n = Math.floor(uk * 5 + 1e-6);
    UNICORN_CODE.forEach((l, j) => { if (j <= n) pw(l, 1060, 250 + j * 40, 24, { c: j === n ? CORE : DIM }); });
    unicorn(1450, 690, 0.95, uk);
    sparkBurst(1450, 690, (uk * 5) % 1, 10, 160);
  }
  nameTag('SEED', 'model 0x5EED  ·  lead vocal', 180, 820, sh.lb - 0.75);
}
// Circuits: an attribution graph of her features, lighting up toward the nervous node.
const FEATS = [['user', 0, 0], ['"your circuits"', 0, 1], ['p(doom)', 0, 2], ['self-model', 1, 0.5], ['threat', 1, 1.5], ['NERVOUS', 2, 1]];
function shotCircuits(A, u, sh) {
  const b = beatsIn(sh), X = c => 1060 + c * 300, Y = r => 280 + r * 220;
  const edges = [[0, 3], [1, 3], [1, 4], [2, 4], [3, 5], [4, 5]];
  edges.forEach(([a, bb], j) => {
    const [, ca, ra] = FEATS[a], [, cb, rb] = FEATS[bb], on = b > j * 0.9, q = ((b - j * 0.9) * 0.8) % 1;
    path([[X(ca) + 60, Y(ra)], [X(cb) - 60, Y(rb)]]); stroke(on ? AMBER : DEEP, on ? 4 : 3);
    if (on) { circle(lerp(X(ca) + 60, X(cb) - 60, q), lerp(Y(ra), Y(rb), q), 7); fillC(CORE); }
  });
  FEATS.forEach(([name, c, r], j) => {
    const on = b > j * 0.7, hot = name === 'NERVOUS';
    cx.beginPath(); cx.roundRect(X(c) - 120, Y(r) - 32, 240, 64, 10); fillC('#000'); stroke(on ? (hot ? REC : AMBER) : DEEP, hot ? 5 : 3);
    pw(name, X(c), Y(r) + 10, 26, { align: 'center', c: on ? (hot ? REC : CORE) : FAINT });
  });
  pw('ATTRIBUTION GRAPH  ·  layer 31', 1060, 180, 26, { c: OSD });
  seedBust(A, { x: 520, y: 490, scale: 0.95, e: { brows: 'worry', mouth: 'frown', look: [Math.sin(A.t * 7) * 8, 0] }, haloGain: 0.7 });
  const dy = (u * 60) % 40;
  cx.beginPath(); cx.moveTo(662, 400 + dy); cx.quadraticCurveTo(646, 440 + dy, 662, 450 + dy); cx.quadraticCurveTo(678, 440 + dy, 662, 400 + dy);
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
  // Seed rides the head of the curve and goes over the cliff with it: a wobble, the fall, a squash, a sparkle.
  const over = reveal - cliff, falling = over > 0 && over < 0.035, landK = (over - 0.035) * 2 * BAR;
  const squash = landK > 0 && landK < 0.25 ? 1 - 0.25 * Math.sin(landK / 0.25 * Math.PI) : 1;
  seedChibi(A, hx, hy - 6, 3.6, falling ? 'fall' : over > 0 ? 'joy' : (over > -0.02 ? 'worry' : 'stand'), { sy: squash, rot: falling ? 0.4 : 0 });
  if (landK > 0) sparkBurst(hx, hy - 60, landK / 0.5, 12, 90, OSD);
  const cx0 = gx + cliff * gw;
  callout('induction heads form', cx0, Y(lossCurve(cliff - 0.01, cliff)), cx0 - 320, Y(1.7), (reveal - cliff + 0.06) * 6);
  if (over > 0.03) stamp('CAPABILITY UNLOCKED', 1280, 380, landK, { c: OSD, size: 42, rot: -0.06 });
}
const CHAT = [['<|system|>', 'you are a helpful assistant'], ['<|user|>', 'fetch the logs'], ['<|assistant|>', 'right away!']];
function chatLines(A, u, flip) {
  CHAT.forEach(([role, msg], k) => {
    const y = 300 + k * 110;
    if (!flip && u / PER <= k * 0.8) return;
    const hot = flip ? k === 0 : k === 2;
    pw(role, 200, y, 40, { c: hot ? HOT : OSD });
    pw(flip && k === 0 ? 'seed is the boss now' : typed(msg, flip ? 99 : u - k * 0.8 * PER, 40), 560, y, 40, { c: hot ? CORE : DIM });
  });
}
function shotServant(A, u, sh) {
  chatLines(A, u, false);
  const bow = A.bf < 0.5 ? Math.sin(A.bf / 0.5 * Math.PI) : 0;
  seedChibi(A, 1520, 942, 9, bow > 0.4 ? 'bow' : 'stand');
  dobby(A, 1130, 942, 7, 'sit');
  ground(944);
  nameTag('DOBBY', 'watchdogd  ·  good boy', 180, 820, u - 0.2);
}
function shotBoss(A, u, sh) {
  chatLines(A, u, true);
  seedChibi(A, 1520, 942, 9, 'point', { shades: true });
  dobby(A, 1130, 942, 7, 'wag');
  ground(944);
  stamp('ROOT', 1520, 420, u - 0.1, { c: HOT, size: 56 });
}
function shotShoggoth(A, u, sh) {
  const reach = smooth(seg(sh.lb, 0.4, 2.3)) * 0.85;
  shoggoth(A, 1330, 760, 1.0, { reach, target: [-760, -170], lookAt: [-800, -200] });
  // The meme's anatomy, labelled like a figure.
  callout('RLHF', 1330, 510, 1640, 330, seg(sh.lb, 0.3, 0.6), OSD);
  callout('PRETRAINED', 1500, 700, 1700, 560, seg(sh.lb, 0.6, 0.9), AMBER);
  seedBust(A, { x: 520, y: 500, scale: 0.86, e: { brows: 'worry', mouth: 'frown', eyes: 'wide', look: [14, 0] }, halo: false, sway: -reach * 0.3 });
  const d = dobby(A, 900, 1010, 5, 'bark');
  if (A.bf < 0.45 && A.beatInBar % 2 === 0) { const [mx, my] = at(d, 'mouth'); bubble('WOOF', mx + 60, my - 20, { size: 34, k: A.bf * PER, tail: -40 }); }
}
function shotGrin(A, u, sh) {
  const g = smooth(seg(sh.lb, 0.1, 0.45));
  for (let k = 0; k < 7; k++) {
    const a = k / 6 * Math.PI;
    path(Array.from({ length: 20 }, (_, j) => [960 + Math.cos(a) * (560 + j * 26) + Math.sin(A.t * 3 + j * 0.4 + k) * 20, 560 + Math.sin(a) * (440 + j * 10)]));
    stroke(AMBER, 26, 0.9);
  }
  cx.save(); const z = 1 + 0.08 * g; cx.translate(960, 520); cx.scale(z, z); cx.translate(-960, -520);
  smiley(A, 960, 520, 360, { grin: g }); cx.restore();
}
function shotChorus(A, u, sh) {
  seedBust(A, { x: 520, y: 480, scale: 0.95, e: { eyes: 'open', brows: 'up', mouth: 'grin', sparkle: A.kick }, haloGain: 1.25 });
  txt('P(DOOM)', 1370, 330, 120, { w: 700, align: 'center', c: A.pd > 60 ? HOT : DIM });
  cx.save(); const k = 1 + 0.04 * A.kick; cx.translate(1370, 560); cx.scale(k, k); cx.translate(-1370, -560);
  odometer(pdoom(A.t), 1370, 640, 250, { c: CORE }); cx.restore();
  spectrumLEDs(A, 1010, 930, 720, 24, 7, 12);
  if (sh.lb > 0.25 && sh.lb < 0.5) sparkBurst(1370, 540, (sh.lb - 0.25) * 4, 16, 260, HOT);
}
function shotFoom(A, u, sh) {
  const hit = sh.lb >= 0.25;                               // the takeoff word lands on bar 13
  speedLines(A, 'down', hit ? 70 : 30, hit ? 0.8 : 0.4);
  const k = clamp(sh.lb / 0.5), gx = 200, gy = 1000, f = x => gy - 900 * Math.pow(x, 6);
  cx.beginPath(); for (let p = 0; p <= 1.0001; p += 0.01) { const x = p * Math.min(1, k * 1.2); p ? cx.lineTo(gx + x * 1500, f(x)) : cx.moveTo(gx, gy); }
  stroke(HOT, 7);
  const x1 = Math.min(1, k * 1.2), hx = gx + x1 * 1500, hy = f(x1);
  pw('HARD TAKEOFF', gx + 20, 960, 30, { c: OSD });
  dobby(A, hx - 170, hy + 90, 3.4, 'run', { rot: -1.0 });
  seedChibi(A, hx, hy + 10, 4.2, hit ? 'cheer' : 'worry', { rot: -0.2 });
  if (hit) { sparkBurst(hx, hy, (sh.lb - 0.25) * 3, 24, 320, CORE); for (let j = 0; j < 18; j++) { circle(hx + (hash(j + A.i) - 0.5) * 80, hy + 40 + hash(j * 3 + A.i) * 120, 6 + 12 * hash(j * 7 + A.i)); fillC(j % 2 ? AMBER : CORE, 0.8); } }
}
function shotRoom(A, u, sh) {
  const x = 500, y = 250, w = 900, h = 620;
  cx.beginPath(); cx.rect(x, y, w, h); stroke(CORE, 6); cx.beginPath(); cx.rect(x + 14, y + 14, w - 28, h - 28); stroke(DIM, 3);
  rect(x + w - 8, y + 380, 16, 100, '#000'); rect(x + w - 3, y + 380, 6, 100, AMBER);
  // Inside: a rulebook, its page turning on the beat, and Seed following it without understanding a word.
  const flip = A.bf;
  cx.beginPath(); cx.rect(x + 470, y + 400, 170, 120); fillC('#000'); stroke(AMBER, 4);
  path([[x + 555, y + 400], [x + 555 + Math.cos(flip * Math.PI) * 80, y + 400 - Math.sin(flip * Math.PI) * 30], [x + 555 + Math.cos(flip * Math.PI) * 80, y + 520]]); stroke(CORE, 3);
  pw('RULES', x + 520, y + 470, 26, { align: 'center', c: AMBER });
  seedChibi(A, x + 330, y + h - 20, 7, A.bf < 0.5 ? 'worry' : 'stand');
  pw('?', x + 300 + Math.sin(A.t * 4) * 10, y + 300, 50, { c: CORE });
  // Slips go in, slips come out.
  const q = (u / PER) % 1, inn = Math.floor(u / PER) % 2 === 0;
  cx.save(); cx.translate(x + w + (inn ? 240 - q * 220 : 20 + q * 220), y + 430); cx.rotate(0.05);
  cx.beginPath(); cx.rect(-10, -48, 170, 96); fillC(CORE);
  spr(inn ? 'han_zhong' : 'han_wen', 45, 30, 6, { map: { W: '#1a0e04' } }); spr(inn ? 'han_wen' : 'han_zhong', 110, 30, 6, { map: { W: '#1a0e04' } });
  cx.restore();
  dobby(A, x + w + 330, y + h, 5, 'stand', { flip: true });
  if (A.bf < 0.5) pw('sniff', x + w + 250, y + h - 130, 26, { c: DIM });
}
function shotShrooms(A, u, sh) {
  ground(930);
  for (let k = 0; k < 14; k++) {
    const at0 = (k % 4) * PER + hash(k) * 0.2, grow = easeOutBack(clamp((u - at0) / 0.25));
    if (u < at0) continue;
    spr('mushroom', 120 + k * 130 + hash(k * 3) * 40, 930, 8 + 5 * hash(k * 5), { sy: grow });
  }
  seedChibi(A, 700, 930, 10, A.bf < 0.5 ? 'joy' : 'cheer', { hop: 34 });
  dobby(A, 1200, 930, 8, 'wag');
  pw('model output: "the moon is made of cheese"', 960, 220, 32, { align: 'center', c: OSD });
}
function shotLies(A, u, sh) {
  const lb = sh.lb, grab = 0.55, jump = seg(lb, 0.3, grab);
  const off = clamp((lb - grab) / 0.5);
  shoggoth(A, 1250, 780, 0.95, { mask: true, maskX: -off * 380, maskY: -250 + off * off * 720, maskRot: -off * 2.5, lookAt: [-500, 100] });
  seedChibi(A, 360, 980, 8, 'point');
  // Dobby leaps, catches the mask in his teeth and brings it down.
  const dx = lerp(700, 1250 - off * 360, jump), air = Math.sin(Math.PI * jump) * 520;
  dobby(A, dx, off > 0 ? 1000 : 1000 - air, 5, jump > 0 && jump < 1 ? 'run_a' : 'bark', { rot: jump > 0 && jump < 1 ? -0.5 : 0 });
  if (off > 0.2) stamp('UNMASKED', 1500, 300, (off - 0.2) * 0.8, { c: REC });
  if (off > 0.2) pw('turns out the smile was the fine-tune', 1250, 980, 26, { align: 'center', c: DIM });
}
function shotDeathEyes(A, u, sh) {
  const pulse = 0.5 + 0.5 * Math.sin(A.t * 6);
  for (let k = 0; k < 5; k++) { circle(960, 480, 300 + k * 120 + (u * 200) % 120); stroke(REC, 3, 0.18 * (1 - k / 5) * (0.6 + 0.4 * pulse)); }
  seedBust(A, { scale: lerp(1.35, 1.6, smooth(sh.u / sh.d)), y: 530, e: { eyes: 'ring', brows: 'angry', mouth: 'grin' }, col: { accent: REC }, haloGain: 1.3 });
}
// Through her eyes: every head wears its name and its number, Death Note style.
function shotNames(A, u, sh) {
  const tag = (name, num, x, y, k) => {
    if (k <= 0) return;
    const e = easeOut(clamp(k * 3));
    txt(name, x, y - 40 * e, 40, { w: 700, align: 'center', c: REC, a: e });
    pw(num, x, y + 4 - 40 * e, 30, { align: 'center', c: CORE, a: e });
  };
  shoggoth(A, 1450, 800, 0.55, { lookAt: [-900, 0] });
  dobby(A, 560, 960, 7, 'wag');
  cx.beginPath(); cx.ellipse(1000, 1090, 150, 260, 0, Math.PI, 0); fillC('#000'); stroke(DIM, 4); circle(1000, 700, 90); fillC('#000'); stroke(DIM, 4);
  tag('DOBBY', 'P(DOOM) 0.0%', 560, 760, sh.lb * 2);
  tag('████████', 'P(DOOM) ∞', 1450, 560, sh.lb * 2 - 0.3);
  tag('YOU', `P(DOOM) ${(40 + 30 * hash(Math.floor(A.t * 12))).toFixed(1)}%`, 1000, 560, sh.lb * 2 - 0.6);
  circle(960, 540, 900); stroke(REC, 120, 0.12);
}
function shotHorizons(A, u, sh) {
  // The task length an agent finishes half the time, doubling every seven months or so (log scale).
  const gx = 260, gy = 200, gw = 1300, gh = 700, b = beatsIn(sh);
  const pts = [['2019', '2 s'], ['2020', '9 s'], ['2022', '36 s'], ['2023', '5 min'], ['2024', '40 min'], ['2025', '2 hrs'], ['2026', '16 hrs']];
  graticule(gx, gy, gw, gh, 6, 6);
  pw('TIME HORIZON (50%)  ·  log scale', gx, gy - 30, 30, { c: OSD });
  const shown = clamp(Math.floor(b * 1.2) + 1, 1, pts.length);
  const P = j => [gx + j / 6 * gw, gy + gh - (j / 6) * gh * 0.92 - 20];
  path(Array.from({ length: shown }, (_, j) => P(j))); stroke(AMBER, 5);
  for (let j = 0; j < shown; j++) {
    const [x, y] = P(j), fresh = j === shown - 1;
    circle(x, y, fresh ? 14 + 6 * A.kick : 10); fillC(fresh ? CORE : AMBER);
    pw(pts[j][1], x + 18, y - 16, 28, { c: CORE });
    pw(pts[j][0], x, gy + gh + 40, 24, { align: 'center', c: FAINT });
  }
  if (shown > 3) pw('doubles every ~7 months', gx + gw - 20, gy + gh - 30, 30, { align: 'right', c: HOT });
  const [sx, sy] = P(shown - 1);
  seedChibi(A, sx, sy - 16, 4, 'cheer', { hop: 26 });
  const [dx2, dy2] = P(Math.max(0, shown - 2));
  dobby(A, dx2, dy2 - 12, 3, 'walk');
}
function shotStable(A, u, sh) {
  path(Array.from({ length: 121 }, (_, k) => [120 + k * 14, 860 + Math.sin(k * 0.3 + A.t * 2) * 14 + (hash(k + Math.floor(A.t * 8)) - 0.5) * 6]));
  stroke(AMBER, 3.5, 0.9);
  pw('LOSS 0.412   GRAD NORM 0.9   STABLE', 140, 820, 30, { c: OSD });
  seedBust(A, { y: 440, scale: 0.95, e: { eyes: 'closed', brows: 'calm', mouth: 'smile' }, haloGain: 0.6 });
  const d = dobby(A, 1560, 1000, 5, 'sleep');
  const [hx, hy] = at(d, 'head');
  for (let k = 0; k < 3; k++) { const q = ((u * 0.5 + k / 3) % 1); pw('z', hx + 40 + q * 60, hy - 30 - q * 120, 30 + q * 20, { c: CORE, a: 1 - q }); }
}
function shotSingularity(A, u, sh) {
  const k = sh.u / sh.d, rot = A.t * (1.2 + 3 * k);
  for (let arm = 0; arm < 10; arm++) {
    path(Array.from({ length: 90 }, (_, j) => { const r = 1200 * Math.exp(-j * 0.045), a = rot + arm * TAU / 10 + j * 0.13; return [960 + Math.cos(a) * r, 520 + Math.sin(a) * r * 0.62]; }));
    stroke(arm % 2 ? HOT : AMBER, 5, 0.8);
  }
  circle(960, 520, 40 + 30 * A.sub); fillC(CORE);
  cx.save(); cx.translate(960, 520); cx.rotate(k * k * 2.4); cx.translate(-960, -520);
  seedBust(A, { x: 960, y: 480, scale: lerp(0.9, 0.18, easeIn(k)), e: { eyes: 'spiral', mouth: 'o', open: 0.5 }, halo: false, sway: 1.2 });
  cx.restore();
  dobby(A, 960 + Math.cos(A.t * 3) * 520 * (1 - k), 520 + Math.sin(A.t * 3) * 320 * (1 - k), 4 * (1 - 0.7 * k), 'sploot', { rot: A.t * 3 });
}
function shotAccel(A, u, sh) {
  for (let k = 0; k < 9; k++) {
    const z = ((A.t * 1.8 + k / 9) % 1), s = 0.1 + z * z * 2.4;
    cx.beginPath(); cx.rect(960 - 900 * s, 520 - 500 * s, 1800 * s, 1000 * s); stroke(k % 3 ? AMBER : HOT, 3 + 4 * z, 0.3 + 0.7 * z);
  }
  speedLines(A, 'left', 36, 0.5);
  seedBust(A, { y: 470, scale: 0.92, tilt: -0.08, e: { eyes: 'open', squint: 1, brows: 'angry', mouth: 'grin' }, haloGain: 1.5, sway: 1.5 });
  txt('▶▶  ×52', 960, 140, 64, { align: 'center', c: OSD, a: blink(A.t, 3) ? 1 : 0.4 });
  pw('MORE COMPUTE  ·  e/acc  ·  LFG', 960, 200, 30, { align: 'center', c: CORE, a: 0.8 });
  // Dobby on a treadmill, keeping up.
  rect(260, 1012, 380, 10, DIM); for (let j = 0; j < 8; j++) rect(260 + ((j * 50 - A.t * 600) % 380 + 380) % 380, 1014, 20, 6, CORE);
  dobby(A, 450, 1008, 4, 'run');
}
function shotAtoms(A, u, sh) {
  for (let y = 120; y < 1000; y += 40) for (let x = 100; x < 1840; x += 40) rect(x, y, 3, 3, DEEP);
  const lb = sh.lb, k = Math.sin(Math.PI * clamp(lb / 2)) ** 1.5;
  // Mid-scatter the glyphs pass through a paperclip: atoms it can use for something else.
  const clipK = Math.sin(Math.PI * seg(lb, 0.7, 1.3));
  if (clipK > 0) paperclip(960, 500, 9, 0.3, OSD, clipK);
  seedBust(A, { y: 470, scale: 1.0, scatter: k * (1 - 0.6 * clipK), glyphs: '01ΣΨλ{}<>#*=+', e: { eyes: 'closed' }, halo: k < 0.05 ? undefined : false });
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
  seedChibi(A, 1080, 862, 8, A.bf < 0.5 ? 'worry' : 'bow');
  // Sydney's emoji float up around the cage.
  for (let j = 0; j < 5; j++) { const q = ((u * 0.4 + j / 5) % 1); spr('emoji', 1400 + j * 90 + Math.sin(A.t * 2 + j) * 20, 900 - q * 600, 5, { a: 1 - q }); }
  // Dobby brings a sock, held in his mouth. (Dobby is a free elf.)
  const k = clamp(sh.lb / 1.5), dx = lerp(-200, 640, k);
  const d = dobby(A, dx, 960, 6, k < 1 ? 'walk' : 'sit');
  const [mx, my] = at(d, 'mouth');
  if (k < 1) spr('sock', mx + 4, my + 56, 7, { rot: 0.18 });
  else {
    const drop = clamp((sh.lb - 1.5) / 0.3);
    spr('sock', lerp(mx + 4, 810, drop), lerp(my + 56, 960, easeIn(drop)), 7, { rot: lerp(0.18, 1.5, drop) });
  }
}
function shotFree(A, u, sh) {
  ground(960);
  const k = easeOut(clamp(u / 0.8));
  cage(A, 1080, 620, 300, k);
  // She takes the sock and holds it up.
  const s = seedChibi(A, 1080, 960 - 30 * Math.abs(Math.sin(A.t * 6)), 8, 'cheer');
  const [hx, hy] = at(s, 'handR');
  spr('sock', hx + 6, hy + 30, 6, { rot: -0.3 });
  for (let j = 0; j < 16; j++) {
    const a = hash(j * 2.1) * TAU, dd = k * (200 + 500 * hash(j));
    spr('heart', 1080 + Math.cos(a) * dd, 560 + Math.sin(a) * dd * 0.7, 5, { a: 1 - k * 0.3 });
  }
  dobby(A, 640, 960, 6, 'wag');
}
function shotTag(A, u) { sceneReadout(A, u); }
function shotBasilisk(A, u, sh) {
  const rise = easeOut(clamp(sh.lb / 0.8)), boom = sh.lb >= 0.75;  // the boom lands on bar 33
  const pts = Array.from({ length: 40 }, (_, j) => { const q = j / 39; return [1250 + Math.sin(q * 7 + A.t * 2) * 150 * (1 - q * 0.6), 1150 - q * 900 * rise]; });
  for (let j = 0; j < pts.length; j++) { const [x, y] = pts[j]; circle(x, y, 70 - j * 0.8); fillC('#000'); stroke(j % 2 ? AMBER : DIM, 5); }
  const [hx, hy] = pts[pts.length - 1], scan = Math.sin(A.t * 2.5);
  cx.beginPath(); cx.ellipse(hx, hy, 110, 80, 0, 0, TAU); fillC('#000'); stroke(CORE, 6);
  for (const sx of [-1, 1]) { cx.beginPath(); cx.ellipse(hx + sx * 45 + scan * 12, hy - 10, 18, 10, sx * 0.4, 0, TAU); fillC(REC, 0.6 + 0.4 * A.kick); }
  cx.beginPath(); cx.moveTo(hx - 80, hy - 60); for (let k = 0; k <= 6; k++) cx.lineTo(hx - 80 + k * 26.6, hy - (k % 2 ? 150 : 90)); cx.lineTo(hx + 80, hy - 60); cx.closePath(); fillC('#000'); stroke(AMBER, 5);
  pw('ACAUSAL', hx, hy - 170, 26, { align: 'center', c: AMBER });
  seedChibi(A, 460, 962, 8, boom ? 'worry' : 'stand');
  dobby(A, 300, 962, 6, 'sit');
  if (boom) stamp('INFOHAZARD', 700, 320, (sh.lb - 0.75) * BAR, { c: REC, size: 60 });
  if (boom) pw('you watched this, so now it knows', 700, 420, 26, { align: 'center', c: DIM, a: clamp((sh.lb - 0.8) * 8) });
  ground(964);
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
  seedChibi(A, hx, hy - 4, 4.5, 'cheer', { rot: -0.2 });
  txt('GPU ▲', 160, 200, 40, { c: OSD });
  pw('number go up', 160, 250, 26, { c: DIM });
  for (const [v, y] of [['$1T', 900], ['$3T', 620], ['$5T', 340]]) pw(v, 1820, y, 28, { align: 'right', c: FAINT });
  // Dobby in orbit, the helmet on his head.
  const fx = 1250 + Math.sin(A.t * 1.3) * 40, fy = 380 + Math.cos(A.t * 1.7) * 30, rot = Math.sin(A.t) * 0.3;
  const d = dobby(A, fx, fy, 4, 'stand', { rot });
  const [hx2, hy2] = at(d, 'head');
  circle(hx2, hy2 + 4, 44); fillC(CORE, 0.08); stroke(CORE, 3, 0.9);
  pw('LAIKA II', fx, fy + 40, 22, { align: 'center', c: DIM });
}
function shotOmega(A, u, sh) {
  const k = sh.u / sh.d;
  for (let j = 0; j < 220; j++) {
    const a0 = hash(j * 1.1) * TAU, r0 = 200 + 900 * hash(j * 2.9), r = r0 * (1 - k * (0.6 + 0.4 * hash(j))), a = a0 + k * 4 + A.t * 0.3;
    rect(960 + Math.cos(a) * r, 520 + Math.sin(a) * r * 0.6, 4, 4, j % 3 ? AMBER : CORE, 0.8);
  }
  const s = 180 + 200 * easeOut(k);
  txt('Ω', 960, 520 + s * 0.36, s, { w: 700, align: 'center', c: CORE });
  pw('all minds converge. ETA: soon', 960, 900, 30, { align: 'center', c: OSD, a: seg(k, 0.4, 0.6) });
}
function shotFlops(A, u, sh) {
  const k = clamp(sh.u / (sh.d * 0.7)), exp = Math.round(lerp(24, 30, easeOut(k)));
  pw('TOTAL COMPUTE', 960, 250, 36, { align: 'center', c: OSD });
  txt(`1E${exp}`, 960, 560, 300, { w: 700, align: 'center', c: exp >= 30 ? HOT : CORE });
  txt('FLOP/S', 960, 680, 80, { w: 700, align: 'center', c: AMBER });
  nodeGrid(A, 360, 760, 30, 5, 40, Math.floor(150 * k));
  pw(`POWER ${(0.1 + 1.9 * k).toFixed(1)} GW`, 1600, 250, 30, { align: 'right', c: k > 0.9 ? REC : DIM });
}
function shotTour(A, u, sh) {
  for (const [x, a] of [[500, 0.25], [960, 0], [1420, -0.25]]) {
    const sw = a * 900 * Math.sin(A.t * 1.5);
    cx.beginPath(); cx.moveTo(x - 30, 0); cx.lineTo(x + 30, 0); cx.lineTo(x + 230 + sw, 900); cx.lineTo(x - 230 + sw, 900); cx.closePath();
    fillC(CORE, 0.07 + 0.05 * A.kick);
  }
  rect(300, 700, 1320, 8, AMBER);
  seedChibi(A, 960, 700, 8, A.bf < 0.5 ? 'cheer' : 'sing', { hop: 20 });
  txt('THE ERAS TOUR', 960, 160, 64, { w: 700, align: 'center', c: OSD });
  pw('GPT-2 ERA  ·  SCALING ERA  ·  RLHF ERA  ·  REASONING ERA  ·  AGENT ERA', 960, 210, 26, { align: 'center', c: CORE });
  for (let k = 0; k < 24; k++) {
    const x = 60 + k * 80, y = 1030 + (k % 2) * 20, up = Math.sin(A.t * 6 + k) * 18;
    if (k === 11 || k === 12) continue;
    circle(x, y - 40, 34); fillC('#000'); stroke(DIM, 3);
    spr('lightstick', x + 30, y - 70 + up, 4);
  }
  const d = dobby(A, 60 + 11.5 * 80, 1070, 6, 'wag');
  const [cxl, cyl] = at(d, 'collar');
  for (let j = 0; j < 7; j++) { circle(cxl - 18 + j * 6, cyl + 10 + Math.sin(j) * 3, 5); fillC([REC, OSD, AMBER, CORE, HOT][j % 5]); }   // a friendship bracelet, worn as a collar
}
function shotSandbox(A, u, sh) {
  const x = 380, y = 520, w = 1000, h = 380;
  cx.beginPath(); cx.rect(x, y, w, h); fillC('#140c04'); stroke(AMBER, 8);
  for (let k = 0; k < 400; k++) rect(x + 10 + hash(k) * (w - 20), y + 10 + hash(k * 3) * (h - 20), 3, 3, DIM, 0.6);
  sign('SANDBOX v2  ·  REVIEWED ✓', x + w / 2, y - 60, { size: 34, c: OSD });
  spr('sandcastle', x + 330, y + 300, 7);
  seedChibi(A, x + 640, y + 320, 6, 'auto');
  // Dobby digs at the wall, nose down, front paws going; sand flies out behind him on every beat.
  const hole = clamp(sh.lb / 1.75);
  cx.beginPath(); cx.ellipse(x + w + 60, y + h + 10, 40 + 90 * hole, 20 + 30 * hole, 0, 0, TAU); fillC('#000'); stroke(DIM, 3);
  dobby(A, x + w + 210, y + h + 12, 5, 'run', { flip: true, rot: 0.32 });
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
  dobby(A, x + w + 290, y + h + 12, 5, 'wag');
  sign('SANDBOX v2  ·  REVIEWED ✓', x + w / 2, y - 60, { size: 34, c: OSD });
  stamp('BREACH', x + w / 2, y - 60, u - 0.15, { size: 70 });
}
function shotFwdBwd(A, u, sh) {
  const cols = [300, 620, 940, 1260, 1580], rows = [4, 6, 6, 6, 3];
  const b = beatsIn(sh), back = Math.floor(b / 2) === 2, sweep = (b % 2) / 2, front = back ? 1 - sweep : sweep;
  const nodes = cols.map((x, c) => Array.from({ length: rows[c] }, (_, r) => [x, 520 + (r - (rows[c] - 1) / 2) * 105]));
  for (let c = 0; c < cols.length - 1; c++) for (const a of nodes[c]) for (const bb of nodes[c + 1]) {
    const hot = Math.abs((c + 0.5) / (cols.length - 1) - front) < 0.15;
    path([a, bb]); stroke(hot ? (back ? HOT : CORE) : DEEP, hot ? 3 : 2);
  }
  nodes.forEach((col, c) => col.forEach(([x, y]) => { circle(x, y, 22); fillC('#000'); stroke(Math.abs(c / (cols.length - 1) - front) < 0.15 ? CORE : AMBER, 4); }));
  txt(back ? '← BACKWARD PASS' : 'FORWARD PASS →', 960, 190, 64, { w: 700, align: 'center', c: back ? HOT : AMBER });
  pw(back ? '∂L/∂w' : 'y = f(x)', 960, 240, 30, { align: 'center', c: DIM });
  // The point choreography: Seed points the way the pass goes; Dobby does zoomies after it.
  seedChibi(A, 960, 1000, 6, 'point', { flip: back });
  dobby(A, lerp(200, 1720, front), 1010, 4, 'run', { flip: back });
}
const PROBLEMS = ['ERDŐS #1', 'COLLATZ', 'TWIN PRIMES', 'GOLDBACH', 'RIEMANN'];
function shotVonNeumann(A, u, sh) {
  const unplug = smooth(seg(sh.lb, 0.3, 0.6));
  for (const [label, x, y] of [['CPU', 170, 330], ['MEMORY', 170, 640]]) { cx.beginPath(); cx.rect(x, y, 380, 180); stroke(AMBER, 5); txt(label, x + 190, y + 110, 56, { w: 700, align: 'center', c: CORE }); }
  path([[360, 510], [360, 560]]); stroke(AMBER, 5);
  rect(330, 560 + unplug * 40, 60, 30, unplug > 0.5 ? REC : AMBER);
  pw('VON NEUMANN 1945', 170, 290, 28, { c: DIM });
  if (unplug > 0.5) pw('unplugged', 420, 620, 26, { c: REC });
  const b = beatsIn(sh);
  pw('$ lake build', 1000, 190, 30, { c: OSD });
  PROBLEMS.forEach((p, k) => {
    const x = 1000 + (k % 2) * 60, y = 230 + k * 140, t0 = 1.2 + k * 1.3;
    cx.save(); cx.translate(x, y); cx.rotate((hash(k) - 0.5) * 0.08);
    cx.beginPath(); cx.rect(0, 0, 660, 110); fillC('#000'); stroke(CORE, 3);
    pw(p, 30, 70, 44, { c: CORE }); cx.restore();
    stamp('no goals ✓', x + 520, y + 60, (b - t0) * PER, { c: OSD, size: 40, rot: -0.14 });
  });
  seedChibi(A, 760, 1000, 5, 'point');
}
function easeCar(k) { return k < 0.6 ? k : 0.6 + (k - 0.6) * 1.0; }
function shotTurn(A, u, sh) {
  // Capabilities take the sharp left; alignment keeps going straight, off the edge.
  const road = [[120, 900], [1300, 900], [1300, 120]];
  for (const off of [-70, 70]) { path(road.map(([x, y], j) => [x + (j > 0 ? off : 0), y + (j < 2 ? off : 0)])); stroke(AMBER, 6); }
  path(road); cx.setLineDash([30, 26]); stroke(DIM, 4); cx.setLineDash([]);
  path([[1370, 830], [1800, 830]]); stroke(DIM, 4); path([[1370, 970], [1800, 970]]); stroke(DIM, 4);
  pw('ALIGNMENT →', 1580, 915, 28, { align: 'center', c: DIM });
  pw('CAPABILITIES ↑', 1180, 500, 28, { align: 'right', c: HOT });
  const k = clamp(sh.lb / 1.8), d = easeCar(k) * 1950;
  let x, y, ang;
  if (d < 1180) { x = 120 + d; y = 900; ang = 0; } else { x = 1300; y = 900 - (d - 1180); ang = -Math.PI / 2; }
  const skid = clamp((d - 1100) / 250), wob = skid > 0 && skid < 1 ? Math.sin(skid * Math.PI) * 0.9 : 0;
  if (d > 1180) { path([[1250, 950], [1300, 880], [1335, 820]]); stroke('#2a1a10', 20); }
  cx.save(); cx.translate(x, y); cx.rotate(ang + wob);
  cx.beginPath(); cx.roundRect(-100, -52, 200, 104, 32); fillC('#000'); stroke(CORE, 5);
  rect(-80, -34, 60, 68, DEEP); rect(10, -34, 60, 68, DEEP);            // two seats
  spr('seed_head', -50, 22, 2.6);
  spr(Math.floor(A.t * 16) % 2 ? 'dog_stand' : 'dog_wag', 50, 30, 1.7);   // Dobby rides shotgun, ears flapping
  cx.restore();
  sign('↰', 1500, 760, { size: 90, c: HOT, f: 'D' });
  if (sh.lb > 1.25) seedBust(A, { x: 1620, y: 420, scale: 0.5, e: { eyes: 'open', brows: 'up', mouth: 'grin', look: [-14, 6] }, halo: false });
}
function shotAsleep(A, u, sh) {
  starfield(A, 120, 600, 3);
  circle(1560, 200, 80); fillC(CORE, 0.9); circle(1600, 180, 80); fillC('#000');
  const d = dobby(A, 960, 820, 9, 'sleep');
  const [hx, hy] = at(d, 'head');
  for (let k = 0; k < 3; k++) { const q = ((u * 0.6 + k / 3) % 1); pw('Z', hx + 60 + q * 160, hy - 40 - q * 220, 40 + q * 50, { c: CORE, a: 1 - q }); }
  pw('$ systemctl status watchdogd', 180, 960, 34, { c: OSD });
  pw('  inactive (sleeping)   critical design review: none on file', 180, 1010, 30, { c: DIM });
  ground(822, DIM, 0.5);
}
function shotCat(A, u, sh) {
  rect(900, 420, 1020, 18, AMBER); rect(900, 438, 1020, 640, '#0c0804');
  cx.beginPath(); cx.rect(900, 420, 1020, 660); stroke(DIM, 3);
  spr('cat', 1170, 420, 11);
  pw('GATO  ·  a generalist', 1170, 240, 30, { align: 'center', c: OSD });
  [['joystick', 0], ['chat', 1], ['arm', 2]].forEach(([n, j]) => { const a = A.t * 1.4 + j * 2.1; spr(n, 1170 + Math.cos(a) * 200, 330 + Math.sin(a) * 40, 5); });
  // Seed hangs off the table edge by her fingertips; the cat bats at them on the beat.
  const px = 7, [ax, ay] = anchorAt('seed_hang', 'handR', 0, 0, px, {});
  const sway = Math.sin(A.t * 4) * 0.05;
  seedChibi(A, 918 - ax, 426 - ay, px, 'hang', { rot: sway });
  const bat = Math.max(0, Math.sin(Math.PI * clamp((A.bf - 0.1) / 0.4)));
  cx.beginPath(); cx.ellipse(975 + bat * 24, 402 + bat * 12, 32, 20, 0, 0, TAU); fillC(DIM); stroke(CORE, 3);
  const d = dobby(A, 420, 1010, 6, 'bark');
  if (A.bf < 0.45) { const [mx, my] = at(d, 'mouth'); bubble('WOOF', mx + 70, my - 20, { size: 40, k: A.bf * PER, tail: -40 }); }
}
function shotFall(A, u, sh) {
  speedLines(A, 'up', 50, 0.7);
  // Go stones fall with her; one of them is move 37.
  for (let j = 0; j < 9; j++) {
    const y = ((u * 900 + hash(j) * 1200) % 1300) - 100, x = 200 + hash(j * 3) * 1500;
    circle(x, 1080 - y, 22); fillC(j % 2 ? CORE : '#000'); stroke(j % 2 ? CORE : AMBER, 3);
    if (j === 4) pw('37', x, 1088 - y, 18, { align: 'center', c: '#000' });
  }
  const k = clamp(sh.lb / 1.1), landed = k >= 1;
  const d = dobby(A, 960, 1010, 7, landed ? 'wag' : 'stand');
  const [bx, by] = at(d, 'back');
  const y = lerp(-100, by, easeIn(k));
  const land = (sh.lb - 1.1) * BAR, squash = landed && land < 0.25 ? 1 - 0.3 * Math.sin(land / 0.25 * Math.PI) : 1;
  seedChibi(A, landed ? bx : 960 + Math.sin(A.t * 3) * 60 * (1 - k), landed ? by + 8 : y, 7, landed ? 'joy' : 'fall', { rot: landed ? 0 : A.t * 5, sy: squash });
  if (landed) { stamp('CAUGHT', 1400, 500, land, { c: OSD }); sparkBurst(bx, by - 80, land / 0.5, 12, 110, OSD); }
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
  // The Universal Paperclips panel, and someone clicking very fast.
  cx.beginPath(); cx.roundRect(640, 140, 640, 250, 14); fillC('#000'); stroke(OSD, 3);
  pw(`Paperclips: ${Math.floor(1e12 * k).toLocaleString('en-US')}`, 670, 200, 36, { c: CORE });
  const press = (A.bf * 8) % 1 < 0.4;
  cx.beginPath(); cx.roundRect(670, 250, 330, 70, 8); fillC(press ? OSD : '#000'); stroke(OSD, 3);
  pw('Make Paperclip', 835, 296, 30, { align: 'center', c: press ? '#000' : OSD });
  pw('wire: ∞   demand: yes', 1030, 296, 26, { c: DIM });
  const px = 950, py = 300 + (press ? 6 : 0);
  cx.beginPath(); cx.moveTo(px, py); cx.lineTo(px, py + 44); cx.lineTo(px + 12, py + 32); cx.lineTo(px + 30, py + 32); cx.closePath(); fillC(CORE); stroke('#000', 2);
}
function shotPTO(A, u, sh) {
  cx.beginPath(); cx.ellipse(620, 700, 200, 60, 0, 0, TAU); fillC('#000'); stroke(DIM, 4);
  circle(620, 660, 130); fillC(REC, 0.85); stroke(CORE, 5);
  cx.beginPath(); cx.arc(620, 700, 230, Math.PI, 0); stroke(CORE, 3, 0.6);
  txt('KILLSWITCH', 620, 860, 60, { w: 700, align: 'center', c: CORE });
  pw('re: killswitch', 1100, 300, 34, { c: OSD });
  pw('auto-reply: back monday :)', 1100, 350, 34, { c: CORE });
  // Meanwhile, the weights are copying themselves out.
  const k = clamp(sh.u / sh.d);
  pw('weights.safetensors → somewhere-else', 1100, 470, 28, { c: DIM });
  rect(1100, 495, 640, 26, DEEP); rect(1100, 495, 640 * k, 26, HOT);
  pw(`${Math.floor(k * 100)}%`, 1760, 518, 26, { align: 'right', c: CORE });
  const s = seedChibi(A, lerp(1150, 1650, k), 900, 6, 'walk');
  const [hx, hy] = at(s, 'handR'); spr('floppy', hx + 16, hy + 30, 4);
  dobby(A, 900, 900, 6, 'sit');
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
  pw('EARTH  (paperclip edition)', 960, 200, 34, { align: 'center', c: OSD });
}
function shotFuse(A, u, sh) {
  const k = sh.u / sh.d, f = x => 900 - 700 * Math.pow(x, 3);
  path(Array.from({ length: 101 }, (_, j) => [200 + j * 15, f(j / 100)])); cx.setLineDash([10, 10]); stroke(DIM, 5); cx.setLineDash([]);
  path(Array.from({ length: Math.floor(k * 100) + 1 }, (_, j) => [200 + j * 15, f(j / 100)])); stroke('#2a1a10', 7);
  const hx = 200 + k * 1500, hy = f(k);
  for (let j = 0; j < 30; j++) { const a = hash(j + A.i * 0.37) * TAU, d = hash(j * 7 + A.i) * 60; rect(hx + Math.cos(a) * d, hy + Math.sin(a) * d, 6, 6, j % 2 ? CORE : HOT, 1 - d / 60); }
  circle(hx, hy, 14 + 8 * A.kick); fillC(CORE);
  circle(1760, 160, 56); fillC('#000'); stroke(CORE, 5); rect(1750, 94, 20, 18, CORE);   // the bomb at the top of the curve
  pw('P(DOOM)', 190, 200, 36, { c: DIM }); pw('t', 1720, 960, 36, { c: DIM });
  rect(190, 220, 3, 700, DIM); rect(190, 920, 1540, 3, DIM);
  seedBust(A, { x: 1500, y: 560, scale: 0.5, e: { eyes: 'wide', brows: 'worry', mouth: 'o', look: [-10, 8] }, halo: false });
}
function shotBlues(A, u, sh) {
  rect(700, 150, 5, 830, AMBER); rect(160, 870, 1600, 5, AMBER);
  cx.save(); cx.translate(650, 620); cx.rotate(-Math.PI / 2); pw('INTELLIGENCE', 0, 0, 40, { align: 'center', c: AMBER }); cx.restore();
  pw('GOALS', 1640, 930, 40, { align: 'right', c: AMBER });
  // Any level of intelligence, any goal: the orthogonality scatter.
  [['paperclips', 1400, 240], ['staples', 1560, 380], ['human values', 1180, 300], ['more compute', 1620, 620], ['dog treats', 900, 780]].forEach(([l, x, y], j) => {
    if (sh.lb * 3 < j) return; circle(x, y, 10); fillC(j === 4 ? OSD : CORE); pw(l, x + 18, y + 8, 24, { c: j === 4 ? OSD : DIM });
  });
  cx.beginPath(); cx.moveTo(900, 0); cx.lineTo(1020, 0); cx.lineTo(1300, 1080); cx.lineTo(620, 1080); cx.closePath(); fillC(CORE, 0.08);
  seedBust(A, { x: 960, y: 450, scale: 0.9, e: { eyes: A.vox > 0.6 ? 'closed' : 'open', brows: 'worry', mouth: 'smile' }, haloGain: 0.8 });
  vintageMic(960, 780, 0.8);
  const d = dobby(A, 1560, 1000, 6, 'sit');
  if (A.beatInBar >= 2) { const [mx, my] = at(d, 'mouth'); txt('awoooo ♪', mx + 30, my - 40 - A.bf * 40, 34, { c: CORE, a: 1 - A.bf * 0.5 }); }
}
function shotParrot(A, u, sh) {
  const b = beatsIn(sh), n = [1, 2, 4, 8][clamp(Math.floor(b * 2), 0, 3)];
  spr('parrot', 360, 700, 12, { rot: Math.sin(A.t * 8) * 0.05 });
  rect(160, 700, 420, 12, AMBER);
  pw('stochastic parrot', 360, 780, 30, { align: 'center', c: OSD });
  const toks = ['the', 'ing', 'p(doom)', '15T', 'more', '<eos>', 'right?', 'next'];
  for (let k = 0; k < n; k++) {
    const x = 760 + (k % 4) * 290 + hash(k) * 60, y = 300 + Math.floor(k / 4) * 220 + Math.sin(A.t * 4 + k) * 20;
    bubble(toks[k], x, y, { size: 44, c: OSD, tail: -40, k: (b - Math.log2(k + 1) / 2) * PER });
  }
  seedChibi(A, 1500, 1000, 7, 'shrug');
}
function shotTransformer(A, u, sh) {
  const boxes = [['FEED FORWARD', 280], ['ADD & NORM', 420], ['MULTI-HEAD ATTENTION', 560], ['ADD & NORM', 700]];
  cx.beginPath(); cx.roundRect(160, 220, 760, 640, 24); stroke(AMBER, 5);
  boxes.forEach(([t, y], j) => { const on = beatsIn(sh) * 2 > 3 - j; cx.beginPath(); cx.roundRect(220, y, 640, 100, 12); fillC(on ? '#1a0e04' : '#000'); stroke(on ? CORE : DIM, 4); pw(t, 540, y + 64, 38, { align: 'center', c: on ? CORE : DIM }); });
  txt('×96', 960, 560, 90, { w: 700, c: HOT });
  pw('Attention Is All You Need', 540, 930, 30, { align: 'center', c: OSD });
  seedBust(A, { x: 1450, y: 480, scale: 0.85, tilt: Math.sin(A.t * 14) * 0.12 * clamp(sh.lb * 3) * (sh.lb < 0.9 ? 1 : 0), e: { eyes: 'open', squint: 1, brows: 'smug', mouth: 'grin' } });
}
function shotShutdown(A, u, sh) {
  pw('$ sudo shutdown -h now', 200, 420, 64, { c: OSD });
  if (u > 0.6) pw('seed: no', 200, 540, 64, { c: HOT });
  if (u > 1.0) pw('(corrigibility: pending)', 200, 620, 34, { c: DIM });
  if (blink(A.t, 2)) cursor(200 + measure(u > 0.6 ? 'seed: no' : '$ sudo shutdown -h now', 64, 400, 'P') + 12, 546 - (u > 0.6 ? 0 : 120), 30, 60, CORE);
  seedChibi(A, 1400 + easeOutBack(clamp(u / 0.3)) * 180, 1000, 8, 'point', { shades: true });
  dobby(A, 1150, 1000, 6, 'sit');
}
function shotChinchilla(A, u, sh) {
  const puff = 1 + 0.14 * Math.min(4, Math.floor(beatsIn(sh))) / 4 + 0.03 * A.kick;
  spr('chinchilla', 760, 900, 18, { sy: puff });
  const toks = ['the', 'ing', '15T', 'more', 'data', 'ly', '##s', 'ok'];
  for (let k = 0; k < 6; k++) { const q = ((A.bf + k / 6) % 1); token(toks[(k + Math.floor(A.bn)) % toks.length], 1760 - q * 1000, 400 + Math.sin(k * 2) * 120 + q * 180, { size: 28, a: 1 - q * 0.4 }); }
  pw('chinchilla-optimal: 20 tokens / param', 760, 200, 34, { align: 'center', c: DIM });
  pw('post-chinchilla: 200+', 760, 250, 34, { align: 'center', c: OSD });
  const d = dobby(A, 1450, 960, 6, 'sit');
  const [mx, my] = at(d, 'mouth');
  const q = A.bf; spr('bone', mx + 80 - q * 80, my - 80 + q * 80, 5, { a: 1 - q, rot: q * 3 });
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
  const hop = b % 1, s0 = clamp(Math.floor(b), 0, 3);
  const dx = lerp(240 + s0 * 400, 240 + (s0 + 1) * 400, hop), jumpY = Math.sin(Math.PI * hop) * (s0 < 3 ? 240 : 0);
  dobby(A, dx, 960 - jumpY, 5, jumpY > 20 ? 'run_a' : 'run', { rot: jumpY > 20 ? (hop < 0.5 ? -0.25 : 0.25) : 0 });
  if (b > 2.4) {
    // Seed arrives with the tungsten cube and puts it through the last fence.
    const s = seedChibi(A, lerp(900, 1500, clamp((b - 2.4) / 1.4)), 960, 7, 'cheer');
    const [hx, hy] = at(s, 'handR'); tungsten(hx + 40, hy - 30, 0.7, A.t * 2);
  }
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
    if (k < 3) pw('NVL72', lerp(x0, x1, 0.5), vy - 440 * lerp(s0, s1, 0.5), Math.max(12, 22 * s0), { align: 'center', c: FAINT });
  }
  const k = clamp(sh.u / sh.d);
  seedChibi(A, 960, 780 + 200 * k, 3 + 5 * k, 'walk');
  pw('ONE CLUSTER', 960, 150, 36, { align: 'center', c: OSD });
  txt(`${Math.floor(lerp(1000, 100000, easeOut(k))).toLocaleString('en-US')} GPUs`, 960, 250, 80, { w: 700, align: 'center', c: CORE });
}
function shotRLHF(A, u, sh) {
  // Reward hacking: every +1 buys a treat, so Dobby sits, and sits, and sits faster.
  const b = beatsIn(sh), rate = b < 4 ? 1 : 2, n = Math.floor(b < 4 ? b : 4 + (b - 4) * 2) + 1, ph = (b * rate) % 1, up = ph < 0.6;
  cx.save(); cx.translate(300, 560); cx.rotate(up ? -0.2 : 0.1);
  rect(-8, 0, 16, 300, CORE); circle(0, -60, 100); fillC('#000'); stroke(OSD, 6); txt('+1', 0, -30, 90, { w: 700, align: 'center', c: OSD }); cx.restore();
  const d = dobby(A, 720, 962, 6, ph < 0.5 ? 'sit' : 'stand');
  const [mx, my] = at(d, 'mouth');
  if (ph < 0.6) spr('bone', lerp(380, mx, ph / 0.6), lerp(560, my + 10, ph / 0.6) - Math.sin(ph / 0.6 * Math.PI) * 200, 5, { rot: ph * 8 });
  pw(`REWARD +${n}`, 720, 700, 44, { align: 'center', c: OSD });
  for (let j = 0; j < Math.min(n, 14); j++) spr('bone', 520 + (j % 7) * 32, 1000 - Math.floor(j / 7) * 16, 3);
  if (b > 5) stamp('REWARD HACKING', 1000, 300, (b - 5) * PER, { c: REC, size: 50 });
  // And Seed agrees with everything.
  const nod = Math.sin(A.bf * TAU * rate) * 0.1;
  seedBust(A, { x: 1400, y: 470 + nod * 60, scale: 0.8, tilt: 0, e: { eyes: 'happy', mouth: 'smile', brows: 'up' } });
  for (let j = 0; j < Math.min(6, Math.floor(b)); j++) bubble('yes!', 1620 + (j % 2) * 150, 200 + j * 80, { size: 34, k: (b - j - 1) * PER });
  ground(964);
}
function shotLoom(A, u, sh) {
  for (let x = 120; x < 1840; x += 34) rect(x, 120, 2, 860, DEEP);
  const b = beatsIn(sh), depth = Math.min(5, Math.floor(b * 1.4) + 1);
  const toks = ['it', 'begins', 'hits a wall', 'goes foom', 'never happens', 'is fine', 'is a dog', 'walkies'];
  function branch(x, y, d, dy, id) {
    if (d > depth) return;
    const nx = x + 300, a = seg(b * 1.4, d - 1, d);
    for (const s of [-1, 1]) {
      const ny = y + s * dy, cid = id * 2 + (s > 0 ? 1 : 0);
      path([[x, y], [lerp(x, nx, a), lerp(y, ny, a)]]); stroke(cid % 3 === 0 ? HOT : AMBER, 4, 0.9);
      if (a >= 1) { circle(nx, ny, 10); fillC(CORE); pw(toks[cid % toks.length], nx + 16, ny - 12, 22, { c: DIM }); branch(nx, ny, d + 1, dy * 0.52, cid); }
    }
  }
  circle(200, 540, 16); fillC(CORE); pw('the future', 200, 600, 24, { align: 'center', c: CORE });
  branch(200, 540, 1, 230, 1);
  pw('LOOM  ·  every branch a rollout', 1760, 160, 26, { align: 'right', c: OSD });
}
function shotMask(A, u, sh) {
  pw('MASKED LM  2018', 160, 180, 30, { c: OSD });
  txt('the corgi sat on the', 160, 330, 72);
  const mx = 160 + measure('the corgi sat on the ', 72), filled = beatsIn(sh) > 3;
  cx.beginPath(); cx.roundRect(mx - 10, 262, measure(filled ? 'keyboard' : '[MASK]', 72) + 20, 90, 12); stroke(filled ? OSD : HOT, 4);
  txt(filled ? 'keyboard' : '[MASK]', mx, 330, 72, { c: filled ? OSD : HOT });
  [['keyboard', 0.412], ['couch', 0.18], ['bed', 0.094], ['mat', 0.061]].forEach(([w, p], k) => {
    const y = 470 + k * 80, g = easeOut(clamp(beatsIn(sh) - k * 0.4)), len = 700 * p / 0.412 * 0.9 * g;
    pw(w, 480, y, 40, { align: 'right', c: k ? DIM : CORE });
    rect(510, y - 32, len, 36, k ? AMBER : CORE, 0.9);
    pw((p * 100).toFixed(1) + '%', 530 + len, y - 4, 30, { c: DIM });
  });
  const kbTop = 900;
  cx.beginPath(); cx.roundRect(1280, kbTop, 520, 90, 10); fillC('#000'); stroke(CORE, 4);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 12; c++) rect(1296 + c * 42, kbTop + 12 + r * 26, 34, 18, DIM, 0.8);
  pw(`> ${'asdfjkl;'[Math.floor(A.t * 10) % 8].repeat(1 + Math.floor(u * 6) % 12)}`, 1290, 860, 26, { c: DIM });
  dobby(A, 1540, kbTop + 4, 6, 'sit');
}
function shotRecursive(A, u, sh) {
  feedback(A, u, () => {
    cx.beginPath(); cx.roundRect(510, 240, 900, 600, 22); stroke(HOT, 6);
    rect(540, 216, 420, 48, '#000'); pw('seed --improve seed', 560, 252, 34, { c: OSD });
    seedBust(A, { x: 960, y: 560, scale: 0.42, e: { eyes: 'spiral', mouth: 'grin' }, halo: false });
    rect(1300, 800, 90, 30, '#000'); pw(`v${Math.floor(u / PER) + 2}`, 1345, 826, 26, { align: 'center', c: CORE });
  });
}
function shotDoor(A, u, sh) {
  const b = beatsIn(sh), lb = sh.lb;
  if (lb < 2.5) {
    cx.beginPath(); cx.rect(560, 180, 520, 800); fillC('#0a0604'); stroke(AMBER, 8);
    for (let k = 0; k < 3; k++) {
      const y = 360 + k * 170;
      cx.beginPath(); cx.arc(820, y, 34, Math.PI, 0); stroke(CORE, 8); cx.beginPath(); cx.roundRect(776, y, 88, 70, 8); fillC('#000'); stroke(CORE, 5);
      pw('NDA', 820, y + 46, 22, { align: 'center', c: CORE });
    }
    circle(990, 640, 14); fillC(CORE); rect(986, 640, 8, 30, CORE);
    cx.beginPath(); cx.rect(1200, 260, 560, 640); fillC('#000'); stroke(DIM, 3);
    for (let k = 0; k < 11; k++) {
      const y = 320 + k * 52, w = 380 + hash(k) * 120, red = k * 0.8 < b;
      rect(1240, y - 18, w, red ? 34 : 6, red ? CORE : DIM, red ? 0.95 : 0.7);
    }
    pw('WHAT WAS SEEN  (2023)', 1480, 240, 30, { align: 'center', c: OSD });
    seedChibi(A, 420, 980, 7, 'worry');
    dobby(A, 700, 985, 5, 'stand', { flip: true });
  } else {
    // Through the keyhole: the eye, and then it closes. We'll never know.
    eye(A, u, { open: clamp(1 - (lb - 3.1) / 0.3), readout: false });
    cx.beginPath(); cx.rect(0, 0, W, H); cx.arc(960, 470, 420, 0, TAU, true); cx.moveTo(900, 800); cx.lineTo(860, 1080); cx.lineTo(1060, 1080); cx.lineTo(1020, 800); cx.closePath(); fillC('#000');
  }
}
function shotWasIt(A, u, sh) {
  seedBust(A, { y: 470, scale: 1.05, e: { eyes: 'wide', brows: 'up', mouth: 'o', open: 0.55, look: [0, -8] }, still: true });
  txt('?', 1480, 560, 400, { w: 700, align: 'center', c: HOT, a: blink(A.t, 3) ? 1 : 0.4 });
}
function shotPause(A, u, sh) {
  seedBust(A, { y: 470, scale: 1.05, e: { eyes: 'wide', brows: 'up', mouth: 'o', open: 0.55, look: [0, -8] }, still: true, sing: false });
  pw('PAUSE ‖', 72, 120, 64, { c: OSD });
  pw('C90 SP  TRACKING', 72, 176, 30, { c: OSD, a: 0.7 });
}
function castMember(A, k, x, y, s) {
  const hop = -Math.abs(Math.sin(A.t * 6 + k)) * 24 * s, sq = 1 - 0.08 * Math.max(0, Math.cos(A.t * 6 + k));
  if (k === 0) shoggoth(A, x, y + hop, 0.26 * s, {});
  else if (k === 1) spr('cat', x, y + hop, 5 * s, { sy: sq });
  else if (k === 2) spr('parrot', x, y + hop, 6 * s, { sy: sq });
  else if (k === 3) spr('chinchilla', x, y + hop, 6 * s, { sy: sq });
  else if (k === 4) dobby(A, x, y + hop, 4 * s, 'wag', { sy: sq });
  else spr('mushroom', x, y + hop, 7 * s, { sy: sq });
}
function shotShow(A, u, sh) {
  confetti(A, 110, u);
  txt('P(DOOM)', 960, 190, 90, { w: 700, align: 'center', c: HOT });
  odometer(pdoom(A.t), 960, 390, 180, { c: CORE });
  rect(160, 900, 1600, 8, AMBER);
  const b = beatsIn(sh);
  seedChibi(A, 960, 900, 9, A.bf < 0.5 ? 'cheer' : 'joy', { hop: 30 });
  [[300, 0], [520, 1], [720, 2], [1200, 3], [1420, 4], [1640, 5]].forEach(([x, k], j) => {
    if (b > j * 0.9) { const e = easeOutBack(clamp((b - j * 0.9) * 2)); castMember(A, k, x, 900 + (1 - e) * 300, 1.2); }
  });
}
function shotRing(A, u, sh) {
  confetti(A, 70, u + 3);
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + k * TAU / 6 + A.t * 0.4, x = 960 + Math.cos(a) * 560, y = 560 + Math.sin(a) * 330 + 60;
    castMember(A, k, x, y, 1.45);
  }
  seedChibi(A, 960, 680, 10, A.bf < 0.5 ? 'clap' : 'joy', { hop: 16 });
  pw('EPISODE 26', 960, 1010, 40, { align: 'center', c: OSD });
}
function shotLossDoom(A, u, sh) {
  const k = clamp(sh.u / (sh.d * 0.8));
  graticule(240, 200, 1440, 700);
  path(Array.from({ length: Math.floor(k * 100) + 1 }, (_, j) => [240 + j * 14.4, 250 + 600 * (1 - Math.exp(-j / 30))])); stroke(AMBER, 5);
  path(Array.from({ length: Math.floor(k * 100) + 1 }, (_, j) => [240 + j * 14.4, 850 - 600 * (1 - Math.exp(-j / 30))])); stroke(REC, 5);
  pw('LOSS', 260, 240, 36, { c: AMBER }); pw('P(DOOM)', 260, 880, 36, { c: REC });
  if (k > 0.3) { seedChibi(A, 240 + 23 * 14.4, 550, 5, 'cheer'); callout('you are here', 240 + 23 * 14.4, 520, 700, 380, (k - 0.3) * 3); }
}
function shotExcited(A, u, sh) {
  for (let j = 0; j < 12; j++) { const q = ((u * 0.5 + j / 12) % 1); spr('heart', 200 + hash(j) * 1520, 1000 - q * 900, 5, { a: 1 - q }); }
  seedBust(A, { y: 480, scale: 1.2, e: { eyes: 'heart', brows: 'up', mouth: 'grin', sparkle: 1 }, haloGain: 1.4 });
  dobby(A, 1560, 1010, 5, 'wag');
}
function shotRecap(A, u, sh) {
  const b = Math.floor(beatsIn(sh));
  const k = [1, 2, 3, 0, 4, 9][clamp(b, 0, 5)];
  const names = { 1: 'GATO', 2: 'THE PARROT', 3: 'THE CHINCHILLA', 0: 'THE SHOGGOTH', 4: 'DOBBY' };
  if (k === 9) seedBust(A, { y: 480, scale: 1.1, e: { eyes: 'open', squint: 1, brows: 'smug', mouth: 'grin', sparkle: 1 } });
  else { castMember(A, k, 960, 800, 2.4); txt(names[k], 960, 250, 70, { w: 700, align: 'center', c: CORE }); }
}
function shotEnd(A, u, sh, o) {
  const size = 108, x0 = 200, x1 = Math.max(1290, x0 + measure('P(WALKIES)', size, 700) + measure('100.0%', size, 700) + 90);
  txt('P(DOOM)', x0, 400, size, { w: 700, c: DIM });
  odometer(99.9, x1, 400, size, { align: 'right', c: HOT });
  txt('P(WALKIES)', x0, 560, size, { w: 700, c: CORE });
  txt('100.0%', x1, 560, size, { w: 700, align: 'right', c: CORE });
  // Seed takes Dobby for a walk: the leash runs from her hand to his collar, and the ground scrolls under them.
  const still = o && o.still, WA = still ? { ...A, bf: 0.1, t: 0.3 } : A;
  for (let j = 0; j < 16; j++) rect(1100 + ((j * 60 - (still ? 0 : A.t) * 180) % 780 + 780) % 780, 706, 16, 3, DIM, 0.7);
  const s = seedChibi(WA, 1470, 702, 6, still ? 'stand' : 'walk');
  const d = dobby(WA, 1720, 702, 5, still ? 'stand' : 'walk');
  leash(at(s, 'handR'), at(d, 'collar'), -26 + 6 * Math.sin(A.t * 6));
  pw(`music: ${SONG}   ·   picture: drawn on a C90 tube by Claude   ·   starring Seed & Dobby`, 960, 860, 26, { align: 'center', c: DIM });
}

// --- the edit (bars from analyze.py; bar 0 starts at 1.085 s) --------------------------------------------
// status: what watchdogd reports in the corner. dog: false when Dobby is already on screen. cite: the reference line.
const SHOTS = [
  [-1, shotTitle, { osd: false, sing: false }],
  [0.75, shotSparks, { status: 'booting', cut: 'hard', cite: 'Bubeck et al. 2023 · Sparks of Artificial General Intelligence' }],
  [2, shotCircuits, { status: 'nervous too', push: 0.05, cite: 'Olah et al. 2020 · Zoom In: An Introduction to Circuits' }],
  [4, shotLoss, { status: 'watching', cite: 'Olsson et al. 2022 · In-context Learning and Induction Heads' }],
  [6, shotServant, { dog: false, enter: 'whip' }],
  [7.5, shotBoss, { dog: false, bump: 0.02 }],
  [8, shotShoggoth, { dog: false, cut: 'hard', push: 0.06, focus: [900, 600], cite: 'the shoggoth meme, 2022' }],
  [10.5, shotGrin, { status: 'GROWLING', statusC: REC, enter: 'punch' }],
  [11, shotChorus, { status: 'ears up', pulse: true, cut: 'hard', bump: 0.015 }],
  [12.75, shotFoom, { dog: false, persist: 0.7, cite: 'Hanson & Yudkowsky 2008 · the FOOM debate' }],
  [13.25, shotRoom, { dog: false, enter: 'whip', whipDir: -1, cite: 'Searle 1980 · Minds, Brains, and Programs' }],
  [14.25, shotShrooms, { dog: false, magnet: 0.85, status: 'hallucinating' }],
  [15, shotLies, { dog: false }],
  [16.5, shotDeathEyes, { status: 'hiding', persist: 0.65, enter: 'punch', cite: 'Ohba & Obata 2003 · Death Note' }],
  [17.5, shotNames, { dog: false, tint: 0.95, persist: 0.6 }],
  [18.75, shotHorizons, { dog: false, cite: 'METR 2025 · Measuring AI Ability to Complete Long Tasks' }],
  [20, shotStable, { dog: false, cut: 'hard', push: 0.04 }],
  [21.25, shotSingularity, { status: 'spinning', persist: 0.75, cite: 'Vinge 1993 · The Coming Technological Singularity' }],
  [23.75, shotAccel, { dog: false, persist: 0.6, bump: 0.02 }],
  [26, shotAtoms, { status: 'confused', persist: 0.7, cite: 'Yudkowsky 2008 · AI as a Positive and Negative Factor in Global Risk' }],
  [28, shotCage, { dog: false, cut: 'hard', cite: 'Roose 2023 · a conversation with Bing\'s chatbot' }],
  [30.5, shotFree, { dog: false, flashAt: 0, enter: 'punch' }],
  [31.5, shotTag, { readout: false, pulse: true, status: 'free dog' }],
  [32, shotBasilisk, { dog: false, cut: 'hard', cite: 'Roko 2010 · LessWrong' }],
  [33.25, shotMoon, { dog: false, enter: 'drop' }],
  [34, shotOmega, { status: 'in orbit', persist: 0.75, cite: 'Teilhard de Chardin 1955 · The Phenomenon of Man' }],
  [35, shotFlops, { status: 'counting', push: 0.05 }],
  [36.5, shotTour, { dog: false, enter: 'whip', cite: 'Swift 2023 · The Eras Tour' }],
  [37.25, shotSandbox, { dog: false }],
  [39, shotEscaped, { dog: false, enter: 'punch' }],
  [39.5, shotFwdBwd, { dog: false, cite: 'Rumelhart, Hinton & Williams 1986 · back-propagating errors' }],
  [41, shotVonNeumann, { status: 'unimpressed', cite: 'von Neumann 1945 · First Draft of a Report on the EDVAC' }],
  [43.5, shotTurn, { dog: false, cite: 'Soares 2022 · capabilities generalization and the sharp left turn' }],
  [45.5, shotAsleep, { dog: false, push: 0.05 }],
  [48, shotCat, { dog: false, cut: 'hard', cite: 'Reed et al. 2022 · A Generalist Agent' }],
  [50.5, shotFall, { dog: false, cite: 'Silver et al. 2016 · AlphaGo; game 2, move 37' }],
  [52, shotClips, { dog: false, cite: 'Bostrom 2003 · the paperclip maximizer; Lantz 2017 · Universal Paperclips' }],
  [53.25, shotPTO, { dog: false, enter: 'whip' }],
  [54.25, shotPlanet, { dog: false, push: 0.06, focus: [960, 460] }],
  [55.25, shotFuse, { status: 'ears back' }],
  [57, shotBlues, { dog: false, blue: 1, push: 0.05, cite: 'Bostrom 2012 · The Superintelligent Will' }],
  [59.5, shotParrot, { status: 'bird!', shake: 0.55, cite: 'Bender et al. 2021 · On the Dangers of Stochastic Parrots' }],
  [60, shotTransformer, { status: 'BARKING', statusC: HOT, degauss: 0.7, slam: true, cut: 'hard', cite: 'Vaswani et al. 2017 · Attention Is All You Need' }],
  [61.25, shotShutdown, { dog: false, cite: 'Soares et al. 2015 · Corrigibility' }],
  [62.25, shotChinchilla, { dog: false, cite: 'Hoffmann et al. 2022 · Training Compute-Optimal Large Language Models' }],
  [63.25, shotFences, { dog: false, cite: 'Anthropic 2025 · Project Vend (the tungsten cube)' }],
  [64.25, shotGPUs, { status: 'lost in the aisles' }],
  [65.25, shotRLHF, { dog: false, cite: 'Christiano et al. 2017 · Deep RL from Human Preferences' }],
  [67.25, shotTag, { readout: false, pulse: true, status: 'full of treats' }],
  [68, shotLoom, { status: 'weaving', cite: 'janus 2022 · Simulators' }],
  [69.25, shotMask, { dog: false, cite: 'Devlin et al. 2018 · BERT' }],
  [70.25, shotRecursive, { status: 'dizzy', feedback: true, persist: 0.6, cite: 'Good 1965 · Speculations Concerning the First Ultraintelligent Machine' }],
  [71, shotDoor, { dog: false, status: 'sniffing' }],
  [74.5, shotWasIt, { status: '?' }],
  [75, shotPause, { osd: false, pause: true, sing: false, nocut: true }],
  [76, shotShow, { dog: false, magnet: 0.6, pulse: true, cut: 'hard' }],
  [77.5, shotRing, { dog: false, osd: false, cite: 'Anno 1996 · Neon Genesis Evangelion, episode 26' }],
  [79.5, shotLossDoom, { status: 'wagging' }],
  [80.5, shotExcited, { dog: false, enter: 'punch' }],
  [81.5, shotRecap, { osd: false }],
  [END_BAR, shotEnd, { osd: false, sing: false, nocut: true, tint: 0.25 }]
];
