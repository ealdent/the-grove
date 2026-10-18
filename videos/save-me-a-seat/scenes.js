// scenes.js: the edit. Each scene draws one shot from its local time; cuts land on the song's beats.
'use strict';
const BEATS = DATA.beats;
const beatsIn = (t0, t1) => BEATS.filter(b => b >= t0 - 1e-3 && b < t1 - 1e-3);
const snapT = t => Math.round(t * DRAW_FPS) / DRAW_FPS;
const env = (arr, t) => arr[clamp(Math.round(t * DATA.fps), 0, arr.length - 1)] || 0;
const songLevel = t => env(DATA.rms, t);
const vmLevel = t => env(DATA.vm.env, t);
window.END = 30.29;              // the pilot: the intro and verse 1

// a memory: drawn inside a hand-ruled frame on the page, coloured in crayon
function memoryFrame(fn) {
  const c = F.art, inset = 54;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  const P = jitterPath(densify([[inset, inset], [W - inset, inset], [W - inset, H - inset], [inset, H - inset]], true, 6), true, 2.5, 9001 + BOIL, 1);
  fillPath(c, P); c.clip();
  c.restore(); c.save();
  fn();
  c.restore();
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.__k = 1;
  line([[inset, inset], [W - inset, inset], [W - inset, H - inset], [inset, H - inset]], { closed: true, raw: true, w: 3.2, seed: 9002, ctx: c });
  c.restore();
}

function floorRoom(o = {}) {
  // the hall, seen from inside: back wall, plank floor, the big doors at the back
  const hz = o.horizon ?? 600, vx = o.vx ?? 960;
  wash([[-400, -400], [2400, -400], [2400, hz], [-400, hz]], o.wall || '#d9d3c4', { famp: 4, seed: 1001, edge: false });
  wash([[-400, hz], [2400, hz], [2400, 1500], [-400, 1500]], o.floor || '#b69b7c', { famp: 4, seed: 1002, edge: false });
  line([[-400, hz], [2400, hz + 4]], { w: 2.6, seed: 1003 });
  for (let i = -14; i <= 14; i++) line([[vx + i * 34, hz], [vx + i * 300, 1500]], { w: 1.6, a: 0.45, seed: 1004 + i, over: 0 });
  if (o.doors !== false) {
    const dw = 260, dh = 330, dx = o.doorX ?? 960;
    shape([[dx - dw / 2, hz], [dx - dw / 2, hz - dh], [dx + dw / 2, hz - dh], [dx + dw / 2, hz]], { fill: '#8f7a64', seed: 1040 });
    line([[dx, hz], [dx, hz - dh]], { w: 2.4, seed: 1041 });
    line([[dx - dw / 2 + 6, hz - 3], [dx + dw / 2 - 6, hz - 3]], { w: 4, col: C.gold, seed: 1042 });
    glow(dx, hz, 160, C.gold, 0.35);
  }
}

function hangingBulb(x, y, sway, lit = 1) {
  line([[x, -100], [x + Math.sin(sway) * 30, y - 24]], { w: 2, seed: 1101, over: 0 });
  const bx = x + Math.sin(sway) * 30;
  shape(rrect(bx - 10, y - 30, 20, 16, 4), { fill: C.grey, seed: 1102 });
  shape(ell(bx, y, 20, 24, 14), { fill: mix('#c9b88a', '#fff3c2', lit), seed: 1103 });
  glow(bx, y, 260, '#ffe2a0', 0.55 * lit);
  return bx;
}

// --------------------------------------------------------------------------------------------------------- shots
const S1 = { t: 0, draw(lt, T) {
  // the answering machine: her message plays once; the camera pulls back to find her on the floor
  const v = DATA.vm, playing = T >= v.play && T < v.stop;
  const z = lerp(2.25, 1.0, ease(ramp(lt, 2.4, 7.4))), bump = T >= 7.995 && T < 8.16 ? 1.025 : 1;
  cam(lerp(1095, 960, ease(ramp(lt, 2.4, 7.4))), lerp(640, 560, ease(ramp(lt, 2.4, 7.4))), z * bump);
  floorRoom();
  const sway = Math.sin(T * 1.1) * 0.04 + (T > 7.995 ? Math.sin((T - 7.995) * 6) * 0.08 * Math.exp(-(T - 7.995) * 2) : 0);
  const bx = hangingBulb(1060, 300, sway);
  wash(ell(bx, 900, 420, 70, 24), '#f2cf7c', { fa: 0.35, seed: 1110, edge: false });
  const ch = chair(1100, 880, 1.25, { col: '#8a929c' });
  // reels turn while it plays: spin up after the key goes down, stop dead at the stop key
  const spin = playing ? Math.min(T - v.play, 0.25) / 2 + Math.max(0, T - v.play - 0.25) : (T >= v.stop ? v.stop - v.play - 0.125 : 0);
  const prog = clamp((T - v.play) / (v.stop - v.play));
  const m = machine(1110, ch.seat[1] + 2, 0.62, { reel: spin * TAU * 0.9, left: 1 - prog * 0.5, right: 0.5 + prog * 0.5,
    play: T < v.stop ? 1 : 0, led: playing ? 1 : 0, stopPress: T >= v.stop && T < v.stop + 0.16 ? 1 : 0 });
  // sound: little arcs with her level, and a doodle that floats up with some of her words
  const lvl = playing ? vmLevel(T) : 0;
  if (lvl > 0.08) for (let i = 0; i < 2; i++) line(ell(m.speaker[0] + 30, m.speaker[1], 18 + i * 14 + lvl * 10, 18 + i * 14 + lvl * 10, 8, 0, -0.6, 0.6), { w: 2, a: 0.7 * clamp(lvl * 1.4), seed: 1120 + i, over: 0 });
  const pics = { 'hey,': 'wave', 'Call': 'handset', 'We': 'dots', 'Basilisk.': 'snake', 'real.': 'bang', 'call': 'handset', 'okay?': 'heart' };
  v.words.forEach(([w, a], i) => {
    const kind = pics[w]; if (!kind) return;
    const age = (T - a) / 1.7; if (age < 0 || age > 1) return;
    F.art.globalAlpha = clamp((1 - age) / 0.3);
    pictogram(kind, m.speaker[0] + 20 + age * 90 + Math.sin(age * 5 + i) * 10, m.speaker[1] - 40 - easeOut(age) * 190, 1.5 + age * 0.6, 1200 + i * 20);
    F.art.globalAlpha = 1;
  });
  // the hang-up, a little click over the speaker
  if (T >= v.hang && T < v.hang + 0.3) sparkle(m.speaker[0], m.speaker[1] - 24, 22, { seed: 1300 });
  // her, on the floor beside the chair, hugging her knees
  const R = 32 * 1.25, sad = smooth(ramp(T, 6.9, 7.6)), sigh = T > 7.97 ? Math.sin(clamp((T - 7.97) / 0.5) * Math.PI) * 0.12 : 0;
  // she knows this tape: a flinch at "basilisk", a small sad smile at "okay?"
  const flinch = smooth(ramp(T, 3.5, 3.7)) * (1 - smooth(ramp(T, 4.6, 5.2))), fond = smooth(ramp(T, 7.0, 7.3));
  const pose = { view: 'side', dir: 1, bob: 2.42 + sigh, lean: 0.36 - sigh * 0.5, legA: [2.26, 2.05], legB: [2.18, 1.98], tilt: -0.08 + sad * 0.18,
    face: { look: [0.6, -0.5 + sad * 0.5 - flinch * 0.4], blink: (BOIL % 41 === 0 ? 1 : 0) + sad * 0.3 * (1 - fond), brow: -0.3 - sad * 0.5 + flinch * 0.2,
      lift: flinch * 1.2, smile: 0.1 - sad * 0.4 + fond * 0.55, open: flinch * 0.35 }, seed: 31 };
  const hipY = 880 - 2 * 1.3 * R - 0.16 * R + pose.bob * R, knee = [790 + Math.sin(2.26) * 1.3 * R, hipY + Math.cos(2.26) * 1.3 * R];
  pose.handA = [knee[0] + 0.3 * R, knee[1] + 0.4 * R]; pose.handB = [knee[0] + 0.15 * R, knee[1] + 0.55 * R];
  person(790, 880, 1.25, LOOKS.narrator, pose);
}};

const S2 = { t: snapT(8.48), draw(lt, T) {
  // stagehands pick the stars, fold them flat and stack them on a hand truck
  // open close on the near stagehand folding a star, then pan with the toss to the stack
  const k = ease(ramp(T, 9.9, 10.9));
  cam(lerp(600, 1060, k), lerp(300, 470, k), lerp(2.0, 1.28, k));
  wash([[-200, -300], [2200, -300], [2200, 1400], [-200, 1400]], C.night, { famp: 6, seed: 2001, edge: false });
  const r = mulberry(2002), stars = [];
  for (let i = 0; i < 26; i++) stars.push([80 + r() * 1760, 60 + r() * 520, 14 + r() * 16, r()]);
  const beats = beatsIn(8.48, 12.84), ladders = [[560, 790, 470], [1150, 790, 520]];
  // the picks: one star per beat, alternating ladders, each just above its picker
  const picks = beats.map((b, i) => {
    const L = ladders[i % 2], k = Math.floor(i / 2);
    // beside his reaching hand, never behind his head
    const dx = (i % 2 ? -1 : 1) * (78 + (k % 2) * 34), headY = L[1] - L[2] + 70 - 5.8 * 32 * 0.95;
    return { b, L, at: [L[0] + 6 + dx, headY - 30 - (k % 3) * 26], side: i % 2 };
  });
  stars.forEach(([x, y, rr, ph], i) => star(x, y, rr * (1 + 0.06 * Math.sin(BOIL * 1.7 + i)), { seed: 2010 + i, glow: 0.25 }));
  // the roof they work on
  shape([[-200, 790], [2200, 790], [2200, 1300], [-200, 1300]], { fill: '#6d5f63', seed: 2050 });
  for (let x = -180; x < 2200; x += 60) line([[x, 800], [x - 10, 1300]], { w: 1.5, a: 0.4, seed: 2051 + x, over: 0 });
  for (const L of ladders) ladder(L[0], L[1], L[2], 1.1, { seed: 2100 + L[0], wheels: true });
  // the stack on the hand truck, growing on every catch
  const stackX = 1600, base = 790;
  dolly(stackX - 40, base, 1.1);
  const landed = picks.filter(p => T >= p.b + 0.7).length, h0 = 7;
  for (let i = 0; i < h0 + landed; i++) slab(stackX + Math.sin(i * 1.7) * 4 + (i - h0 - landed) * -0.6, base - 14 - i * 17, 104, 15, { seed: 2200 + i });
  // the third stagehand minds the truck and counts them in
  person(stackX + 120, base, 1.0, LOOKS.stagehand, { view: 'three', dir: -1, seed: 41, handA: [stackX - 60, base - 270], face: { look: [-0.6, -0.4], smile: 0.5 } });
  picks.forEach((p, i) => {
    const [ax, ay] = p.at, f = ramp(T, p.b - 0.05, p.b + 0.25), fly = ramp(T, p.b + 0.25, p.b + 0.7);
    if (T < p.b - 0.05) star(ax, ay, 24, { seed: 2300 + i, glow: 0.3 });
    else if (fly <= 0) {
      star(ax, ay, 24, { fold: f, seed: 2300 + i });
      if (f > 0.1 && f < 0.95) for (const sx of [-1, 1]) line([[ax + sx * 30, ay - 14 * (1 - f)], [ax + sx * 40, ay - 22 * (1 - f)]], { w: 2, seed: 2350 + i + sx, a: 0.7 });
      if (f >= 0.95) sparkle(ax, ay, 26, { seed: 2370 + i, col: C.star });
    }
    else if (fly < 1) {
      const top = base - 14 - (h0 + picks.filter(q => T >= q.b + 0.7).length) * 17;
      const x = lerp(ax, stackX, fly), y = lerp(ay, top, fly) - Math.sin(fly * Math.PI) * 160;
      slab(x, y, 104, 15, { seed: 2400 + i });
    }
    if (T >= p.b) line(starPts(ax, ay, 24, 11), { closed: true, w: 1.4, a: 0.25, seed: 2500 + i, col: '#c8c2b0' });   // where it was
  });
  // the two pickers, reaching for the next star
  ladders.forEach((L, j) => {
    const mine = picks.filter(p => p.side === j), next = mine.find(p => T < p.b + 0.25) || mine[mine.length - 1];
    const reach = next ? smooth(1 - Math.abs(T - next.b) / 0.35) : 0;
    const top = [L[0] + 6, L[1] - L[2] + 70];
    const S = [top[0] + 10, top[1] - 120];
    const hand = next ? [lerp(S[0] + 40, next.at[0], reach), lerp(S[1] + 30, next.at[1] + 10, reach)] : [S[0] + 40, S[1] + 40];
    person(top[0], top[1], 0.95, LOOKS.stagehand, { view: 'three', dir: j ? -1 : 1, seed: 43 + j, handB: hand, handA: [top[0] - 20, top[1] - 90], face: { look: [0.3, -1], smile: 0.4 } });
  });
}};

const S3 = { t: snapT(12.8427), draw(lt, T) {
  // the moon is a bulb on a pull chain, and a janitor gives it two tugs
  cam(960, 540, 1);
  const tugs = [13.33, 14.3], tug = tugs.reduce((a, b) => a + Math.max(0, 1 - Math.abs(T - b - 0.08) / 0.12), 0);
  const lit = T < tugs[0] ? 1 : T < tugs[0] + 0.25 ? 0.55 : T < tugs[1] ? 0.85 : T < tugs[1] + 0.25 ? 0.3 : lerp(0.5, 0.42, ramp(T, 14.6, 16));
  wash([[-200, -300], [2200, -300], [2200, 1400], [-200, 1400]], mix(C.night, '#1d2438', 1 - lit), { famp: 6, seed: 3001, edge: false });
  const r = mulberry(3002);
  for (let i = 0; i < 40; i++) { const x = r() * 1920, y = r() * 560, off = 13.6 + r() * 2.2; star(x, y, 6 + r() * 8, { seed: 3010 + i, col: mix('#7b7a6a', C.star, T < off ? 1 : 0.35) }); }
  const jx = 1290, roof = 700;
  // the lights go out across town, window by window
  const order = mulberry(3100);
  const offs = Array.from({ length: 400 }, () => 13.55 + order() * 2.4), keep = Array.from({ length: 400 }, () => order() < 0.12);
  buildings(-60, 1990, 1100, { seed: 3200, on: (i) => keep[i] ? 0.55 : 1 - smooth(ramp(T, offs[i], offs[i] + 0.15)) });
  shape([[jx - 180, roof], [jx + 160, roof], [jx + 160, 1100], [jx - 180, 1100]], { fill: '#3e4766', seed: 3300 });
  const R = 32 * 1.2, hy = 700 - 5.8 * R - 20 + tug * 26;
  const chainEnd = bulbMoon(1250, 220, 86, { lit, chain: hy - 220 - 86, swing: Math.sin(T * 5) * 0.02 * (1 + tug) });
  const shrug = smooth(ramp(T, 15.0, 15.4)) * (1 - smooth(ramp(T, 15.7, 16.1)));
  person(jx, roof, 1.2, LOOKS.janitor, { view: 'three', dir: -1, seed: 51, handB: [chainEnd[0], chainEnd[1] + 8],
    handA: shrug > 0 ? [jx + 70, roof - 150 - shrug * 30] : [jx + 30, roof - 90], face: { look: [shrug ? 1 : -0.2, shrug ? 0.2 : -1], smile: 0.5 * shrug, brow: shrug * 0.5 } });
  // his mop bucket, for the joke
  shape([[jx + 80, roof], [jx + 72, roof - 52], [jx + 136, roof - 52], [jx + 128, roof]], { fill: C.grey, seed: 3310 });
  line([[jx + 104, roof - 52], [jx + 150, roof - 190]], { w: 4, seed: 3311 });
}};

const S4 = { t: snapT(16.2347), draw(lt, T) {
  // the machine in a museum case, between a clay tablet and a floppy
  const z = lerp(1.0, 1.1, ease(lt / 3.9));
  cam(960, lerp(540, 520, lt / 3.9), z);
  floorRoom({ horizon: 700, wall: '#d8d0c0', floor: '#a99786', doors: false });
  // a spotlight from the ceiling onto the case
  wash([[880, -200], [1040, -200], [1180, 700], [740, 700]], '#fff1c4', { fa: 0.32, edge: false, seed: 4001 });
  glow(960, 420, 360, '#ffe8b0', 0.35);
  vitrine(420, 760, 230, 180, (x, y) => { shape(rrect(x - 55, y - 120, 110, 120, 18), { fill: '#a89a85', seed: 4010 }); for (let i = 0; i < 4; i++) glyph('wedge', x - 25 + (i % 2) * 40, y - 90 + Math.floor(i / 2) * 50, 10, 4011 + i * 3); }, { seed: 4020, plinth: 200 });
  vitrine(1500, 760, 230, 180, (x, y) => { shape(rrect(x - 50, y - 100, 100, 100, 4), { fill: '#3d4a6a', seed: 4030 }); shape(rrect(x - 26, y - 100, 52, 36, 2), { fill: '#b7bcc4', seed: 4031 }); shape(rrect(x - 34, y - 52, 68, 44, 3), { fill: C.cream, seed: 4032 }); }, { seed: 4040, plinth: 200 });
  vitrine(960, 760, 340, 230, (x, y) => machine(x, y, 0.62, { reel: 0, play: 0 }), { seed: 4050, plinth: 260 });
  placard(960, 700, 1.2, ['eye', 'bird', 'water', 'ankh']);
  // the velvet rope
  for (const sx of [770, 1150]) { line([[sx, 880], [sx, 760]], { w: 5, col: '#a8842c', seed: 4060 + sx }); shape(ell(sx, 756, 10, 10, 10), { fill: C.gold, seed: 4062 + sx }); shape(ell(sx, 884, 22, 7, 10), { fill: '#a8842c', seed: 4064 + sx }); }
  line([[770, 770], [960, 820], [1150, 770]], { w: 7, col: '#9e2f35', seed: 4070 });
  // dust in the light
  const rr = mulberry(4080 + BOIL);
  for (let i = 0; i < 14; i++) shape(ell(820 + rr() * 300, 120 + rr() * 500, 2, 2, 6), { fill: '#fff7da', line: false, seed: 4081 + i, fa: 0.8 });
  // the guard, asleep on his stool
  const br = Math.sin(T * 2.2);
  line([[1720, 1000], [1730, 880]], { w: 4, seed: 4090 }); line([[1800, 1000], [1790, 880]], { w: 4, seed: 4091 }); shape(ell(1760, 876, 60, 14, 12), { fill: C.wood, seed: 4092 });
  person(1760, 1000, 1.2, LOOKS.guard, { view: 'front', seed: 61, bob: 1.25 + br * 0.03, legA: [1.45, 1.45], legB: [1.45, 1.45], tilt: 0.25, face: { blink: 1, smile: 0.1 }, handA: [1730, 840], handB: [1790, 840] });
  shape(ell(1795, 668 + br * 3, 12 + br * 6, 10 + br * 5, 12), { fill: '#e8f3f6', fa: 0.6, seed: 4095, w: 1.6, a: 0.6 });
  // her, from behind, looking up at it
  person(980, 1060, 1.55, LOOKS.narrator, { view: 'back', seed: 32, handA: [940, 880], handB: [1020, 880], tilt: -0.05 });
}};

const S5 = { t: snapT(20.112), draw(lt, T) {
  // eyes closed, a hand on her heart, the cassette turning inside her head
  const z = lerp(1.0, 1.08, ease(lt / 3.9));
  cam(960, 560, z);
  wash([[-200, -200], [2200, -200], [2200, 1400], [-200, 1400]], '#c9d3df', { fa: 0.55, famp: 8, seed: 5001, edge: false });
  wash(ell(960, 520, 640, 520, 30), '#f3ead7', { fa: 0.7, edge: false, seed: 5002 });
  const s = 5.0, R = 32 * s, x = 900, y = 650 + 5.78 * R;
  const sing = T > 20.1 && T < 23.2 ? clamp(songLevel(T) * 1.3 - 0.35) : 0;
  const sway = Math.sin(T * 1.4) * 0.03;
  const out = person(x, y, s, LOOKS.narrator, { view: 'three', dir: -1, seed: 33, tilt: sway - 0.05, lean: sway * 0.5,
    face: { blink: 1, brow: -0.35, smile: 0.25, open: sing * 0.7 },
    handA: [x - 0.05 * R, y - 4.2 * R], bow: 0.6,
    after: o => {
      // the cassette turns in a thought bubble over her head, its tape trailing down to her heart
      const [cx, cy] = o.head, bxc = cx + 1.55 * o.R, byc = cy - 1.55 * o.R, ang = T * TAU * 0.9;
      for (const [k, f] of [[0, 0.16], [1, 0.26]]) shape(ell(cx + (0.9 + k * 0.32) * o.R, cy - (0.7 + k * 0.35) * o.R, f * o.R * 0.55, f * o.R * 0.5, 12), { fill: C.cream, seed: 5005 + k });
      const cloud = []; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; cloud.push(...ell(bxc + Math.cos(a) * o.R * 0.92, byc + Math.sin(a) * o.R * 0.62, o.R * 0.36, o.R * 0.3, 10).filter((p, j) => j < 6)); }
      shape(ell(bxc, byc, o.R * 1.15, o.R * 0.8, 30), { fill: C.cream, seed: 5009, w: 2.6 });
      const cw = o.R * 1.3, ch = o.R * 0.78;
      shape(rrect(bxc - cw / 2, byc - ch / 2, cw, ch, 10), { fill: '#e7dcc4', seed: 5011 });
      shape(rrect(bxc - cw * 0.34, byc - ch * 0.28, cw * 0.68, ch * 0.42, 8), { fill: '#4b4440', seed: 5012 });
      for (const [i, dx] of [[0, -0.2], [1, 0.2]]) {
        const rx = bxc + dx * cw, ry = byc - ch * 0.07;
        shape(ell(rx, ry, ch * 0.16, ch * 0.16, 12), { fill: '#7b5b45', seed: 5013 + i });
        for (let k = 0; k < 3; k++) { const a = ang + k * TAU / 3; line([[rx, ry], [rx + Math.cos(a) * ch * 0.12, ry + Math.sin(a) * ch * 0.12]], { w: 2.2, seed: 5015 + k + i * 3 }); }
      }
      // no string from the bubble: with one it read as a balloon in her hand. A heart rises from her hand instead.
      const age = ((lt - 1.0) % 2.4) / 2.4;
      if (lt > 1.0) { F.art.globalAlpha = clamp((1 - age) / 0.3) * clamp(age / 0.15);
        pictogram('heart', o.handA[0] + 0.7 * o.R + easeOut(age) * 0.9 * o.R, o.handA[1] - 0.3 * o.R - easeOut(age) * 0.8 * o.R, 1.6 + age * 0.6, 5030); F.art.globalAlpha = 1; }
    } });
}};

const S6 = { t: snapT(23.9947), draw(lt, T) {
  // a memory, crayoned in: she runs through the rain, the phone at her ear, a police car behind
  const px = lerp(160, 1460, lt / 2.9);
  memoryFrame(() => {
    cam(lerp(820, 1100, lt / 2.9), 540, 1);
    wash([[-200, -200], [2400, -200], [2400, 700], [-200, 700]], '#33395f', { seed: 6000, edge: false, famp: 5 });
    scribble([[-200, -200], [2400, -200], [2400, 700], [-200, 700]], '#4b4f80', { gap: 14, w: 5, seed: 6001, ang: 0.35, a: 0.35 });
    buildings(-100, 2400, 720, { seed: 6010, on: i => (i * 7) % 5 === 0 ? 1 : 0.15 });
    wash([[-200, 700], [2400, 700], [2400, 1400], [-200, 1400]], '#4a4f68', { famp: 4, seed: 6020, edge: false });
    for (let i = 0; i < 18; i++) line([[i * 140 - 100, 760 + (i % 3) * 60], [i * 140 - 60, 1000 + (i % 4) * 40]], { w: 5, a: 0.35, col: i % 4 ? '#e6c47a' : C.red, seed: 6030 + i, over: 0 });
    // the lamp
    line([[1300, 720], [1300, 300], [1360, 280]], { w: 6, seed: 6050 }); shape(ell(1370, 290, 26, 14, 12), { fill: '#fff0c0', seed: 6051 }); glow(1370, 300, 360, '#ffe2a0', 0.5);
    policeCar(1640, 760, 0.85, T);
    rain(-200, -100, 2400, 1200, T, { n: 140, seed: 6060 });
    // her, running, the phone at her ear
    const ph = T * TAU * 2.2, wp = walkPose(ph, { run: true, amp: 0.8 });
    const s = 1.7, R = 32 * s;
    const out = person(px, 860, s, LOOKS.lover, { view: 'side', dir: 1, ...wp, seed: 21, handA: 'ear',
      hold: { A: (h, R) => phone(h[0] + 0.06 * R, h[1] - 0.12 * R, s * 0.6, 0.25, { lit: 0.5 }) } });
    // splashes where her feet come down
    for (let k = 0; k < 12; k++) { const tf = Math.floor(T * 4.4) / 4.4 - k / 4.4; splash(lerp(160, 1460, (tf - 23.99) / 2.9) + 20, 868, (T - tf) / 0.35, 6070 + k); }
    for (let k = 0; k < 4; k++) puff(out.head[0] + 1.3 * R, out.head[1] + 0.2 * R, 24, ((T * 1.6) % 1) - k * 0.25, 6090 + k);
  });
  return { tint: '#f7e6cf' };
}};

const S7 = { t: snapT(26.9013), draw(lt, T) {
  // she stops at the fence to catch her breath, the phone at her ear
  memoryFrame(() => {
    const z = lerp(1.0, 1.12, ease(lt / 3.4));
    cam(940, 560, z);
    wash([[-200, -200], [2400, -200], [2400, 900], [-200, 900]], '#30365a', { seed: 7000, edge: false, famp: 5 });
    scribble([[-200, -200], [2400, -200], [2400, 900], [-200, 900]], '#4b4f80', { gap: 14, w: 5, seed: 7001, ang: 0.3, a: 0.35 });
    glow(1500, 160, 520, '#ffe2a0', 0.55);
    line([[1560, 900], [1560, 150], [1500, 120]], { w: 7, seed: 7002 }); shape(ell(1490, 130, 30, 16, 12), { fill: '#fff0c0', seed: 7003 });
    fence(-200, 2200, 900, 520, { gap: 300 });
    wash([[-200, 900], [2400, 900], [2400, 1400], [-200, 1400]], '#4a4f68', { seed: 7010, edge: false });
    rain(-200, -100, 2400, 1200, T, { n: 120, seed: 7020 });
    const up = smooth(ramp(T, 28.3, 28.9)), s = 3.0, R = 32 * s, x = 900, y = 1180;
    const breathe = Math.sin(T * TAU * 1.6) * (1 - up) * 0.05;
    const out = person(x, y, s, LOOKS.lover, { view: 'three', dir: -1, seed: 22, lean: lerp(0.5, 0.08, up) + breathe, tilt: lerp(0.15, -0.25, up),
      handB: [x - 0.7 * R + up * 0.2 * R, y - lerp(1.7, 2.5, up) * R], handA: 'ear',
      hold: { A: (h, R) => phone(h[0] - 0.02 * R, h[1] - 0.1 * R, s * 0.55, -0.3, { lit: 0.6 }) } });
    // her breath, on her words
    for (const [t0, k] of [[26.95, 0], [27.55, 1], [28.45, 2], [29.15, 3]]) puff(out.head[0] - 1.2 * R, out.head[1] + 0.35 * R, 36, (T - t0) / 0.9, 7030 + k * 5);
  });
  return { tint: '#f7e6cf' };
}};

const SCENES = [S1, S2, S3, S4, S5, S6, S7, { t: 30.29, draw() { return {}; } }];
