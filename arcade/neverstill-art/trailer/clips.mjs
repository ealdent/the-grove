// Shot list for the Neverstill trailer. Each clip: setup (once), frame (before every update), cam (after
// update, before render). `i`/`t` are the recorded frame index / seconds (negative during warm-up).
// Zones: 0 MERIDIAN, 1 SAFFRON, 2 NOCTILUCA, 3 EMBERFALL, 4 CIRRUS.

/* point the rocket at the nearest long lake so the low skim throws spray */
const aimAtLake = `
  let best = null;
  for (let k = 0; k < 72; k++) { const y = k / 72 * Math.PI * 2, d = T.waterAhead(y, 150, 700, 140); if (d != null && (!best || d < best.d)) best = { y, d }; }
  window.__H = best || { y: 0, d: 300 };
  PL.yaw = __H.y; N.cam.yaw = __H.y;`;

export const CLIPS = [
  {
    name: 'flight', secs: 11, warm: 60, seed: 7, rng: 11,
    setup: `T.stage(0, { quiet: true }); ${aimAtLake}`,
    frame: `const H = __H;
      if (t < 2.4) T.fly({ yaw: H.y + 0.28 * Math.sin(t * 1.9), agl: 22 });
      else if (t < 4.2) T.fly({ yaw: H.y, agl: 3.2, pgain: 0.12 });
      else if (t < 7.4) T.fly({ yaw: H.y + 0.12 * Math.sin(t * 2.4), agl: 2.8, pgain: 0.14, boost: t > 4.6 });
      else T.fly({ yaw: H.y + (t - 7.4) * 1.05, agl: 34, boost: t < 8.6 });`
  },
  {
    name: 'skimside', secs: 4, warm: 60 + 180, seed: 7, rng: 11,
    setup: `T.stage(0, { quiet: true }); ${aimAtLake}`,
    frame: `const H = __H;
      if (t < -1.8) T.fly({ yaw: H.y, agl: 22 });
      else T.fly({ yaw: H.y + 0.08 * Math.sin(t * 2), agl: 2.8, pgain: 0.14, boost: t > 0.4 });`,
    cam: `const P = PL.p, F = PL.Fh, R = PL.Rh, s = 15 - t * 1.2;
      T.cam([P[0] + R[0] * s - F[0] * (9 - t * 2.2), P[1] + 1.2, P[2] + R[2] * s - F[2] * (9 - t * 2.2)], [P[0] + F[0] * 6, P[1] + 0.6, P[2] + F[2] * 6], 60);`
  },
  {
    name: 'rings', secs: 9, warm: 50, seed: 7, rng: 5, prepass: true,
    setup: `T.stage(4, { quiet: true }); PL.p[1] = T.C.floorAt(PL.p[0], PL.p[2]) + 18; window.__path = [];`,
    frame: `if (i >= 0) __path.push([PL.p[0], PL.p[1], PL.p[2], PL.vel[0], PL.vel[1], PL.vel[2]]);
      if (i === 0) {
        T.C.spawnRingChain();
        for (const r of N.rings) {
          const q = window.__prev && __prev[52 + r.idx * 27];
          if (!q) { r.p = [PL.p[0], -5000, PL.p[2]]; continue; }      // dry run: park the rings out of reach
          const l = Math.hypot(q[3], q[4], q[5]);
          r.p = [q[0], q[1], q[2]]; r.f = [q[3] / l, q[4] / l, q[5] / l];
        }
      }
      T.fly({ yaw: 0.35 * Math.sin(t * 1.25), agl: 15 + 6 * Math.sin(t * 0.95 + 1), boost: t > 4.3, rollR: i === 300, rollL: i === 420 });`
  },
  {
    name: 'combat1', secs: 12, warm: 200, seed: 7, rng: 21,
    setup: `T.stage(3, { power: 3 }); T.C.D.spawnT = 1e9; T.C.spawnGroup('vee');`,
    frame: `if (i === -80) T.C.spawnGroup('mask'); if (i === 60) T.C.spawnGroup('vee'); if (i === 150) T.C.spawnGroup('turret'); if (i === 250) T.C.spawnGroup('spin');
      if (i === 380) T.C.spawnGroup('vee'); if (i === 470) T.C.spawnGroup('mask'); if (i === 560) T.C.spawnGroup('spin');
      T.combat({ range: 135 });`
  },
  {
    name: 'combat2', secs: 10, warm: 200, seed: 7, rng: 33,
    setup: `T.stage(2, { power: 4 }); T.C.D.spawnT = 1e9; T.C.spawnGroup('vee');`,
    frame: `if (i === -90) T.C.spawnGroup('spin'); if (i === 40) T.C.spawnGroup('mask'); if (i === 160) T.C.spawnGroup('vee'); if (i === 300) T.C.spawnGroup('spin'); if (i === 420) T.C.spawnGroup('vee');
      T.combat({ range: 135 });`
  },
  {
    name: 'wyrm', secs: 17, warm: 30, seed: 7, rng: 44,
    setup: `T.stage(1, { power: 2, quiet: true }); PL.shield = 3;`,
    frame: `T.combat({ range: 240, burst: 1.1 });
      if (i === 0) { T.C.setPhase('warning'); T.C.SFX.warn(); T.C.banner(['WARNING'], 3.2, '#ff4a4a', 'A HUGE ENEMY APPROACHES'); }
      if (i === 183) window.__W = T.boss('wyrm');
      const W = window.__W;
      if (W && !W.dying) { if (t < 12.3 || W.mode !== 'weave' || W.hid || W.modeT < 0.6) W.hp = Math.max(W.hp, W.maxHp * 0.94); else { W.hp = 0; T.C.bossDie(W); } }   // full body, fully surfaced -> segment-by-segment death`,
    cam: `if (window.__W) T.bossCam(__W, { lift: 2 });`
  },
  ...[['wyrmlow', -1.4]].map(([name, yaw]) => ({
    name, secs: 4.6, warm: 40, seed: 7, rng: 44,
    setup: `T.stage(1, { quiet: true, power: 2 }); PL.yaw = ${yaw}; N.cam.yaw = ${yaw};`,
    frame: `T.fly({ yaw: ${yaw}, agl: 12, boost: t > 0.8 });   // guns quiet so hit flashes don't bleach the body
      if (i === 0) { window.__W = T.boss('wyrm'); __W.ex = -20; __W.ez = 150; __W.underT = 0.9; }
      const W = window.__W;
      if (W && W.mode !== 'under' && !window.__LC) {                  // placed the instant it breaks the surface
        const F = PL.Fh, R = PL.Rh, cx = W.p[0] - F[0] * 42 + R[0] * 27, cz = W.p[2] - F[2] * 42 + R[2] * 27;
        window.__LC = [cx, Math.max(T.C.floorAt(cx, cz), T.C.floorAt(W.p[0], W.p[2])) + 5, cz]; window.__LV = [PL.Fh[0] * 0.6, PL.Fh[2] * 0.6];
      }
      if (W) W.hp = W.maxHp;`,
    cam: `if (window.__LC) { const W = __W, L = __LC, sp = PL.speed / 60 * 0.6 / 0.6;
      L[0] += __LV[0] * PL.speed / 60; L[2] += __LV[1] * PL.speed / 60 * 1;
      L[1] += (Math.max(T.C.floorAt(L[0], L[2]) + 5, L[1] - 0.5) - L[1]) * 0.3;
      const look = [W.p[0], W.p[1] + 4, W.p[2]];
      window.__LL = window.__LL ? __LL.map((v, k) => v + (look[k] - v) * 0.2) : [W.p[0], W.p[1] + 14, W.p[2]];
      T.cam(L, __LL, 76); }`
  })),
  {
    name: 'halo', secs: 17, warm: 30, seed: 7, rng: 55,
    setup: `T.stage(2, { power: 3, quiet: true }); window.__B = T.boss('halo');`,
    frame: `const B = __B; T.combat({ range: 230 });
      if (t > 8 && !B.cut) { B.cut = 1; for (const p of B.pods) if (p.alive) p.hp = Math.min(p.hp, 1.2); }
      if (t > 11.5 && !B.dying) { B.regrown = true; B.hp = Math.min(B.hp, 3); for (const p of B.pods) if (p.alive) p.hp = Math.min(p.hp, 0.5); }`,
    cam: `T.bossCam(__B, { span: 70, lift: 0 });`
  },
  {
    name: 'clear', secs: 9.5, warm: 30, seed: 7, rng: 66,
    setup: `T.stage(1, { auto: true, quiet: true }); G.score = 486250;
      G.shotsFired = 1000; G.shotsHit = 874; G.ringsGot = 14; G.gates = 3; G.damageTaken = 0;`,
    frame: `if (i === -30) { T.C.setPhase('bossdown'); G.phaseT = 2.1; }`
  },
  ...[0, 1, 2, 3, 4].map(z => ({
    name: 'zone' + z, secs: 3.4, warm: 0, seed: 7, rng: 70 + z,
    setup: `T.stage(${z}, { quiet: true, skipIntro: false }); PL.inv = 0;`,
    frame: `T.fly({ agl: ${[9, 14, 10, 12, 16][z]} + 3 * Math.sin(t * 1.3), x: ${[0.45, -0.4, 0.35, -0.45, 0.4][z]} * Math.sin(t * 1.1 + 0.6), boost: t > 1.6 });`
  }))
];
