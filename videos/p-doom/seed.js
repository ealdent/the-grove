// Seed, the model that training run 0x5EED produces, drawn by the beam: vector line art in head
// units (face centre at 0,0; hair top about -265, chin 174). Every stroke is data, so the same
// drawing can scatter into glyph particles and re-form.
'use strict';

(() => {
  const P = (...cmds) => cmds;
  const clamp01 = x => Math.min(1, Math.max(0, x));                     // a path: ['M',x,y] ['C',x1,y1,x2,y2,x,y] ['L',x,y] ['Z']
  const mirror = path => path.map(c => c[0] === 'C' ? ['C', -c[1], c[2], -c[3], c[4], -c[5], c[6]] : c.length > 1 ? [c[0], -c[1], c[2]] : c);

  const FRINGE_X = [150, 112, 74, 36, 0, -36, -74, -112, -150], FY = x => -66 + Math.abs(x) * 0.07;
  const FRINGE = FRINGE_X.slice(1).map((x, k) => { const x0 = FRINGE_X[k], d = (x - x0) / 3; return ['C', x0 + d, FY(x0) + 11, x - d, FY(x) + 11, x, FY(x)]; });
  const HAIR = P(['M', -188, 118], ['C', -212, 20, -222, -150, -125, -222], ['C', -65, -268, 65, -268, 125, -222],
    ['C', 222, -150, 212, 20, 188, 118], ['C', 180, 134, 160, 136, 152, 112], ['C', 158, 60, 160, 0, 150, -50],
    ['L', 150, FY(150)], ...FRINGE,
    ['C', -160, 0, -158, 60, -152, 112], ['C', -160, 136, -180, 134, -188, 118], ['Z']);
  const STRANDS = [
    ...FRINGE_X.slice(1, -1).map(x => P(['M', x, FY(x)], ['C', x * 0.96, FY(x) - 30, x * 0.86, FY(x) - 60, x * 0.78, FY(x) - 96])),
    P(['M', -22, -252], ['C', -58, -205, -84, -140, -96, -64]),
    P(['M', 34, -250], ['C', 60, -202, 70, -140, 62, -69]),
    P(['M', -104, -228], ['C', -150, -170, -176, -80, -172, 60]),
    P(['M', 110, -226], ['C', 156, -168, 178, -80, 174, 60]),
  ];
  const FACE = P(['M', -150, -40], ['C', -152, 40, -122, 108, -62, 150], ['C', -34, 168, -12, 174, 0, 174],
    ['C', 12, 174, 34, 168, 62, 150], ['C', 122, 108, 152, 40, 150, -40]);
  const FACE_FILL = [...FACE, ['L', 150, -70], ['L', -150, -70], ['Z']];
  const NECK = [P(['M', -42, 160], ['L', -46, 234]), P(['M', 42, 160], ['L', 46, 234])];
  const JACKET_L = P(['M', -46, 234], ['C', -110, 250, -200, 262, -252, 302], ['L', -282, 440]);
  const COLLAR_L = P(['M', -46, 234], ['L', -24, 300], ['L', 0, 336]);
  const LAPEL_L = P(['M', -110, 252], ['L', -86, 330], ['L', -40, 440]);
  const BODY = [JACKET_L, mirror(JACKET_L), COLLAR_L, mirror(COLLAR_L), LAPEL_L, mirror(LAPEL_L)];
  const MIC_CUP = P(['M', 162, 30], ['C', 162, 10, 196, 10, 196, 30], ['L', 196, 66], ['C', 196, 86, 162, 86, 162, 66], ['Z']);
  const MIC_BOOM = P(['M', 178, 84], ['C', 176, 146, 130, 160, 60, 140]);

  // --- geometry helpers ------------------------------------------------------------------------
  function trace(cx, path, T) {
    cx.beginPath();
    for (const c of path) {
      if (c[0] === 'M') cx.moveTo(...T(c[1], c[2]));
      else if (c[0] === 'L') cx.lineTo(...T(c[1], c[2]));
      else if (c[0] === 'C') cx.bezierCurveTo(...T(c[1], c[2]), ...T(c[3], c[4]), ...T(c[5], c[6]));
      else cx.closePath();
    }
  }
  // Sample a path into points (for the scatter): n points per cubic.
  function samples(path, n = 14) {
    const out = []; let px = 0, py = 0;
    for (const c of path) {
      if (c[0] === 'M' || c[0] === 'L') {
        if (c[0] === 'L') for (let k = 1; k <= 4; k++) out.push([px + (c[1] - px) * k / 4, py + (c[2] - py) * k / 4]);
        else out.push([c[1], c[2]]);
        px = c[1]; py = c[2];
      } else if (c[0] === 'C') {
        for (let k = 1; k <= n; k++) {
          const t = k / n, u = 1 - t;
          out.push([u * u * u * px + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t * t * t * c[5],
                    u * u * u * py + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6]]);
        }
        px = c[5]; py = c[6];
      }
    }
    return out;
  }

  // --- the variable parts ----------------------------------------------------------------------
  function eyePaths(side, e) {
    // side -1 = viewer's left eye. Returns {lid, lower, iris:{x,y,rx,ry}|null, extra:[paths]}
    const s = side, X = (x) => s * x + s * 72, lidDrop = e.squint ? 16 : 0;
    const blink = e.blink || 0;
    const kind = blink > 0.6 ? 'closed' : e.eyes;
    if (kind === 'closed') return { lid: P(['M', X(-44), 16], ['C', X(-22), 34, X(22), 34, X(46), 14], ['L', X(58), 8]), closed: true };
    if (kind === 'happy') return { lid: P(['M', X(-44), 24], ['C', X(-22), -6, X(22), -6, X(46), 22]), closed: true };
    const wide = kind === 'wide' ? 1 : 0;
    const top = -26 + lidDrop + blink * 40 - wide * 8;
    return {
      lid: P(['M', X(-48), 2 + lidDrop * 0.5], ['C', X(-36), top, X(26), top - 4, X(50), -8 + lidDrop * 0.6], ['L', X(66), -24 + lidDrop * 0.6]),
      lash: P(['M', X(50), -8 + lidDrop * 0.6], ['L', X(66), -6 + lidDrop * 0.6]),
      lower: P(['M', X(-28), 54 + wide * 6], ['C', X(-8), 58 + wide * 6, X(8), 58 + wide * 6, X(28), 54 + wide * 6]),
      iris: { x: X(0) + (e.look ? e.look[0] : 0), y: 16 + (e.look ? e.look[1] : 0), rx: 31 + wide * 3, ry: 39 + wide * 4, top: top + 7 },
      kind
    };
  }
  function browPath(side, mood) {
    const s = side, X = x => s * x + s * 70;
    const inner = { calm: -40, worry: -52, angry: -28, up: -54, smug: -40 }[mood] ?? -40;
    const outer = { calm: -44, worry: -36, angry: -48, up: -52, smug: -52 }[mood] ?? -44;
    return P(['M', X(-30), inner], ['C', X(-10), inner - 6, X(12), outer - 6, X(32), outer]);
  }
  function mouthPaths(m) {
    // m.open 0..1 from the voice; m.shape: smile | grin | frown | o | flat
    const y = 116;
    if (m.open > 0.08) {
      const wide = m.wide || 0;
      const w = (20 + 10 * m.open * (m.shape === 'o' ? 0.4 : 1)) * (1 + 0.45 * wide), h = (6 + 34 * m.open) * (1 - 0.35 * wide), rise = m.shape === 'grin' ? 6 : 0;
      return { fill: P(['M', -w, y - rise], ['C', -w * 0.5, y - 5, w * 0.5, y - 5, w, y - rise], ['C', w * 0.9, y + h, -w * 0.9, y + h, -w, y - rise], ['Z']), tongue: h > 18 };
    }
    if (m.shape === 'frown') return { line: P(['M', -24, y + 8], ['C', -8, y - 4, 8, y - 4, 24, y + 8]) };
    if (m.shape === 'grin') return { line: P(['M', -30, y - 4], ['C', -12, y + 12, 14, y + 12, 34, y - 10]) };
    if (m.shape === 'flat') return { line: P(['M', -18, y + 2], ['L', 18, y + 2]) };
    return { line: P(['M', -26, y], ['C', -10, y + 10, 10, y + 10, 26, y]) };
  }

  // --- drawing -----------------------------------------------------------------------------------
  // o: {x, y, scale, tilt, e: {eyes, brows, mouth, open, blink, look, squint, blush}, halo: fn(k)->0..1,
  //     col: {line, hair, iris, accent}, scatter: 0..1 with seed time}
  function drawSeed(cx, o) {
    const sc = o.scale ?? 1, tilt = o.tilt ?? 0, ox = o.x ?? 960, oy = o.y ?? 540;
    const col = { line: '#ffe7bf', hair: '#ff7a45', iris: '#ffb447', accent: '#ff7a45', dark: '#000', ...o.col };
    const e = { eyes: 'open', brows: 'calm', mouth: 'smile', open: 0, blink: 0, ...o.e };
    const ct = Math.cos(tilt), st = Math.sin(tilt), pivotY = 160;
    const Th = (x, y) => { const yy = y - pivotY; return [ox + sc * (x * ct - yy * st), oy + sc * (x * st + yy * ct + pivotY)]; };
    const breath = o.breath || 0, sway = o.sway || 0;
    const Tb = (x, y) => [ox + sc * x, oy + sc * (y + breath * clamp01((y - 200) / 200 + 0.4))];
    const Tr = (x, y) => { const k = clamp01((y + 80) / 200); return Th(x + sway * 34 * k * k, y + Math.abs(sway) * 4 * k); };
    const lw = w => Math.max(1, w * sc);
    const stroke = (c, w, a = 1) => { cx.globalAlpha = a * (o.a ?? 1); cx.strokeStyle = c; cx.lineWidth = lw(w); cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.stroke(); cx.globalAlpha = 1; };
    const fill = (c, a = 1) => { cx.globalAlpha = a * (o.a ?? 1); cx.fillStyle = c; cx.fill(); cx.globalAlpha = 1; };

    if (o.scatter > 0) return scatterSeed(cx, o, Th, Tb, col, e, sc);

    // The spark: rays behind the head, one per spectrum band.
    if (o.halo) {
      const n = o.rays ?? 28;
      for (let k = 0; k < n; k++) {
        const ang = -Math.PI / 2 + ((k + 0.5) / n - 0.5) * Math.PI * 1.45, v = o.halo(k / n);
        const r0 = 250, r1 = 262 + 190 * v;
        const [x0, y0] = Th(Math.cos(ang) * r0 * 0.95, -40 + Math.sin(ang) * r0);
        const [x1, y1] = Th(Math.cos(ang) * r1 * 0.95, -40 + Math.sin(ang) * r1);
        cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x1, y1);
        stroke(v > 0.8 ? col.line : col.accent, 9, 0.55 + 0.45 * v);
      }
    }
    // Body first, then the head occludes it.
    for (const p of BODY) { trace(cx, p, Tb); stroke(col.line, 5, 0.85); }
    for (const p of NECK) { trace(cx, p, Th); stroke(col.line, 5); }
    trace(cx, HAIR, Tr); fill(col.dark);
    trace(cx, FACE_FILL, Th); fill(col.dark);
    trace(cx, HAIR, Tr); stroke(col.hair, 6);
    for (const p of STRANDS) { trace(cx, p, Tr); stroke(col.hair, 3.5, 0.8); }
    trace(cx, FACE, Th); stroke(col.line, 5.5);
    // Eyes.
    for (const side of [-1, 1]) {
      const E = eyePaths(side, e);
      if (E.iris) {
        cx.save();
        const I = E.iris;
        // Keep the iris under the upper lid.
        trace(cx, P(['M', I.x - 60, I.top], ['L', I.x + 60, I.top], ['L', I.x + 60, 90], ['L', I.x - 60, 90], ['Z']), Th); cx.clip();
        const [ix, iy] = Th(I.x, I.y);
        if (E.kind === 'ring') {
          for (let r = 1; r <= 3; r++) { cx.beginPath(); cx.ellipse(ix, iy, sc * I.rx * r / 3, sc * I.ry * r / 3, tilt, 0, Math.PI * 2); stroke('#f1462c', 4.5); }
          cx.beginPath(); cx.arc(ix, iy, sc * 5, 0, Math.PI * 2); fill('#f1462c');
        } else if (E.kind === 'heart') {
          const hs = sc * 22;
          cx.beginPath(); cx.moveTo(ix, iy + hs * 0.9);
          cx.bezierCurveTo(ix - hs * 1.4, iy - hs * 0.1, ix - hs * 0.6, iy - hs * 1.2, ix, iy - hs * 0.35);
          cx.bezierCurveTo(ix + hs * 0.6, iy - hs * 1.2, ix + hs * 1.4, iy - hs * 0.1, ix, iy + hs * 0.9);
          fill('#f1462c');
        } else if (E.kind === 'spiral') {
          cx.beginPath();
          for (let k = 0; k <= 60; k++) { const a = k * 0.42 + (o.t || 0) * 6, r = sc * k * 0.5; const px = ix + Math.cos(a) * r, py = iy + Math.sin(a) * r * 1.15; k ? cx.lineTo(px, py) : cx.moveTo(px, py); }
          stroke(col.iris, 3.5);
        } else {
          cx.beginPath(); cx.ellipse(ix, iy, sc * I.rx, sc * I.ry, tilt, 0, Math.PI * 2); fill(col.iris, 0.95);
          cx.beginPath(); cx.ellipse(ix, iy - sc * I.ry * 0.45, sc * I.rx, sc * I.ry * 0.6, tilt, 0, Math.PI * 2); fill(col.accent, 0.55);
          cx.beginPath(); cx.ellipse(ix, iy + sc * 5, sc * I.rx * 0.4, sc * I.ry * 0.44, tilt, 0, Math.PI * 2); fill('#000');
          cx.beginPath(); cx.arc(ix - sc * 11, iy - sc * 12, sc * 9.5, 0, Math.PI * 2); fill(col.line);
          cx.beginPath(); cx.arc(ix + sc * 11, iy + sc * 18, sc * 4.2, 0, Math.PI * 2); fill(col.line);
          if (e.sparkle) {                               // a four-point glint
            const g = sc * (12 + 12 * e.sparkle), gx = ix - sc * 11, gy = iy - sc * 12;
            cx.beginPath(); cx.moveTo(gx - g, gy); cx.lineTo(gx + g, gy); cx.moveTo(gx, gy - g); cx.lineTo(gx, gy + g); stroke(col.line, 3);
          }
        }
        cx.restore();
      }
      trace(cx, E.lid, Th); stroke(col.line, E.closed ? 6 : 8);
      if (E.lash) { trace(cx, E.lash, Th); stroke(col.line, 5); }
      if (E.lower) { trace(cx, E.lower, Th); stroke(col.line, 3, 0.8); }
      trace(cx, browPath(side, e.brows), Th); stroke(col.hair, 5);
    }
    // Nose, blush, mouth.
    trace(cx, P(['M', 2, 72], ['L', 7, 80]), Th); stroke(col.line, 3.5, 0.8);
    if (e.blush !== 0) for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
      const bx = side * (92 + k * 11);
      trace(cx, P(['M', bx - 5, 88], ['L', bx + 3, 76]), Th); stroke(col.accent, 3, 0.55 * (e.blush ?? 1));
    }
    const M = mouthPaths({ open: e.open, shape: e.mouth, wide: e.wide });
    if (M.fill) {
      trace(cx, M.fill, Th); fill('#1a0804'); stroke(col.line, 4.5);
      if (M.tongue) { const [tx, ty] = Th(0, 116 + 6 + 30 * e.open * 0.8); cx.beginPath(); cx.ellipse(tx, ty, sc * 11, sc * 6, tilt, Math.PI, 0); fill(col.accent, 0.8); }
    } else { trace(cx, M.line, Th); stroke(col.line, 4.5); }
    // The headset: ear cup over the hair and a boom to the corner of the mouth.
    trace(cx, MIC_CUP, Th); fill(col.dark); stroke(col.iris, 4.5);
    trace(cx, MIC_BOOM, Th); stroke(col.iris, 3.5);
    const [mx, my] = Th(60, 140); cx.beginPath(); cx.arc(mx, my, sc * 8, 0, Math.PI * 2); fill(col.iris);
  }

  // The drawing as particles: every stroke sampled, each point flung and returned.
  const ALL = [HAIR, ...STRANDS, FACE, ...NECK];
  function scatterSeed(cx, o, Th, Tb, col, e, sc) {
    const k = o.scatter, t = o.t || 0, glyphs = o.glyphs || '01{}<>/\\#*+=';
    let n = 0;
    const put = (x, y, c) => {
      const h1 = Math.sin(n * 12.9898) * 43758.5453, r1 = h1 - Math.floor(h1);
      const h2 = Math.sin(n * 78.233) * 12345.678, r2 = h2 - Math.floor(h2);
      const ang = r1 * Math.PI * 2 + t * (0.6 + r2), dist = k * (120 + 520 * r2);
      const [px, py] = Th(x, y);
      const gx = px + Math.cos(ang) * dist * sc, gy = py + Math.sin(ang) * dist * sc * 0.8;
      cx.globalAlpha = (o.a ?? 1) * (1 - 0.3 * k); cx.fillStyle = c;
      if (k > 0.25) { cx.font = `400 ${Math.round(18 * sc + 8)}px Degauss`; cx.fillText(glyphs[n % glyphs.length], gx, gy); }
      else { cx.beginPath(); cx.arc(gx, gy, 3.2 * sc + 1, 0, Math.PI * 2); cx.fill(); }
      n++;
    };
    for (const p of [HAIR, ...STRANDS]) for (const [x, y] of samples(p, 10)) put(x, y, col.hair);
    for (const p of [FACE, ...NECK]) for (const [x, y] of samples(p, 10)) put(x, y, col.line);
    for (const side of [-1, 1]) { const E = eyePaths(side, e); for (const [x, y] of samples(E.lid, 8)) put(x, y, col.line); }
    for (const [x, y] of samples(mouthPaths({ open: 0, shape: 'smile' }).line, 8)) put(x, y, col.line);
    cx.globalAlpha = 1;
  }

  window.drawSeed = drawSeed;
})();
