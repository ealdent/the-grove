import test from 'node:test';
import assert from 'node:assert/strict';
import {
  anchorCamera, cameraState, createNavigation, panCamera, project, screenToGeo,
} from '../learn/pangea-navigation.js';

const W = 1600, H = 950;
const camera = (z = 0.65) => ({ lon: 10, lat: 12, z, pitchBias: 0 });
const navigation = (cam, options = {}) => createNavigation(cam, { size: () => [W, H], ...options });
const settle = nav => { for (let i = 0; i < 120; i++) nav.step(1 / 60); };

test('east projects right and north projects up in the globe view', () => {
  const cam = { lon: 0, lat: 0, z: 0.3, pitchBias: 0 };
  const state = cameraState(cam, W, H);
  const centre = project(state, 0, 0);
  assert.ok(project(state, 10, 0).x > centre.x);
  assert.ok(project(state, -10, 0).x < centre.x);
  assert.ok(project(state, 0, 10).y < centre.y);
  assert.ok(project(state, 0, -10).y > centre.y);
});

function expectAnchor(cam, anchor, point, message = 'picked surface point follows the pointer') {
  assert.ok(anchor, 'test must begin on the visible surface');
  const p = project(cameraState(cam, W, H), anchor.lon, anchor.lat);
  assert.ok(p, 'the picked surface point remains visible');
  assert.ok(Math.hypot(p.x - point.x, p.y - point.y) < 0.01, message);
}

test('screen picking round trips and anchoring preserves a world point at different altitudes', () => {
  for (const [z, x, y] of [[0.5, 800, 580], [0.65, 920, 650], [0.8, 850, 700]]) {
    const cam = camera(z);
    const anchor = screenToGeo(cam, W, H, x, y);
    expectAnchor(cam, anchor, { x, y });
    cam.z += 0.025;
    const destination = { x: x + 17, y: y + 9 };
    assert.ok(anchorCamera(cam, W, H, anchor, destination.x, destination.y));
    expectAnchor(cam, anchor, destination);
  }
});

test('dragging moves the surface in both axes without tilting the camera', () => {
  const cam = camera();
  const from = { x: 800, y: 650 }, to = { x: 840, y: 680 };
  const anchor = screenToGeo(cam, W, H, from.x, from.y);
  panCamera(cam, W, H, from, to);
  expectAnchor(cam, anchor, to);
  assert.notEqual(cam.lon, 10);
  assert.notEqual(cam.lat, 12);
  assert.equal(cam.pitchBias, 0);
});

test('wheel zoom keeps the picked world point stationary throughout easing and the horizon transition', () => {
  for (const z of [0.5, 0.65, 0.8]) {
    for (const delta of [-60, 60]) {
      const cam = camera(z), nav = navigation(cam);
      const point = { x: 800, y: 600 };
      const anchor = screenToGeo(cam, W, H, point.x, point.y);
      nav.wheel(point.x, point.y, delta);
      assert.equal(cam.z, z, 'ordinary zoom begins on the next animation frame');
      nav.step(1 / 60);
      assert.ok(delta < 0 ? cam.z > z : cam.z < z);
      expectAnchor(cam, anchor, point);
      settle(nav);
      expectAnchor(cam, anchor, point);
      assert.equal(nav.step(1 / 60), false, 'easing stops after reaching its target');
    }
  }
});

test('zero wheel input is inert and wheel magnitude and units determine the zoom amount', () => {
  let starts = 0, changes = 0;
  const cam = camera(), initial = { ...cam };
  const nav = navigation(cam, { onStart: () => starts++, onChange: () => changes++ });
  for (const mode of [0, 1, 2]) nav.wheel(800, 650, 0, mode);
  settle(nav);
  assert.deepEqual(cam, initial);
  assert.equal(starts, 0);
  assert.equal(changes, 0);

  const zoomAmount = (delta, mode = 0) => {
    const c = camera(), n = navigation(c);
    n.wheel(800, 650, delta, mode);
    settle(n);
    return initial.z - c.z;
  };
  assert.ok(zoomAmount(120) > zoomAmount(1) * 100, 'trackpad pixels must not act like full wheel ticks');
  assert.ok(Math.abs(zoomAmount(3, 1) - zoomAmount(48)) < 1e-10, 'line deltas use the same pixel scale');
  assert.ok(Math.abs(zoomAmount(0.1, 2) - zoomAmount(H * 0.1)) < 1e-10, 'page deltas use the view height');
});

test('either finger can pinch and moving the midpoint carries its picked surface point', () => {
  const cam = camera(), nav = navigation(cam);
  const anchor = screenToGeo(cam, W, H, 800, 650);
  nav.begin(1, 700, 650);
  nav.begin(2, 900, 650);
  assert.equal(nav.active, true);
  nav.move(1, 680, 650);
  const afterFirst = cam.z;
  assert.ok(afterFirst > 0.65, 'moving the first finger zooms');
  expectAnchor(cam, anchor, { x: 790, y: 650 });
  nav.move(2, 920, 650);
  assert.ok(cam.z > afterFirst, 'moving the second finger zooms');
  expectAnchor(cam, anchor, { x: 800, y: 650 });
});

test('lifting either finger hands the gesture to the remaining finger without a jump', () => {
  for (const lifted of [1, 2]) {
    const cam = camera(), nav = navigation(cam);
    nav.begin(1, 700, 650);
    nav.begin(2, 900, 650);
    nav.move(1, 680, 650);
    nav.move(2, 920, 650);
    nav.end(lifted);
    assert.equal(nav.active, true);
    const remaining = lifted === 1 ? 2 : 1;
    const x = remaining === 1 ? 680 : 920;
    const before = { ...cam };
    nav.move(remaining, x, 650);
    assert.ok(Math.abs(cam.lon - before.lon) < 1e-9);
    assert.ok(Math.abs(cam.lat - before.lat) < 1e-9);
    assert.equal(cam.z, before.z);
    const anchor = screenToGeo(cam, W, H, x, 650);
    nav.move(remaining, x + 12, 660);
    expectAnchor(cam, anchor, { x: x + 12, y: 660 });
    assert.equal(cam.z, before.z, 'the remaining finger pans instead of continuing the pinch');
    nav.end(remaining);
    assert.equal(nav.active, false);
  }
});

test('cancellation drops pointers, held keys, and unfinished zoom', () => {
  const cam = camera(), nav = navigation(cam);
  nav.begin(1, 700, 650);
  nav.begin(2, 900, 650);
  nav.key('right', true);
  nav.wheel(800, 650, -120);
  nav.clear();
  const before = { ...cam };
  nav.move(1, 650, 650);
  nav.move(2, 950, 650);
  assert.equal(nav.step(0.5), false);
  assert.equal(nav.active, false);
  assert.deepEqual(cam, before);
});

test('coincident touches and extreme navigation remain finite and within camera bounds', () => {
  const cam = camera(), nav = navigation(cam);
  nav.begin(1, 800, 650);
  nav.begin(2, 800, 650);
  for (const x of [800, 801, 807, 808, 820, 1100, 800]) nav.move(2, x, 650);
  nav.end(1);
  nav.end(2);
  for (const delta of [-1e9, 1e9]) {
    for (let i = 0; i < 20; i++) nav.wheel(800, 650, delta);
    settle(nav);
    assert.ok(cam.z >= 0 && cam.z <= 1);
    assert.ok(Math.abs(cam.lat) <= 89.5);
    assert.ok(Object.values(cam).every(Number.isFinite));
  }
  assert.equal(cam.z, 0, 'zoom-out saturates at its supported altitude');
  nav.key('up', true);
  nav.step(1000);
  nav.key('up', false);
  assert.equal(cam.lat, 89.5);
  assert.ok(Object.values(cam).every(Number.isFinite));
});

test('held keyboard navigation travels equally at different frame rates and stops on release', () => {
  const run = frames => {
    const cam = camera(), nav = navigation(cam);
    nav.key('right', true);
    nav.key('up', true);
    for (let i = 0; i < frames; i++) {
      nav.key('right', true); // Browser key repeat does not add extra movement.
      nav.step(1 / frames);
    }
    nav.key('right', false);
    nav.key('up', false);
    const stopped = { ...cam };
    assert.equal(nav.step(1), false);
    assert.deepEqual(cam, stopped);
    return cam;
  };
  const slow = run(30), fast = run(144);
  assert.ok(slow.lon > 10 && slow.lat > 12);
  assert.ok(Math.abs(slow.lon - fast.lon) < 1e-9);
  assert.ok(Math.abs(slow.lat - fast.lat) < 1e-9);
});

test('reduced motion applies zoom immediately with no remaining animation', () => {
  const cam = camera(), nav = navigation(cam, { reducedMotion: true });
  const point = { x: 800, y: 650 };
  const anchor = screenToGeo(cam, W, H, point.x, point.y);
  nav.wheel(point.x, point.y, -60);
  assert.ok(cam.z > 0.65);
  expectAnchor(cam, anchor, point);
  const settled = { ...cam };
  assert.equal(nav.step(1 / 60), false);
  assert.deepEqual(cam, settled);
});
