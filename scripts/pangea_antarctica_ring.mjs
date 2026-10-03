#!/usr/bin/env node
/* Derives the western half of Antarctica's coastline ring for pangea_fix_data.mjs.
 *
 * The generated atlas lost this ring (every longitude was clamped to 180 when it
 * was packed). The source is the CC BY 4.0 coastline shapefile in the Young et al.
 * (2019) Zenodo archive, record 10525370, file
 * Young_etal_2018_GeosciFrontiers.zip -> Coastlines/Global_coastlines_Young_et_al_low_res
 * which splits Antarctica at the dateline: one ring on plate 802 spans lon
 * 0.23..180 (already in the atlas) and one spans -180..0.23 (this one).
 *
 * The ring is Douglas-Peucker simplified to 0.18 degrees, the generator's own
 * tolerance, and printed as JSON for embedding.
 *
 * Usage: node scripts/pangea_antarctica_ring.mjs <path-without-extension>
 */
import { readFileSync } from 'node:fs';

const base = process.argv[2];
if (!base) { console.error('usage: pangea_antarctica_ring.mjs <shapefile path without extension>'); process.exit(1); }
const shp = readFileSync(base + '.shp'), dbf = readFileSync(base + '.dbf');

/* .dbf: fixed-width records, we only need PLATEID1 */
const nRec = dbf.readUInt32LE(4), hdrLen = dbf.readUInt16LE(8), recLen = dbf.readUInt16LE(10);
const fields = []; let off = 32;
while (dbf[off] !== 0x0d) { fields.push({ name: dbf.toString('ascii', off, off + 11).replace(/\0.*$/, ''), len: dbf[off + 16] }); off += 32; }
const plateOf = r => { let p = hdrLen + r * recLen + 1; for (const f of fields) { if (f.name === 'PLATEID1') return dbf.toString('ascii', p, p + f.len).trim(); p += f.len; } return ''; };

/* .shp: polygon records (type 5), parts of (x, y) doubles */
const rings = []; let p = 100, rec = 0;
while (p < shp.length) {
  const len = shp.readInt32BE(p + 4) * 2, type = shp.readInt32LE(p + 8);
  if (type === 5) {
    const nParts = shp.readInt32LE(p + 44), nPts = shp.readInt32LE(p + 48);
    const parts = []; for (let i = 0; i < nParts; i++) parts.push(shp.readInt32LE(p + 52 + i * 4));
    const q = p + 52 + nParts * 4;
    const pts = []; for (let i = 0; i < nPts; i++) pts.push([shp.readDoubleLE(q + i * 16), shp.readDoubleLE(q + i * 16 + 8)]);
    for (let k = 0; k < nParts; k++) rings.push({ plate: plateOf(rec), pts: pts.slice(parts[k], k + 1 < nParts ? parts[k + 1] : nPts) });
  }
  p += 8 + len; rec++;
}

const west = rings.filter(r => r.plate === '802' && r.pts.length > 100 &&
  Math.min(...r.pts.map(v => v[0])) < -179 && Math.max(...r.pts.map(v => v[0])) < 1 && Math.min(...r.pts.map(v => v[1])) < -89.9);
if (west.length !== 1) throw new Error(`expected one western Antarctic ring, found ${west.length}`);
let ring = west[0].pts;
if (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring = ring.slice(0, -1);

/* Douglas-Peucker on an open chain, in degrees, perpendicular distance */
function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const L = Math.hypot(bx - ax, by - ay) || 1e-12;
  let best = -1, bi = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const d = Math.abs((bx - ax) * (ay - y) - (ax - x) * (by - ay)) / L;
    if (d > best) { best = d; bi = i; }
  }
  if (best <= tol) return [pts[0], pts[pts.length - 1]];
  return dp(pts.slice(0, bi + 1), tol).slice(0, -1).concat(dp(pts.slice(bi), tol));
}
/* a closed ring: split at the vertex farthest from the start, simplify both halves */
let far = 0, fd = -1;
for (let i = 1; i < ring.length; i++) { const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]); if (d > fd) { fd = d; far = i; } }
const half1 = dp(ring.slice(0, far + 1), 0.18), half2 = dp(ring.slice(far).concat([ring[0]]), 0.18);
let out = half1.slice(0, -1).concat(half2.slice(0, -1));

/* keep every longitude step under 180 degrees so the rasteriser's unwrap cannot
 * flip the ring: insert a midpoint on any pole-edge segment that spans more */
const fixed = [];
for (let i = 0; i < out.length; i++) {
  const a = out[i], b = out[(i + 1) % out.length];
  fixed.push(a);
  if (Math.abs(b[0] - a[0]) >= 180) fixed.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
}
console.log(JSON.stringify(fixed.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)])));
console.error(`ring: ${ring.length} source vertices -> ${fixed.length} after 0.18 deg simplification`);
