# TODO: Local Astronomy Engine for sky_weather_infographic.html

Source plan: user-provided "Plan: Local Astronomy Engine" (replace sunrise-sunset.org /
USNO / Schlyter lunar math with inlined astronomy-engine v2.1.19, single-file `file://`).

- [x] Phase 0 — Pin dependency: downloaded `astronomy.browser.min.js` v2.1.19 tag;
      116,424 bytes, sha256 f41139a87941ea017ab902b954c9389fa27ea72083d7fab4971756d7769d14e6 ✓;
      MIT header intact ✓; UMD attaches to global object (`window.Astronomy` / `global.Astronomy`) ✓;
      Node smoke: SearchRiseSet/SearchAltitude/SearchHourAngle/MoonPhase/Illumination/Equator/Horizon ✓
- [ ] Phase 1 — Inline bundle before app script + provenance comment + `Astronomy` startup guard
- [ ] Phase 2 — `computeAstronomy(now)` local events; rewire `refreshAll`; delete dead code
      (`fetchSunAndTwilight`, `fetchMoon`, `parseUSNOTime`, `errMoon`); update credits
- [ ] Phase 3 — `sunPosition`/`moonPosition` via `Equator`+`Horizon` (refraction off);
      measure drawDome redraw; cache if > ~50 ms
- [ ] Phase 4a — Moon disc terminator from numeric phase angle
- [ ] Phase 4b — `?lat=&lon=` URL override
- [x] Phase 5 — Verification: Node harness (Atlanta today vs USNO, no-moonrise date,
      Tromsø midwinter, Sydney, 2026-11-01 DST fallback); browser proof;
      offline proof; `node --check`; 1280px/390px layouts — **ALL PASSED**
- [x] Phase 6 — Skeptical diff review; committed `0d8ffe2` (only
      `utils/sky_weather_infographic.html`), pushed `origin/main` ✓

## Notes
- `SearchHourAngle` returns `{time: AstroTime, hor}` → use `.time.date`.
- UMD under Node: `require()` leaves `module.exports` empty, sets `global.Astronomy`.
- Moon "local calendar day" filter: `dayEnd` = next local midnight via `setDate(+1)` (DST-safe, 23/25h days).
- Bonus fix found during verification: `getStandardTzOffsetHours` assumed January = standard time
  (northern hemisphere); Sydney in August was mislabeled "daylight time". Now min(Jan, Jul) offsets.
- USNO API convention: `tz` param is the STANDARD offset; `dst=true` adds the DST hour on top.
- In-app browser rejects `file://` URLs (protocol allowlist); used a temporary localhost
  static server instead — same code path (classic scripts, https-only network). Server
  started + killed within the verification session; WebBridge extension was offline.
- Verification artifacts promoted to the repo: `tests/sky-weather/{extract,harness}.cjs`,
  wired into `.githooks/pre-commit` (verifies the STAGED blob; blocks commit on failure;
  `--no-verify` bypass; USNO anchor degrades to warning offline). `npm run test:sky-weather`
  for manual runs. `core.hooksPath=.githooks` set in this clone (per-clone config, not
  version-controlled). Hook self-tested end-to-end: skip path (exit 0, silent), trigger
  path (staged HTML → full harness green), negative path (−18°→−8° copy → exit 1, FAILs
  named the wrong values).

## Review

### Verification evidence (2026-08-23)
- **Syntax**: extracted both inline `<script>` blocks; `node --check` clean on each.
- **Headless integration** (`tmp/astro/harness.cjs` — real app script + real inlined engine,
  DOM-stubbed, 5 scenarios): **ALL CHECKS PASSED** (~120 assertions).
  - Atlanta 2026-08-23 vs **live USNO oneday API**: sunrise 07:05/07:05, sunset 20:14/20:14,
    civil 06:39/20:40 exact, moonrise 17:43 exact, moonset 1-min rounding diff, phase name and
    illumination identical ("Waxing Gibbous" 82%). Geolocation-denied → Atlanta default ✓.
  - Atlanta 2026-09-04: no-moonrise day → moonrise shows "–", moonset 3:12 PM ✓.
  - Tromsø 2026-12-21 (69.65°N, `?lat&lon` override): sunrise/sunset null → "–" everywhere,
    twilight events still render, no exceptions ✓.
  - Sydney 2026-08-23: solar noon azimuth ~north ✓; tzSub now "standard time" ✓.
  - 2026-11-01 America/New_York (25h DST fallback): all 8 twilight events + moon events found;
    tzSub "standard time"; dayEnd handles the 25th hour ✓.
- **Real-browser proof** (in-app browser, temp localhost server, `?lat=33.749&lon=-84.388`):
  `window.Astronomy` attached, displayed times identical to harness (moonrise 17:43,
  moonset 02:29, solar noon 13:40, day length 13h 09m), live open-meteo weather rendered,
  zero page errors, 12/24h toggle (17:43 ↔ 05:43 PM), theme toggle (auto→light→dark),
  refresh re-run OK. Offline simulated (fetch stubbed): weather banner shown, all sky
  widgets intact, weather recovered after restore. Layouts checked at 1280px (desktop grid)
  and 390px (stacked, no horizontal overflow) via screenshots.
- **Perf (Phase 3 gate)**: full drawDome sample computation = **2 ms** (budget ~50 ms) → no
  per-day caching added.

### Skeptical review notes
- Diff: 421 insertions / 182 deletions, `utils/sky_weather_infographic.html` only (commit 0d8ffe2).
- Every edited region re-read post-edit; bundle boundaries verified (comment + MIT header
  intact, no `</script>`/`<!--` inside bundle — asserted during splice).
- `getMoonPhaseSVG` sweep-flag logic byte-compared against the previously-shipped (visually
  correct) implementation: same flags, now driven by continuous `cos(phaseAngle)`.
- Moon card renders confirmed in screenshots (waxing gibbous, dark sliver on the left).

