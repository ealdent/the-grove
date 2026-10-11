import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createModel, predictDelta, teacherDelta, makeDataset, mse,
  createOptimizer, trainEpoch, makeSeed, Simulation
} from '../learn/delayed-nca-engine.js';

const close = (actual, expected, epsilon = 1e-12) => assert.ok(
  Math.abs(actual - expected) < epsilon, `${actual} should equal ${expected}`
);
const copyNeighbor = (self, neighbor) => neighbor - self;

test('delay indexing: zero prehistory, then distance-one and distance-two arrivals', () => {
  const sim = new Simulation({ size: 7, radius: 2, delay: 1,
    initial: new Float64Array(49).fill(0.6), rule: copyNeighbor });
  sim.step(); // t=0: ring 1 reads S_-1, ring 2 reads S_-2.
  sim.state.forEach(value => close(value, 0));
  sim.step(); // t=1: ring 1 reads S_0, ring 2 reads S_-1.
  sim.state.forEach(value => close(value, 0.6 * 8 / 24));
  sim.step(); // t=2: ring 1 reads S_1=0, ring 2 reads S_0.
  sim.state.forEach(value => close(value, 0.6 * 16 / 24));
  sim.step(); // t=3: ring 1 reads S_2=.2, ring 2 reads S_1=0.
  sim.state.forEach(value => close(value, 0.2 * 8 / 24));
});

test('delay multiplier waits exactly d * delay ticks and self remains current', () => {
  const sim = new Simulation({ size: 7, radius: 2, delay: 2,
    initial: new Float64Array(49).fill(0.6), rule: copyNeighbor });
  sim.step(); sim.step();
  sim.state.forEach(value => close(value, 0));
  sim.step();
  sim.state.forEach(value => close(value, 0.2));
  const selfOnly = new Simulation({ size: 3, radius: 1, delay: 3,
    initial: new Float64Array(9).fill(0.8), rule: self => -self / 2 });
  selfOnly.step(); selfOnly.step();
  selfOnly.state.forEach(value => close(value, 0.2));
});

test('synchronous update reads immutable old grid and wraps torus boundaries', () => {
  const initial = new Float64Array(25);
  initial[0] = 1;
  const sim = new Simulation({ size: 5, radius: 1, delay: 0, initial, rule: copyNeighbor });
  const old = sim.state;
  const next = sim.step();
  assert.notEqual(old, next);
  assert.deepEqual(old, initial);
  assert.equal(next[0], 0);
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      const adjacent = [0, 1, 4].includes(x) && [0, 1, 4].includes(y) && (x !== 0 || y !== 0);
      close(next[y * 5 + x], adjacent ? 1 / 8 : 0);
    }
  }
  initial.fill(-1);
  assert.equal(old[0], 1, 'constructor isolates external seed mutation');
});

// Deliberately simple independent baseline, without ring/history implementation.
function ordinaryStep(state, size, radius, rule) {
  const next = new Float64Array(state.length);
  const count = (radius * 2 + 1) ** 2 - 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let total = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx === 0 && dy === 0) continue;
          total += state[((y + dy + size) % size) * size + (x + dx + size) % size];
        }
      }
      const cell = y * size + x;
      next[cell] = Math.max(-1, Math.min(1, state[cell] + rule(state[cell], total / count)));
    }
  }
  return next;
}

for (const expand of [false, true]) {
  test(`zero-delay agrees with ordinary current-neighbor baseline (expand=${expand})`, () => {
    let baseline = makeSeed(15, 91);
    const model = createModel();
    const rule = (self, neighbor) => predictDelta(model, self, neighbor);
    const sim = new Simulation({ size: 15, radius: 4, delay: 0, expand, initial: baseline, rule });
    for (let t = 0; t < 15; t++) {
      const radius = expand ? Math.min(4, t + 1) : 4;
      assert.equal(sim.activeRadius(), radius);
      baseline = ordinaryStep(baseline, 15, radius, rule);
      sim.step().forEach((value, i) => close(value, baseline[i]));
      assert.equal(sim.history.length, 1);
    }
  });
}

test('seed, model, dataset, training, and simulation are deterministic', () => {
  assert.deepEqual(makeSeed(16, 5), makeSeed(16, 5));
  assert.notDeepEqual(makeSeed(16, 5), makeSeed(16, 6));
  assert.deepEqual(createModel(5), createModel(5));
  assert.deepEqual(makeDataset(64, 5), makeDataset(64, 5));
  const models = [createModel(), createModel()];
  const optimizers = [createOptimizer(), createOptimizer()];
  const dataset = makeDataset(128);
  for (let epoch = 0; epoch < 30; epoch++) {
    models.forEach((model, i) => trainEpoch(model, dataset, optimizers[i]));
  }
  assert.deepEqual(models[0], models[1]);
  const sims = models.map(model => new Simulation({ size: 16, radius: 3, delay: 2,
    initial: makeSeed(16, 8), rule: (self, neighbor) => predictDelta(model, self, neighbor) }));
  for (let t = 0; t < 20; t++) sims.forEach(sim => sim.step());
  assert.deepEqual(sims[0].state, sims[1].state);
});

test('actual Adam training substantially reduces independent held-out teacher loss', () => {
  const model = createModel(7);
  const initialWeights = model.weights.slice();
  const training = makeDataset(1024, 11);
  const validation = makeDataset(1024, 991);
  const optimizer = createOptimizer();
  const before = mse(model, validation);
  for (let epoch = 0; epoch < 300; epoch++) trainEpoch(model, training, optimizer);
  const after = mse(model, validation);
  assert.equal(model.weights.length, 24);
  assert.notDeepEqual(model.weights, initialWeights);
  assert.ok(after < before * 0.05, `heldout MSE ${before} -> ${after}`);
  assert.ok(after < 0.001, `heldout MSE ${after}`);
  assert.equal(predictDelta(model, 0, 0), 0, 'bias-free network preserves empty space');
});

test('long runs remain finite, bounded, and retain only required history', () => {
  const model = createModel(8);
  for (const rule of [teacherDelta, (self, neighbor) => predictDelta(model, self, neighbor)]) {
    const sim = new Simulation({ size: 13, radius: 6, delay: 3, expand: true, rule });
    for (let t = 0; t < 350; t++) {
      sim.step();
      assert.ok(sim.history.length <= 19);
      assert.equal(sim.historyStartTick + sim.history.length - 1, sim.tick);
      assert.ok(sim.state.every(value => Number.isFinite(value) && Math.abs(value) <= 1));
    }
  }
});

test('invalid configurations and nonfinite rule outputs fail explicitly', () => {
  assert.throws(() => new Simulation({ radius: 0 }), RangeError);
  assert.throws(() => new Simulation({ delay: 1.5 }), RangeError);
  assert.throws(() => new Simulation({ size: 2, initial: [0, 0, 0, NaN] }), RangeError);
  const sim = new Simulation({ size: 2, rule: () => NaN });
  assert.throws(() => sim.step(), RangeError);
  assert.equal(sim.tick, 0);
  const saturated = new Simulation({ size: 2, rule: () => 100 });
  assert.ok(saturated.step().every(value => value === 1));
});

test('pulse seed is a configurable finite disk; radius zero retains single-cell diagnostic', () => {
  const disk = makeSeed(48, 42, 'pulse');
  assert.equal(disk.filter(v=>v===1).length,81);
  assert.equal(makeSeed(48,42,'pulse',0).filter(v=>v===1).length,1);
  assert.equal(makeSeed(48,42,'pulse',3).filter(v=>v===1).length,29);
  assert.deepEqual(disk,makeSeed(48,999,'pulse',5),'pulse is independent of island seed');
  for(const radius of [-1,1.5,9])assert.throws(()=>makeSeed(48,42,'pulse',radius),RangeError);
});

test('default pulse visibly spreads for teacher and exact UI student over multiple steps', () => {
  const model=createModel(7),optimizer=createOptimizer(.01),dataset=makeDataset(1024,123);
  for(let epoch=0;epoch<300;epoch++)trainEpoch(model,dataset,optimizer);
  const initial=makeSeed(48,42,'pulse');
  const lit=state=>state.filter(v=>v>=.1).length;
  for(const rule of [teacherDelta,(s,m)=>predictDelta(model,s,m)]) {
    const current=new Simulation({initial,radius:3,delay:0,rule});
    const delayed=new Simulation({initial,radius:3,delay:1,rule});
    // One cell beyond the disk: immediate receives seed now, delayed waits.
    const probe=24*48+30;
    current.step();delayed.step();
    assert.ok(current.state[probe]>0);
    assert.equal(delayed.state[probe],0);
    current.step();delayed.step();
    assert.ok(delayed.state[probe]>0,'ring-one seed signal arrives in S2');
    let previous=[81,81];
    for(let tick=3;tick<=40;tick++) {
      current.step();delayed.step();
      if([10,20,40].includes(tick)) {
        const counts=[lit(current.state),lit(delayed.state)];
        assert.ok(counts[0]>counts[1],`current front should lead at tick ${tick}`);
        for(const [i,sim] of [current,delayed].entries()) {
          assert.ok(Math.max(...sim.state)>.6,`visible peak at tick ${tick}`);
          assert.ok(counts[i]>previous[i],`outward growth at tick ${tick}`);
          assert.ok(counts[i]<initial.length*.7,'front has not filled the entire grid');
          assert.ok(sim.state.some((v,j)=>initial[j]===0&&v>=.1),'activation outside original seed');
        }
        previous=counts;
      }
    }
    const a=new Simulation({initial,radius:3,delay:0,rule});
    const b=new Simulation({initial,radius:3,delay:0,rule});
    for(let t=0;t<40;t++){a.step();b.step();assert.deepEqual(a.state,b.state);}
  }
});
