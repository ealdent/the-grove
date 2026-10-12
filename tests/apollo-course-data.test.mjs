import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS, generateQuestion, variantCount, parseCalculation, gradeAnswer } from '../learn/apollo-course-data.js';

const IDS = ['vectors', 'calculus', 'orbits', 'propulsion', 'transfer', 'intercept', 'correction', 'mission'];
const MU = 398600.4418, G0 = 9.80665, DEG = Math.PI / 180;
const wrap = a => (a % 360 + 360) % 360;
const close = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) <= Math.max(1e-10, Math.abs(expected) * 1e-11), `${message}: ${actual} ≈ ${expected}`);
const circlePeriod = r => Math.sqrt(4 * Math.PI ** 2 * r ** 3 / MU);
// Independent Hohmann form uses radius ratios rather than the module's vis-viva expressions.
function plan(r1, r2) {
  const v1 = Math.sqrt(MU / r1), v2 = Math.sqrt(MU / r2);
  const dv1 = v1 * (Math.sqrt(2 * r2 / (r1 + r2)) - 1);
  const dv2 = v2 * (1 - Math.sqrt(2 * r1 / (r1 + r2)));
  const coast = Math.sqrt(Math.PI ** 2 * (r1 + r2) ** 3 / (8 * MU));
  return { dv1, dv2, arrival: v2 - dv2, coast, phase: wrap(180 - 360 * coast / circlePeriod(r2)) };
}
function finiteTree(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `Nonfinite value: ${value}`);
  if (value && typeof value === 'object') for (const child of Object.values(value)) finiteTree(child);
}
function verifyPhysics(q) {
  const g = q.givens.map(given => given.value), a = Object.fromEntries(q.answers.map(answer => [answer.key, answer.value]));
  const check = (key, expected) => close(a[key], expected, `${q.id}/${key}`);
  const direction = (x, y) => wrap(Math.atan2(y, x) / DEG);
  switch (`${q.lessonId}/${q.variant}`) {
    case 'vectors/0': check('vx', g[0] * Math.cos(g[1] * DEG)); check('vy', g[0] * Math.sin(g[1] * DEG)); break;
    case 'vectors/1': check('speed', Math.sqrt(g[0] ** 2 + g[1] ** 2)); check('angle', direction(g[0], g[1])); break;
    case 'vectors/2': check('dvx', g[2] - g[0]); check('dvy', g[3] - g[1]); break;
    case 'vectors/3':
      // Rotating the result back into the local frame must recover the displayed inputs.
      close(a.dvx * Math.cos(g[0] * DEG) + a.dvy * Math.sin(g[0] * DEG), g[1]);
      close(-a.dvx * Math.sin(g[0] * DEG) + a.dvy * Math.cos(g[0] * DEG), g[2]); break;
    case 'calculus/0':
      close(a.ax * g[1] - a.ay * g[0], 0); assert.ok(a.ax * g[0] + a.ay * g[1] < 0);
      close(Math.hypot(a.ax, a.ay), MU / (g[0] ** 2 + g[1] ** 2)); break;
    case 'calculus/1': check('x', g[0] + g[2] * g[4]); check('vx', g[2] - g[5] * g[4] / g[0] ** 2); break;
    case 'calculus/2': check('dv', (g[0] + (g[0] + g[1] * g[2])) * g[2] / 2000); check('speed', g[3] + a.dv); break;
    case 'calculus/3': check('displacement', (g[1] + g[2]) * g[0] / 2 + (g[2] + g[3]) * g[0] / 2); check('average', a.displacement / (2 * g[0])); break;
    case 'orbits/0': check('radius', g[0] + g[1]); close(a.speed ** 2 * a.radius, g[2]); break;
    case 'orbits/1': close(a.period ** 2 / g[0] ** 3, 4 * Math.PI ** 2 / g[1]); close(a.rate * a.period, 360); break;
    case 'orbits/2': check('energy', -g[3] / (g[0] + g[1])); close(a.speed ** 2 / 2 - g[3] / g[2], a.energy); break;
    case 'orbits/3': check('energy', g[1] ** 2 / 2 - g[2] / g[0]); assert.equal(a.state, a.energy < 0 ? 'bound' : 'unbound'); break;
    case 'propulsion/0': check('acceleration', g[0] * g[1] / g[2]); close(a.flow * g[3] * g[4], g[0] * g[1]); break;
    case 'propulsion/1':
      check('fuel', g[2] * g[3] * g[5] / (g[4] * g[6])); assert.ok(g[0] - a.fuel >= g[1]);
      close(Math.exp(a.dv * 1000 / (g[4] * g[6])), g[0] / (g[0] - a.fuel)); break;
    case 'propulsion/2':
      close((g[1] - a.fuel) * Math.exp(g[0] * 1000 / (g[2] * g[5])), g[1]);
      close(a.duration * g[3] * g[4] / (g[2] * g[5]), a.fuel); break;
    case 'propulsion/3':
      close(Math.exp(a.dv * 1000 / (g[2] * g[5])), g[0] / g[1]);
      close(a.duration * g[3] * g[4] / (g[2] * g[5]), g[0] - g[1]); break;
    case 'transfer/0': case 'transfer/1': { const p = plan(g[0], g[1]); check('dv1', p.dv1); check('coast', p.coast); break; }
    case 'transfer/2': { const p = plan(g[0], g[1]); check('arrivalSpeed', p.arrival); check('dv2', p.dv2); break; }
    case 'transfer/3': { const p = plan(g[0] + g[2], g[1] + g[2]); check('budget', Math.abs(p.dv1) + Math.abs(p.dv2)); check('coast', p.coast); break; }
    case 'intercept/0': { const p = plan(g[0], g[1]); check('phase', p.phase); check('coast', p.coast); close(wrap(a.phase + 360 / circlePeriod(g[1]) * a.coast), 180); break; }
    case 'intercept/1': check('bearing', wrap(g[1] + 360 * g[2] / g[0])); check('advance', 360 * g[2] / g[0]); break;
    case 'intercept/2': check('relativeX', g[0] - g[2]); check('relativeY', g[1] - g[3]); break;
    case 'intercept/3': {
      const n1 = 360 / circlePeriod(g[0]), n2 = 360 / circlePeriod(g[1]), p = plan(g[0], g[1]);
      close(wrap(g[2] + (n2 - n1) * a.wait), p.phase); close(a.windowPeriod * (n1 - n2), 360);
      assert.ok(a.wait >= 0 && a.wait < a.windowPeriod); break;
    }
    case 'correction/0': close(a.dvx * g[2], g[0]); close(a.dvy * g[2], g[1]); break;
    case 'correction/1': close(a.magnitude * Math.cos(a.bearing * DEG) * g[4], g[2] - g[0]); close(a.magnitude * Math.sin(a.bearing * DEG) * g[4], g[3] - g[1]); break;
    case 'correction/2': close(g[2] * a.dvx, g[0]); close(g[3] * a.dvy, g[1]); break;
    case 'correction/3': close(g[2] * a.dvx + g[3] * a.dvy, g[0]); close(g[4] * a.dvx + g[5] * a.dvy, g[1]); break;
    case 'mission/0': {
      const p = plan(g[0], g[1]); check('bearing', wrap(g[2] + 90));
      close((g[3] - a.fuel) * Math.exp(1000 * p.dv1 / (g[4] * G0)), g[3]);
      close(a.duration * g[5] * g[6] / (g[4] * G0), a.fuel); break;
    }
    case 'mission/1': {
      const p = plan(g[0], g[1]); check('dv', Math.abs(p.dv2)); check('bearing', wrap(g[2] + (p.dv2 > 0 ? 90 : -90)));
      const fuel = a.duration * g[5] * g[6] / (g[4] * G0);
      close((g[3] - fuel) * Math.exp(a.dv * 1000 / (g[4] * G0)), g[3]); break;
    }
    case 'mission/2': {
      const dx = g[2] - g[0], dy = g[3] - g[1]; check('dv', Math.hypot(dx, dy)); check('bearing', direction(dx, dy));
      const finalMass = g[4] * Math.exp(-a.dv * 1000 / (g[6] * G0));
      assert.equal(a.feasible, finalMass >= g[5] ? 'feasible' : 'insufficient'); break;
    }
    case 'mission/3': {
      const p = plan(g[0], g[1]); check('phase', p.phase); check('budget', Math.abs(p.dv1) + Math.abs(p.dv2));
      const afterFirst = g[2] / Math.exp(Math.abs(p.dv1) * 1000 / (g[3] * G0));
      const afterSecond = afterFirst / Math.exp(Math.abs(p.dv2) * 1000 / (g[3] * G0));
      check('fuel', g[2] - afterSecond); break;
    }
    default: assert.fail('Every question template must have a physics oracle.');
  }
}

test('eight lessons supply the complete content and instrument contract', () => {
  assert.deepEqual(LESSONS.map(l => l.id), IDS);
  const controlKeys = [['magnitude', 'angle'], ['radius', 'step'], ['radius', 'speedFactor'], ['throttle', 'duration'], ['r1', 'r2'], ['r1', 'r2', 'phase'], ['errorX', 'errorY', 'remaining'], []];
  const kinds = ['vectors', 'gravity', 'orbit', 'engine', 'transfer', 'intercept', 'correction', 'mission'];
  for (const [i, lesson] of LESSONS.entries()) {
    for (const field of ['title', 'kicker', 'goal']) assert.ok(lesson[field].length > 10);
    assert.ok(lesson.paragraphs.length >= 3 && lesson.paragraphs.length <= 4);
    assert.ok(lesson.equations.length >= 3);
    for (const equation of lesson.equations) assert.ok(equation.formula && equation.meaning);
    assert.ok(lesson.worked.prompt && lesson.worked.answer);
    assert.ok(lesson.worked.steps.length >= 3 && lesson.worked.steps.length <= 5);
    assert.equal(lesson.pitfalls.length, 2);
    assert.equal(lesson.visual.kind, kinds[i]);
    assert.deepEqual(lesson.visual.controls.map(c => c.key), controlKeys[i]);
    for (const c of lesson.visual.controls) assert.ok(c.min <= c.value && c.value <= c.max && c.step > 0);
    for (const r of lesson.references) assert.ok(r.title && new URL(r.url).protocol === 'https:');
    assert.ok(variantCount(lesson.id) >= 4);
  }
  assert.match(LESSONS.at(-1).paragraphs.join(' '), /clock advances only while coasting/);
  assert.doesNotMatch(LESSONS.at(-1).worked.steps.join(' '), /finite-thrust console/);
});

for (const lessonId of IDS) {
  test(`${lessonId}: all four templates across 50 seeds are physically consistent, varied, and gradeable`, () => {
    for (let variant = 0; variant < variantCount(lessonId); variant++) {
      const seen = new Set();
      for (let seed = 0; seed < 50; seed++) {
        const q = generateQuestion(lessonId, seed, variant);
        assert.deepEqual(q, generateQuestion(lessonId, seed, variant));
        assert.equal(q.lessonId, lessonId); assert.equal(q.variant, variant);
        assert.ok(q.title && q.prompt && q.takeaway && q.viz.kind);
        assert.equal(q.hints.length, 2); assert.ok(q.steps.length >= 3 && q.steps.length <= 5);
        assert.ok(q.answers.length >= 1 && q.answers.length <= (lessonId === 'mission' ? 3 : 2));
        assert.equal(new Set(q.answers.map(a => a.key)).size, q.answers.length);
        assert.equal(new Set(q.givens.map(g => g.label)).size, q.givens.length);
        finiteTree(q); verifyPhysics(q);
        seen.add(JSON.stringify(q.givens));
        for (const a of q.answers) {
          assert.ok(Number.isFinite(a.tolerance) && a.tolerance >= 0);
          assert.equal(gradeAnswer(a, String(a.value)).correct, true, `${q.id}/${a.key} accepts truth`);
          if (a.options) {
            const other = a.options.find(o => o.value !== a.value);
            assert.ok(other); assert.equal(gradeAnswer(a, other.value).correct, false);
          } else {
            const wrong = a.angle ? a.value + 45 : a.value + Math.max(a.tolerance * 5, 1);
            assert.equal(gradeAnswer(a, wrong).correct, false, `${q.id}/${a.key} rejects wrong answer`);
            if (a.angle) assert.equal(gradeAnswer(a, a.value - 1080).correct, true);
          }
        }
      }
      assert.ok(seen.size >= 35, `${lessonId}/${variant} has ${seen.size} distinct given sets`);
    }
  });
}

test('seeds cover quadrants, signed transfers, fuel outcomes, and variant selection', () => {
  const quadrants = new Set(), transfers = new Set(), feasible = new Set(), defaults = new Map(IDS.map(id => [id, new Set()]));
  for (let seed = 0; seed < 100; seed++) {
    const v = generateQuestion('vectors', seed, 1);
    quadrants.add(v.givens.map(g => Math.sign(g.value)).join(','));
    transfers.add(Math.sign(generateQuestion('transfer', seed, 2).answers[1].value));
    feasible.add(generateQuestion('mission', seed, 2).answers[2].value);
    for (const id of IDS) defaults.get(id).add(generateQuestion(id, seed).variant);
  }
  assert.equal(quadrants.size, 4); assert.deepEqual([...transfers].sort(), [-1, 1]); assert.equal(feasible.size, 2);
  for (const variants of defaults.values()) assert.equal(variants.size, 4);
  assert.deepEqual(generateQuestion('vectors', 'repeatable string', 9), generateQuestion('vectors', 'repeatable string', 1));
  for (const id of ['unknown', 'toString', 'constructor', '__proto__']) {
    assert.equal(variantCount(id), 0); assert.throws(() => generateQuestion(id, 1), /Unknown lesson/);
  }
  for (const v of [-1, NaN, Infinity, 0.5, '1']) assert.throws(() => generateQuestion('vectors', 1, v), /Variant index/);
});

test('calculator supports conventional precedence, scientific notation, and degree trigonometry', () => {
  const examples = [
    ['2+3*4', 14], ['(2+3)*4', 20], ['-2^2', -4], ['(-2)^2', 4], ['2^-2', .25], ['2^3^2', 512],
    ['1e-3 + 2E+2', 200.001], ['.5 + 1.', 1.5], ['3 − 2 × 4 ÷ 2', -1],
    ['sqrt(3^2+4^2)', 5], ['ln(exp(3))', 3], ['exp(ln(2))', 2], ['sin(30)', .5], ['cos(180)', -1], ['tan(45)', 1],
    ['atan2(1,-1)', 135], ['atan2(-1,-1)', -135], ['2*pi', 2 * Math.PI], ['SQRT(16)', 4], ['+ +2', 2]
  ];
  for (const [expression, expected] of examples) close(parseCalculation(expression), expected, expression);
  assert.equal(parseCalculation(1.25), 1.25);
});

test('calculator rejects JavaScript, invalid arithmetic, invalid arity, and excessive nesting', () => {
  const hostile = [
    '', ' ', null, undefined, {}, [], true, NaN, Infinity, 'NaN', 'Infinity', '1e999', '0/0', '1/0', 'sqrt(-1)', 'ln(0)', 'exp(10000)',
    'tan(90)', 'atan2(0,0)', 'sqrt()', 'sqrt(1,2)', 'atan2(1)', 'atan2(1,2,3)', 'sin(1,)', '1+','(2+3', '2+3)', '2**3', '2pi',
    'Math.sin(1)', 'globalThis', 'process.exit()', 'constructor.constructor("return 1")()', 'alert(1)', '1;globalThis.injected=true',
    '1//comment', '[]', '{}', '`value`', 'sqrt[4]', 'window.location', '2=2', '0x10', '1_000',
    '('.repeat(40) + '1' + ')'.repeat(40), '-'.repeat(80) + '1', '2^'.repeat(60) + '2', '1+'.repeat(210) + '1'
  ];
  for (const input of hostile) assert.throws(() => parseCalculation(input), Error, String(input));
  assert.equal(globalThis.injected, undefined);
  const spec = { value: 2, tolerance: .01, unit: 'km/s' };
  for (const input of hostile) { const r = gradeAnswer(spec, input); assert.equal(r.correct, false); assert.equal(r.parsed, null); assert.ok(r.message); }
});

test('grading uses absolute tolerance, safe calculations, and angular wrap', () => {
  const spec = { value: .1, tolerance: .0005, unit: 'km/s' };
  assert.equal(gradeAnswer(spec, '100/1000').correct, true);
  assert.equal(gradeAnswer(spec, '1e-1').correct, true);
  assert.equal(gradeAnswer(spec, .1005).correct, true);
  assert.equal(gradeAnswer(spec, .10051).correct, false);
  assert.equal(gradeAnswer({ value: -10, tolerance: .05 }, '-sqrt(100)').correct, true);
  const angle = { value: 359.9, tolerance: .3, angle: true, unit: '°' };
  for (const x of [-.1, 359.9, 719.9, .1]) assert.equal(gradeAnswer(angle, x).correct, true);
  assert.equal(gradeAnswer(angle, .3).correct, false);
  assert.equal(gradeAnswer({ value: NaN, tolerance: 1 }, 0).correct, false);
  const option = { value: 'go', options: [{ value: 'go', label: 'Proceed' }, { value: 'stop', label: 'Stop' }] };
  assert.equal(gradeAnswer(option, 'go').correct, true);
  assert.equal(gradeAnswer(option, 'stop').correct, false);
  assert.equal(gradeAnswer(option, 'Proceed').parsed, null);
});
