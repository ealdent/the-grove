// Procedural pixel-art sprites (player ship, enemies) rendered to offscreen canvases.

const PALETTE: Record<string, string> = {
  k: '#16100c', // near-black outline
  d: '#3a2a1c', // dark hull brown
  D: '#241a10', // deeper shadow
  r: '#c1382a', // redline red
  R: '#7e2015', // dark red
  t: '#e8c384', // desert tan
  T: '#a8793f', // dark tan
  w: '#f9ecb9', // cream
  o: '#ff8c2e', // engine orange
  y: '#ffd75e', // hot yellow
  b: '#8fd0e0', // cockpit glass
  g: '#ff3b26', // glowing red core
  s: '#5c3a1e', // structure brown
};

export function makePixelSprite(rows: string[], scale = 4): HTMLCanvasElement {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      ctx.fillStyle = PALETTE[ch] ?? '#ff00ff';
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return c;
}

/* ------------------------------------------------------------------ */
/* Player ship — seen from behind, twin engines, swept red wings       */
/* ------------------------------------------------------------------ */
const SHIP_ROWS = [
  '..............kk..............',
  '.............kttk.............',
  '.............kttk.............',
  '............ktrrtk............',
  '............ktrrtk............',
  '............krbbtk............',
  '...........ktrbbbtrk..........',
  '...........ktrttttrk..........',
  '......kk..krtrrrrtrk..kk......',
  '.....krrkkrrtddddtrrkkrrk.....',
  '....krrrrrrRtddddRrrrrrrrk....',
  '...krwrrrRRRtddddtRRRrrrwrk...',
  '..krRkkRRRttddddddttRRRkkRrk..',
  '..krk.kRRtddddddddd tRRk.krk..'.replace(' ', '.'),
  '..kk..kRtdddddddddddtRk..kk..',
  '.......kRtddddddddddtRk.......',
  '.......kRttdddddddttRk........',
  '........kkttdddddttkk.........',
  '........kkktttttttkk..........',
  '........kokkkkkkkkok..........',
  '........koykkkkkkyok..........',
  '........kokkkkkkkkok..........',
];

/* ------------------------------------------------------------------ */
/* Grinder drone — round attack body, red eye core, 4 rotor arms       */
/* ------------------------------------------------------------------ */
const GRINDER_ROWS = [
  '.....kk............kk.....',
  '....kRRk..........kRRk....',
  '....kRrk..........krRk....',
  '.....kk....kkkk...kk......',
  '..........kddddk..........',
  '....kk..kddddddddk..kk....',
  '...kddkkdtwwwwwtdkkddk....',
  '...kddkdtwgggggwtdkddk....',
  '....kkkdtwgkkkgwtdkkk.....',
  '......kdtwgkggkgwtdk......',
  '......kdtwgkkkgwtdk.......',
  '......kdtwgggggwtdk.......',
  '....kkkdtwwwwwwwtdkkk.....',
  '...kddk.kddddddddk.kddk...',
  '...kddk..kddddddk..kddk...',
  '....kk....kkkkkk....kk....',
  '..........kRggRk..........',
  '.....kk...kRRRRk...kk.....',
  '....kRRk...kkkk...kRRk....',
  '....kkkk..........kkkk....',
];

/* ------------------------------------------------------------------ */
/* Wasp fighter — sleek dart, swept wings                              */
/* ------------------------------------------------------------------ */
const WASP_ROWS = [
  '...........kk...........',
  '..........kggk..........',
  '..........krrk..........',
  '.........krrrrk.........',
  '....kk..krttrrk..kk.....',
  '...krrkkrtdddtrkkrrk....',
  '..krRrrktdwwwdtkrrrRrk..',
  '.krRkkkrtdwwwdtrkkkRrk..',
  '.kRk..krtdddddtrk..kRk..',
  '.kk...krttdddtt rk...kk..'.replace(' ', '.'),
  '.....krtkdddddtktrk.....',
  '....krtk.kddddd ktrk....'.replace(' ', '.'),
  '....kk..kokkdkok..kk....',
  '........koykkoyk........',
];

/* ------------------------------------------------------------------ */
/* Seeker mine — spiky drifting orb                                    */
/* ------------------------------------------------------------------ */
const MINE_ROWS = [
  '......kk......',
  '..k..kddk..k..',
  '..kkkddddkkk..',
  '.kkddkggkddkk.',
  '.kdddkggkdddk.',
  'kddgddkkddgddk',
  'kddddkkkkddddk',
  'kddgddkkddgddk',
  '.kdddkggkdddk.',
  '.kkddkggkddkk.',
  '..kkkddddkkk..',
  '..k..kddk..k..',
  '......kk......',
];

/* Floating red nav-buoy / pickup core */
const CORE_ROWS = [
  '....kkkk....',
  '..kkwwwwkk..',
  '.kwggggggwk.',
  '.kwgkggkgwk.',
  'kwggkggkggwk',
  'kwggkggkggwk',
  '.kwgkggkgwk.',
  '.kwggggggwk.',
  '..kkwwwwkk..',
  '....kkkk....',
];

export interface ProcSprites {
  ship: HTMLCanvasElement;
  shipBankL: HTMLCanvasElement;
  shipBankR: HTMLCanvasElement;
  grinder: HTMLCanvasElement;
  wasp: HTMLCanvasElement;
  mine: HTMLCanvasElement;
  core: HTMLCanvasElement;
}

function banked(src: HTMLCanvasElement, shear: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width + Math.abs(shear) * src.height;
  c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, shear, 1, shear > 0 ? 0 : Math.abs(shear) * src.height, 0);
  ctx.drawImage(src, 0, 0);
  return c;
}

export function buildProcSprites(): ProcSprites {
  const ship = makePixelSprite(SHIP_ROWS, 4);
  return {
    ship,
    shipBankL: banked(ship, -0.18),
    shipBankR: banked(ship, 0.18),
    grinder: makePixelSprite(GRINDER_ROWS, 4),
    wasp: makePixelSprite(WASP_ROWS, 4),
    mine: makePixelSprite(MINE_ROWS, 4),
    core: makePixelSprite(CORE_ROWS, 4),
  };
}

/* Pre-rendered glowing bolt (player photon) */
export function makeBoltSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 24;
  c.height = 24;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
  g.addColorStop(0, 'rgba(255,255,240,1)');
  g.addColorStop(0.25, 'rgba(255,215,94,1)');
  g.addColorStop(0.6, 'rgba(255,110,40,0.85)');
  g.addColorStop(1, 'rgba(255,60,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 24, 24);
  return c;
}

/* Enemy plasma bolt */
export function makeEnemyBoltSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 24;
  c.height = 24;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
  g.addColorStop(0, 'rgba(255,240,230,1)');
  g.addColorStop(0.3, 'rgba(255,90,60,1)');
  g.addColorStop(0.65, 'rgba(200,30,20,0.8)');
  g.addColorStop(1, 'rgba(150,10,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 24, 24);
  return c;
}
