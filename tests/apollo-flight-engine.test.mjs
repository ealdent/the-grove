import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MU, RADIUS, G0, wrapDegrees, components, bearing, circularSpeed,
  orbitElements, hohmann, rocketBurn, burnDuration, propagate, impulse, createMission
} from '../learn/apollo-flight-engine.js';

const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected} by more than ${tolerance}`);
const circular = (radius = RADIUS + 500) => ({ x: radius, y: 0, vx: 0, vy: circularSpeed(radius), mass: 10000, dryMass: 6000, t: 0 });
const angularMomentum = (s) => s.x * s.vy - s.y * s.vx;

test('bearings are CCW from +x and handle all quadrants and whole revolutions', () => {
  for (const [angle, x, y] of [[0, 1, 0], [90, 0, 1], [180, -1, 0], [270, 0, -1]]) {
    const v = components(7, angle); near(v.x, 7 * x); near(v.y, 7 * y);
    near(bearing(x, y), angle);
  }
  near(wrapDegrees(-90), 270); near(wrapDegrees(1085), 5);
  assert.equal(Object.is(wrapDegrees(-360), -0), false);
  assert.throws(() => bearing(0, 0), RangeError);
});

test('local radial/tangential components are signed and do not mean compass headings', () => {
  const o = orbitElements({ x: 0, y: 7000, vx: -3, vy: -2 });
  near(o.radialSpeed, -2); near(o.tangentialSpeed, 3);
  near(orbitElements({ x: 7000, y: 0, vx: 2, vy: -3 }).tangentialSpeed, -3);
});

test('orbital elements identify circular, elliptical, parabolic, escaping and radial motion', () => {
  const r = 7000, v = circularSpeed(r);
  const o = orbitElements({ x: r, y: 0, vx: 0, vy: v });
  near(o.a, r); near(o.e, 0); near(o.periapsis, r); near(o.apoapsis, r);
  near(o.energy, -MU / (2 * r)); near(o.period, 2 * Math.PI * Math.sqrt(r ** 3 / MU));
  const ellipse = orbitElements({ x: r, y: 0, vx: 0, vy: 1.1 * v });
  near(ellipse.periapsis, r); assert.ok(ellipse.apoapsis > r);
  const escape = orbitElements({ x: r, y: 0, vx: 0, vy: Math.sqrt(2) * v });
  assert.equal(escape.a, Infinity); assert.equal(escape.period, Infinity); near(escape.e, 1);
  const hyperbola = orbitElements({ x: r, y: 0, vx: 0, vy: 2 * v });
  assert.ok(hyperbola.a < 0 && hyperbola.e > 1); assert.equal(hyperbola.apoapsis, Infinity);
  near(orbitElements({ x: r, y: 0, vx: 1, vy: 0 }).periapsis, 0);
});

test('Hohmann signs, phase convention and same-radius case are consistent', () => {
  const out = hohmann(7000, 14000), into = hohmann(14000, 7000);
  assert.ok(out.departureDv > 0 && out.arrivalDv > 0);
  assert.ok(into.departureDv < 0 && into.arrivalDv < 0);
  near(into.departureDv, -out.arrivalDv); near(into.arrivalDv, -out.departureDv);
  near(out.coastTime, into.coastTime);
  const arrivalPhase = wrapDegrees(out.phaseDegrees + Math.sqrt(MU / 14000 ** 3) * out.coastTime * 180 / Math.PI);
  near(arrivalPhase, 180);
  const same = hohmann(7000, 7000); near(same.departureDv, 0); near(same.arrivalDv, 0); near(same.phaseDegrees, 0);
});

test('two ideal burns and integrated coast reach the target position AND circular velocity', () => {
  for (const [r1, r2] of [[7000, 14000], [14000, 7000]]) {
    const transfer = hohmann(r1, r2);
    const depart = impulse(circular(r1), Math.abs(transfer.departureDv), transfer.departureDv >= 0 ? 90 : 270, { isp: 900 });
    const coast = propagate(depart.state, transfer.coastTime, { maxStep: 5 });
    assert.equal(coast.status, 'complete'); near(coast.state.x, -r2, 1e-5); near(coast.state.y, 0, 1e-5);
    const dock = impulse(coast.state, Math.abs(transfer.arrivalDv), transfer.arrivalDv >= 0 ? 270 : 90, { isp: 900 });
    near(dock.state.vx, 0, 1e-8); near(dock.state.vy, -circularSpeed(r2), 1e-8);
    near(orbitElements(dock.state).e, 0, 1e-8);
  }
});

test('unpowered RK4 conserves energy and angular momentum over two revolutions', () => {
  const initial = circular();
  const before = orbitElements(initial);
  const result = propagate(initial, 2 * before.period);
  for (const point of result.path) {
    near(orbitElements(point).energy / before.energy, 1, 1e-8);
    near(angularMomentum(point) / angularMomentum(initial), 1, 1e-8);
    assert.equal(point.mass, initial.mass);
  }
  near(result.state.x, initial.x, .001); near(result.state.y, 0, .001);
});

test('halving the RK4 step produces fourth-order convergence toward an analytic circular orbit', () => {
  const initial = circular();
  const duration = orbitElements(initial).period;
  const errors = [16, 8, 4].map(maxStep => {
    const { state } = propagate(initial, duration, { maxStep });
    return Math.hypot(state.x - initial.x, state.y);
  });
  assert.ok(errors[1] < errors[0] / 12, String(errors));
  assert.ok(errors[2] < errors[1] / 12, String(errors));
});

test('eccentric coasts match an independent Kepler-equation solution through 48 hours', () => {
  // Solve M = E - e sin E, then differentiate the ellipse parametrization.
  // This oracle does not use orbitElements, hohmann, or the RK4 acceleration.
  for (const e of [.1, .45, .75, .92]) {
    const rp = RADIUS + 350, a = rp / (1 - e), n = Math.sqrt(MU / a ** 3);
    const initial = { x: rp, y: 0, vx: 0, vy: Math.sqrt(MU * (1 + e) / rp) };
    for (const t of [1234, 20000, 172800]) {
      const mean = n * t;
      let E = mean;
      for (let i = 0; i < 30; i++) E -= (E - e * Math.sin(E) - mean) / (1 - e * Math.cos(E));
      const q = 1 - e * Math.cos(E);
      const expected = {
        x: a * (Math.cos(E) - e), y: a * Math.sqrt(1 - e * e) * Math.sin(E),
        vx: -a * n * Math.sin(E) / q, vy: a * n * Math.sqrt(1 - e * e) * Math.cos(E) / q
      };
      const actual = propagate(initial, t, { maxStep: 8 }).state;
      assert.ok(Math.hypot(actual.x - expected.x, actual.y - expected.y) < .001, `position e=${e}, t=${t}`);
      assert.ok(Math.hypot(actual.vx - expected.vx, actual.vy - expected.vy) < 1e-6, `velocity e=${e}, t=${t}`);
    }
  }
});

test('rocket equation and its duration inverse agree without assuming constant mass', () => {
  const result = rocketBurn({ mass: 10000, dryMass: 6000, thrust: 180000, isp: 450, throttle: .5, duration: 30 });
  near(result.massFlow, 90000 / (450 * G0));
  near(result.fuelUsed, result.massFlow * 30);
  near(result.deltaV, 450 * G0 * Math.log(10000 / result.mass) / 1000);
  near(burnDuration(result.deltaV, 10000, 180000, 450, .5), 30);
  const exhausted = rocketBurn({ mass: 10000, dryMass: 6000, thrust: 180000, isp: 450, duration: 1000 });
  assert.equal(exhausted.mass, 6000); assert.equal(exhausted.fuelUsed, 4000);
  near(exhausted.duration, 4000 * 450 * G0 / 180000);
  assert.ok(exhausted.duration < 1000);
});

test('zero burns and throttle limits cannot consume negative propellant', () => {
  const input = { mass: 10000, dryMass: 6000, thrust: 180000, isp: 450, duration: 30 };
  for (const throttle of [-1, 0]) {
    const b = rocketBurn({ ...input, throttle });
    assert.equal(b.fuelUsed, 0); assert.equal(b.deltaV, 0); assert.equal(b.mass, 10000);
  }
  assert.deepEqual(rocketBurn({ ...input, throttle: 2 }), rocketBurn({ ...input, throttle: 1 }));
  assert.equal(rocketBurn({ ...input, duration: 0 }).deltaV, 0);
  assert.equal(burnDuration(0, 10000, 0, 450), 0);
  assert.equal(burnDuration(1, 10000, 0, 450), Infinity);
});

test('finite burn consumes exact fuel, cuts off at dry mass, and never adds phantom thrust', () => {
  const initial = { x: 1000000, y: 0, vx: 0, vy: 0, mass: 10000, dryMass: 6000, t: 12 };
  const burn = { thrust: 180000, isp: 450, throttle: 1, bearing: 0 };
  const result = propagate(initial, 200, { mu: 1e-20, maxStep: .25, burn });
  const ideal = rocketBurn({ ...initial, ...burn, duration: 200 });
  assert.equal(result.state.mass, 6000); near(result.state.vx, ideal.deltaV, 1e-10); near(result.state.vy, 0);
  assert.equal(result.state.t, 212);
  const after = propagate(result.state, 200, { mu: 1e-20, burn });
  assert.equal(after.state.mass, 6000); near(after.state.vx, result.state.vx, 1e-12);
  assert.ok(result.path.every(p => p.mass >= p.dryMass));
});

test('impulses use exact fuel, preserve epoch and position, and reject unaffordable burns', () => {
  const initial = circular();
  const copy = structuredClone(initial);
  const result = impulse(initial, 1, 0, { isp: 450 });
  near(result.mass, 10000 * Math.exp(-1000 / (450 * G0)));
  near(result.state.vx, 1); assert.equal(result.state.x, initial.x); assert.equal(result.state.t, initial.t);
  assert.deepEqual(initial, copy);
  assert.throws(() => impulse(initial, 4, 90, { isp: 450 }), /propellant/);
  const fullBudget = 450 * G0 * Math.log(10000 / 6000) / 1000;
  near(impulse(initial, fullBudget, 90, { isp: 450 }).mass, 6000);
  assert.deepEqual(impulse(initial, 0, 50, { isp: 450 }).state, initial);
  assert.throws(() => impulse({ ...initial, mass: 6000 }, 1e-13, 90, { isp: 450 }), /propellant/);
});

test('propagation stops at surface impact before consuming the rest of requested time or fuel', () => {
  const initial = { x: RADIUS + 10, y: 0, vx: -1, vy: 0, mass: 10000, dryMass: 6000, t: 100 };
  const result = propagate(initial, 30, { burn: { thrust: 1000, isp: 450, bearing: 180 } });
  assert.equal(result.status, 'impact'); near(Math.hypot(result.state.x, result.state.y), RADIUS, 1e-8);
  assert.ok(result.state.t > 100 && result.state.t < 110);
  near(initial.mass - result.state.mass, (result.state.t - 100) * 1000 / (450 * G0), 1e-9);
  const already = propagate({ ...initial, x: RADIUS }, 100);
  assert.equal(already.status, 'impact'); assert.equal(already.state.t, 100);
});

test('radial free-fall impact agrees with the analytic collapse time and speed', () => {
  const r0 = RADIUS + 100, ratio = RADIUS / r0;
  const expectedTime = Math.sqrt(r0 ** 3 / (2 * MU)) * (Math.acos(Math.sqrt(ratio)) + Math.sqrt(ratio * (1 - ratio)));
  const expectedSpeed = Math.sqrt(2 * MU * (1 / RADIUS - 1 / r0));
  const result = propagate({ x: r0, y: 0, vx: 0, vy: 0 }, 1000, { maxStep: 8 });
  assert.equal(result.status, 'impact');
  near(result.state.t, expectedTime, 1e-5);
  near(result.state.vx, -expectedSpeed, 1e-7);
  near(result.state.y, 0); near(result.state.vy, 0);
});

test('a complete fuel burn remains affordable after a fractional initial firing', () => {
  const mission = createMission(1);
  const first = rocketBurn({ ...mission.initial, ...mission.engine, throttle: .7, duration: .4 });
  const departed = impulse(mission.initial, first.deltaV, 90, mission.engine);
  const remainder = rocketBurn({ ...departed.state, ...mission.engine, throttle: 1, duration: 600 });
  const exhausted = impulse(departed.state, remainder.deltaV, 90, mission.engine);
  assert.equal(exhausted.state.mass, mission.initial.dryMass);
  near(exhausted.fuelUsed, remainder.fuelUsed, 1e-10);
  assert.throws(() => impulse(departed.state, remainder.deltaV + 1e-10, 90, mission.engine), /propellant/);
  assert.throws(() => impulse(exhausted.state, 1e-13, 90, mission.engine), /propellant/);
});

test('path sampling is bounded, ordered and includes both endpoints; inputs remain untouched', () => {
  const initial = circular();
  const copy = structuredClone(initial);
  const result = propagate(initial, 20000, { maxStep: 1 });
  assert.ok(result.path.length <= 1200);
  assert.deepEqual(result.path[0], initial); assert.deepEqual(result.path.at(-1), result.state);
  for (let i = 1; i < result.path.length; i++) assert.ok(result.path[i].t > result.path[i - 1].t);
  assert.deepEqual(initial, copy);
  const zero = propagate(initial, 0); assert.deepEqual(zero.state, initial); assert.equal(zero.path.length, 1);
});

test('a grazing collision inside a step is detected even when the next endpoint is above the surface', () => {
  const periapsis = RADIUS - .001;
  const apoapsis = 7000;
  const e = (apoapsis - periapsis) / (apoapsis + periapsis);
  const p = periapsis * (1 + e);
  const nu = -.005;
  const r = p / (1 + e * Math.cos(nu));
  const initial = {
    x: r * Math.cos(nu), y: r * Math.sin(nu),
    vx: -Math.sqrt(MU / p) * Math.sin(nu),
    vy: Math.sqrt(MU / p) * (e + Math.cos(nu))
  };
  assert.ok(r > RADIUS);
  const result = propagate(initial, 10, { maxStep: 10 });
  assert.equal(result.status, 'impact');
  assert.ok(result.state.t > 0 && result.state.t < 5);
  near(Math.hypot(result.state.x, result.state.y), RADIUS, 1e-8);
});

test('seeded missions are repeatable, distinct, geometrically phased and fuel feasible', () => {
  assert.deepEqual(createMission('apollo'), createMission('apollo'));
  assert.notDeepEqual(createMission(1), createMission(2));
  for (let seed = 0; seed < 250; seed++) {
    const mission = createMission(seed);
    const r1 = Math.hypot(mission.initial.x, mission.initial.y);
    assert.ok(r1 >= RADIUS + 300 && r1 <= RADIUS + 900);
    assert.ok(mission.targetRadius >= r1 + 1500 && mission.targetRadius <= r1 + 6500);
    const a = impulse(mission.initial, mission.reference.departureDv, 90, mission.engine);
    const b = impulse(a.state, mission.reference.arrivalDv, 270, mission.engine);
    assert.ok(b.mass >= mission.initial.dryMass);
    near(wrapDegrees(mission.targetPhase + Math.sqrt(MU / mission.targetRadius ** 3) * mission.reference.coastTime * 180 / Math.PI), 180, 1e-9);
  }
});

test('invalid inputs fail clearly instead of injecting NaNs into the flight display', () => {
  for (const invalid of [NaN, Infinity, -Infinity]) {
    assert.throws(() => wrapDegrees(invalid), RangeError);
    assert.throws(() => circularSpeed(invalid), RangeError);
    assert.throws(() => propagate(circular(), invalid), RangeError);
  }
  assert.throws(() => circularSpeed(-1), RangeError);
  assert.throws(() => hohmann(0, 7000), RangeError);
  assert.throws(() => orbitElements({ x: 0, y: 0, vx: 0, vy: 0 }), RangeError);
  assert.throws(() => components(-1, 0), RangeError);
  assert.throws(() => propagate(circular(), 1, { maxStep: 0 }), RangeError);
  assert.throws(() => propagate(circular(), -1), RangeError);
  assert.throws(() => propagate({ ...circular(), mass: 0 }, 1), RangeError);
  assert.throws(() => rocketBurn({ mass: 1, dryMass: 2, thrust: 1, isp: 1, duration: 1 }), RangeError);
  assert.throws(() => rocketBurn({ mass: 2, dryMass: 1, thrust: 1, isp: 0, duration: 1 }), RangeError);
  assert.throws(() => burnDuration(-1, 10000, 180000, 450), RangeError);
  assert.throws(() => createMission({ seed: 1 }), RangeError);
});
