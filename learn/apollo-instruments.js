/** SVG teaching instruments. No HTML injection, external assets, or CSS required. */
import { MU, RADIUS, G0, circularSpeed, orbitElements, hohmann, rocketBurn, components, bearing } from './apollo-flight-engine.js';

const NS = 'http://www.w3.org/2000/svg';
const INK = '#09090d', WHITE = '#f4f4ee', ORANGE = '#ff6333', LAVENDER = '#aca5c9', GRID = '#292631';
const MUTED = '#98939f', TAU = 2 * Math.PI, RAD = Math.PI / 180;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const number = (values, key, fallback, min, max) => clamp(Number.isFinite(Number(values[key])) ? Number(values[key]) : fallback, min, max);
const format = (value, digits = 2) => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : 'Unbounded';
const output = (label, value, unit, digits = 2) => ({ label, value: typeof value === 'number' ? format(value, digits) : value, ...(unit ? { unit } : {}) });

function makeArtist(svg, title) {
  const doc = svg.ownerDocument;
  svg.replaceChildren();
  svg.removeAttribute('aria-labelledby');
  svg.setAttribute('viewBox', '0 0 640 440');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', title);
  const create = (tag, attrs = {}, text, parent = svg) => {
    const node = doc.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (text !== undefined) node.textContent = String(text);
    parent.appendChild(node);
    return node;
  };
  const text = (value, x, y, opts = {}) => create('text', {
    x, y, fill: opts.color || WHITE, 'font-size': opts.size || 12,
    'font-family': opts.sans ? 'Arial, Helvetica, sans-serif' : 'ui-monospace, SFMono-Regular, Menlo, monospace',
    'font-weight': opts.weight || 400, 'letter-spacing': opts.spacing ?? .3,
    'text-anchor': opts.anchor || 'start', ...opts.attrs
  }, value);
  const line = (a, b, color = GRID, opts = {}) => create('line', {
    x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: color,
    'stroke-width': opts.width || 1, 'stroke-opacity': opts.opacity ?? 1,
    ...(opts.dash ? { 'stroke-dasharray': opts.dash } : {})
  });
  const path = (points, color = WHITE, opts = {}) => create('path', {
    d: points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ') + (opts.close ? ' Z' : ''),
    fill: opts.fill || 'none', stroke: color, 'stroke-width': opts.width ?? 1.8,
    'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: opts.opacity ?? 1,
    ...(opts.dash ? { 'stroke-dasharray': opts.dash } : {})
  });
  const circle = (point, radius, color = WHITE, opts = {}) => create('circle', {
    cx: point.x, cy: point.y, r: radius, stroke: color, 'stroke-width': opts.width ?? 1,
    fill: opts.fill || 'none', opacity: opts.opacity ?? 1,
    ...(opts.dash ? { 'stroke-dasharray': opts.dash } : {})
  });
  const arrow = (a, b, color = ORANGE, opts = {}) => {
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    if (distance < .3) return;
    line(a, b, color, { width: opts.width || 2, dash: opts.dash, opacity: opts.opacity });
    const theta = Math.atan2(b.y - a.y, b.x - a.x);
    const size = Math.min(7, distance * .35);
    path([
      { x: b.x - size * Math.cos(theta - .5), y: b.y - size * Math.sin(theta - .5) }, b,
      { x: b.x - size * Math.cos(theta + .5), y: b.y - size * Math.sin(theta + .5) }
    ], color, { width: opts.width || 2 });
  };
  const craft = (point, color = ORANGE) => {
    circle(point, 10, color, { opacity: .35 });
    circle(point, 4, WHITE, { fill: WHITE, width: 0 });
    line({ x: point.x - 15, y: point.y }, { x: point.x - 8, y: point.y }, color);
    line({ x: point.x + 8, y: point.y }, { x: point.x + 15, y: point.y }, color);
  };
  const cross = (point, color = MUTED, size = 5) => {
    line({ x: point.x - size, y: point.y - size }, { x: point.x + size, y: point.y + size }, color);
    line({ x: point.x - size, y: point.y + size }, { x: point.x + size, y: point.y - size }, color);
  };
  const earth = (point, radius) => {
    circle(point, radius, MUTED, { fill: INK, width: 1 });
    if (radius > 7) {
      create('ellipse', { cx: point.x, cy: point.y, rx: radius * .38, ry: radius, fill: 'none', stroke: GRID });
      create('ellipse', { cx: point.x, cy: point.y, rx: radius, ry: radius * .36, fill: 'none', stroke: GRID });
      line({ x: point.x - radius, y: point.y }, { x: point.x + radius, y: point.y }, GRID);
    }
    if (radius > 35) text('EARTH', point.x, point.y + 4, { color: MUTED, size: 11, anchor: 'middle' });
    else {
      cross(point, MUTED, 3);
      text('EARTH / FOCUS', clamp(point.x + 10, 42, 480), clamp(point.y + 19, 85, 368), { color: MUTED, size: 11 });
    }
  };
  const footer = (left, right = 'OPTICAL NAVIGATION / LAB') => {
    line({ x: 26, y: 390 }, { x: 614, y: 390 });
    text(left, 28, 414, { size: 11, color: LAVENDER });
    text(right, 612, 414, { size: 10, anchor: 'end', color: MUTED });
  };
  create('title', {}, title);
  create('rect', { width: 640, height: 440, fill: INK });
  for (let x = 40; x < 640; x += 40) line({ x, y: 60 }, { x, y: 380 }, GRID, { opacity: .35 });
  for (let y = 60; y < 390; y += 40) line({ x: 26, y }, { x: 614, y }, GRID, { opacity: .35 });
  text(title.toUpperCase(), 28, 30, { size: 13, weight: 700, spacing: 1.1 });
  circle({ x: 606, y: 25 }, 3, ORANGE, { fill: ORANGE });
  line({ x: 26, y: 45 }, { x: 614, y: 45 });
  for (const x of [26, 614]) for (const y of [54, 380]) {
    line({ x: x - 4, y }, { x: x + 4, y }, MUTED);
    line({ x, y: y - 4 }, { x, y: y + 4 }, MUTED);
  }
  return { svg, create, text, line, path, circle, arrow, craft, cross, earth, footer };
}

function mapper(bounds, box = { x: 60, y: 78, width: 520, height: 292 }) {
  const scale = Math.min(box.width / Math.max(1, bounds.xmax - bounds.xmin), box.height / Math.max(1, bounds.ymax - bounds.ymin));
  const cx = (bounds.xmin + bounds.xmax) / 2, cy = (bounds.ymin + bounds.ymax) / 2;
  const project = ({ x, y }) => ({ x: box.x + box.width / 2 + (x - cx) * scale, y: box.y + box.height / 2 - (y - cy) * scale });
  project.scale = scale;
  return project;
}

function solveMonotone(target, end, fn) {
  let lo = 0, hi = end;
  for (let i = 0; i < 46; i++) {
    const mid = (lo + hi) / 2;
    if (fn(mid) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function sample(fn, end, count = 128) {
  return Array.from({ length: count + 1 }, (_, i) => fn(end * i / count));
}

function drawVectors(art, values, phase) {
  const magnitude = number(values, 'magnitude', 5, 0, 8);
  const angle = number(values, 'angle', 127, 0, 360);
  const vector = components(magnitude, angle);
  const origin = { x: 320, y: 226 }, scale = 17;
  const point = { x: origin.x + vector.x * scale, y: origin.y - vector.y * scale };
  const horizontal = { x: point.x, y: origin.y };
  art.arrow({ x: 76, y: origin.y }, { x: 564, y: origin.y }, MUTED, { width: 1 });
  art.arrow({ x: origin.x, y: 367 }, { x: origin.x, y: 77 }, MUTED, { width: 1 });
  art.text('+x', 573, 231, { color: MUTED }); art.text('+y', 329, 78, { color: MUTED });
  art.circle(origin, magnitude * scale, LAVENDER, { opacity: .25, dash: '2 7' });
  if (magnitude > 0) {
    art.arrow(origin, horizontal, LAVENDER, { width: 2 });
    art.arrow(horizontal, point, LAVENDER, { width: 2, dash: '3 4' });
    art.line(point, { x: origin.x, y: point.y }, LAVENDER, { opacity: .35, dash: '3 4' });
    art.arrow(origin, point, ORANGE, { width: 3 });
    art.text('vₓ', (origin.x + point.x) / 2, origin.y + 22, { color: LAVENDER, size: 16, anchor: 'middle' });
    art.text('vᵧ', point.x + (vector.x >= 0 ? 13 : -13), (origin.y + point.y) / 2, { color: LAVENDER, size: 16, anchor: vector.x >= 0 ? 'start' : 'end' });
    art.text('v', point.x + (vector.x >= 0 ? 14 : -14), point.y - 10, { color: ORANGE, size: 18 });
    const arc = sample(t => ({ x: origin.x + 40 * Math.cos(t), y: origin.y - 40 * Math.sin(t) }), angle * RAD, 50);
    art.path(arc, WHITE, { width: 1, opacity: .6 });
    const middle = angle * RAD / 2;
    art.text('θ', origin.x + 55 * Math.cos(middle), origin.y - 55 * Math.sin(middle) + 4, { size: 15, anchor: 'middle' });
    art.circle({ x: origin.x + vector.x * scale * phase, y: origin.y - vector.y * scale * phase }, 3, WHITE, { fill: WHITE });
  } else {
    art.circle(origin, 5, ORANGE, { fill: ORANGE });
    art.text('AT REST', 343, 202, { color: ORANGE });
    art.text('NO DEFINED HEADING', 343, 219, { size: 10, color: LAVENDER });
  }
  art.footer('COUNTERCLOCKWISE FROM +x', 'COMPONENTS SHARE ONE SCALE');
  return {
    title: 'Resolve the velocity vector',
    caption: 'Orange is the complete velocity; lavender resolves it into signed components. The moving point traces the vector, not a spacecraft trajectory. A zero vector has no heading.',
    readouts: [output('Horizontal component vₓ', vector.x, 'km/s', 3), output('Vertical component vᵧ', vector.y, 'km/s', 3), output('Recovered speed', Math.hypot(vector.x, vector.y), 'km/s', 3), output('Recovered bearing', magnitude ? bearing(vector.x, vector.y) : 'Undefined', magnitude ? '°' : undefined, 2)]
  };
}

function drawGravity(art, values, phase) {
  const radius = number(values, 'radius', 7000, 6600, 20000);
  const step = number(values, 'step', 10, 1, 120);
  const speed = circularSpeed(radius), acceleration = MU / radius ** 2, n = speed / radius;
  // Start below Earth, travelling right: (0,-r), (vc,0). All bearings remain inertial.
  const distance = speed * step, scale = 470 / distance;
  const origin = { x: 74, y: 298 };
  const project = p => ({ x: origin.x + p.x * scale, y: origin.y - p.y * scale });
  const exact = t => ({ x: radius * Math.sin(n * t), y: radius * (1 - Math.cos(n * t)) });
  const endpoint = exact(step);
  art.arrow({ x: 49, y: 298 }, { x: 585, y: 298 }, GRID, { width: 1 });
  art.arrow({ x: 74, y: 350 }, { x: 74, y: 112 }, GRID, { width: 1 });
  art.text('+x', 584, 320, { color: MUTED }); art.text('+y', 83, 118, { color: MUTED });
  art.text('LOCAL ZOOM', 100, 90, { size: 12, color: LAVENDER });
  art.text('EARTH LIES ABOVE THIS VIEW', 100, 109, { size: 10, color: MUTED });
  art.line({ x: 366, y: 91 }, { x: 396, y: 91 }, LAVENDER, { dash: '5 5', width: 2 });
  art.text('ONE EULER STEP', 406, 95, { color: LAVENDER, size: 11 });
  art.line({ x: 366, y: 113 }, { x: 396, y: 113 }, WHITE, { width: 2 });
  art.text('TRUE CIRCULAR ARC', 406, 117, { size: 11 });
  art.line(origin, project({ x: distance, y: 0 }), LAVENDER, { dash: '5 5', width: 2 });
  art.path(sample(exact, step).map(project), WHITE, { width: 2.5 });
  art.line(project({ x: distance, y: 0 }), project(endpoint), ORANGE, { width: 2 });
  art.circle(project({ x: distance, y: 0 }), 4, LAVENDER);
  art.circle(project(endpoint), 4, ORANGE);
  art.arrow(origin, { x: origin.x + 82, y: origin.y }, ORANGE, { width: 2.5 });
  art.arrow(origin, { x: origin.x, y: origin.y - 90 }, ORANGE, { width: 2.5 });
  art.text('v₀', origin.x + 55, origin.y + 25, { color: ORANGE, size: 16 });
  art.text('a₀', origin.x + 12, origin.y - 69, { color: ORANGE, size: 16 });
  art.craft(project(exact(phase * step)));
  art.circle(project({ x: distance * phase, y: 0 }), 3, LAVENDER, { fill: INK });
  art.text('Δr = v₀ Δt', 324, 349, { color: LAVENDER, size: 15, anchor: 'middle' });
  art.footer('EQUAL DISTANCE AXES / LOCAL VIEW', 'EULER ≠ EXACT');
  return {
    title: 'One numerical step versus continuous falling',
    caption: 'Start at (0, −r) with circular velocity along +x. Explicit Euler moves along the old tangent; the true circular arc bends toward Earth. Both paths use equal distance scales. Direction arrows are symbolic. At short steps the position error is genuinely tiny.',
    readouts: [output('Gravity magnitude', acceleration * 1000, 'm/s²', 4), output('Euler displacement Δx', distance, 'km', 3), output('Euler velocity gain Δvᵧ', acceleration * step, 'km/s', 5), output('One-step position error', Math.hypot(distance - endpoint.x, endpoint.y), 'km', 4)]
  };
}

function conicAtDeparture(radius, speedFactor) {
  const speed = circularSpeed(radius) * speedFactor;
  const elements = orbitElements({ x: radius, y: 0, vx: 0, vy: speed });
  const signedE = speedFactor ** 2 - 1;
  let point, velocity, end, clock, timeScale, collision = false;
  if (elements.energy < 0 && Number.isFinite(elements.a)) {
    const { a } = elements, b = a * Math.sqrt(1 - signedE ** 2);
    end = TAU;
    if (elements.periapsis < RADIUS && signedE < 0) {
      end = Math.acos(clamp((1 - RADIUS / a) / signedE, -1, 1));
      collision = true;
    }
    point = E => ({ x: a * (Math.cos(E) - signedE), y: b * Math.sin(E) });
    clock = E => E - signedE * Math.sin(E);
    timeScale = Math.sqrt(a ** 3 / MU);
    velocity = E => ({ x: -a * Math.sin(E) / (timeScale * (1 - signedE * Math.cos(E))), y: b * Math.cos(E) / (timeScale * (1 - signedE * Math.cos(E))) });
  } else if (Math.abs(signedE - 1) < 1e-10) {
    end = Math.sqrt(5);
    point = D => ({ x: radius * (1 - D * D), y: 2 * radius * D });
    clock = D => D + D ** 3 / 3;
    timeScale = Math.sqrt(2 * radius ** 3 / MU);
    velocity = D => ({ x: -2 * radius * D / (timeScale * (1 + D * D)), y: 2 * radius / (timeScale * (1 + D * D)) });
  } else {
    const a = -elements.a, e = elements.e, b = a * Math.sqrt(e * e - 1);
    end = Math.acosh((6 * radius / a + 1) / e);
    point = H => ({ x: a * (e - Math.cosh(H)), y: b * Math.sinh(H) });
    clock = H => e * Math.sinh(H) - H;
    timeScale = Math.sqrt(a ** 3 / MU);
    velocity = H => ({ x: -a * Math.sinh(H) / (timeScale * (e * Math.cosh(H) - 1)), y: b * Math.cosh(H) / (timeScale * (e * Math.cosh(H) - 1)) });
  }
  return { elements, point, velocity, end, clock, timeScale, collision };
}

function drawOrbit(art, values, phase) {
  const radius = number(values, 'radius', 7000, 6600, 30000);
  const factor = number(values, 'speedFactor', 1, .6, 1.5);
  const conic = conicAtDeparture(radius, factor);
  const points = sample(conic.point, conic.end, 200);
  const bounds = { xmin: -RADIUS * 1.12, xmax: RADIUS * 1.12, ymin: -RADIUS * 1.12, ymax: RADIUS * 1.12 };
  for (const p of points) {
    bounds.xmin = Math.min(bounds.xmin, p.x); bounds.xmax = Math.max(bounds.xmax, p.x);
    bounds.ymin = Math.min(bounds.ymin, p.y); bounds.ymax = Math.max(bounds.ymax, p.y);
  }
  const project = mapper(bounds, { x: 68, y: 93, width: 504, height: 258 });
  const center = project({ x: 0, y: 0 });
  art.line({ x: 42, y: center.y }, { x: 598, y: center.y }, GRID);
  art.line({ x: center.x, y: 73 }, { x: center.x, y: 363 }, GRID);
  art.earth(center, RADIUS * project.scale);
  art.path(points.map(project), conic.collision ? LAVENDER : ORANGE, { width: 2.2 });
  const anomaly = solveMonotone(phase * conic.clock(conic.end), conic.end, conic.clock);
  const position = conic.point(anomaly), point = project(position), v = conic.velocity(anomaly), speed = Math.hypot(v.x, v.y);
  art.line(center, point, LAVENDER, { dash: '3 5', opacity: .45 });
  art.arrow(point, { x: point.x + 32 * v.x / speed, y: point.y - 32 * v.y / speed }, WHITE, { width: 1.5 });
  art.craft(point);
  const start = project({ x: radius, y: 0 });
  art.circle(start, 4, WHITE);
  if (conic.collision) {
    art.cross(project(conic.point(conic.end)), ORANGE, 7);
    art.text('SURFACE INTERSECTION', 320, 77, { anchor: 'middle', size: 11, color: ORANGE });
  } else art.text(conic.elements.energy < 0 ? 'BOUND CONIC' : 'ESCAPE TRAJECTORY', 320, 77, { anchor: 'middle', size: 11, color: LAVENDER });
  art.footer('EQUAL x / y SCALE • EARTH TO SCALE', 'VELOCITY ARROW: DIRECTION');
  return {
    title: 'Read the orbit from its energy',
    caption: conic.collision
      ? 'This mathematical conic intersects Earth. The visible flight and time-based marker stop at the first surface contact; negative energy alone does not make an orbit safe. The view fits the visible arc with equal axes.'
      : conic.elements.energy < 0
        ? 'The spacecraft moves according to Kepler’s equation, speeding up near Earth and slowing farther away. The view fits the whole ellipse with equal axes; Earth can become very small near escape energy.'
        : 'An escaping trajectory has no apoapsis or repeating period. This view shows the outbound arc to six times the departure radius. Marker motion follows physical time; both distance axes share one scale.',
    readouts: [output('Departure speed', conic.elements.speed, 'km/s', 4), output('Specific energy', conic.elements.energy, 'km²/s²', 3), output('Perigee radius', conic.elements.periapsis, 'km', 1), output('Apogee radius', conic.elements.apoapsis, Number.isFinite(conic.elements.apoapsis) ? 'km' : undefined, 1)]
  };
}

function drawEngine(art, values, phase) {
  const throttle = number(values, 'throttle', .6, .1, 1), duration = number(values, 'duration', 40, 0, 120);
  const params = { mass: 10000, dryMass: 6000, thrust: 180000, isp: 450, throttle };
  const result = rocketBurn({ ...params, duration });
  const now = rocketBurn({ ...params, duration: duration * phase });
  const force = params.thrust * throttle;
  const x = t => 56 + t / 120 * 366, y = acceleration => 305 - acceleration / 30 * 198;
  art.arrow({ x: 56, y: 305 }, { x: 432, y: 305 }, MUTED, { width: 1 });
  art.arrow({ x: 56, y: 315 }, { x: 56, y: 76 }, MUTED, { width: 1 });
  art.text('a', 42, 78, { size: 16, color: MUTED }); art.text('t', 435, 324, { size: 16, color: MUTED });
  art.text('THRUST ACCELERATION', 74, 78, { size: 11, color: LAVENDER });
  const accelerationAt = t => force / Math.max(params.dryMass, params.mass - result.massFlow * t);
  if (result.duration > 0) {
    const curve = sample(t => ({ x: x(t), y: y(accelerationAt(t)) }), result.duration, 70);
    art.path([{ x: x(0), y: y(0) }, ...curve, { x: x(result.duration), y: y(0) }], 'none', { fill: ORANGE, opacity: .12, close: true });
    art.line({ x: x(0), y: y(force / params.mass) }, { x: x(result.duration), y: y(force / params.mass) }, LAVENDER, { dash: '4 5', opacity: .7 });
    art.path(curve, ORANGE, { width: 2.7 });
    art.line(curve.at(-1), { x: x(result.duration), y: y(0) }, ORANGE, { width: 1.5, dash: '3 4' });
    if (duration > result.duration) {
      art.line({ x: x(result.duration), y: y(0) }, { x: x(duration), y: y(0) }, ORANGE, { width: 2 });
      art.text('FUEL CUT-OFF', x(result.duration), 337, { anchor: 'middle', size: 10, color: ORANGE });
    }
    const time = duration * phase, acceleration = time <= result.duration ? force / now.mass : 0;
    art.circle({ x: x(time), y: y(acceleration) }, 4, WHITE, { fill: WHITE });
  }
  art.text('F / m(t)', 80, 108, { size: 16, color: ORANGE });
  art.text('AREA = Δv', 96, 353, { size: 15, color: ORANGE });
  art.text('DASHED: CONSTANT m₀', 96, 374, { size: 10, color: LAVENDER });
  const tank = { x: 481, y: 101, width: 77, height: 204 };
  art.create('rect', { ...tank, fill: 'none', stroke: WHITE });
  const dryHeight = tank.height * .6, fuelHeight = tank.height * (now.mass - params.dryMass) / params.mass;
  art.create('rect', { x: tank.x + 1, y: tank.y + tank.height - dryHeight, width: tank.width - 2, height: dryHeight - 1, fill: GRID });
  if (fuelHeight > 0) art.create('rect', { x: tank.x + 1, y: tank.y + tank.height - dryHeight - fuelHeight, width: tank.width - 2, height: fuelHeight, fill: ORANGE, opacity: .8 });
  art.line({ x: tank.x, y: tank.y + tank.height - dryHeight }, { x: tank.x + tank.width, y: tank.y + tank.height - dryHeight }, WHITE, { opacity: .6 });
  art.text('MASS', 519, 82, { anchor: 'middle', size: 12 });
  art.text('FUEL', 519, 130, { anchor: 'middle', size: 11, color: WHITE });
  art.text('DRY', 519, 263, { anchor: 'middle', size: 11, color: MUTED });
  art.text('m(t)', 519, 333, { anchor: 'middle', size: 16, color: LAVENDER });
  art.footer('IDEAL ENGINE / VARYING MASS', 'GRAVITY NOT INCLUDED');
  return {
    title: 'Integrate thrust as the mass falls',
    caption: 'The area under thrust acceleration F/m(t) gives the ideal engine Δv. Solid orange accounts for shrinking mass; the dashed reference holds mass fixed. Thrust stops at dry mass. This is not a propagated orbital burn: gravity and changing steering are omitted.',
    readouts: [output('Ideal engine Δv', result.deltaV, 'km/s', 4), output('Fuel consumed', result.fuelUsed, 'kg', 1), output('Remaining mass', result.mass, 'kg', 1), output('Actual powered time', result.duration, 's', 2)]
  };
}

function drawTransfer(art, values, phase, kind) {
  const r1 = kind === 'mission' ? 7000 : number(values, 'r1', 7000, 6700, 10000);
  const r2 = kind === 'mission' ? 14000 : number(values, 'r2', 14000, 11000, 30000);
  const transfer = hohmann(r1, r2), e = (r2 - r1) / (r2 + r1), b = transfer.a * Math.sqrt(1 - e * e);
  const ellipse = E => ({ x: transfer.a * (Math.cos(E) - e), y: b * Math.sin(E) });
  const project = mapper({ xmin: -r2, xmax: r2, ymin: -r2, ymax: r2 }, { x: 75, y: 76, width: 490, height: 296 });
  const center = project({ x: 0, y: 0 });
  art.circle(center, r2 * project.scale, LAVENDER, { opacity: .48, dash: '2 6' });
  art.circle(center, r1 * project.scale, MUTED, { opacity: .5 });
  art.earth(center, RADIUS * project.scale);
  art.path(sample(ellipse, Math.PI).map(project), ORANGE, { width: 2.5 });
  const E = solveMonotone(phase * Math.PI, Math.PI, E => E - e * Math.sin(E));
  const location = project(ellipse(E));
  const start = project({ x: r1, y: 0 }), arrival = project({ x: -r2, y: 0 });
  art.circle(start, 4, WHITE); art.circle(arrival, 4, WHITE);
  art.arrow(start, { x: start.x, y: start.y - 45 }, WHITE, { width: 1.5 });
  art.arrow(arrival, { x: arrival.x, y: arrival.y + 45 }, WHITE, { width: 1.5 });
  art.text('Δv₁', start.x + 12, start.y - 18, { size: 15 });
  art.text('Δv₂', arrival.x - 13, arrival.y + 24, { size: 15, anchor: 'end' });
  art.craft(location);
  if (kind === 'intercept' || kind === 'mission') {
    const initialLead = kind === 'mission' ? transfer.phaseDegrees : number(values, 'phase', 63, 0, 360);
    const motion = Math.sqrt(MU / r2 ** 3) * transfer.coastTime / RAD;
    const targetStart = project(components(r2, initialLead));
    const targetEnd = project(components(r2, initialLead + motion));
    const targetNow = project(components(r2, initialLead + motion * phase));
    art.path(sample(t => project(components(r2, initialLead + t)), motion, 70), LAVENDER, { width: 1.5, opacity: .75 });
    art.circle(targetStart, 6, LAVENDER, { dash: '2 3' });
    art.circle(targetNow, 6, LAVENDER, { fill: INK, width: 2 });
    art.circle(targetNow, 2, LAVENDER, { fill: LAVENDER });
    art.cross(targetEnd, LAVENDER, 5);
    art.line(arrival, targetEnd, LAVENDER, { width: 1, dash: '3 4', opacity: .65 });
    art.text('◌ TARGET NOW', 40, 74, { color: LAVENDER, size: 10 });
    art.text('× TARGET AT ARRIVAL', 40, 93, { color: LAVENDER, size: 10 });
    const goal = components(r2, initialLead + motion);
    const targetVelocity = components(circularSpeed(r2), initialLead + motion + 90);
    const transferSpeed = Math.sqrt(MU * (2 / r2 - 1 / transfer.a));
    const miss = Math.hypot(goal.x + r2, goal.y);
    const relativeSpeed = Math.hypot(targetVelocity.x, -transferSpeed - targetVelocity.y);
    art.footer('SAME EARTH / PASSIVE BEACON', 'EQUAL DISTANCE AXES');
    if (kind === 'intercept') return {
      title: 'Meet the target in position and time',
      caption: 'The solid ring marker is the moving beacon; the cross predicts its position when the transfer reaches the far side. The dashed line shows the final position miss. Both markers advance in physical elapsed time. Even a perfect intercept still needs a velocity-matching burn.',
      readouts: [output('Required initial lead', transfer.phaseDegrees, '°', 3), output('Arrival position miss', miss, 'km', 2), output('Relative speed before arrival burn', relativeSpeed, 'km/s', 4), output('Coast time', transfer.coastTime, 's', 1)]
    };
    const budget = transfer.departureDv + transfer.arrivalDv;
    const remainingMass = 10000 * Math.exp(-budget * 1000 / (450 * G0));
    return {
      title: 'A complete plan has an arrival burn',
      caption: 'The demonstration uses a correctly phased, passive beacon and two ideal impulses. The second burn matches the target’s circular velocity. Navigation checkout must verify position, velocity, and remaining fuel; it is not an Apollo trajectory reconstruction.',
      readouts: [output('First impulse', transfer.departureDv, 'km/s', 4), output('Coast time', transfer.coastTime, 's', 1), output('Arrival impulse', transfer.arrivalDv, 'km/s', 4), output('Mass after both ideal burns', remainingMass, 'kg', 1)]
    };
  }
  art.text('DEPARTURE CIRCLE', 450, 340, { anchor: 'middle', size: 10, color: MUTED });
  art.text('TARGET CIRCLE', 320, 367, { anchor: 'middle', size: 10, color: LAVENDER });
  art.footer('HALF AN ELLIPSE / TWO IMPULSES', 'EQUAL DISTANCE AXES');
  return {
    title: 'Connect circular orbits with a transfer ellipse',
    caption: 'Orange is the outbound Hohmann half-ellipse. The marker follows Kepler’s equation, so the craft spends more time near the far end. The endpoint arrows show each prograde impulse’s direction, not its magnitude. Earth and both circular orbits share one distance scale.',
    readouts: [output('Departure impulse Δv₁', transfer.departureDv, 'km/s', 4), output('Arrival impulse Δv₂', transfer.arrivalDv, 'km/s', 4), output('Coast time', transfer.coastTime, 's', 1), output('Semimajor axis', transfer.a, 'km', 1)]
  };
}

function drawCorrection(art, values, phase) {
  const errorX = number(values, 'errorX', 120, -300, 300), errorY = number(values, 'errorY', -60, -300, 300);
  const remaining = number(values, 'remaining', 1200, 100, 3000);
  const deltaV = { x: errorX / remaining, y: errorY / remaining };
  const magnitude = Math.hypot(deltaV.x, deltaV.y);
  const start = { x: -800, y: -250 }, predicted = { x: 0, y: 0 }, target = { x: errorX, y: errorY };
  const project = mapper({ xmin: -850, xmax: 400, ymin: -360, ymax: 360 }, { x: 54, y: 90, width: 524, height: 262 });
  const initial = project(start), end = project(predicted), desired = project(target);
  art.line(initial, end, LAVENDER, { width: 1.6, dash: '5 5' });
  art.line(initial, desired, ORANGE, { width: 2 });
  art.arrow(end, desired, WHITE, { width: 1.5 });
  art.cross(end, LAVENDER, 6);
  art.circle(desired, 8, WHITE, { dash: '3 3' });
  art.circle(desired, 3, WHITE, { fill: WHITE });
  art.circle(initial, 4, WHITE);
  if (magnitude > 0) {
    art.arrow(initial, { x: initial.x + deltaV.x / magnitude * 55, y: initial.y - deltaV.y / magnitude * 55 }, WHITE, { width: 2 });
    art.text('Δv', initial.x + 8, initial.y + 27, { size: 16 });
    art.text('e', (end.x + desired.x) / 2 + 9, (end.y + desired.y) / 2 - 7, { size: 18 });
  }
  const uncorrected = { x: start.x * (1 - phase), y: start.y * (1 - phase) };
  const corrected = { x: start.x * (1 - phase) + errorX * phase, y: start.y * (1 - phase) + errorY * phase };
  art.circle(project(uncorrected), 4, LAVENDER, { fill: INK });
  art.craft(project(corrected));
  art.text('PREDICTION', clamp(end.x + 14, 38, 505), end.y - 14, { size: 10, color: LAVENDER });
  if (Math.hypot(errorX, errorY) > 60) art.text('DESIRED', clamp(desired.x + 12, 38, 532), clamp(desired.y - 13, 84, 354), { size: 10 });
  art.text('CORRECT HERE', initial.x, initial.y - 20, { size: 10, color: ORANGE });
  art.text('Δv ≈ e / τ', 79, 93, { size: 22, color: WHITE });
  art.text('DESIRED MINUS PREDICTED', 79, 115, { size: 10, color: LAVENDER });
  art.footer('STRAIGHT DRIFT / GRAVITY OMITTED', 'ARROW: CORRECTION DIRECTION');
  return {
    title: 'Turn the miss vector into a first correction',
    caption: 'The dashed coast ends at the old prediction. In this gravity-free drift model, applying Δv = error/time sends the orange coast to the desired point. In a real orbit gravity couples the components: repropagate and revise the estimate. The short burn arrow shows direction only.',
    readouts: [output('Correction Δvₓ', deltaV.x, 'km/s', 4), output('Correction Δvᵧ', deltaV.y, 'km/s', 4), output('Correction magnitude', magnitude, 'km/s', 4), output('Correction bearing', magnitude ? bearing(deltaV.x, deltaV.y) : 'Undefined', magnitude ? '°' : undefined, 2)]
  };
}

const TITLES = {
  vectors: 'Vector resolution', gravity: 'Calculus of a coast', orbit: 'Energy becomes geometry',
  engine: 'Thrust, mass, and time', transfer: 'The two-burn transfer', intercept: 'A rendezvous with the future',
  correction: 'The correction vector', mission: 'Plan the whole flight'
};

/**
 * Render one SVG instrument and return accessible teaching text and numerical
 * readouts. Numerical answers are not embedded in diagram labels, so callers may
 * keep readouts hidden until a practice hint is requested. phase is elapsed-time
 * fraction (except the explicitly illustrative vector trace).
 */
export function drawInstrument(svg, kind, values = {}, phase = .35) {
  if (!svg?.ownerDocument?.createElementNS) throw new TypeError('An existing SVG element is required.');
  if (!Object.hasOwn(TITLES, kind)) throw new RangeError(`Unknown instrument kind: ${kind}`);
  const position = clamp(Number.isFinite(phase) ? phase : .35, 0, 1);
  const art = makeArtist(svg, TITLES[kind]);
  let result;
  switch (kind) {
    case 'vectors': result = drawVectors(art, values, position); break;
    case 'gravity': result = drawGravity(art, values, position); break;
    case 'orbit': result = drawOrbit(art, values, position); break;
    case 'engine': result = drawEngine(art, values, position); break;
    case 'transfer': case 'intercept': case 'mission': result = drawTransfer(art, values, position, kind); break;
    case 'correction': result = drawCorrection(art, values, position); break;
  }
  art.create('desc', {}, result.caption);
  return result;
}
