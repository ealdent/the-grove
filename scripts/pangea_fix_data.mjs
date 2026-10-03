#!/usr/bin/env node
/* Post-processes learn/pangea-plate-data.js (the generated plate atlas) in place.
 *
 * The original generator is not in this repo. Two of its outputs were wrong and
 * are corrected here, idempotently, so the file can be re-fixed after any regen:
 *
 * 1. Colour groups. The generator's continent assignment was scrambled: mainland
 *    Africa and western Europe shared one family, Madagascar sat with Arabia,
 *    the Philippines were "Africa", and Alaska and Chukotka were "Antarctica".
 *    Every polygon is re-keyed from its present-day centroid (plus the plate id
 *    for India/Sri Lanka and Arabia, whose polygons straddle the Himalaya and
 *    the Red Sea) into the ten families named in GROUPS.
 *
 * 2. The western half of Antarctica. The source shapefile splits the continent's
 *    main ring at the dateline. The generator packed the western half (plate 802,
 *    lon -180..0.23, Dronning Maud Land round to the Ronne grounding line and the
 *    pole) with every longitude clamped to 180, so it rasterised as a zero-area
 *    sliver and that whole sector, pole included, drew as sea. The ring is
 *    replaced with WEST_RING, derived from the same CC BY 4.0 shapefile by
 *    scripts/pangea_antarctica_ring.mjs (0.18 degree simplification, as the
 *    generator used for everything else).
 *
 * 3. Citations. The generator's header and SOURCE block cited the wrong paper
 *    and the wrong page range; both are corrected to the CrossRef records.
 *
 * Usage: node scripts/pangea_fix_data.mjs      (then: node --test tests/)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'learn', 'pangea-plate-data.js');
const src = readFileSync(FILE, 'utf8');

const B64S = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64 = Object.fromEntries([...B64S].map((c, i) => [c, i]));
const pair = (s, o) => B64[s[o]] * 64 + B64[s[o + 1]];
const unpack = (v, lo, span) => lo + (v / 4095) * span;
const pack = (v, lo, span) => { const q = Math.round(((v - lo) / span) * 4095); return B64S[q >> 6] + B64S[q & 63]; };

/* ---- present-day continent of a polygon, from its centroid (and plate) ---- */
export function continentOf(lon, lat, plate) {
  if (plate === '501' || plate === '502') return 5;            // India, with the Himalaya it carries; Sri Lanka
  if (plate === '503') return 6;                                // Arabia
  if (lat < -60) return 8;                                      // Antarctica
  if (lon >= 112 && lon <= 155 && lat >= -45 && lat <= -10) return 7;   // Australia, Tasmania
  if (lon < -140 && lat < 30 && lat > -10) return 9;            // Hawaii, the central Pacific
  if ((lon > 170 || lon < -160) && lat > 48 && lat < 56) return 0;      // the Aleutians
  if (lon >= -75 && lon < -32 && lat > 58) return 0;            // Greenland
  if (lon >= -172 && lon <= -50 && lat > 7) {                   // North America to Panama, the Caribbean
    if (lon > -77 && lat < 12) return 1;                        // Venezuela, Trinidad
    return 0;
  }
  if (lon >= -95 && lon <= -30 && lat >= -60 && lat <= 13) return 1;    // South America, Falklands, South Georgia
  if (lon >= -32 && lon < 60 && lat > 36) {                     // Europe to the Urals and the Caspian
    if (lon > 26 && lat < 42) return 4;                         // Anatolia, Iran
    return 3;
  }
  if (lon >= 12 && lon < 36 && lat > 34.5 && lat <= 36) return 3;       // Malta, Crete, Rhodes, Cyprus
  if (lon >= -26 && lon <= 52 && lat >= -36 && lat <= 36) {     // Africa, Madagascar, the Atlantic islands
    if (lon > 44.5 && lat > 29.5) return 4;                     // Iran, northern Iraq
    if (lon >= 34 && lat >= 13) return 6;                       // Arabia, the Levant
    return 2;
  }
  if (lon >= 66 && lon <= 92.5 && lat >= 5 && lat <= 31) return 5;      // India, Bangladesh
  if (lat > -10.5 && ((lon >= 92.5 && lon < 100 && lat < 28.5) || (lon >= 100 && lon <= 160 && lat < 22))) return 9;  // SE Asia, New Guinea
  if (((lon >= 26 && lon <= 180) || lon < -172) && lat > 10) return 4;  // Asia, Siberia, Chukotka
  return 9;                                                     // remaining islands (New Zealand, Pacific, Indian Ocean)
}

export const GROUP_NAMES = ['North America', 'South America', 'Africa', 'Europe', 'Asia',
  'India', 'Arabia', 'Australia', 'Antarctica', 'SE Asia / Pacific'];

/* Western Antarctic coastline ring, plate 802: output of pangea_antarctica_ring.mjs */
export const WEST_RING = [
  [0.233, -90], [-89.884, -90], [-180, -90], [-180, -84.429], [-178.296, -84.351], [-179.067, -84.253],
  [-167.043, -84.792], [-161.026, -85.495], [-151.476, -85.583], [-146.94, -85.173], [-139.348, -85.29], [-137.446, -85.068],
  [-143.081, -85], [-122.866, -84.09], [-114.136, -82.254], [-111.32, -83.14], [-103.33, -83.69], [-99.17, -84.6],
  [-96.592, -84.876], [-90.611, -84.885], [-84.32, -84.42], [-81.95, -83.95], [-81.99, -83.75], [-90.53, -83.63],
  [-92.67, -83.28], [-91.14, -82.79], [-92.38, -82.5], [-84.42, -82.22], [-86.23, -81.81], [-85.72, -81.61],
  [-76.95, -80.202], [-75.297, -80.822], [-74.876, -81.929], [-73.608, -81.844], [-72.159, -81.204], [-68.867, -81.264],
  [-71.725, -81.44], [-72.051, -81.66], [-71.53, -81.925], [-62.313, -82.906], [-62.743, -83.454], [-61.714, -83.733],
  [-59.885, -82.479], [-59.004, -82.646], [-59.277, -82.981], [-58.43, -83.01], [-55.705, -82.355], [-51.645, -81.839],
  [-42.938, -81.534], [-34.582, -80.207], [-31.98, -80.087], [-32.058, -80.398], [-30.667, -80.426], [-30.08, -80.041],
  [-30.769, -79.537], [-29.961, -79.281], [-36.343, -78.831], [-36.379, -78.347], [-35.401, -77.824], [-31.459, -77.219],
  [-31.773, -77.085], [-28.431, -76.429], [-28.856, -76.322], [-24.767, -75.758], [-22.721, -74.627], [-18.407, -73.536],
  [-12.084, -72.579], [-11.083, -71.905], [-12.323, -71.358], [-11.645, -71.268], [-10.99, -71.728], [-10.099, -71.12],
  [-10.481, -70.977], [-9.517, -70.931], [-9.69, -71.03], [-9.013, -71.202], [-8.451, -71.823], [-7.396, -71.69],
  [-7.769, -71.444], [-7.296, -71.085], [-7.683, -70.862], [-6.963, -70.693], [-5.819, -70.712], [-5.688, -70.972],
  [-6.211, -71.338], [-5.956, -71.423], [-3.037, -71.273], [-3.735, -71.106], [-3.384, -70.868], [-3.428, -70.424],
  [-2.988, -70.297], [-2.692, -70.425], [-3.175, -70.658], [-2.001, -70.827], [-2.568, -70.998], [-2.208, -71.473],
  [-1.02, -71.297], [-0.969, -71.591], [-0.457, -71.678], [0.233, -71.385],
];

/* ------------------------------------------------------------- the blob ---- */
const lines = src.split('\n');
const s = lines.findIndex(l => l.startsWith('export const COORD_BLOB ='));
let e = s + 1;
while (!lines[e].endsWith("';")) e++;
let blob = '';
for (let i = s + 1; i <= e; i++) {
  const m = lines[i].match(/^  '([^']*)'( \+|;)$/);
  if (!m) throw new Error(`unexpected blob line ${i + 1}`);
  blob += m[1];
}
const plateIds = JSON.parse(src.match(/export const PLATE_IDS = (\[[^\]]*\]);/)[1]);
const plateIndex = new Map(plateIds.map((id, i) => [id, i]));

const DEG = Math.PI / 180;
const westIdx = plateIndex.get('802');
const westRec = (() => {
  let r = B64S[8] + pack(westIdx, 0, 4095) + pack(WEST_RING.length, 0, 4095);
  for (const [lo, la] of WEST_RING) r += pack(lo, -180, 360) + pack(la, -90, 180);
  return r;
})();
let i = 0, polys = 0, points = 0, changed = 0, replaced = 0, rebuilt = '';
while (i < blob.length) {
  const plateI = pair(blob, i + 1), plate = plateIds[plateI];
  const count = pair(blob, i + 3);
  let sx = 0, sy = 0, sz = 0, clamped = 0;
  for (let k = 0; k < count; k++) {
    const o = i + 5 + k * 4;
    const lon = unpack(pair(blob, o), -180, 360), lat = unpack(pair(blob, o + 2), -90, 180);
    const cl = Math.cos(lat * DEG);
    sx += cl * Math.cos(lon * DEG); sy += cl * Math.sin(lon * DEG); sz += Math.sin(lat * DEG);
    if (Math.abs(lon - 180) < 0.3 || Math.abs(lon - 0.22) < 0.3) clamped++;
  }
  const rec = blob.slice(i, i + 5 + count * 4);
  i += 5 + count * 4;
  /* the clamped western ring: plate 802, every vertex on lon 180 or lon 0.22 */
  if (plate === '802' && count > 50 && clamped === count) { rebuilt += westRec; replaced++; polys++; points += WEST_RING.length; continue; }
  const lon = Math.atan2(sy, sx) / DEG, lat = Math.atan2(sz, Math.hypot(sx, sy)) / DEG;
  const g = continentOf(lon, lat, plate);
  if (rec[0] !== B64S[g]) changed++;
  rebuilt += B64S[g] + rec.slice(1);
  polys++; points += count;
}
blob = rebuilt;

/* --------------------------------------------------------- write it back ---- */
const out = [];
for (let o = 0; o < blob.length; o += 108) {
  const chunk = blob.slice(o, o + 108);
  out.push(`  '${chunk}'${o + 108 < blob.length ? ' +' : ';'}`);
}
lines.splice(s + 1, e - s, ...out);
let text = lines.join('\n');

text = text.replace(/export const GROUPS = \[[\s\S]*?\];/,
  'export const GROUPS = [\n' + GROUP_NAMES.map((n, k) => `  { id: ${k}, name: ${JSON.stringify(n)} },`).join('\n') + '\n];');
text = text.replace(/\/\* 11 colour families, in the order used by the first character of each polygon \*\//,
  '/* 10 colour families, keyed by the first character of each polygon; assigned by\n * present-day centroid in scripts/pangea_fix_data.mjs */');
text = text.replace(/export const STATS = \{[^}]*\};/,
  `export const STATS = { plates: ${plateIds.length}, polygons: ${polys}, points: ${points}, times: ${(src.match(/export const TIMES = \[([^\]]*)\]/)[1].split(',')).length} };`);

/* ----------------------------------------------- citation corrections ---- */
/* The generator cited the wrong paper: 10.1016/j.gsf.2017.11.003 is an unrelated
 * zircon study. The model is Young et al. (2019), Geoscience Frontiers 10(3),
 * 989-1013, 10.1016/j.gsf.2018.05.011 (checked against CrossRef, 2026-10-02). */
const CITES = [
  [/Muller, D\. \(2018\), "Global kinematics/, 'Muller, D. (2019), "Global kinematics'],
  [/subduction zones since the late Paleozoic Era", Geoscience Frontiers 9\(1\),\n \*   199-270\.  https:\/\/doi\.org\/10\.1016\/j\.gsf\.2017\.11\.003/,
    'subduction zones since the late Paleozoic Era", Geoscience Frontiers 10(3),\n *   989-1013.  https://doi.org/10.1016/j.gsf.2018.05.011'],
  [/citation: 'Young et al\. \(2018\), Geoscience Frontiers 9\(1\), 199-270'/, "citation: 'Young et al. (2019), Geoscience Frontiers 10(3), 989-1013'"],
  [/doi: 'https:\/\/doi\.org\/10\.1016\/j\.gsf\.2017\.11\.003'/, "doi: 'https://doi.org/10.1016/j.gsf.2018.05.011'"],
  [/Annu\. Rev\. Earth Planet\. Sci\. 44, 423-452/, 'Annu. Rev. Earth Planet. Sci. 44, 107-138'],
];
for (const [re, to] of CITES) text = text.replace(re, to);

/* An earlier partial fix patched the colour families at decode time with a
 * per-plate override map; the data is now correct at source, so drop it. */
text = text.replace(/\n\/\* Correct regional colour classifications[\s\S]*?export const COLOR_GROUP_OVERRIDES = \{[\s\S]*?\};\n/, '\n');

writeFileSync(FILE, text);
console.log(`polygons ${polys}, points ${points}, regrouped ${changed}, western Antarctic ring ${replaced ? 'replaced' : 'already in place'}`);
