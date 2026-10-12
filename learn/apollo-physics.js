/** Educational Earth-only, impulsive, coplanar transfer. Distances km, time s. */
export const MU = 398600.4418;
export const EARTH_RADIUS = 6378.137;
export const PARKING_RADIUS = EARTH_RADIUS + 200;
export const MOON_DISTANCE = 384400;
export const MOON_PERIOD = 27.321661 * 86400;
export const CIRCULAR_SPEED = Math.sqrt(MU / PARKING_RADIUS);
export const ESCAPE_SPEED = Math.sqrt(2 * MU / PARKING_RADIUS);
export const LUNAR_REACH_BURN = Math.sqrt(MU * (2 / PARKING_RADIUS - 2 / (PARKING_RADIUS + MOON_DISTANCE))) - CIRCULAR_SPEED;

export function transfer(deltaV) {
  if (!Number.isFinite(deltaV) || deltaV < 0 || deltaV >= ESCAPE_SPEED - CIRCULAR_SPEED) {
    throw new RangeError('Burn must describe a prograde, bound orbit.');
  }
  const speed = CIRCULAR_SPEED + deltaV;
  const energy = speed * speed / 2 - MU / PARKING_RADIUS;
  const a = -MU / (2 * energy);
  const e = 1 - PARKING_RADIUS / a;
  const apogee = a * (1 + e);
  const halfPeriod = Math.PI * Math.sqrt(a ** 3 / MU);
  const reachesMoon = apogee >= MOON_DISTANCE - 1e-6;
  let arrival = null;
  if (reachesMoon) {
    const E = Math.acos(Math.max(-1, Math.min(1, (1 - MOON_DISTANCE / a) / e)));
    const t = (E - e * Math.sin(E)) * Math.sqrt(a ** 3 / MU);
    const theta = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(E), Math.cos(E) - e);
    const moonTravel = t / MOON_PERIOD * 2 * Math.PI;
    arrival = { t, theta, moonTravel, phase: theta - moonTravel };
  }
  return { deltaV, speed, energy, a, e, apogee, halfPeriod, reachesMoon, arrival };
}

/** Focus at origin; +x is departure, +y is initial prograde velocity. */
export function orbitPoint(orbit, eccentricAnomaly) {
  return {
    x: orbit.a * (Math.cos(eccentricAnomaly) - orbit.e),
    y: orbit.a * Math.sqrt(1 - orbit.e ** 2) * Math.sin(eccentricAnomaly)
  };
}

/** Solve Kepler's equation on the outbound half; a bisection is stable near e=1. */
export function positionAtTime(orbit, seconds) {
  const mean = Math.max(0, Math.min(Math.PI, seconds * Math.sqrt(MU / orbit.a ** 3)));
  let lo = 0, hi = Math.PI;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (mid - orbit.e * Math.sin(mid) < mean) lo = mid; else hi = mid;
  }
  return orbitPoint(orbit, (lo + hi) / 2);
}
