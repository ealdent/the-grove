/**
 * A one-tape Turing machine that computes Conway's Game of Life (B3/S23) on an
 * n x n board whose outside is permanently dead.
 *
 * Tape layout, left to right: ⟨, then the board row by row inside a frame of X
 * squares (always dead), each row closed by #, then ⟩. Every row therefore takes
 * n + 3 squares, so the eight neighbours of any cell sit at fixed tape offsets.
 *
 * The controller is compiled into an explicit table before anything runs: for
 * every (state, symbol) pair it stores the symbol to write, the move (-1, 0, +1)
 * and the next state. `step` and `run` do nothing but look entries up in it.
 */

export const SYMBOLS = ['□', '⟨', '⟩', 'X', '#', '0', '1', '0*', '1*', '00', '01', '10', '11'];
export const BLANK = 0, LEFT_END = 1, RIGHT_END = 2, EDGE = 3, ROW_END = 4;
export const B0 = 5, B1 = 6, M0 = 7, M1 = 8, P00 = 9, P01 = 10, P10 = 11, P11 = 12;
const A = SYMBOLS.length;

export const isBit = s => s === B0 || s === B1;
export const isMark = s => s === M0 || s === M1;
export const isPair = s => s >= P00;
/** Old (current-generation) value a neighbour contributes, or -1 if the square holds no cell. */
export function oldValue(s) {
  if (s === EDGE || s === B0 || s === M0 || s === P00 || s === P01) return 0;
  if (s === B1 || s === M1 || s === P10 || s === P11) return 1;
  return -1;
}
/** Next-generation half of a pair, or -1. */
export const nextValue = s => (s === P01 || s === P11 ? 1 : s === P00 || s === P10 ? 0 : -1);

// State families. Turing wrote m-configurations in Fraktur; `letter` keeps that habit.
export const SCAN = 0, GO = 1, READ = 2, HOME = 3, PRINT = 4, BACK = 5, COMMIT = 6;
export const FAMILIES = [
  { key: 'scan', name: 'Scan', letter: 's' },
  { key: 'go', name: 'Go', letter: 'g' },
  { key: 'read', name: 'Read', letter: 'r' },
  { key: 'home', name: 'Home', letter: 'h' },
  { key: 'print', name: 'Print', letter: 'p' },
  { key: 'back', name: 'Back', letter: 'b' },
  { key: 'commit', name: 'Commit', letter: 'c' }
];
export const DIRECTIONS = ['NW', 'N', 'NE', 'W', 'E', 'SW', 'S', 'SE'];
export const DIRECTION_NAMES = ['north-west', 'north', 'north-east', 'west', 'east', 'south-west', 'south', 'south-east'];

// Events attached to table entries, for the display only.
export const EV_NONE = 0, EV_MARK = 1, EV_READ = 2, EV_PRINT = 3, EV_ALL_DONE = 4, EV_GENERATION = 5;

/** Closed forms, checked against the running machine in tests/conway-turing-engine.test.mjs. */
export const stateCount = n => 54 * n + 362;
export const stepsPerCell = n => 58 + 12 * n;
export const stepsPerGeneration = n => 12 * n ** 3 + 61 * n ** 2 + 20 * n + 29;
/** The first generation skips the opening rewind of n² + 5n + 7 steps. */
export const firstGenerationSteps = n => stepsPerGeneration(n) - (n * n + 5 * n + 7);

const programs = new Map();

/** Compile the controller for an n x n board into a state x symbol table. */
export function compile(n) {
  if (!Number.isInteger(n) || n < 1 || n > 64) throw new RangeError('Board size must be an integer from 1 to 64');
  if (programs.has(n)) return programs.get(n);
  const stride = n + 3;
  const offsets = [-stride - 1, -stride, -stride + 1, -1, 1, stride - 1, stride, stride + 1];
  // A state is (family, neighbour j, squares left d, live count c, old value o, mode m).
  const st = (f, j = -1, d = 0, c = 0, o = 0, m = 0) => ({ f, j, d, c, o, m });
  const goTo = (j, c, o) => st(GO, j, Math.abs(offsets[j]), c, o);

  function delta(q, s) {
    switch (q.f) {
      case SCAN:
        if (isBit(s)) { const o = s === B1 ? 1 : 0; return [o ? M1 : M0, 0, goTo(0, 0, o), EV_MARK]; }
        if (s === RIGHT_END) return [s, 0, st(BACK, -1, 0, 0, 0, 0), EV_ALL_DONE];
        return [s, 1, q, EV_NONE];
      case GO:
        return [s, Math.sign(offsets[q.j]), q.d === 1 ? st(READ, q.j, 0, q.c, q.o) : st(GO, q.j, q.d - 1, q.c, q.o), EV_NONE];
      case READ: {
        const b = oldValue(s);
        if (b < 0) return null;
        return [s, 0, st(HOME, q.j, 0, q.c + b, q.o), EV_READ];
      }
      case HOME:
        if (isMark(s)) return [s, 0, q.j === 7 ? st(PRINT, -1, 0, q.c, q.o) : goTo(q.j + 1, q.c, q.o), EV_NONE];
        return [s, -Math.sign(offsets[q.j]), q, EV_NONE];
      case PRINT: {
        if (!isMark(s)) return null;
        const next = q.c === 3 || (q.c === 2 && q.o === 1) ? 1 : 0;
        return [P00 + q.o * 2 + next, 1, st(SCAN), EV_PRINT];
      }
      case BACK: // mode 0 rewinds before the commit sweep, mode 1 before the next generation
        if (s === LEFT_END) return [s, 1, q.m === 0 ? st(COMMIT) : st(SCAN), EV_NONE];
        return [s, -1, q, EV_NONE];
      case COMMIT:
        if (s === RIGHT_END) return [s, -1, st(BACK, -1, 0, 0, 0, 1), EV_GENERATION];
        return [isPair(s) ? (nextValue(s) ? B1 : B0) : s, 1, q, EV_NONE];
    }
    return null;
  }

  const states = [], index = new Map();
  const intern = q => {
    const key = `${q.f}:${q.j}:${q.d}:${q.c}:${q.o}:${q.m}`;
    let id = index.get(key);
    if (id === undefined) { id = states.length; index.set(key, id); states.push(q); }
    return id;
  };
  intern(st(SCAN));
  const rows = [];
  for (let id = 0; id < states.length; id++) {
    const row = [];
    for (let s = 0; s < A; s++) {
      const t = delta(states[id], s);
      row.push(t && [t[0], t[1], intern(t[2]), t[3]]);
    }
    rows.push(row);
  }

  const S = states.length;
  const next = new Int32Array(S * A).fill(-1), write = new Uint8Array(S * A);
  const move = new Int8Array(S * A), event = new Uint8Array(S * A);
  let defined = 0;
  rows.forEach((row, id) => row.forEach((t, s) => {
    if (!t) return;
    const i = id * A + s;
    [write[i], move[i], next[i], event[i]] = t;
    defined++;
  }));
  const family = Uint8Array.from(states, q => q.f);
  const program = { n, stride, offsets, states, family, next, write, move, event, stateCount: S, symbolCount: A, defined };
  programs.set(n, program);
  return program;
}

/** One B3/S23 generation, cells outside the board dead. Independent of the machine. */
export function lifeStep(board, n) {
  const out = new Uint8Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    let k = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && cc >= 0 && rr < n && cc < n) k += board[rr * n + cc];
    }
    out[r * n + c] = k === 3 || (k === 2 && board[r * n + c]) ? 1 : 0;
  }
  return out;
}

export const PATTERNS = {
  glider: { name: 'Glider', cells: [[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]], at: 'corner' },
  blinker: { name: 'Blinker', cells: [[0, -1], [0, 0], [0, 1]] },
  toad: { name: 'Toad', cells: [[0, -1], [0, 0], [0, 1], [1, -2], [1, -1], [1, 0]] },
  beacon: { name: 'Beacon', cells: [[-1, -1], [-1, 0], [0, -1], [0, 0], [1, 1], [1, 2], [2, 1], [2, 2]] },
  block: { name: 'Block', cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  rpentomino: { name: 'R-pentomino', cells: [[-1, 0], [-1, 1], [0, -1], [0, 0], [1, 0]] },
  random: { name: 'Random', cells: null },
  empty: { name: 'Empty', cells: [] }
};

export function patternBoard(name, n, random = Math.random) {
  const board = new Uint8Array(n * n);
  const p = PATTERNS[name] || PATTERNS.empty;
  if (!p.cells) { for (let i = 0; i < board.length; i++) board[i] = random() < 0.3 ? 1 : 0; return board; }
  const mid = Math.floor(n / 2);
  const [r0, c0] = p.at === 'corner' ? [Math.min(1, n - 3), Math.min(1, n - 3)] : [mid, mid];
  for (const [dr, dc] of p.cells) {
    const r = r0 + dr, c = c0 + dc;
    if (r >= 0 && c >= 0 && r < n && c < n) board[r * n + c] = 1;
  }
  return board;
}

export class LifeTuringMachine {
  constructor(n, board, { history = 1 << 20 } = {}) {
    const program = compile(n);
    this.n = n;
    this.program = program;
    this.stride = n + 3;
    this.length = (n + 2) * (n + 3) + 2;
    this.tape = new Uint8Array(this.length);
    this.cellPos = new Int32Array(n * n);
    this.posCell = new Int32Array(this.length).fill(-1);
    const tape = this.tape;
    let p = 0;
    tape[p++] = LEFT_END;
    for (let r = 0; r < n + 2; r++) {
      for (let c = 0; c < n + 2; c++) {
        if (r === 0 || c === 0 || r === n + 1 || c === n + 1) tape[p++] = EDGE;
        else {
          const i = (r - 1) * n + c - 1;
          this.cellPos[i] = p; this.posCell[p] = i;
          tape[p++] = board[i] ? B1 : B0;
        }
      }
      tape[p++] = ROW_END;
    }
    tape[p] = RIGHT_END;
    this.head = 1;
    this.state = 0;
    this.steps = 0;
    this.generation = 0;
    this.current = Uint8Array.from(board);
    this.past = []; // earlier generations, newest last, for undo and ghost trails
    let cap = 1;
    while (cap < history) cap <<= 1;
    this.hCap = cap; this.hMask = cap - 1; this.hPtr = 0; this.hCount = 0;
    this.hHead = new Int32Array(cap); this.hSym = new Uint8Array(cap); this.hState = new Int32Array(cap);
    // Display bookkeeping: visits per square and transitions per family pair.
    this.heat = new Float32Array(this.length);
    this.flow = new Float32Array(49);
    this.prints = []; // squares printed since the display last looked
  }

  /** Run up to `limit` steps; stop early after an event whose bit is set in `stopMask`. */
  run(limit, stopMask = 0) {
    const { next, write, move, event, family } = this.program;
    const tape = this.tape, heat = this.heat, flow = this.flow;
    const hHead = this.hHead, hSym = this.hSym, hState = this.hState, mask = this.hMask;
    let head = this.head, q = this.state, ptr = this.hPtr, done = 0, stoppedOn = EV_NONE;
    while (done < limit) {
      const s = tape[head], i = q * A + s, nq = next[i];
      if (nq < 0) {
        this.head = head; this.state = q; this.hPtr = ptr;
        this._account(done);
        throw new Error(`No rule for ${formatState(this.program.states[q])} reading ${SYMBOLS[s]}`);
      }
      hHead[ptr] = head; hSym[ptr] = s; hState[ptr] = q; ptr = (ptr + 1) & mask;
      tape[head] = write[i];
      heat[head] += 1;
      flow[family[q] * 7 + family[nq]] += 1;
      head += move[i];
      q = nq;
      done++;
      const ev = event[i];
      if (ev !== EV_NONE) {
        if (ev === EV_PRINT) { if (this.prints.length < 4096) this.prints.push(head - 1); }
        else if (ev === EV_GENERATION) this._nextGeneration();
        if (stopMask & (1 << ev)) { stoppedOn = ev; break; }
      }
    }
    this.head = head; this.state = q; this.hPtr = ptr;
    this._account(done);
    return { steps: done, event: stoppedOn };
  }

  _account(done) {
    this.steps += done;
    this.hCount = Math.min(this.hCount + done, this.hCap);
  }

  _nextGeneration() {
    this.past.push({ generation: this.generation, board: this.current });
    if (this.past.length > 1024) this.past.shift();
    const board = new Uint8Array(this.n * this.n);
    for (let i = 0; i < board.length; i++) board[i] = this.tape[this.cellPos[i]] === B1 ? 1 : 0;
    this.current = board;
    this.generation++;
  }

  step() { return this.run(1); }
  finishCell() { return this.run(1e9, (1 << EV_PRINT) | (1 << EV_GENERATION)); }
  finishGeneration() { return this.run(1e9, 1 << EV_GENERATION); }

  /** Undo up to `count` steps from the history ring. Returns how many were undone. */
  back(count = 1) {
    let undone = 0;
    while (undone < count && this.hCount > 0) {
      const ptr = (this.hPtr - 1) & this.hMask;
      const head = this.hHead[ptr], s = this.hSym[ptr], q = this.hState[ptr];
      if (this.program.event[q * A + s] === EV_GENERATION) {
        if (!this.past.length) break;
        const prev = this.past.pop();
        this.current = prev.board;
        this.generation = prev.generation;
      }
      this.hPtr = ptr; this.hCount--;
      this.tape[head] = s; this.head = head; this.state = q; this.steps--;
      undone++;
    }
    return undone;
  }

  get canUndo() { return this.hCount > 0; }

  /** The table entry the machine will use next. */
  peek() {
    const s = this.tape[this.head], i = this.state * A + s;
    return { symbol: s, write: this.program.write[i], move: this.program.move[i], next: this.program.next[i], event: this.program.event[i] };
  }

  /** The table entry used by the most recent step, or null. */
  last() {
    if (!this.hCount) return null;
    const ptr = (this.hPtr - 1) & this.hMask;
    const q = this.hState[ptr], s = this.hSym[ptr], i = q * A + s;
    return { at: this.hHead[ptr], state: q, symbol: s, write: this.program.write[i], move: this.program.move[i], next: this.program.next[i], event: this.program.event[i] };
  }

  markPosition() {
    for (let p = 0; p < this.length; p++) if (isMark(this.tape[p])) return p;
    return -1;
  }

  /** Board coordinates of a tape square: row 0..n+1, column 0..n+2 (# is column n+2). */
  fold(p) {
    if (p <= 0) return { r: 0, c: -1 };
    if (p >= this.length - 1) return { r: this.n + 1, c: this.n + 3 };
    const k = p - 1;
    return { r: Math.floor(k / this.stride), c: k % this.stride };
  }
}

export function formatState(q, { fraktur = false } = {}) {
  const fam = FAMILIES[q.f];
  const head = fraktur ? fam.letter : fam.key;
  switch (q.f) {
    case GO: return `${head}(${DIRECTIONS[q.j]}, ${q.d}, ${q.c}, ${q.o})`;
    case READ: case HOME: return `${head}(${DIRECTIONS[q.j]}, ${q.c}, ${q.o})`;
    case PRINT: return `${head}(${q.c}, ${q.o})`;
    case BACK: return `${head}(${q.m === 0 ? 'commit' : 'scan'})`;
    default: return head;
  }
}
