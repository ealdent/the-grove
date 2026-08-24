// Headless regression harness for utils/sky_weather_infographic.html.
// Runs the REAL extracted app script (see extract.cjs) against the REAL inlined
// astronomy-engine with a stubbed DOM/Date/fetch, across 5 scenarios:
//   1. Atlanta today vs live USNO oneday API (external truth anchor, warn-only offline)
//   2. a no-moonrise date            3. Tromsø midwinter (null sun events)
//   4. Sydney (southern hemisphere)  5. 2026-11-01 America/New_York (25h DST fallback)
// plus an offline-weather proof, toggle checks, and the drawDome perf gate (~50 ms).
// Exits 0 only if every check passes. Requires: node extract.cjs first.
const fs = require('fs');
const path = require('path');

const EXTRACTED = path.join(__dirname, '.extracted');
// The UMD assigns module.exports under .cjs (and the global object otherwise).
// The app script expects the global, so set it deterministically either way.
const engineMod = require(path.join(EXTRACTED, 'engine.cjs'));
if (!global.Astronomy) global.Astronomy = engineMod;
const Astronomy = global.Astronomy;
if (!Astronomy || typeof Astronomy.Observer !== 'function') {
  console.error('harness: astronomy engine failed to load from .extracted/engine.cjs');
  process.exit(1);
}
const appSource = fs.readFileSync(path.join(EXTRACTED, 'app.cjs'), 'utf8');
const realFetch = global.fetch.bind(global);

const RealDate = Date;
let FIXED_NOW = null;

function installDateStub() {
  function FakeDate(...args) {
    return args.length ? new RealDate(...args) : new RealDate(FIXED_NOW);
  }
  FakeDate.prototype = RealDate.prototype;
  Object.setPrototypeOf(FakeDate, RealDate);
  FakeDate.now = () => FIXED_NOW;
  FakeDate.UTC = (...a) => RealDate.UTC(...a);
  FakeDate.parse = (s) => RealDate.parse(s);
  global.Date = FakeDate;
}

// ---------- DOM stub ----------
function makeEl(id) {
  return {
    id, textContent: '', innerHTML: '', title: '', disabled: false,
    style: new Proxy({ setProperty() {} }, { get: (t, k) => t[k] ?? '', set: (t, k, v) => (t[k] = v, true) }),
    classList: { add() {}, remove() {} },
    dataset: {},
    _handlers: {},
    setAttribute() {},
    appendChild(c) { this.innerHTML += (c && (c.innerHTML || c.textContent)) || '<x/>'; },
    addEventListener(ev, fn) { this._handlers[ev] = fn; },
  };
}

let REG = null;
function installDom(locationSearch, fetchImpl, geoDenied) {
  REG = new Map();
  const get = (id) => { if (!REG.has(id)) REG.set(id, makeEl(id)); return REG.get(id); };
  global.document = {
    getElementById: get,
    documentElement: { dataset: {} },
    title: '',
    createElement: () => makeEl('dyn'),
  };
  global.matchMedia = () => ({ matches: false, addEventListener() {} });
  global.localStorage = { getItem: () => null, setItem() {} };
  global.location = { search: locationSearch || '' };
  const nav = geoDenied
    ? { geolocation: { getCurrentPosition: (ok, err) => err(new Error('denied')) } }
    : {}; // no geolocation API -> "not supported" path
  try {
    Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
  } catch (e) { global.navigator = nav; }
  global.fetch = fetchImpl;
  global.setInterval = () => 1;
}

const offlineFetch = async () => { throw new Error('network blocked (test)'); };
const cannedFetch = async (url) => {
  if (url.includes('open-meteo')) {
    return { ok: true, json: async () => ({ current: {
      temperature_2m: 81.3, apparent_temperature: 84.9, relative_humidity_2m: 62,
      precipitation: 0, weather_code: 2, cloud_cover: 38,
      wind_speed_10m: 7.2, wind_direction_10m: 205, time: '2026-08-23T14:45'
    } }) };
  }
  if (url.includes('nominatim')) {
    return { ok: true, json: async () => ({ address: { city: 'Testville', state: 'Georgia' } }) };
  }
  throw new Error('unexpected URL ' + url);
};

// ---------- reference computation: mirrors computeAstronomy call pattern ----------
function partsForTZ(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const map = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  return map;
}
function referenceDay(lat, lon, tz, nowMs) {
  const now = new RealDate(nowMs);
  const p0 = partsForTZ(now, tz);
  const dayStart = new RealDate(now); dayStart.setFullYear(+p0.year, +p0.month - 1, +p0.day); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new RealDate(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
  const t0 = dayStart.getTime(), t1 = dayEnd.getTime();
  const obs = new Astronomy.Observer(lat, lon, 0);
  const inDay = (e) => { const d = e && e.date; return (d && d.getTime() >= t0 && d.getTime() < t1) ? d : null; };
  const noon = Astronomy.SearchHourAngle('Sun', obs, 0, dayStart);
  return {
    sunrise: inDay(Astronomy.SearchRiseSet('Sun', obs, +1, dayStart, 2)),
    sunset: inDay(Astronomy.SearchRiseSet('Sun', obs, -1, dayStart, 2)),
    civilBegin: inDay(Astronomy.SearchAltitude('Sun', obs, +1, dayStart, 2, -6)),
    civilEnd: inDay(Astronomy.SearchAltitude('Sun', obs, -1, dayStart, 2, -6)),
    nauticalBegin: inDay(Astronomy.SearchAltitude('Sun', obs, +1, dayStart, 2, -12)),
    nauticalEnd: inDay(Astronomy.SearchAltitude('Sun', obs, -1, dayStart, 2, -12)),
    astroBegin: inDay(Astronomy.SearchAltitude('Sun', obs, +1, dayStart, 2, -18)),
    astroEnd: inDay(Astronomy.SearchAltitude('Sun', obs, -1, dayStart, 2, -18)),
    solarNoon: inDay(noon ? { date: noon.time.date } : null),
    moonrise: inDay(Astronomy.SearchRiseSet('Moon', obs, +1, dayStart, 2)),
    moonset: inDay(Astronomy.SearchRiseSet('Moon', obs, -1, dayStart, 2)),
    phaseAngle: Astronomy.MoonPhase(now),
    illumFrac: Astronomy.Illumination('Moon', now).phase_fraction,
  };
}
const fmtHM = (d, tz) => !d ? '–' : new Intl.DateTimeFormat(undefined, {
  timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
}).format(d);

// ---------- scenario runner ----------
let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

async function runScenario(name, opts) {
  console.log(`\n== ${name} ==`);
  if (opts.tz) process.env.TZ = opts.tz;
  FIXED_NOW = opts.nowMs;
  installDateStub();
  installDom(opts.search || '', opts.offline ? offlineFetch : (opts.fetchImpl || offlineFetch), !!opts.geoDenied);
  try {
    eval(appSource);
  } catch (e) {
    check('app evals without throwing', false, e.message);
    return null;
  }
  await new Promise(r => setTimeout(r, 60)); // let init()/refreshAll() settle

  const el = (id) => REG.get(id);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const lat = opts.lat ?? 33.749, lon = opts.lon ?? -84.388;
  const ref = referenceDay(lat, lon, tz, opts.nowMs);

  // displayed vs engine-direct (wiring + formatters)
  const timelineText = ['tlDawn', 'tlDusk'].map(i => el(i).innerHTML).join(' ');
  for (const [key, label] of [['sunrise', 'Sunrise'], ['sunset', 'Sunset'], ['civilBegin', 'Civil dawn'],
    ['civilEnd', 'Civil dusk'], ['nauticalBegin', 'Nautical dawn'], ['nauticalEnd', 'Nautical dusk'],
    ['astroBegin', 'Astronomical dawn'], ['astroEnd', 'Astronomical dusk']]) {
    if (ref[key]) check(`${label} time displayed`, timelineText.includes(fmtHM(ref[key], tz)), `want ${fmtHM(ref[key], tz)}`);
    else check(`${label} null in reference (scenario premise)`, true);
  }
  check('moonrise displayed', el('moonrise').textContent === fmtHM(ref.moonrise, tz),
    `app=${el('moonrise').textContent} ref=${fmtHM(ref.moonrise, tz)}`);
  check('moonset displayed', el('moonset').textContent === fmtHM(ref.moonset, tz),
    `app=${el('moonset').textContent} ref=${fmtHM(ref.moonset, tz)}`);
  check('moon illum displayed', el('moonIllum').textContent === `${Math.round(ref.illumFrac * 100)}%`,
    `app=${el('moonIllum').textContent} ref=${Math.round(ref.illumFrac * 100)}%`);
  check('moon disc rendered', el('moonDisc').innerHTML.includes('<path') || el('moonDisc').innerHTML.includes('<circle'));

  if (opts.expectNoSun) {
    check('reference confirms no sunrise/sunset', !ref.sunrise && !ref.sunset,
      `rise=${ref.sunrise} set=${ref.sunset}`);
    check('no sun events -> dayMeta dash', el('dayMeta').textContent === '–', `dayMeta=${el('dayMeta').textContent}`);
  } else {
    check('dayMeta has day length', /day length \d+h \d+m/.test(el('dayMeta').textContent), el('dayMeta').textContent);
  }

  check('dome rendered', el('dome').innerHTML.length > 200, `len=${el('dome').innerHTML.length}`);
  check('ring rendered', el('ring').innerHTML.length > 200);
  check('ribbon rendered', el('ribbon').innerHTML.length > 0);

  if (opts.offline) {
    check('weather error banner shown offline', el('errWeather').textContent.includes('Weather failed'),
      el('errWeather').textContent);
    check('astro still rendered offline (moon card)', el('moonPhaseName').textContent.length > 2);
    check('no errSun banner', el('errSun').textContent === '', el('errSun').textContent);
  } else {
    check('weather rendered', el('wxDesc').textContent.length > 0 && el('errWeather').textContent === '',
      `wxDesc=${el('wxDesc').textContent} err=${el('errWeather').textContent}`);
  }

  try { REG.get('timeFormatBtn')._handlers.click(); check('12/24h toggle works', true); }
  catch (e) { check('12/24h toggle works', false, e.message); }
  try { await REG.get('refreshBtn')._handlers.click(); check('refresh re-run works', true); }
  catch (e) { check('refresh re-run works', false, e.message); }

  check('location line set', el('locationName').textContent.length > 0, el('locationName').textContent);
  console.log(`  [info] tz=${tz} name="${el('locationName').textContent}" status="${el('locationStatus').textContent}"`);
  console.log(`  [info] phase="${el('moonPhaseName').textContent}" illum=${el('moonIllum').textContent} rise=${el('moonrise').textContent} set=${el('moonset').textContent} dayMeta="${el('dayMeta').textContent}"`);
  console.log(`  [info] tzLine="${el('tzLine').textContent}" tzSub="${el('tzSub').textContent}"`);
  return { ref, el: (id) => REG.get(id), tz, tzSubText: el('tzSub').textContent };
}

// ---------- perf: drawDome sampling cost (Phase 3 gate) ----------
function measureDomePerf(lat, lon, tz, nowMs) {
  const ref = referenceDay(lat, lon, tz, nowMs);
  const obs = new Astronomy.Observer(lat, lon, 0);
  const p0 = partsForTZ(new RealDate(nowMs), tz);
  const dayStart = new RealDate(nowMs); dayStart.setFullYear(+p0.year, +p0.month - 1, +p0.day); dayStart.setHours(0, 0, 0, 0);
  const pos = (body, t) => {
    const eq = Astronomy.Equator(body, new RealDate(t), obs, true, true);
    return Astronomy.Horizon(new RealDate(t), obs, eq.ra, eq.dec, '');
  };
  const tA = RealDate.now();
  for (let i = 0; i <= 288; i++) pos('Sun', dayStart.getTime() + i * 5 * 60000);
  if (ref.moonrise && ref.moonset) {
    for (let t = ref.moonrise.getTime() - 30 * 60000; t <= ref.moonset.getTime() + 30 * 60000; t += 10 * 60000) pos('Moon', t);
  }
  return RealDate.now() - tA;
}

// ---------- USNO external anchor (warn-only when offline) ----------
async function usnoOneDay(dateStr, lat, lon, tzOff, dst) {
  const url = `https://aa.usno.navy.mil/api/rstt/oneday?date=${dateStr}&coords=${lat},${lon}&tz=${tzOff}&dst=${dst}`;
  const res = await realFetch(url, { signal: AbortSignal.timeout(8000) });
  const j = await res.json();
  const d = (j && j.properties && j.properties.data) || {};
  const pick = (needle) => {
    const it = (d.moondata || []).find(x => (x.phen || '').toLowerCase().includes(needle));
    return it ? it.time : null;
  };
  return { sundata: d.sundata || [], moonrise: pick('rise'), moonset: pick('set'), phase: d.curphase, illum: d.fracillum };
}
const pickSun = (sundata, phen) => (sundata.find(x => x.phen === phen) || {}).time || null;
function minsDiff(hmA, hmB) { // "H:MM AM" vs "HH:MM" -> absolute minute diff
  const p = (s) => {
    const m12 = s.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (m12) { let h = +m12[1]; if (m12[3].toUpperCase() === 'PM' && h !== 12) h += 12; if (m12[3].toUpperCase() === 'AM' && h === 12) h = 0; return h * 60 + +m12[2]; }
    const m24 = s.match(/(\d+):(\d+)/); return m24 ? +m24[1] * 60 + +m24[2] : NaN;
  };
  return Math.abs(p(hmA) - p(hmB));
}

(async () => {
  const T = (s) => RealDate.parse(s);

  // Scenario 1: Atlanta, geolocation DENIED -> Atlanta default, network OK (canned weather)
  const s1 = await runScenario('Atlanta 2026-08-23 · geo denied · weather OK', {
    tz: 'America/New_York', nowMs: T('2026-08-23T18:30:00Z'), geoDenied: true, fetchImpl: cannedFetch,
  });
  if (!s1) { console.log('\naborting: scenario 1 crashed'); process.exit(1); }

  // USNO comparison for Atlanta (external truth anchor; tz param is STANDARD offset, dst adds the hour)
  try {
    const u = await usnoOneDay('2026-08-23', 33.749, -84.388, -5, true);
    const cmp = [
      ['sunrise', pickSun(u.sundata, 'Rise'), fmtHM(s1.ref.sunrise, 'America/New_York')],
      ['sunset', pickSun(u.sundata, 'Set'), fmtHM(s1.ref.sunset, 'America/New_York')],
      ['civil begin', pickSun(u.sundata, 'Begin Civil Twilight'), fmtHM(s1.ref.civilBegin, 'America/New_York')],
      ['civil end', pickSun(u.sundata, 'End Civil Twilight'), fmtHM(s1.ref.civilEnd, 'America/New_York')],
      ['moonrise', u.moonrise, fmtHM(s1.ref.moonrise, 'America/New_York')],
      ['moonset', u.moonset, fmtHM(s1.ref.moonset, 'America/New_York')],
    ];
    for (const [label, usno, ours] of cmp) {
      if (!usno) { console.log(`  [info] USNO ${label}: none`); continue; }
      const d = minsDiff(usno, ours);
      check(`USNO parity ${label} (usno=${usno} ours=${ours})`, d <= 1, `diff=${d}min`);
    }
    console.log(`  [info] USNO phase="${u.phase}" illum=${u.illum} | ours="${s1.el('moonPhaseName').textContent}" ${s1.el('moonIllum').textContent}`);
    check('USNO phase-name match', (s1.el('moonPhaseName').textContent || '').toLowerCase() === (u.phase || '').toLowerCase(),
      `usno="${u.phase}" ours="${s1.el('moonPhaseName').textContent}"`);
  } catch (e) {
    console.log('  [warn] USNO fetch failed (offline?) — skipping external anchor:', e.message);
  }

  // Scenario 2: a date with NO moonrise (scan forward from 2026-08-23)
  let noRiseMs = null;
  for (let d = 0; d < 40; d++) {
    const t = T('2026-08-23T18:00:00Z') + d * 86400000;
    const r = referenceDay(33.749, -84.388, 'America/New_York', t);
    if (!r.moonrise) { noRiseMs = t; break; }
  }
  if (noRiseMs) {
    const ds = new RealDate(noRiseMs).toISOString().slice(0, 10);
    const s2 = await runScenario(`Atlanta ${ds} · no moonrise day · offline`, {
      tz: 'America/New_York', nowMs: noRiseMs, offline: true,
    });
    if (s2) check('moonrise is dash on no-rise day', s2.el('moonrise').textContent === '–', s2.el('moonrise').textContent);
  } else console.log('  [warn] no no-moonrise date found in scan window');

  // Scenario 3: Tromsø midwinter (polar night, null sun rise/set) via URL override, offline
  const s3 = await runScenario('Tromsø 2026-12-21 · polar night · ?lat/lon override · offline', {
    tz: 'Europe/Oslo', nowMs: T('2026-12-21T11:00:00Z'), search: '?lat=69.6492&lon=18.9553',
    lat: 69.6492, lon: 18.9553, offline: true, expectNoSun: true,
  });
  if (s3) {
    check('URL override location shown', /69\.65|18\.96|Troms/.test(s3.el('locationName').textContent), s3.el('locationName').textContent);
    check('URL override status line', s3.el('locationStatus').textContent.includes('URL override'), s3.el('locationStatus').textContent);
  }

  // Scenario 4: Sydney (southern hemisphere) via URL override, offline
  const s4 = await runScenario('Sydney 2026-08-23 · southern hemisphere · offline', {
    tz: 'Australia/Sydney', nowMs: T('2026-08-22T21:30:00Z'), search: '?lat=-33.8688&lon=151.2093',
    lat: -33.8688, lon: 151.2093, offline: true,
  });
  if (s4 && s4.ref.solarNoon) {
    const obs = new Astronomy.Observer(-33.8688, 151.2093, 0);
    const eq = Astronomy.Equator('Sun', s4.ref.solarNoon, obs, true, true);
    const h = Astronomy.Horizon(s4.ref.solarNoon, obs, eq.ra, eq.dec, '');
    check('solar noon azimuth ~north in Sydney', Math.min(Math.abs(h.azimuth), Math.abs(h.azimuth - 360)) < 2, `az=${h.azimuth.toFixed(1)}`);
  }
  if (s4) check('Sydney tzSub says standard time in August', s4.tzSubText.includes('standard time'), s4.tzSubText);
  if (s1) check('Atlanta tzSub says daylight time in August', s1.tzSubText.includes('daylight time'), s1.tzSubText);

  // Scenario 5: DST fallback day 2026-11-01 America/New_York (25h day), offline
  const s5 = await runScenario('New York 2026-11-01 · DST fallback (25h day) · offline', {
    tz: 'America/New_York', nowMs: T('2026-11-01T17:00:00Z'), offline: true,
  });
  if (s5) check('tzSub says standard time after fallback', s5.el('tzSub').textContent.includes('standard time'), s5.el('tzSub').textContent);

  // Perf gate (drawDome sampling budget ~50 ms)
  const ms = measureDomePerf(33.749, -84.388, 'America/New_York', T('2026-08-23T18:30:00Z'));
  console.log(`\n== Perf ==\n  drawDome sample computation: ${ms} ms (budget ~50 ms)`);
  check('dome redraw within budget', ms < 50, `${ms} ms`);

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
  process.exit(failures ? 1 : 0);
})();
