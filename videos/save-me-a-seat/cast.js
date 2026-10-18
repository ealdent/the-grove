// cast.js: one cartoon person, drawn from a pose, and the costumes that make the cast.
// Units: R is the head radius (32 px at s = 1). The root (x, y) is the ground point between the feet.
'use strict';

let ARM_STYLE = 'hose';
const LOOKS = {
  narrator: { top: C.narr, bottom: C.dark, shoe: C.shoe, hair: 'bob', hairCol: C.hairN, collar: true },
  // her face stays in the shadow of the hood: the song never shows it
  lover: { top: C.yellow, coat: 'long', hood: true, hairCol: C.hairL, bottom: '#3c3b47', shoe: C.boot, boots: true },
  stagehand: { top: '#d7d0c0', overalls: '#6f86a3', bottom: '#6f86a3', shoe: C.shoe, hair: 'short', hairCol: '#5a4636', hat: 'cap', hatCol: C.red },
  janitor: { top: '#8e9a7c', bottom: '#5f6858', shoe: C.shoe, hair: 'bald', hairCol: '#d9d2c7', mustache: true, hat: 'cap', hatCol: '#5f6858' },
  guard: { top: '#4f5f7c', bottom: '#3d4659', shoe: C.shoe, hair: 'short', hairCol: '#7a6a5a', hat: 'peaked', hatCol: '#3d4659', mustache: true }
};

// a two-bone limb by inverse kinematics: elbow/knee for a hand/foot target
function ik(S, T, l1, l2, bend) {
  const dx = T[0] - S[0], dy = T[1] - S[1], d = clamp(Math.hypot(dx, dy), 1e-3, l1 + l2 - 1e-3);
  const a = Math.atan2(dy, dx), cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const e = a + bend * Math.acos(clamp(cosA, -1, 1));
  const E = [S[0] + Math.cos(e) * l1, S[1] + Math.sin(e) * l1];
  const f = Math.atan2(T[1] - E[1], T[0] - E[0]);
  return [E, [E[0] + Math.cos(f) * l2, E[1] + Math.sin(f) * l2]];
}

function tube(pts, w0, w1, fill, o = {}) {
  // a rubber-hose limb: a smooth centreline, widths tapering w0 -> w1, round ends; painted, then inked
  const k = F.k || 1, P = spline(pts, false, 3 / k), n = P.length;
  if (n < 2) return;
  const L = [], Rr = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const w = lerp(w0, w1, i / (n - 1)) / 2;
    L.push([P[i][0] - ty * w, P[i][1] + tx * w]); Rr.push([P[i][0] + ty * w, P[i][1] - tx * w]);
  }
  const cap = (c, a, r, from) => { const out = []; for (let i = 1; i < 8; i++) { const t = from + i / 8 * Math.PI; out.push([c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r]); } return out; };
  const e0 = Math.atan2(P[1][1] - P[0][1], P[1][0] - P[0][0]), e1 = Math.atan2(P[n - 1][1] - P[n - 2][1], P[n - 1][0] - P[n - 2][0]);
  const outline = [...L, ...cap(P[n - 1], 0, w1 / 2, e1 + Math.PI / 2 * -1 + 0), ...Rr.reverse(), ...cap(P[0], 0, w0 / 2, e0 + Math.PI / 2)];
  shape(outline, { fill, raw: true, w: o.w ?? 2.4, seed: o.seed ?? 3, famp: 1.2, line: o.line });
}

function walkPose(ph, o = {}) {
  // a walk (run = true for a run): leg A leads at phase 0
  const run = !!o.run, A = (o.amp ?? 1) * (run ? 0.8 : 0.42), out = { bob: 0, lean: run ? 0.16 : 0.03 };
  const leg = p => [A * Math.sin(p), (run ? 1.5 : 0.75) * Math.max(0, Math.sin(p + (run ? 1.9 : 1.3))) + (run ? 0.25 : 0.05)];
  out.legA = leg(ph); out.legB = leg(ph + Math.PI);
  const arm = p => [-(run ? 0.9 : 0.4) * Math.sin(p) * (o.amp ?? 1), run ? 1.5 : 0.25];
  out.armA = arm(ph + Math.PI); out.armB = arm(ph);
  out.bob = -(run ? 0.22 : 0.07) * Math.abs(Math.cos(ph));
  return out;
}

function person(x, y, s, look, pose = {}) {
  const R = 32 * s, d = pose.dir ?? 1, view = pose.view || 'front', seed = pose.seed ?? 1;
  const side = view === 'side' || view === 'three', front = view === 'front' || view === 'three', back = view === 'back';
  const lean = pose.lean ?? 0, rotL = p => rot2(p, lean * d, Hp);
  const legLen = 1.3 * R * (pose.legK ?? 1), foot = 0.16 * R;     // legK < 1: shins seen end-on (sitting, from behind)
  const Hp = [x + (pose.hx ?? 0) * R, y - 2 * legLen - foot + (pose.bob ?? 0) * R];
  const hipW = view === 'side' ? 0.08 * R : view === 'three' ? 0.22 * R : 0.34 * R, shW = view === 'side' ? 0.22 * R : view === 'three' ? 0.6 * R : 0.8 * R;
  const N = rotL([Hp[0], Hp[1] - 2.0 * R]);
  const tilt = pose.tilt ?? 0, Hc = rot2([N[0], N[1] - 1.02 * R], tilt * d + lean * d * 0.4, N);
  const out = { R, head: Hc, neck: N, hip: Hp };
  // legs: [thigh, knee] angles; A is the near (or screen-left) leg
  const legPts = (hip, ang, sign) => {
    if (pose.feet && pose.feet[sign]) { const [K, A] = ik(hip, pose.feet[sign], legLen, legLen, d > 0 ? -1 : 1); return [hip, K, A]; }
    const [t, kk] = ang || [0, 0];
    const K = [hip[0] + Math.sin(t) * legLen * d, hip[1] + Math.cos(t) * legLen];
    const A = [K[0] + Math.sin(t - kk) * legLen * d, K[1] + Math.cos(t - kk) * legLen];
    return [hip, K, A];
  };
  const sym = view === 'front' || view === 'back';
  const hipA = [Hp[0] - (sym ? hipW : hipW * d * 0.6), Hp[1]], hipB = [Hp[0] + (sym ? hipW : hipW * d * 0.6), Hp[1]];
  const LA = legPts(hipA, pose.legA, 'A'), LB = legPts(hipB, pose.legB, 'B');
  const shoe = (L, far) => {
    const A = L[2], dirx = side ? d : (L === LA ? -0.3 : 0.3);
    const len = side ? 0.42 * R : 0.3 * R, h = (look.boots ? 0.2 : 0.16) * R;
    const toe = [A[0] + dirx * len, A[1] + h * 0.5];
    const pts = side ? [[A[0] - d * 0.14 * R, A[1] - h], [A[0] + d * 0.1 * R, A[1] - h * 1.1], [toe[0], A[1] - h * 0.2], [toe[0] + d * 0.04 * R, A[1] + h * 0.55], [A[0] - d * 0.16 * R, A[1] + h * 0.6]]
      : ell(A[0] + dirx * 0.08 * R, A[1] + h * 0.15, 0.24 * R, h * 0.85, 12);
    shape(pts, { fill: far ? shade(look.shoe, 0.85) : look.shoe, seed: seed + (far ? 71 : 73), w: 2.2 });
    if (look.boots) tube([[A[0], A[1] - 0.6 * R], [A[0], A[1]]], 0.42 * R, 0.4 * R, far ? shade(look.shoe, 0.85) : look.shoe, { seed: seed + 75 });
  };
  const legW0 = 0.42 * R, legW1 = 0.34 * R;
  const drawLeg = (L, far) => {
    tube(L, legW0, legW1, far ? shade(look.bottom, 0.85) : look.bottom, { seed: seed + (far ? 61 : 63) });
    shoe(L, far);
  };
  // arms: [shoulder, elbow]; hands may be IK targets
  const shA = rotL([Hp[0] - (sym ? shW : shW * d * 0.6), Hp[1] - 1.74 * R]);
  const shB = rotL([Hp[0] + (sym ? shW : shW * d * 0.5), Hp[1] - 1.74 * R]);
  // a reaching arm. Two straight bones folded at a hard elbow looked frozen (Jason, 2026-10-18), so a reach is
  // one soft curve: 'hose' bows the arm gently with the elbow hanging low, 'short' draws it straight and short.
  const reach = (S, T, sign) => {
    const style = pose.arms || ARM_STYLE, L = 1.95 * R, dx = T[0] - S[0], dy = T[1] - S[1], dd = Math.hypot(dx, dy) || 1;
    if (dd > L) T = [S[0] + dx / dd * L, S[1] + dy / dd * L];
    const D = Math.min(dd, L), M = [(S[0] + T[0]) / 2, (S[1] + T[1]) / 2];
    if (style === 'short') return [S, M, T];
    // the elbow hangs down and outward, as an arm's does. Its side is the part of that preferred direction that is
    // square to the arm, so it changes continuously: picking a side by a sign test flipped the elbow in and out
    // from drawing to drawing whenever an arm sat near the threshold (the phone call at 0:28; Jason, 2026-10-18).
    const out = pose.elbow?.[sign] ?? (sym ? (sign === 'A' ? -1 : 1) : -d), pl = Math.hypot(out * 0.6, 1), prx = out * 0.6 / pl, pry = 1 / pl;
    const ux = dx / dd, uy = dy / dd, along = prx * ux + pry * uy, px = prx - along * ux, py = pry - along * uy;
    const bow = Math.min(Math.sqrt(Math.max(0, L * L / 4 - D * D / 4)) * 0.45, (sym ? 0.42 : 0.26) * R) * (pose.bow ?? 1) * Math.min(1, 1.4 * Math.hypot(px, py));
    const pn = Math.hypot(px, py) || 1;
    if (window.__armDbg) window.__armDbg.push       // probe_arm.mjs
      ([seed, sign, Math.sign(ux * py - uy * px), +(bow / R).toFixed(3), (-uy) * out * 0.35 + ux < 0 ? -1 : 1]);
    return [S, [M[0] + px / pn * bow, M[1] + py / pn * bow], T];
  };
  const armPts = (S, ang, target, sign) => {
    if (target) return reach(S, target, sign);
    const [a, e] = ang || [0.08, 0.15];
    const sx = sym ? (sign === 'A' ? -1 : 1) : d;
    const spread = view === 'front' || view === 'back' ? 0.3 : 0;
    const E = [S[0] + (Math.sin(a) * d * (side ? 1 : 0.4) + sx * spread) * R, S[1] + Math.cos(a) * 1.0 * R];
    const Hh = [E[0] + (Math.sin(a + e) * d * (side ? 1 : 0.4) + sx * spread * 0.6) * 0.95 * R, E[1] + Math.cos(a + e) * 0.95 * R];
    return [S, E, Hh];
  };
  // 'ear': the hand comes up beside the head (a phone call)
  const tgt = v => v === 'ear' ? [Hc[0] + (view === 'side' ? -0.12 : view === 'three' ? -0.55 : 0.92) * R * d, Hc[1] + 0.32 * R] : v;
  const AA = armPts(shA, pose.armA, tgt(pose.handA), 'A'), AB = armPts(shB, pose.armB, tgt(pose.handB), 'B');
  out.handA = AA[2]; out.handB = AB[2];
  const sleeve = look.top;
  const drawArm = (A, far, sign) => {
    tube(A, 0.4 * R, 0.33 * R, far ? shade(sleeve, 0.86) : sleeve, { seed: seed + (far ? 81 : 83) });
    const hd = A[2];
    shape(ell(hd[0], hd[1] + 0.04 * R, 0.21 * R, 0.2 * R, 12), { fill: look.skin || C.skin, seed: seed + (far ? 85 : 87), w: 2 });
    if (pose.hold && pose.hold[sign]) pose.hold[sign](hd, R, A);
  };
  // torso (sweater, or coat to the knee)
  const torso = () => {
    const coat = look.coat === 'long' || look.coat === 'dress', hem = look.coat === 'dress' ? 2.35 * R : coat ? 1.05 * R : 0.3 * R;
    if (look.cape) cape(Hp, R, view, d, look, seed, rotL);
    const wTop = view === 'side' ? 0.6 * R : view === 'three' ? 0.76 * R : 0.84 * R, wBot = (look.coat === 'dress' ? 1.55 : coat ? 1.25 : 1.04) * wTop;
    const cx = Hp[0] + (view === 'three' ? -d * 0.06 * R : 0);
    const pts = [[cx - wTop, Hp[1] - 1.85 * R], [cx - wTop * 0.55, Hp[1] - 2.05 * R], [cx + wTop * 0.55, Hp[1] - 2.05 * R], [cx + wTop, Hp[1] - 1.85 * R],
      [cx + wBot * 1.02, Hp[1] - 0.6 * R], [cx + wBot, Hp[1] + hem], [cx, Hp[1] + hem + 0.06 * R], [cx - wBot, Hp[1] + hem], [cx - wBot * 1.02, Hp[1] - 0.6 * R]].map(rotL);
    shape(pts, { fill: look.top, seed: seed + 91, w: 2.6 });
    if (look.overalls) {
      const bib = [[cx - wTop * 0.55, Hp[1] - 1.25 * R], [cx + wTop * 0.55, Hp[1] - 1.25 * R], [cx + wBot * 0.98, Hp[1] + hem], [cx - wBot * 0.98, Hp[1] + hem]].map(rotL);
      shape(bib, { fill: look.overalls, seed: seed + 92, w: 2.2 });
      if (!back) for (const sx of [-1, 1]) line([[cx + sx * wTop * 0.5, Hp[1] - 1.25 * R], [cx + sx * wTop * 0.62, Hp[1] - 2.0 * R]].map(rotL), { w: 3, seed: seed + 93 + sx });
    }
    if (look.coat === 'long' && !back) {
      if (view !== 'side') for (let i = 0; i < 3; i++) shape(ell(...rotL([cx + (view === 'three' ? d * 0.3 * R : 0), Hp[1] - (1.45 - i * 0.62) * R]), 0.07 * R, 0.11 * R, 8), { fill: C.ink, seed: seed + 95 + i, w: 1.5 });
      line([[cx - wBot * 0.75, Hp[1] - 0.25 * R], [cx - wBot * 0.35, Hp[1] - 0.22 * R]].map(rotL), { w: 2, seed: seed + 99 });
      line([[cx + wBot * 0.35, Hp[1] - 0.22 * R], [cx + wBot * 0.75, Hp[1] - 0.25 * R]].map(rotL), { w: 2, seed: seed + 100 });
    }
    if (look.collar && !back) line(ell(N[0], N[1] + 0.06 * R, 0.42 * R, 0.16 * R, 10, 0, 0.15, Math.PI - 0.15), { w: 2.2, seed: seed + 101 });
  };
  // the head
  const headDraw = () => {
    const hr = R, cx = Hc[0], cy = Hc[1], turn = view === 'three' ? 0.42 * d : view === 'side' ? 0.85 * d : 0;
    if (look.hood) { hood(cx, cy, hr, d, view, seed, look, pose); return; }
    // hair behind the head
    if (look.hair === 'bob') {
      const sh = view === 'side' ? -d * 0.22 * hr : view === 'three' ? -d * 0.1 * hr : 0;
      const pts = [];
      for (let i = 0; i <= 14; i++) { const a = Math.PI - 0.25 + i / 14 * (Math.PI + 0.5); pts.push([cx + sh + Math.cos(a) * 1.13 * hr, cy - 0.04 * hr + Math.sin(a) * 1.1 * hr]); }
      pts.push([cx + sh + 1.06 * hr, cy + 0.78 * hr], [cx + sh + 0.7 * hr, cy + 0.86 * hr], [cx + sh - 0.7 * hr, cy + 0.86 * hr], [cx + sh - 1.06 * hr, cy + 0.78 * hr]);
      shape(pts, { fill: look.hairCol, seed: seed + 111, w: 2.4 });
    }
    if (back) {
      if (look.hair === 'short') shape(ell(cx, cy - 0.05 * hr, 1.02 * hr, 1.0 * hr, 18), { fill: look.hairCol, seed: seed + 112 });
      else if (look.hair !== 'bob') shape(ell(cx, cy, hr, 1.02 * hr, 18), { fill: look.skin || C.skin, seed: seed + 113 });
      hat(cx, cy, hr, d, view, seed, look);
      return;
    }
    shape(ell(cx, cy, hr, hr * 1.03, 20), { fill: look.skin || C.skin, seed: seed + 114, w: 2.6 });
    if (view !== 'side') for (const sx of [-1, 1]) if (look.hair !== 'bob') shape(ell(cx + sx * 0.98 * hr, cy + 0.08 * hr, 0.16 * hr, 0.22 * hr, 10), { fill: look.skin || C.skin, seed: seed + 115 + sx, w: 2 });
    face(cx, cy, hr, turn, d, view, pose.face || {}, seed);
    if (look.beard) beard(cx, cy, hr, turn, look, seed);
    if (look.mustache) {
      const mx = cx + turn * 0.5 * hr, my = cy + 0.32 * hr;
      shape([[mx - 0.3 * hr, my + 0.05 * hr], [mx, my - 0.06 * hr], [mx + 0.3 * hr, my + 0.05 * hr], [mx + 0.18 * hr, my + 0.14 * hr], [mx, my + 0.08 * hr], [mx - 0.18 * hr, my + 0.14 * hr]], { fill: look.hairCol === '#d9d2c7' ? '#8c8478' : look.hairCol, seed: seed + 117, w: 1.8 });
    }
    // hair in front: bangs or a cap of short hair
    if (look.hair === 'bob') {
      const sh = turn * 0.3 * hr, pts = [];
      for (let i = 0; i <= 10; i++) { const a = Math.PI - 0.32 + i / 10 * (Math.PI + 0.64); pts.push([cx + sh * 0.4 + Math.cos(a) * 1.08 * hr, cy - 0.02 * hr + Math.sin(a) * 1.08 * hr]); }
      for (let i = 0; i <= 6; i++) pts.push([cx + sh + (0.92 - i / 6 * 1.84) * hr, cy - 0.32 * hr + Math.sin(i * 1.7) * 0.04 * hr]);
      shape(pts, { fill: look.hairCol, seed: seed + 118, w: 2.4 });
    } else if (look.hair === 'short') {
      const pts = [];
      for (let i = 0; i <= 12; i++) { const a = Math.PI - 0.15 + i / 12 * (Math.PI + 0.3); pts.push([cx + Math.cos(a) * 1.05 * hr, cy - 0.05 * hr + Math.sin(a) * 1.06 * hr]); }
      pts.push([cx + 0.95 * hr, cy - 0.25 * hr], [cx + turn * 0.3 * hr, cy - 0.5 * hr], [cx - 0.95 * hr, cy - 0.25 * hr]);
      shape(pts, { fill: look.hairCol, seed: seed + 119, w: 2.2 });
    } else if (look.hair === 'bald') {
      for (const sx of [-1, 1]) shape(ell(cx + sx * 0.88 * hr, cy - 0.15 * hr, 0.2 * hr, 0.3 * hr, 9), { fill: look.hairCol, seed: seed + 120 + sx, w: 1.6 });
    }
    hat(cx, cy, hr, d, view, seed, look);
  };
  // draw, back to front
  if (side) { drawLeg(LB, true); drawArm(AB, true, 'B'); }
  // the near leg goes under the sweater's hem in close-ups, and always under a long coat or a dress
  // (drawn over it, the lover's leg stood outside her raincoat: Jason, 2026-10-18)
  const legFirst = pose.legFirst ?? (look.coat === 'long' || look.coat === 'dress');
  if (side && legFirst) drawLeg(LA, false);
  if (!side) { drawLeg(LA, false); drawLeg(LB, false); }
  torso();
  if (back) { drawArm(AA, false, 'A'); drawArm(AB, false, 'B'); }
  if (side && !legFirst) drawLeg(LA, false);
  if (look.hood || back) headDraw();
  if (!back && !side) { drawArm(AA, false, 'A'); drawArm(AB, false, 'B'); }
  if (!look.hood && !back) headDraw();
  if (side) drawArm(AA, false, 'A');
  if (pose.after) pose.after(out);
  return out;
}

function face(cx, cy, hr, turn, d, view, f, seed) {
  const look = f.look || [0, 0], blink = f.blink ?? 0, brow = f.brow ?? 0;
  const ex = 0.34 * hr * (1 - Math.abs(turn) * 0.35), ox = turn * 0.42 * hr + look[0] * 0.1 * hr, oy = 0.04 * hr + look[1] * 0.08 * hr;
  const eyes = view === 'side' ? [d * 0.5 * hr] : [-ex + ox, ex + ox];
  eyes.forEach((dx, i) => {
    const far = view === 'three' && ((d > 0 && i === 0) || (d < 0 && i === 1));
    const rx = 0.095 * hr * (far ? 0.8 : 1), ry = 0.14 * hr * (1 - blink) * (far ? 0.9 : 1);
    if (blink > 0.75) line([[cx + dx - rx * 1.2, cy + oy], [cx + dx + rx * 1.2, cy + oy + 0.01 * hr]], { w: 2.2, seed: seed + 131 + i });
    else shape(ell(cx + dx, cy + oy, rx, Math.max(ry, 0.02 * hr), 10), { fill: C.ink, line: false, edge: false, reg: 0.3, famp: 0.5, seed: seed + 133 + i });
    if (f.shine !== false && blink < 0.5) shape(ell(cx + dx + rx * 0.35, cy + oy - ry * 0.4, rx * 0.32, rx * 0.32, 6), { fill: '#fbf6ea', line: false, edge: false, reg: 0, famp: 0.2, seed: seed + 135 + i });
    // brows: worried (-) tilts the inner ends up, cross (+) down
    const inner = view === 'side' ? 0 : (i === 0 ? 1 : -1);
    const by = cy + oy - 0.3 * hr, bw = 0.14 * hr;
    line([[cx + dx - bw, by + inner * brow * 0.06 * hr * -1 + (f.lift ?? 0) * -0.05 * hr], [cx + dx + bw, by + inner * brow * 0.06 * hr + (f.lift ?? 0) * -0.05 * hr]], { w: 2, seed: seed + 137 + i, a: 0.85 });
  });
  // cheeks and mouth
  if (view !== 'side') for (const sx of [-1, 1]) wash(ell(cx + ox + sx * 0.55 * hr, cy + 0.3 * hr, 0.17 * hr, 0.1 * hr, 10), C.blush, { fa: 0.45, edge: false, reg: 1, seed: seed + 141 + sx });
  const mx = cx + ox * 1.1 + (view === 'side' ? d * 0.55 * hr : 0), my = cy + 0.43 * hr, sm = f.smile ?? 0.3, op = f.open ?? 0;
  if (op > 0.08) shape(ell(mx, my + 0.02 * hr, 0.1 * hr * (0.8 + op * 0.4), 0.06 * hr + op * 0.1 * hr, 10), { fill: '#7a3a35', seed: seed + 143, w: 1.8 });
  else line([[mx - 0.13 * hr, my - sm * 0.03 * hr], [mx, my + sm * 0.06 * hr], [mx + 0.13 * hr, my - sm * 0.03 * hr]], { w: 2.1, seed: seed + 145 });
}

function hat(cx, cy, hr, d, view, seed, look) {
  if (typeof HATS !== 'undefined' && HATS[look.hat]) { HATS[look.hat](cx, cy, hr, d, view, seed, look); return; }
  if (look.hat === 'cap') {
    const crown = []; for (let i = 0; i <= 10; i++) { const a = Math.PI - 0.2 + i / 10 * (Math.PI + 0.4); crown.push([cx + Math.cos(a) * 1.04 * hr, cy - 0.32 * hr + Math.sin(a) * 0.78 * hr]); }
    shape(crown, { fill: look.hatCol, seed: seed + 151 });
    if (view !== 'back') shape([[cx - (view === 'front' ? 0.6 : -0.1 * d) * hr, cy - 0.38 * hr], [cx + d * 1.45 * hr, cy - 0.36 * hr], [cx + d * 1.4 * hr, cy - 0.24 * hr], [cx, cy - 0.26 * hr]], { fill: shade(look.hatCol, 0.8), seed: seed + 152, w: 2.2 });
  } else if (look.hat === 'peaked') {
    shape([[cx - 1.05 * hr, cy - 0.45 * hr], [cx - 0.9 * hr, cy - 1.05 * hr], [cx + 0.9 * hr, cy - 1.05 * hr], [cx + 1.05 * hr, cy - 0.45 * hr]], { fill: look.hatCol, seed: seed + 153 });
    if (view !== 'back') shape([[cx - 0.85 * hr, cy - 0.47 * hr], [cx + 0.85 * hr, cy - 0.47 * hr], [cx + 0.7 * hr, cy - 0.28 * hr], [cx - 0.7 * hr, cy - 0.28 * hr]], { fill: C.ink, seed: seed + 154, w: 1.8 });
    shape(ell(cx, cy - 0.78 * hr, 0.12 * hr, 0.1 * hr, 8), { fill: C.gold, seed: seed + 155, w: 1.5 });
  }
}

function hood(cx, cy, hr, d, view, seed, look, pose) {
  // the raincoat's hood, up: her face stays in its shadow, a few red curls spill out
  const yc = look.top, back = view === 'back', side = view === 'side' || view === 'three';
  const hx = cx - (side ? d * 0.16 * hr : 0);
  shape(ell(hx, cy - 0.04 * hr, 1.3 * hr, 1.36 * hr, 22), { fill: yc, seed: seed + 161, w: 2.6 });
  if (back) { line([[hx, cy - 1.32 * hr], [hx + 0.04 * hr, cy + 0.2 * hr], [hx, cy + 1.2 * hr]], { w: 2, seed: seed + 162, a: 0.7 }); return; }
  const ox = side ? d * (view === 'side' ? 0.55 : 0.32) * hr : 0, rx = (view === 'side' ? 0.55 : 0.8) * hr, ry = 0.9 * hr;
  const op = ell(cx + ox, cy + 0.12 * hr, rx, ry, 20);
  shape(op, { fill: '#3b302c', seed: seed + 163, w: 2.4, fa: 0.92 });
  // light catches only the tip of her nose and chin, never the face
  if (pose.face?.chin !== false) shape(ell(cx + ox + d * rx * 0.35, cy + 0.82 * hr, rx * 0.36, 0.16 * hr, 10, 0, 0, Math.PI), { fill: C.skin, seed: seed + 164, w: 1.6, fa: 0.8 });
  // curls at the rim of the hood
  const r = mulberry(seed * 7 + 3);
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.62 + r() * 0.85) + (side ? (d > 0 ? -0.35 : 0.35) : 0), px = cx + ox + Math.cos(a) * rx * 0.92, py = cy + 0.12 * hr + Math.sin(a) * ry * 0.92;
    const cr = hr * (0.12 + r() * 0.07), pts = [];
    for (let j = 0; j <= 9; j++) { const t = j / 9 * TAU * 1.15; pts.push([px + Math.cos(t) * cr * (1 - j / 14), py + Math.sin(t) * cr * (1 - j / 14)]); }
    line(pts, { w: 3.4, col: look.hairCol, seed: seed + 170 + i, a: 0.95 });
  }
  // the hood's rim, drawn over the curls
  line(op, { closed: true, w: 3.2, seed: seed + 180 });
  line([[hx - 1.1 * hr, cy + 0.9 * hr], [hx - 0.5 * hr, cy + 1.25 * hr]], { w: 2, seed: seed + 181, a: 0.6 });
}
