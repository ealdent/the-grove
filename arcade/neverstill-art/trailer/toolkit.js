// Injected into the capture page after load. Drives the player through a fake gamepad (analog sticks),
// overrides the camera for cinematic angles, and sets up scenes. Everything here is harness-only.
(() => {
  const N = window.__neverstill, C = window.__nvcap, { G, PL, cam } = N;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const btn = () => ({ pressed: false, value: 0 });
  const gp = { connected: true, index: 0, id: 'capture-pad', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn) };
  Object.defineProperty(navigator, 'getGamepads', { value: () => [gp], configurable: true });
  // the game applies a 0.18 deadzone and rescales, so invert that to hit an exact stick value
  const ax = v => (Math.abs(v) < 1e-4 ? 0 : Math.sign(v) * (0.18 + 0.82 * Math.min(1, Math.abs(v))));
  const T = {
    N, C, gp,
    /* one frame of input: x = steer (+right), y = pitch (+climb), plus buttons */
    pad(x = 0, y = 0, o = {}) {
      gp.axes[0] = ax(clamp(x, -1, 1)); gp.axes[1] = ax(clamp(-y, -1, 1));
      const set = (i, v) => { gp.buttons[i].pressed = !!v; gp.buttons[i].value = v ? 1 : 0; };
      set(0, o.fire); set(1, o.boost); set(6, o.brake); set(4, o.rollL); set(5, o.rollR);
    },
    /* steer toward a yaw or a world point, hold an altitude above ground */
    fly(o = {}) {
      let x = o.x ?? 0, y = o.y ?? 0;
      let tyaw = o.yaw;
      if (o.at) tyaw = Math.atan2(o.at[0] - PL.p[0], o.at[2] - PL.p[2]);
      if (tyaw != null) x = clamp(-wrap(tyaw - PL.yaw) * (o.gain ?? 2.4), -1, 1);   // same law as the game's autopilot (+x = steer right)
      if (o.agl != null) y = clamp((o.agl - PL.agl) * (o.pgain ?? 0.09) - PL.pitch * 0.6, -1, 1);
      if (o.alt != null) y = clamp((o.alt - PL.p[1]) * (o.pgain ?? 0.09) - PL.pitch * 0.6, -1, 1);
      T.pad(x, y, o);
    },
    /* camera override for this frame (after update, before render) */
    cam(eye, look, fovDeg = 68, roll = 0) {
      const F = [look[0] - eye[0], look[1] - eye[1], look[2] - eye[2]], fl = Math.hypot(...F); F[0] /= fl; F[1] /= fl; F[2] /= fl;
      let R0 = [F[1] * 0 - F[2] * 1, F[2] * 0 - F[0] * 0, F[0] * 1 - F[1] * 0];   // cross(F, UP)
      const rl = Math.hypot(...R0); R0 = R0.map(v => v / rl);
      const U0 = [R0[1] * F[2] - R0[2] * F[1], R0[2] * F[0] - R0[0] * F[2], R0[0] * F[1] - R0[1] * F[0]];
      const cr = Math.cos(roll), sr = Math.sin(roll);
      const U = [U0[0] * cr + R0[0] * sr, U0[1] * cr + R0[1] * sr, U0[2] * cr + R0[2] * sr];
      const R = [F[1] * U[2] - F[2] * U[1], F[2] * U[0] - F[0] * U[2], F[0] * U[1] - F[1] * U[0]], rr = Math.hypot(...R);
      cam.eyeR = eye.slice();   // cam.eye is left to the chase camera so it can take over again smoothly
      cam.F[0] = F[0]; cam.F[1] = F[1]; cam.F[2] = F[2];
      cam.U[0] = U[0]; cam.U[1] = U[1]; cam.U[2] = U[2];
      cam.R[0] = R[0] / rr; cam.R[1] = R[1] / rr; cam.R[2] = R[2] / rr;
      cam.fov = fovDeg * Math.PI / 180;
    },
    /* telephoto over-the-shoulder camera locked on a boss: rocket in the lower foreground, boss magnified.
       Returns false (chase camera stays) while the boss is hidden and no lock was established yet. */
    bossCam(b, o = {}) {
      if (!b) return false;
      const hidden = b.mode === 'under' || b.hid || (b.blink && b.sc < 0.25);
      if (hidden && !T._bc) return false;
      const P = PL.p, tgt = hidden ? T._bc.look : [b.p[0], b.p[1] + (o.lift ?? 0), b.p[2]];
      if (!T._bc) T._bc = { look: tgt.slice() };
      const L = T._bc.look; for (let k = 0; k < 3; k++) L[k] += (tgt[k] - L[k]) * (o.smooth ?? 0.16);
      const dx = L[0] - P[0], dy = L[1] - P[1], dz = L[2] - P[2], dist = Math.hypot(dx, dy, dz) || 1;
      const back = o.back ?? 26, up = o.up ?? 3.6, side = o.side ?? 4.5, R = PL.Rh;
      const eye = [P[0] - dx / dist * back + R[0] * side, P[1] - dy / dist * back + up, P[2] - dz / dist * back + R[2] * side];
      const g = C.floorAt(eye[0], eye[2]) + 2.5; if (eye[1] < g) eye[1] = g;
      const fov = clamp(2 * Math.atan((o.span ?? 58) / (dist + back)) * 180 / Math.PI, o.minFov ?? 30, o.maxFov ?? 62);
      T.cam(eye, L, fov);
      return true;
    },
    /* start a stage in play state; quiet = no enemies/rings unless the clip spawns them */
    stage(idx, { quiet = false, god = true, auto = false, power = 1, skipIntro = true } = {}) {
      G.attract = false; G.state = 'play'; G.menu = []; G.paused = false; G.lives = 3;
      C.setupStage(idx, true);
      G.god = god; G.auto = auto; PL.power = power; PL.inv = 0;
      if (skipIntro) { C.setPhase('waves'); G.banner = null; }
      if (quiet) { C.D.spawnT = 1e9; C.D.ringT = 1e9; }
      T.pad(0, 0);
    },
    /* distance along a heading to the first water stretch at least `len` long (null if none) */
    waterAhead(yaw, from = 60, to = 600, len = 70) {
      let run = 0;
      for (let d = from; d < to; d += 5) {
        const x = PL.p[0] + Math.sin(yaw) * d, z = PL.p[2] + Math.cos(yaw) * d;
        if (C.groundAt(x, z) <= C.WL + 0.2) { run += 5; if (run >= len) return d - run; } else run = 0;
      }
      return null;
    },
    /* combat pilot: like the game's autopilot (prefers targets in front), but only opens fire inside `range`
       so kills happen close enough to read on screen */
    combat(o = {}) {
      const P = PL.p, F = PL.Fh, cand = [];
      for (const e of N.enemies) if (e.alive && !e.lost) cand.push(e.p);
      for (const b of N.bosses) if (b.targets) { const L = []; b.targets(L); for (const q of L) cand.push(q.p); }
      let tgt = null, best = 1e12, bestS = 1e12;
      for (const q of cand) {
        const dx = q[0] - P[0], dz = q[2] - P[2], d2 = dx * dx + dz * dz + (q[1] - P[1]) ** 2, c = (dx * F[0] + dz * F[2]) / (Math.hypot(dx, dz) + 1e-6);
        if (d2 < 150 * 150 && c < 0.85) continue;
        const sc = d2 * (1 + 3 * (1 - c)); if (sc < bestS) { bestS = sc; best = d2; tgt = q; }
      }
      const f0 = C.floorAt(P[0], P[2]);
      let tyaw = o.yaw ?? PL.yaw, alt = f0 + (o.agl ?? 24);
      if (tgt) { tyaw = Math.atan2(tgt[0] - P[0], tgt[2] - P[2]); alt = clamp(tgt[1], f0 + 8, f0 + 70); }
      for (const d of [60, 120, 200]) { const g2 = C.floorAt(P[0] + F[0] * d, P[2] + F[2] * d) + 16; if (g2 > alt) alt = g2; }
      const dy = wrap(tyaw - PL.yaw), range = o.range ?? 1e9;
      const fire = !!tgt && best < range * range && Math.abs(dy) < 0.3 && (!o.burst || (G.t % o.burst) < o.burst * 0.45);   // bursts leave gaps between hit flashes
      T.pad(clamp(-dy * 2.4, -1, 1), clamp((alt - P[1]) * 0.07, -1, 1), { fire, boost: o.boost, rollL: o.rollL, rollR: o.rollR });
      return tgt;
    },
    /* next ring of the newest chain still to fly through */
    nextRing() { let best = null; for (const r of N.rings) if (!r.got && !r.missed && (!best || r.chain > best.chain || (r.chain === best.chain && r.idx < best.idx))) best = r; return best; },
    /* world point `ahead` units along the current heading, `right` units to the side (right = PL.Rh) */
    rel(ahead, right = 0, up = 0) { return [PL.p[0] + PL.Fh[0] * ahead + PL.Rh[0] * right, PL.p[1] + up, PL.p[2] + PL.Fh[2] * ahead + PL.Rh[2] * right]; },
    boss(kind, k = 0, total = 1) {
      const b = kind === 'wyrm' ? C.makeWyrm(k, total) : C.makeHalo(false);
      N.bosses.push(b); G.bossName = kind.toUpperCase(); C.setPhase('boss'); return b;
    },
    state() { return { phase: G.phase, stage: G.stage, t: +G.t.toFixed(2), p: PL.p.map(v => +v.toFixed(1)), yaw: +PL.yaw.toFixed(2), agl: +PL.agl.toFixed(1), speed: +PL.speed.toFixed(1), enemies: N.enemies.length, bosses: N.bosses.map(b => b.type + ':' + (b.mode || '') + ':' + Math.round(b.hp)), score: G.score }; }
  };
  window.__T = T;
  return true;
})();
