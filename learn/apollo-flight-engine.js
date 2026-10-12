/**
 * Educational, planar Earth-orbit mechanics. This is not an Apollo reconstruction.
 * Coordinates are inertial kilometres, velocities km/s, time seconds, mass kg,
 * thrust newtons, and specific impulse seconds. Bearings increase counterclockwise
 * from +x; the local positive tangent is 90 degrees counterclockwise from radial.
 *
 * The beacon has no gravity. We omit atmosphere, other bodies, Earth oblateness,
 * rotating frames, attitude dynamics, engine transients and navigation uncertainty.
 * Hohmann/impulse calculations assume instantaneous burns. RK4 propagation models
 * constant-throttle, fixed-inertial-direction finite burns and stops at Earth's
 * surface. It is a bounded teaching integrator, not a mission design tool.
 */
export const MU = 398600.4418;
export const RADIUS = 6378.137;
export const G0 = 9.80665;
const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;
const MAX_PATH = 1200;
const MAX_STEPS = 2_000_000;

function finite(value, name) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
  return value;
}

function positive(value, name) {
  finite(value, name);
  if (value <= 0) throw new RangeError(`${name} must be positive.`);
  return value;
}

function nonnegative(value, name) {
  finite(value, name);
  if (value < 0) throw new RangeError(`${name} must not be negative.`);
  return value;
}

function normalizedThrottle(value = 1) {
  return Math.max(0, Math.min(1, finite(value, 'Throttle')));
}

function masses(mass, dryMass) {
  positive(mass, 'Mass');
  positive(dryMass, 'Dry mass');
  if (dryMass > mass) throw new RangeError('Dry mass cannot exceed total mass.');
}

/** Normalize into [0, 360), including a positive zero for whole revolutions. */
export function wrapDegrees(angle) {
  finite(angle, 'Angle');
  return ((angle % 360) + 360) % 360;
}

export function components(magnitude, direction) {
  nonnegative(magnitude, 'Magnitude');
  const radians = wrapDegrees(direction) * DEG;
  return { x: magnitude * Math.cos(radians), y: magnitude * Math.sin(radians) };
}

/** The zero vector has no bearing: reject it rather than inventing a heading. */
export function bearing(x, y) {
  finite(x, 'x');
  finite(y, 'y');
  if (x === 0 && y === 0) throw new RangeError('A zero vector has no bearing.');
  return wrapDegrees(Math.atan2(y, x) / DEG);
}

export function circularSpeed(radius, mu = MU) {
  return Math.sqrt(positive(mu, 'Gravitational parameter') / positive(radius, 'Radius'));
}

/** Hyperbolic a is negative; parabolic a, unbound apoapsis and period are Infinity. */
export function orbitElements({ x, y, vx, vy }, mu = MU) {
  [x, y, vx, vy].forEach((v, i) => finite(v, ['x', 'y', 'vx', 'vy'][i]));
  positive(mu, 'Gravitational parameter');
  const r = positive(Math.hypot(x, y), 'Distance from the center');
  const speed = Math.hypot(vx, vy);
  const energy = speed ** 2 / 2 - mu / r;
  const dot = x * vx + y * vy;
  const h = x * vy - y * vx;
  const q = speed ** 2 - mu / r;
  const e = Math.hypot((q * x - dot * vx) / mu, (q * y - dot * vy) / mu);
  // Account for roundoff when the caller supplies exactly the escape speed.
  const parabolic = Math.abs(energy) <= 8 * Number.EPSILON * mu / r;
  const a = parabolic ? Infinity : -mu / (2 * energy);
  const bound = energy < 0 && !parabolic;
  return {
    r, speed, energy, a, e,
    periapsis: (h ** 2 / mu) / (1 + e),
    apoapsis: bound ? a * (1 + e) : Infinity,
    period: bound ? TAU * Math.sqrt(a ** 3 / mu) : Infinity,
    radialSpeed: dot / r,
    tangentialSpeed: h / r
  };
}

/** Signed delta-v along each orbit's local CCW tangent, for outward OR inward transfer. */
export function hohmann(r1, r2, mu = MU) {
  positive(r1, 'Departure radius');
  positive(r2, 'Target radius');
  positive(mu, 'Gravitational parameter');
  const a = (r1 + r2) / 2;
  const coastTime = Math.PI * Math.sqrt(a ** 3 / mu);
  const departureDv = Math.sqrt(mu * (2 / r1 - 1 / a)) - circularSpeed(r1, mu);
  const arrivalDv = circularSpeed(r2, mu) - Math.sqrt(mu * (2 / r2 - 1 / a));
  const phaseDegrees = wrapDegrees(180 - Math.sqrt(mu / r2 ** 3) * coastTime / DEG);
  return { a, departureDv, arrivalDv, coastTime, phaseDegrees };
}

/** Actual powered duration and ideal rocket delta-v; duration is clipped at dry mass. */
export function rocketBurn({ mass, dryMass, thrust, isp, throttle = 1, duration }) {
  masses(mass, dryMass);
  nonnegative(thrust, 'Thrust');
  positive(isp, 'Specific impulse');
  nonnegative(duration, 'Duration');
  const exhaustVelocity = isp * G0;
  const massFlow = thrust * normalizedThrottle(throttle) / exhaustVelocity;
  const poweredDuration = massFlow > 0 ? Math.min(duration, (mass - dryMass) / massFlow) : 0;
  const fuelUsed = Math.min(mass - dryMass, massFlow * poweredDuration);
  const finalMass = Math.max(dryMass, mass - fuelUsed);
  const deltaV = exhaustVelocity * Math.log1p(fuelUsed / finalMass) / 1000;
  return { deltaV, fuelUsed, mass: finalMass, duration: poweredDuration, exhaustVelocity, massFlow };
}

/** Engine-equivalent powered duration. It does not advance an impulsive maneuver in time. */
export function burnDuration(deltaV, mass, thrust, isp, throttle = 1) {
  nonnegative(deltaV, 'Delta-v');
  positive(mass, 'Mass');
  nonnegative(thrust, 'Thrust');
  positive(isp, 'Specific impulse');
  const force = thrust * normalizedThrottle(throttle);
  if (deltaV === 0) return 0;
  if (force === 0) return Infinity;
  const exhaustVelocity = isp * G0;
  const fuelUsed = -mass * Math.expm1(-deltaV * 1000 / exhaustVelocity);
  return fuelUsed / (force / exhaustVelocity);
}

function normalizeState(state) {
  if (!state || typeof state !== 'object') throw new RangeError('A spacecraft state is required.');
  const { x, y, vx, vy } = state;
  [x, y, vx, vy].forEach((v, i) => finite(v, ['x', 'y', 'vx', 'vy'][i]));
  positive(Math.hypot(x, y), 'Distance from the center');
  // Mass is irrelevant to unpowered gravity. Missing mass denotes a unit test particle.
  const mass = state.mass ?? 1;
  const dryMass = state.dryMass ?? mass;
  const t = state.t ?? 0;
  masses(mass, dryMass);
  finite(t, 'Epoch');
  return { x, y, vx, vy, mass, dryMass, t };
}

/** Apply an ideal impulse with an exact rocket-equation propellant budget. */
export function impulse(state, deltaV, direction, { isp }) {
  const initial = normalizeState(state);
  nonnegative(deltaV, 'Delta-v');
  positive(isp, 'Specific impulse');
  const change = components(deltaV, direction);
  const exhaustVelocity = isp * G0;
  // Match rocketBurn's stable logarithm so an exact dry-mass burn is affordable
  // even after previous fractional firings have changed the current mass.
  const maximum = exhaustVelocity * Math.log1p((initial.mass - initial.dryMass) / initial.dryMass) / 1000;
  if (deltaV > maximum) throw new RangeError('Not enough propellant for that impulse.');
  const mass = deltaV === maximum ? initial.dryMass : Math.max(initial.dryMass, initial.mass * Math.exp(-deltaV * 1000 / exhaustVelocity));
  return {
    state: { ...initial, vx: initial.vx + change.x, vy: initial.vy + change.y, mass },
    deltaV, fuelUsed: initial.mass - mass, mass, exhaustVelocity
  };
}

/** One RK4 step. The caller splits steps exactly at propellant exhaustion. */
function advance(state, dt, mu, power) {
  const { force, massFlow, ux, uy } = power;
  const derivative = (values, elapsed) => {
    const [x, y, vx, vy] = values;
    const r = Math.hypot(x, y);
    const gravity = -mu / (r ** 3);
    const mass = Math.max(state.dryMass, state.mass - massFlow * elapsed);
    const acceleration = force / mass / 1000;
    return [vx, vy, gravity * x + acceleration * ux, gravity * y + acceleration * uy];
  };
  const start = [state.x, state.y, state.vx, state.vy];
  const offset = (k, scale) => start.map((value, i) => value + k[i] * scale);
  const k1 = derivative(start, 0);
  const k2 = derivative(offset(k1, dt / 2), dt / 2);
  const k3 = derivative(offset(k2, dt / 2), dt / 2);
  const k4 = derivative(offset(k3, dt), dt);
  const [x, y, vx, vy] = start.map((value, i) => value + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  return { x, y, vx, vy, mass: Math.max(state.dryMass, state.mass - massFlow * dt), dryMass: state.dryMass, t: state.t + dt };
}

/**
 * Coast or apply a finite burn in a fixed inertial bearing. Fuel exhaustion ends
 * thrust, then remaining requested time is coasted. Status: 'complete' | 'impact'.
 * Path snapshots include endpoints and are bounded at 1200 without altering dt.
 */
export function propagate(initial, seconds, { mu = MU, maxStep = 10, burn } = {}) {
  let state = normalizeState(initial);
  nonnegative(seconds, 'Propagation duration');
  positive(mu, 'Gravitational parameter');
  positive(maxStep, 'Maximum step');
  if (Math.ceil(seconds / maxStep) > MAX_STEPS) throw new RangeError('Requested propagation exceeds the teaching integrator step budget.');
  const off = { force: 0, massFlow: 0, ux: 0, uy: 0 };
  let powered = off;
  if (burn) {
    nonnegative(burn.thrust, 'Thrust');
    positive(burn.isp, 'Specific impulse');
    const direction = components(1, burn.bearing);
    const force = burn.thrust * normalizedThrottle(burn.throttle);
    powered = { force, massFlow: force / (burn.isp * G0), ux: direction.x, uy: direction.y };
  }
  const startTime = state.t;
  if (!Number.isFinite(startTime + seconds)) throw new RangeError('Final epoch must be finite.');
  let elapsed = 0;
  let count = 0;
  const path = [{ ...state }];
  const sampleInterval = seconds / (MAX_PATH - 2);
  let nextSample = sampleInterval;
  let status = Math.hypot(state.x, state.y) <= RADIUS ? 'impact' : 'complete';
  while (elapsed < seconds && status !== 'impact') {
    if (++count > MAX_STEPS) throw new RangeError('Propagation exceeds the teaching integrator step budget.');
    const r = Math.hypot(state.x, state.y);
    const speed = Math.hypot(state.vx, state.vy);
    // Even a coarse requested step must resolve motion around the central body.
    const dynamicStep = .025 * Math.sqrt(r ** 3 / mu);
    const travelStep = speed > 0 ? .1 * r / speed : Infinity;
    const power = state.mass > state.dryMass ? powered : off;
    const fuelTime = power.massFlow > 0 ? (state.mass - state.dryMass) / power.massFlow : Infinity;
    const dt = Math.min(maxStep, dynamicStep, travelStep, fuelTime, seconds - elapsed);
    if (!(dt > 0) || elapsed + dt === elapsed) throw new RangeError('Propagation step is below numerical time resolution.');
    let next = advance(state, dt, mu, power);
    let hitTime = Math.hypot(next.x, next.y) <= RADIUS ? dt : null;
    // Catch a grazing impact even if both endpoints of a step are above ground.
    if (hitTime === null && state.x * state.vx + state.y * state.vy < 0 && next.x * next.vx + next.y * next.vy > 0) {
      let lo = 0, hi = dt;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        const point = advance(state, mid, mu, power);
        if (point.x * point.vx + point.y * point.vy < 0) lo = mid; else hi = mid;
      }
      const lowPoint = advance(state, hi, mu, power);
      if (Math.hypot(lowPoint.x, lowPoint.y) <= RADIUS) hitTime = hi;
    }
    if (hitTime !== null) {
      let lo = 0, hi = hitTime;
      for (let i = 0; i < 45; i++) {
        const mid = (lo + hi) / 2;
        const point = advance(state, mid, mu, power);
        if (Math.hypot(point.x, point.y) > RADIUS) lo = mid; else hi = mid;
      }
      next = advance(state, hi, mu, power);
      elapsed += hi;
      status = 'impact';
    } else {
      elapsed += dt;
      if (dt === fuelTime) next.mass = next.dryMass;
    }
    next.t = startTime + elapsed;
    state = next;
    if (elapsed >= nextSample && path.length < MAX_PATH - 1) {
      path.push({ ...state });
      nextSample = (Math.floor(elapsed / sampleInterval) + 1) * sampleInterval;
    }
  }
  if (path.at(-1).t !== state.t) path.push({ ...state });
  return { state, path, status };
}

function seededRandom(seed) {
  let hash = 2166136261;
  for (const char of String(seed)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const id = (hash >>> 0).toString(16).padStart(8, '0');
  return { id, next: () => {
    hash += 0x6D2B79F5;
    let value = Math.imul(hash ^ (hash >>> 15), 1 | hash);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  } };
}

/** Deterministic, fuel-feasible, co-rotating circular-orbit beacon rendezvous. */
export function createMission(seed = 1) {
  if (!['number', 'string'].includes(typeof seed) || (typeof seed === 'number' && !Number.isFinite(seed))) {
    throw new RangeError('Mission seed must be a finite number or a string.');
  }
  const random = seededRandom(seed);
  const altitude = 300 + Math.floor(random.next() * 601);
  const r1 = RADIUS + altitude;
  const targetRadius = r1 + 1500 + Math.floor(random.next() * 5001);
  const reference = hohmann(r1, targetRadius);
  const names = ['Aster', 'Kepler', 'Vega', 'Lyra', 'Echo', 'Selene', 'Cassini', 'Pioneer'];
  const name = `${names[Math.floor(random.next() * names.length)]} ${random.id.slice(0, 4).toUpperCase()}`;
  return {
    id: random.id,
    name,
    initial: { x: r1, y: 0, vx: 0, vy: circularSpeed(r1), mass: 10000, dryMass: 6000, t: 0 },
    targetRadius,
    targetPhase: reference.phaseDegrees,
    reference,
    engine: { thrust: 180000, isp: 450 },
    brief: `Depart a ${altitude} km circular Earth orbit and rendezvous with ${name}, a zero-mass training beacon in a counterclockwise circular orbit at ${(targetRadius - RADIUS).toFixed(0)} km altitude. Match position and velocity using ideal impulses and a finite propellant budget.`
  };
}
