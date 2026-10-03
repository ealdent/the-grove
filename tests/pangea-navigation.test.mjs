import test from 'node:test';
import assert from 'node:assert/strict';
import {
  anchorCamera, cameraState, createNavigation, panCamera, project, rayHit, screenToGeo, sphereSpan, surfaceCellAngle,
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

test('the distant globe is centred and the zoomed limb leaves 20% space above the planet', () => {
  for (const [width, height] of [[W, H], [390, 840]]) {
    for (const z of [0, 0.3, 0.5, 0.65]) {
      const state = cameraState(camera(z), width, height);
      const centre = project(state, 10, 12);
      assert.ok(Math.hypot(centre.x - width / 2, centre.y - height / 2) < 1e-9);
      assert.equal(state.look, Math.PI / 2);
    }
    for (const z of [0.72, 0.8, 0.9, 1]) {
      const state = cameraState(camera(z), width, height);
      assert.ok(Math.abs(state.horizonY / height - 0.2) < 1e-12);
      assert.equal(rayHit(state, width / 2, height * 0.2 - 0.1).t, undefined);
      assert.ok(rayHit(state, width / 2, height * 0.2 + 0.1).t > 0);
    }
    let previous = cameraState(camera(0.5), width, height).horizonY;
    for (let z = 0.501; z <= 1; z += 0.001) {
      const next = cameraState(camera(z), width, height).horizonY;
      assert.ok(next <= previous + 1e-8, 'the limb rises smoothly without falling back down');
      assert.ok(previous - next < height * 0.003, 'the transition has no framing jump');
      previous = next;
    }
  }
});

test('the solid ocean silhouette matches sphere picking through globe and horizon views', () => {
  for (const [width, height] of [[W, H], [390, 840]]) {
    for (const z of [0, 0.5, 0.7, 0.8, 1]) {
      const state = cameraState(camera(z), width, height);
      for (let y = 0; y <= height; y += 13) {
        const span = sphereSpan(state, y);
        for (let x = 0; x <= width; x += 17) {
          const inside = Boolean(span && x > span.left && x < span.right);
          assert.equal(rayHit(state, x, y).t !== undefined, inside, `silhouette at ${z}, ${x}, ${y}`);
        }
      }
    }
  }
});

test('projected label elevation measures surface visibility rather than screen position', () => {
  const state = cameraState(camera(0.5), W, H);
  const north = project(state, 10, 42), south = project(state, 10, -18);
  assert.ok(Math.abs(north.elev - south.elev) < 1e-12, 'equally distant anchors fade equally');
  assert.ok(Math.abs(project(state, 10, 12).elev - 1) < 2e-8);
  const latitude = 12 - state.dip * 180 / Math.PI + 0.001;
  assert.ok(project(state, 10, latitude).elev < 0.001, 'near-limb labels fade at the physical horizon');
});

test('surface cell footprint shrinks with zoom so coastlines can gain detail', () => {
  let previous = 180;
  for (const z of [0, 0.5, 0.65, 0.8, 0.9, 1]) {
    const angle = surfaceCellAngle(cameraState(camera(z), W, H), 12);
    assert.ok(angle > 0 && angle < previous);
    previous = angle;
  }
  assert.ok(previous < 0.15, 'near-orbit glyphs require a finer geographic raster');
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
  for (const z of [0.5, 0.65, 0.7, 0.8, 0.95]) {
    for (const delta of [-60, 60]) {
      const cam = camera(z), nav = navigation(cam);
      const point = { x: 800, y: 550 };
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

test('unreachable limb and polar zoom anchors never override the required framing', () => {
  for (const initial of [{ ...camera(0.5) }, { ...camera(0.8), lat: 89 }]) {
    const cam = { ...initial }, nav = navigation(cam);
    nav.wheel(800, 600, 240);
    settle(nav);
    assert.equal(cam.pitchBias, 0);
    assert.ok(Object.values(cam).every(Number.isFinite));
    const state = cameraState(cam, W, H);
    if (cam.z >= 0.72) assert.ok(Math.abs(state.horizonY / H - 0.2) < 1e-12);
    else assert.ok(state.horizonY < H / 2, 'zoom-out retains a centred globe above its lower limb');
  }
  const cam = { ...camera(0.9), lat: 89 }, nav = navigation(cam);
  nav.wheel(800, 550, -120);
  settle(nav);
  assert.equal(cam.pitchBias, 0);
  assert.ok(Math.abs(cameraState(cam, W, H).horizonY / H - 0.2) < 1e-12);
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
