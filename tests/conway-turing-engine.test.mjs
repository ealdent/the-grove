import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LifeTuringMachine, compile, lifeStep, patternBoard, stateCount, stepsPerGeneration,
  firstGenerationSteps, SYMBOLS, SCAN, B0, B1
} from '../learn/conway-turing-engine.js';

function random(seed) {
  let value = seed >>> 0;
  return () => ((value = (Math.imul(value, 1103515245) + 12345) >>> 0) / 4294967296);
}

test('the machine computes the same generations as a direct Life step', () => {
  const rnd = random(2026);
  let generations = 0;
  for (let n = 1; n <= 12; n++) {
    for (let trial = 0; trial < (n <= 6 ? 30 : 8); trial++) {
      const density = 0.15 + rnd() * 0.4;
      let board = Uint8Array.from({ length: n * n }, () => (rnd() < density ? 1 : 0));
      const machine = new LifeTuringMachine(n, board, { history: 1 << 10 });
      for (let g = 0; g < 6; g++) {
        machine.finishGeneration();
        board = lifeStep(board, n);
        assert.deepEqual(machine.current, board, `n=${n} trial ${trial} generation ${g + 1}`);
        generations++;
      }
      // Between generations the tape holds plain bits again.
      for (let i = 0; i < n * n; i++) assert.ok([B0, B1].includes(machine.tape[machine.cellPos[i]]));
    }
  }
  assert.ok(generations > 1000);
});

test('closed forms: states, and steps per generation', () => {
  for (let n = 1; n <= 16; n++) {
    assert.equal(compile(n).stateCount, stateCount(n), `states n=${n}`);
    const machine = new LifeTuringMachine(n, patternBoard('random', n, random(n)), { history: 1 << 4 });
    assert.equal(machine.finishGeneration().steps, firstGenerationSteps(n), `first generation n=${n}`);
    for (let g = 0; g < 2; g++) assert.equal(machine.finishGeneration().steps, stepsPerGeneration(n), `generation n=${n}`);
  }
});

test('the table is the whole controller', () => {
  const program = compile(7);
  assert.equal(program.symbolCount, SYMBOLS.length);
  assert.equal(program.states[0].f, SCAN);
  assert.equal(program.next.length, program.stateCount * SYMBOLS.length);
  for (let i = 0; i < program.next.length; i++) {
    if (program.next[i] < 0) continue;
    assert.ok(program.next[i] < program.stateCount);
    assert.ok(program.write[i] < SYMBOLS.length);
    assert.ok([-1, 0, 1].includes(program.move[i]));
  }
});

test('a glider glides south-east one cell every four generations, then freezes into a block', () => {
  const n = 12;
  const machine = new LifeTuringMachine(n, patternBoard('glider', n), { history: 1 << 4 });
  const cells = board => [...board].flatMap((v, i) => (v ? [[Math.floor(i / n), i % n]] : []));
  const start = cells(machine.current);
  for (let g = 4; g <= 32; g += 4) {
    for (let k = 0; k < 4; k++) machine.finishGeneration();
    assert.deepEqual(cells(machine.current), start.map(([r, c]) => [r + g / 4, c + g / 4]), `generation ${g}`);
  }
  for (let k = 0; k < 8; k++) machine.finishGeneration();
  assert.deepEqual(cells(machine.current), [[n - 2, n - 2], [n - 2, n - 1], [n - 1, n - 2], [n - 1, n - 1]]);
});

test('undo restores tape, head, state and generation exactly', () => {
  const n = 7;
  const machine = new LifeTuringMachine(n, patternBoard('glider', n));
  const snapshot = () => JSON.stringify([[...machine.tape], machine.head, machine.state, machine.generation, [...machine.current], machine.steps]);
  const before = snapshot();
  machine.run(stepsPerGeneration(n) + 500); // crosses one generation boundary
  assert.equal(machine.generation, 1);
  assert.equal(machine.back(1e9), stepsPerGeneration(n) + 500);
  assert.equal(snapshot(), before);
  assert.equal(machine.canUndo, false);
});

test('finish cell stops right after a print', () => {
  const machine = new LifeTuringMachine(5, patternBoard('blinker', 5));
  const { event } = machine.finishCell();
  assert.equal(event, 3);
  assert.equal(machine.prints.length, 1);
  assert.equal(machine.markPosition(), -1);
});
