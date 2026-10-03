/*  PANGEA ENGINE
 *  Reconstruction, rasterising and ASCII rasterising for the "Pangaea to
 *  Present" atlas.  Pure logic, no DOM, so the science can be tested headlessly
 *  (tests/pangea-engine.test.mjs).
 *
 *  Data provenance: Young, A., Flament, N., Maloney, K., Williams, S.,
 *  Matthews, K., Zahirovic, S. & Muller, D. (2018), "Global kinematics of
 *  tectonic plates and subduction zones since the late Paleozoic Era",
 *  Geoscience Frontiers 9(1) 199-270, CC BY 4.0, Zenodo 10525370.  Full citation
 *  and the exact rotation convention are in pangea-plate-data.js.
 *
 *  THE ONE THING TO READ BEFORE TRUSTING THIS FILE
 *  ---------------------------------------------
 *  Rotations are stored RELATIVE TO AFRICA (plate 701, held at its present
 *  position).  Applying a plate's composed matrix to a present-day coordinate
 *  yields that coordinate's position at time t, with Africa exactly where it is
 *  today.  Times are Ma before present; 0 is the present day.
 */

import { TIMES, PLATE_IDS, COORD_BLOB, ROT_BLOB, GROUPS, LABELS, STATS } from './pangea-plate-data.js';

const DEG = Math.PI / 180;
const B64 = new Int16Array(128).fill(-1);
'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  .split('').forEach((c, i) => { B64[c.charCodeAt(0)] = i; });

const b64pair = (s, off) => B64[s.charCodeAt(off)] * 64 + B64[s.charCodeAt(off + 1)];
const unpack = (v, lo, span) => lo + (v / 4095) * span;

/* ------------------------------------------------------------------ decode */

export function decodeAtlas() {
  const plateIndex = new Map();
  PLATE_IDS.forEach((id, i) => plateIndex.set(id, i));

  /* polygons: <1 group><2 plate><2 count> then <2 lon><2 lat> per vertex */
  const polys = [];
  let i = 0;
  while (i < COORD_BLOB.length) {
    const group = B64[COORD_BLOB.charCodeAt(i)];
    const plate = b64pair(COORD_BLOB, i + 1);
    const count = b64pair(COORD_BLOB, i + 3);
    i += 5;
    const pts = new Float32Array(count * 2);
    for (let k = 0; k < count; k++) {
      pts[k * 2] = unpack(b64pair(COORD_BLOB, i), -180, 360);
      pts[k * 2 + 1] = unpack(b64pair(COORD_BLOB, i + 2), -90, 180);
      i += 4;
    }
    if (count >= 3) polys.push({ group, plate, pts });
  }

  /* unit vectors, so deformation is 9 multiplies per vertex */
  const polyVert = new Int32Array(polys.length + 1);
  let total = 0;
  for (const p of polys) total += p.pts.length >> 1;
  const vertXYZ = new Float64Array(total * 3);
  let w = 0;
  for (let pi = 0; pi < polys.length; pi++) {
    polyVert[pi] = w;
    const pts = polys[pi].pts;
    for (let k = 0; k < pts.length; k += 2) {
      const la = pts[k + 1] * DEG, lo = pts[k] * DEG, cl = Math.cos(la);
      vertXYZ[w * 3] = cl * Math.cos(lo);
      vertXYZ[w * 3 + 1] = cl * Math.sin(lo);
      vertXYZ[w * 3 + 2] = Math.sin(la);
      w++;
    }
  }
  polyVert[polys.length] = w;

  /* rotations as unit quaternions, one per (plate, sample time) */
  const nP = PLATE_IDS.length, nT = TIMES.length;
  const rotQ = new Float64Array(nP * nT * 4);
  for (let pi = 0; pi < nP; pi++) {
    const s = ROT_BLOB[PLATE_IDS[pi]];
    for (let t = 0; t < nT; t++) {
      const o = t * 6;
      const lon = unpack(b64pair(s, o), -180, 360) * DEG;
      const lat = unpack(b64pair(s, o + 2), -90, 180) * DEG;
      const ang = unpack(b64pair(s, o + 4), -180, 360) * DEG;
      const cla = Math.cos(lat), h = Math.sin(ang / 2);
      const b = (pi * nT + t) * 4;
      rotQ[b] = Math.cos(ang / 2);
      rotQ[b + 1] = cla * Math.cos(lon) * h;
      rotQ[b + 2] = cla * Math.sin(lon) * h;
      rotQ[b + 3] = Math.sin(lat) * h;
    }
  }

  return {
    times: TIMES,
    minMa: TIMES[0],
    maxMa: TIMES[nT - 1],
    groups: GROUPS,
    stats: STATS,
    plateIndex,
    plateIds: PLATE_IDS,
    labels: LABELS.map(l => ({ ...l, plateIndex: plateIndex.has(l.plate) ? plateIndex.get(l.plate) : -1 })),
    polys,
    polyVert,
    vertXYZ,
    rotQ,
    nTimes: nT,
  };
}

/* -------------------------------------------------------------- rotations */

/** Quaternion slerp between the bracketing sample times, to a row-major 3x3. */
export function rotationAt(atlas, plate, ma, out) {
  const nT = atlas.nTimes, ts = atlas.times;
  if (plate < 0) { out.fill(0); out[0] = out[4] = out[8] = 1; return out; }
  const t = Math.max(ts[0], Math.min(ts[nT - 1], ma));
  let i = 0;
  while (i < nT - 2 && ts[i + 1] < t) i++;
  const span = ts[i + 1] - ts[i];
  const f = span > 0 ? (t - ts[i]) / span : 0;
  const Q = atlas.rotQ, b0 = (plate * nT + i) * 4, b1 = (plate * nT + i + 1) * 4;
  let w1 = Q[b1], x1 = Q[b1 + 1], y1 = Q[b1 + 2], z1 = Q[b1 + 3];
  const w0 = Q[b0], x0 = Q[b0 + 1], y0 = Q[b0 + 2], z0 = Q[b0 + 3];
  let d = w0 * w1 + x0 * x1 + y0 * y1 + z0 * z1;
  if (d < 0) { w1 = -w1; x1 = -x1; y1 = -y1; z1 = -z1; d = -d; }
  let w, x, y, z;
  if (d > 0.9995) {
    w = w0 + (w1 - w0) * f; x = x0 + (x1 - x0) * f;
    y = y0 + (y1 - y0) * f; z = z0 + (z1 - z0) * f;
    const n = Math.hypot(w, x, y, z) || 1;
    w /= n; x /= n; y /= n; z /= n;
  } else {
    const th0 = Math.acos(d), th = th0 * f;
    const s0 = Math.sin(th0 - th) / Math.sin(th0);
    const s1 = Math.sin(th) / Math.sin(th0);
    w = w0 * s0 + w1 * s1; x = x0 * s0 + x1 * s1;
    y = y0 * s0 + y1 * s1; z = z0 * s0 + z1 * s1;
  }
  out[0] = 1 - 2 * (y * y + z * z); out[1] = 2 * (x * y - w * z); out[2] = 2 * (x * z + w * y);
  out[3] = 2 * (x * y + w * z); out[4] = 1 - 2 * (x * x + z * z); out[5] = 2 * (y * z - w * x);
  out[6] = 2 * (x * z - w * y); out[7] = 2 * (y * z + w * x); out[8] = 1 - 2 * (x * x + y * y);
  return out;
}

const _m = new Float64Array(9);

/** Where does (lon, lat) sit at time ma, on the given plate? */
export function placePoint(atlas, plate, lon, lat, ma, out) {
  rotationAt(atlas, plate, ma, _m);
  const la = lat * DEG, lo = lon * DEG, cl = Math.cos(la);
  const x = cl * Math.cos(lo), y = cl * Math.sin(lo), z = Math.sin(la);
  const X = _m[0] * x + _m[1] * y + _m[2] * z;
  const Y = _m[3] * x + _m[4] * y + _m[5] * z;
  const Z = _m[6] * x + _m[7] * y + _m[8] * z;
  out[0] = Math.atan2(Y, X) / DEG;
  out[1] = Math.asin(Z < -1 ? -1 : Z > 1 ? 1 : Z) / DEG;
  return out;
}

/** Total angular separation, in degrees, of two points on a sphere. */
export function angularDistance(lon1, lat1, lon2, lat2) {
  const p1 = lat1 * DEG, p2 = lat2 * DEG, dl = (lon2 - lon1) * DEG;
  const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h))) / DEG;
}

/* ----------------------------------------------------------- land raster */

const D1 = 1, D2 = 1.4142135, BIG = 1e6;

export class Land {
  constructor(atlas, res = 0.4) {
    this.atlas = atlas;
    this._m = new Float64Array(9);
    this._lon = new Float64Array(8192);
    this._lat = new Float64Array(8192);
    this._xs = new Float64Array(8192);
    this.ma = NaN;
    this.setResolution(res);
  }

  setResolution(res) {
    this.res = res;
    this.w = Math.round(360 / res);
    this.h = Math.round(180 / res);
    this.group = new Uint8Array(this.w * this.h);
    this.dist = new Float32Array(this.w * this.h);
    this.ma = NaN;
  }

  /** Rasterise every coastline ring at time `ma` (Ma before present). */
  rasterize(ma) {
    if (ma === this.ma) return false;
    this.ma = ma;
    const { w, h, res, group, _m: m } = this;
    const atlas = this.atlas;
    const { vertXYZ, polyVert, polys } = atlas;
    group.fill(0);
    for (let pi = 0; pi < polys.length; pi++) {
      const n = polyVert[pi + 1] - polyVert[pi];
      rotationAt(atlas, polys[pi].plate, ma, m);
      const lon = this._lon, lat = this._lat;
      let prev = 0, minLa = 90, maxLa = -90;
      for (let k = 0; k < n; k++) {
        const o = (polyVert[pi] + k) * 3;
        const x = m[0] * vertXYZ[o] + m[1] * vertXYZ[o + 1] + m[2] * vertXYZ[o + 2];
        const y = m[3] * vertXYZ[o] + m[4] * vertXYZ[o + 1] + m[5] * vertXYZ[o + 2];
        const z = m[6] * vertXYZ[o] + m[7] * vertXYZ[o + 1] + m[8] * vertXYZ[o + 2];
        const nl = Math.atan2(y, x) / DEG;
        const nb = Math.asin(z < -1 ? -1 : z > 1 ? 1 : z) / DEG;
        if (k === 0) lon[0] = nl;
        else {
          let d = nl - prev;
          if (d > 180) d -= 360; else if (d < -180) d += 360;
          lon[k] = prev + d;
        }
        prev = lon[k];
        lat[k] = nb;
        if (nb < minLa) minLa = nb;
        if (nb > maxLa) maxLa = nb;
      }
      if (maxLa < -89.6 || minLa > 89.6) continue;
      const g = polys[pi].group + 1;
      const y0 = Math.max(0, Math.floor((90 - maxLa) / res));
      const y1 = Math.min(h - 1, Math.floor((90 - minLa) / res));
      for (let j = y0; j <= y1; j++) {
        const yc = 90 - (j + 0.5) * res;
        const xs = this._xs;
        let c = 0;
        for (let i = 0; i < n; i++) {
          const i2 = i + 1 === n ? 0 : i + 1;
          const la = lat[i], lb = lat[i2];
          if ((la > yc) === (lb > yc)) continue;
          xs[c++] = lon[i] + ((yc - la) / (lb - la)) * (lon[i2] - lon[i]);
        }
        if (c < 2) continue;
        const s = xs.subarray(0, c);
        s.sort();
        for (let q = 0; q + 1 < c; q += 2) {
          let i0 = Math.floor((s[q] + 180) / res);
          const i1 = Math.ceil((s[q + 1] + 180) / res);
          for (let i = i0; i < i1; i++) {
            const xc = (i - 0.5) * res - 180;
            if (xc >= s[q] && xc <= s[q + 1]) group[j * w + (((i % w) + w) % w)] = g;
          }
        }
      }
    }
    this.buildDistance();
    return true;
  }

  /** Two-pass chamfer distance transform: cells to the nearest land cell. */
  buildDistance() {
    const { w, h, group, dist } = this;
    for (let i = 0; i < dist.length; i++) dist[i] = group[i] ? 0 : BIG;
    for (let j = 0; j < h; j++) {
      const row = j * w, up = row - w;
      for (let i = 0; i < w; i++) {
        let d = dist[row + i];
        if (d === 0) continue;
        if (j > 0) {
          if (dist[up + i] + D1 < d) d = dist[up + i] + D1;
          if (i > 0 && dist[up + i - 1] + D2 < d) d = dist[up + i - 1] + D2;
          if (dist[up + ((i + 1) % w)] + D2 < d) d = dist[up + ((i + 1) % w)] + D2;
        }
        if (i > 0 && dist[row + i - 1] + D1 < d) d = dist[row + i - 1] + D1;
        if (dist[row + ((i + 1) % w)] + D1 < d) d = dist[row + ((i + 1) % w)] + D1;
        dist[row + i] = d;
      }
    }
    for (let j = h - 1; j >= 0; j--) {
      const row = j * w, dn = row + w;
      for (let i = w - 1; i >= 0; i--) {
        let d = dist[row + i];
        if (d === 0) continue;
        if (j < h - 1) {
          if (dist[dn + i] + D1 < d) d = dist[dn + i] + D1;
          if (i > 0 && dist[dn + i - 1] + D2 < d) d = dist[dn + i - 1] + D2;
          if (dist[dn + ((i + 1) % w)] + D2 < d) d = dist[dn + ((i + 1) % w)] + D2;
        }
        if (i < w - 1 && dist[row + i + 1] + D1 < d) d = dist[row + i + 1] + D1;
        if (dist[row + ((i - 1 + w) % w)] + D1 < d) d = dist[row + ((i - 1 + w) % w)] + D1;
        dist[row + i] = d;
      }
    }
  }

  index(lon, lat) {
    let i = Math.floor((lon + 180) / this.res);
    i = ((i % this.w) + this.w) % this.w;
    const j = Math.min(this.h - 1, Math.max(0, Math.floor((90 - lat) / this.res)));
    return j * this.w + i;
  }

  groupAt(lon, lat) { return lat > 90 || lat < -90 ? 0 : this.group[this.index(lon, lat)]; }
  distAt(lon, lat) { return lat > 90 || lat < -90 ? 0 : this.dist[this.index(lon, lat)]; }

  /** Fraction of the sphere (0..1) that is land at the current time. */
  landFraction() {
    let n = 0;
    for (let i = 0; i < this.group.length; i++) if (this.group[i]) n++;
    return n / this.group.length;
  }
}
