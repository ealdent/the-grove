const D2R = Math.PI / 180;
export const FOV_Y = 55 * D2R;
const DIST_FAR = 42, DIST_NEAR = 1.045;
const MAX_LAT = 89.5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const wrapLon = v => ((v + 180) % 360 + 360) % 360 - 180;

export function cameraState(cam, W, H) {
  const dist = DIST_FAR * Math.pow(DIST_NEAR / DIST_FAR, cam.z);
  const dip = Math.acos(1 / dist);
  const hz = Math.atan(0.6 * Math.tan(FOV_Y / 2));
  // Keep the distant globe centred. As its limb reaches 20% from the top,
  // smoothly tilt below the limb so that further zoom leaves 80% planet below.
  // Looking above the limb (dip - hz) instead puts it near the screen's bottom.
  const tilt = Math.PI / 2 - (dip + hz), ease = 2 * D2R;
  const easedTilt = tilt <= -ease ? 0 : tilt >= ease ? tilt : (tilt + ease) ** 2 / (4 * ease);
  const look = clamp(Math.PI / 2 - easedTilt + cam.pitchBias * D2R, 0.015, Math.PI / 2);
  const la = cam.lat * D2R, lo = cam.lon * D2R, cl = Math.cos(la);
  const N = [cl * Math.cos(lo), cl * Math.sin(lo), Math.sin(la)];
  const Nth = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const Est = [-Math.sin(lo), Math.cos(lo), 0];
  const C = N.map(v => v * dist);
  const sl = Math.sin(look), cz = Math.cos(look);
  const zc = N.map((v, i) => -v * sl + Nth[i] * cz);
  const yc = N.map((v, i) => v * cz + Nth[i] * sl);
  const xc = Est;
  const tanY = Math.tan(FOV_Y / 2);
  return { W, H, dist, dip, look, C, zc, xc, yc, N, Nth, Est, tanY, tanX: tanY * W / H,
    horizonY: H / 2 * (1 - Math.tan(look - dip) / tanY),
    discPx: H / 2 * Math.tan(Math.asin(1 / dist)) / tanY };
}

// Exact perspective silhouette at a screen row. It shares the sphere/ray
// intersection used by glyphs, keeping a solid ocean base inside the limb.
export function sphereSpan(S, py) {
  const y = (1 - 2 * py / S.H) * S.tanY;
  const toward = -Math.sin(S.look) + y * Math.cos(S.look);
  const x2 = S.dist * S.dist / (S.dist * S.dist - 1) * toward * toward - 1 - y * y;
  if (toward >= 0 || x2 < 0) return null;
  const half = S.W / 2 * Math.sqrt(x2) / S.tanX;
  return { left: S.W / 2 - half, right: S.W / 2 + half };
}

export function surfaceCellAngle(S, cellH) {
  const a = rayHit(S, S.W / 2, (S.H - cellH) / 2);
  const b = rayHit(S, S.W / 2, (S.H + cellH) / 2);
  if (a.t === undefined || b.t === undefined) return 180;
  const cross = Math.hypot(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  return Math.atan2(cross, a.x * b.x + a.y * b.y + a.z * b.z) / D2R;
}

export function rayHit(S, px, py) {
  const ndcX = (2 * px / S.W - 1) * S.tanX;
  const ndcY = (1 - 2 * py / S.H) * S.tanY;
  let dx = S.zc[0] + S.xc[0] * ndcX + S.yc[0] * ndcY;
  let dy = S.zc[1] + S.xc[1] * ndcX + S.yc[1] * ndcY;
  let dz = S.zc[2] + S.xc[2] * ndcX + S.yc[2] * ndcY;
  const length = Math.hypot(dx, dy, dz);
  dx /= length; dy /= length; dz /= length;
  const dir = [dx, dy, dz];
  const b = S.C[0] * dx + S.C[1] * dy + S.C[2] * dz;
  const disc = b * b - (S.dist * S.dist - 1);
  if (disc < 0) return { dir };
  const t = -b - Math.sqrt(disc);
  if (t <= 0) return { dir };
  return { t, x: S.C[0] + t * dir[0], y: S.C[1] + t * dir[1], z: S.C[2] + t * dir[2], dir };
}

export function project(S, lon, lat) {
  const la = lat * D2R, lo = lon * D2R, cl = Math.cos(la);
  const p = [cl * Math.cos(lo), cl * Math.sin(lo), Math.sin(la)];
  if (p.reduce((sum, v, i) => sum + v * S.C[i], 0) <= 1.0000001) return null;
  const v = p.map((value, i) => value - S.C[i]);
  const depth = v.reduce((sum, value, i) => sum + value * S.zc[i], 0);
  if (depth <= 1e-6) return null;
  const ndcX = v.reduce((sum, value, i) => sum + value * S.xc[i], 0) / depth / S.tanX;
  const ndcY = v.reduce((sum, value, i) => sum + value * S.yc[i], 0) / depth / S.tanY;
  if (Math.abs(ndcX) > 1.4 || Math.abs(ndcY) > 1.4) return null;
  const facing = p.reduce((sum, value, i) => sum + value * S.N[i], 0);
  const elev = 1 - Math.acos(clamp(facing, 0, 1)) / S.dip;
  return { x: (ndcX + 1) * S.W / 2, y: (1 - ndcY) * S.H / 2, ndcX, ndcY, elev };
}

export function screenToGeo(cam, W, H, x, y) {
  const hit = rayHit(cameraState(cam, W, H), x, y);
  if (hit.t === undefined) return null;
  return { lon: Math.atan2(hit.y, hit.x) / D2R, lat: Math.asin(clamp(hit.z, -1, 1)) / D2R };
}

// The ray's local east/north/zenith coordinates do not depend on longitude or
// latitude. Solve their rotation analytically, rather than nudging the camera
// with a tangent approximation that slides the picked continent away.
export function anchorCamera(cam, W, H, anchor, x, y) {
  if (!anchor) return false;
  const S = cameraState(cam, W, H), hit = rayHit(S, x, y);
  if (hit.t === undefined) return false;
  const p = [hit.x, hit.y, hit.z];
  const dot = axis => p.reduce((sum, v, i) => sum + v * axis[i], 0);
  const a = dot(S.N), b = dot(S.Est), c = dot(S.Nth);
  const radius = Math.hypot(a, c), ratio = Math.sin(anchor.lat * D2R) / radius;
  if (!Number.isFinite(ratio) || Math.abs(ratio) > 1 + 1e-8) return false;
  const angle = Math.asin(clamp(ratio, -1, 1)), offset = Math.atan2(c, a);
  const candidates = [angle - offset, Math.PI - angle - offset].map(v => wrapLon(v / D2R))
    .filter(lat => Math.abs(lat) <= MAX_LAT)
    .map(lat => ({ lat, lon: wrapLon(anchor.lon - Math.atan2(b,
      a * Math.cos(lat * D2R) - c * Math.sin(lat * D2R)) / D2R) }));
  if (!candidates.length) return false;
  const cost = v => Math.abs(v.lat - cam.lat) + Math.abs(wrapLon(v.lon - cam.lon)) * Math.cos(cam.lat * D2R);
  candidates.sort((left, right) => cost(left) - cost(right));
  Object.assign(cam, candidates[0]);
  return true;
}

function degreesPerPixel(cam, W, H) {
  const S = cameraState(cam, W, H);
  return 2 * Math.atan((S.dist - 1) * S.tanY / H) / D2R;
}

export function panCamera(cam, W, H, from, to) {
  const anchor = screenToGeo(cam, W, H, from.x, from.y);
  if (anchorCamera(cam, W, H, anchor, to.x, to.y)) return;
  // A drag may start in space or leave the disc. Keep orbiting at the local
  // surface scale, rather than dropping the gesture at the limb.
  const gain = degreesPerPixel(cam, W, H);
  cam.lon = wrapLon(cam.lon - clamp((to.x - from.x) * gain, -45, 45));
  cam.lat = clamp(cam.lat + clamp((to.y - from.y) * gain, -45, 45), -MAX_LAT, MAX_LAT);
}

function zoomCamera(cam, W, H, z, anchor, point) {
  cam.z = clamp(z, 0, 1);
  // Anchor reachable surface points by orbiting, without changing the horizon
  // framing when a zoom-out or polar anchor cannot occupy the requested pixel.
  anchorCamera(cam, W, H, anchor, point.x, point.y);
}

export function createNavigation(cam, { size, onStart = () => {}, onChange = () => {}, reducedMotion = false }) {
  const pointers = new Map(), keys = new Set();
  let gesture = null, zoom = null;
  const view = () => {
    const pair = [...pointers.values()].slice(0, 2);
    if (!pair.length) return null;
    if (pair.length === 1) return { ...pair[0], distance: 0 };
    return { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2,
      distance: Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y) };
  };
  const beginControl = () => { zoom = null; onStart(); };
  function requestZoom(x, y, delta) {
    if (!Number.isFinite(delta) || delta === 0) return;
    onStart();
    const [W, H] = size();
    const samePoint = zoom && Math.hypot(zoom.point.x - x, zoom.point.y - y) < 1;
    zoom = { z: clamp((zoom?.z ?? cam.z) + delta, 0, 1), point: { x, y },
      anchor: samePoint ? zoom.anchor : screenToGeo(cam, W, H, x, y) };
    if (reducedMotion) { zoomCamera(cam, W, H, zoom.z, zoom.anchor, zoom.point); zoom = null; onChange(); }
  }
  return {
    get active() { return pointers.size > 0; },
    begin(id, x, y) {
      beginControl(); pointers.set(id, { x, y }); gesture = view();
    },
    move(id, x, y) {
      if (!pointers.has(id)) return;
      pointers.set(id, { x, y });
      const next = view(), [W, H] = size();
      if (gesture && next) {
        if (gesture.distance >= 8 && next.distance >= 8) {
          const anchor = screenToGeo(cam, W, H, gesture.x, gesture.y);
          zoomCamera(cam, W, H, cam.z + Math.log(next.distance / gesture.distance) * 0.5, anchor, next);
          if (!anchor) panCamera(cam, W, H, gesture, next);
        } else panCamera(cam, W, H, gesture, next);
        onChange();
      }
      gesture = next;
    },
    end(id) { pointers.delete(id); gesture = view(); },
    clear() { pointers.clear(); keys.clear(); gesture = null; zoom = null; },
    stop() { keys.clear(); zoom = null; },
    wheel(x, y, delta, mode = 0) {
      const pixels = delta * (mode === 1 ? 16 : mode === 2 ? size()[1] : 1);
      requestZoom(x, y, -clamp(pixels, -240, 240) * 0.00065);
    },
    zoomBy(factor) { const [W, H] = size(); requestZoom(W / 2, H / 2, -Math.log(factor) * 0.5); },
    key(key, down) {
      if (down && !keys.has(key)) { beginControl(); keys.add(key); }
      else if (!down) keys.delete(key);
    },
    step(dt) {
      const [W, H] = size();
      let changed = false;
      if (zoom) {
        const z = reducedMotion ? zoom.z : cam.z + (zoom.z - cam.z) * -Math.expm1(-dt / 0.075);
        const done = Math.abs(zoom.z - z) < 0.00001;
        zoomCamera(cam, W, H, done ? zoom.z : z, zoom.anchor, zoom.point);
        if (done) zoom = null;
        changed = true;
      }
      if (keys.size) {
        const speed = clamp(degreesPerPixel(cam, W, H) * H * 0.3, 0.05, 90) * dt;
        cam.lon = wrapLon(cam.lon + ((keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0)) * speed);
        cam.lat = clamp(cam.lat + ((keys.has('up') ? 1 : 0) - (keys.has('down') ? 1 : 0)) * speed, -MAX_LAT, MAX_LAT);
        if (zoom) zoom.anchor = screenToGeo(cam, W, H, zoom.point.x, zoom.point.y);
        changed = true;
      }
      if (changed) onChange();
      return changed;
    },
  };
}
