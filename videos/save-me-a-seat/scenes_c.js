// scenes_c.js: verse 2 (crayon memories), pre-chorus 2, chorus 2, post-chorus 2 (1:10-2:11).
'use strict';

function crayonNight(col = '#30365a', y1 = 900, sd = 11000) {
  wash([[-300, -300], [2400, -300], [2400, y1], [-300, y1]], col, { seed: sd, edge: false, famp: 5 });
  scribble([[-300, -300], [2400, -300], [2400, y1], [-300, y1]], '#4b4f80', { gap: 14, w: 5, seed: sd + 1, ang: 0.3, a: 0.35 });
}
function shake(k) { return [(rnd01(BOIL * 7 + 1) - 0.5) * k, (rnd01(BOIL * 11 + 2) - 0.5) * k]; }

// ---------------------------------------------------------------- verse 2, in crayon
const C1 = { t: cut(70.197), draw(lt, T) {
  // a phone number: she writes it on her own forearm in marker, at the protest
  memoryFrame(() => {
    cam(960, 560, lerp(1.0, 1.06, ease(lt / 2.9)));
    crayonNight('#33395f', 1400, 11001);
    // the protest behind her: blank signs bobbing over a crowd, a slow police light
    glow(200, 120, 600, Math.sin(T * TAU * 0.6) > 0 ? C.red : C.blue, 0.3);
    for (let i = 0; i < 8; i++) {
      const sx = -60 + i * 280, by = 380 + Math.sin(T * 3 + i * 1.3) * 14;
      line([[sx + 60, by + 120], [sx + 60, by + 20]], { w: 5, col: '#6b5a48', seed: 11010 + i });
      shape(rrect(sx, by - 70, 130, 90, 4), { fill: '#efe6cf', seed: 11020 + i });
      shape(ell(sx + 60, by + 190, 70, 80, 14), { fill: '#262b48', line: false, seed: 11030 + i });
    }
    // her forearm, sleeve pushed back, a fist at the end
    const ay = x => lerp(690, 640, (x + 100) / 1500);
    tube([[-140, ay(-140) + 6], [180, ay(180)], [430, ay(430)]], 230, 210, C.yellow, { seed: 11040 });
    shape(ell(430, ay(430), 40, 110, 14), { fill: shade(C.yellow, 0.9), seed: 11041 });
    tube([[440, ay(440)], [900, ay(900)], [1300, ay(1300)]], 165, 140, C.skin, { seed: 11042 });
    shape(ell(1380, ay(1380) - 4, 105, 85, 18), { fill: C.skin, seed: 11043 });
    for (let k = 0; k < 3; k++) line(ell(1440, ay(1440) - 50 + k * 34, 26, 16, 8, 0, -1.2, 1.2), { w: 2, seed: 11044 + k });
    // the number, in her handwriting
    const p = ramp(T, 70.45, 72.6), tip = scrawl('555-0137', 520, ay(520) - 70, 96, p, { seed: 11050, w: 7 }) || [520, ay(520) - 20];
    // her other hand, holding the marker
    const wob = Math.sin(T * 40) * 3, hx = tip[0] + 60, hy = tip[1] - 70 + wob;
    tube([[hx + 380, hy - 640], [hx + 240, hy - 260], [hx + 40, hy - 30]], 170, 120, C.yellow, { seed: 11060 });
    shape(ell(hx + 60, hy - 50, 70, 26, 12, -0.85), { fill: shade(C.yellow, 0.88), seed: 11064 });
    marker(tip[0], tip[1] + wob * 0.3, 1.6, -0.95);
    shape(ell(hx, hy, 80, 66, 16, -0.6), { fill: C.skin, seed: 11061 });
    for (let k = 0; k < 3; k++) line(ell(hx - 20 + k * 16, hy + 36 - k * 8, 18, 12, 8, -0.6, 0.2, 2.6), { w: 2, seed: 11062 + k });
  });
  return { tint: '#f7e6cf' };
}};

const C2 = { t: cut(73.077), draw(lt, T) {
  // chained to a post of the server farm's fence. The camera on the post turns to look at her. Someone holds an umbrella over her.
  memoryFrame(() => {
    cam(lerp(960, 1040, ease(lt / 4.3)), 600, lerp(1.0, 1.1, ease(lt / 4.3)));
    crayonNight('#30365a', 900, 11101);
    glow(980, 380, 900, '#ffe2a0', 0.25);
    serverFarm(240, 780, 1460, 330, T, { logoX: 0.3 });
    fence(-200, 2200, 900, 480, { gap: 300 });
    wash([[-300, 900], [2400, 900], [2400, 1400], [-300, 1400]], '#4a4f68', { seed: 11110, edge: false });
    rain(-200, -100, 2400, 1300, T, { n: 110, seed: 11111 });
    const cang = lerp(-0.2, 2.1, smooth(ramp(T, 74.3, 74.9)));
    securityCam(1300, 440, cang, 1.3);
    glow(1120, 700, 520, '#ffe2a0', 0.35);
    // the sign she brought, leaning on the fence
    line([[620, 1010], [660, 760]], { w: 6, col: '#8a6647', seed: 11120 });
    shape([[540, 640], [790, 650], [780, 820], [550, 810]], { fill: C.cream, seed: 11121 });
    pictogram('snake', 660, 730, 2.2, 11122);
    line([[580, 670], [750, 790]], { w: 6, col: C.red, seed: 11125 }); line([[750, 670], [580, 790]], { w: 6, col: C.red, seed: 11126 });
    // her, chained to the post, a fist in the air
    const s = 2.0, R = 32 * s, x = 1060, y = 1040, beat = Math.max(0, Math.sin(beatPos(T) * Math.PI)) * 0.3;
    const out = person(x, y, s, LOOKS.lover, { view: 'three', dir: -1, seed: 23, handA: [x + 1.9 * R, y - (5.5 + beat) * R], handB: [x - 0.6 * R, y - 2.7 * R], face: { chin: true } });
    chain([[1000, 900 - 230], [x - 0.8 * R, out.hip[1] - 0.25 * R], [x, out.hip[1] - 0.05 * R], [x + 0.8 * R, out.hip[1] - 0.3 * R]], 1.4);
    padlock(x + 0.05 * R, out.hip[1] + 0.25 * R, 1.3);
    // and the narrator, beside her, holding an umbrella over the two of them
    const ns = 1.8, N = 32 * ns, nx = x + 2.5 * R, hand = [nx - 0.9 * N, y - 4.9 * N];
    person(nx, y, ns, LOOKS.narrator, { view: 'three', dir: -1, seed: 42, handA: hand, handB: [nx - 0.6 * N, y - 4.2 * N], face: { look: [-1, -0.4], brow: -0.4, smile: 0.25 } });
    parasol(hand[0], hand[1], 1.5, 0, '#4b6fc4');
  });
  return { tint: '#f7e6cf' };
}};

const C3 = { t: cut(77.403), draw(lt, T) {
  // hands over her hood, the hum coming in waves, a police light for a halo
  memoryFrame(() => {
    cam(960, 560, lerp(1.0, 1.08, ease(lt / 2.9)));
    crayonNight('#2c3150', 1400, 11201);
    // the server farm, out of focus: its lights as big soft dots
    const r = mulberry(11202);
    for (let i = 0; i < 40; i++) shape(ell(-60 + r() * 600, 200 + r() * 700, 16, 16, 10), { fill: r() < 0.7 ? '#8fe0a0' : '#ffd36a', line: false, fa: 0.55, seed: 11203 + i });
    const [sx, sy] = shake(7), s = 3.4, R = 32 * s, x = 1100 + sx, y = 500 + 5.78 * R + sy;
    const hc = [x, y - 5.78 * R];
    humLines(380, 420, hc[0] - 1.6 * R, hc[1] + 0.1 * R, T, 4, { gap: 34, amp: 12, w: 3, col: '#bfe8c8', a: 0.75 });
    humLines(380, 860, hc[0] - 1.4 * R, hc[1] + 1.0 * R, T + 0.3, 3, { gap: 34, amp: 12, w: 3, col: '#bfe8c8', a: 0.6, seed: 11250 });
    const out = person(x, y, s, LOOKS.lover, { view: 'three', dir: -1, seed: 24, tilt: 0.08, handA: [hc[0] - 1.25 * R, hc[1] + 0.1 * R], handB: [hc[0] + 1.15 * R, hc[1] - 0.1 * R], face: { chin: true } });
    // her teeth chatter with it: little buzz marks at her jaw
    for (let k = 0; k < 3; k++) line([[out.head[0] - 1.5 * R - k * 18, out.head[1] + 0.9 * R + k * 14], [out.head[0] - 1.8 * R - k * 18, out.head[1] + 0.8 * R + k * 14], [out.head[0] - 2.0 * R - k * 18, out.head[1] + 1.0 * R + k * 14]], { w: 3, seed: 11260 + k + BOIL % 2 });
    sirenHalo(out.head[0] - 0.1 * R, out.head[1] - 1.42 * R, 1.6, T);
  });
  return { tint: '#f7e6cf' };
}};

const C4 = { t: cut(80.283), draw(lt, T) {
  // in bed she starts to say the basilisk's name and gets a pillow. Something under the bed hears it anyway.
  memoryFrame(() => {
    cam(960, 560, lerp(1.04, 1.0, ease(lt / 3.8)));
    wash([[-300, -300], [2400, -300], [2400, 1400], [-300, 1400]], '#8a6a4c', { seed: 11301, edge: false });
    for (let x = -280; x < 2400; x += 110) line([[x, -300], [x + 6, 1400]], { w: 2, a: 0.45, seed: 11302 + x, over: 0 });
    wash([[1300, -300], [1760, -300], [1500, 1400], [1040, 1400]], '#d9cdb0', { fa: 0.35, seed: 11303, edge: false });
    shape(ell(860, 1010, 520, 120, 24), { fill: '#7f4f4a', seed: 11304 });
    scribble(ell(860, 1010, 500, 110, 24), '#9a6460', { gap: 9, w: 5, seed: 11305, a: 0.6 });
    // the basilisk, under the bed: it peeks out when it hears itself mentioned
    const peek = smooth(ramp(T, 82.0, 82.45)) * (1 - smooth(ramp(T, 83.45, 83.75)));
    if (peek > 0.01) { const c = F.art; c.save(); c.translate(720 - peek * 160, 830); c.scale(-1, 1);
      crownSnake(-40, 0, 1.4, { blink: T > 82.8 && T < 82.95 ? 1 : 0, look: 0.6, tongue: T > 83.0 && T < 83.25 }); c.restore(); }
    const bed = bedTop(900, 110, 1.0);
    // the two of them, side by side; her face in its hood, even in bed
    const s = 1.35, R = 32 * s, [pn, pl] = bed.pillows;
    const say = smooth(ramp(T, 80.75, 81.0)), whump = T >= 81.35, flail = T > 81.5 && T < 83.0;
    person(pn[0], pn[1] + 5.78 * R, s, LOOKS.narrator, { view: 'front', seed: 43, tilt: -0.12, handA: [pn[0] - R, pn[1] + 4 * R], handB: [pn[0] + R, pn[1] + 4 * R],
      face: { look: [1, 0], open: say * 0.5 * (whump ? 0 : 1), brow: -0.1, smile: 0.2 } });
    // the pillow she brings down, and her own arm (attached, the size of an arm) pressing it: at 1:21 a separate
    // yellow tube three arms wide read as a huge disconnected thing (Jason, 2026-10-18)
    const k = whump ? clamp((T - 81.35) / 0.15) : 0, pat = T > 83.0 ? Math.max(0, Math.sin((T - 83) * TAU * 2.1)) * 8 : 0;
    const roll = smooth(ramp(T, 81.15, 81.4)), pil = [lerp(pl[0] - 150, pn[0] + 6, k), lerp(pl[1] - 70, pn[1] + 6, k) + pat], grip = [pil[0] + 94, pil[1] + 6];
    const lx = pl[0] - 66 * roll;
    person(lx, pl[1] + 5.78 * R, s, LOOKS.lover, { view: 'front', seed: 25, tilt: lerp(0.1, -0.22, roll), handB: [lx + R, pl[1] + 4 * R],
      handA: whump ? grip : [lx - R, pl[1] + 4 * R] });
    quilt(900, bed.quiltTop, bed.W, 110 + bed.L - 20, 1.0);
    if (!whump && say > 0.3) {
      // the word, starting to come out
      const bx = pn[0] + 120, by = pn[1] - 120;
      shape(ell(bx, by, 80, 54, 18), { fill: '#fbf8f0', seed: 11320 }); shape([[bx - 50, by + 30], [pn[0] + 30, pn[1] - 20], [bx - 20, by + 44]], { fill: '#fbf8f0', seed: 11321 });
      pictogram('snake', bx - 12, by + 4, 1.5, 11322);
    }
    if (flail) for (const sx of [-1, 1]) { const w = Math.sin(T * 26 + sx) * 18; shape(ell(pn[0] + sx * 90 + w, bed.quiltTop - 6 + Math.abs(w) * 0.5, 16, 14, 10), { fill: C.skin, seed: 11330 + sx }); }
    if (whump) {
      // her pillow comes down: whump
      const c = F.art; c.save(); c.translate(pil[0], pil[1]); c.rotate(-0.12); c.scale(lerp(0.9, 1.0, k), lerp(0.9, 0.94, k));
      shape(rrect(-96, -56, 192, 112, 38), { fill: '#fbf8f0', seed: 11341 }); line([[-64, 0], [64, 3]], { w: 1.6, a: 0.4, seed: 11342 }); c.restore();
      shape(ell(grip[0], grip[1], 0.21 * R, 0.19 * R, 12), { fill: C.skin, seed: 11343, w: 2 });
      if (T < 81.8) for (let i = 0; i < 4; i++) { const a = -0.6 - i * 0.7; line([[pn[0] + Math.cos(a) * 150, pn[1] + Math.sin(a) * 110], [pn[0] + Math.cos(a) * 190, pn[1] + Math.sin(a) * 140]], { w: 3, seed: 11350 + i }); }
      for (let i = 0; i < 3; i++) { const age = clamp((T - 81.4 - i * 0.15) / 2.4); if (age > 0 && age < 1) shape(ell(pn[0] - 140 + i * 130 + Math.sin(age * 9 + i) * 30, pn[1] - 60 - age * 150 + age * age * 260, 12, 6, 8, age * 4 + i), { fill: '#ffffff', seed: 11360 + i, w: 1.4 }); }
    }
    // the nightstand: the lamp, her phone
    shape(rrect(1260, 180, 200, 200, 10), { fill: '#7a5a3e', seed: 11370 });
    shape(ell(1320, 250, 50, 50, 16), { fill: '#f0deb0', seed: 11371 }); glow(1320, 250, 300, '#ffe2a0', 0.35);
    phone(1410, 320, 1.2, 0.3, { lit: 0 });
  });
  return { tint: '#f7e6cf' };
}};

const C5 = { t: cut(84.123), draw(lt, T) {
  // her hands in the soil, planting; on the other half of the page, a hand going to pixels
  memoryFrame(() => {
    cam(960, 540, 1);
    // dirt
    wash([[-300, -300], [960, -300], [960, 560], [-300, 560]], '#e9dcc0', { seed: 11401, edge: false });
    shape([[-300, 560], [960, 556], [960, 1400], [-300, 1400]], { fill: '#7a5a3e', seed: 11402, line: false });
    scribble([[-300, 560], [960, 556], [960, 1400], [-300, 1400]], '#5e4430', { gap: 11, w: 6, seed: 11403, a: 0.5 });
    line([[-300, 562], [960, 556]], { w: 3, seed: 11404 });
    const r = mulberry(11405); for (let i = 0; i < 18; i++) shape(ell(r() * 940, 620 + r() * 420, 8 + r() * 10, 6 + r() * 6, 8), { fill: '#a8907a', seed: 11406 + i });
    const wpts = []; for (let i = 0; i <= 10; i++) wpts.push([200 + i * 14, 860 + Math.sin(i * 0.9 + T * 4) * 10]); line(wpts, { w: 9, col: '#d48a86', seed: 11430 });
    const g = ramp(T, 85.0, 87.8), pat = Math.max(0, Math.sin(beatPos(T) * Math.PI)) * 10;
    seedling(480, 560, 2.2, g);
    for (const [sx, sd] of [[-1, 11440], [1, 11441]]) {
      const hx = 480 + sx * 120, hy = 540 + pat;
      tube([[hx + sx * 170 - 60, -80], [hx + sx * 90 - 30, hy - 260], [hx + sx * 8, hy - 34]], 130, 100, C.yellow, { seed: sd });
      shape(ell(hx + sx * 10, hy - 40, 52, 20, 12, sx * 0.25), { fill: shade(C.yellow, 0.88), seed: sd + 9 });
      shape(ell(hx, hy, 66, 46, 14, sx * 0.3), { fill: C.skin, seed: sd + 2 });
      for (let k = 0; k < 3; k++) line(ell(hx - sx * 20 + k * 12 * sx, hy + 20, 14, 10, 8, 0, 0.2, 2.8), { w: 1.8, seed: sd + 4 + k });
    }
    // data
    wash([[960, -300], [2400, -300], [2400, 1400], [960, 1400]], '#dbe6ee', { seed: 11450, edge: false });
    for (let x = 980; x < 2300; x += 44) line([[x, -300], [x, 1400]], { w: 1.2, col: '#7f9fc0', a: 0.45, seed: 11451 + x, over: 0 });
    for (let y = -280; y < 1400; y += 44) line([[960, y], [2300, y]], { w: 1.2, col: '#7f9fc0', a: 0.45, seed: 11452 + y, over: 0 });
    const gone = i => clamp(ramp(T, 85.9 + i * 0.35, 87.1 + i * 0.35)) * (i === 4 ? 0.55 : 1);
    openHand(1440, 640, 2.0, -0.15, C.narr, { gone, sleeve: 700 });
    // pixels drifting off where she goes
    for (let i = 0; i < 5; i++) for (let k = 0; k < 7; k++) {
      const born = 85.9 + i * 0.35 + k * 0.17, age = (T - born) / 1.6; if (age < 0 || age > 1 || gone(i) <= 0) continue;
      const fx = 1440 + [-74, -26, 22, 66, 0][i] * 1.9 + k * 6, fy = 640 - [190, 220, 214, 180, 20][i] * 1.2;
      const px = fx + age * (120 + k * 30), py = fy - age * (200 + k * 24), sz = 22 * (1 - age * 0.5);
      F.art.globalAlpha = 1 - age;
      shape(rrect(px - sz / 2, py - sz / 2, sz, sz, 2), { fill: k % 3 ? C.skin : '#8fb3dc', seed: 11470 + i * 9 + k, w: 1.4 });
      F.art.globalAlpha = 1;
    }
    // the fold down the middle of the page
    line([[960, -300], [960, 1400]], { w: 3, seed: 11490, raw: true }); line([[972, -300], [972, 1400]], { w: 1.4, a: 0.5, seed: 11491, raw: true });
  });
  return { tint: '#f7e6cf' };
}};

const C6 = { t: cut(88.923), draw(lt, T) {
  // a little mound with a flower, and her raincoat hung on a branch
  memoryFrame(() => {
    cam(lerp(1000, 1060, ease(lt / 2.9)), 600, lerp(1.0, 1.12, ease(lt / 2.9)));
    wash([[-300, -300], [2400, -300], [2400, 1400], [-300, 1400]], '#c9d3df', { seed: 11501, edge: false });
    wash([[-300, 420], [2400, 420], [2400, 1400], [-300, 1400]], '#efd2c4', { fa: 0.6, famp: 10, seed: 11502, edge: false });
    scribble([[-300, -300], [2400, -300], [2400, 640], [-300, 640]], '#e3c7c0', { gap: 16, w: 5, seed: 11503, a: 0.3 });
    const gl = []; for (let x = -300; x <= 2400; x += 100) gl.push([x, 820 + Math.sin(x * 0.003) * 16]);
    shape([...gl, [2400, 1400], [-300, 1400]], { fill: '#8fae6e', seed: 11504, raw: false });
    scribble([...gl, [2400, 1400], [-300, 1400]], '#7a9a5a', { gap: 12, w: 5, seed: 11505, a: 0.5 });
    mound(900, 840, 1.3);
    flower(900, 744, 1.3, smooth(ramp(T, 89.3, 90.4)));
    // the young tree and the coat on its branch, swaying a little
    line([[1300, 840], [1290, 600], [1300, 420]], { w: 18, col: '#6b4a2e', seed: 11510 });
    line([[1296, 470], [1420, 404], [1530, 410]], { w: 9, col: '#6b4a2e', seed: 11511 });
    line([[1298, 560], [1180, 500]], { w: 7, col: '#6b4a2e', seed: 11512 });
    for (const [lx, ly] of [[1300, 380], [1190, 480], [1520, 380], [1390, 340]]) shape(ell(lx, ly, 70, 50, 14), { fill: '#7ab55a', seed: 11513 + lx });
    hungCoat(1450, 408, 1.0, Math.sin(T * 1.4) * 0.06);
    const dr = mulberry(11520 + BOIL); for (let i = 0; i < 4; i++) shape(ell(1150 + dr() * 400, 460 + dr() * 300, 4, 6, 8), { fill: '#bcd6ea', seed: 11521 + i, w: 1.2 });
  });
  return { tint: '#f7e6cf' };
}};

// ---------------------------------------------------------------- pre-chorus 2
const C7 = { t: cut(91.803), draw(lt, T) {
  // the balance has tipped to her sign and stuck there. She pokes the house side; it bobs back up.
  cam(1160, 560, lerp(1.3, 1.38, ease(lt / 2.4)));
  wash([[-200, -200], [2200, -200], [2200, 800], [-200, 800]], '#d6bf98', { famp: 4, seed: 9101, edge: false });
  for (let x = -160; x < 2200; x += 90) line([[x, -200], [x + 4, 800]], { w: 5, col: '#c8ad84', a: 0.5, seed: 9102 + x, over: 0 });
  shape(rrect(1560, 140, 360, 330, 6), { fill: C.night, seed: 9110 });
  line([[1740, 140], [1740, 470]], { w: 6, col: C.wood, seed: 9113 }); line([[1560, 305], [1920, 305]], { w: 6, col: C.wood, seed: 9114 });
  line([[1000, -200], [1000, 150]], { w: 2.4, seed: 9120 });
  shape([[920, 210], [950, 150], [1050, 150], [1080, 210]], { fill: '#4f6f6a', seed: 9121 });
  const pokes = beatsIn(91.9, 94.1).filter((b, i) => i % 2 === 1);
  const tilt = 1.0 - pokes.reduce((a, b) => a + (T >= b ? Math.exp(-(T - b) * 4) * Math.sin(Math.min(1, (T - b) * 6) * Math.PI / 2) * 0.35 : 0), 0);
  const s = 2.4, R = 32 * s, nx = 1600, ny = 760 + 4.59 * R;
  const out = person(nx, ny, s, LOOKS.narrator, { view: 'three', dir: -1, seed: 34, lean: 0.35, tilt: -0.16,
    handA: [nx - R, ny - 0.5 * R], handB: [nx, ny - 0.5 * R], face: { look: [-0.9, 0.2], brow: -0.6, smile: -0.35 } });
  shape([[-200, 760], [2200, 760], [2200, 1300], [-200, 1300]], { fill: C.wood, seed: 9130 });
  line([[-200, 790], [2200, 790]], { w: 2, a: 0.5, seed: 9131 });
  const bal = { x: 1080, y: 800, s: 1.35 };
  balance(bal.x, bal.y, bal.s, tilt, (x, y, k) => {
    tinySign(x - 10 * k, y, k); pictogram('snake', x - 4 * k, y - 96 * k, 0.75 * k, 9140);
    line([[x - 30 * k, y - 118 * k], [x + 26 * k, y - 76 * k]], { w: 3.2, col: C.red, seed: 9145 }); line([[x + 26 * k, y - 118 * k], [x - 30 * k, y - 76 * k]], { w: 3.2, col: C.red, seed: 9146 });
  }, (x, y, k) => tinyHouse(x, y - 2, k, { lit: false, heart: false }));
  // her arm, reaching out to poke the house side
  const a = tilt * 0.32, pan = [bal.x + Math.cos(a) * 200 * bal.s, bal.y - 220 * bal.s - Math.sin(a) * 200 * bal.s + 120 * bal.s];
  const reach = pokes.reduce((m, b) => Math.max(m, smooth(1 - Math.abs(T - b + 0.05) / 0.3)), 0), hc = out.head;
  const tipP = [lerp(hc[0] - 0.9 * R, pan[0] + 50, reach), lerp(764, pan[1] - 10, reach)];
  tube([[hc[0] + 1.55 * R, 792], [lerp(hc[0] + 0.3 * R, (tipP[0] + hc[0]) / 2 + 40, reach), lerp(778, (tipP[1] + 780) / 2, reach)], tipP], 0.46 * R, 0.37 * R, C.narr, { seed: 9150 });
  shape(ell(tipP[0], tipP[1], 0.21 * R, 0.19 * R, 12), { fill: C.skin, seed: 9151 });
  line([[tipP[0] - 0.1 * R, tipP[1] - 0.05 * R], [tipP[0] - 0.42 * R, tipP[1] - 0.1 * R]], { w: 0.14 * R, col: C.skin, seed: 9154, over: 0 });
}};

const C8 = { t: cut(94.192), draw(lt, T) {
  // the flip-book again. On its roof, now, there is only her.
  cam(960, 560, lerp(1.12, 1.2, ease(lt / 1.9)));
  wash([[-200, -200], [2200, -200], [2200, 1400], [-200, 1400]], '#cdb994', { famp: 4, seed: 9201, edge: false });
  shape([[-200, 760], [2200, 760], [2200, 1400], [-200, 1400]], { fill: C.wood, seed: 9202 });
  flipbook(960, 760, 2.2, T, (i, x, y, k) => {
    const w = 280 * k, h = 190 * k, u = (i % 28) / 28;
    wash([[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]], C.night, { seed: 9210, edge: false });
    const r = mulberry(9211 + (i % 5));
    for (let j = 0; j < 9; j++) star(x - w / 2 + 14 * k + r() * (w - 28 * k), y - h / 2 + 10 * k + r() * h * 0.45, 3.5 * k, { seed: 9212 + j, w: 1.2 });
    const mx = x - w * 0.4 + u * w * 0.62, my = y - h * 0.06 - Math.sin(u * Math.PI) * h * 0.28, mr = 17 * k;
    shape(ell(mx, my, mr, mr, 16), { fill: C.cream, seed: 9230 });
    const ph = Math.cos(u * TAU * 3);
    shape(ell(mx + mr * 1.1 * Math.sign(ph || 1) * (1 - Math.abs(ph)) + mr * 0.9 * ph, my, mr * 0.95, mr * 1.02, 16), { fill: C.night, line: false, seed: 9231, edge: false });
    shape([[x - w * 0.42, y + h / 2], [x - w * 0.1, y + h * 0.12], [x + w * 0.24, y + h * 0.12], [x + w * 0.5, y + h / 2]], { fill: '#b44a3a', seed: 9240 });
    shape(rrect(x + w * 0.1, y + h * 0.0, 18 * k, 26 * k, 2 * k), { fill: '#8a6647', seed: 9241 });
    const by = y + h * 0.1;
    shape(ell(x - 12 * k, by, 12 * k, 15 * k, 10), { fill: C.narr, seed: 9242 }); shape(ell(x - 12 * k, by - 19 * k, 9 * k, 9 * k, 10), { fill: C.hairN, seed: 9243 });
  });
}};

const C9 = { t: cut(96.107), draw(lt, T) {
  // she sits by the window while the centuries go by outside it
  cam(960, 560, 1.0);
  wash([[-200, -200], [2200, -200], [2200, 1400], [-200, 1400]], '#d9c6a6', { famp: 4, seed: 11601, edge: false });
  shape([[-200, 860], [2200, 860], [2200, 1400], [-200, 1400]], { fill: '#a9876a', seed: 11602 });
  // the window: the moon goes round and round; the city outside grows up
  const wx = 1100, wy = 140, ww = 640, wh = 560, k = lt / 1.92;
  shape(rrect(wx, wy, ww, wh, 6), { fill: C.night, seed: 11603 });
  for (let j = 0; j < 5; j++) { const u = (lt * 2.6 + j * 0.2) % 1; F.art.globalAlpha = 0.25 + 0.75 * (j === 4 ? 1 : 0.2);
    shape(ell(wx + 40 + u * (ww - 80), wy + 300 - Math.sin(u * Math.PI) * 220, 26, 26, 14), { fill: C.cream, seed: 11604 + j, w: 1.6 }); }
  F.art.globalAlpha = 1;
  for (let i = 0; i < 7; i++) { const bh = 80 + (i * 37 % 60) + k * (120 + (i * 53 % 160)), bx = wx + 20 + i * 88;
    shape([[bx, wy + wh], [bx, wy + wh - bh], [bx + 70, wy + wh - bh], [bx + 70, wy + wh]], { fill: '#3e4766', seed: 11610 + i });
    for (let yy = wy + wh - bh + 14; yy < wy + wh - 14; yy += 26) shape(rrect(bx + 14, yy, 12, 10, 2), { fill: C.gold, line: false, seed: 11620 + i + yy }); }
  line([[wx + ww / 2, wy], [wx + ww / 2, wy + wh]], { w: 7, col: C.wood, seed: 11630 }); line([[wx, wy + wh / 2], [wx + ww, wy + wh / 2]], { w: 7, col: C.wood, seed: 11631 });
  line(rrect(wx, wy, ww, wh, 6), { closed: true, w: 9, col: C.wood, seed: 11632 });
  // the calendar on the wall loses its pages
  shape(rrect(520, 160, 170, 210, 4), { fill: '#fbf6ea', seed: 11640 }); shape(rrect(520, 160, 170, 46, 4), { fill: C.red, seed: 11641 });
  for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) line([[536 + j * 30, 226 + i * 34], [552 + j * 30, 226 + i * 34]], { w: 2, a: 0.5, seed: 11642 + i * 5 + j, over: 0 });
  for (let i = 0; i < 6; i++) { const age = ((lt * 3.2 + i / 6) % 1); const px = 600 + age * 260 + i * 10, py = 260 - Math.sin(age * Math.PI) * 140 + age * 300;
    const c = F.art; c.save(); c.translate(px, py); c.rotate(age * 5 + i); shape(rrect(-60, -70, 120, 140, 4), { fill: '#fbf6ea', seed: 11660 + i, w: 1.8 }); shape(rrect(-60, -70, 120, 28, 4), { fill: C.red, seed: 11670 + i, w: 1.6 }); c.restore(); }
  // the plant beside her grows into a tree
  const pg = 0.3 + k * 1.4;
  shape([[470, 860], [450, 760], [590, 760], [570, 860]], { fill: '#b45a3a', seed: 11680 });
  line([[520, 760], [516, 760 - 260 * pg], [530, 760 - 420 * pg]], { w: 8 + 10 * pg, col: '#6b4a2e', seed: 11681 });
  for (let i = 0; i < 5; i++) shape(ell(520 + Math.cos(i * 1.3) * 90 * pg, 760 - 380 * pg + Math.sin(i * 1.9) * 70 * pg, 70 * pg + 10, 50 * pg + 8, 12), { fill: '#7ab55a', seed: 11682 + i });
  // her, in the one chair, the same the whole time
  const s = 1.9, R = 32 * s;
  seatedChair(840, 900, s, LOOKS.narrator, { seed: 44, face: { look: [1, -0.3], smile: 0.15, blink: BOIL % 29 === 0 ? 1 : 0 }, handA: [840 + 1.1 * R, 900 - 1.7 * R], handB: [840 + 1.3 * R, 900 - 1.6 * R] });
}};

const C10 = { t: cut(98.027), draw(lt, T) {
  // a shrug
  cam(960, 560, lerp(1.0, 1.05, ease(lt / 1.9)));
  wash([[-200, -200], [2200, -200], [2200, 1400], [-200, 1400]], '#c9d3df', { fa: 0.55, famp: 8, seed: 5001, edge: false });
  wash(ell(960, 540, 640, 520, 30), '#f3ead7', { fa: 0.7, edge: false, seed: 5002 });
  const sh = Math.sin(clamp((T - 98.3) / 0.9) * Math.PI), s = 4.6, R = 32 * s, x = 960, y = 640 + 5.78 * R;
  person(x, y, s, LOOKS.narrator, { view: 'front', seed: 33, bob: sh * 0.12, tilt: 0.1 * sh,
    handA: [x - lerp(1.0, 1.7, sh) * R, y - lerp(2.3, 4.2, sh) * R], handB: [x + lerp(1.0, 1.7, sh) * R, y - lerp(2.3, 4.2, sh) * R],
    face: { look: [0.7, 0.2], brow: -0.3 + sh * 0.3, smile: 0.25, blink: T > 99.2 && T < 99.35 ? 1 : 0 } });
}};

// ---------------------------------------------------------------- chorus 2
const C11 = { t: cut(99.941), draw(lt, T) {
  // the rows are full now. The T. rex tries a folding chair.
  const k = ease(lt / 5.7);
  cam(lerp(760, 1600, k), lerp(800, 760, k), 1.08);
  nightPage({ seed: 11701 });
  bulbMoon(1500, 110, 64, { lit: 0.5, chain: 0, swing: Math.sin(T * 0.8) * 0.02 });
  skyDoors(160, hillY(160) + 4, 380, 520, 0.9);
  tornEdge(TEAR);
  const looks = [0, 4, 7, 1, 9, 3, 6, 11, 2, 5, 8, 10, 12];
  for (let ri = 0; ri < 3; ri++) for (let j = 0; j < rowCount(ri); j++) {
    const [x, y, s] = rowSeat(ri, j), n = ri * 7 + j * 3;
    if (ri === 2 && j === 1) {
      // the T. rex sits down, and the chair folds flat under it
      const fold = T >= 102.33, sq = fold ? clamp((T - 102.33) / 0.12) : 0;
      if (!fold) fchair(x, y, SIT * s); else slab(x, y - 8, 120, 14, { seed: 11710, col: '#8b96a3' });
      trex(x - 40, y - (fold ? 0 : 70), 0.95, { ph: 0 });
      if (fold) { const k = 32; shape(ell(x + 120, y - 330, 14, 10, 8), { fill: '#bcd6ea', seed: 11716, w: 1.4 }); }
      if (fold && T < 102.9) for (let i = 0; i < 3; i++) puff(x - 160 + i * 140, y - 10, 40, (T - 102.33) / 0.6, 11712 + i * 4);
      continue;
    }
    if (n % 5 === 3 || (ri === 2 && (j === 0 || j === 2))) { fchair(x, y, SIT * s); continue; }
    seatedChair(x, y, s * 0.95, LOOKS[GUESTS[looks[n % looks.length]]], { seed: 700 + n, face: { look: [1, n % 3 ? 0 : -0.3], smile: 0.6, open: (Math.floor(T * 3 + n) % 4 === 0) ? 0.3 : 0, blink: (BOIL + n * 3) % 37 === 0 ? 1 : 0 },
      handA: [x + 0.9 * 32 * s, y - 2.0 * 32 * s], handB: [x + 1.1 * 32 * s, y - 2.1 * 32 * s] });
  }
}};

const C12 = { t: cut(105.685), draw(lt, T) {
  // through a canyon of chair towers
  cam(960, 540, 1);
  const u = lt * 900;
  nightSky({ seed: 11801, stars: 50 });
  for (let i = 0; i < 12; i++) { const x = ((i * 270 - u * 0.4) % 3240 + 3240) % 3240 - 300; stackedChairs(x, 860, 12 + (i * 7) % 9, 0.7, 11810 + i * 30); }
  shape([[-300, 860], [2300, 860], [2300, 1400], [-300, 1400]], { fill: '#d8c39c', seed: 11802 });
  const s = 1.6, R = 32 * s, x = 960, y = 980;
  person(x, y, s, LOOKS.narrator, { view: 'side', dir: 1, ...walkPose(T * TAU * 2.4, { run: true }), seed: 45, face: { look: [1, 0], brow: -0.5, open: 0.3 } });
  for (let k = 0; k < 2; k++) puff(x - 1.2 * R, y - 0.2 * R, 22, ((T * 2.4 + k / 2) % 1), 11850 + k * 4);
  for (let i = 0; i < 5; i++) { const x2 = ((i * 640 - u * 1.5) % 3200 + 3200) % 3200 - 400; stackedChairs(x2, 1300, 14, 1.3, 11860 + i * 40); }
}};

const C13 = { t: cut(107.595), draw(lt, T) {
  // a family photo, every era in it. The T. rex squeezes in at the back. The camera goes poof.
  cam(980, 760, 1.18);
  nightPage({ seed: 11901, y0: 780 });
  glow(940, 700, 900, '#ffe2a0', 0.25);
  const settle = smooth(ramp(T, 107.7, 109.0)), r = mulberry(11902);
  const spots = [];
  for (let i = 0; i < 6; i++) spots.push([360 + i * 190, 860, 1.05, 'back']);
  for (let i = 0; i < 6; i++) spots.push([280 + i * 200, 960, 1.2, 'mid']);
  for (let i = 0; i < 5; i++) spots.push([360 + i * 210, 1080, 1.35, 'front']);
  // the T. rex pushes its head in at the back
  const rexIn = smooth(ramp(T, 109.0, 109.5));
  trex(lerp(-200, 820, rexIn), 870, 0.95, { ph: rexIn < 1 ? T * 10 : 0 });
  const puffAt = 110.55, held = T < puffAt + 0.4;
  spots.forEach(([fx, fy, s, row], i) => {
    const sx0 = r() * 1800, sy0 = 860 + r() * 220, x = lerp(sx0, fx, settle), y = lerp(sy0, fy, settle), R = 32 * s;
    const pose = { view: 'front', seed: 760 + i * 5, face: { smile: held ? 0.8 : 0.5, blink: !held && (BOIL + i) % 9 === 0 ? 1 : (T > puffAt && T < puffAt + 0.15 ? 1 : 0), look: [0, 0] } };
    if (settle < 1) Object.assign(pose, walkPose(T * 8 + i), { view: 'three', dir: fx > sx0 ? 1 : -1 });
    if (row === 'front') { fchair(x, y, SIT * s); Object.assign(pose, { view: 'front', bob: (2.76 * R - 150 * SIT * s) / R, legA: [0.3, 0.3], legB: [-0.3, 0.3] }); }
    if (row === 'back') Object.assign(pose, i === 2 ? { handA: [x - 0.4 * R, y - 6.9 * R] } : {});
    guest(i * 3 + 2, x, y, s, pose);
  });
  // the photographer, under his cloth
  const px = 1660, py = 1060;
  bellowsCamera(px - 120, py, 1.3, (T - puffAt) / 1.2);
  person(px + 10, py, 1.3, LOOKS.stagehand, { view: 'side', dir: -1, seed: 48, handA: [px - 90, py - 330], bob: 0.2, lean: 0.25 });
  shape([[px - 90, py - 330], [px - 10, py - 362], [px + 56, py - 318], [px + 64, py - 214], [px - 70, py - 226]], { fill: '#2f2a33', seed: 11931, raw: true });
}};

const C14 = { t: cut(111.419), draw(lt, T) {
  // a conga line through the chairs, the T. rex at the front
  const lead = lerp(900, 1900, lt / 3.82);
  cam(lead - 380, 760, 1.05);
  nightPage({ seed: 12001, y0: 800 });
  lightSpots(T, 10, { seed: 12002, y0: 880, y1: 1150, x0: 0, x1: 2600 });
  for (let j = 0; j < 9; j++) { const cx = 200 + j * 300; fchair(cx, 880, 0.55); }
  const order = ['rex', 0, 4, 9, 7, 1, 3, 8, 6, 12, 10, 5, 2], bp = beatPos(T);
  const kick = (Math.floor(bp) % 4 === 3) ? Math.sin((bp % 1) * Math.PI) : 0;
  const ppl = order.map((g, k) => { const x = lead - k * 150 - (k ? 120 : 0), y = 1040 + Math.sin(x * 0.006) * 40; return { g, k, x, y }; }).sort((a, b) => a.y - b.y);
  ppl.forEach(({ g, k, x, y }) => {
    if (g === 'rex') { trex(x, y, 0.95, { ph: bp * Math.PI }); return; }
    const s = 1.2, R = 32 * s, wp = walkPose(bp * Math.PI + k * 0.2, { amp: 0.7 });
    if (kick) wp.legB = [-0.9 * kick, 0.3];
    guest(g, x, y, s, { view: 'side', dir: 1, ...wp, handA: [x + 1.6 * R, y - 4.3 * R], handB: [x + 1.5 * R, y - 4.1 * R], face: { smile: 0.85, blink: (BOIL + k) % 23 === 0 ? 1 : 0 } });
  });
}};

const C15 = { t: cut(115.243), draw(lt, T) {
  // she runs along the saved seats grabbing what's on them and throwing it over her shoulder
  const s = 1.6, R = 32 * s, x = lerp(300, 2350, lt / 4.78), y = 1010;
  cam(x + 200, 680, 1.15);
  nightSky({ seed: 12101, stars: 30 }); hill(780);
  glow(-300, 760, 1000, '#ffe2a0', 0.35);
  const items = ['party', 'roman', 'crown', 'coat', 'knight', 'cane', 'bubble', 'club', 'nemes'];
  items.forEach((it, j) => {
    const cx = 420 + j * 230, ch = fchair(cx, 900, SIT * s), grab = cx + 40;
    const tg = 115.243 + (grab - 300) / (2050 / 4.78), age = (T - tg) / 0.9;
    if (age < 0) { saved(it, ch.seat[0] + 4, ch.seat[1] - 3, s * 0.8, 12110 + j * 9); return; }
    if (age < 1) { const px = lerp(ch.seat[0], ch.seat[0] - 420, age), py = ch.seat[1] - Math.sin(age * Math.PI) * 360 + age * 120;
      const c = F.art; c.save(); c.translate(px, py); c.rotate(age * 6 * (j % 2 ? 1 : -1)); saved(it, 0, 0, s * 0.8, 12110 + j * 9); c.restore(); }
  });
  const near = items.reduce((m, it, j) => Math.max(m, smooth(1 - Math.abs(x - (420 + j * 230) - 40) / 70)), 0);
  person(x, y, s, LOOKS.narrator, { view: 'side', dir: 1, ...walkPose(lt * TAU * 2.0, { run: true, amp: 0.7 }), seed: 46, lean: 0.1 + near * 0.15,
    ...(near > 0.2 ? { handA: [x + 0.6 * R, y - lerp(3.0, 2.2, near) * R] } : {}), face: { look: [0.5, 0.6], brow: -0.7, open: 0.25, smile: -0.3 } });
}};

const C16 = { t: cut(120.021), draw(lt, T) {
  // yellow, there! no: a rubber duck. There! no: a parasol. There: the fisherman, waving.
  cam(980, 760, 1.3);
  nightPage({ seed: 12201, y0: 790 });
  lightSpots(T, 6, { seed: 12202, y0: 880, y1: 1100 });
  const ch = fchair(520, 980, 0.8); duck(ch.seat[0], ch.seat[1] + 4, 1.15);
  if (T > 120.35 && T < 120.8) for (let i = 0; i < 3; i++) line(ell(360, 760, 30 + i * 18, 30 + i * 18, 8, 0, Math.PI * 0.8, Math.PI * 1.25), { w: 2.4, seed: 12210 + i });
  const vs = 1.3, VR = 32 * vs, vx = 1500, vy = 1000, spin = T * 3;
  person(vx, vy, vs, LOOKS.victorian, { view: 'three', dir: -1, seed: 680, handA: [vx - 0.8 * VR, vy - 4.6 * VR], face: { smile: 0.7, look: [-0.5, 0] } });
  parasol(vx - 0.8 * VR, vy - 4.6 * VR, 1.1, spin);
  const fw = T > 122.0;
  person(1060, 850, 0.9, LOOKS.fisherman, { view: fw ? 'front' : 'back', seed: 671, handA: fw ? [1060 - 1.4 * 29, 850 - (6.0 + 0.4 * Math.sin(T * 11)) * 29] : undefined, face: { smile: 0.9 } });
  // her, turning to each, sagging a little more each time
  const s = 1.7, R = 32 * s, x = 960, y = 1100;
  const phase = T < 121.05 ? 0 : T < 122.05 ? 1 : 2, t0 = [120.1, 121.1, 122.1][phase], hope = smooth(ramp(T, t0, t0 + 0.15)) * (1 - smooth(ramp(T, t0 + 0.45, t0 + 0.7)));
  const pose = phase === 0 ? { view: 'three', dir: -1 } : phase === 1 ? { view: 'three', dir: 1 } : { view: 'back' };
  person(x, y, s, LOOKS.narrator, { ...pose, seed: 47, lean: -0.04 * phase, tilt: 0.06 * phase,
    face: { look: [0.6, -0.2], lift: hope * 1.2, brow: -0.2 - (1 - hope) * 0.3 - phase * 0.1, smile: hope * 0.4 - (1 - hope) * 0.3, open: hope * 0.3 } });
}};

// ---------------------------------------------------------------- post-chorus 2
const C17 = { t: cut(123.365), draw(lt, T) {
  // the janitor dims the party, two tugs, and the dancers blur into a swirl around her; she stands still in it
  cam(960, 600, lerp(1.0, 1.12, ease(lt / 3.8)));
  const tugs = [124.33, 125.75], dim = tugs.reduce((a, b) => a + smooth(ramp(T, b, b + 0.45)) * 0.5, 0);
  nightPage({ seed: 12301, y0: 820 });
  discoMoon(960, 70, 80, T, { glow: 0.4 * (1 - dim * 0.7) });
  lightSpots(T, Math.round(10 * (1 - dim * 0.6)), { seed: 12302, y0: 860, y1: 1100, a: 0.32 * (1 - dim * 0.7) });
  // the dancers, going round her faster and faster, leaving trails
  const N = 12, spin = T * (1.2 + lt * 0.5), cx = 960, cy = 980;
  const ring = [];
  for (let i = 0; i < N; i++) { const a = spin + i / N * TAU; ring.push({ i, a, x: cx + Math.cos(a) * 640, y: cy + Math.sin(a) * 170 }); }
  const draw = ({ i, a, x, y }) => {
    const sc = a => 1.15 + Math.sin(a) * 0.3;
    for (let g = 3; g >= 1; g--) { F.art.globalAlpha = 0.12 * (4 - g) * (0.5 + lt / 7.6); const ga = a - g * 0.09; guest(i * 2 + 1, cx + Math.cos(ga) * 640, cy + Math.sin(ga) * 170, sc(ga), { view: 'front', ...danceAt(T, i) }); }
    F.art.globalAlpha = 1; guest(i * 2 + 1, x, y, sc(a), { view: 'front', ...danceAt(T, i), face: { smile: 0.8, blink: 1 } });
  };
  ring.filter(p => Math.sin(p.a) < 0).sort((a, b) => a.y - b.y).forEach(draw);
  const s = 1.6, R = 32 * s;
  person(cx, cy + 20, s, LOOKS.narrator, { view: 'front', seed: 48, face: { look: [0, 0.3], brow: -0.4, smile: -0.1, blink: lt > 2.8 ? 1 : 0 }, handA: [cx - 0.7 * R, cy + 20 - 2.5 * R], handB: [cx + 0.7 * R, cy + 20 - 2.5 * R] });
  ring.filter(p => Math.sin(p.a) >= 0).sort((a, b) => a.y - b.y).forEach(draw);
  // the janitor, at the side, on the cord
  const tug = tugs.reduce((a, b) => a + Math.max(0, 1 - Math.abs(T - b - 0.08) / 0.12), 0), jx = 220, jy = 1000, JR = 32 * 1.3;
  line([[960, 70], [jx + 0.3 * JR, jy - 6.2 * JR + tug * 20]], { w: 1.6, seed: 12320, a: 0.8 });
  person(jx, jy, 1.3, LOOKS.janitor, { view: 'three', dir: 1, seed: 53, handB: [jx + 0.3 * JR, jy - (6.2 - tug * 0.6) * JR], handA: [jx + 0.5 * JR, jy - 3.2 * JR], face: { look: [1, -0.5], smile: 0.1 } });
  return { fade: 0, tint: dim > 0 ? mix('#ffffff', '#c3c6d6', dim) : undefined };
}};

const C18 = { t: cut(127.189), draw(lt, T) {
  // the lights become server lights: one by one the chairs turn into server racks, the stars into a grid of LEDs
  cam(960, 620, lerp(1.0, 0.92, ease(lt / 3.8)));
  wash([[-1400, -1400], [3600, -1400], [3600, 1600], [-1400, 1600]], '#1f2740', { famp: 6, seed: 12401, edge: false });
  const r = mulberry(12402), g = smooth(ramp(T, 127.5, 130.0));
  for (let i = 0; i < 60; i++) { const sx = -200 + r() * 2400, sy = -200 + r() * 800, gx = -160 + (i % 15) * 160, gy = -120 + Math.floor(i / 15) * 120;
    const x = lerp(sx, gx, g), y = lerp(sy, gy, g);
    if (g < 0.5) star(x, y, 8 * (1 - g), { seed: 12403 + i }); else shape(rrect(x - 6, y - 4, 12, 8, 2), { fill: Math.sin(T * 4 + i) > 0 ? '#8fe0a0' : '#ffd36a', line: false, seed: 12403 + i }); }
  hill(820, { col: '#8a7d6a' });
  const beats = beatsIn(127.3, 130.9), slots = [];
  for (let ri = 0; ri < 2; ri++) for (let j = 0; j < 7; j++) slots.push([200 + j * 260 + ri * 120, 900 + ri * 150, 0.6 + ri * 0.15]);
  slots.forEach(([x, y, s], i) => {
    const b = beats[i % beats.length] + (i >= beats.length ? 0.24 : 0), p = clamp((T - b) / 0.3);
    if (p <= 0) { fchair(x, y, s, { col: '#6f7888' }); return; }
    const sq = 1 + 0.2 * Math.sin(p * Math.PI) ; const c = F.art; c.save(); c.translate(x, y); c.scale(2 - sq, sq); c.translate(-x, -y);
    serverRack(x - 70 * s, y, 140 * s, 380 * s, T, { seed: 12420 + i, col: '#4a5068' }); c.restore();
  });
  humLines(-100, 600, 2100, 560, T, 3, { gap: 60, amp: 10, w: 2.4, col: '#8fe0a0', a: 0.35, wl: 40 });
  const s = 1.7, R = 32 * s;
  person(980, 1160, s, LOOKS.narrator, { view: 'back', seed: 49, handA: [980 - 0.8 * R, 1160 - 2.4 * R], handB: [980 + 0.8 * R, 1160 - 2.4 * R] });
}};

window.MORE = (window.MORE || []).concat([C1, C2, C3, C4, C5, C6, C7, C8, C9, C10, C11, C12, C13, C14, C15, C16, C17, C18]);
