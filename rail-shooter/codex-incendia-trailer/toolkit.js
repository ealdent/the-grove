// Injected into the capture page after load. Steers the Quill-Strider through the game's own mouse-analog
// input, overrides the camera for cinematic angles, steps CSS animations on game time and sets up scenes.
// Everything here is harness-only; the game code is untouched apart from what make_cap.mjs rewrites.
(() => {
  const g = window.__ci, CI = window.__CI, cam = g.camera;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const B = g.bounds;
  const K = 12.77;                     // the game's mouse follow (pos += d * dt*11.5 per frame) as a continuous rate
  const T = { g, CI, clamp };

  /* ---------------------------------------------------------------- frame plumbing ------------------------ */
  // CSS animations and transitions run on the wall clock; pin each one to game time instead.
  T.stepAnims = () => {
    for (const a of document.getAnimations()) {
      if (a.__b == null) { a.__b = window.__capMs; a.pause(); }
      a.currentTime = window.__capMs - a.__b;
    }
  };
  T.camSave = () => ({ p: cam.position.clone(), q: cam.quaternion.clone(), fov: cam.fov });
  T.camRestore = s => { cam.position.copy(s.p); cam.quaternion.copy(s.q); cam.fov = s.fov; cam.updateProjectionMatrix(); };
  /* camera override for this frame (after update, before render); the game's chase camera is restored after */
  T.cam = (eye, look, fov = 60, roll = 0) => {
    cam.position.set(eye[0], eye[1], eye[2]); cam.up.set(0, 1, 0); cam.lookAt(look[0], look[1], look[2]);
    if (roll) cam.rotateZ(roll);
    cam.fov = fov; cam.updateProjectionMatrix();
  };
  /* the chase camera's own look-at point (updateCamera) and a blend from a cinematic camera back into it */
  T.gameLook = () => [g.playerPos.x * 0.25, 0.45 + g.playerPos.y * 0.18, -32];
  T.blendCam = (saved, eye, look, fov, k) => {
    const gp = [saved.p.x, saved.p.y, saved.p.z];
    T.cam(T.lerp3(eye, gp, k), T.lerp3(look, T.gameLook(), k), fov + (saved.fov - fov) * k);
  };
  T.lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  T.ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  /* smoothed camera state for cinematic shots (so a look-at that tracks the player does not jitter) */
  T._cs = null;
  T.smoothCam = (eye, look, fov, k = 0.18, roll = 0) => {
    if (![...eye, ...look, fov].every(Number.isFinite)) throw new Error('smoothCam: non-finite camera ' + JSON.stringify([eye, look, fov]));
    if (!T._cs) T._cs = { e: eye.slice(), l: look.slice(), f: fov };
    const s = T._cs;
    for (let i = 0; i < 3; i++) { s.e[i] += (eye[i] - s.e[i]) * k; s.l[i] += (look[i] - s.l[i]) * k; }
    s.f += (fov - s.f) * k;
    T.cam(s.e, s.l, s.f, roll);
  };

  /* over-the-shoulder telephoto on the Grand Censor: the Quill-Strider low in the corner, the boss filling the frame */
  T.bossCam = (o = {}) => {
    if (!g.boss) return false;
    const P = g.playerPos, b = g.boss.mesh.position;
    const eye = [P.x * 0.6 + (o.side ?? 4.2), P.y * 0.5 + (o.up ?? 3.4), o.back ?? 10];
    const look = [b.x * (o.track ?? 0.7), b.y + (o.lift ?? -0.4), b.z];
    const d = Math.hypot(look[0] - eye[0], look[1] - eye[1], look[2] - eye[2]);
    T.smoothCam(eye, look, clamp(2 * Math.atan((o.span ?? 13) / d) * 180 / Math.PI, 10, 60), o.k ?? 0.2);
    return true;
  };

  /* HUD visibility: 'full' = as played, 'banner' = only the centre banner/telegraph, 'none' = clean picture */
  const css = document.createElement('style'); document.head.appendChild(css);
  T.hud = mode => {
    // the bottom utility row (control mode, mute, pause buttons) is menu chrome, never part of a shot
    const util = '#hud-layer > div:last-child > div:last-child';
    css.textContent = mode === 'none' ? '#hud-layer, #popup-container { visibility: hidden !important; }'
      : mode === 'banner' ? `#hud-layer > div:first-child, ${util}, #boss-hud, #popup-container { visibility: hidden !important; }`
      : mode === 'boss' ? `#hud-layer > div:first-child, ${util}, #popup-container { visibility: hidden !important; }`
      : `${util} { visibility: hidden !important; }`;
  };
  T.hideBanner = () => {
    const b = document.getElementById('stage-banner');
    if (g.bannerTimeout) __gCT(g.bannerTimeout);
    b.classList.add('opacity-0', '-translate-y-4'); b.classList.remove('opacity-100', 'translate-y-0');
    for (const a of b.getAnimations()) a.finish?.();
  };

  /* ---------------------------------------------------------------- scene setup ---------------------------- */
  // start a run in `folio` with the director's random spawns optionally off; god mode keeps every take clean
  T.start = ({ folio = 0, quiet = false, score = 0, mult = 1, hi = 284650, timer = 6, pos = [0, 0.4], banner = false, encore = 0 } = {}) => {
    g.audio.init = () => { };             // video pass: no live audio; sfx calls are logged and replayed offline
    g.highScore = hi;
    g.startNewGame();
    g.damagePlayer = () => { };
    g.loopCount = encore;
    g.applyFolioTheme(folio, true);
    if (!banner) T.hideBanner();
    g.folioTimer = timer; g.score = score; g.multiplier = mult; g.peakMultiplier = mult;
    g.playerPos.set(pos[0], pos[1], 0); g.playerTarget.copy(g.playerPos);
    g.mouseActive = true; T.aim(pos[0], pos[1]);
    if (quiet) T.quiet();
    g.updateScoreUI(); g.updateHighScoreUI();
    document.getElementById('hud-input-mode').textContent = 'MOUSE ANALOG';
  };
  T.quiet = () => { g.obstacleSpawnTimer = 1e9; g.waveSpawnTimer = 1e9; };
  T.director = (obs = 0.6, wave = 1.2) => { g.obstacleSpawnTimer = obs; g.waveSpawnTimer = wave; };
  /* put the mouse where the game will read it as playfield target (x, y) */
  T.aim = (x, y) => {
    g.mouseNorm.x = clamp(x, B.minX, B.maxX) / 13.0;
    g.mouseNorm.y = (clamp(y, B.minY, B.maxY) - 1.1) / 4.4;
  };
  // obstacles spawn at z = -195 and scroll at scrollSpeed; spawn one so it reaches the player at time `inS`
  T.obstacle = (type, x, inS = null) => {
    g.spawnGroundObstacle(type, x);
    const ob = g.obstacles[g.obstacles.length - 1];
    if (inS != null) ob.mesh.position.z = -g.scrollSpeed * inS;
    return ob;
  };
  T.enemy = (type, x, y, z, phase = 0) => { g.createEnemy(type, x, y, z, phase); return g.enemies[g.enemies.length - 1]; };
  T.mothV = (cx, cy, z = -175, count = 6, gap = 2.2) => { for (let i = 0; i < count; i++) T.enemy('MOTH', cx + (i - count / 2) * gap, cy, z - i * 11, i * 0.65); };

  /* ---------------------------------------------------------------- autopilot ------------------------------ */
  // Hit/graze model copied from the game's updateEntities so the pilot sees exactly what the game checks.
  const obstacleAt = (ob, x, y, m) => {
    const dx = Math.abs(x - ob.mesh.position.x);
    if (ob.type === 'DIVIDER') {
      const under = dx < ob.archSafeHalfW - m && y < ob.archSafeMaxY - m * 0.5;
      if (!under && dx < ob.halfW + m && y <= ob.maxY + m) return 2;
      if (dx < ob.halfW + 1.8 && y <= ob.maxY + 1.4) return 1;
      return 0;
    }
    const down = ob.type !== 'NIB' || ob.slammed || ob.mesh.position.y < 6;
    if (down && dx < ob.halfW + m && y <= ob.maxY + m) return 2;
    if (down && dx < ob.halfW + 1.95 && y <= ob.maxY + 1.5) return 1;
    return 0;
  };
  // where the player will be after `t` seconds of holding target (cx, cy)
  const posAt = (P, cx, cy, t) => { const r = Math.exp(-K * t); return [cx + (P.x - cx) * r, cy + (P.y - cy) * r]; };
  // where an enemy will be after `t` seconds (mirrors the game's movement per type)
  const enemyAt = (e, t) => {
    const p = e.mesh.position, et = g.elapsedTime + t;
    if (e.type === 'MOTH') return [e.baseX + Math.sin(et * 3.6 + e.phase) * 3.8, e.baseY + Math.cos(et * 3.6 + e.phase) * 1.6];
    if (e.type === 'GARGOYLE') return [p.x + (g.playerPos.x * 0.65 - p.x) * Math.min(1, t * 0.8), p.y + (1.4 + Math.sin(et * 2.5 + e.phase) * 0.8 - p.y) * Math.min(1, t * 3)];
    if (e.type === 'SHEARS') return [p.x + (g.playerPos.x - p.x) * Math.min(1, t * 1.3), p.y];
    return [p.x, p.y];
  };
  T.pickTarget = (o = {}) => {
    let best = null, bs = 1e9;
    for (const e of g.enemies) {
      const z = e.mesh.position.z;
      if (z > (o.minZ ?? -10) || z < (o.maxZ ?? -150)) continue;
      const ep = e.mesh.position; if (Math.abs(ep.x) > 11.5) continue;          // unreachable at the scroll's edge
      const s = -z * (o.near ?? 1) + (e.type === 'MOTH' ? 0 : -25) + 5 * Math.hypot(ep.x - g.playerPos.x, ep.y - g.playerPos.y);
      if (s < bs) { bs = s; best = e; }
    }
    if (!best && g.boss && !o.noBoss) return { boss: g.boss };
    return best;
  };
  /* one frame of autopilot. Options:
       prefY/prefX (+W)  style lane (e.g. prefY -2.25 to skate), graze: seek near misses, aim: shoot targets,
       dash: [frames] on which to barrel-roll, hold: [x, y] fixed target (still dodges), lazy: move cost */
  T._cmd = null;
  T.pilot = (o = {}) => {
    const P = g.playerPos, spd = g.scrollSpeed;
    const tgt = o.aim === false ? null : T.pickTarget(o);
    let ax = null, ay = null, aw = 0;
    if (tgt && tgt.boss) { ax = tgt.boss.mesh.position.x; ay = tgt.boss.mesh.position.y - 0.35; aw = o.aimW ?? 1.5; }
    else if (tgt) {
      const ez = tgt.mesh.position.z, ve = tgt.type === 'SHEARS' ? spd * 0.92 : spd * 0.62;
      const ti = Math.max(0, (-1.6 - ez) / (215 + ve));
      [ax, ay] = enemyAt(tgt, ti); ay -= 0.35; aw = o.aimW ?? 3.0;
    }
    if (!T._cmd) T._cmd = [P.x, P.y];
    let best = null, bs = 1e18;
    for (let x = B.minX; x <= B.maxX + 1e-6; x += 0.4) for (let y = B.minY; y <= B.maxY + 1e-6; y += 0.3) {
      let s = ((x - T._cmd[0]) ** 2 + (y - T._cmd[1]) ** 2) * (o.lazy ?? 0.035);
      if (o.prefY != null) s += (y - o.prefY) ** 2 * (o.prefYW ?? 0.35);
      if (o.prefX != null) s += (x - o.prefX) ** 2 * (o.prefXW ?? 0.06);
      if (o.hold) s += ((x - o.hold[0]) ** 2 + (y - o.hold[1]) ** 2) * (o.holdW ?? 0.6);
      if (ax != null) { const d2 = (x - ax) ** 2 + (y - ay) ** 2; s -= aw * Math.exp(-d2 / 3); }
      for (const ob of g.obstacles) {
        const z = ob.mesh.position.z; if (z < -90 || z > 2.2) continue;
        const tA = Math.max(0, -z / spd);
        const [px, py] = posAt(P, x, y, tA);
        const h = obstacleAt(ob, px, py, o.margin ?? 0.75);
        if (h === 2) s += 900 / (0.4 + tA);
        else if (h === 1 && o.graze && !ob.grazed) s -= (o.grazeW ?? 1.2);
      }
      for (const b of g.enemyBullets) {
        const bp = b.mesh.position, v = b.vel; if (v.z <= 0 || bp.z > 1) continue;
        const tA = -bp.z / v.z; if (tA > 1.2) continue;
        const [px, py] = posAt(P, x, y, tA);
        const d = Math.hypot(bp.x + v.x * tA - px, bp.y + v.y * tA - py);
        if (d < 0.58 + 0.55 + (o.bmargin ?? 0.9)) s += 500 / (0.3 + tA);
        else if (o.graze && !b.grazed && d < 0.58 + 2.0) s -= (o.grazeW ?? 1.2) * 0.6;
      }
      for (const e of g.enemies) {
        const z = e.mesh.position.z; if (z < -40 || z > 1) continue;
        const ve = e.type === 'SHEARS' ? spd * 0.92 : spd * 0.62, tA = -z / ve;
        const [px, py] = posAt(P, x, y, tA), [ex, ey] = enemyAt(e, tA);
        if (Math.hypot(ex - px, ey - py) < e.radius + 1.6) s += 400 / (0.3 + tA);
      }
      if (s < bs) { bs = s; best = [x, y]; }
    }
    const k = o.follow ?? 0.35;               // low-pass on the command keeps the flight smooth
    T._cmd[0] += (best[0] - T._cmd[0]) * k; T._cmd[1] += (best[1] - T._cmd[1]) * k;
    T.aim(T._cmd[0], T._cmd[1]);
    // hold fire until the target is inside `range` so kills happen close enough to read on screen
    {
      const range = o.range ?? 62, tz = !tgt ? 0 : tgt.boss ? tgt.boss.mesh.position.z : tgt.mesh.position.z;
      g.autoFire = false;
      g.keys.Space = o.fire ?? (!tgt || (tz > -range && Math.hypot(P.x - ax, P.y - ay) < 2.4));
      T._aim = tgt ? [Math.round(tz), +Math.hypot(P.x - ax, P.y - ay).toFixed(2), tgt.boss ? 'boss' : tgt.type] : null;
    }
    if (o.dash && o.dash.includes(window.__capFrame)) { g.keys.KeyA = o.dashLeft; g.triggerDash(); g.keys.KeyA = false; }
    return best;
  };

  T.state = () => ({
    t: +g.elapsedTime.toFixed(2), folio: g.folioIndex, p: [+g.playerPos.x.toFixed(2), +g.playerPos.y.toFixed(2)],
    obs: g.obstacles.length, enemies: g.enemies.length, bullets: g.enemyBullets.length, score: Math.floor(g.score),
    mult: g.multiplier, aim: T._aim, grazes: g.totalGrazes, kills: g.totalKills, boss: g.boss ? [g.boss.phase, g.boss.hp, g.boss.subState] : null
  });
  window.__T = T;
  return true;
})();
