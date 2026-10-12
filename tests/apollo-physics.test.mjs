import test from 'node:test';
import assert from 'node:assert/strict';
import { MU, EARTH_RADIUS, PARKING_RADIUS, CIRCULAR_SPEED, ESCAPE_SPEED, MOON_DISTANCE, LUNAR_REACH_BURN, transfer, orbitPoint, positionAtTime } from '../learn/apollo-physics.js';
import { drawInstrument } from '../learn/apollo-instruments.js';
const near=(actual,expected,tol=1e-6)=>assert.ok(Math.abs(actual-expected)<tol,`${actual} != ${expected}`);
test('unburned orbit is circular and conserves the expected orbital energy',()=>{
 const o=transfer(0);near(o.a,PARKING_RADIUS);near(o.apogee,PARKING_RADIUS);near(o.e,0);
 near(o.energy,-MU/(2*PARKING_RADIUS));near(o.speed,CIRCULAR_SPEED);
 for(let i=0;i<=32;i++){const p=orbitPoint(o,i*Math.PI/16);near(Math.hypot(p.x,p.y),PARKING_RADIUS);}
});
test('minimum lunar reach matches independent transfer-ellipse calculation',()=>{
 near(LUNAR_REACH_BURN,3.131345,1e-6);
 const o=transfer(LUNAR_REACH_BURN);assert.ok(o.reachesMoon);near(o.apogee,MOON_DISTANCE,1e-5);
 near(o.arrival.t/3600,119.470891,1e-4);near(o.arrival.t,o.halfPeriod,.01);
});
test('extra departure energy crosses lunar distance earlier, before apogee',()=>{
 const o=transfer(3.15);assert.ok(o.reachesMoon);near(o.arrival.t/3600,75.162166,1e-4);
 assert.ok(o.arrival.t<o.halfPeriod);const p=positionAtTime(o,o.arrival.t);near(Math.hypot(p.x,p.y),MOON_DISTANCE,1e-5);
 near(Math.atan2(p.y,p.x),o.arrival.theta,1e-9);
});
test('a short transfer does not invent an encounter time',()=>{
 const o=transfer(3.13);assert.ok(!o.reachesMoon);assert.equal(o.arrival,null);assert.ok(o.apogee<MOON_DISTANCE);
});
test('all slider states are finite, bound, monotonic and conserve perigee',()=>{
 let previousApogee=0,previousCrossing=Infinity;
 for(let dv=2800;dv<=3190;dv++){
  const o=transfer(dv/1000);assert.ok(o.e>=0&&o.e<1);assert.ok(o.apogee>previousApogee);previousApogee=o.apogee;
  near(o.a*(1-o.e),PARKING_RADIUS,1e-7);near(orbitPoint(o,0).x,PARKING_RADIUS,1e-7);
  near(orbitPoint(o,Math.PI).x,-o.apogee,1e-6);
  const end=positionAtTime(o,o.halfPeriod);near(end.x,-o.apogee,1e-6);near(end.y,0,1e-6);
  if(o.arrival){assert.ok(o.arrival.t<previousCrossing);previousCrossing=o.arrival.t;}
 }
});
test('invalid or unbound burns are rejected instead of drawing false ellipses',()=>{
 for(const dv of [-.1,NaN,Infinity,ESCAPE_SPEED-CIRCULAR_SPEED,10])assert.throws(()=>transfer(dv),RangeError);
});

// A minimal SVG sink verifies the actual rendered model without a browser or a
// second copy of its orbital formulas. Layout is checked separately in-browser.
function renderInstrument(kind, values, phase = .35) {
 const nodes = [];
 const document = { createElementNS(_namespace, tag) {
  const node = { tag, attributes: {}, children: [], textContent: '', ownerDocument: document,
   setAttribute(key, value) { this.attributes[key] = String(value); },
   removeAttribute(key) { delete this.attributes[key]; },
   appendChild(child) { this.children.push(child); },
   replaceChildren() { this.children = []; }
  };
  nodes.push(node); return node;
 } };
 const model = drawInstrument(document.createElementNS('', 'svg'), kind, values, phase);
 for (const node of nodes) for (const value of Object.values(node.attributes)) {
  assert.doesNotMatch(value, /(?:NaN|Infinity)/, `${kind} must not emit invalid SVG coordinates`);
 }
 return { model, nodes, text: nodes.map(node => node.textContent).join(' ') };
}

test('exact escape speed is drawn and described as unbound even with negative roundoff energy',()=>{
 for (const radius of [6600, 7000, 8800, 15000, 30000]) {
  const { model, text } = renderInstrument('orbit', { radius, speedFactor: Math.SQRT2 });
  assert.match(text, /ESCAPE TRAJECTORY/);
  assert.doesNotMatch(text, /BOUND CONIC/);
  assert.match(model.caption, /no apoapsis or repeating period/);
  assert.equal(model.readouts.at(-1).value, 'Unbounded');
 }
});

test('all eight instruments remain finite at their physical boundaries and animation endpoints',()=>{
 const cases = [
  ['vectors', { magnitude: 0, angle: 360 }],
  ['vectors', { magnitude: 8, angle: 270 }],
  ['gravity', { radius: 6600, step: 120 }],
  ['gravity', { radius: 20000, step: 1 }],
  ['orbit', { radius: 6600, speedFactor: .6 }],
  ['orbit', { radius: 30000, speedFactor: .6 }],
  ['orbit', { radius: 6600, speedFactor: 1 }],
  ['orbit', { radius: 30000, speedFactor: 1.41 }],
  ['orbit', { radius: 6600, speedFactor: 1.5 }],
  ['engine', { throttle: .1, duration: 0 }],
  ['engine', { throttle: 1, duration: 120 }],
  ['transfer', { r1: 6700, r2: 30000 }],
  ['transfer', { r1: 10000, r2: 11000 }],
  ['intercept', { r1: 6700, r2: 30000, phase: 360 }],
  ['correction', { errorX: -300, errorY: 300, remaining: 100 }],
  ['correction', { errorX: 0, errorY: 0, remaining: 3000 }],
  ['mission', {}]
 ];
 for (const [kind, values] of cases) for (const phase of [0, .35, 1]) renderInstrument(kind, values, phase);
 assert.equal(renderInstrument('vectors', { magnitude: 0 }).model.readouts.at(-1).value, 'Undefined');
 assert.equal(renderInstrument('correction', { errorX: 0, errorY: 0 }).model.readouts.at(-1).value, 'Undefined');
 assert.match(renderInstrument('orbit', { radius: 6600, speedFactor: .6 }).text, /SURFACE INTERSECTION/);
});

test('engine graph reaches dry-mass cutoff and its area uses the displayed units',()=>{
 const { model, text } = renderInstrument('engine', { throttle: 1, duration: 120 }, 1);
 const value = label => Number(model.readouts.find(readout => readout.label === label).value.replaceAll(',', ''));
 near(value('Fuel consumed'), 4000);
 near(value('Remaining mass'), 6000);
 const exhaust = 450 * 9.80665;
 near(value('Ideal engine Δv'), exhaust * Math.log(10000 / 6000) / 1000, .000051);
 near(value('Actual powered time'), 4000 * exhaust / 180000, .0051);
 assert.match(text, /m\/s²/);
 assert.match(text, /t \(s\)/);
 assert.match(text, /FUEL CUT-OFF/);
 assert.match(model.caption, /divide by 1000/);
});

test('rendered elliptical, parabolic and hyperbolic arcs put Earth at the force center and stop at contact',()=>{
 for (const [radius, speedFactor] of [[6600, .6], [30000, .6], [30000, .9], [7000, 1], [7000, 1.2], [7000, 1.41], [8800, Math.SQRT2], [7000, 1.5]]) {
  const { nodes, text } = renderInstrument('orbit', { radius, speedFactor });
  const earth = nodes.find(node => node.tag === 'circle' && node.attributes.stroke === '#98939f' && node.attributes.fill === '#09090d').attributes;
  const scale = Number(earth.r) / EARTH_RADIUS;
  const path = nodes.find(node => node.tag === 'path' && node.attributes['stroke-width'] === '2.2').attributes.d;
  const coordinates = [...path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(([, x, y]) => ({ x: (Number(x) - Number(earth.cx)) / scale, y: (Number(earth.cy) - Number(y)) / scale }));
  // The independent polar conic equation is r + e·r = h²/μ. At departure
  // eccentricity points along signed x, and h²/μ = radius × speedFactor².
  const signedE = speedFactor ** 2 - 1, p = radius * speedFactor ** 2;
  const tolerance = .003 / scale; // SVG paths are rounded to 0.001 pixel.
  for (const position of coordinates) {
   near(Math.hypot(position.x, position.y) + signedE * position.x, p, tolerance);
   assert.ok(Math.hypot(position.x, position.y) >= EARTH_RADIUS - tolerance);
  }
  near(Math.hypot(coordinates[0].x, coordinates[0].y), radius, tolerance);
  if (text.includes('SURFACE INTERSECTION')) near(Math.hypot(coordinates.at(-1).x, coordinates.at(-1).y), EARTH_RADIUS, tolerance);
  if (speedFactor >= Math.SQRT2) near(Math.hypot(coordinates.at(-1).x, coordinates.at(-1).y), 6 * radius, tolerance);
 }
});

test('correct phasing closes the animated transfer while preserving the arrival velocity difference',()=>{
 const r1 = 7000, r2 = 14000;
 // Independent radius-ratio expressions for a Hohmann transfer.
 const time = Math.PI * Math.sqrt((r1 + r2) ** 3 / (8 * MU));
 const phase = 180 - time * Math.sqrt(MU / r2 ** 3) * 180 / Math.PI;
 const deltaV = Math.sqrt(MU / r2) * (1 - Math.sqrt(2 * r1 / (r1 + r2)));
 const { model } = renderInstrument('intercept', { r1, r2, phase }, 1);
 near(Number(model.readouts[1].value.replaceAll(',', '')), 0, .0051);
 near(Number(model.readouts[2].value), deltaV, .000051);
 const missed = renderInstrument('intercept', { r1, r2, phase: phase + 180 }, 1).model;
 near(Number(missed.readouts[1].value.replaceAll(',', '')), 2 * r2, .0051);
});

test('legacy lab renders the entire lunar reference ring and transfer at one scale for every burn',async()=>{
 const elements = new Map();
 const document = {
  createElementNS(_namespace, tag) {
   return { tag, attributes: {}, children: [], listeners: {}, value: '',
    setAttribute(key, value) { this.attributes[key] = String(value); },
    replaceChildren(...children) { this.children = children; },
    append(...children) { this.children.push(...children); },
    addEventListener(name, handler) { this.listeners[name] = handler; }
   };
  },
  createElement(tag) { return this.createElementNS('', tag); },
  createTextNode(text) { return { textContent: text }; },
  getElementById(id) {
   if (!elements.has(id)) elements.set(id, this.createElement(id));
   return elements.get(id);
  },
  querySelectorAll() { return []; }
 };
 const burn = document.getElementById('burn'); burn.value = '3150';
 document.getElementById('coast').value = '72';
 const previousDocument = globalThis.document;
 globalThis.document = document;
 try {
  await import('../learn/apollo-trajectories.js');
  for (let metersPerSecond = 2800; metersPerSecond <= 3190; metersPerSecond++) {
   burn.value = String(metersPerSecond); burn.listeners.input();
   const geometry = document.getElementById('orbit-geometry').children;
   const ring = geometry.find(node => node.tag === 'circle' && node.attributes.stroke === '#b6b1c566').attributes;
   const cx = Number(ring.cx), cy = Number(ring.cy), radius = Number(ring.r);
   assert.ok(cx - radius >= 42 && cx + radius <= 704, 'Reference ring fits horizontally');
   assert.ok(cy - radius >= 64 && cy + radius <= 352, 'Reference ring fits vertically');
   const scale = radius / MOON_DISTANCE;
   const path = geometry.find(node => node.tag === 'path' && node.attributes.fill === '#ff633308').attributes.d;
   const points = [...path.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(([, x, y]) => ({ x: Number(x), y: Number(y) }));
   const orbit = transfer(metersPerSecond / 1000);
   const p = PARKING_RADIUS * (1 + orbit.e);
   for (const point of points) {
    assert.ok(point.x >= 42 && point.x <= 704 && point.y >= 64 && point.y <= 352, 'Full transfer fits');
    const x = (point.x - cx) / scale, y = (cy - point.y) / scale;
    near(Math.hypot(x, y) + orbit.e * x, p, .003 / scale);
   }
  }
 } finally {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
 }
});
