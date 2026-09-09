# Pixiecast — a modern WeatherPixie (utils/pixiecast.html)

Goal: single-file HTML app; a cartoon pixie's outfit encodes the current local weather.
Project: the-grove (personal, Moon Dog Atlas umbrella). No install-time deps; runtime data from
Open-Meteo (weather + geocoding, no key) and OSM Nominatim (reverse geocode for GPS).

## Plan
- [x] Data layer: geocode search (autocomplete), browser geolocation + reverse geocode, forecast fetch
- [x] Conditions model: feels-like, WMO code → kind, wind, UV, humidity, day phase (dawn/day/golden/dusk/night), moon phase
- [x] Wardrobe rules: temperature bands + rain/snow/storm/fog/wind/sun modifiers → outfit + "why" per garment
- [x] SVG scene: sky by phase/cover, sun/moon/stars, clouds, rain/snow, lightning, fog, ground, toadstool
- [x] SVG pixie: layered garments, hair states, faces, umbrella/lantern/popsicle/cocoa/fan, effects (shiver, sweat, breath, lean)
- [x] Report panel: temp, dressing note, garment chips (click → highlight), details grid, 12-hour strip, "outfit change coming up"
- [x] Mood theming: page palette follows the sky (light masthead text at night)
- [x] Units toggle °F/°C (no refetch), localStorage, URL params, dress-up demo presets (?demo=)
- [x] Add card to utils/index.html + README line
- [x] Verify: node --check on script, curl API shape, Browser pane live run (search, demo presets, mobile), console clean
- [ ] Commit (signed, pathspec-only) and push origin main

## Review (2026-09-09)
- Verified in the Browser pane against `grove-root` (localhost:8002):
  - `?demo=` presets heat, golden, drizzle, rain, storm, gale, fog, snow, night, arctic all render the intended outfit; console empty.
  - Live flow: typed "Asheville" → Open-Meteo geocode suggestions → forecast → real render
    (68°F clear, sunrise 7:08 AM), URL became `?lat=35.6009&lon=-82.5540&name=Asheville%2C+NC`, localStorage saved.
  - Chip click adds `.hl` to the matching `[data-part]` group; °C toggle switches temps, wind to km/h, persists.
  - Geolocation denied in the pane → "Where are you?" empty state with search / demo fallback.
  - Mobile 390px: single column, `scrollWidth <= innerWidth`, saved place restored.
- Bugs caught and fixed during verification: synthetic presets never set `is_day` (mins() fed a bare "T06:40"),
  inverted umbrella drawn over the face, synthetic Enter key not submitting the search form.
- Not verified: real `navigator.geolocation` success path (pane has no location); Nominatim reverse geocode
  only exercised via curl. Both have coordinate fallbacks.
