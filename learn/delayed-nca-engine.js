/**
 * A small educational scalar neural cellular automaton, with explicit delays.
 * Tick t reads S_t and writes S_(t+1) synchronously. A Chebyshev ring at distance
 * d reads S_(t - d * delay); S_k is zero for k < 0. The cell's own input always
 * comes from S_t. The grid is periodic (a torus). This is a chosen delayed rule,
 * not a claim of equivalence to an ordinary cellular automaton.
 */

const HIDDEN = 8;
const PARAMS = HIDDEN * 3;
const clamp = value => Math.max(-1, Math.min(1, value));

function randomGenerator(seed) {
  let value = Number(seed) >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let x = value;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bias-free 2 -> 8 tanh -> 1 linear network; 24 genuinely trainable weights. */
export function createModel(seed = 7) {
  const random = randomGenerator(seed);
  return { weights: Float64Array.from({ length: PARAMS }, () => (random() * 2 - 1) * 0.7) };
}

export function predictDelta(model, self, neighbor) {
  const weights = model.weights;
  let delta = 0;
  for (let h = 0; h < HIDDEN; h++) {
    const j = h * 3;
    delta += weights[j + 2] * Math.tanh(weights[j] * self + weights[j + 1] * neighbor);
  }
  return delta;
}

/** Hand-designed diffusion + bistable reaction teacher, not a learned rule. */
export function teacherDelta(self, neighbor) {
  return 0.22 * (neighbor - self) + 0.12 * self * (1 - self * self);
}

/** Independent uniform input pairs; supervised one-step delta fitting only. */
export function makeDataset(count = 1024, seed = 11) {
  if (!Number.isInteger(count) || count < 1) throw new RangeError('Dataset count must be positive.');
  const random = randomGenerator(seed);
  return Array.from({ length: count }, () => {
    const self = random() * 2 - 1;
    const neighbor = random() * 2 - 1;
    return { self, neighbor, target: teacherDelta(self, neighbor) };
  });
}

export function mse(model, dataset) {
  let loss = 0;
  for (const { self, neighbor, target } of dataset) {
    loss += (predictDelta(model, self, neighbor) - target) ** 2;
  }
  return loss / dataset.length;
}

export function createOptimizer(learningRate = 0.01) {
  if (!Number.isFinite(learningRate) || learningRate <= 0) throw new RangeError('Learning rate must be positive.');
  return { learningRate, step: 0, first: new Float64Array(PARAMS), second: new Float64Array(PARAMS) };
}

/** One full-batch Adam step. Mutates weights; returns MSE before the update. */
export function trainEpoch(model, dataset, optimizer) {
  if (!dataset.length) throw new RangeError('Training requires examples.');
  const weights = model.weights;
  const gradient = new Float64Array(PARAMS);
  const hidden = new Float64Array(HIDDEN);
  let loss = 0;
  for (const { self, neighbor, target } of dataset) {
    let prediction = 0;
    for (let h = 0; h < HIDDEN; h++) {
      const j = h * 3;
      hidden[h] = Math.tanh(weights[j] * self + weights[j + 1] * neighbor);
      prediction += weights[j + 2] * hidden[h];
    }
    const error = prediction - target;
    loss += error * error;
    const outputGradient = 2 * error / dataset.length;
    for (let h = 0; h < HIDDEN; h++) {
      const j = h * 3;
      const inputGradient = outputGradient * weights[j + 2] * (1 - hidden[h] ** 2);
      gradient[j] += inputGradient * self;
      gradient[j + 1] += inputGradient * neighbor;
      gradient[j + 2] += outputGradient * hidden[h];
    }
  }
  optimizer.step++;
  const firstCorrection = 1 - 0.9 ** optimizer.step;
  const secondCorrection = 1 - 0.999 ** optimizer.step;
  for (let j = 0; j < PARAMS; j++) {
    optimizer.first[j] = 0.9 * optimizer.first[j] + 0.1 * gradient[j];
    optimizer.second[j] = 0.999 * optimizer.second[j] + 0.001 * gradient[j] ** 2;
    weights[j] -= optimizer.learningRate * (optimizer.first[j] / firstCorrection)
      / (Math.sqrt(optimizer.second[j] / secondCorrection) + 1e-8);
  }
  return loss / dataset.length;
}

export function makeSeed(size = 48, seed = 42, pattern = 'islands', pulseRadius = 5) {
  if (!Number.isInteger(size) || size < 1) throw new RangeError('Size must be a positive integer.');
  const state = new Float64Array(size * size);
  if (pattern === 'pulse') {
    if (!Number.isInteger(pulseRadius) || pulseRadius < 0 || pulseRadius > 8) {
      throw new RangeError('Pulse radius must be 0–8.');
    }
    const center = Math.floor(size / 2);
    // A finite disk supplies enough neighboring signal to survive the initial
    // diffusion transient visibly. Radius zero retains the single-cell probe.
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if ((x - center) ** 2 + (y - center) ** 2 <= pulseRadius ** 2) state[y * size + x] = 1;
      }
    }
    return state;
  }
  if (pattern !== 'islands') throw new RangeError('Unknown seed pattern.');
  const random = randomGenerator(seed);
  const islands = Array.from({ length: 10 }, (_, i) => ({
    x: random() * size, y: random() * size,
    width: size * (0.05 + random() * 0.08), sign: i % 2 ? -1 : 1
  }));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let value = 0;
      for (const island of islands) {
        const dx = Math.min(Math.abs(x - island.x), size - Math.abs(x - island.x));
        const dy = Math.min(Math.abs(y - island.y), size - Math.abs(y - island.y));
        value += island.sign * 0.9 * Math.exp(-(dx * dx + dy * dy) / (2 * island.width ** 2));
      }
      state[y * size + x] = clamp(value);
    }
  }
  return state;
}

export class Simulation {
  constructor({ size = 48, radius = 3, delay = 1, expand = false, initial, rule = teacherDelta } = {}) {
    if (!Number.isInteger(size) || size < 1) throw new RangeError('Size must be a positive integer.');
    if (!Number.isInteger(radius) || radius < 1 || radius > 6) throw new RangeError('Radius must be 1–6.');
    if (!Number.isInteger(delay) || delay < 0 || delay > 3) throw new RangeError('Delay must be 0–3.');
    if (typeof rule !== 'function') throw new TypeError('Rule must return a scalar delta.');
    const state = initial === undefined ? makeSeed(size) : Float64Array.from(initial);
    if (state.length !== size * size || !state.every(value => Number.isFinite(value) && Math.abs(value) <= 1)) {
      throw new RangeError('Initial state must contain size² finite values in [-1, 1].');
    }
    this.size = size;
    this.radius = radius;
    this.delay = delay;
    this.expand = Boolean(expand);
    this.rule = rule;
    this.tick = 0;
    this.state = state;
    this.history = [state];
    this.historyStartTick = 0;
    this.historyLimit = radius * delay + 1;
    // Precompute wrapped source indices. Small grids count wrapped offsets with
    // multiplicity; normal 48x48 demo grids have distinct neighbors at R <= 6.
    this.rings = Array.from({ length: radius }, (_, ringIndex) => {
      const d = ringIndex + 1;
      const width = 8 * d;
      const indices = new Uint32Array(size * size * width);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let i = (y * size + x) * width;
          for (let dy = -d; dy <= d; dy++) {
            for (let dx = -d; dx <= d; dx++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
              const sx = ((x + dx) % size + size) % size;
              const sy = ((y + dy) % size + size) % size;
              indices[i++] = sy * size + sx;
            }
          }
        }
      }
      return indices;
    });
  }

  /** Radius used by the upcoming transition S_tick -> S_(tick+1). */
  activeRadius() {
    return this.expand ? Math.min(this.radius, this.tick + 1) : this.radius;
  }

  step() {
    const radius = this.activeRadius();
    const sums = new Float64Array(this.state.length);
    const neighborCount = (2 * radius + 1) ** 2 - 1;
    for (let d = 1; d <= radius; d++) {
      const sourceTick = this.tick - d * this.delay;
      if (sourceTick < 0) continue; // Zero prehistory still counts in denominator.
      const source = this.history[sourceTick - this.historyStartTick];
      const indices = this.rings[d - 1];
      const width = 8 * d;
      for (let cell = 0; cell < sums.length; cell++) {
        const start = cell * width;
        for (let j = start; j < start + width; j++) sums[cell] += source[indices[j]];
      }
    }
    const next = new Float64Array(this.state.length);
    for (let cell = 0; cell < next.length; cell++) {
      const delta = this.rule(this.state[cell], sums[cell] / neighborCount);
      if (!Number.isFinite(delta)) throw new RangeError('Rule produced a non-finite delta.');
      next[cell] = clamp(this.state[cell] + delta);
    }
    // Publish only after all cells have read the previous states.
    this.state = next;
    this.tick++;
    this.history.push(next);
    if (this.history.length > this.historyLimit) {
      this.history.shift();
      this.historyStartTick++;
    }
    return next;
  }
}
