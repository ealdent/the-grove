import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  decodeAtlas, rotationAt, placePoint, angularDistance, Land,
} from '../learn/pangea-engine.js';
import { SOURCE, STATS, PLATE_IDS, GROUPS } from '../learn/pangea-plate-data.js';

const atlas = decodeAtlas();
const plate = id => atlas.plateIndex.get(id);
const at = (id, lon, lat, ma) => placePoint(atlas, plate(id), lon, lat, ma, [0, 0]).slice();
const netAngle = (id, ma) => {
  const m = new Float64Array(9);
  rotationAt(atlas, plate(id), ma, m);
  const tr = m[0] + m[4] + m[8];
  return Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2))) * 180 / Math.PI;
};
const TIMES = [0, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250];

/* ============================================================ the container */

test('the atlas decodes completely and every polygon is well formed', () => {
  assert.equal(atlas.polys.length, STATS.polygons);
  assert.equal(atlas.plateIds.length, STATS.plates);
  assert.equal(atlas.nTimes, STATS.times);
  let verts = 0;
  for (const p of atlas.polys) {
    assert.ok(p.pts.length >= 6, 'polygon needs at least 3 vertices');
    assert.ok(Number.isInteger(p.group) && p.group >= 0 && p.group < atlas.groups.length,
      `polygon group ${p.group} needs a distinct land colour family`);
    assert.equal(plate(PLATE_IDS[p.plate]), p.plate, 'polygon plate index in range');
    for (let k = 0; k < p.pts.length; k += 2) {
      assert.ok(p.pts[k] >= -180.01 && p.pts[k] <= 180.01, 'lon in range');
      assert.ok(p.pts[k + 1] >= -90.01 && p.pts[k + 1] <= 90.01, 'lat in range');
      verts++;
    }
  }
  assert.equal(verts, STATS.points);
});

test('every label anchor is attached to a plate the dataset knows about', () => {
  assert.ok(atlas.labels.length >= 25);
  for (const l of atlas.labels) {
    assert.ok(atlas.plateIndex.has(l.plate), `label ${l.name} -> unknown plate ${l.plate}`);
    assert.ok(l.plateIndex >= 0, `label ${l.name} did not resolve to a plate index`);
  }
});

test('every label stays inside its assigned plate coastline throughout reconstruction', () => {
  // Work in the polygon's original geographic coordinates, keeping polygons
  // that cross the date line continuous around the point being checked.
  const wrap = lon => ((lon + 180) % 360 + 360) % 360 - 180;
  const contains = (polygon, lon, lat) => {
    const points = polygon.pts, n = points.length / 2;
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const ax = wrap(points[i * 2] - lon), ay = points[i * 2 + 1];
      const bx = wrap(points[j * 2] - lon), by = points[j * 2 + 1];
      if ((ay > lat) !== (by > lat) && 0 < ax + (bx - ax) * (lat - ay) / (by - ay)) {
        inside = !inside;
      }
    }
    return inside;
  };
  const degrees = Math.PI / 180;
  const rotation = new Float64Array(9);
  for (const label of atlas.labels) {
    const polygons = atlas.polys.filter(p => p.plate === label.plateIndex);
    assert.ok(polygons.some(p => contains(p, label.lon, label.lat)),
      `${label.name} is outside the coastlines of its assigned plate ${label.plate}`);
    for (const ma of atlas.times) {
      const [lon, lat] = placePoint(atlas, label.plateIndex, label.lon, label.lat, ma, [0, 0]);
      const point = [Math.cos(lat * degrees) * Math.cos(lon * degrees),
        Math.cos(lat * degrees) * Math.sin(lon * degrees), Math.sin(lat * degrees)];
      rotationAt(atlas, label.plateIndex, ma, rotation);
      // Invert the rigid plate rotation to check the reconstructed anchor
      // against its actual coastline, rather than another fragment's colour.
      const local = [0, 1, 2].map(k => point[0] * rotation[k]
        + point[1] * rotation[k + 3] + point[2] * rotation[k + 6]);
      const localLon = Math.atan2(local[1], local[0]) / degrees;
      const localLat = Math.asin(Math.max(-1, Math.min(1, local[2]))) / degrees;
      assert.ok(polygons.some(p => contains(p, localLon, localLat)),
        `${label.name} left its plate coastline at ${ma} Ma`);
    }
  }
});

test('land under named regions uses the corresponding legend colour family', () => {
  const land = new Land(atlas, 0.2);
  land.rasterize(0);
  const families = {
    Africa: 'Africa', Madagascar: 'Africa', Sahara: 'Africa', Congo: 'Africa',
    Beringia: 'Asia', 'New Zealand': 'SE Asia / Pacific',
    Antarctica: 'Antarctica', Japan: 'Asia', Indonesia: 'SE Asia / Pacific',
    Europe: 'Europe', Iberia: 'Europe', 'British Isles': 'Europe', Siberia: 'Asia',
    India: 'India', Himalaya: 'India', Arabia: 'Arabia', Greenland: 'North America',
  };
  for (const [name, family] of Object.entries(families)) {
    const label = atlas.labels.find(l => l.name === name);
    const position = placePoint(atlas, label.plateIndex, label.lon, label.lat, 0, [0, 0]);
    const group = land.groupAt(...position);
    assert.ok(group > 0, `${name}'s visible anchor must be on land`);
    assert.equal(atlas.groups[group - 1].name, family, `${name}'s land colour must match its legend`);
  }
});

/* ==================================================== the load-bearing math */

test('at 0 Ma the reconstruction IS the modern world, identically', () => {
  // Every stored rotation is relative to Africa and normalised to identity at
  // 0 Ma, so this single invariant underwrites the whole file: if it drifts,
  // nothing else on the page can be trusted.
  const m = new Float64Array(9);
  for (const id of PLATE_IDS) {
    rotationAt(atlas, plate(id), 0, m);
    for (let k = 0; k < 9; k++) {
      const want = k % 4 === 0 ? 1 : 0;
      assert.ok(Math.abs(m[k] - want) < 0.02, `plate ${id} element ${k} = ${m[k]}`);
    }
  }
});

test('every reconstruction is a proper rotation: orthonormal with det +1', () => {
  const m = new Float64Array(9);
  for (const id of ['101', '201', '501', '802', '801', '301', '401', '102', '702', '304', '615']) {
    for (const ma of [0, 17, 50, 100, 200, 250]) {
      rotationAt(atlas, plate(id), ma, m);
      const det = m[0] * (m[4] * m[8] - m[5] * m[7])
        - m[1] * (m[3] * m[8] - m[5] * m[6])
        + m[2] * (m[3] * m[7] - m[4] * m[6]);
      assert.ok(Math.abs(det - 1) < 1e-6, `${id} @ ${ma}Ma det=${det}`);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        let dot = 0;
        for (let k = 0; k < 3; k++) dot += m[r * 3 + k] * m[c * 3 + k];
        assert.ok(Math.abs(dot - (r === c ? 1 : 0)) < 1e-6, `${id} @ ${ma}Ma r${r}c${c}`);
      }
    }
  }
});

test('plates stay rigid: intra-plate distances never change with time', () => {
  // Rigid plate motion is the premise of the whole model. A wrong slerp branch,
  // a broken matrix composition or a mis-packed rotation all show up here.
  const pairs = [
    ['101', -122, 37, -71, 42], ['201', -70, -18, -40, -25],
    ['501', 68, 24, 80, 10], ['802', 0, -80, 150, -70],
    ['801', 113, -22, 153, -38], ['301', 10, 55, 130, 50],
  ];
  for (const [id, lo1, la1, lo2, la2] of pairs) {
    const d0 = angularDistance(lo1, la1, lo2, la2);
    for (const ma of [1, 25, 60, 120, 250]) {
      const a = at(id, lo1, la1, ma), b = at(id, lo2, la2, ma);
      const d = angularDistance(a[0], a[1], b[0], b[1]);
      assert.ok(Math.abs(d - d0) < 0.05, `${id} @ ${ma}Ma: ${d} vs ${d0}`);
    }
  }
});

/* =============================================== the geological story, tested */

test('Africa is the reference plate and does not move', () => {
  for (const [lon, lat] of [[31.2, 30], [18.4, -34], [-17.5, 14.7], [45, 5], [2, 22]]) {
    const p = at('701', lon, lat, 250);
    assert.ok(angularDistance(lon, lat, p[0], p[1]) < 0.3, `Africa moved to ${p}`);
  }
});

test('every major plate accumulates divergence from Africa monotonically', () => {
  // The finite rotation of a plate relative to Africa must grow without
  // reversing as you go back in time. A sign error, a wrong Euler branch or a
  // mis-resolved parent plate all produce a reversal here.
  for (const [id, name] of [['101', 'N America'], ['201', 'S America'], ['501', 'India'],
    ['802', 'Antarctica'], ['801', 'Australia'], ['301', 'Eurasia'], ['401', 'Siberia']]) {
    let prev = -1;
    for (const ma of TIMES) {
      const a = netAngle(id, ma);
      assert.ok(a >= prev - 1e-6, `${name} divergence reversed at ${ma}Ma (${a} < ${prev})`);
      prev = a;
    }
    assert.ok(netAngle(id, 250) > 40, `${name} total divergence only ${netAngle(id, 250).toFixed(1)} deg`);
    assert.ok(netAngle(id, 250) < 100, `${name} total divergence ${netAngle(id, 250).toFixed(1)} deg is implausible`);
  }
});

test('North America closes the Central Atlantic to the Pangaea fit', () => {
  // Checked against the published Young et al. (2018) animation: at 200 Ma the
  // east coast of North America sits against the west margin of Africa.
  // net rotation monotonicity is asserted in the previous test; here we only
  // check the arrival geometry, allowing a hair of slack where it saturates
  let prev = -1;
  for (const ma of TIMES) {
    const d = angularDistance(-71, 42.4, ...at('101', -71, 42.4, ma));
    assert.ok(d > prev - 0.5, `NA divergence reversed at ${ma}Ma (${d.toFixed(2)} <= ${prev.toFixed(2)})`);
    prev = d;
  }
  const b200 = at('101', -71, 42.4, 200);
  assert.ok(angularDistance(-18, 24, b200[0], b200[1]) < 4,
    `Boston should be at ~(-18, 24) at 200 Ma, got (${b200.map(v => v.toFixed(1))})`);
  // and it must arrive by going EAST, not west
  assert.ok(b200[0] > -30, 'North America must move east going back in time');
  // Greenland rides with North America, not with Europe
  const gr = at('102', -42, 72, 200);
  const na = at('101', -76, 37, 200);
  assert.ok(angularDistance(gr[0], gr[1], na[0], na[1]) < 35,
    'Greenland should stay with North America at 200 Ma');
});

test('the supercontinent is assembled at 250 Ma and is not today', () => {
  // Compactness measured on the label anchors: mean angular distance from each
  // continent to Africa. Pangaea is one cluster; the modern world is not.
  const names = ['North America', 'South America', 'Africa', 'Europe', 'Asia',
    'India', 'Australia', 'Antarctica', 'Greenland'];
  const labs = names.map(n => atlas.labels.find(l => l.name === n));
  assert.ok(labs.every(Boolean), 'all compactness anchors present');
  const spread = ma => {
    const pos = labs.map(l => placePoint(atlas, l.plateIndex, l.lon, l.lat, ma, [0, 0]).slice());
    const afr = pos[names.indexOf('Africa')];
    let s = 0;
    pos.forEach((p, i) => { if (i !== names.indexOf('Africa')) s += angularDistance(p[0], p[1], afr[0], afr[1]); });
    return s / pos.length;
  };
  const panga = spread(250), now = spread(0);
  assert.ok(panga < 55, `Pangaea should be tightly assembled, spread ${panga.toFixed(1)} deg`);
  assert.ok(now > 65, `the modern world should be dispersed, spread ${now.toFixed(1)} deg`);
  assert.ok(panga < now - 15, `Pangaea (${panga.toFixed(1)}) must be far tighter than today (${now.toFixed(1)})`);
  // and it opens up as the Atlantic widens (a continent can drift a degree
  // closer to Africa, so this is a trend, not a strict inequality)
  let prev = -1;
  for (const ma of [250, 200, 150, 100, 50, 0]) {
    const s = spread(ma);
    assert.ok(s > prev - 1, `spread not trending outward at ${ma}Ma (${s.toFixed(1)} vs ${prev.toFixed(1)})`);
    prev = s;
  }
});

/* ============================================================== the raster */

test('the land raster tracks the reconstruction and stays plausible', () => {
  const land = new Land(atlas, 1.0);
  land.rasterize(0);
  const modern = land.landFraction();
  assert.ok(modern > 0.24 && modern < 0.36, `modern land fraction ${modern}`);

  // re-rasterising the same time must be a no-op
  assert.equal(land.rasterize(0), false, 'rasterize should short-circuit on an unchanged time');
  assert.ok(land.rasterize(1), 'a new time must force a rebuild');

  // Pangaea is one landmass with a much longer coastline per unit area, so its
  // fraction of coastal cells is lower than the fragmented modern world
  const coastal = ma => {
    land.rasterize(ma);
    let n = 0, c = 0;
    for (let i = 0; i < land.group.length; i++) {
      if (!land.group[i]) continue;
      n++;
      if (land.dist[(i + 1) % land.group.length] === 0) c++;
    }
    return c / n;
  };
  const panga = coastal(250), now = coastal(0);
  assert.ok(panga < now, `Pangaea should have a lower coastal fraction (${panga.toFixed(3)} vs ${now.toFixed(3)})`);
});

test('land fraction stays in a sane band and never jumps across the run', () => {
  const land = new Land(atlas, 1.0);
  let prev = null;
  for (let ma = 0; ma <= 250; ma += 5) {
    land.rasterize(ma);
    const f = land.landFraction();
    assert.ok(f > 0.2 && f < 0.38, `land fraction at ${ma}Ma = ${f}`);
    if (prev !== null) assert.ok(Math.abs(f - prev) < 0.05, `land fraction jumped at ${ma}Ma`);
    prev = f;
  }
});

test('the distance transform puts zero exactly on the coast', () => {
  const land = new Land(atlas, 0.5);
  land.rasterize(0);
  for (let i = 0; i < land.group.length; i++) {
    if (land.group[i]) assert.equal(land.dist[i], 0, `land cell ${i} should have zero distance`);
    else assert.ok(land.dist[i] > 0, `ocean cell ${i} should have a positive distance`);
  }
  // Lipschitz bound, both directions. The chamfer weights an orthogonal step at 1 and a
  // diagonal at sqrt(2), so the field approximates EUCLIDEAN cell distance and
  // can never report more than the true Euclidean distance to the nearest land.
  const w = land.w, h = land.h;
  const R = 16;
  let checked = 0;
  for (let k = 0; k < 6000 && checked < 150; k++) {
    const x = (k * 7919) % w, y = (k * 104729) % h;
    const b = y * w + x;
    if (land.group[b]) continue;
    let best = Infinity, atEdge = false;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      if (land.group[yy * w + xx]) {
        const d = Math.hypot(dx, dy);
        if (d < best) best = d;
        if (Math.abs(dx) === R || Math.abs(dy) === R) atEdge = true;
      }
    }
    // skip cells whose true nearest land may lie outside the search window
    if (best === Infinity || atEdge) continue;
    // a two-pass sqrt(2)-weighted chamfer is an APPROXIMATION of the Euclidean
    // cell distance: it can be a few percent short when the shortest path is not
    // a simple staircase, and at most sqrt(2) times too long. That is why the
    // ocean bands are labelled as a shading device, not bathymetry.
    assert.ok(land.dist[b] >= best * 0.9,
      `cell ${b} understates badly: reports ${land.dist[b].toFixed(2)}, true ${best.toFixed(2)}`);
    assert.ok(land.dist[b] <= best * Math.SQRT2 + 0.05,
      `cell ${b} overstates: reports ${land.dist[b].toFixed(2)}, true ${best.toFixed(2)}`);
    checked++;
  }
  assert.ok(checked > 20, 'expected to sample enough ocean cells');
});

/* ============================================================== the page */

test('the page names its source, licence and the limits of the model', async () => {
  const html = await readFile(new URL('../learn/pangea-drift.html', import.meta.url), 'utf8');
  assert.match(SOURCE.citation, /Young et al\. \(2019\)/);
  assert.match(SOURCE.license, /CC BY 4\.0/);
  assert.match(SOURCE.referencePlate, /Africa/);

  assert.match(html, /Geoscience Frontiers/);
  // the licence, dataset and DOI are injected from the data module at runtime,
  // so assert on the values the page will actually show
  assert.match(SOURCE.license, /CC BY 4\.0/);
  assert.match(SOURCE.data, /Zenodo record 10525370/);
  assert.match(SOURCE.alsoCite.join(' '), /Muller et al\. \(2016\)/);
  assert.match(html, /Zenodo/);
  assert.match(html, /id="srcCite"/);
  assert.match(SOURCE.doi, /gsf\.2018\.05\.011/);   // Young et al. 2019, Geosci. Front. 10(3)
  assert.match(html, /\$\{SOURCE\.doi\}|SOURCE\.doi/);
  // the modelling choices a reader must know about
  assert.match(html, /Africa is the reference frame/i);
  assert.match(html, /not palaeolatitude/i);
  assert.match(html, /deep time is approximate/i);
  assert.match(html, /rigid\s+present-day coastlines/i);
  // the citations the page shows must be the real ones (the first DOI once pointed at an unrelated paper)
  assert.match(html, /Young et al\. 2019, Geoscience Frontiers 10\(3\), 989&ndash;1013/);
  assert.match(html, /Annu\. Rev\. Earth Planet\. Sci\. 44, 107&ndash;138/);
  assert.match(SOURCE.alsoCite.join(' '), /44, 107-138/);
  // every outbound link is safe
  const blanks = [...html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)].map(m => m[0]);
  assert.ok(blanks.length >= 4, 'expected primary-source links');
  for (const b of blanks) assert.match(b, /rel="noreferrer"/);
});

test('the page exposes both themes, the controls and reduced-motion support', async () => {
  const html = await readFile(new URL('../learn/pangea-drift.html', import.meta.url), 'utf8');
  for (const id of ['ascii', 'time', 'play', 'rev', 'speed', 'themeBtn', 'res', 'home', 'hudView',
    'about', 'chapter', 'labels', 'legend']) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
  assert.match(html, /data-theme="dark"/);
  assert.match(html, /data-theme="light"/);
  assert.match(html, /prefers-color-scheme/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /localStorage\.setItem\('pangea-theme'/);
  // pointer, wheel and touch all reach the same camera
  assert.match(html, /addEventListener\('wheel'/);
  assert.match(html, /addEventListener\('pointermove'/);
  assert.match(html, /setPointerCapture/);
  assert.match(html, /touch-action: none/);
  // a typing guard, per the repo rule about world hotkeys
  assert.match(html, /isContentEditable/);
  // deterministic hook for headless verification
  assert.match(html, /window\.__pg\s*=/);
});

test('the Learn hub lists the lesson alphabetically with its shader shell', async () => {
  const html = await readFile(new URL('../learn/index.html', import.meta.url), 'utf8');
  const pangaea = html.indexOf('href="pangea-drift.html"');
  assert.ok(pangaea > 0, 'hub does not link the lesson');
  const loop = html.indexOf('href="loop-engineering-antigravity.html"');
  const shapley = html.indexOf('href="shapley-value-estimation.html"');
  assert.ok(loop > 0 && shapley > 0);
  assert.ok(loop < pangaea && pangaea < shapley, 'tile is not in alphabetical order');
  const shell = html.slice(html.lastIndexOf('<div class="tile-shell">', pangaea),
    html.indexOf('</div>', pangaea) + 6);
  assert.match(shell, /class="tile-shader"/);
  assert.match(shell, /Open lesson/);
});

/* ======================================================== data corrections */

test('colour groups follow present-day geography', () => {
  const land = new Land(atlas, 0.25);
  land.rasterize(0);
  const name = (lon, lat) => { const g = land.groupAt(lon, lat); return g ? GROUPS[g - 1].name : 'sea'; };
  const expect = {
    'North America': [[-87.6, 41.9], [-99.1, 19.4], [-42.5, 72], [-150, 64]],
    'South America': [[-47.9, -15.8], [-58.4, -34.6], [-59, -51.7]],
    Africa: [[31.2, 30], [15.3, -4.3], [36.8, -1.3], [47, -19]],
    Europe: [[2.3, 48.9], [-3.7, 40.4], [37.6, 55.8], [-18.5, 65]],
    Asia: [[116.4, 39.9], [139.7, 35.7], [51.4, 35.7], [91.1, 29.7], [129.7, 62], [-175, 66]],
    India: [[77.2, 28.6]],
    Arabia: [[46.7, 24.7]],
    Australia: [[134, -25], [147.3, -42.9]],
    Antarctica: [[0, -89], [106.8, -78.5], [-63, -70], [-20, -78]],   // pole, Vostok, the Peninsula, Coats Land
    'SE Asia / Pacific': [[113.5, 0.5], [101, 15], [172.5, -42], [121.5, 16.8]],
  };
  for (const [want, pts] of Object.entries(expect)) {
    for (const [lon, lat] of pts) assert.equal(name(lon, lat), want, `(${lon}, ${lat}) should be ${want}`);
  }
  const used = new Set(atlas.polys.map(p => p.group));
  assert.equal(used.size, GROUPS.length, 'every colour family is used and none is out of range');
  for (const g of used) assert.ok(g >= 0 && g < GROUPS.length, `group ${g} has no name`);
});

test('the South Pole is inside Antarctica, not a hole in the raster', () => {
  const land = new Land(atlas, 0.25);
  land.rasterize(0);
  let n = 0, t = 0;
  for (let lat = -89.875; lat < -85; lat += 0.25) for (let lon = -179.875; lon < 180; lon += 0.25) { t++; if (land.groupAt(lon, lat)) n++; }
  assert.ok(n / t > 0.98, `polar cap land fraction ${(n / t).toFixed(3)}`);
});

test('the Weddell-to-Greenwich sector of Antarctica is land', () => {
  const land = new Land(atlas, 0.25);
  land.rasterize(0);
  // Dronning Maud Land and Coats Land: the generated data had lost this half of the main ring
  for (const [lon, lat] of [[0, -75], [-10, -76], [-20, -78], [-30, -80], [-40, -82], [5, -80], [-15, -73]]) {
    assert.equal(land.groupAt(lon, lat) ? GROUPS[land.groupAt(lon, lat) - 1].name : 'sea', 'Antarctica', `(${lon}, ${lat})`);
  }
  // and the Weddell Sea itself is still sea
  assert.equal(land.groupAt(-40, -72), 0, 'the Weddell Sea must stay sea');
});

test('the guided tour and the HUD use real geological names and plain text', async () => {
  const html = await readFile(new URL('../learn/pangea-drift.html', import.meta.url), 'utf8');
  const eras = new Function('return ' + html.match(/const ERAS = (\[[\s\S]*?\]);/)[1])();
  assert.equal(eras[0][0], 250);
  assert.equal(eras[eras.length - 1][1], 0);
  for (let i = 1; i < eras.length; i++) assert.equal(eras[i][0], eras[i - 1][1], `era table has a gap before ${eras[i][2]}`);
  const byName = Object.fromEntries(eras.map(([a, b, n]) => [n, [a, b]]));
  assert.deepEqual(byName.Triassic, [250, 201.4]);
  assert.deepEqual(byName.Cretaceous, [145, 66]);
  assert.deepEqual(byName.Quaternary, [2.6, 0]);
  const chapters = new Function('return ' + html.match(/const CHAPTERS = (\[[\s\S]*?\n\]);/)[1])();
  assert.ok(chapters.length >= 8);
  for (const c of chapters) {
    // the card is filled with textContent, so an entity here would show up literally
    assert.doesNotMatch(c.body + c.era + c.title, /&[a-z]+;/, `chapter ${c.ma} contains a raw HTML entity`);
    assert.ok(c.ma >= 0 && c.ma <= 250);
  }
  assert.equal(chapters.find(c => c.ma === 250).era, 'Early Triassic');
  assert.match(chapters.find(c => c.ma === 250).body, /no polar ice/);
  // the time slider runs past -> present left to right, so its value is inverted
  assert.match(html, /setMa\(MAX_MA - parseFloat\(e\.target\.value\)\)/);
  assert.match(html, /aria-valuetext/);
});

test('the README lists the lesson', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /\(learn\/pangea-drift\.html\)/);
});
