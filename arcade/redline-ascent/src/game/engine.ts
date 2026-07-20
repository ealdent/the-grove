// REDLINE ASCENT — endless Space Harrier style engine.
// Pseudo-3D perspective projection over a scrolling desert, canvas 2D.

import { buildProcSprites, makeBoltSprite, makeEnemyBoltSprite, type ProcSprites } from './pixelart';
import { Sfx } from './audio';
import { OBSTACLE_SPRITES, RELAY_WARDEN_SPRITE } from './obstacle-sprites';

/* ================= constants ================= */
const CELL = 46; // ground grid cell (world units)
const CAM_H = 60; // camera height above ground
const ZP = 90; // player plane distance
const FAR = 1150; // spawn distance
const GROUND_ZMAX = 820; // ground detail range
const STAGE_LENGTH = 90; // world distance between relay encounters
const FIRST_RELAY_DIST = 58;

const C = {
  sky0: '#0b0d0e',
  sky1: '#612e2c',
  sky2: '#c99963',
  horizonGlow: '#f1d78f',
  groundA: '#9b5e36',
  groundB: '#612e2c',
  groundLine: '#0b0d0e',
  groundFog: '#c99963',
  cream: '#f7eac1',
  tan: '#f1d78f',
  red: '#c83b3d',
  hotRed: '#e94d49',
  darkPanel: 'rgba(11,13,14,0.9)',
  blue: '#8fbec7',
};

/* ================= types ================= */
interface ObstacleDef {
  name: string;
  h: number; // world height
  cw: number; // collider width as fraction of visual width
  ch: number; // collider height as fraction of visual height
  hole?: { hw: number; y0: number; y1: number }; // fly-through hole (fractions)
}

interface Obstacle {
  def: ObstacleDef;
  img: HTMLImageElement;
  x: number;
  z: number;
  prevZ: number;
  w: number; // world visual width
  passed: boolean;
}

type EnemyKind = 'grinder' | 'wasp' | 'mine' | 'warden';

interface Enemy {
  kind: EnemyKind;
  x: number;
  alt: number;
  z: number;
  prevZ: number;
  hp: number;
  maxHp: number;
  t: number;
  seed: number;
  fireCd: number;
  flash: number;
  r: number;
  destroyedByPlayer: boolean;
}

interface Bolt {
  x: number;
  alt: number;
  z: number;
  vx: number;
  valt: number;
  vz: number;
  friendly: boolean;
  dead: boolean;
}

interface Particle {
  x: number;
  alt: number;
  z: number;
  vx: number;
  valt: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface Popup {
  text: string;
  sx: number;
  sy: number;
  life: number;
  color: string;
}

export type GameEvent = 'gameover';
export interface EngineCallbacks {
  onGameOver: (score: number, hiScore: number, dist: number) => void;
  onReady: (hiScore: number) => void;
  onPauseChange: (paused: boolean) => void;
  onMuteChange: (muted: boolean) => void;
}

type State = 'attract' | 'playing' | 'paused' | 'dying';

const OBSTACLE_DEFS: ObstacleDef[] = [
  { name: 'ring-arch', h: 175, cw: 0.62, ch: 0.95, hole: { hw: 0.16, y0: 0.08, y1: 0.62 } },
  { name: 'gate', h: 120, cw: 0.6, ch: 0.9, hole: { hw: 0.13, y0: 0.02, y1: 0.52 } },
  { name: 'crystal', h: 100, cw: 0.55, ch: 0.9 },
  { name: 'tree', h: 115, cw: 0.4, ch: 0.85 },
  { name: 'dome-big', h: 92, cw: 0.7, ch: 0.9 },
  { name: 'bunker', h: 74, cw: 0.7, ch: 0.85 },
  { name: 'silo', h: 115, cw: 0.5, ch: 0.95 },
  { name: 'dome-med', h: 52, cw: 0.7, ch: 0.85 },
  { name: 'dome-small', h: 44, cw: 0.7, ch: 0.85 },
];

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}
function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/* ================= engine ================= */
export class Engine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: EngineCallbacks;
  private sfx = new Sfx();

  private W = 0;
  private H = 0;
  private cx = 0;
  private f = 0;
  private horizonY = 0;
  private dpr = 1;

  private raf = 0;
  private lastT = 0;
  private time = 0;
  private destroyed = false;

  state: State = 'attract';

  // assets
  private proc!: ProcSprites;
  private boltImg!: HTMLCanvasElement;
  private eBoltImg!: HTMLCanvasElement;
  private wardenImg: HTMLImageElement | null = null;
  private obstacleImgs = new Map<string, HTMLImageElement>();
  private skyBack: HTMLCanvasElement | null = null;
  private skyFront: HTMLCanvasElement | null = null;

  // input
  private keys = new Set<string>();
  private pointer = { x: 0, y: 0, active: false, down: false, id: -1, type: 'mouse', lastMove: -10 };
  private touchFiring = false;

  // world
  private dist = 0;
  private scrollZ = 0;
  private speed = 0;
  private camX = 0;
  private obstacles: Obstacle[] = [];
  private enemies: Enemy[] = [];
  private bolts: Bolt[] = [];
  private ebolts: Bolt[] = [];
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private specks: { x: number; z: number }[] = [];

  // player
  private px = 0;
  private palt = 26;
  private pvx = 0;
  private pvalt = 0;
  private heat = 0;
  private overheated = false;
  private shield = 100;
  private lastHurt = -10;
  private invulnUntil = 0;
  private fireCd = 0;
  private firing = false;

  // scoring
  private runTime = 0;
  private score = 0;
  private hiScore = 0;
  private combo = 0;
  private comboBest = 0;
  private comboTimer = 0;
  private chain = 0;
  private chainTimer = 0;

  // director
  private spawnTimer = 2;
  private safeX = 0;
  private alertText = '';
  private alertUntil = 0;
  private pickupTimer = 18;
  private pickups: { x: number; alt: number; z: number; t: number }[] = [];
  private stage = 1;
  private nextRelayDist = FIRST_RELAY_DIST;
  private relayActive = false;
  private stageBannerUntil = 0;

  // fx
  private shake = 0;
  private flashRed = 0;
  private dieTimer = 0;
  private muted = false;
  private overdriveUntil = 0;

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.cb = cb;
    this.hiScore = Number(localStorage.getItem('redline-hi') ?? 0) || 0;
    this.proc = buildProcSprites();
    this.boltImg = makeBoltSprite();
    this.eBoltImg = makeEnemyBoltSprite();
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clearTransientInput);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerCancel);
    void this.loadSprites().then(() => {
      if (this.destroyed) return;
      this.bakeSkyline();
      this.cb.onReady(this.hiScore);
      this.lastT = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clearTransientInput);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerCancel);
    this.sfx.stopEngine();
  }

  private async loadSprites() {
    const load = (src: string) =>
      new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });
    const [warden, ...obstacles] = await Promise.all([
      load(RELAY_WARDEN_SPRITE),
      ...OBSTACLE_DEFS.map((def) => load(OBSTACLE_SPRITES[def.name])),
    ]);
    if (this.destroyed) return;
    this.wardenImg = warden;
    for (let i = 0; i < OBSTACLE_DEFS.length; i++) {
      const img = obstacles[i];
      if (img) this.obstacleImgs.set(OBSTACLE_DEFS[i].name, img);
    }
  }

  private resize = () => {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    this.cx = this.W / 2;
    this.f = this.H * 0.95;
    this.horizonY = this.H * 0.36;
    this.palt = clamp(this.palt, this.playerMinAlt(), 72);
    this.bakeSkyline();
  };

  /* ---------------- input ---------------- */
  private onKeyDown = (e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    this.keys.add(e.key.toLowerCase());
    if (e.repeat) return;
    if (e.key.toLowerCase() === 'm') this.toggleMute();
    if (e.key.toLowerCase() === 'p' && (this.state === 'playing' || this.state === 'paused')) {
      this.togglePause();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  private clearTransientInput = () => {
    this.keys.clear();
    this.pointer.down = false;
    this.pointer.active = false;
    this.pointer.id = -1;
    this.touchFiring = false;
  };
  private onVisibilityChange = () => {
    if (document.hidden) this.clearTransientInput();
  };
  private onPointerMove = (e: PointerEvent) => {
    if (this.pointer.down && e.pointerId !== this.pointer.id) return;
    if (e.pointerType === 'touch' && (!this.pointer.down || e.pointerId !== this.pointer.id)) return;
    if ((e.pointerType === 'mouse' || e.pointerType === 'pen') && e.pointerId === this.pointer.id) {
      this.pointer.down = (e.buttons & 1) !== 0;
    }
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    this.pointer.type = e.pointerType;
    this.pointer.active = true;
    this.pointer.lastMove = this.time;
  };
  private onPointerDown = (e: PointerEvent) => {
    if ((e.pointerType === 'mouse' || e.pointerType === 'pen') && e.button !== 0) return;
    if (this.pointer.down && e.pointerId !== this.pointer.id) return;
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    this.pointer.down = true;
    this.pointer.id = e.pointerId;
    this.pointer.type = e.pointerType;
    this.pointer.active = true;
    this.pointer.lastMove = this.time;
    this.canvas.setPointerCapture?.(e.pointerId);
  };
  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointer.id) return;
    this.pointer.down = false;
    this.pointer.id = -1;
    if (e.pointerType === 'touch') this.pointer.active = false;
    if (this.canvas.hasPointerCapture?.(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
  };
  private onPointerCancel = (e: PointerEvent) => this.onPointerUp(e);

  /* ---------------- public control ---------------- */
  start() {
    this.sfx.ensure();
    this.state = 'playing';
    this.dist = 0;
    this.scrollZ = 0;
    this.speed = 240;
    this.camX = 0;
    this.obstacles = [];
    this.enemies = [];
    this.bolts = [];
    this.ebolts = [];
    this.particles = [];
    this.popups = [];
    this.specks = [];
    this.pickups = [];
    this.px = 0;
    this.palt = Math.max(26, this.playerMinAlt());
    this.pvx = 0;
    this.pvalt = 0;
    this.fireCd = 0;
    this.firing = false;
    this.touchFiring = false;
    this.heat = 0;
    this.overheated = false;
    this.overdriveUntil = 0;
    this.shield = 100;
    this.lastHurt = this.time;
    this.invulnUntil = this.time + 1.5;
    this.runTime = 0;
    this.score = 0;
    this.combo = 0;
    this.comboBest = 0;
    this.comboTimer = 0;
    this.chain = 0;
    this.chainTimer = 0;
    this.spawnTimer = 1.6;
    this.safeX = 0;
    this.pickupTimer = 16;
    this.stage = 1;
    this.nextRelayDist = FIRST_RELAY_DIST;
    this.relayActive = false;
    this.stageBannerUntil = this.time + 2.4;
    this.shake = 0;
    this.flashRed = 0;
    this.dieTimer = 0;
    this.alertText = '';
    this.alertUntil = 0;
    this.sfx.startEngine();
    this.cb.onPauseChange(false);
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.sfx.stopEngine();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.sfx.ensure();
      this.sfx.startEngine();
      this.lastT = performance.now();
    }
    this.cb.onPauseChange(this.state === 'paused');
  }

  toAttract() {
    this.state = 'attract';
    this.sfx.stopEngine();
    this.obstacles = [];
    this.enemies = [];
    this.bolts = [];
    this.ebolts = [];
    this.particles = [];
    this.popups = [];
    this.dist = 0;
    this.scrollZ = 0;
  }

  get isMuted() {
    return this.muted;
  }

  get isPaused() {
    return this.state === 'paused';
  }

  toggleMute() {
    this.muted = !this.muted;
    this.sfx.setMuted(this.muted);
    this.cb.onMuteChange(this.muted);
  }

  setTouchFiring(active: boolean) {
    this.touchFiring = active && this.state === 'playing';
  }

  /* ---------------- projection ---------------- */
  private projX(x: number, z: number) {
    return this.cx + ((x - this.camX) * this.f) / z;
  }
  private projY(alt: number, z: number) {
    return this.horizonY + ((CAM_H - alt) * this.f) / z;
  }

  private playerMinAlt() {
    if (this.W >= 680) return 18;
    const lowestSafeCenter = this.H - 118;
    const altitude = CAM_H - ((lowestSafeCenter - this.horizonY) * ZP) / Math.max(1, this.f);
    return clamp(altitude, 18, 56);
  }

  /* ---------------- skyline bake ---------------- */
  private bakeSkyline() {
    const W = Math.max(2, Math.floor(this.W));
    const Hb = Math.max(2, Math.floor(this.horizonY));
    let s = 1234;
    const rng = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    const makeLayer = (color: string, maxH: number, arch: boolean) => {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = Hb;
      const g = c.getContext('2d')!;
      g.fillStyle = color;
      let x = -20;
      while (x < W + 40) {
        const w = 20 + rng() * 90;
        const h = Hb * (0.15 + rng() * maxH);
        if (arch && rng() < 0.14) {
          // ruined ring arch silhouette
          const r = w * 0.9;
          g.beginPath();
          g.arc(x + w / 2, Hb, r, Math.PI, 0);
          g.arc(x + w / 2, Hb, r * 0.62, 0, Math.PI, true);
          g.closePath();
          g.fill();
          g.fillRect(x + w / 2 - r, Hb - 4, r * 2, 4);
        } else {
          // jagged ruined tower
          g.beginPath();
          g.moveTo(x, Hb);
          g.lineTo(x, Hb - h * 0.7);
          g.lineTo(x + w * 0.2, Hb - h * 0.85);
          g.lineTo(x + w * 0.35, Hb - h);
          g.lineTo(x + w * 0.5, Hb - h * 0.9);
          g.lineTo(x + w * 0.55, Hb - h * 0.55);
          g.lineTo(x + w * 0.8, Hb - h * 0.62);
          g.lineTo(x + w, Hb - h * 0.4);
          g.lineTo(x + w, Hb);
          g.closePath();
          g.fill();
        }
        x += w + rng() * 60;
      }
      return c;
    };
    this.skyBack = makeLayer('rgba(122,74,38,0.55)', 0.55, true);
    this.skyFront = makeLayer('rgba(74,44,24,0.85)', 0.4, false);
  }

  /* ---------------- spawning ---------------- */
  private spawnObstacle(defName: string | null, x: number, z: number) {
    const def = defName ? OBSTACLE_DEFS.find((d) => d.name === defName)! : OBSTACLE_DEFS[Math.floor(rand(2, OBSTACLE_DEFS.length))];
    const img = this.obstacleImgs.get(def.name);
    if (!img) return;
    const w = (def.h * img.width) / img.height;
    this.obstacles.push({ def, img, x, z, prevZ: z, w, passed: false });
  }

  private spawnEnemy(kind: EnemyKind, x: number, alt: number, z: number) {
    const hp = kind === 'warden' ? 18 + (this.stage - 1) * 4 : kind === 'grinder' ? 3 : 1;
    const r = kind === 'warden' ? 38 : kind === 'grinder' ? 17 : kind === 'wasp' ? 14 : 13;
    this.enemies.push({
      kind,
      x,
      alt,
      z,
      prevZ: z,
      hp,
      maxHp: hp,
      t: 0,
      seed: rand(0, 100),
      fireCd: kind === 'warden' ? 1.2 : rand(0.8, 2),
      flash: 0,
      r,
      destroyedByPlayer: false,
    });
  }

  private alert(text: string, dur = 2.2) {
    this.alertText = text;
    this.alertUntil = this.time + dur;
    this.sfx.alarm();
  }

  private director(dt: number) {
    if (!this.relayActive && this.dist >= this.nextRelayDist) {
      this.relayActive = true;
      this.spawnEnemy('warden', this.safeX, 46, FAR - 180);
      this.spawnTimer = 3.8;
      this.stageBannerUntil = this.time + 3.2;
      this.alert(`STAGE ${String(this.stage).padStart(2, '0')} — RELAY WARDEN LOCKED`, 3.2);
      return;
    }

    this.pickupTimer -= dt;
    if (this.pickupTimer <= 0) {
      this.pickupTimer = rand(16, 26);
      const pickupMinAlt = this.playerMinAlt();
      this.pickups.push({ x: this.safeX + rand(-40, 40), alt: rand(pickupMinAlt, Math.max(55, pickupMinAlt + 10)), z: FAR, t: 0 });
    }
    if (this.relayActive) return;

    const diff = Math.min(3.1, 1 + (this.stage - 1) * 0.28 + this.runTime / 170);
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = rand(1.5, 2.6) / diff;
    this.safeX = clamp(this.safeX + rand(-70, 70), -150, 150);
    const roll = Math.random();
    const enemyCap = this.enemies.length < 4 + diff * 4;

    if (roll < 0.3) {
      // obstacle field with a guaranteed safe lane
      const n = Math.floor(rand(4, 7 + diff));
      for (let i = 0; i < n; i++) {
        const z = FAR + rand(0, 420);
        let x = rand(-230, 230);
        if (Math.abs(x - this.safeX) < 80) x = this.safeX + (x > this.safeX ? 1 : -1) * rand(85, 160);
        this.spawnObstacle(null, clamp(x, -260, 260), z);
      }
    } else if (roll < 0.42) {
      // Honest three-plane arch run; each opening exists at its own world depth.
      const lane = this.safeX + rand(-24, 24);
      for (let i = 0; i < 3; i++) {
        this.spawnObstacle(i === 1 ? 'gate' : 'ring-arch', lane + rand(-12, 12), FAR + 80 + i * 210);
      }
      for (let i = 0; i < 3; i++) {
        const side = Math.random() < 0.5 ? -1 : 1;
        this.spawnObstacle(null, this.safeX + side * rand(120, 220), FAR + rand(0, 300));
      }
    } else if (roll < 0.6 && enemyCap) {
      // grinder squadron
      const n = Math.floor(rand(3, 5 + diff));
      const bx = rand(-90, 90);
      for (let i = 0; i < n; i++) {
        this.spawnEnemy('grinder', bx + (i - (n - 1) / 2) * 55, rand(24, 58), FAR + 150 + Math.abs(i - (n - 1) / 2) * 70);
      }
      this.alert('ENEMY WAVE INBOUND — GRINDER SQUADRON');
    } else if (roll < 0.74 && enemyCap) {
      // wasp sweep
      const n = Math.floor(rand(2, 4 + diff));
      for (let i = 0; i < n; i++) this.spawnEnemy('wasp', rand(-180, 180), rand(15, 65), FAR + i * rand(60, 120));
    } else if (roll < 0.86) {
      // mine field
      const n = Math.floor(rand(5, 8 + diff * 2));
      for (let i = 0; i < n; i++) {
        this.spawnEnemy('mine', rand(-200, 200), rand(12, 62), FAR + rand(0, 380));
      }
    } else if (enemyCap) {
      // mixed assault
      const n = Math.floor(rand(2, 4));
      for (let i = 0; i < n; i++) this.spawnEnemy('grinder', rand(-140, 140), rand(24, 55), FAR + 150 + i * 90);
      for (let i = 0; i < 4; i++) {
        let x = rand(-230, 230);
        if (Math.abs(x - this.safeX) < 80) x = this.safeX + rand(90, 170) * (Math.random() < 0.5 ? -1 : 1);
        this.spawnObstacle(null, clamp(x, -260, 260), FAR + rand(0, 300));
      }
      this.alert('ALERT — COMBINED ASSAULT');
    }
  }

  /* ---------------- combat helpers ---------------- */
  private addScore(base: number, sx: number, sy: number, label: string) {
    const mult = Math.min(15, 1 + Math.floor(this.combo / 2));
    const pts = base * mult;
    this.score += pts;
    this.popups.push({ text: `+${pts} ${label}`, sx, sy, life: 1.1, color: mult > 4 ? C.hotRed : C.cream });
  }

  private killChainBonus(sx: number, sy: number) {
    if (this.chain === 2) {
      this.score += 1000;
      this.popups.push({ text: '+1000 DOUBLE KILL', sx, sy: sy - 30, life: 1.3, color: C.tan });
    } else if (this.chain === 3) {
      this.score += 1500;
      this.popups.push({ text: '+1500 TRIPLE KILL', sx, sy: sy - 30, life: 1.3, color: C.hotRed });
    } else if (this.chain >= 4) {
      this.score += 2500;
      this.popups.push({ text: '+2500 MEGA KILL', sx, sy: sy - 30, life: 1.3, color: C.hotRed });
    }
  }

  private resolveEnemy(enemy: Enemy) {
    if (enemy.hp > 0) return;
    if (!enemy.destroyedByPlayer) {
      if (enemy.kind === 'warden') {
        this.relayActive = false;
        this.nextRelayDist = this.dist + 24;
        this.alert('RELAY SIGNAL LOST — WARDEN REACQUIRING', 2.4);
      }
      enemy.z = -999;
      return;
    }

    const sx = this.projX(enemy.x, Math.max(ZP, enemy.z));
    const sy = this.projY(enemy.alt, Math.max(ZP, enemy.z));
    const big = enemy.kind === 'grinder' || enemy.kind === 'warden';
    this.explode(enemy.x, enemy.alt, enemy.z, big);
    this.sfx.boom(big);
    this.combo += 1;
    this.comboBest = Math.max(this.comboBest, this.combo);
    this.comboTimer = 4.5;
    this.chain += 1;
    this.chainTimer = 1.1;
    const base = enemy.kind === 'warden' ? 5000 : enemy.kind === 'grinder' ? 500 : enemy.kind === 'wasp' ? 300 : 200;
    const label =
      enemy.kind === 'warden'
        ? 'RELAY WARDEN SEVERED'
        : enemy.kind === 'grinder'
          ? 'GRINDER DESTROYED'
          : enemy.kind === 'wasp'
            ? 'WASP DOWN'
            : 'MINE CLEARED';
    this.addScore(base, sx, sy, label);
    this.killChainBonus(sx, sy);
    if (enemy.kind === 'warden') {
      this.relayActive = false;
      this.stage += 1;
      this.nextRelayDist = this.dist + STAGE_LENGTH;
      this.shield = Math.min(100, this.shield + 20);
      this.overdriveUntil = Math.max(this.overdriveUntil, this.time) + 6;
      this.stageBannerUntil = this.time + 3;
      this.alertText = `RELAY ${String(this.stage - 1).padStart(2, '0')} DOWN — STAGE ${String(this.stage).padStart(2, '0')} OPEN`;
      this.alertUntil = this.time + 3;
      this.sfx.needle();
    }
    enemy.z = -999;
  }

  private explode(x: number, alt: number, z: number, big: boolean) {
    const n = big ? 42 : 22;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(20, big ? 160 : 100);
      this.particles.push({
        x,
        alt,
        z,
        vx: Math.cos(a) * v,
        valt: Math.sin(a) * v * 0.8 + rand(0, 40),
        vz: rand(-60, 60),
        life: rand(0.4, big ? 1.1 : 0.8),
        maxLife: 1,
        size: rand(2, big ? 7 : 5),
        color: ['#ffd75e', '#ff8c2e', '#ff3b26', '#f9ecb9', '#c1382a'][Math.floor(rand(0, 5))],
      });
    }
  }

  private hurtPlayer(dmg: number) {
    if (this.time < this.invulnUntil || this.state !== 'playing') return;
    this.shield -= dmg;
    this.lastHurt = this.time;
    this.invulnUntil = this.time + 1.0;
    this.combo = 0;
    this.shake = Math.min(24, this.shake + 14);
    this.flashRed = 0.55;
    this.explode(this.px, this.palt, ZP + 10, false);
    this.sfx.playerHit();
    if (this.shield <= 0) {
      this.shield = 0;
      this.state = 'dying';
      this.dieTimer = 1.5;
      this.explode(this.px, this.palt, ZP, true);
      this.explode(this.px, this.palt + 10, ZP + 20, true);
      this.shake = 30;
      this.sfx.stopEngine();
      this.sfx.gameOver();
    }
  }

  private firePlayerBolt() {
    // converge toward crosshair world point
    const crossSy = this.horizonY + (this.H - this.horizonY) * 0.08;
    const zt = 700;
    const tx = this.camX;
    const talt = CAM_H - ((crossSy - this.horizonY) * zt) / this.f;
    const dx = tx - this.px;
    const dalt = talt - this.palt;
    const dz = zt - ZP;
    const len = Math.sqrt(dx * dx + dalt * dalt + dz * dz);
    const sp = 950;
    this.bolts.push({
      x: this.px + (Math.random() < 0.5 ? -6 : 6),
      alt: this.palt - 2,
      z: ZP + 6,
      vx: (dx / len) * sp,
      valt: (dalt / len) * sp,
      vz: (dz / len) * sp,
      friendly: true,
      dead: false,
    });
    this.sfx.laser();
    this.heat += this.time < this.overdriveUntil ? 1.35 : 3.4;
    if (this.heat >= 100) {
      this.heat = 100;
      this.overheated = true;
      this.sfx.overheat();
      this.popups.push({ text: 'OVERHEAT!', sx: this.cx, sy: this.H * 0.6, life: 1, color: C.hotRed });
    }
  }

  private enemyFire(e: Enemy) {
    const dx = this.px + this.pvx * 0.3 + rand(-14, 14) - e.x;
    const dalt = this.palt + rand(-8, 8) - e.alt;
    const dz = ZP - e.z;
    const len = Math.sqrt(dx * dx + dalt * dalt + dz * dz);
    const sp = 420;
    this.ebolts.push({
      x: e.x,
      alt: e.alt,
      z: e.z - 10,
      vx: (dx / len) * sp,
      valt: (dalt / len) * sp,
      vz: (dz / len) * sp,
      friendly: false,
      dead: false,
    });
    this.sfx.enemyShot();
  }

  /* ---------------- main loop ---------------- */
  private loop = (t: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = (t - this.lastT) / 1000;
    this.lastT = t;
    dt = Math.min(dt, 0.05);
    if (this.state !== 'paused') this.time += dt;

    if (this.state === 'playing' || this.state === 'dying') this.update(dt);
    else if (this.state === 'attract') this.updateAttract(dt);
    this.render();
  };

  private updateAttract(dt: number) {
    this.speed = 200;
    this.scrollZ += this.speed * dt;
    this.dist += this.speed * dt * 0.01;
    this.camX = Math.sin(this.time * 0.1) * 60;
    if (this.obstacles.length < 8 && Math.random() < dt * 0.8) {
      this.spawnObstacle(null, rand(-240, 240), FAR + rand(0, 200));
    }
    for (const o of this.obstacles) {
      o.prevZ = o.z;
      o.z -= this.speed * dt;
    }
    this.obstacles = this.obstacles.filter((o) => o.z > 30);
  }

  private update(dt: number) {
    const dying = this.state === 'dying';
    if (dying) {
      this.dieTimer -= dt;
      for (const p of this.particles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.alt += p.valt * dt;
        p.z += p.vz * dt;
        p.valt -= 60 * dt;
      }
      this.particles = this.particles.filter((p) => p.life > 0 && p.z > 15);
      for (const p of this.popups) {
        p.life -= dt;
        p.sy -= 34 * dt;
      }
      this.popups = this.popups.filter((p) => p.life > 0);
      this.shake = Math.max(0, this.shake - dt * 24);
      this.flashRed = Math.max(0, this.flashRed - dt * 1.6);
      if (this.dieTimer <= 0) {
        this.state = 'attract';
        const hi = Math.max(this.hiScore, this.score);
        this.hiScore = hi;
        localStorage.setItem('redline-hi', String(hi));
        this.cb.onGameOver(this.score, hi, this.dist);
      }
      return;
    }

    // speed ramps with distance
    this.speed = Math.min(560, 240 + this.dist * 0.8 + (this.stage - 1) * 10);
    this.sfx.setEngineSpeed((this.speed - 240) / 320);
    this.scrollZ += this.speed * dt;
    this.dist += this.speed * dt * 0.01;
    this.runTime += dt;

    /* ---- player movement ---- */
    const prevPx = this.px;
    const prevPalt = this.palt;
    const k = this.keys;
    let ix = 0;
    let iy = 0;
    if (k.has('arrowleft') || k.has('a')) ix -= 1;
    if (k.has('arrowright') || k.has('d')) ix += 1;
    if (k.has('arrowup') || k.has('w')) iy += 1;
    if (k.has('arrowdown') || k.has('s')) iy -= 1;

    const usePointer = this.pointer.active && this.time - this.pointer.lastMove < 3 && (this.pointer.down || (ix === 0 && iy === 0));
    const minPlayerAlt = this.playerMinAlt();
    if (!dying) {
      if (usePointer) {
        // steer toward pointer position
        const tx = ((this.pointer.x - this.cx) * ZP) / this.f + this.camX;
        const talt = clamp(CAM_H - ((this.pointer.y - this.horizonY) * ZP) / this.f, minPlayerAlt, 72);
        const dx = clamp(tx, -170, 170) - this.px;
        const da = talt - this.palt;
        this.pvx = lerp(this.pvx, clamp(dx * 8, -260, 260), 1 - Math.pow(0.0015, dt));
        this.pvalt = lerp(this.pvalt, clamp(da * 8, -200, 200), 1 - Math.pow(0.0015, dt));
      } else {
        this.pvx = lerp(this.pvx, ix * 240, 1 - Math.pow(0.002, dt));
        this.pvalt = lerp(this.pvalt, iy * 190, 1 - Math.pow(0.002, dt));
      }
      this.px = clamp(this.px + this.pvx * dt, -170, 170);
      this.palt = clamp(this.palt + this.pvalt * dt, minPlayerAlt, 72);
    }
    this.camX = lerp(this.camX, this.px * 0.55, 1 - Math.pow(0.01, dt));

    /* ---- firing & heat ---- */
    const pointerFiring = this.pointer.down && this.pointer.type !== 'touch';
    this.firing = !dying && (k.has(' ') || pointerFiring || this.touchFiring);
    this.fireCd -= dt;
    if (this.firing && !this.overheated && this.fireCd <= 0) {
      this.fireCd = 1 / (this.time < this.overdriveUntil ? 14 : 9);
      this.firePlayerBolt();
    }
    const coolRate = this.overheated ? (this.firing ? 0 : 42) : this.firing ? 13 : 34;
    this.heat = Math.max(0, this.heat - coolRate * dt);
    if (this.overheated && !this.firing && this.heat < 25) this.overheated = false;

    /* ---- shield regen ---- */
    if (this.time - this.lastHurt > 5 && !dying) this.shield = Math.min(100, this.shield + 4 * dt);

    /* ---- combo timers ---- */
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 0;
    this.chainTimer -= dt;
    if (this.chainTimer <= 0) this.chain = 0;

    if (!dying) this.director(dt);

    /* ---- obstacles ---- */
    for (const o of this.obstacles) {
      o.prevZ = o.z;
      o.z -= this.speed * dt;
      // collision with player
      if (!dying && !o.passed && o.prevZ >= ZP && o.z <= ZP) {
        const crossT = clamp((o.prevZ - ZP) / Math.max(0.0001, o.prevZ - o.z), 0, 1);
        const playerX = lerp(prevPx, this.px, crossT);
        const playerAlt = lerp(prevPalt, this.palt, crossT);
        const collW = (o.w * o.def.cw) / 2;
        const dx = Math.abs(playerX - o.x);
        const inHole =
          o.def.hole &&
          dx < o.w * o.def.hole.hw &&
          playerAlt > o.def.h * o.def.hole.y0 &&
          playerAlt < o.def.h * o.def.hole.y1;
        if (dx < collW + 12 && playerAlt < o.def.h * o.def.ch) {
          if (inHole) {
            o.passed = true;
            this.score += 750;
            this.comboTimer = Math.max(this.comboTimer, 4.5);
            this.overdriveUntil = Math.max(this.overdriveUntil, this.time) + 5;
            this.heat = 0;
            this.overheated = false;
            this.popups.push({ text: '+750 THREAD // REDLINE ONLINE', sx: this.cx, sy: this.H * 0.42, life: 1.6, color: C.tan });
            this.sfx.needle();
          } else {
            o.passed = true;
            this.pvx = playerX > o.x ? 200 : -200;
            this.hurtPlayer(26);
          }
        }
        o.passed = true;
      }
    }

    /* ---- enemies ---- */
    for (const e of this.enemies) {
      e.prevZ = e.z;
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt * 6);
      if (e.hp > 0) {
        if (e.kind === 'warden') {
          e.z -= this.speed * 0.2 * dt;
          e.x += clamp((this.px - e.x) * 0.55, -55, 55) * dt + Math.sin(e.t * 1.8 + e.seed) * 12 * dt;
          e.alt = clamp(e.alt + Math.cos(e.t * 1.3 + e.seed) * 10 * dt, 30, 62);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && e.z < 880 && e.z > 190 && !dying) {
            e.fireCd = rand(0.58, 0.9);
            this.enemyFire(e);
          }
        } else if (e.kind === 'grinder') {
          e.z -= this.speed * 0.42 * dt;
          e.x += Math.sin(e.t * 1.3 + e.seed) * 26 * dt;
          e.alt += Math.cos(e.t * 0.9 + e.seed) * 9 * dt;
          e.fireCd -= dt;
          if (e.fireCd <= 0 && e.z < 720 && e.z > 220 && !dying) {
            e.fireCd = rand(1.4, 2.4);
            this.enemyFire(e);
          }
        } else if (e.kind === 'wasp') {
          e.z -= this.speed * 0.88 * dt;
          e.x += Math.sin(e.t * 2.6 + e.seed) * 120 * dt;
          e.alt += Math.cos(e.t * 1.8 + e.seed) * 30 * dt;
          e.alt = clamp(e.alt, 8, 75);
        } else {
          // mine drifts with world
          e.z -= this.speed * dt;
          e.x += Math.sin(e.t * 0.8 + e.seed) * 8 * dt;
          // proximity detonation
          if (!dying && e.z < ZP + 60 && e.z > ZP - 20 && Math.abs(e.x - this.px) < 46 && Math.abs(e.alt - this.palt) < 34) {
            e.hp = 0;
            this.explode(e.x, e.alt, e.z, true);
            this.sfx.boom(true);
            this.hurtPlayer(20);
          }
        }

        // ram check
        if (!dying && e.hp > 0 && e.prevZ >= ZP && e.z <= ZP) {
          const crossT = clamp((e.prevZ - ZP) / Math.max(0.0001, e.prevZ - e.z), 0, 1);
          const playerX = lerp(prevPx, this.px, crossT);
          const playerAlt = lerp(prevPalt, this.palt, crossT);
          const d = Math.hypot(e.x - playerX, (e.alt - playerAlt) * 1.4);
          if (d < e.r + 12) {
            e.hp = 0;
            this.explode(e.x, e.alt, e.z, true);
            this.sfx.boom(true);
            this.hurtPlayer(e.kind === 'warden' ? 36 : 15);
          }
        }

        if (e.kind === 'warden' && e.hp > 0 && e.z <= ZP - 16) e.hp = 0;
      }

      this.resolveEnemy(e);
    }
    this.enemies = this.enemies.filter((e) => e.z > ZP - 16 && e.hp > 0);

    /* ---- pickups ---- */
    for (const p of this.pickups) {
      const prevZ = p.z;
      p.z -= this.speed * dt;
      p.t += dt;
      const crossT = clamp((prevZ - ZP) / Math.max(0.0001, prevZ - p.z), 0, 1);
      const playerX = lerp(prevPx, this.px, crossT);
      const playerAlt = lerp(prevPalt, this.palt, crossT);
      if (!dying && prevZ >= ZP && p.z <= ZP && Math.abs(p.x - playerX) < 26 && Math.abs(p.alt - playerAlt) < 22) {
        p.z = -1;
        this.shield = Math.min(100, this.shield + 30);
        this.score += 250;
        this.popups.push({ text: '+250 SHIELD CORE', sx: this.projX(p.x, ZP), sy: this.projY(p.alt, ZP) - 40, life: 1.2, color: C.blue });
        this.sfx.pickup();
      }
    }
    this.pickups = this.pickups.filter((p) => p.z > 20);

    /* ---- player bolts ---- */
    const lethalHits: { enemy: Enemy; crossT: number }[] = [];
    for (const b of this.bolts) {
      const prevX = b.x;
      const prevAlt = b.alt;
      const prevZ = b.z;
      b.x += b.vx * dt;
      b.alt += b.valt * dt;
      b.z += b.vz * dt;
      if (b.dead) continue;

      let hitT = Number.POSITIVE_INFINITY;
      let hitObstacle: Obstacle | null = null;
      let hitEnemy: Enemy | null = null;

      for (const o of this.obstacles) {
        const prevDelta = prevZ - o.prevZ;
        const nextDelta = b.z - o.z;
        if (prevDelta > 0 || nextDelta < 0) continue;
        const crossT = clamp(-prevDelta / Math.max(0.0001, nextDelta - prevDelta), 0, 1);
        if (crossT >= hitT) continue;
        const hitX = lerp(prevX, b.x, crossT);
        const hitAlt = lerp(prevAlt, b.alt, crossT);
        if (Math.abs(hitX - o.x) >= (o.w * o.def.cw) / 2 || hitAlt >= o.def.h * o.def.ch) continue;
        const inHole =
          o.def.hole &&
          Math.abs(hitX - o.x) < o.w * o.def.hole.hw &&
          hitAlt > o.def.h * o.def.hole.y0 &&
          hitAlt < o.def.h * o.def.hole.y1;
        if (!inHole) {
          hitT = crossT;
          hitObstacle = o;
          hitEnemy = null;
        }
      }

      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        const prevDelta = prevZ - e.prevZ;
        const nextDelta = b.z - e.z;
        if (prevDelta > 0 || nextDelta < 0) continue;
        const crossT = clamp(-prevDelta / Math.max(0.0001, nextDelta - prevDelta), 0, 1);
        if (crossT >= hitT) continue;
        const hitX = lerp(prevX, b.x, crossT);
        const hitAlt = lerp(prevAlt, b.alt, crossT);
        const d = Math.hypot(e.x - hitX, (e.alt - hitAlt) * 1.3);
        if (d < e.r + 9) {
          hitT = crossT;
          hitEnemy = e;
          hitObstacle = null;
        }
      }

      if (hitEnemy) {
        const hitX = lerp(prevX, b.x, hitT);
        const hitAlt = lerp(prevAlt, b.alt, hitT);
        b.dead = true;
        hitEnemy.hp -= 1;
        if (hitEnemy.hp <= 0) {
          hitEnemy.destroyedByPlayer = true;
          lethalHits.push({ enemy: hitEnemy, crossT: hitT });
        }
        hitEnemy.flash = 1;
        this.explode(hitX, hitAlt, lerp(prevZ, b.z, hitT), false);
      } else if (hitObstacle) {
        const hitX = lerp(prevX, b.x, hitT);
        const hitAlt = lerp(prevAlt, b.alt, hitT);
        b.dead = true;
        this.explode(hitX, hitAlt, lerp(prevZ, b.z, hitT), false);
      } else if (b.z > 1400 || b.alt < 0) {
        b.dead = true;
      }
    }
    lethalHits.sort((a, b) => a.crossT - b.crossT);
    for (const hit of lethalHits) this.resolveEnemy(hit.enemy);
    this.enemies = this.enemies.filter((e) => e.z > ZP - 16 && e.hp > 0);
    this.bolts = this.bolts.filter((b) => !b.dead);

    /* ---- enemy bolts ---- */
    for (const b of this.ebolts) {
      const prevX = b.x;
      const prevAlt = b.alt;
      const prevZ = b.z;
      b.x += b.vx * dt;
      b.alt += b.valt * dt;
      b.z += b.vz * dt;

      let hitT = Number.POSITIVE_INFINITY;
      let hitObstacle = false;
      let hitPlayer = false;

      for (const o of this.obstacles) {
        const prevDelta = prevZ - o.prevZ;
        const nextDelta = b.z - o.z;
        if (prevDelta < 0 || nextDelta > 0) continue;
        const crossT = clamp(prevDelta / Math.max(0.0001, prevDelta - nextDelta), 0, 1);
        if (crossT >= hitT) continue;
        const hitX = lerp(prevX, b.x, crossT);
        const hitAlt = lerp(prevAlt, b.alt, crossT);
        if (Math.abs(hitX - o.x) >= (o.w * o.def.cw) / 2 || hitAlt >= o.def.h * o.def.ch) continue;
        const inHole =
          o.def.hole &&
          Math.abs(hitX - o.x) < o.w * o.def.hole.hw &&
          hitAlt > o.def.h * o.def.hole.y0 &&
          hitAlt < o.def.h * o.def.hole.y1;
        if (!inHole) {
          hitT = crossT;
          hitObstacle = true;
          hitPlayer = false;
        }
      }

      if (!dying && this.state !== 'dying' && prevZ >= ZP && b.z <= ZP) {
        const crossT = clamp((prevZ - ZP) / Math.max(0.0001, prevZ - b.z), 0, 1);
        const hitX = lerp(prevX, b.x, crossT);
        const hitAlt = lerp(prevAlt, b.alt, crossT);
        const playerX = lerp(prevPx, this.px, crossT);
        const playerAlt = lerp(prevPalt, this.palt, crossT);
        const d = Math.hypot(hitX - playerX, (hitAlt - playerAlt) * 1.4);
        if (d < 16 && crossT < hitT) {
          hitT = crossT;
          hitPlayer = true;
          hitObstacle = false;
        }
      }

      if (hitPlayer) {
        b.dead = true;
        this.hurtPlayer(12);
      } else if (hitObstacle || b.z < ZP - 20 || b.z > 1400) {
        b.dead = true;
      }
    }
    this.ebolts = this.ebolts.filter((b) => !b.dead);
    this.obstacles = this.obstacles.filter((o) => o.z > ZP - 12);

    /* ---- ground specks (speed sensation) ---- */
    if (Math.random() < dt * 26) this.specks.push({ x: rand(-400, 400), z: FAR * 0.8 });
    for (const sp of this.specks) sp.z -= this.speed * dt;
    this.specks = this.specks.filter((sp) => sp.z > 20);

    /* ---- particles & popups ---- */
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.alt += p.valt * dt;
      p.z += p.vz * dt - this.speed * 0.4 * dt;
      p.valt -= 60 * dt;
      if (p.alt < 0) {
        p.alt = 0;
        p.valt *= -0.4;
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0 && p.z > 15);
    for (const p of this.popups) {
      p.life -= dt;
      p.sy -= 34 * dt;
    }
    this.popups = this.popups.filter((p) => p.life > 0);

    this.shake = Math.max(0, this.shake - dt * 40);
    this.flashRed = Math.max(0, this.flashRed - dt * 1.6);
  }

  /* ---------------- render ---------------- */
  private mixColor(a: [number, number, number], b: [number, number, number], t: number) {
    return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
  }
  private hex(h: string): [number, number, number] {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }

  private render() {
    const { ctx, W, H } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // screen shake
    if (this.shake > 0) {
      ctx.translate(rand(-this.shake, this.shake) * 0.5, rand(-this.shake, this.shake) * 0.5);
    }

    this.renderSky(ctx);
    this.renderGround(ctx);
    this.renderEntities(ctx);
    if (this.state === 'playing' || this.state === 'paused') this.renderShip(ctx);
    if (this.state !== 'attract') this.renderHud(ctx);

    // damage flash
    if (this.flashRed > 0) {
      ctx.fillStyle = `rgba(200,30,15,${this.flashRed * 0.4})`;
      ctx.fillRect(0, 0, W, H);
    }
    // dying fade
    if (this.state === 'dying') {
      ctx.fillStyle = `rgba(120,10,5,${(1.5 - this.dieTimer) * 0.25})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.state === 'paused') {
      ctx.fillStyle = 'rgba(8,4,2,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.font = `${Math.round(H * 0.045)}px Orbitron, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = C.cream;
      ctx.fillText('PAUSED', this.cx, H * 0.5);
      ctx.font = `${Math.round(H * 0.02)}px "Space Mono", monospace`;
      ctx.fillStyle = C.tan;
      ctx.fillText('PRESS P TO RESUME', this.cx, H * 0.56);
    }
  }

  private renderSky(ctx: CanvasRenderingContext2D) {
    const { W, H } = this;
    const g = ctx.createLinearGradient(0, 0, 0, this.horizonY);
    g.addColorStop(0, C.sky0);
    g.addColorStop(0.55, C.sky1);
    g.addColorStop(1, C.sky2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, this.horizonY + 1);

    // moons
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#f2dca0';
    ctx.beginPath();
    ctx.arc(W * 0.31, this.horizonY * 0.42, H * 0.052, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#8a5a28';
    ctx.beginPath();
    ctx.arc(W * 0.3, this.horizonY * 0.4, H * 0.012, 0, Math.PI * 2);
    ctx.arc(W * 0.325, this.horizonY * 0.46, H * 0.008, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#f2dca0';
    ctx.beginPath();
    ctx.arc(W * 0.66, this.horizonY * 0.24, H * 0.026, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // skyline layers (slow parallax)
    if (this.skyBack && this.skyFront) {
      const offB = ((this.scrollZ * 0.02 + this.camX * 0.1) % W + W) % W;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(this.skyBack, -offB, 0);
      ctx.drawImage(this.skyBack, W - offB, 0);
      const offF = ((this.scrollZ * 0.05 + this.camX * 0.3) % W + W) % W;
      ctx.drawImage(this.skyFront, -offF, 0);
      ctx.drawImage(this.skyFront, W - offF, 0);
      ctx.globalAlpha = 1;
    }

    // horizon glow
    const hg = ctx.createLinearGradient(0, this.horizonY - H * 0.06, 0, this.horizonY + H * 0.03);
    hg.addColorStop(0, 'rgba(242,192,99,0)');
    hg.addColorStop(1, 'rgba(242,192,99,0.5)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, this.horizonY - H * 0.06, W, H * 0.09 + 2);
  }

  private renderGround(ctx: CanvasRenderingContext2D) {
    const { W, H } = this;
    // base fog color
    ctx.fillStyle = C.groundFog;
    ctx.fillRect(0, this.horizonY, W, H - this.horizonY);

    const gA = this.hex(C.groundA);
    const gB = this.hex(C.groundB);
    const fog = this.hex(C.groundFog);
    const step = 4;
    for (let y = Math.floor(this.horizonY) + 2; y < H; y += step) {
      const z = (this.f * CAM_H) / (y - this.horizonY);
      if (z > GROUND_ZMAX) continue;
      const t = Math.min(1, z / GROUND_ZMAX);
      const cA = this.mixColor(gA, fog, t);
      const cB = this.mixColor(gB, fog, t);
      const worldRow = Math.floor((z + this.scrollZ) / CELL);
      const range = ((W / 2 + 30) * z) / this.f + CELL;
      const kMin = Math.floor((this.camX - range) / CELL);
      const kMax = Math.ceil((this.camX + range) / CELL);
      for (let kk = kMin; kk < kMax; kk++) {
        const x0 = this.projX(kk * CELL, z);
        const x1 = this.projX((kk + 1) * CELL, z);
        ctx.fillStyle = (kk + worldRow) % 2 === 0 ? cA : cB;
        ctx.fillRect(x0, y, x1 - x0 + 1, step);
      }
    }
  }

  private renderEntities(ctx: CanvasRenderingContext2D) {
    type Item = { z: number; draw: () => void };
    const items: Item[] = [];

    for (const sp of this.specks) {
      items.push({
        z: sp.z,
        draw: () => {
          const sx = this.projX(sp.x, sp.z);
          const sy = this.projY(0, sp.z);
          const s = Math.max(1, (4 * this.f) / sp.z / 40);
          ctx.fillStyle = 'rgba(60,36,16,0.7)';
          ctx.fillRect(sx, sy, s * 2, s);
        },
      });
    }

    for (const o of this.obstacles) {
      items.push({
        z: o.z,
        draw: () => {
          const sc = this.f / o.z;
          const rawH = o.def.h * sc;
          const h = Math.min(rawH, this.H * 1.25);
          const w = (h * o.img.width) / o.img.height;
          const sx = this.projX(o.x, o.z);
          const sy = this.projY(0, o.z);
          ctx.globalAlpha = clamp((FAR - o.z) / 200, 0, 1);
          ctx.drawImage(o.img, sx - w / 2, sy - h, w, h);
          ctx.globalAlpha = 1;
        },
      });
    }

    for (const p of this.pickups) {
      items.push({
        z: p.z,
        draw: () => {
          const bob = Math.sin(p.t * 4) * 3;
          const sc = this.f / p.z;
          const s = 22 * sc;
          const sx = this.projX(p.x, p.z);
          const sy = this.projY(p.alt + bob, p.z);
          ctx.globalAlpha = clamp((FAR - p.z) / 200, 0, 1);
          ctx.globalCompositeOperation = 'lighter';
          const gl = ctx.createRadialGradient(sx, sy, 0, sx, sy, s);
          gl.addColorStop(0, 'rgba(143,208,224,0.5)');
          gl.addColorStop(1, 'rgba(143,208,224,0)');
          ctx.fillStyle = gl;
          ctx.fillRect(sx - s, sy - s, s * 2, s * 2);
          ctx.globalCompositeOperation = 'source-over';
          ctx.drawImage(this.proc.core, sx - s / 2, sy - s / 2, s, s);
          ctx.globalAlpha = 1;
        },
      });
    }

    for (const e of this.enemies) {
      items.push({
        z: e.z,
        draw: () => {
          const sc = this.f / e.z;
          const maxScreenFraction = e.kind === 'warden' ? 0.46 : e.kind === 'grinder' ? 0.25 : e.kind === 'wasp' ? 0.24 : 0.18;
          const s = Math.min(e.r * 2.6 * sc, this.H * maxScreenFraction);
          const sx = this.projX(e.x, e.z);
          const sy = this.projY(e.alt, e.z);
          ctx.globalAlpha = clamp((FAR - e.z) / 200, 0, 1);
          if (e.flash > 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(255,220,160,${e.flash * 0.8})`;
            ctx.beginPath();
            ctx.arc(sx, sy, s * 0.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
          }
          const img = e.kind === 'warden' ? this.wardenImg : e.kind === 'grinder' ? this.proc.grinder : e.kind === 'wasp' ? this.proc.wasp : this.proc.mine;
          if (!img) {
            ctx.globalAlpha = 1;
            return;
          }
          if (e.kind === 'warden') {
            const w = s * (img.width / img.height);
            ctx.drawImage(img, sx - w / 2, sy - s / 2, w, s);
          } else if (e.kind === 'mine') {
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(e.t * 2 + e.seed);
            ctx.drawImage(img, -s / 2, -s / 2, s, s);
            ctx.restore();
          } else if (e.kind === 'wasp') {
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(Math.cos(e.t * 2.6 + e.seed) * 0.5);
            const h = s * 0.62;
            const w = h * (img.width / img.height);
            ctx.drawImage(img, -w / 2, -h / 2, w, h);
            ctx.restore();
          } else {
            const h = e.kind === 'grinder' ? s * 0.82 : s;
            const w = h * (img.width / img.height);
            ctx.drawImage(img, sx - w / 2, sy - h / 2, w, h);
          }
          ctx.globalAlpha = 1;
        },
      });
    }

    for (const b of this.bolts) {
      items.push({
        z: b.z,
        draw: () => {
          const sc = this.f / b.z;
          const s = Math.max(4, 13 * sc);
          const sx = this.projX(b.x, b.z);
          const sy = this.projY(b.alt, b.z);
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(this.boltImg, sx - s, sy - s * 0.5, s * 2, s);
          ctx.globalCompositeOperation = 'source-over';
        },
      });
    }

    for (const b of this.ebolts) {
      items.push({
        z: b.z,
        draw: () => {
          const sc = this.f / b.z;
          const s = Math.max(4, 12 * sc);
          const sx = this.projX(b.x, b.z);
          const sy = this.projY(b.alt, b.z);
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(this.eBoltImg, sx - s, sy - s, s * 2, s * 2);
          ctx.globalCompositeOperation = 'source-over';
        },
      });
    }

    for (const p of this.particles) {
      items.push({
        z: p.z,
        draw: () => {
          const a = clamp(p.life / 0.5, 0, 1);
          const sc = this.f / p.z;
          const s = Math.max(1.5, p.size * sc * 0.9);
          const sx = this.projX(p.x, p.z);
          const sy = this.projY(p.alt, p.z);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        },
      });
    }

    items.sort((a, b) => b.z - a.z);
    for (const it of items) it.draw();
  }

  private renderShip(ctx: CanvasRenderingContext2D) {
    if (this.state === 'dying') return;
    // invulnerability blink
    if (this.time < this.invulnUntil && Math.floor(this.time * 12) % 2 === 0 && this.state === 'playing') {
      // blink: skip hull draw but keep flames
    }
    const sx = this.projX(this.px, ZP);
    const sy = this.projY(this.palt, ZP);
    const w = this.H * 0.17;
    const img = this.pvx < -70 ? this.proc.shipBankL : this.pvx > 70 ? this.proc.shipBankR : this.proc.ship;
    const h = w * (img.height / img.width);
    const blink = this.time < this.invulnUntil && Math.floor(this.time * 12) % 2 === 0;

    // engine flames
    const flick = 0.75 + Math.sin(this.time * 40) * 0.25;
    const fl = h * 0.55 * flick;
    ctx.globalCompositeOperation = 'lighter';
    for (const off of [-w * 0.16, w * 0.16]) {
      const fg = ctx.createRadialGradient(sx + off, sy + h * 0.42, 0, sx + off, sy + h * 0.42 + fl * 0.5, fl * 0.5);
      fg.addColorStop(0, 'rgba(255,240,200,0.9)');
      fg.addColorStop(0.4, 'rgba(255,140,46,0.6)');
      fg.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.ellipse(sx + off, sy + h * 0.42 + fl * 0.4, w * 0.045, fl * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // shadow on ground
    const shY = this.projY(0, ZP);
    const shScale = clamp(1 - this.palt / 110, 0.2, 1);
    ctx.fillStyle = `rgba(30,16,8,${0.3 * shScale})`;
    ctx.beginPath();
    ctx.ellipse(sx, shY, w * 0.4 * shScale, w * 0.09 * shScale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (!blink) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-this.pvx * 0.0007);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    }

    // crosshair
    const cross = { x: this.cx, y: this.horizonY + (this.H - this.horizonY) * 0.08 };
    ctx.strokeStyle = 'rgba(255,59,38,0.85)';
    ctx.lineWidth = 2;
    const cr = 14;
    ctx.beginPath();
    ctx.moveTo(cross.x - cr, cross.y);
    ctx.lineTo(cross.x - cr * 0.4, cross.y);
    ctx.moveTo(cross.x + cr * 0.4, cross.y);
    ctx.lineTo(cross.x + cr, cross.y);
    ctx.moveTo(cross.x, cross.y - cr);
    ctx.lineTo(cross.x, cross.y - cr * 0.4);
    ctx.moveTo(cross.x, cross.y + cr * 0.4);
    ctx.lineTo(cross.x, cross.y + cr);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,59,38,0.9)';
    ctx.fillRect(cross.x - 1.5, cross.y - 1.5, 3, 3);
  }

  /* ---------------- HUD ---------------- */
  private panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.fillStyle = C.red;
    ctx.fillRect(x + 4, y + 4, w, h);
    ctx.fillStyle = C.darkPanel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = C.cream;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(241,215,143,0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
  }

  private segBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, segs: number, color: string, flash: boolean) {
    const gap = 2;
    const sw = (w - gap * (segs - 1)) / segs;
    for (let i = 0; i < segs; i++) {
      const on = i / segs < frac;
      ctx.fillStyle = on ? color : 'rgba(80,50,30,0.5)';
      if (on && flash && Math.floor(this.time * 6) % 2 === 0) ctx.fillStyle = C.cream;
      ctx.fillRect(x + i * (sw + gap), y, sw, h);
    }
  }

  private setFittedFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, family: string) {
    let size = startSize;
    do {
      ctx.font = `${Math.round(size)}px ${family}`;
      size -= 1;
    } while (size > 8 && ctx.measureText(text).width > maxWidth);
  }

  private renderBossTelemetry(ctx: CanvasRenderingContext2D, y: number, compact: boolean) {
    const boss = this.enemies.find((enemy) => enemy.kind === 'warden' && enemy.hp > 0);
    if (!boss) return;
    const width = compact ? Math.min(this.W - 24, 360) : Math.min(this.W * 0.38, 520);
    const height = compact ? 34 : 42;
    const x = this.cx - width / 2;
    this.panel(ctx, x, y, width, height);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.cream;
    ctx.font = `${compact ? 10 : 12}px "Space Mono", monospace`;
    ctx.fillText(`RELAY WARDEN // ${String(Math.max(0, boss.hp)).padStart(2, '0')}`, x + 9, y + (compact ? 13 : 16));
    ctx.fillStyle = '#20282b';
    ctx.fillRect(x + 9, y + height - 13, width - 18, 7);
    ctx.fillStyle = C.hotRed;
    ctx.fillRect(x + 9, y + height - 13, (width - 18) * clamp(boss.hp / boss.maxHp, 0, 1), 7);
  }

  private renderStageOverlay(ctx: CanvasRenderingContext2D) {
    if (this.time >= this.stageBannerUntil) return;
    if (this.W < 680 && this.H < 420 && this.time < this.alertUntil) return;
    const w = Math.min(this.W - 32, 520);
    const h = this.W < 680 ? 58 : 76;
    const x = this.cx - w / 2;
    const y = this.H * 0.27;
    ctx.fillStyle = C.cream;
    ctx.fillRect(x + 5, y + 5, w, h);
    ctx.fillStyle = C.red;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#0b0d0e';
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0b0d0e';
    ctx.font = `${this.W < 680 ? 16 : 23}px Orbitron, sans-serif`;
    ctx.fillText(`STAGE ${String(this.stage).padStart(2, '0')}`, this.cx, y + (this.W < 680 ? 24 : 31));
    ctx.font = `${this.W < 680 ? 10 : 13}px "Space Mono", monospace`;
    ctx.fillText(this.relayActive ? 'DESTROY THE RELAY WARDEN' : 'PUNCH THROUGH // FIND THE RELAY', this.cx, y + (this.W < 680 ? 43 : 56));
  }

  private renderCompactHud(ctx: CanvasRenderingContext2D) {
    const { W, H } = this;
    const topH = 70;
    const bottomH = 88;

    ctx.fillStyle = C.darkPanel;
    ctx.fillRect(0, 0, W, topH);
    ctx.fillStyle = C.cream;
    ctx.fillRect(0, topH - 4, W, 4);
    ctx.fillStyle = C.red;
    ctx.fillRect(0, topH - 8, W, 4);

    ctx.font = '10px "Space Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = C.tan;
    ctx.fillText('SCORE', 10, 17);
    ctx.fillStyle = C.cream;
    ctx.font = '15px "Space Mono", monospace';
    ctx.fillText(String(this.score).padStart(7, '0'), 10, 38);
    ctx.fillStyle = C.hotRed;
    ctx.font = '9px "Space Mono", monospace';
    ctx.fillText(`HI ${String(Math.max(this.hiScore, this.score)).padStart(7, '0')}`, 10, 56);

    ctx.textAlign = 'center';
    ctx.fillStyle = C.hotRed;
    ctx.font = '13px Orbitron, sans-serif';
    ctx.fillText('REDLINE', this.cx, 19);
    ctx.fillStyle = C.cream;
    ctx.font = '10px "Space Mono", monospace';
    ctx.fillText(`STG ${String(this.stage).padStart(2, '0')}`, this.cx, 39);
    ctx.fillStyle = C.tan;
    ctx.fillText(`${(this.dist / 10).toFixed(1)} KM`, this.cx, 56);

    ctx.textAlign = 'right';
    ctx.fillStyle = C.tan;
    ctx.font = '10px "Space Mono", monospace';
    ctx.fillText('TIME', W - 10, 17);
    ctx.fillStyle = C.cream;
    ctx.font = '15px "Space Mono", monospace';
    ctx.fillText(this.runTime.toFixed(1), W - 10, 38);
    ctx.fillStyle = C.tan;
    ctx.font = '9px "Space Mono", monospace';
    ctx.fillText('CREDIT 02', W - 10, 56);

    this.renderBossTelemetry(ctx, topH + 10, true);

    const by = H - bottomH;
    ctx.fillStyle = C.darkPanel;
    ctx.fillRect(0, by, W, bottomH);
    ctx.fillStyle = C.cream;
    ctx.fillRect(0, by, W, 4);
    ctx.fillStyle = C.red;
    ctx.fillRect(0, by + 4, W, 4);
    const barW = Math.max(94, W - 150);
    ctx.textAlign = 'left';
    ctx.font = '10px "Space Mono", monospace';
    ctx.fillStyle = C.tan;
    ctx.fillText('HEAT', 10, by + 27);
    this.segBar(ctx, 55, by + 17, barW - 55, 10, this.heat / 100, 10, C.hotRed, this.overheated);
    ctx.fillStyle = C.tan;
    ctx.fillText('SHIELD', 10, by + 53);
    this.segBar(ctx, 55, by + 43, barW - 55, 10, this.shield / 100, 10, C.blue, this.shield < 30);
    ctx.fillStyle = C.cream;
    ctx.font = '9px "Space Mono", monospace';
    ctx.fillText(this.time < this.overdriveUntil ? 'REDLINE OVERDRIVE' : this.overheated ? 'OVERHEAT // RELEASE TRIGGER' : 'PHOTON BLASTER // READY', 10, by + 75);

    const rr = 28;
    const rx = W - 42;
    const ry = by + 45;
    ctx.beginPath();
    ctx.arc(rx, ry, rr, 0, Math.PI * 2);
    ctx.fillStyle = '#09161c';
    ctx.fill();
    ctx.strokeStyle = C.cream;
    ctx.lineWidth = 2;
    ctx.stroke();
    for (const enemy of this.enemies) {
      const bx = rx + clamp((enemy.x - this.px) / 260, -1, 1) * rr * 0.8;
      const bz = ry + rr * 0.8 - clamp(enemy.z / 1250, 0, 1) * rr * 1.6;
      if (Math.hypot(bx - rx, bz - ry) <= rr) {
        ctx.fillStyle = C.hotRed;
        ctx.fillRect(bx - 2, bz - 2, 4, 4);
      }
    }

    if (this.time < this.alertUntil) {
      const text = this.alertText;
      const aw = W - 20;
      const ay = this.enemies.some((enemy) => enemy.kind === 'warden' && enemy.hp > 0) ? topH + 51 : topH + 10;
      ctx.fillStyle = C.hotRed;
      ctx.fillRect(10, ay, aw, 28);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0b0d0e';
      this.setFittedFont(ctx, text, aw - 16, 13, '"Space Mono", monospace');
      ctx.fillText(text, this.cx, ay + 19);
    }

    if (this.runTime < 8) {
      ctx.textAlign = 'center';
      ctx.font = '10px "Space Mono", monospace';
      ctx.fillStyle = C.cream;
      ctx.fillText('DRAG TO FLY // HOLD FIRE', this.cx, by - 14);
    }
    this.renderStageOverlay(ctx);

    ctx.textAlign = 'center';
    for (const popup of this.popups) {
      ctx.globalAlpha = clamp(popup.life / 0.4, 0, 1);
      this.setFittedFont(ctx, popup.text, W - 24, 18, '"Space Mono", monospace');
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0b0d0e';
      ctx.strokeText(popup.text, popup.sx, popup.sy);
      ctx.fillStyle = popup.color;
      ctx.fillText(popup.text, popup.sx, popup.sy);
      ctx.globalAlpha = 1;
    }
  }

  private renderHud(ctx: CanvasRenderingContext2D) {
    const { W, H } = this;
    const ui = clamp(Math.min(W, H) / 780, 0.72, 1.3);
    const pad = 12 * ui;

    if (W < 680) {
      this.renderCompactHud(ctx);
      return;
    }

    /* ---- top center logo ---- */
    ctx.textAlign = 'center';
    ctx.font = `${Math.round(H * 0.032)}px Orbitron, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(20,10,5,0.9)';
    ctx.strokeText('REDLINE ASCENT', this.cx, pad + H * 0.028);
    ctx.fillStyle = C.hotRed;
    ctx.fillText('REDLINE ASCENT', this.cx, pad + H * 0.028);
    ctx.font = `${Math.round(16 * ui)}px "Space Mono", monospace`;
    ctx.fillStyle = C.tan;
    const km = (this.dist / 10).toFixed(1);
    ctx.fillText(`STAGE ${String(this.stage).padStart(2, '0')} // DIST ${km} KM`, this.cx, pad + H * 0.028 + 22 * ui);

    /* ---- top left: score ---- */
    const pw = 240 * ui;
    const ph = 64 * ui;
    this.panel(ctx, pad, pad, pw, ph);
    ctx.textAlign = 'left';
    ctx.font = `${Math.round(16 * ui)}px "Space Mono", monospace`;
    ctx.fillStyle = C.tan;
    ctx.fillText('SCORE', pad + 10 * ui, pad + 20 * ui);
    ctx.fillText('HI SCORE', pad + 10 * ui, pad + 48 * ui);
    ctx.textAlign = 'right';
    ctx.fillStyle = C.cream;
    ctx.fillText(String(this.score).padStart(8, '0'), pad + pw - 10 * ui, pad + 20 * ui);
    ctx.fillStyle = C.hotRed;
    ctx.fillText(String(Math.max(this.hiScore, this.score)).padStart(8, '0'), pad + pw - 10 * ui, pad + 48 * ui);

    /* ---- top right: time / credit ---- */
    this.panel(ctx, W - pad - pw, pad, pw, ph);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.tan;
    ctx.fillText('TIME', W - pad - pw + 10 * ui, pad + 20 * ui);
    ctx.fillText('CREDIT', W - pad - pw + 10 * ui, pad + 48 * ui);
    ctx.textAlign = 'right';
    ctx.fillStyle = C.cream;
    ctx.fillText(this.runTime.toFixed(1), W - pad - 10 * ui, pad + 20 * ui);
    ctx.fillStyle = C.cream;
    ctx.fillText('02', W - pad - 10 * ui, pad + 48 * ui);

    this.renderBossTelemetry(ctx, pad + ph + 10 * ui, false);

    /* ---- bottom left: weapon / heat / shield ---- */
    const bw = 280 * ui;
    const bh = 96 * ui;
    const bx = pad;
    const by = H - pad - bh;
    this.panel(ctx, bx, by, bw, bh);
    ctx.textAlign = 'left';
    ctx.font = `${Math.round(15 * ui)}px "Space Mono", monospace`;
    ctx.fillStyle = C.hotRed;
    ctx.fillText('WEAPON', bx + 10 * ui, by + 20 * ui);
    ctx.fillStyle = C.cream;
    ctx.fillText('PHOTON BLASTER', bx + 90 * ui, by + 20 * ui);
    ctx.fillStyle = C.tan;
    ctx.fillText('HEAT', bx + 10 * ui, by + 46 * ui);
    this.segBar(ctx, bx + 70 * ui, by + 32 * ui, 160 * ui, 14 * ui, this.heat / 100, 14, C.hotRed, this.overheated);
    ctx.fillStyle = this.overheated ? C.hotRed : C.cream;
    ctx.textAlign = 'right';
    ctx.fillText(this.overheated ? '!!' : `${Math.round(this.heat)}%`, bx + bw - 10 * ui, by + 46 * ui);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.tan;
    ctx.fillText('SHIELD', bx + 10 * ui, by + 74 * ui);
    this.segBar(ctx, bx + 70 * ui, by + 60 * ui, 160 * ui, 14 * ui, this.shield / 100, 14, C.blue, this.shield < 30);
    ctx.textAlign = 'right';
    ctx.fillStyle = this.shield < 30 ? C.hotRed : C.cream;
    ctx.fillText(`${Math.round(this.shield)}%`, bx + bw - 10 * ui, by + 74 * ui);

    ctx.textAlign = 'left';
    ctx.font = `${Math.round(12 * ui)}px "Space Mono", monospace`;
    ctx.fillStyle = this.time < this.overdriveUntil ? C.tan : this.overheated ? C.hotRed : C.cream;
    const weaponState = this.time < this.overdriveUntil ? 'REDLINE OVERDRIVE // 14 HZ' : this.overheated ? 'OVERHEAT // RELEASE TRIGGER' : 'SYSTEM NOMINAL';
    ctx.fillText(weaponState, bx + 4 * ui, by - 10 * ui);

    /* ---- combo ---- */
    if (this.combo > 1) {
      const mult = Math.min(15, 1 + Math.floor(this.combo / 2));
      ctx.textAlign = 'left';
      ctx.font = `${Math.round(13 * ui)}px Orbitron, sans-serif`;
      ctx.fillStyle = C.tan;
      ctx.fillText('COMBO', bx + 2 * ui, by - 44 * ui);
      ctx.font = `${Math.round(26 * ui)}px Orbitron, sans-serif`;
      ctx.fillStyle = mult >= 8 ? C.hotRed : C.cream;
      ctx.fillText(`x${mult}`, bx + 2 * ui, by - 12 * ui);
    }

    /* ---- radar ---- */
    const rr = 58 * ui;
    const rx = W - pad - rr - 6 * ui;
    const ry = H - pad - rr - 6 * ui;
    ctx.beginPath();
    ctx.arc(rx, ry, rr, 0, Math.PI * 2);
    ctx.fillStyle = C.darkPanel;
    ctx.fill();
    ctx.strokeStyle = C.tan;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(181,138,76,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(rx, ry, rr * 0.66, 0, Math.PI * 2);
    ctx.arc(rx, ry, rr * 0.33, 0, Math.PI * 2);
    ctx.moveTo(rx - rr, ry);
    ctx.lineTo(rx + rr, ry);
    ctx.moveTo(rx, ry - rr);
    ctx.lineTo(rx, ry + rr);
    ctx.stroke();
    // sweep
    const sweepA = this.time * 1.6;
    const sg = ctx.createLinearGradient(rx, ry, rx + Math.cos(sweepA) * rr, ry + Math.sin(sweepA) * rr);
    sg.addColorStop(0, 'rgba(255,59,38,0)');
    sg.addColorStop(1, 'rgba(255,59,38,0.8)');
    ctx.strokeStyle = sg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx + Math.cos(sweepA) * rr, ry + Math.sin(sweepA) * rr);
    ctx.stroke();
    // blips
    const blip = (wx: number, z: number, color: string, s: number) => {
      const bx2 = rx + clamp((wx - this.px) / 260, -1, 1) * rr * 0.92;
      const by2 = ry + rr * 0.92 - clamp(z / 1250, 0, 1) * rr * 1.84;
      const dx = bx2 - rx;
      const dy = by2 - ry;
      if (dx * dx + dy * dy > rr * rr) return;
      ctx.fillStyle = color;
      ctx.fillRect(bx2 - s / 2, by2 - s / 2, s, s);
    };
    for (const o of this.obstacles) blip(o.x, o.z, 'rgba(232,195,132,0.8)', 3 * ui);
    for (const e of this.enemies) blip(e.x, e.z, C.hotRed, 4 * ui);
    for (const p of this.pickups) blip(p.x, p.z, C.blue, 4 * ui);
    // player wedge
    ctx.fillStyle = C.cream;
    ctx.beginPath();
    ctx.moveTo(rx, ry + rr * 0.85);
    ctx.lineTo(rx - 5 * ui, ry + rr * 0.98);
    ctx.lineTo(rx + 5 * ui, ry + rr * 0.98);
    ctx.closePath();
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = `${Math.round(12 * ui)}px "Space Mono", monospace`;
    ctx.fillStyle = C.hotRed;
    ctx.fillText('RADAR', rx, ry - rr - 6 * ui);

    /* ---- alert banner ---- */
    if (this.time < this.alertUntil) {
      const aw = Math.min(W - 40, 760);
      const ay = H * 0.15;
      ctx.fillStyle = Math.floor(this.time * 5) % 2 === 0 ? C.hotRed : C.red;
      ctx.fillRect(this.cx - aw / 2, ay, aw, 34 * ui);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0b0d0e';
      this.setFittedFont(ctx, this.alertText, aw - 28, 16 * ui, '"Space Mono", monospace');
      ctx.fillText(this.alertText, this.cx, ay + 23 * ui);
    }

    /* ---- shield critical ---- */
    if (this.shield < 30 && this.state === 'playing' && Math.floor(this.time * 3) % 2 === 0) {
      ctx.textAlign = 'center';
      ctx.font = `${Math.round(H * 0.018)}px Orbitron, sans-serif`;
      ctx.fillStyle = C.hotRed;
      ctx.fillText('SHIELD CRITICAL', this.cx, H * 0.24);
    }

    /* ---- popups ---- */
    ctx.textAlign = 'center';
    for (const p of this.popups) {
      const a = clamp(p.life / 0.4, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `${Math.round(18 * ui)}px "Space Mono", monospace`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(20,10,5,0.9)';
      ctx.strokeText(p.text, p.sx, p.sy);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.sx, p.sy);
      ctx.globalAlpha = 1;
    }

    /* ---- controls hint (early game) ---- */
    if (this.state === 'playing' && this.runTime < 9) {
      ctx.textAlign = 'center';
      ctx.font = `${Math.round(12 * ui)}px "Space Mono", monospace`;
      ctx.fillStyle = 'rgba(249,236,185,0.75)';
      ctx.fillText('WASD / ARROWS OR MOUSE TO FLY  —  HOLD SPACE / CLICK TO FIRE  —  P PAUSE  —  M MUTE', this.cx, H - 14 * ui);
    }
    this.renderStageOverlay(ctx);
  }
}
