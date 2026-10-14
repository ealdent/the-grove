// Shot definitions. setup runs once after load; frame runs before every update (i = frame, t = i/60, negative
// during warm-up); cam runs after update and before render (`saved` = the game's own chase camera this frame).
// Everything spawned here is the game's own content (spawnGroundObstacle / createEnemy / spawnBoss), placed on cue.
// a pair of wax pillars with a gap; only the near-side pillar is inside graze range, so one popup per gate
const gate = (k, c) => `T.obstacle('MONOLITH', ${c} - 3.5); T.obstacle('MONOLITH', ${c} + 4.8);`;
const nextObs = type => `g.obstacles.filter(o => o.type === '${type}' && o.mesh.position.z < 0.5).sort((a, b) => b.mesh.position.z - a.mesh.position.z)[0]`;

export const CLIPS = [
  // ---- FOLIO I: the Rubrication Plains ----------------------------------------------------------------------
  {
    name: 'open', rng: 11, warm: 90, secs: 2.6,
    setup: `T.start({ folio: 0, quiet: true, pos: [0, 0.6], score: 0 }); T.hud('none');`,
    frame: `
      if (i % 21 === 0 && i < 160) T.obstacle('MONOLITH', (Math.floor((i + 210) / 21) % 2 ? 1 : -1) * 7.2);
      if (i === -60) T.mothV(0, 1.6, -175, 6);
      if (i === 10) T.mothV(-2, 2.0, -175, 6);
      T.pilot({ prefX: 0, prefXW: 0.08, prefY: 0.8, prefYW: 0.15, range: 70 });`,
    cam: `T.blendCam(saved, [0, 12, 21], [0, -2.5, -48], 54, T.ease((t - 0.1) / 1.5));`,
  },
  {
    name: 'moths', rng: 12, warm: 40, secs: 3.0,
    setup: `T.start({ folio: 0, quiet: true, score: 12450, mult: 1.4, pos: [0, 1.0], timer: 9 }); T.hud('none');`,
    frame: `
      if (i === -40) T.mothV(-1.5, 1.2, -150, 7);
      if (i === 0) T.mothV(1.5, 1.8, -165, 7);
      if (i === 40) { T.enemy('GARGOYLE', -6, -3, -150, 0); T.enemy('GARGOYLE', 6, -3, -165, 1); }
      if (i % 30 === 0) T.obstacle('INKWELL', i % 60 ? 9 : -9);
      T.pilot({ graze: true, grazeW: 0.4, range: 48 });`,
    cam: `const P = g.playerPos; T.smoothCam([P.x * 0.6 + 3.4, P.y - 0.5, 12], [P.x * 0.3, P.y + 1.6, -45], 40, 0.2);`,
  },
  {
    name: 'arch', rng: 13, warm: 40, secs: 3.0,
    setup: `T.start({ folio: 0, quiet: true, score: 31880, mult: 2.0, pos: [0, -2.25], timer: 14 }); T.hud('play');`,
    frame: `
      if (i === -20) T.obstacle('DIVIDER', 0);
      if (i === 30) T.obstacle('DIVIDER', 1.5);
      if (i === 75) T.obstacle('DIVIDER', -1);
      if (i % 24 === 0) { T.obstacle('MONOLITH', -9.5); T.obstacle('MONOLITH', 9.5); }
      const nd = ${nextObs('DIVIDER')};
      T.pilot({ prefY: -2.25, prefYW: 2, prefX: nd ? nd.mesh.position.x : 0, prefXW: 0.5, aim: false });`,
  },
  {
    name: 'weave', rng: 14, warm: 40, secs: 3.0,
    setup: `T.start({ folio: 0, quiet: true, score: 47210, mult: 2.4, pos: [0, 1.0], timer: 18 }); T.hud('play');`,
    frame: `
      if (i === -10) { ${gate(0, 0)} }
      if (i === 20) { ${gate(1, 4)} }
      if (i === 50) { ${gate(2, -3)} }
      if (i === 0) T.mothV(0, 3.6, -175, 6);
      const ng = ${nextObs('MONOLITH')};
      const c = ng ? (g.obstacles.filter(o => o.type === 'MONOLITH' && Math.abs(o.mesh.position.z - ng.mesh.position.z) < 1).reduce((s, o) => s + o.mesh.position.x, 0) / 2 - 0.65) : 0;
      T.pilot({ prefX: c, prefXW: 0.6, prefY: 1.2, prefYW: 0.3, dash: [64] });`,
  },
  // ---- FOLIO II: the Nocturne of Iron Gall ------------------------------------------------------------------
  {
    name: 'night', rng: 15, warm: 40, secs: 3.0,
    setup: `T.start({ folio: 0, quiet: true, score: 63900, mult: 2.6, pos: [0, -1.2], timer: 30 }); T.hud('play');`,
    frame: `
      if (i === 0) { g.folioTimer = 0; g.applyFolioTheme(1, false); }
      if (i === -30) T.mothV(0, -0.4, -170, 6);
      if (i === 40) T.mothV(-3, -0.2, -170, 6);
      T.pilot({ graze: true, prefY: -1.2, prefYW: 0.6 });`,
  },
  {
    name: 'shears', rng: 16, warm: 40, secs: 3.0,
    setup: `T.start({ folio: 1, quiet: true, score: 78340, mult: 2.8, pos: [0, 1.2], timer: 6 }); T.hud('play');`,
    frame: `
      if (i === -30) { T.enemy('SHEARS', -4, 1.0, -185, 0); T.enemy('SHEARS', 4, 2.4, -200, 1); }
      if (i === 20) { T.enemy('SHEARS', -1, 0.4, -185, 0); T.enemy('SHEARS', 5, 3, -205, 1); }
      if (i % 25 === 0) T.obstacle('NIB', i % 50 ? 8 : -8);
      T.pilot({ graze: true });`,
  },
  {
    name: 'ophanim', rng: 17, warm: 50, secs: 3.0,
    setup: `T.start({ folio: 1, quiet: true, score: 90120, mult: 3.0, pos: [0, 1.2], timer: 12 }); T.hud('play');`,
    frame: `
      if (i === -50) { T.enemy('OPHANIM', -5.5, 1.8, -125, 0).fireTimer = 0.9; T.enemy('OPHANIM', 5.5, 2.9, -135, 1).fireTimer = 1.0; }
      if (i === 20) { T.enemy('OPHANIM', -2, 3.5, -150, 0).fireTimer = 0.5; T.enemy('OPHANIM', 4, 1.0, -160, 1).fireTimer = 0.6; }
      T.pilot({ graze: true, grazeW: 2.5, bmargin: 0.5, range: 48 });`,
  },
  {
    name: 'nibs', rng: 18, warm: 40, secs: 3.0,
    setup: `T.start({ folio: 1, quiet: true, score: 104500, mult: 3.2, pos: [0, 1.0], timer: 18 }); T.hud('none');`,
    frame: `
      for (const [f, x] of [[-40, -5], [-10, 5], [20, 0], [50, -7], [80, 7], [110, -2]]) if (i === f) T.obstacle('NIB', x);
      if (i === -20) T.mothV(0, 2, -170, 6);
      T.pilot({ graze: true });`,
    cam: `T.smoothCam([2.5 - t * 0.5, 3.4, 12], [0, 0.2, -60], 50, 0.3);`,
  },
  {
    name: 'nightdash', rng: 19, warm: 40, secs: 3.0,
    setup: `T.start({ folio: 1, quiet: true, score: 117800, mult: 3.4, pos: [0, 1.0], timer: 24 }); T.hud('play');`,
    frame: `
      if (i === -40) { T.enemy('GARGOYLE', -6, -3, -150, 0); T.enemy('GARGOYLE', 6, -3, -160, 1); T.enemy('GARGOYLE', 0, -3, -175, 2); }
      if (i === 10) { ${gate(0, 1)} }
      T.pilot({ graze: true, dash: [86] });`,
  },
  // ---- FOLIO III: the Palimpsest Inferno --------------------------------------------------------------------
  {
    name: 'inferno', rng: 20, warm: 40, secs: 3.0,
    setup: `T.start({ folio: 1, quiet: true, score: 131700, mult: 3.4, pos: [0, 1.0], timer: 30 }); T.hud('play');`,
    frame: `
      if (i === 0) { g.folioTimer = 0; g.applyFolioTheme(2, false); }
      if (i === -30) T.mothV(2, -0.3, -170, 7);
      if (i % 20 === 0) T.obstacle('MONOLITH', i % 40 ? 8.5 : -8.5);
      T.pilot({ graze: true, prefY: -1.2, prefYW: 0.6 });`,
  },
  {
    name: 'skate', rng: 21, warm: 40, secs: 3.0,
    setup: `T.start({ folio: 2, quiet: true, score: 140300, mult: 3.8, pos: [0, -2.25], timer: 6 }); T.hud('none');`,
    frame: `
      if (i % 18 === 0) T.obstacle('MONOLITH', (i % 36 ? 1 : -1) * (6.2 + Math.random()));
      if (i === -20) T.mothV(0, 2.8, -175, 7);
      T.pilot({ prefY: -2.25, prefYW: 2, aim: false, graze: true });`,
    cam: `const P = g.playerPos; T.smoothCam([P.x * 0.6 + 1.8, -2.5, 6.5], [P.x * 0.8, -0.5, -30], 56, 0.25);`,
  },
  {
    name: 'fight3', rng: 22, warm: 40, secs: 3.0,
    setup: `T.start({ folio: 2, quiet: true, score: 158800, mult: 4.2, pos: [0, 1.0], timer: 12 }); T.hud('play');`,
    frame: `
      if (i === -40) T.mothV(-3, 1.5, -150, 7);
      if (i === -10) { T.enemy('GARGOYLE', -5, -3, -150, 0); T.enemy('GARGOYLE', 5, -3, -165, 1); T.enemy('GARGOYLE', 0, -3, -180, 2); }
      if (i === 30) T.mothV(3, 2.5, -170, 7);
      if (i === 50) { T.enemy('OPHANIM', -5.5, 2, -170, 0); T.enemy('OPHANIM', 5.5, 3, -185, 1); }
      if (i % 22 === 0) T.obstacle('INKWELL', i % 44 ? 10 : -10);
      T.pilot({ graze: true });`,
  },
  {
    name: 'slalom', rng: 23, warm: 40, secs: 3.0,
    setup: `T.start({ folio: 2, quiet: true, score: 176400, mult: 4.6, pos: [0, 1.0], timer: 18 }); T.hud('play');`,
    frame: `
      const cs = [-4, 3, -2, 5, 0, -5, 2];
      if (i % 20 === 0 && i >= -40 && i < 100) { const c = cs[(i + 40) / 20]; ${gate(0, 'c')} }
      const ng = ${nextObs('MONOLITH')};
      const c = ng ? (g.obstacles.filter(o => o.type === 'MONOLITH' && Math.abs(o.mesh.position.z - ng.mesh.position.z) < 1).reduce((s, o) => s + o.mesh.position.x, 0) / 2 - 0.65) : 0;
      T.pilot({ prefX: c, prefXW: 0.7, prefY: 0.6, prefYW: 0.2, follow: 0.5 });`,
  },
  // ---- the Grand Censor ------------------------------------------------------------------------------------
  {
    name: 'reveal', rng: 24, warm: 30, secs: 2.4,
    setup: `T.start({ folio: 2, quiet: true, score: 212000, mult: 5.0, pos: [0, 1.0], timer: 20 }); T.hud('none');`,
    // the Quill-Strider holds high on the far side so the telephoto sees only the Censor (its reticles hidden too)
    frame: `if (i === 0) g.spawnBoss(); g.reticleNear.visible = g.reticleFar.visible = false; T.pilot({ hold: [-7, 3.5], holdW: 2, aim: false });`,
    cam: `const b = g.boss ? g.boss.mesh.position : { x: 0, y: 2.4, z: -160 };
      T.smoothCam([6.5 - t * 1.2, -1.7 + t * 0.5, 10 - t * 2], [b.x * 0.8, b.y + 1.3, b.z], 25, 0.3);`,
  },
  {
    name: 'sweep', rng: 25, warm: 150, secs: 3.4,
    setup: `T.start({ folio: 2, quiet: true, score: 236000, mult: 5.0, pos: [0, 1.0], timer: 20 }); T.hud('play'); g.spawnBoss(); g.boss.stateTimer = 99;`,
    frame: `
      if (i === -1) T.hideBanner();
      if (i === 0) g.boss.stateTimer = 0;
      if (g.boss) g.boss.hp = Math.max(g.boss.hp, 185 * (0.97 - t * 0.05));
      T.pilot({ graze: true });`,
  },
  {
    name: 'quill', rng: 26, warm: 150, secs: 3.4,
    setup: `T.start({ folio: 2, quiet: true, score: 251000, mult: 5.4, pos: [0, 1.0], timer: 20 }); T.hud('boss'); g.spawnBoss(); g.boss.stateTimer = 99;`,
    frame: `
      if (i === -1) { T.hideBanner(); g.boss.hp = 185 * 0.64; }
      if (i === 2) g.boss.stateTimer = 0.25;
      if (g.boss) g.boss.hp = Math.max(g.boss.hp, 185 * 0.45);
      T.pilot({ graze: true });`,
    cam: `T.bossCam({ side: 4.6, up: 3.2, back: 10, span: 14 });`,
  },
  {
    name: 'shatter', rng: 27, warm: 150, secs: 3.4,
    setup: `T.start({ folio: 2, quiet: true, score: 268000, mult: 5.8, pos: [0, 1.0], timer: 20 }); T.hud('boss'); g.spawnBoss(); g.boss.stateTimer = 99;`,
    frame: `
      if (i === -1) { T.hideBanner(); g.boss.hp = 185 * 0.6; g.boss.phase = 2; }
      if (i === 30) g.boss.hp = 185 * 0.32;
      if (g.boss && i > 30) g.boss.hp = Math.max(g.boss.hp, 185 * 0.2);
      T.pilot({ graze: true });`,
    cam: `T.bossCam({ side: 3.4, up: 2.0, back: 8, span: 9, lift: 0.2 });`,
  },
  {
    name: 'kill', rng: 28, warm: 150, secs: 7.4,
    // the defeat plays at 0.3x for 36 frames on a held telephoto, then the camera cranes out over the scroll
    dt: '(T._dead != null && i - T._dead < 36) ? 0.3 / 60 : 1 / 60',
    setup: `T.start({ folio: 2, quiet: true, score: 289000, mult: 6.2, pos: [0, 1.0], timer: 20 }); T.hud('boss'); g.spawnBoss(); g.boss.stateTimer = 99;`,
    frame: `
      if (i === -1) { T.hideBanner(); g.boss.hp = 185 * 0.3; g.boss.phase = 3; g.boss.maskGroup.visible = false; g.boss.stateTimer = 0.4; }
      if (g.boss && i < 150) g.boss.hp = Math.max(g.boss.hp, 185 * (0.16 - i * 0.0009));
      if (g.boss && i === 150) g.boss.hp = 1;
      T.pilot({ graze: true });`,
    cam: `if (!T.bossCam({ side: 3.8, up: 2.2, back: 9, span: 11 })) {
        if (T._dead == null) { T._dead = i; T.hud('none'); }      // the boss died inside this frame's update()
        const since = i - T._dead, s = T._cs;
        if (since < 36) { s.f *= 0.975; T.cam(s.e, s.l, s.f); }    // crash zoom into the burst
        else {
          const k = T.ease((since - 36) / 150);
          T.smoothCam([1.5 * (1 - k), 2.6 + 7 * k, 9 + 9 * k], [0, 1.0 - 2.5 * k, -60], 50 + 6 * k, 0.05);
        }
      }`,
  },
];
