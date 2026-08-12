/* ------------------------------------------------------------------ *
 *  Shapley value estimation — math, charts, and the coalition lattice *
 * ------------------------------------------------------------------ */

const FEATURES = [
  { id: "size", name: "Size", short: "S", color: "#4ecdc4", cls: "size" },
  { id: "loc", name: "Location", short: "L", color: "#8b9cff", cls: "loc" },
  { id: "age", name: "Age", short: "A", color: "#e889a8", cls: "age" }
];
const N = 3;
const NCOAL = 1 << N;
const COPPER = "#e09a5a";
const POS = "#5ec8a8";
const NEG = "#e08a7a";
const INK = "#e8eef8";
const MUTED = "#8b9bb8";
const VOID = "#10182a";
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const ORDERS = permuteAll([0, 1, 2]);

const state = {
  x: [1.1, 0.9, 0.4],
  intercept: 280,
  main: [42, 28, -15],
  pair: [22, 0, -8], // (0,1), (0,2), (1,2)
  dummy: false,
  mask: 0,
  lastMarg: null,
  highlight: null,
  mode: "idle",
  orderIndex: 0,
  orderStep: 0,
  orderFilled: Array(ORDERS.length).fill(false),
  mc: { n: 0, sum: [0, 0, 0], hist: [], antithetic: false, lastOrder: null },
  ksM: 6,
  ksPhi: null,
  ksSample: null,
  houses: [],
  clock: 0,
  start: null
};

const vCache = new Map();

function popcount(x) {
  let c = 0;
  while (x) { x &= x - 1; c++; }
  return c;
}
function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
function choose(n, k) {
  if (k < 0 || k > n) return 0;
  return factorial(n) / (factorial(k) * factorial(n - k));
}
function permuteAll(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of permuteAll(rest)) out.push([arr[i]].concat(p));
  }
  return out;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6d2b79f5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function randn(rng) {
  const u = Math.max(1e-12, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307179586 * v);
}
function fmtCoef(v) {
  return (v < 0 ? "−" : "") + Math.abs(v);
}
function fmtMoney(v) {
  const sign = v < -0.05 ? "−" : "";
  return sign + "$" + Math.abs(v).toFixed(1) + "k";
}
function fmtNum(v, d = 1) {
  const sign = v < 0 ? "−" : "";
  return sign + Math.abs(v).toFixed(d);
}
function fmtInt(v) {
  if (!isFinite(v)) return "∞";
  if (v >= 1e15) return Number(v).toExponential(2).replace("e+", "e");
  if (v >= 1e12) return (v / 1e12).toFixed(2) + "T";
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e4) return (v / 1e3).toFixed(1) + "k";
  return Math.round(v).toLocaleString("en-US");
}
function fmtTime(seconds) {
  if (seconds < 1e-3) return (seconds * 1e6).toFixed(0) + " µs";
  if (seconds < 1) return (seconds * 1e3).toFixed(1) + " ms";
  if (seconds < 60) return seconds.toFixed(2) + " s";
  if (seconds < 3600) return (seconds / 60).toFixed(1) + " min";
  if (seconds < 86400) return (seconds / 3600).toFixed(1) + " h";
  if (seconds < 86400 * 365) return (seconds / 86400).toFixed(1) + " d";
  return (seconds / (86400 * 365)).toFixed(1) + " y";
}

function predict(x) {
  const [a, b, c] = x;
  return state.intercept
    + state.main[0] * a
    + state.main[1] * b
    + state.main[2] * c
    + state.pair[0] * a * b
    + state.pair[1] * a * c
    + state.pair[2] * b * c;
}
function maskedX(mask) {
  return state.x.map((v, i) => (mask & (1 << i) ? v : 0));
}
function v(mask) {
  const key = mask + "|" + state.x.join(",") + "|" + state.main.join(",") + "|" + state.pair.join(",");
  if (vCache.has(key)) return vCache.get(key);
  const val = predict(maskedX(mask));
  vCache.set(key, val);
  if (vCache.size > 400) vCache.clear();
  return val;
}
function allV() {
  const out = new Array(NCOAL);
  for (let s = 0; s < NCOAL; s++) out[s] = v(s);
  return out;
}
function exactShapley() {
  const n = N;
  const nFact = factorial(n);
  const phi = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    for (let S = 0; S < NCOAL; S++) {
      if (S & (1 << i)) continue;
      const s = popcount(S);
      const w = factorial(s) * factorial(n - s - 1) / nFact;
      phi[i] += w * (v(S | (1 << i)) - v(S));
    }
  }
  return phi;
}
function shapleyWithDummy() {
  const phi = exactShapley();
  if (!state.dummy) return phi;
  return phi.concat([0]);
}
function permMarginals(order) {
  const phi = [0, 0, 0];
  let S = 0;
  let prev = v(0);
  for (const i of order) {
    S |= 1 << i;
    const now = v(S);
    phi[i] = now - prev;
    prev = now;
  }
  return phi;
}
function arrivalTable(feature) {
  const rows = [];
  const nFact = factorial(N);
  for (let S = 0; S < NCOAL; S++) {
    if (S & (1 << feature)) continue;
    const s = popcount(S);
    const w = factorial(s) * factorial(N - s - 1) / nFact;
    const marg = v(S | (1 << feature)) - v(S);
    rows.push({ S, w, marg, weighted: w * marg });
  }
  return rows;
}
function kernelWeight(s, n) {
  if (s === 0 || s === n) return 0;
  return (n - 1) / (choose(n, s) * s * (n - s));
}
function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => row.slice().concat([b[i]]));
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    if (piv !== col) { const tmp = M[col]; M[col] = M[piv]; M[piv] = tmp; }
    const d = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= d;
    for (let r = 0; r < n; r++) if (r !== col) {
      const f = M[r][col];
      for (let j = col; j <= n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map((row) => row[n]);
}
function kernelShap(coalitions) {
  const n = N;
  const v0 = v(0);
  const target = v(NCOAL - 1) - v0;
  const X = [];
  const y = [];
  const w = [];
  for (const S of coalitions) {
    const s = popcount(S);
    if (s === 0 || s === n) continue;
    X.push([S & 1 ? 1 : 0, S & 2 ? 1 : 0, S & 4 ? 1 : 0]);
    y.push(v(S) - v0);
    w.push(kernelWeight(s, n));
  }
  const G = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const XWy = [0, 0, 0];
  for (let k = 0; k < X.length; k++) {
    for (let i = 0; i < n; i++) {
      XWy[i] += X[k][i] * w[k] * y[k];
      for (let j = 0; j < n; j++) G[i][j] += X[k][i] * w[k] * X[k][j];
    }
  }
  for (let i = 0; i < n; i++) G[i][i] += 1e-8;
  const A = [
    [G[0][0], G[0][1], G[0][2], 1],
    [G[1][0], G[1][1], G[1][2], 1],
    [G[2][0], G[2][1], G[2][2], 1],
    [1, 1, 1, 0]
  ];
  const b = [XWy[0], XWy[1], XWy[2], target];
  const z = solveLinear(A, b);
  if (!z) return exactShapley();
  return z.slice(0, 3);
}
function interiorCoalitions() {
  const list = [];
  for (let s = 1; s < NCOAL - 1; s++) list.push(s);
  return list;
}
function sampleCoalitions(m, rng) {
  const pool = interiorCoalitions().slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
  }
  return pool.slice(0, m);
}

function selfTest() {
  const saved = { x: state.x.slice(), main: state.main.slice(), pair: state.pair.slice() };
  state.x = [1.1, 0.9, 0.4];
  state.main = [42, 28, -15];
  state.pair = [22, 0, -8];
  vCache.clear();
  const phi = exactShapley();
  const leftover = v(7) - v(0);
  const sum = phi[0] + phi[1] + phi[2];
  if (Math.abs(sum - leftover) > 1e-9) throw new Error("efficiency " + sum + " vs " + leftover);
  const ks = kernelShap(interiorCoalitions());
  for (let i = 0; i < 3; i++) {
    if (Math.abs(ks[i] - phi[i]) > 1e-6) throw new Error("kernel " + i + " " + ks[i] + " vs " + phi[i]);
  }
  const acc = [0, 0, 0];
  for (const order of ORDERS) {
    const m = permMarginals(order);
    for (let i = 0; i < 3; i++) acc[i] += m[i];
  }
  for (let i = 0; i < 3; i++) {
    if (Math.abs(acc[i] / 6 - phi[i]) > 1e-9) throw new Error("orders " + i);
  }
  state.x = saved.x; state.main = saved.main; state.pair = saved.pair;
  vCache.clear();
  return { phi, leftover, ks };
}

/* ----------------------------- canvas 2d ---------------------------- */

function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = Math.max(1, canvas.clientWidth);
  const cssH = Math.max(1, canvas.clientHeight);
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  const bw = Math.round(cssW * dpr);
  const bh = Math.round(cssH * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  return { ctx, w: cssW, h: cssH, dpr };
}
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawLeftover(canvas) {
  const { ctx, w, h } = fitCanvas(canvas);
  const v0 = v(0);
  const vN = v(7);
  const phi = exactShapley();
  const pad = { l: 36, r: 16, t: 18, b: 36 };
  const cols = ["base", 0, 1, 2, "end"];
  const gap = (w - pad.l - pad.r) / cols.length;
  const totals = [v0];
  let run = v0;
  phi.forEach((p) => { run += p; totals.push(run); });
  const minV = Math.min(v0, vN, ...totals) - 8;
  const maxV = Math.max(v0, vN, ...totals) + 8;
  const yOf = (val) => pad.t + (1 - (val - minV) / (maxV - minV)) * (h - pad.t - pad.b);
  const yBase = yOf(minV);

  ctx.strokeStyle = "rgba(140,170,210,0.2)";
  ctx.beginPath();
  ctx.moveTo(pad.l, yOf(v0));
  ctx.lineTo(w - pad.r, yOf(v0));
  ctx.stroke();

  function bar(i, val0, val1, color, label) {
    const x = pad.l + gap * i + gap * 0.18;
    const bw = gap * 0.64;
    const top = yOf(Math.max(val0, val1));
    const bot = yOf(Math.min(val0, val1));
    ctx.fillStyle = color;
    roundRect(ctx, x, top, bw, Math.max(3, bot - top), 4);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = "10px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText(label, x + bw / 2, h - 16);
    ctx.fillStyle = MUTED;
    ctx.fillText(label === "base" || label === "pred" ? fmtMoney(val1) : fmtMoney(val1 - val0), x + bw / 2, h - 4);
    return { x: x + bw / 2, y: yOf(val1), right: x + bw };
  }

  const p0 = bar(0, minV, v0, "#9aa8c0", "base");
  let cursor = v0;
  const pts = [p0];
  for (let i = 0; i < 3; i++) {
    const next = cursor + phi[i];
    const col = phi[i] >= 0 ? FEATURES[i].color : NEG;
    pts.push(bar(i + 1, cursor, next, col, FEATURES[i].short));
    cursor = next;
  }
  pts.push(bar(4, minV, vN, COPPER, "pred"));
  ctx.strokeStyle = "rgba(232,238,248,0.25)";
  ctx.beginPath();
  for (let i = 0; i < pts.length - 1; i++) {
    ctx.moveTo(pts[i].right, pts[i].y);
    ctx.lineTo(pts[i + 1].x - gap * 0.32, pts[i].y);
  }
  ctx.stroke();
  ctx.textAlign = "left";
  void yBase;
}

function drawWaterfall(canvas, order, step) {
  const { ctx, w, h } = fitCanvas(canvas);
  const pad = { l: 44, r: 16, t: 16, b: 36 };
  const v0 = v(0);
  const phiWalk = permMarginals(order);
  const values = [v0];
  let S = 0;
  for (let k = 0; k < order.length; k++) {
    S |= 1 << order[k];
    values.push(v(S));
  }
  const shown = Math.max(1, Math.min(values.length, step + 1));
  const vis = values.slice(0, shown);
  const minV = Math.min(...allV()) - 6;
  const maxV = Math.max(...allV()) + 6;
  const yOf = (val) => pad.t + (1 - (val - minV) / (maxV - minV)) * (h - pad.t - pad.b);
  const gap = (w - pad.l - pad.r) / 4;
  ctx.strokeStyle = "rgba(140,170,210,0.15)";
  ctx.beginPath();
  ctx.moveTo(pad.l, yOf(v0)); ctx.lineTo(w - pad.r, yOf(v0));
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.font = "10px IBM Plex Mono, monospace";
  ctx.fillText("baseline", pad.l, yOf(v0) - 6);

  for (let i = 0; i < vis.length; i++) {
    const x = pad.l + gap * i + gap * 0.2;
    const bw = gap * 0.6;
    if (i === 0) {
      const y = yOf(vis[0]);
      const yBase = yOf(minV);
      ctx.fillStyle = "#9aa8c0";
      roundRect(ctx, x, y, bw, yBase - y, 4);
      ctx.fill();
    } else {
      const prev = vis[i - 1];
      const cur = vis[i];
      const y1 = yOf(Math.max(prev, cur));
      const y2 = yOf(Math.min(prev, cur));
      const feat = order[i - 1];
      ctx.fillStyle = cur >= prev ? FEATURES[feat].color : NEG;
      roundRect(ctx, x, y1, bw, Math.max(2, y2 - y1), 4);
      ctx.fill();
      ctx.strokeStyle = "rgba(232,238,248,0.2)";
      ctx.beginPath();
      ctx.moveTo(pad.l + gap * (i - 1) + gap * 0.8, yOf(prev));
      ctx.lineTo(x, yOf(prev));
      ctx.stroke();
    }
    ctx.fillStyle = INK;
    ctx.font = "10px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    const label = i === 0 ? "∅" : FEATURES[order[i - 1]].short;
    ctx.fillText(label, x + bw / 2, h - 14);
    ctx.fillStyle = MUTED;
    ctx.fillText(fmtMoney(vis[i]), x + bw / 2, h - 2);
    ctx.textAlign = "left";
  }
  void phiWalk;
}

function drawBars(canvas, values, labels, colors, ghost) {
  const { ctx, w, h } = fitCanvas(canvas);
  const pad = { l: 86, r: 56, t: 12, b: 12 };
  const mag = Math.max(8, ...values.map(Math.abs), ...(ghost || []).map((g) => Math.abs(g)));
  const x0 = pad.l + (w - pad.l - pad.r) * (mag / (2 * mag));
  const xOf = (val) => pad.l + (val + mag) / (2 * mag) * (w - pad.l - pad.r);
  const rowH = (h - pad.t - pad.b) / values.length;
  ctx.strokeStyle = "rgba(140,170,210,0.25)";
  ctx.beginPath();
  ctx.moveTo(xOf(0), pad.t);
  ctx.lineTo(xOf(0), h - pad.b);
  ctx.stroke();
  values.forEach((val, i) => {
    const y = pad.t + i * rowH + rowH * 0.22;
    const bh = rowH * 0.5;
    if (ghost) {
      const g = ghost[i];
      const gx0 = xOf(Math.min(0, g));
      const gx1 = xOf(Math.max(0, g));
      ctx.fillStyle = "rgba(232,238,248,0.12)";
      roundRect(ctx, gx0, y - 3, Math.max(2, gx1 - gx0), bh + 6, 4);
      ctx.fill();
    }
    const xA = xOf(Math.min(0, val));
    const xB = xOf(Math.max(0, val));
    ctx.fillStyle = colors[i];
    roundRect(ctx, xA, y, Math.max(2, xB - xA), bh, 4);
    ctx.fill();
    ctx.fillStyle = MUTED;
    ctx.font = "12px Outfit, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(labels[i], pad.l - 10, y + bh * 0.78);
    ctx.textAlign = "left";
    ctx.fillStyle = INK;
    ctx.font = "11px IBM Plex Mono, monospace";
    ctx.fillText(fmtMoney(val), Math.max(xB + 8, xOf(0) + 8), y + bh * 0.78);
  });
}

function drawMC(canvas) {
  const { ctx, w, h } = fitCanvas(canvas);
  const pad = { l: 44, r: 16, t: 16, b: 28 };
  const hist = state.mc.hist;
  const exact = exactShapley();
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const maxN = Math.max(12, hist.length);
  const allY = exact.concat(hist.flatMap((h) => h.mean));
  let lo = Math.min(0, ...allY) - 4;
  let hi = Math.max(0, ...allY) + 4;
  const yOf = (val) => pad.t + (1 - (val - lo) / (hi - lo)) * innerH;
  const xOf = (i) => pad.l + (i / maxN) * innerW;

  ctx.strokeStyle = "rgba(140,170,210,0.12)";
  ctx.beginPath();
  ctx.moveTo(pad.l, yOf(0)); ctx.lineTo(w - pad.r, yOf(0));
  ctx.stroke();

  exact.forEach((val, i) => {
    ctx.strokeStyle = FEATURES[i].color;
    ctx.globalAlpha = 0.35;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.l, yOf(val));
    ctx.lineTo(w - pad.r, yOf(val));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  });

  if (hist.length) {
    for (let f = 0; f < 3; f++) {
      ctx.strokeStyle = FEATURES[f].color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      hist.forEach((row, i) => {
        const x = xOf(i + 1);
        const y = yOf(row.mean[f]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }
  ctx.fillStyle = MUTED;
  ctx.font = "10px IBM Plex Mono, monospace";
  ctx.fillText("orders →", w - pad.r - 54, h - 8);
  ctx.fillText("running mean φ vs exact (dashed)", pad.l, h - 8);
}

function drawKernelWeights(canvas) {
  const { ctx, w, h } = fitCanvas(canvas);
  const pad = { l: 36, r: 16, t: 18, b: 32 };
  const nShow = 10;
  const sizes = [];
  for (let s = 0; s <= nShow; s++) sizes.push(s === 0 || s === nShow ? 0 : kernelWeight(s, nShow));
  const maxW = Math.max(...sizes);
  const bw = (w - pad.l - pad.r) / sizes.length;
  sizes.forEach((wt, s) => {
    const bh = (h - pad.t - pad.b) * (wt / maxW);
    const x = pad.l + s * bw + 4;
    ctx.fillStyle = s === 1 || s === nShow - 1 ? COPPER : "#4ecdc4";
    roundRect(ctx, x, h - pad.b - bh, bw - 8, Math.max(1, bh), 3);
    ctx.fill();
    ctx.fillStyle = MUTED;
    ctx.font = "10px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(s), x + (bw - 8) / 2, h - 12);
  });
  ctx.textAlign = "left";
  ctx.fillText("team size |S|  (n = 10, empty/full omitted)", pad.l, 12);
}

function drawBeeswarm(canvas) {
  const { ctx, w, h } = fitCanvas(canvas);
  const pad = { l: 86, r: 20, t: 12, b: 28 };
  const houses = state.houses;
  if (!houses.length) return;
  const xs = houses.flatMap((hh) => hh.phi);
  const mag = Math.max(8, ...xs.map(Math.abs));
  const xOf = (val) => pad.l + (val + mag) / (2 * mag) * (w - pad.l - pad.r);
  const rowH = (h - pad.t - pad.b) / 3;
  ctx.strokeStyle = "rgba(140,170,210,0.25)";
  ctx.beginPath();
  ctx.moveTo(xOf(0), pad.t);
  ctx.lineTo(xOf(0), h - pad.b);
  ctx.stroke();
  for (let f = 0; f < 3; f++) {
    const yMid = pad.t + f * rowH + rowH / 2;
    const bins = {};
    houses.forEach((hh) => {
      const x = xOf(hh.phi[f]);
      const key = Math.round(x / 4);
      bins[key] = (bins[key] || 0) + 1;
      const jitter = ((bins[key] % 2 === 0 ? 1 : -1) * Math.floor(bins[key] / 2)) * 3.2;
      const t = (hh.x[f] + 2.2) / 4.4;
      const col = lerpColor(FEATURES[f].color, "#f4f1ea", Math.min(1, Math.max(0, t)));
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, yMid + jitter, 3.1, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = MUTED;
    ctx.font = "12px Outfit, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(FEATURES[f].name, pad.l - 10, yMid + 4);
  }
  ctx.textAlign = "center";
  ctx.font = "10px IBM Plex Mono, monospace";
  ctx.fillStyle = MUTED;
  ctx.fillText("← subtracts from price     Shapley value for this house     adds to price →", w / 2, h - 8);
  ctx.textAlign = "left";
}

function drawExplode(canvas) {
  const { ctx, w, h } = fitCanvas(canvas);
  const pad = { l: 44, r: 16, t: 16, b: 28 };
  const nMax = 16;
  const nCur = Number(document.getElementById("nfeat").value);
  const xs = [];
  for (let n = 2; n <= nMax; n++) {
    xs.push({ n, coal: 2 ** n, perm: factorial(n) });
  }
  const maxY = Math.log10(factorial(nMax));
  const xOf = (n) => pad.l + (n - 2) / (nMax - 2) * (w - pad.l - pad.r);
  const yOf = (val) => pad.t + (1 - Math.log10(Math.max(1, val)) / maxY) * (h - pad.t - pad.b);
  function strokeSeries(key, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    xs.forEach((row, i) => {
      const x = xOf(row.n);
      const y = yOf(row[key]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  strokeSeries("perm", "#4ecdc4");
  strokeSeries("coal", COPPER);
  const xc = xOf(nCur);
  ctx.strokeStyle = "rgba(232,238,248,0.35)";
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(xc, pad.t);
  ctx.lineTo(xc, h - pad.b);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = MUTED;
  ctx.font = "10px IBM Plex Mono, monospace";
  ctx.fillText("n features →  (log scale)", pad.l, h - 8);
  ctx.fillStyle = COPPER;
  ctx.fillText("2ⁿ coalitions", w - pad.r - 110, pad.t + 10);
  ctx.fillStyle = "#4ecdc4";
  ctx.fillText("n! orders", w - pad.r - 110, pad.t + 24);
}

function lerpColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = pa >> 16, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = pb >> 16, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return "rgb(" + r + "," + g + "," + bl + ")";
}

function generateHouses() {
  const rng = mulberry32(20260812);
  const saved = { x: state.x.slice() };
  const houses = [];
  for (let i = 0; i < 40; i++) {
    const size = randn(rng) * 0.85;
    const loc = 0.55 * size + 0.83 * randn(rng) * 0.85;
    const age = randn(rng) * 0.9;
    state.x = [size, loc, age];
    vCache.clear();
    houses.push({ x: state.x.slice(), phi: exactShapley() });
  }
  state.x = saved.x;
  vCache.clear();
  state.houses = houses;
}

/* ----------------------------- DOM --------------------------------- */

const els = {};
function bindEls() {
  [
    "x0", "x1", "x2", "i01", "x0-val", "x1-val", "x2-val", "i01-val",
    "v-empty", "v-full", "leftover-val", "f-line",
    "leftover-chart", "coalition-chips", "v-now", "v-delta", "v-marg",
    "order-buttons", "ord-step", "ord-reset", "ord-all", "order-waterfall", "order-table", "order-cap",
    "size-edges", "shap-bars", "shap-cap", "phi-sum", "dummy-on", "dummy-bars",
    "nfeat", "nfeat-val", "n-coal", "n-perm", "n-time", "explode-chart",
    "mc-1", "mc-20", "mc-100", "mc-anti", "mc-reset", "mc-n", "mc-err", "mc-eff", "mc-chart",
    "kernel-weights", "ks-m", "ks-m-val", "ks-refit", "ks-chart", "ks-cap",
    "bee-chart", "quiz", "stage", "stage-gl", "stage-fallback", "stage-mode", "stage-readout",
    "stage-chips", "stage-hint", "progress"
  ].forEach((id) => { els[id] = document.getElementById(id); });
}

function coalitionName(mask) {
  if (mask === 0) return "∅";
  return FEATURES.filter((_, i) => mask & (1 << i)).map((f) => f.short).join("+");
}

function setMask(mask, fromToggle) {
  if (fromToggle != null) {
    const before = v(state.mask);
    state.mask = mask;
    state.lastMarg = v(mask) - before;
  } else {
    state.mask = mask;
  }
  syncChips();
  refresh();
}

function syncChips() {
  document.querySelectorAll("[data-bit]").forEach((btn) => {
    const bit = Number(btn.dataset.bit);
    btn.setAttribute("aria-pressed", (state.mask & (1 << bit)) ? "true" : "false");
  });
}

function buildChips() {
  function make(host, withToggle) {
    host.innerHTML = "";
    FEATURES.forEach((f, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip " + f.cls;
      b.dataset.bit = String(i);
      b.textContent = f.name;
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => {
        if (withToggle) {
          const next = state.mask ^ (1 << i);
          setMask(next, i);
        } else {
          state.highlight = state.highlight === i ? null : i;
          buildStageChips();
          refresh();
          lattice.needsLabel = true;
        }
      });
      host.appendChild(b);
    });
  }
  make(els["coalition-chips"], true);
  buildStageChips();
}
function buildStageChips() {
  const host = els["stage-chips"];
  host.innerHTML = "";
  FEATURES.forEach((f, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip " + f.cls;
    b.textContent = "edges of " + f.name;
    b.setAttribute("aria-pressed", state.highlight === i ? "true" : "false");
    b.addEventListener("click", () => {
      state.highlight = state.highlight === i ? null : i;
      buildStageChips();
      refresh();
      lattice.needsLabel = true;
    });
    host.appendChild(b);
  });
}

function buildOrderButtons() {
  els["order-buttons"].innerHTML = "";
  ORDERS.forEach((order, idx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.textContent = order.map((i) => FEATURES[i].short).join(" → ");
    b.addEventListener("click", () => {
      state.orderIndex = idx;
      state.orderStep = 0;
      state.mask = 0;
      lattice.playOrder(order);
      refresh();
    });
    els["order-buttons"].appendChild(b);
  });
}

function fillOrderTable() {
  const tbl = els["order-table"];
  tbl.innerHTML = "";
  const head = document.createElement("tr");
  ["order", ...FEATURES.map((f) => f.name), "sum"].forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    head.appendChild(th);
  });
  tbl.appendChild(head);
  const acc = [0, 0, 0];
  let filled = 0;
  ORDERS.forEach((order, idx) => {
    const tr = document.createElement("tr");
    if (idx === state.orderIndex) tr.className = "current";
    const name = document.createElement("td");
    name.textContent = order.map((i) => FEATURES[i].short).join(" → ");
    tr.appendChild(name);
    if (state.orderFilled[idx]) {
      const m = permMarginals(order);
      filled++;
      m.forEach((val, i) => {
        acc[i] += val;
        const td = document.createElement("td");
        td.textContent = fmtNum(val, 1);
        tr.appendChild(td);
      });
      const sum = document.createElement("td");
      sum.textContent = fmtNum(m[0] + m[1] + m[2], 1);
      tr.appendChild(sum);
    } else {
      for (let i = 0; i < 4; i++) {
        const td = document.createElement("td");
        td.textContent = "·";
        tr.appendChild(td);
      }
    }
    tbl.appendChild(tr);
  });
  if (filled) {
    const tr = document.createElement("tr");
    const td0 = document.createElement("td");
    td0.textContent = "average" + (filled === 6 ? " = Shapley" : " so far");
    tr.appendChild(td0);
    for (let i = 0; i < 3; i++) {
      const td = document.createElement("td");
      td.className = "hl";
      td.textContent = fmtNum(acc[i] / filled, 2);
      tr.appendChild(td);
    }
    const tdS = document.createElement("td");
    tdS.textContent = fmtNum((acc[0] + acc[1] + acc[2]) / filled, 2);
    tr.appendChild(tdS);
    tbl.appendChild(tr);
  }
}

function fillSizeEdges() {
  const feat = state.highlight == null ? 0 : state.highlight;
  const rows = arrivalTable(feat);
  const tbl = els["size-edges"];
  tbl.innerHTML = "";
  const head = document.createElement("tr");
  ["team before " + FEATURES[feat].name, "weight", "marginal", "weighted"].forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    head.appendChild(th);
  });
  tbl.appendChild(head);
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    [coalitionName(row.S), row.w.toFixed(3), fmtNum(row.marg, 2), fmtNum(row.weighted, 2)].forEach((t, i) => {
      const td = document.createElement("td");
      td.textContent = t;
      if (i === 0) td.style.textAlign = "left";
      tr.appendChild(td);
    });
    tbl.appendChild(tr);
  });
  const tr = document.createElement("tr");
  const td0 = document.createElement("td");
  td0.textContent = "φ (" + FEATURES[feat].name + ")";
  tr.appendChild(td0);
  tr.appendChild(document.createElement("td"));
  tr.appendChild(document.createElement("td"));
  const td = document.createElement("td");
  td.className = "hl";
  td.textContent = fmtNum(rows.reduce((a, r) => a + r.weighted, 0), 2);
  tr.appendChild(td);
  tbl.appendChild(tr);
}

function updateExplosion() {
  const n = Number(els.nfeat.value);
  els["nfeat-val"].textContent = String(n);
  const coal = 2 ** n;
  const perm = factorial(n);
  els["n-coal"].textContent = fmtInt(coal);
  els["n-perm"].textContent = fmtInt(perm);
  els["n-time"].textContent = fmtTime(coal / 1e5);
  drawExplode(els["explode-chart"]);
}

function mcDraw(k) {
  const rng = Math.random;
  for (let i = 0; i < k; i++) {
    const order = permuteAll([0, 1, 2])[Math.floor(rng() * 6)];
    const m = permMarginals(order);
    let add = [m];
    if (state.mc.antithetic) add.push(permMarginals(order.slice().reverse()));
    add.forEach((marg) => {
      state.mc.n += 1;
      for (let f = 0; f < 3; f++) state.mc.sum[f] += marg[f];
      state.mc.hist.push({
        mean: state.mc.sum.map((s) => s / state.mc.n)
      });
    });
    state.mc.lastOrder = order;
    lattice.flashOrder(order);
  }
  if (state.mc.hist.length > 400) state.mc.hist = state.mc.hist.slice(-400);
  refresh();
}

function refitKernel() {
  const m = Number(els["ks-m"].value);
  state.ksM = m;
  const rng = mulberry32((Math.random() * 1e9) | 0);
  state.ksSample = sampleCoalitions(m, rng);
  state.ksPhi = kernelShap(state.ksSample);
  refresh();
}

function buildQuiz() {
  const items = [
    {
      q: "You drop Location from this house and the price falls by $35k. Why is that not Location’s Shapley value?",
      options: [
        "Because $35k is one marginal contribution — Location arriving last — not the average over every team it could join.",
        "Because Shapley values are always percentages, never dollars.",
        "Because you must standardize features before dropping them.",
        "Because efficiency forbids any single-feature ablation."
      ],
      good: 0,
      why: "Ablating one feature measures v(N) − v(N \\ {i}), the last-in gift. Shapley averages that gift with the first-in gift and every in-between team. Those numbers differ when features interact."
    },
    {
      q: "The three Shapley values on this page add up to prediction minus baseline. What does that guarantee?",
      options: [
        "That the model is linear.",
        "That the leftover pie is fully allocated — no credit invented or discarded.",
        "That the features are independent in the data.",
        "That the sampling estimate has converged."
      ],
      good: 1,
      why: "Efficiency is an accounting identity of the definition (and of KernelSHAP’s constraint). It does not say the model is linear, the features are independent, or that a Monte Carlo estimate is tight."
    },
    {
      q: "A 40-feature gradient-boosted model needs Shapley values at scoring time. Why not enumerate?",
      options: [
        "Because Shapley is undefined for more than ten features.",
        "Because 2⁴⁰ coalitions cannot be evaluated; we sample orders or coalitions, or use TreeSHAP’s tree structure.",
        "Because boosting already is a Shapley estimator.",
        "Because negative values would cancel in the sum."
      ],
      good: 1,
      why: "The definition is fine for any n. The wall is computational. Permutation sampling, KernelSHAP, and TreeSHAP are three ways to approximate or compute the same average without listing the power set."
    },
    {
      q: "Age’s Shapley value is negative for this house. What does that literally mean?",
      options: [
        "The feature should be removed from the training set.",
        "On average over join-orders, setting Age to this house’s value (instead of the baseline) lowered the model’s price.",
        "Age is not statistically significant.",
        "The estimator failed the dummy axiom."
      ],
      good: 1,
      why: "Sign is the sign of the average marginal. A negative φ says this house’s Age pulled the prediction down from the baseline, not that Age is a useless column."
    }
  ];
  const host = els.quiz;
  host.innerHTML = "";
  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "q";
    const p = document.createElement("p");
    p.textContent = item.q;
    div.appendChild(p);
    item.options.forEach((opt, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = opt;
      b.addEventListener("click", () => {
        if (div.classList.contains("open")) return;
        div.classList.add("open");
        [...div.querySelectorAll("button")].forEach((btn, j) => {
          if (j === item.good) btn.classList.add("good");
          else if (j === i) btn.classList.add("bad");
        });
      });
      div.appendChild(b);
    });
    const why = document.createElement("p");
    why.className = "why";
    why.textContent = item.why;
    div.appendChild(why);
    host.appendChild(div);
  });
}

function refresh() {
  vCache.clear();
  const v0 = v(0);
  const vN = v(7);
  const phi = exactShapley();
  const leftover = vN - v0;

  els["v-empty"].textContent = fmtMoney(v0);
  els["v-full"].textContent = fmtMoney(vN);
  els["leftover-val"].textContent = fmtMoney(leftover);
  els["f-line"].innerHTML = "price = " + state.intercept
    + " <span class=\"c-size\">" + (state.main[0] >= 0 ? "+ " : "− ") + Math.abs(state.main[0]) + "·Size</span>"
    + " <span class=\"c-loc\">" + (state.main[1] >= 0 ? "+ " : "− ") + Math.abs(state.main[1]) + "·Location</span>"
    + " <span class=\"c-age\">" + (state.main[2] >= 0 ? "+ " : "− ") + Math.abs(state.main[2]) + "·Age</span>"
    + " <span class=\"c-copper\">" + (state.pair[0] >= 0 ? "+ " : "− ") + Math.abs(state.pair[0]) + "·Size·Location</span>"
    + " " + (state.pair[2] >= 0 ? "+ " : "− ") + Math.abs(state.pair[2]) + "·Location·Age";
  els["x0-val"].textContent = Number(state.x[0]).toFixed(2);
  els["x1-val"].textContent = Number(state.x[1]).toFixed(2);
  els["x2-val"].textContent = Number(state.x[2]).toFixed(2);
  els["i01-val"].textContent = String(state.pair[0]);

  const now = v(state.mask);
  els["v-now"].textContent = fmtMoney(now);
  const d = now - v0;
  els["v-delta"].textContent = (d > 0.05 ? "+" : "") + fmtMoney(d);
  els["v-marg"].textContent = state.lastMarg == null ? "—" : fmtMoney(state.lastMarg);

  drawLeftover(els["leftover-chart"]);
  drawWaterfall(els["order-waterfall"], ORDERS[state.orderIndex], state.orderStep);
  fillOrderTable();
  fillSizeEdges();
  drawBars(els["shap-bars"], phi, FEATURES.map((f) => f.name), FEATURES.map((f) => f.color));
  els["shap-cap"].textContent = FEATURES.map((f, i) => f.name + " " + fmtMoney(phi[i])).join("  ·  ")
    + "  →  sum " + fmtMoney(phi[0] + phi[1] + phi[2]) + "  vs leftover " + fmtMoney(leftover) + ".";
  els["phi-sum"].textContent = FEATURES.map((f, i) => "φ_" + f.short + " " + fmtMoney(phi[i])).join(" + ")
    + " = " + fmtMoney(leftover);

  const dummyVals = state.dummy ? phi.concat([0]) : phi;
  const dummyLabs = state.dummy ? FEATURES.map((f) => f.name).concat(["Dummy"]) : FEATURES.map((f) => f.name);
  const dummyCol = state.dummy ? FEATURES.map((f) => f.color).concat(["#9aa8c0"]) : FEATURES.map((f) => f.color);
  drawBars(els["dummy-bars"], dummyVals, dummyLabs, dummyCol);

  const mean = state.mc.n ? state.mc.sum.map((s) => s / state.mc.n) : [0, 0, 0];
  els["mc-n"].textContent = String(state.mc.n);
  if (state.mc.n) {
    const err = Math.max(...phi.map((p, i) => Math.abs(p - mean[i])));
    els["mc-err"].textContent = fmtMoney(err);
    const eff = mean[0] + mean[1] + mean[2];
    els["mc-eff"].textContent = fmtMoney(eff) + " / " + fmtMoney(leftover);
  } else {
    els["mc-err"].textContent = "—";
    els["mc-eff"].textContent = "—";
  }
  drawMC(els["mc-chart"]);

  els["ks-m-val"].textContent = String(state.ksM);
  if (!state.ksPhi) state.ksPhi = kernelShap(interiorCoalitions());
  drawKernelWeights(els["kernel-weights"]);
  drawBars(els["ks-chart"], state.ksPhi, FEATURES.map((f) => f.name), FEATURES.map((f) => f.color), phi);
  const ksErr = Math.max(...phi.map((p, i) => Math.abs(p - state.ksPhi[i])));
  els["ks-cap"].textContent = "Sample of " + (state.ksSample ? state.ksSample.length : 6)
    + " interior coalitions. Max |φ̂ − φ| = " + fmtNum(ksErr, 2) + "k. Ghost bars are exact Shapley.";

  drawBeeswarm(els["bee-chart"]);
  updateExplosion();
  updateStageCopy();
  lattice.sync();
}

function updateStageCopy() {
  const modes = {
    idle: ["Coalition lattice", "Eight teams. Empty corner is the baseline; the opposite corner is this house. Vertex brightness is v(S)."],
    coalition: ["Toggle a team", "Each vertex is v(S). An edge is one feature arriving. The chips below highlight that feature’s four possible arrivals."],
    order: ["A join-order is a path", "Empty → full in three edges. The gift at each edge is that feature’s credit for this walk only."],
    shapley: ["Average every arrival", "Highlight a feature to see its four edges. The Shapley value is the weighted average of those four gifts."],
    sample: ["Monte Carlo walks", "Random paths accumulate. The running mean of arrival gifts converges to Shapley."],
    kernel: ["Kernel weights on teams", "Near-empty and near-full vertices matter most to the regression. Middling teams shrink."]
  };
  const pair = modes[state.mode] || modes.idle;
  els["stage-mode"].textContent = pair[0];
  let extra = pair[1];
  if (state.highlight != null) {
    extra += " Highlighting " + FEATURES[state.highlight].name + ".";
  }
  extra += "  v(" + coalitionName(state.mask) + ") = " + fmtMoney(v(state.mask)) + ".";
  els["stage-readout"].textContent = extra;
}

/* ----------------------------- lattice ----------------------------- */

const skyVert = [
  "varying vec3 vPos;",
  "void main() {",
  "  vPos = position;",
  "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
  "}"
].join("\n");
const skyFrag = [
  "precision highp float;",
  "varying vec3 vPos;",
  "uniform float uTime;",
  "float hash(vec3 p) {",
  "  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));",
  "  p *= 17.0;",
  "  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));",
  "}",
  "float noise(vec3 p) {",
  "  vec3 i = floor(p);",
  "  vec3 f = fract(p);",
  "  f = f * f * (3.0 - 2.0 * f);",
  "  float n000 = hash(i);",
  "  float n100 = hash(i + vec3(1.0, 0.0, 0.0));",
  "  float n010 = hash(i + vec3(0.0, 1.0, 0.0));",
  "  float n110 = hash(i + vec3(1.0, 1.0, 0.0));",
  "  float n001 = hash(i + vec3(0.0, 0.0, 1.0));",
  "  float n101 = hash(i + vec3(1.0, 0.0, 1.0));",
  "  float n011 = hash(i + vec3(0.0, 1.0, 1.0));",
  "  float n111 = hash(i + vec3(1.0, 1.0, 1.0));",
  "  float nx00 = mix(n000, n100, f.x);",
  "  float nx10 = mix(n010, n110, f.x);",
  "  float nx01 = mix(n001, n101, f.x);",
  "  float nx11 = mix(n011, n111, f.x);",
  "  float nxy0 = mix(nx00, nx10, f.y);",
  "  float nxy1 = mix(nx01, nx11, f.y);",
  "  return mix(nxy0, nxy1, f.z);",
  "}",
  "float fbm(vec3 p) {",
  "  float a = 0.5;",
  "  float s = 0.0;",
  "  for (int i = 0; i < 5; i++) {",
  "    s += a * noise(p);",
  "    p = p * 2.03 + 13.1;",
  "    a *= 0.55;",
  "  }",
  "  return s;",
  "}",
  "void main() {",
  "  vec3 dir = normalize(vPos);",
  "  float field = fbm(dir * 3.2 + vec3(uTime * 0.03, -uTime * 0.02, 0.4));",
  "  vec3 base = mix(vec3(0.055, 0.08, 0.14), vec3(0.10, 0.16, 0.28), field);",
  "  float vein = smoothstep(0.55, 0.72, field);",
  "  base += vec3(0.35, 0.20, 0.10) * vein * 0.18;",
  "  float pole = pow(abs(dir.y), 3.0);",
  "  base += vec3(0.12, 0.22, 0.28) * pole * 0.12;",
  "  gl_FragColor = vec4(base, 1.0);",
  "}"
].join("\n");

const orbVert = [
  "varying vec3 vN;",
  "varying vec3 vV;",
  "void main() {",
  "  vec4 w = modelViewMatrix * vec4(position, 1.0);",
  "  vN = normalize(normalMatrix * normal);",
  "  vV = normalize(-w.xyz);",
  "  gl_Position = projectionMatrix * w;",
  "}"
].join("\n");
const orbFrag = [
  "precision highp float;",
  "uniform vec3 uColor;",
  "uniform float uGlow;",
  "varying vec3 vN;",
  "varying vec3 vV;",
  "void main() {",
  "  float fres = pow(1.0 - abs(dot(vN, vV)), 2.0);",
  "  vec3 col = uColor * (0.45 + 1.25 * fres) * uGlow;",
  "  gl_FragColor = vec4(col, 1.0);",
  "}"
].join("\n");

const edgeVert = [
  "varying float vAlong;",
  "varying vec3 vN;",
  "varying vec3 vV;",
  "void main() {",
  "  vAlong = uv.y;",
  "  vec4 w = modelViewMatrix * vec4(position, 1.0);",
  "  vN = normalize(normalMatrix * normal);",
  "  vV = normalize(-w.xyz);",
  "  gl_Position = projectionMatrix * w;",
  "}"
].join("\n");
const edgeFrag = [
  "precision highp float;",
  "uniform vec3 uColor;",
  "uniform float uTime;",
  "uniform float uActive;",
  "varying float vAlong;",
  "varying vec3 vN;",
  "varying vec3 vV;",
  "void main() {",
  "  float fres = pow(abs(dot(vN, vV)), 1.4);",
  "  float pulse = smoothstep(0.0, 0.12, fract(vAlong * 2.5 - uTime * 0.28));",
  "  pulse *= 1.0 - smoothstep(0.12, 0.38, fract(vAlong * 2.5 - uTime * 0.28));",
  "  float a = 0.18 + 0.55 * pulse * uActive + 0.12 * fres;",
  "  vec3 col = uColor * (0.6 + 0.8 * uActive);",
  "  gl_FragColor = vec4(col, a);",
  "}"
].join("\n");

const moteVert = [
  "attribute float aSeed;",
  "uniform float uTime;",
  "uniform float uSize;",
  "varying float vA;",
  "void main() {",
  "  float t = fract(uTime * 0.04 + aSeed);",
  "  vec3 p = position + vec3(",
  "    sin(uTime * 0.21 + aSeed * 6.28) * 0.15,",
  "    t * 2.8 - 1.4,",
  "    cos(uTime * 0.17 + aSeed * 4.1) * 0.15",
  "  );",
  "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
  "  gl_Position = projectionMatrix * mv;",
  "  float dist = max(0.4, length(mv.xyz));",
  "  gl_PointSize = clamp(uSize * (2.4 / dist), 1.0, 16.0);",
  "  vA = 0.12 + 0.22 * (1.0 - abs(t * 2.0 - 1.0));",
  "}"
].join("\n");
const moteFrag = [
  "precision highp float;",
  "varying float vA;",
  "void main() {",
  "  vec2 p = gl_PointCoord * 2.0 - 1.0;",
  "  float d = dot(p, p);",
  "  if (d > 1.0) discard;",
  "  float a = vA * (1.0 - d);",
  "  gl_FragColor = vec4(vec3(0.78, 0.58, 0.36) * a, a);",
  "}"
].join("\n");

function maskToPos(mask, scale) {
  const s = scale || 1.15;
  return {
    x: (mask & 1 ? 1 : -1) * s,
    y: (mask & 2 ? 1 : -1) * s,
    z: (mask & 4 ? 1 : -1) * s
  };
}

function makeLabelTexture(THREE, text, color) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 256, 128);
  ctx.font = "600 44px Outfit, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(16,24,42,0.55)";
  roundRect(ctx, 28, 36, 200, 56, 16);
  ctx.fill();
  ctx.fillStyle = color || "#e8eef8";
  ctx.fillText(text, 128, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const lattice = {
  ready: false,
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  orbs: [],
  edges: [],
  labels: [],
  skyMat: null,
  moteMat: null,
  raycaster: null,
  pointer: { x: 0, y: 0 },
  anim: { playing: false, order: [0, 1, 2], t: 0, flash: 0 },
  needsLabel: true,
  fallback: false,
  disposeList: [],

  init(THREE, OrbitControls) {
    this.THREE = THREE;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    const canvas = els["stage-gl"];
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance"
      });
    } catch (err) {
      this.useFallback();
      return;
    }
    const gl = renderer.getContext();
    if (!gl) { this.useFallback(); return; }

    this.renderer = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x10182a, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
    this.camera.position.set(3.6, 2.5, 4.4);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.minDistance = 3.2;
    this.controls.maxDistance = 8;
    this.controls.autoRotate = !reducedMotion;
    this.controls.autoRotateSpeed = 0.55;
    this.controls.target.set(0, 0, 0);
    canvas.addEventListener("pointerdown", () => { this.controls.autoRotate = false; });

    const skyMat = new THREE.ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      uniforms: { uTime: { value: 0 } },
      side: THREE.BackSide,
      depthWrite: false
    });
    this.skyMat = skyMat;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(14, 32, 24), skyMat);
    sky.renderOrder = -3;
    sky.frustumCulled = false;
    this.scene.add(sky);
    this.disposeList.push(sky.geometry, skyMat);

    const hemi = new THREE.HemisphereLight(0xb8c8e8, 0x1a1420, 0.55);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffe0c0, 0.85);
    key.position.set(4, 6, 3);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x88a0ff, 0.25);
    fill.position.set(-5, -2, -3);
    this.scene.add(fill);

    const orbGeo = new THREE.SphereGeometry(0.13, 28, 20);
    this.disposeList.push(orbGeo);
    for (let mask = 0; mask < NCOAL; mask++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: orbVert,
        fragmentShader: orbFrag,
        uniforms: {
          uColor: { value: new THREE.Color("#4ecdc4") },
          uGlow: { value: 1 }
        }
      });
      const mesh = new THREE.Mesh(orbGeo, mat);
      const p = maskToPos(mask);
      mesh.position.set(p.x, p.y, p.z);
      mesh.userData.mask = mask;
      this.scene.add(mesh);
      this.orbs.push(mesh);
      this.disposeList.push(mat);

      const spriteMat = new THREE.SpriteMaterial({
        map: makeLabelTexture(THREE, coalitionName(mask)),
        transparent: true,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(p.x * 1.18, p.y * 1.18, p.z * 1.18);
      sprite.scale.set(0.72, 0.36, 1);
      this.scene.add(sprite);
      this.labels.push(sprite);
      this.disposeList.push(spriteMat, spriteMat.map);
    }

    const edgeGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 10, 1, true);
    this.disposeList.push(edgeGeo);
    for (let a = 0; a < NCOAL; a++) {
      for (let b = a + 1; b < NCOAL; b++) {
        if (popcount(a ^ b) !== 1) continue;
        const bit = Math.log2(a ^ b);
        const mat = new THREE.ShaderMaterial({
          vertexShader: edgeVert,
          fragmentShader: edgeFrag,
          uniforms: {
            uColor: { value: new THREE.Color(FEATURES[bit].color) },
            uTime: { value: 0 },
            uActive: { value: 0.25 }
          },
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(edgeGeo, mat);
        placeCylinder(THREE, mesh, maskToPos(a), maskToPos(b));
        mesh.userData = { a, b, bit };
        this.scene.add(mesh);
        this.edges.push(mesh);
        this.disposeList.push(mat);
      }
    }

    const moteCount = 90;
    const motePos = new Float32Array(moteCount * 3);
    const moteSeed = new Float32Array(moteCount);
    for (let i = 0; i < moteCount; i++) {
      motePos[i * 3] = (Math.random() - 0.5) * 5;
      motePos[i * 3 + 1] = (Math.random() - 0.5) * 3;
      motePos[i * 3 + 2] = (Math.random() - 0.5) * 5;
      moteSeed[i] = Math.random();
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
    moteGeo.setAttribute("aSeed", new THREE.BufferAttribute(moteSeed, 1));
    this.moteMat = new THREE.ShaderMaterial({
      vertexShader: moteVert,
      fragmentShader: moteFrag,
      uniforms: { uTime: { value: 0 }, uSize: { value: 7 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    const motes = new THREE.Points(moteGeo, this.moteMat);
    motes.frustumCulled = false;
    this.scene.add(motes);
    this.disposeList.push(moteGeo, this.moteMat);

    canvas.addEventListener("pointerdown", (ev) => this.onPointer(ev));
    this.resize();
    this.ready = true;
    this.sync();
  },

  useFallback() {
    this.fallback = true;
    els["stage-gl"].hidden = true;
    els["stage-fallback"].hidden = false;
    els.stage.classList.add("shader-off");
    els["stage-hint"].textContent = "click a vertex";
    els["stage-fallback"].addEventListener("pointerdown", (ev) => this.onFallbackClick(ev));
  },

  resize() {
    const host = els.stage;
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    if (this.fallback) {
      const c = els["stage-fallback"];
      c.style.width = w + "px";
      c.style.height = h + "px";
      return;
    }
    if (!this.renderer) return;
    this.renderer.setSize(w, h, false);
    els["stage-gl"].style.width = w + "px";
    els["stage-gl"].style.height = h + "px";
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  },

  onPointer(ev) {
    if (!this.ready) return;
    const rect = els["stage-gl"].getBoundingClientRect();
    this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.orbs, false);
    if (hits.length) {
      setMask(hits[0].object.userData.mask);
    }
  },

  onFallbackClick(ev) {
    const pts = fallbackPoints(els["stage-fallback"]);
    const rect = els["stage-fallback"].getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    let best = -1, bestD = 28;
    pts.forEach((p, mask) => {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) { bestD = d; best = mask; }
    });
    if (best >= 0) setMask(best);
  },

  playOrder(order) {
    this.anim.playing = true;
    this.anim.order = order.slice();
    this.anim.t = 0;
    this.anim.flash = 1;
    state.mask = 0;
    state.orderStep = 0;
  },
  flashOrder(order) {
    this.anim.order = order.slice();
    this.anim.flash = 1;
  },

  sync() {
    if (this.fallback) { drawFallback(); return; }
    if (!this.ready) return;
    const THREE = this.THREE;
    const vals = allV();
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const phi = exactShapley();
    this.orbs.forEach((mesh) => {
      const mask = mesh.userData.mask;
      const t = (vals[mask] - lo) / Math.max(1e-6, hi - lo);
      const selected = mask === state.mask;
      const col = new THREE.Color().setHSL(0.12 + 0.28 * t, 0.55, 0.42 + 0.22 * t);
      if (mask === 0) col.set("#9aa8c0");
      if (mask === 7) col.set(COPPER);
      mesh.material.uniforms.uColor.value.copy(col);
      mesh.material.uniforms.uGlow.value = selected ? 1.45 : 0.85 + 0.4 * t;
      const s = selected ? 1.35 : 1;
      mesh.scale.setScalar(s);
    });
    if (this.needsLabel) {
      this.labels.forEach((sprite, mask) => {
        const map = makeLabelTexture(this.THREE, coalitionName(mask), mask === state.mask ? COPPER : "#e8eef8");
        const old = sprite.material.map;
        sprite.material.map = map;
        sprite.material.needsUpdate = true;
        if (old) old.dispose();
      });
      this.needsLabel = false;
    }
    this.edges.forEach((mesh) => {
      const { a, b, bit } = mesh.userData;
      let active = 0.22;
      if (state.highlight === bit) active = 1;
      if (state.mode === "kernel") {
        const sa = popcount(a), sb = popcount(b);
        const w = kernelWeight(Math.max(sa, sb), N);
        active = 0.15 + 0.85 * Math.min(1, w / 1.2);
      }
      if (this.anim.flash > 0) {
        const order = this.anim.order;
        let S = 0;
        for (const i of order) {
          const nS = S | (1 << i);
          if ((a === S && b === nS) || (b === S && a === nS)) active = 1;
          S = nS;
        }
      }
      mesh.material.uniforms.uActive.value = active;
      const featCol = new THREE.Color(FEATURES[bit].color);
      if (phi[bit] < 0) featCol.lerp(new THREE.Color(NEG), 0.45);
      mesh.material.uniforms.uColor.value.copy(featCol);
    });
  },

  advance(dt) {
    if (this.anim.playing) {
      this.anim.t += dt * (reducedMotion ? 2.4 : 0.85);
      const step = Math.min(3, Math.floor(this.anim.t));
      let S = 0;
      for (let k = 0; k < step; k++) S |= 1 << this.anim.order[k];
      if (S !== state.mask) {
        state.mask = S;
        state.orderStep = step;
        state.orderFilled[state.orderIndex] = true;
        syncChips();
        refresh();
      }
      if (this.anim.t >= 3.15) this.anim.playing = false;
    }
    this.anim.flash = Math.max(0, this.anim.flash - dt * 0.35);
  },

  render(time) {
    if (this.fallback) { drawFallback(); return; }
    if (!this.ready) return;
    if (this.skyMat) this.skyMat.uniforms.uTime.value = time;
    if (this.moteMat) this.moteMat.uniforms.uTime.value = time;
    this.edges.forEach((mesh) => { mesh.material.uniforms.uTime.value = time; });
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
};

function placeCylinder(THREE, mesh, a, b) {
  const A = new THREE.Vector3(a.x, a.y, a.z);
  const B = new THREE.Vector3(b.x, b.y, b.z);
  const dir = new THREE.Vector3().subVectors(B, A);
  const len = dir.length();
  mesh.scale.set(1, len, 1);
  mesh.position.copy(A).add(B).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
}

function fallbackPoints(canvas) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const cx = w * 0.5, cy = h * 0.52;
  const pts = [];
  for (let mask = 0; mask < 8; mask++) {
    const p = maskToPos(mask, 1);
    const x = cx + p.x * 78 + p.z * 46;
    const y = cy - p.y * 70 + p.z * 18;
    pts[mask] = { x, y };
  }
  return pts;
}
function drawFallback() {
  const canvas = els["stage-fallback"];
  if (canvas.hidden) return;
  const { ctx, w, h } = fitCanvas(canvas);
  ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, w, h);
  const pts = fallbackPoints(canvas);
  const vals = allV();
  const lo = Math.min(...vals), hi = Math.max(...vals);
  for (let a = 0; a < 8; a++) {
    for (let b = a + 1; b < 8; b++) {
      if (popcount(a ^ b) !== 1) continue;
      const bit = Math.log2(a ^ b);
      ctx.strokeStyle = FEATURES[bit].color;
      ctx.globalAlpha = state.highlight === bit ? 0.95 : 0.35;
      ctx.lineWidth = state.highlight === bit ? 2.4 : 1.2;
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  for (let mask = 0; mask < 8; mask++) {
    const t = (vals[mask] - lo) / Math.max(1e-6, hi - lo);
    ctx.fillStyle = mask === state.mask ? COPPER : lerpColor("#4a6280", "#4ecdc4", t);
    ctx.beginPath();
    ctx.arc(pts[mask].x, pts[mask].y, mask === state.mask ? 11 : 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = "11px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText(coalitionName(mask), pts[mask].x, pts[mask].y - 14);
  }
  ctx.textAlign = "left";
}

/* ----------------------------- wiring ------------------------------ */

function onInputs() {
  state.x[0] = Number(els.x0.value);
  state.x[1] = Number(els.x1.value);
  state.x[2] = Number(els.x2.value);
  state.pair[0] = Number(els.i01.value);
  state.ksPhi = null;
  state.mc = { n: 0, sum: [0, 0, 0], hist: [], antithetic: state.mc.antithetic, lastOrder: null };
  generateHouses();
  lattice.needsLabel = true;
  refresh();
}

function wire() {
  ["x0", "x1", "x2", "i01"].forEach((id) => {
    els[id].addEventListener("input", onInputs);
  });
  els["dummy-on"].addEventListener("change", () => {
    state.dummy = els["dummy-on"].checked;
    refresh();
  });
  els["ord-step"].addEventListener("click", () => {
    const order = ORDERS[state.orderIndex];
    if (state.orderStep >= 3) {
      state.orderStep = 0;
      state.mask = 0;
    } else {
      const i = order[state.orderStep];
      const before = v(state.mask);
      state.mask |= 1 << i;
      state.lastMarg = v(state.mask) - before;
      state.orderStep += 1;
      if (state.orderStep === 3) state.orderFilled[state.orderIndex] = true;
    }
    syncChips();
    refresh();
  });
  els["ord-reset"].addEventListener("click", () => {
    state.orderStep = 0;
    state.mask = 0;
    syncChips();
    refresh();
  });
  els["ord-all"].addEventListener("click", () => {
    state.orderFilled = state.orderFilled.map(() => true);
    refresh();
  });
  els["mc-1"].addEventListener("click", () => mcDraw(1));
  els["mc-20"].addEventListener("click", () => mcDraw(20));
  els["mc-100"].addEventListener("click", () => mcDraw(100));
  els["mc-reset"].addEventListener("click", () => {
    state.mc = { n: 0, sum: [0, 0, 0], hist: [], antithetic: state.mc.antithetic, lastOrder: null };
    refresh();
  });
  els["mc-anti"].addEventListener("click", () => {
    state.mc.antithetic = !state.mc.antithetic;
    els["mc-anti"].setAttribute("aria-pressed", String(state.mc.antithetic));
    els["mc-anti"].textContent = "Antithetic pairs: " + (state.mc.antithetic ? "on" : "off");
  });
  els["ks-m"].addEventListener("input", () => {
    els["ks-m-val"].textContent = els["ks-m"].value;
  });
  els["ks-refit"].addEventListener("click", refitKernel);
  els.nfeat.addEventListener("input", updateExplosion);

  const sections = [...document.querySelectorAll("section.sec")];
  const tocLinks = [...document.querySelectorAll("#toc a")];
  const byId = new Map(tocLinks.map((a) => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      tocLinks.forEach((a) => a.removeAttribute("aria-current"));
      const link = byId.get(id);
      if (link) link.setAttribute("aria-current", "true");
      const mode = entry.target.dataset.mode || "idle";
      if (mode !== state.mode) {
        state.mode = mode;
        updateStageCopy();
        lattice.sync();
      }
    });
  }, { rootMargin: "-40% 0px -45% 0px", threshold: 0.01 });
  sections.forEach((sec) => io.observe(sec));

  addEventListener("scroll", () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    els.progress.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + "%";
  }, { passive: true });

  addEventListener("resize", () => {
    lattice.resize();
    refresh();
  }, { passive: true });
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => lattice.resize()).observe(els.stage);
  }
}

function frame(now) {
  if (state.start == null) state.start = now;
  const t = (now - state.start) / 1000;
  const dt = Math.min(0.05, Math.max(0, t - state.clock));
  state.clock = t;
  if (!document.hidden) {
    lattice.advance(dt);
    lattice.render(reducedMotion ? 12 : t);
  }
  requestAnimationFrame(frame);
}

bindEls();
buildChips();
buildOrderButtons();
buildQuiz();
generateHouses();
wire();
try {
  const proof = selfTest();
  console.info("Shapley self-test ok", proof.phi);
} catch (err) {
  console.error("Shapley self-test failed", err);
}
refresh();
requestAnimationFrame(frame);

window.__SHAPLEY__ = {
  ready: true,
  webgl: false,
  state,
  v,
  predict,
  exactShapley,
  kernelShap,
  permMarginals,
  selfTest,
  advance: (dt) => lattice.advance(dt),
  setMask,
  FEATURES
};

import("three").then(function (THREE) {
  return import("three/addons/controls/OrbitControls.js").then(function (mod) {
    lattice.init(THREE, mod.OrbitControls);
    window.__SHAPLEY__.webgl = lattice.ready;
    refresh();
  });
}).catch(function (err) {
  console.warn("Coalition lattice using 2D fallback", err);
  lattice.useFallback();
  refresh();
});
