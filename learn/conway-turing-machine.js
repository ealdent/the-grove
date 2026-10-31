import {
  LifeTuringMachine, compile, lifeStep, patternBoard, PATTERNS, FAMILIES, DIRECTIONS, DIRECTION_NAMES,
  SYMBOLS, SCAN, GO, READ, HOME, PRINT, BACK, COMMIT, EDGE, ROW_END, LEFT_END, RIGHT_END,
  B1, M0, M1, isMark, isPair, oldValue, nextValue,
  EV_MARK, EV_READ, EV_PRINT, EV_ALL_DONE, EV_GENERATION,
  stepsPerCell, stepsPerGeneration
} from './conway-turing-engine.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
if (CAPTURE) document.documentElement.classList.add('capture');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SIZES = [5, 6, 7, 8, 10, 12, 14, 16];
const A = SYMBOLS.length;
const fmt = x => Math.round(x).toLocaleString('en-US');
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const plural = (k, one, many = one + 's') => `${fmt(k)} ${k === 1 ? one : many}`;
const MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace";
const SERIF = "'Old Standard TT', Georgia, serif";
const FRAK = "'UnifrakturMaguntia', 'Old English Text MT', serif";
const COLOR = {
  night: '#111a2e', plate: '#1a2643', text: '#ece5d6', text2: '#c2bdb1', text3: '#959399',
  ink: '#2a1d10', paper: '#efe4c7', red: '#b8321f', redBright: '#ec7461', lamp: '#a6ebff'
};
const lamp = a => `rgba(166, 235, 255, ${a})`;
const ivory = a => `rgba(236, 229, 214, ${a})`;

const ui = {
  n: SIZES.includes(+params.get('n')) ? +params.get('n') : 10,
  pattern: PATTERNS[params.get('pattern')] ? params.get('pattern') : 'glider',
  speed: clamp(+params.get('speed') || 20, 1, 1e6),
  playing: false,
  acc: 0,
  machine: null,
  seed: null,
  visHead: 1,
  tapeCenter: 1,
  edgeHeat: new Float32Array(49),
  nodeHeat: new Float32Array(7),
  exposure: 1.4,
  pulses: [],
  flashes: [],
  fold: null,
  inView: true,
  dirty: true,
  fontsReady: false
};

/* ------------------------------------------------------------------ canvas helpers */

function sizeCanvas(cv) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.max(1, cv.clientWidth), h = Math.max(1, cv.clientHeight);
  const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
  if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h, dpr };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function offscreen(w, h, dpr) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w * dpr));
  cv.height = Math.max(1, Math.ceil(h * dpr));
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  return { cv, g };
}

function woodTexture(w, h, dpr) {
  const { cv, g } = offscreen(w, h, dpr);
  const base = g.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, '#e9c681');
  base.addColorStop(.55, '#ddb46b');
  base.addColorStop(1, '#cd9d53');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // Straight, fine grain, the way a good kaya board is cut.
  const lines = Math.round(w * 0.85);
  for (let i = 0; i < lines; i++) {
    const x = rnd() * w, alpha = 0.02 + rnd() * 0.06, light = rnd() < 0.18;
    g.strokeStyle = light ? `rgba(255, 238, 196, ${alpha * 1.4})` : `rgba(122, 78, 28, ${alpha})`;
    g.lineWidth = 0.35 + rnd() * 1.3;
    const drift = (rnd() - 0.5) * 7, wave = rnd() * 1.4, phase = rnd() * 6.28;
    g.beginPath();
    for (let y = -4; y <= h + 6; y += 6) {
      const xx = x + drift * (y / h) + Math.sin(y * 0.018 + phase) * wave;
      if (y === -4) g.moveTo(xx, y); else g.lineTo(xx, y);
    }
    g.stroke();
  }
  const glow = g.createRadialGradient(w * .42, h * .36, Math.min(w, h) * .1, w * .5, h * .5, Math.max(w, h) * .78);
  glow.addColorStop(0, 'rgba(255, 244, 214, .16)');
  glow.addColorStop(1, 'rgba(96, 58, 18, .2)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  return cv;
}

function stoneSprite(kind, r, dpr) {
  const pad = r * 0.45, size = 2 * (r + pad);
  const { cv, g } = offscreen(size, size, dpr);
  const c = size / 2;
  if (kind === 'ghost') {
    g.fillStyle = 'rgba(42, 29, 16, .55)';
    g.beginPath(); g.arc(c, c, r * 0.94, 0, Math.PI * 2); g.fill();
    return { cv, size };
  }
  const shadow = g.createRadialGradient(c + r * .12, c + r * .2, r * .55, c + r * .12, c + r * .2, r * 1.22);
  shadow.addColorStop(0, 'rgba(40, 22, 6, .5)');
  shadow.addColorStop(1, 'rgba(40, 22, 6, 0)');
  g.fillStyle = shadow;
  g.fillRect(0, 0, size, size);
  const body = g.createRadialGradient(c - r * .36, c - r * .42, r * .04, c, c, r);
  if (kind === 'black') {
    body.addColorStop(0, '#80848d');
    body.addColorStop(.2, '#3a3d44');
    body.addColorStop(.72, '#18191d');
    body.addColorStop(1, '#0b0c0e');
  } else {
    body.addColorStop(0, '#ffffff');
    body.addColorStop(.5, '#f2eee5');
    body.addColorStop(.86, '#d8d0bf');
    body.addColorStop(1, '#b9ae99');
  }
  g.fillStyle = body;
  g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.fill();
  if (kind === 'white') { // faint clamshell growth lines
    g.save(); g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.clip();
    g.strokeStyle = 'rgba(150, 132, 104, .16)'; g.lineWidth = Math.max(.4, r * .035);
    for (let k = 1; k <= 5; k++) { g.beginPath(); g.arc(c - r * 1.6, c + r * .2, r * (1.1 + k * .32), -0.75, 0.75); g.stroke(); }
    g.restore();
  }
  return { cv, size };
}

function glowSprite() {
  const { cv, g } = offscreen(96, 96, 1);
  const grd = g.createRadialGradient(48, 48, 0, 48, 48, 48);
  grd.addColorStop(0, 'rgba(235, 252, 255, 1)');
  grd.addColorStop(.18, 'rgba(166, 235, 255, .75)');
  grd.addColorStop(.5, 'rgba(110, 200, 255, .22)');
  grd.addColorStop(1, 'rgba(110, 200, 255, 0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 96, 96);
  return cv;
}
const GLOW = glowSprite();

/* ------------------------------------------------------------------ boards */

class BoardView {
  constructor(canvas) { this.cv = canvas; this.key = ''; }

  begin() {
    const { ctx, w, h, dpr } = sizeCanvas(this.cv);
    const n = ui.n;
    const key = `${w}x${h}@${dpr}:${n}:${ui.fontsReady}`;
    if (key !== this.key) { this.key = key; this.build(w, h, dpr, n); }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    ctx.drawImage(this.base, 0, 0);
    ctx.restore();
    return ctx;
  }

  x(c) { return this.ox + (c + 0.5) * this.u; }
  y(r) { return this.oy + (r + 0.5) * this.u; }

  build(w, h, dpr, n) {
    // Columns: X, n cells, X on the wood, then the # column hanging off the right edge.
    const u = this.u = Math.min(w / (n + 3.7), h / (n + 2.8));
    this.ox = (w - (n + 3) * u) / 2;
    this.oy = (h - (n + 2) * u) / 2 - u * 0.06;
    this.n = n;
    const cv = document.createElement('canvas');
    cv.width = this.cv.width; cv.height = this.cv.height;
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    this.base = cv;
    const bx = this.ox, by = this.oy, side = (n + 2) * u, rad = Math.max(3, u * 0.16);
    g.save();
    g.shadowColor = 'rgba(0, 0, 0, .55)'; g.shadowBlur = u * 1.1; g.shadowOffsetY = u * 0.4;
    g.fillStyle = '#7a5629';
    roundRect(g, bx, by + u * 0.16, side, side, rad); g.fill();
    g.restore();
    g.fillStyle = '#9d7036';
    roundRect(g, bx, by + u * 0.16, side, side, rad); g.fill();
    g.save();
    roundRect(g, bx, by, side, side, rad); g.clip();
    g.drawImage(woodTexture(side, side, dpr), bx, by, side, side);
    g.restore();
    g.strokeStyle = 'rgba(255, 240, 205, .35)'; g.lineWidth = 1;
    roundRect(g, bx + .5, by + .5, side - 1, side - 1, rad); g.stroke();

    const snap = v => (Math.round(v * dpr) + 0.5) / dpr;
    g.strokeStyle = 'rgba(38, 24, 10, .8)';
    g.lineWidth = Math.max(1 / dpr, u * 0.04);
    g.beginPath();
    for (let k = 1; k <= n; k++) {
      g.moveTo(snap(this.x(1)), snap(this.y(k))); g.lineTo(snap(this.x(n)), snap(this.y(k)));
      g.moveTo(snap(this.x(k)), snap(this.y(1))); g.lineTo(snap(this.x(k)), snap(this.y(n)));
    }
    g.stroke();

    // The always-dead frame: a small x where each X square sits.
    g.strokeStyle = 'rgba(70, 42, 16, .34)';
    g.lineWidth = Math.max(1 / dpr, u * 0.035);
    const s = u * 0.09;
    g.beginPath();
    for (let r = 0; r <= n + 1; r++) for (let c = 0; c <= n + 1; c++) {
      if (r > 0 && r <= n && c > 0 && c <= n) continue;
      const x = this.x(c), y = this.y(r);
      g.moveTo(x - s, y - s); g.lineTo(x + s, y + s);
      g.moveTo(x + s, y - s); g.lineTo(x - s, y + s);
    }
    g.stroke();

    g.fillStyle = ivory(.4);
    g.font = `500 ${Math.max(9, Math.round(u * 0.44))}px ${MONO}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let r = 0; r <= n + 1; r++) g.fillText('#', this.x(n + 2), this.y(r) + u * 0.03);

    const r = u * 0.46;
    this.black = stoneSprite('black', r, dpr);
    this.white = stoneSprite('white', r, dpr);
    this.ghost = stoneSprite('ghost', r, dpr);
  }

  stone(ctx, sprite, i) {
    const n = this.n, x = this.x(i % n + 1), y = this.y(Math.floor(i / n) + 1);
    ctx.drawImage(sprite.cv, x - sprite.size / 2, y - sprite.size / 2, sprite.size, sprite.size);
  }

  cellAt(px, py) {
    const c = Math.round((px - this.ox) / this.u - 0.5), r = Math.round((py - this.oy) / this.u - 0.5);
    return r >= 1 && r <= this.n && c >= 1 && c <= this.n ? (r - 1) * this.n + (c - 1) : -1;
  }
}

const views = { now: new BoardView($('cv-now')), next: new BoardView($('cv-next')) };

function headPoint(view, m) {
  const L = m.length, v = ui.visHead;
  let p0 = Math.floor(v), p1 = Math.ceil(v);
  const t = v - p0;
  const ok = p => p >= 1 && p <= L - 2;
  if (!ok(p0) && !ok(p1)) return null;
  if (!ok(p0)) p0 = p1;
  if (!ok(p1)) p1 = p0;
  const a = ui.fold[p0], b = ui.fold[p1];
  if (a.r === b.r && Math.abs(a.c - b.c) <= 1) {
    return { x: view.x(a.c + (b.c - a.c) * t), y: view.y(a.r) };
  }
  const near = t < 0.5 ? a : b;
  return { x: view.x(near.c), y: view.y(near.r) };
}

function fastMode() { return ui.speed > 400 && (ui.playing || CAPTURE); }

function drawNow() {
  const view = views.now, ctx = view.begin(), m = ui.machine, n = ui.n, u = view.u;
  drawTrails(ctx, view, m);
  // Earlier generations fade like old shadows: the glider leaves a trail.
  const past = m.past, ghosts = Math.min(6, past.length);
  for (let k = ghosts; k >= 1; k--) {
    const b = past[past.length - k].board;
    ctx.globalAlpha = 0.22 * (1 - (k - 1) / 6);
    for (let i = 0; i < n * n; i++) if (b[i]) view.stone(ctx, view.ghost, i);
  }
  ctx.globalAlpha = 1;
  const tape = m.tape, pos = m.cellPos;
  for (let i = 0; i < n * n; i++) if (oldValue(tape[pos[i]]) === 1) view.stone(ctx, view.black, i);

  const mark = m.markPosition();
  if (mark >= 0) {
    const { r, c } = ui.fold[mark], x = view.x(c), y = view.y(r);
    ctx.save();
    if (!fastMode()) {
      ctx.strokeStyle = 'rgba(184, 50, 31, .6)';
      ctx.lineWidth = Math.max(1, u * 0.045);
      ctx.setLineDash([u * 0.14, u * 0.12]);
      roundRect(ctx, x - 1.5 * u, y - 1.5 * u, 3 * u, 3 * u, u * 0.22); ctx.stroke();
      ctx.setLineDash([]);
      const q = m.program.states[m.state];
      if (q.j >= 0) {
        const nb = ui.fold[mark + m.program.offsets[q.j]], nx = view.x(nb.c), ny = view.y(nb.r);
        ctx.strokeStyle = COLOR.red; ctx.lineWidth = Math.max(1.2, u * 0.06);
        ctx.beginPath(); ctx.arc(nx, ny, u * 0.3, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.strokeStyle = COLOR.red; ctx.lineWidth = Math.max(1.6, u * 0.1);
    ctx.beginPath(); ctx.arc(x, y, u * 0.58, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  drawHead(ctx, view, m, true);
}

function drawNext() {
  const view = views.next, ctx = view.begin(), m = ui.machine, n = ui.n, u = view.u;
  const tape = m.tape, pos = m.cellPos;
  ctx.fillStyle = 'rgba(42, 29, 16, .62)';
  for (let i = 0; i < n * n; i++) {
    const v = nextValue(tape[pos[i]]);
    if (v === 1) view.stone(ctx, view.white, i);
    else if (v === 0) {
      ctx.beginPath(); ctx.arc(view.x(i % n + 1), view.y(Math.floor(i / n) + 1), Math.max(1.8, u * 0.1), 0, Math.PI * 2); ctx.fill();
    }
  }
  const mark = m.markPosition();
  if (mark >= 0) {
    const { r, c } = ui.fold[mark];
    ctx.strokeStyle = COLOR.red; ctx.lineWidth = Math.max(1.4, u * 0.08);
    ctx.setLineDash([u * 0.16, u * 0.1]);
    ctx.beginPath(); ctx.arc(view.x(c), view.y(r), u * 0.56, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const f of ui.flashes) {
    const { r, c } = ui.fold[f.p], k = f.t / 0.5;
    ctx.strokeStyle = lamp(0.9 * (1 - k)); ctx.lineWidth = Math.max(1.5, u * 0.08);
    ctx.beginPath(); ctx.arc(view.x(c), view.y(r), u * (0.5 + 0.5 * k), 0, Math.PI * 2); ctx.stroke();
  }
  drawHead(ctx, view, m, false);
}

// Where the head has been, painted onto the wood like a long exposure.
function drawTrails(ctx, view, m) {
  const u = view.u, heat = m.heat, L = m.length, k = ui.exposure, size = u * 1.7;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let p = 1; p < L - 1; p++) {
    const hv = heat[p];
    if (hv < 0.01) continue;
    const a = 1 - Math.exp(-hv * k);
    if (a < 0.015) continue;
    const f = ui.fold[p];
    ctx.globalAlpha = a * 0.58;
    ctx.drawImage(GLOW, view.x(f.c) - size / 2, view.y(f.r) - size / 2, size, size);
  }
  ctx.restore();
}

function drawHead(ctx, view, m, trails) {
  const u = view.u;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const hp = headPoint(view, m);
  if (hp && (trails || !fastMode())) {
    const size = u * (trails ? 2.4 : 1.6);
    ctx.globalAlpha = trails ? 1 : 0.55;
    ctx.drawImage(GLOW, hp.x - size / 2, hp.y - size / 2, size, size);
  }
  ctx.restore();
  if (hp && trails && !fastMode()) {
    ctx.save();
    ctx.strokeStyle = lamp(0.95); ctx.lineWidth = Math.max(1.4, u * 0.07);
    ctx.beginPath(); ctx.arc(hp.x, hp.y, u * 0.4, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.moveTo(hp.x + dx * u * 0.48, hp.y + dy * u * 0.48);
      ctx.lineTo(hp.x + dx * u * 0.66, hp.y + dy * u * 0.66);
    }
    ctx.stroke();
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ controller */

const NODES = [
  { f: SCAN, x: 0.34, y: 0.5, loop: -1.57 },
  { f: GO, x: 0.62, y: 0.13, loop: -1.57 },
  { f: READ, x: 0.92, y: 0.5, loop: null },
  { f: HOME, x: 0.68, y: 0.86, loop: 0.62 },
  { f: PRINT, x: 0.38, y: 0.9, loop: null },
  { f: BACK, x: 0.06, y: 0.16, loop: -2.3 },
  { f: COMMIT, x: 0.06, y: 0.84, loop: 2.3 }
];
const EDGES = [
  [SCAN, SCAN], [SCAN, GO, 0.16], [SCAN, BACK, 0.16],
  [GO, GO], [GO, READ, 0.16],
  [READ, HOME, 0.16],
  [HOME, HOME], [HOME, GO, 0.1], [HOME, PRINT, 0.12],
  [PRINT, SCAN, 0.16],
  [BACK, BACK], [BACK, COMMIT, 0.22], [BACK, SCAN, 0.16],
  [COMMIT, COMMIT], [COMMIT, BACK, 0.22]
];

function edgeGeometry(e, P, R) {
  const [a, b, bend] = e;
  if (a === b) {
    const node = NODES[a], ang = node.loop, rl = R * 0.5, d = R + rl * 0.62;
    return { loop: true, cx: P[a].x + Math.cos(ang) * d, cy: P[a].y + Math.sin(ang) * d, rl, ang };
  }
  const p = P[a], q = P[b], dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy);
  const cx = (p.x + q.x) / 2 - dy / len * bend * len, cy = (p.y + q.y) / 2 + dx / len * bend * len;
  const trim = (from, dist) => {
    const vx = cx - from.x, vy = cy - from.y, l = Math.hypot(vx, vy);
    return { x: from.x + vx / l * dist, y: from.y + vy / l * dist };
  };
  const s = trim(p, R + 2), t = trim(q, R + 4);
  return { loop: false, sx: s.x, sy: s.y, cx, cy, ex: t.x, ey: t.y };
}

function pointOn(gm, t) {
  if (gm.loop) {
    const a0 = gm.ang + Math.PI + 0.9, a = a0 + t * (2 * Math.PI - 1.8);
    return { x: gm.cx + Math.cos(a) * gm.rl, y: gm.cy + Math.sin(a) * gm.rl };
  }
  const u = 1 - t;
  return { x: u * u * gm.sx + 2 * u * t * gm.cx + t * t * gm.ex, y: u * u * gm.sy + 2 * u * t * gm.cy + t * t * gm.ey };
}

function arrow(ctx, x, y, ang, size) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - Math.cos(ang - 0.42) * size, y - Math.sin(ang - 0.42) * size);
  ctx.lineTo(x - Math.cos(ang + 0.42) * size, y - Math.sin(ang + 0.42) * size);
  ctx.closePath();
  ctx.fill();
}

function drawFSM() {
  const { ctx, w, h } = sizeCanvas($('cv-fsm'));
  ctx.clearRect(0, 0, w, h);
  const R = clamp(Math.min(w * 0.085, h * 0.12), 17, 36);
  const padX = R * 1.55, padY = R * 1.45;
  const P = NODES.map(nd => ({ x: padX + nd.x * (w - 2 * padX), y: padY + nd.y * (h - 2 * padY) }));
  const m = ui.machine, current = m.program.family[m.state];
  let maxEdge = 0;
  for (let k = 0; k < 49; k++) maxEdge = Math.max(maxEdge, ui.edgeHeat[k]);
  const geo = EDGES.map(e => edgeGeometry(e, P, R));

  EDGES.forEach((e, i) => {
    const gm = geo[i], heat = maxEdge > 0 ? Math.log1p(ui.edgeHeat[e[0] * 7 + e[1]]) / Math.log1p(maxEdge) : 0;
    for (const pass of [0, 1]) {
      if (pass === 1 && heat < 0.02) continue;
      ctx.save();
      ctx.strokeStyle = pass ? lamp(0.25 + 0.75 * heat) : ivory(0.22);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = pass ? 1 + 2.2 * heat : 1.2;
      if (pass) { ctx.shadowColor = lamp(0.9); ctx.shadowBlur = 10 * heat; }
      ctx.beginPath();
      let endAng;
      if (gm.loop) {
        const a0 = gm.ang + Math.PI + 0.9, a1 = gm.ang + Math.PI - 0.9 + 2 * Math.PI;
        ctx.arc(gm.cx, gm.cy, gm.rl, a0, a1);
        ctx.stroke();
        const ex = gm.cx + Math.cos(a1) * gm.rl, ey = gm.cy + Math.sin(a1) * gm.rl;
        endAng = a1 + Math.PI / 2;
        arrow(ctx, ex, ey, endAng, 6 + 2 * heat * pass);
      } else {
        ctx.moveTo(gm.sx, gm.sy);
        ctx.quadraticCurveTo(gm.cx, gm.cy, gm.ex, gm.ey);
        ctx.stroke();
        endAng = Math.atan2(gm.ey - gm.cy, gm.ex - gm.cx);
        arrow(ctx, gm.ex, gm.ey, endAng, 7 + 2 * heat * pass);
      }
      ctx.restore();
    }
  });

  for (const pulse of ui.pulses) {
    const i = EDGES.findIndex(e => e[0] === pulse.a && e[1] === pulse.b);
    if (i < 0) continue;
    const pt = pointOn(geo[i], clamp(pulse.t / pulse.life, 0, 1));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(GLOW, pt.x - R * 0.7, pt.y - R * 0.7, R * 1.4, R * 1.4);
    ctx.restore();
  }

  const fast = fastMode();
  NODES.forEach((nd, f) => {
    const p = P[f], heat = clamp(ui.nodeHeat[f], 0, 1), on = !fast && f === current;
    ctx.save();
    if (heat > 0.02 || on) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = on ? 0.9 : heat * 0.8;
      ctx.drawImage(GLOW, p.x - R * 2.1, p.y - R * 2.1, R * 4.2, R * 4.2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    const body = ctx.createRadialGradient(p.x - R * .3, p.y - R * .35, R * .1, p.x, p.y, R);
    if (on) { body.addColorStop(0, '#f2fdff'); body.addColorStop(1, '#8fdcf3'); }
    else { body.addColorStop(0, '#26345a'); body.addColorStop(1, '#172240'); }
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2); ctx.fill();
    if (fast && heat > 0.05) { // at speed, brightness is the share of recent steps spent here
      ctx.globalAlpha = heat * 0.5;
      ctx.fillStyle = COLOR.lamp;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.lineWidth = on ? 2 : 1.2;
    ctx.strokeStyle = on ? '#e6fbff' : ivory(0.32 + heat * 0.5);
    ctx.stroke();
    ctx.fillStyle = on ? '#0d2236' : COLOR.text;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(R * 0.9)}px ${FRAK}`;
    ctx.fillText(FAMILIES[f].letter, p.x, p.y - R * 0.18);
    ctx.font = `${Math.round(clamp(R * 0.36, 10, 14))}px ${SERIF}`;
    ctx.fillStyle = on ? '#16324a' : COLOR.text2;
    ctx.fillText(FAMILIES[f].name, p.x, p.y + R * 0.5);
    ctx.restore();
  });
}

/* ------------------------------------------------------------------ tape */

function drawTape() {
  const { ctx, w, h } = sizeCanvas($('cv-tape'));
  ctx.clearRect(0, 0, w, h);
  const m = ui.machine, L = m.length, tape = m.tape;
  const minSquares = Math.max(27, 2 * (ui.n + 4) + 5);
  const sw = clamp(w / minSquares, 23, 50);
  const top = 10, ph = Math.min(70, h - 44), mid = w / 2;
  const first = Math.floor(ui.tapeCenter - mid / sw) - 2, last = Math.ceil(ui.tapeCenter + mid / sw) + 2;
  const X = p => mid + (p - ui.tapeCenter) * sw - sw / 2;

  // paper
  for (let p = first; p <= last; p++) {
    const x0 = X(p), inside = p >= 0 && p < L;
    ctx.fillStyle = inside ? COLOR.paper : '#d8ceb3';
    ctx.fillRect(x0, top, sw + 0.5, ph);
  }
  const shade = ctx.createLinearGradient(0, top, 0, top + ph);
  shade.addColorStop(0, 'rgba(120, 90, 40, .16)');
  shade.addColorStop(.12, 'rgba(120, 90, 40, 0)');
  shade.addColorStop(.88, 'rgba(120, 90, 40, 0)');
  shade.addColorStop(1, 'rgba(120, 90, 40, .2)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, top, w, ph);

  const holeY = top + 8, upper = top + ph * 0.43, lower = top + ph * 0.77;
  const big = Math.round(clamp(sw * 0.46, 11, 21)), small = Math.round(clamp(sw * 0.36, 9, 16));
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let p = first; p <= last; p++) {
    const x0 = X(p), cx = x0 + sw / 2;
    ctx.fillStyle = 'rgba(42, 29, 16, .16)';
    ctx.fillRect(Math.round(x0), top, 1, ph);
    ctx.fillStyle = '#0d1424';
    ctx.beginPath(); ctx.arc(cx, holeY, Math.max(1.6, sw * 0.07), 0, Math.PI * 2); ctx.fill();
    if (p < 0 || p >= L) continue;
    const s = tape[p];
    if (s === M0 || s === M1) {
      ctx.strokeStyle = COLOR.red; ctx.lineWidth = 2;
      ctx.strokeRect(x0 + 2.5, top + 15, sw - 5, ph - 19);
    }
    ctx.fillStyle = COLOR.ink;
    if (s === LEFT_END || s === RIGHT_END || s === EDGE || s === ROW_END) {
      ctx.globalAlpha = s === EDGE ? 0.45 : s === ROW_END ? 0.7 : 1;
      ctx.font = `500 ${big}px ${MONO}`;
      ctx.fillText(SYMBOLS[s], cx, top + ph * 0.58);
      ctx.globalAlpha = 1;
      continue;
    }
    const old = oldValue(s), nxt = nextValue(s);
    ctx.font = `600 ${big}px ${MONO}`;
    ctx.fillText(String(old), isMark(s) ? cx - sw * 0.08 : cx, upper);
    if (isMark(s)) {
      ctx.fillStyle = COLOR.red;
      ctx.font = `600 ${small}px ${MONO}`;
      ctx.fillText('*', cx + sw * 0.2, upper - big * 0.2);
    }
    if (nxt >= 0) {
      const r = clamp(sw * 0.27, 7, 13);
      const disc = ctx.createRadialGradient(cx - r * .35, lower - r * .4, r * .1, cx, lower, r);
      disc.addColorStop(0, '#ffffff'); disc.addColorStop(.7, '#ece6da'); disc.addColorStop(1, '#c3b9a5');
      ctx.fillStyle = disc;
      ctx.beginPath(); ctx.arc(cx, lower, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLOR.ink;
      ctx.font = `600 ${small}px ${MONO}`;
      ctx.fillText(String(nxt), cx, lower + 0.5);
    }
  }

  // Light through the punched holes where the head has been.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const heat = m.heat, size = sw * 0.9;
  for (let p = Math.max(0, first); p <= Math.min(L - 1, last); p++) {
    const a = 1 - Math.exp(-heat[p] * ui.exposure);
    if (a < 0.02) continue;
    ctx.globalAlpha = a;
    ctx.drawImage(GLOW, X(p) + sw / 2 - size / 2, holeY - size / 2, size, size);
  }
  ctx.restore();

  // The head: a reading gate around one square.
  const hx = X(ui.visHead);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = lamp(0.16);
  ctx.fillRect(hx, top, sw, ph);
  ctx.restore();
  ctx.strokeStyle = COLOR.lamp; ctx.lineWidth = 2;
  const g = 7, y0 = top - 5, y1 = top + ph + 5;
  ctx.beginPath();
  ctx.moveTo(hx - 2, y0 + g); ctx.lineTo(hx - 2, y0); ctx.lineTo(hx + g, y0);
  ctx.moveTo(hx + sw + 2 - g, y0); ctx.lineTo(hx + sw + 2, y0); ctx.lineTo(hx + sw + 2, y0 + g);
  ctx.moveTo(hx - 2, y1 - g); ctx.lineTo(hx - 2, y1); ctx.lineTo(hx + g, y1);
  ctx.moveTo(hx + sw + 2 - g, y1); ctx.lineTo(hx + sw + 2, y1); ctx.lineTo(hx + sw + 2, y1 - g);
  ctx.stroke();

  // Fade the tape out at both sides; it carries on in both directions.
  for (const [x0, x1] of [[0, 46], [w, w - 46]]) {
    const fade = ctx.createLinearGradient(x0, 0, x1, 0);
    fade.addColorStop(0, 'rgba(14, 22, 38, 1)');
    fade.addColorStop(1, 'rgba(14, 22, 38, 0)');
    ctx.fillStyle = fade;
    ctx.fillRect(Math.min(x0, x1), 0, 46, top + ph + 8);
  }

  // The whole tape, squeezed into one strip.
  const oy = top + ph + 14, oh = Math.max(10, h - oy - 6), bw = w / L;
  for (let p = 0; p < L; p++) {
    const s = tape[p], x = p * bw;
    if (s === ROW_END) continue;
    if (s === LEFT_END || s === RIGHT_END) { ctx.fillStyle = ivory(.75); ctx.fillRect(x, oy, Math.max(1, bw * .6), oh); continue; }
    if (s === EDGE) { ctx.fillStyle = ivory(.12); ctx.fillRect(x, oy, bw - .4, oh); continue; }
    if (isMark(s)) { ctx.fillStyle = COLOR.redBright; ctx.fillRect(x, oy, Math.max(1.5, bw - .4), oh); continue; }
    ctx.fillStyle = oldValue(s) ? ivory(.92) : ivory(.22);
    ctx.fillRect(x, oy, bw - .4, oh * .55);
    const nx = nextValue(s);
    if (nx >= 0) { ctx.fillStyle = nx ? '#ffffff' : ivory(.3); ctx.fillRect(x, oy + oh * .62, bw - .4, oh * .38); }
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let p = 0; p < L; p++) {
    const a = 1 - Math.exp(-heat[p] * ui.exposure);
    if (a < 0.03) continue;
    ctx.fillStyle = lamp(a * 0.85);
    ctx.fillRect(p * bw, oy - 4, Math.max(1, bw), oh + 8);
  }
  ctx.restore();
  const vx0 = clamp((ui.tapeCenter - mid / sw) * bw, 0, w), vx1 = clamp((ui.tapeCenter + mid / sw) * bw, 0, w);
  ctx.strokeStyle = ivory(.5); ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(vx0) + .5, oy - 3.5, Math.max(4, vx1 - vx0), oh + 7);
  ctx.fillStyle = COLOR.lamp;
  ctx.fillRect((ui.visHead + .5) * bw - 1, oy - 6, 2, oh + 12);
}

/* ------------------------------------------------------------------ words */

const els = {
  genNow: $('gen-now'), genNext: $('gen-next'), nowMeta: $('now-meta'), nextMeta: $('next-meta'),
  ctrlMeta: $('ctrl-meta'), tapeMeta: $('tape-meta'), stateWords: $('state-words'), delta: $('delta'),
  story: $('story'), run: $('btn-run'), undo: $('btn-undo'),
  speed: $('speed'), speedOut: $('speed-out'), pattern: $('pattern'), size: $('size'),
  regDir: $('reg-dir'), regDist: $('reg-dist'), regCount: $('reg-count'), regOld: $('reg-old')
};
const textCache = new Map();
function setText(el, value, html = false) {
  if (textCache.get(el) === value) return;
  textCache.set(el, value);
  if (html) el.innerHTML = value; else el.textContent = value;
}

const sq = s => `<span class="sq${s === M0 || s === M1 ? ' mark' : ''}">${SYMBOLS[s]}</span>`;
function stateHTML(q) {
  const f = `<span class="frak">${FAMILIES[q.f].letter}</span>`;
  switch (q.f) {
    case GO: return `${f}(${DIRECTIONS[q.j]}, ${q.d}, ${q.c}, ${q.o})`;
    case READ: case HOME: return `${f}(${DIRECTIONS[q.j]}, ${q.c}, ${q.o})`;
    case PRINT: return `${f}(${q.c}, ${q.o})`;
    case BACK: return `${f}(<span class="frak">${q.m === 0 ? 'c' : 's'}</span>)`;
    default: return f;
  }
}
const MOVES = { '-1': 'L', 0: 'S', 1: 'R' };

function stateWords(q, m) {
  switch (q.f) {
    case SCAN: return 'Scan: moving right to the next square that still holds a plain 0 or 1.';
    case GO: return `Go: walking to the ${DIRECTION_NAMES[q.j]} neighbour, ${plural(q.d, 'square')} to the ${m.program.offsets[q.j] < 0 ? 'left' : 'right'}.`;
    case READ: return `Read: adding the ${DIRECTION_NAMES[q.j]} neighbour’s old value to the count.`;
    case HOME: return 'Home: walking back to the marked cell.';
    case PRINT: return 'Print: writing the old and new values side by side.';
    case BACK: return q.m === 0 ? 'Back: rewinding to ⟨ before the commit sweep.' : 'Back: rewinding to ⟨ to start the next generation.';
    default: return 'Commit: keeping the new half of every pair.';
  }
}

function cellName(m, p) {
  const i = m.posCell[p];
  return i < 0 ? '' : ` (row ${Math.floor(i / m.n) + 1}, column ${i % m.n + 1})`;
}

function storyText(m) {
  const t = m.last();
  if (!t) return ui.note || 'Ready. Scan starts at the left end. Press Step to watch one move at a time, or Run.';
  const S = m.program.states, q = S[t.state], nq = S[t.next], at = `square ${t.at}`;
  switch (t.event) {
    case EV_MARK: return `Found a cell at ${at}${cellName(m, t.at)} and marked it ${SYMBOLS[t.write]}. Next, its north-west neighbour.`;
    case EV_READ: return `Read the ${DIRECTION_NAMES[q.j]} neighbour at ${at}: ${t.symbol === EDGE ? 'the dead edge' : oldValue(t.symbol) ? 'alive' : 'dead'}. Live count ${q.c} → ${nq.c}.`;
    case EV_PRINT: {
      const nv = nextValue(t.write);
      return `Printed ${SYMBOLS[t.write]} at ${at}: ${q.o ? 'alive' : 'dead'} with ${plural(q.c, 'live neighbour')}, so ${nv ? 'alive' : 'dead'} next generation.`;
    }
    case EV_ALL_DONE: return 'Scan reached ⟩, so every cell holds a pair. Rewind, then commit.';
    case EV_GENERATION: return `Generation ${m.generation} is on the tape. Rewinding to start the next one.`;
  }
  switch (q.f) {
    case SCAN: return `Scan passed ${SYMBOLS[t.symbol]} at ${at}.`;
    case GO: return nq.f === READ ? `Arrived at the ${DIRECTION_NAMES[q.j]} neighbour, ${at}.` : `Walking ${t.move < 0 ? 'left' : 'right'}: ${plural(q.d - 1, 'square')} to the ${DIRECTION_NAMES[q.j]} neighbour.`;
    case HOME:
      if (!isMark(t.symbol)) return `Walking ${t.move < 0 ? 'left' : 'right'}, back toward the mark.`;
      return nq.f === PRINT ? 'Back at the mark with all eight neighbours counted.' : `Back at the mark. Next, the ${DIRECTION_NAMES[nq.j]} neighbour.`;
    case BACK: return t.symbol === LEFT_END ? (q.m === 0 ? 'At ⟨. The commit sweep starts.' : 'At ⟨. Scan starts the next generation.') : 'Rewinding left.';
    case COMMIT: return isPair(t.symbol) ? `Commit: ${SYMBOLS[t.symbol]} → ${SYMBOLS[t.write]} at ${at}.` : `Commit passes ${SYMBOLS[t.symbol]}.`;
  }
  return '';
}

function fastStory(m) {
  const per = stepsPerGeneration(ui.n);
  const gps = ui.speed / per;
  const rate = gps >= 1 ? `${gps.toFixed(gps < 10 ? 1 : 0)} generations a second` : `one generation every ${(1 / gps).toFixed(gps > 0.1 ? 1 : 0)} seconds`;
  return `Each cell takes ${fmt(stepsPerCell(ui.n))} steps and a generation ${fmt(per)}, so at this speed that is ${rate}.`;
}

const COMPASS = [0, 1, 2, 3, 5, 6, 7, 8];
function updateRegister(q) {
  const inCell = q.f >= GO && q.f <= PRINT;
  const compass = els.regDir.querySelectorAll('.compass i');
  COMPASS.forEach((idx, j) => {
    const cls = !inCell ? '' : q.f === PRINT || j < q.j ? 'done' : j === q.j ? 'now' : '';
    if (compass[idx].className !== cls) compass[idx].className = cls;
  });
  els.regDir.classList.toggle('off', !(q.j >= 0));
  setText(els.regDir.querySelector('.reg-value'), q.j >= 0 ? DIRECTION_NAMES[q.j] : q.f === PRINT ? 'all eight' : '—');
  els.regDist.classList.toggle('off', q.f !== GO);
  setText(els.regDist.querySelector('.odometer'), q.f === GO ? String(q.d) : '–');
  setText(els.regDist.querySelector('.reg-value'), q.f === GO ? (q.d === 1 ? 'one more' : 'counting down') : '—');
  els.regCount.classList.toggle('off', !inCell);
  const pips = els.regCount.querySelectorAll('.pips i');
  pips.forEach((pip, k) => pip.classList.toggle('on', inCell && k < q.c));
  setText(els.regCount.querySelector('.reg-value'), inCell ? String(q.c) : '—');
  els.regOld.classList.toggle('off', !inCell);
  els.regOld.querySelector('.stone-chip').classList.toggle('alive', inCell && q.o === 1);
  setText(els.regOld.querySelector('.reg-value'), inCell ? (q.o ? 'alive' : 'dead') : '—');
}

function updateWords() {
  const m = ui.machine, n = ui.n, q = m.program.states[m.state];
  const fast = fastMode();
  let live = 0, written = 0;
  for (let i = 0; i < n * n; i++) {
    const s = m.tape[m.cellPos[i]];
    if (oldValue(s) === 1) live++;
    if (nextValue(s) >= 0) written++;
  }
  setText(els.genNow, String(m.generation));
  setText(els.genNext, String(m.generation + 1));
  const fam = q.f;
  setText(els.nowMeta, fam === COMMIT ? `${plural(live, 'live cell')}, generation ${m.generation + 1} arriving` : plural(live, 'live cell'));
  setText(els.nextMeta, fam === COMMIT || (fam === BACK && q.m === 0) ? `${written} of ${n * n} written, committing` : `${written} of ${n * n} written`);
  setText(els.tapeMeta, `square ${m.head} of ${m.length}, ${plural(m.steps, 'step')} so far`);
  updateRegister(q);
  setText(els.stateWords, `<span class="formal">${stateHTML(q)}</span> ${stateWords(q, m)}`, true);
  const t = m.peek();
  setText(els.delta, t.next < 0 ? 'No rule here: the machine would halt.'
    : `δ(${stateHTML(q)}, ${sq(t.symbol)}) = (${sq(t.write)}, ${MOVES[t.move]}, ${stateHTML(m.program.states[t.next])})`, true);
  setText(els.story, fast ? fastStory(m) : storyText(m));
  const politeness = ui.playing ? 'off' : 'polite';
  if (els.story.getAttribute('aria-live') !== politeness) els.story.setAttribute('aria-live', politeness);
  els.undo.disabled = !m.canUndo;
}

/* ------------------------------------------------------------------ article: live table row */

const rowTable = $('row-table'), rowState = $('row-state');
let rowKey = '', rowClock = 0;
function updateTableRow(force = false) {
  const m = ui.machine, q = m.state, s = m.tape[m.head], key = `${ui.n}:${q}:${s}`;
  if (!force && key === rowKey) return;
  rowKey = key;
  const p = m.program, st = p.states[q];
  rowState.innerHTML = `State ${stateHTML(st)}, one of ${fmt(p.stateCount)}. ${stateWords(st, m)}`;
  let body = '';
  for (let k = 0; k < A; k++) {
    const i = q * A + k, live = k === s ? ' class="live"' : '';
    if (p.next[i] < 0) { body += `<tr${live}><td>${sq(k)}</td><td class="none" colspan="3">no rule</td></tr>`; continue; }
    body += `<tr${live}><td>${sq(k)}</td><td>${sq(p.write[i])}</td><td>${MOVES[p.move[i]]}</td><td>${stateHTML(p.states[p.next[i]])}</td></tr>`;
  }
  rowTable.innerHTML = `<thead><tr><th scope="col">Reads</th><th scope="col">Writes</th><th scope="col">Moves</th><th scope="col">Next state</th></tr></thead><tbody>${body}</tbody>`;
}

/* ------------------------------------------------------------------ article: folding diagram */

function buildFold() {
  const n = 5, stride = n + 3, L = (n + 2) * stride + 2;
  const sym = p => {
    if (p === 0) return '⟨';
    if (p === L - 1) return '⟩';
    const k = p - 1, r = Math.floor(k / stride), c = k % stride;
    if (c === n + 2) return '#';
    if (r === 0 || r === n + 1 || c === 0 || c === n + 1) return 'X';
    return '';
  };
  const where = p => {
    if (p === 0) return { r: 0, c: -1 };
    if (p === L - 1) return { r: n + 1, c: n + 3 };
    return { r: Math.floor((p - 1) / stride), c: (p - 1) % stride };
  };
  const offsets = [-stride - 1, -stride, -stride + 1, -1, 1, stride - 1, stride, stride + 1];
  const S = 46, bx = 8, by = 8;
  const boardSvg = [`<svg viewBox="0 0 ${(n + 5) * S + 16} ${(n + 2) * S + 16}" role="img" aria-label="The board folded into rows">`];
  const lineW = 20, lineSvg = [`<svg viewBox="0 0 ${L * lineW + 16} 150" role="img" aria-label="The same squares as one tape">`];
  for (let p = 0; p < L; p++) {
    const { r, c } = where(p), s = sym(p), x = bx + (c + 1) * S, y = by + r * S;
    const data = s === '';
    boardSvg.push(`<g class="fq" data-p="${p}"${data ? ' style="cursor:pointer"' : ''}><rect x="${x + 1}" y="${y + 1}" width="${S - 2}" height="${S - 2}" rx="3" fill="${data ? '#efe4c7' : s === 'X' ? 'rgba(239,228,199,.35)' : 'rgba(239,228,199,.12)'}"/>`
      + `<text x="${x + S / 2}" y="${y + S / 2 + 2}" text-anchor="middle" font-size="${data ? 15 : 14}" fill="${data ? '#2a1d10' : '#e9e2d2'}">${data ? p : s}</text>`
      + (data ? '' : `<text x="${x + 5}" y="${y + 12}" font-size="8.5" fill="rgba(233,226,210,.55)">${p}</text>`) + '</g>');
    const lx = 8 + p * lineW;
    lineSvg.push(`<g class="fq" data-p="${p}"${data ? ' style="cursor:pointer"' : ''}><rect x="${lx + .5}" y="98" width="${lineW - 1}" height="32" fill="${data ? '#efe4c7' : s === 'X' ? 'rgba(239,228,199,.35)' : 'rgba(239,228,199,.12)'}"/>`
      + `<text x="${lx + lineW / 2}" y="118" text-anchor="middle" font-size="10" fill="${data ? '#2a1d10' : '#e9e2d2'}">${data ? p : s}</text>`
      + `<text x="${lx + lineW / 2}" y="144" text-anchor="middle" font-size="7.5" fill="rgba(233,226,210,.45)">${data ? '' : p}</text></g>`);
  }
  boardSvg.push('<g class="arcs"></g></svg>');
  lineSvg.push('<g class="arcs"></g></svg>');
  const boardEl = $('fold-board'), lineEl = $('fold-line');
  boardEl.innerHTML = boardSvg.join('');
  lineEl.innerHTML = lineSvg.join('');
  boardEl.tabIndex = 0;
  boardEl.setAttribute('aria-label', 'Folded board. Use the arrow keys to choose a cell.');

  let selected = 1 + 3 * stride + 3; // the middle cell
  const signed = o => (o > 0 ? '+' + o : '−' + -o);
  const baseFill = new Map();
  function show(p) {
    selected = p;
    const ns = new Map(offsets.map(o => [p + o, o]));
    for (const svg of [boardEl, lineEl]) {
      svg.querySelectorAll('.fq').forEach(g => {
        const q = +g.dataset.p, rect = g.querySelector('rect');
        if (!baseFill.has(rect)) baseFill.set(rect, rect.getAttribute('fill'));
        const isSel = q === p, isN = ns.has(q);
        rect.setAttribute('fill', isSel ? '#f4cfc5' : isN ? '#cdeffa' : baseFill.get(rect));
        rect.setAttribute('stroke', isSel ? '#c9412f' : isN ? '#5fb7d6' : 'none');
        rect.setAttribute('stroke-width', isSel ? 3 : isN ? 2 : 0);
      });
    }
    // On the line: an arc to each neighbour, with its offset printed just above it.
    const arcs = ['<g font-size="10" fill="#a6ebff" text-anchor="middle">'];
    const cx0 = 8 + p * lineW + lineW / 2;
    for (const [q, o] of ns) {
      const cx1 = 8 + q * lineW + lineW / 2, hgt = 10 + Math.abs(o) * 5.4;
      arcs.push(`<path d="M${cx0} 84 C ${cx0} ${84 - hgt}, ${cx1} ${84 - hgt}, ${cx1} 84" fill="none" stroke="rgba(166,235,255,.55)" stroke-width="1.2"/>`);
      arcs.push(`<text x="${cx1}" y="94">${signed(o)}</text>`);
    }
    arcs.push('</g>');
    lineEl.querySelector('.arcs').innerHTML = arcs.join('');
    const { r, c } = where(p);
    const lbl = ['<g font-size="10.5" fill="#174a5e" text-anchor="middle">'];
    for (const [q, o] of ns) {
      const w = where(q);
      lbl.push(`<text x="${bx + (w.c + 1) * S + S / 2}" y="${by + w.r * S + S - 5}">${signed(o)}</text>`);
    }
    lbl.push(`<text x="${bx + (c + 1) * S + S / 2}" y="${by + r * S + S - 5}" fill="#9b2a1a">cell</text></g>`);
    boardEl.querySelector('.arcs').innerHTML = lbl.join('');
    // On narrow screens the line scrolls; keep the chosen cell in view.
    const scroller = lineEl.parentElement;
    if (scroller.scrollWidth > scroller.clientWidth) {
      const x = (8 + p * lineW + lineW / 2) / (L * lineW + 16) * lineEl.clientWidth;
      scroller.scrollLeft = x - scroller.clientWidth / 2;
    }
  }
  const pick = e => {
    const g = e.target.closest('.fq');
    if (!g) return;
    const p = +g.dataset.p;
    if (!sym(p)) show(p);
  };
  boardEl.addEventListener('click', pick);
  lineEl.addEventListener('click', pick);
  boardEl.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') pick(e); });
  boardEl.addEventListener('keydown', e => {
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -stride, ArrowDown: stride }[e.key];
    if (!d) return;
    e.preventDefault();
    if (!sym(selected + d)) show(selected + d);
  });
  show(selected);
}

/* ------------------------------------------------------------------ article: sizes and check */

function buildSizes() {
  const rows = [5, 7, 10, 14, 16, 32, 100].map(n => `<tr><td>${n} × ${n}</td><td>${fmt(54 * n + 362)}</td><td>${fmt(stepsPerCell(n))}</td><td>${fmt(stepsPerGeneration(n))}</td><td>${fmt(4 * stepsPerGeneration(n))}</td></tr>`);
  $('sizes').innerHTML = `<thead><tr><th scope="col">Board</th><th scope="col">States</th><th scope="col">Steps per cell</th><th scope="col">Steps per generation</th><th scope="col">Steps per glider move</th></tr></thead><tbody>${rows.join('')}</tbody>`;
  $('glider-cost').textContent = fmt(4 * stepsPerGeneration(14));
}

async function runCheck() {
  const btn = $('btn-check'), out = $('check-out');
  btn.disabled = true;
  let seed = (Date.now() ^ 0x9e3779b9) >>> 0;
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  let boards = 0, gens = 0, bad = 0, steps = 0;
  const t0 = performance.now();
  for (let b = 0; b < 300; b++) {
    const n = 3 + (b % 10), density = 0.15 + rnd() * 0.4;
    let board = Uint8Array.from({ length: n * n }, () => (rnd() < density ? 1 : 0));
    const m = new LifeTuringMachine(n, board, { history: 16 });
    for (let g = 0; g < 6; g++) {
      steps += m.finishGeneration().steps;
      board = lifeStep(board, n);
      for (let i = 0; i < board.length; i++) if (board[i] !== m.current[i]) { bad++; break; }
      gens++;
    }
    boards++;
    if (b % 30 === 29) { out.textContent = `${boards} boards checked…`; await new Promise(r => setTimeout(r, 0)); }
  }
  const secs = (performance.now() - t0) / 1000;
  out.textContent = `${boards} random boards from 3 × 3 to 12 × 12, ${fmt(gens)} generations: ${bad === 0 ? 'no mismatches' : plural(bad, 'mismatch', 'mismatches')}. The machine took ${fmt(steps)} steps in ${secs.toFixed(2)} seconds.`;
  btn.disabled = false;
}

/* ------------------------------------------------------------------ control */

function foldTable(m) {
  ui.fold = Array.from({ length: m.length }, (_, p) => m.fold(p));
}

function load(board) {
  ui.note = '';
  ui.seed = Uint8Array.from(board);
  ui.machine = new LifeTuringMachine(ui.n, ui.seed);
  foldTable(ui.machine);
  ui.visHead = ui.tapeCenter = ui.machine.head;
  ui.acc = 0;
  ui.edgeHeat.fill(0); ui.nodeHeat.fill(0);
  ui.pulses.length = 0; ui.flashes.length = 0;
  const p = ui.machine.program;
  setText(els.ctrlMeta, `${fmt(p.stateCount)} states, ${p.symbolCount} symbols`);
  $('table-size').textContent = `${fmt(p.stateCount)} states by ${p.symbolCount} symbols for this ${ui.n} × ${ui.n} board`;
  updateTableRow(true);
  ui.dirty = true;
}

function setPlaying(on) {
  ui.playing = on;
  els.run.classList.toggle('on', on);
  els.run.querySelector('span').textContent = on ? 'Pause' : 'Run';
  els.run.setAttribute('aria-label', on ? 'Pause' : 'Run');
  els.run.querySelector('svg').innerHTML = on ? '<path d="M2 1h3v10H2zM7 1h3v10H7z"/>' : '<path d="M2 1l9 5-9 5z"/>';
  ui.dirty = true;
}

const sliderToSpeed = v => {
  const raw = 10 ** (v / 1000 * 6);
  if (raw < 10) return Math.max(1, Math.round(raw));
  const mag = 10 ** (Math.floor(Math.log10(raw)) - 1); // two significant figures
  return clamp(Math.round(raw / mag) * mag, 1, 1e6);
};
const speedToSlider = s => Math.round(Math.log10(s) / 6 * 1000);
function speedLabel(s) {
  if (s >= 1e6) return 'a million steps a second';
  return `${fmt(s)} ${s === 1 ? 'step' : 'steps'} a second`;
}
function setSpeed(s, moveSlider = true) {
  ui.speed = s;
  if (moveSlider) els.speed.value = String(speedToSlider(s));
  setText(els.speedOut, speedLabel(s));
  ui.dirty = true;
}

function stepMachine(limit, stopMask = 0) {
  const m = ui.machine;
  let res;
  try { res = m.run(limit, stopMask); }
  catch (err) { setPlaying(false); setText(els.story, err.message); return null; }
  if (res.steps > 0 && res.steps <= 3 && !fastMode()) {
    for (let i = res.steps; i >= 1; i--) {
      const ptr = (m.hPtr - i) & m.hMask, q = m.hState[ptr], s = m.hSym[ptr];
      const nq = m.program.next[q * A + s];
      ui.pulses.push({ a: m.program.family[q], b: m.program.family[nq], t: 0, life: clamp(0.8 / Math.max(1, ui.speed), 0.12, 0.3) });
    }
  }
  if (m.prints.length) {
    if (ui.speed <= 3000) for (const p of m.prints) ui.flashes.push({ p, t: 0 });
    m.prints.length = 0;
  }
  if (!ui.playing || !fastMode()) {
    // A manual jump should still be readable: the head lands, it does not slide for a whole generation.
    if (Math.abs(m.head - ui.visHead) > 3) ui.visHead = m.head;
  }
  ui.dirty = true;
  return res;
}

function manual(fn) {
  setPlaying(false);
  fn();
  draw(0); // answer the click in the same frame
}

function decay(dt) {
  const m = ui.machine;
  // Persistence covers about the last four cells' worth of steps, so at speed the light
  // reads as a band sweeping the board rather than a wash.
  const keep = Math.exp(-dt / clamp(4 * stepsPerCell(ui.n) / ui.speed, 0.05, 0.26));
  const heat = m.heat;
  let max = 0;
  for (let p = 0; p < heat.length; p++) { heat[p] *= keep; if (heat[p] > max) max = heat[p]; }
  // Auto exposure, like a camera: the brightest square stays near full brightness.
  const target = max > 0 ? clamp(2.4 / max, 0.002, 1.6) : 1.6;
  ui.exposure += (target - ui.exposure) * (1 - Math.exp(-dt * 6));
  const flow = m.flow, keepFlow = Math.exp(-dt / 0.4);
  let total = 0;
  const famTotals = new Float32Array(7);
  for (let k = 0; k < 49; k++) {
    ui.edgeHeat[k] = ui.edgeHeat[k] * keepFlow + flow[k];
    famTotals[Math.floor(k / 7)] += ui.edgeHeat[k];
    total += ui.edgeHeat[k];
    flow[k] = 0;
  }
  for (let f = 0; f < 7; f++) ui.nodeHeat[f] = total > 0 ? Math.sqrt(famTotals[f] / total) : 0;
  for (const list of [ui.pulses, ui.flashes]) {
    for (let i = list.length - 1; i >= 0; i--) {
      list[i].t += dt;
      if (list[i].t > (list[i].life ?? 0.5)) list.splice(i, 1);
    }
  }
  // The head glides between squares when you can follow it; at speed it simply is where it is.
  if (fastMode() || reduceMotion) ui.visHead = m.head;
  else ui.visHead += (m.head - ui.visHead) * (1 - Math.exp(-dt * 22));
  const mark = m.markPosition();
  // At speed the window follows the marked cell, which moves steadily; the head flickers around it.
  if (fastMode()) ui.tapeCenter = mark >= 0 ? mark : m.head;
  else ui.tapeCenter = ui.visHead;
}

function animating() {
  return ui.pulses.length || ui.flashes.length || Math.abs(ui.visHead - ui.machine.head) > 0.01 || ui.machine.heat.some(v => v > 0.02);
}

function draw(dt) {
  decay(dt);
  drawNow();
  drawNext();
  drawFSM();
  drawTape();
  updateWords();
  ui.dirty = false;
}

let last = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
  last = now;
  if (document.hidden) return;
  if (ui.playing) {
    ui.acc += ui.speed * dt;
    const k = Math.min(Math.floor(ui.acc), 4e6);
    if (k > 0) { ui.acc -= k; stepMachine(k); }
  }
  if (ui.inView && (ui.playing || ui.dirty || animating())) draw(dt);
  rowClock += dt;
  if (rowVisible && rowClock > 0.12) { rowClock = 0; updateTableRow(); }
}

/* ------------------------------------------------------------------ wiring */

for (const s of SIZES) els.size.add(new Option(`${s} × ${s}`, String(s), false, s === ui.n));
for (const [key, p] of Object.entries(PATTERNS)) els.pattern.add(new Option(p.name, key, false, key === ui.pattern));

els.run.addEventListener('click', () => { setPlaying(!ui.playing); });
$('btn-step').addEventListener('click', () => manual(() => stepMachine(1)));
$('btn-cell').addEventListener('click', () => manual(() => stepMachine(1e9, (1 << EV_PRINT) | (1 << EV_GENERATION))));
$('btn-gen').addEventListener('click', () => manual(() => stepMachine(1e9, 1 << EV_GENERATION)));
els.undo.addEventListener('click', () => manual(() => { ui.machine.back(1); ui.visHead = ui.machine.head; }));
$('btn-reset').addEventListener('click', () => manual(() => load(ui.seed)));
els.speed.addEventListener('input', () => setSpeed(sliderToSpeed(+els.speed.value), false));
els.pattern.addEventListener('change', () => { ui.pattern = els.pattern.value; load(patternBoard(ui.pattern, ui.n)); draw(0); });
els.size.addEventListener('change', () => { ui.n = +els.size.value; load(patternBoard(ui.pattern, ui.n)); draw(0); });
$('btn-check').addEventListener('click', runCheck);

$('cv-now').addEventListener('click', e => {
  const rect = e.currentTarget.getBoundingClientRect();
  const i = views.now.cellAt(e.clientX - rect.left, e.clientY - rect.top);
  if (i < 0) return;
  // Edit the board as it is drawn: the current track of the tape.
  const m = ui.machine;
  const board = Uint8Array.from(m.cellPos, p => (oldValue(m.tape[p]) === 1 ? 1 : 0));
  board[i] ^= 1;
  setPlaying(false);
  load(board);
  ui.note = 'Edited. The machine starts again from generation 0 with this board.';
  draw(0);
});

document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t.closest && t.closest('input, select, textarea, button, [contenteditable], #fold-board')) return;
  const act = {
    ' ': () => setPlaying(!ui.playing),
    ArrowRight: () => manual(() => stepMachine(1)),
    '.': () => manual(() => stepMachine(1)),
    c: () => manual(() => stepMachine(1e9, (1 << EV_PRINT) | (1 << EV_GENERATION))),
    g: () => manual(() => stepMachine(1e9, 1 << EV_GENERATION)),
    ArrowLeft: () => manual(() => { ui.machine.back(1); ui.visHead = ui.machine.head; })
  }[e.key];
  if (!act) return;
  const rect = $('machine').getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > innerHeight) return;
  e.preventDefault();
  act();
});

const mast = $('masthead');
new ResizeObserver(() => document.documentElement.style.setProperty('--mast-h', `${mast.offsetHeight}px`)).observe(mast);
new ResizeObserver(() => { ui.dirty = true; if (CAPTURE) draw(0); }).observe($('machine'));
let rowVisible = false;
new IntersectionObserver(entries => { for (const e of entries) ui.inView = e.isIntersecting; }).observe($('machine'));
new IntersectionObserver(entries => { for (const e of entries) rowVisible = e.isIntersecting; }).observe($('table-row'));

setSpeed(ui.speed);
load(patternBoard(ui.pattern, ui.n));
buildFold();
buildSizes();

const fonts = document.fonts ? Promise.race([
  Promise.all([`400 16px ${SERIF}`, `600 16px ${MONO}`, `500 16px ${MONO}`, `32px ${FRAK}`].map(f => document.fonts.load(f))),
  new Promise(r => setTimeout(r, 2500))
]).catch(() => {}) : Promise.resolve();

fonts.then(() => {
  ui.fontsReady = true;
  ui.dirty = true;
  if (CAPTURE) { draw(0); return; }
  if (!reduceMotion && params.get('autoplay') !== '0') setPlaying(true);
  requestAnimationFrame(loop);
});

// Frame-by-frame driver for recording the film (?capture).
window.__ltm = {
  get machine() { return ui.machine; },
  get fontsReady() { return ui.fontsReady; },
  configure({ n = ui.n, pattern = ui.pattern, speed = ui.speed } = {}) {
    ui.n = n; ui.pattern = pattern;
    els.size.value = String(n); els.pattern.value = pattern;
    load(patternBoard(pattern, n));
    setSpeed(speed);
    setPlaying(false);
    draw(0);
  },
  frame(steps, dt, speed) {
    if (speed) setSpeed(speed);
    if (!ui.playing) setPlaying(true);
    if (steps > 0) stepMachine(steps);
    draw(dt);
    return { generation: ui.machine.generation, steps: ui.machine.steps };
  }
};
