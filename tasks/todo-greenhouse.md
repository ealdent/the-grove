# Greenhouse — solar-driven lighting, lamps, materials, garnish

Target file: `utils/greenhouse-todo/app.js`

## Goal
Drive every light in the scene off real solar elevation, rebuild the lamp rig as
warm point lights with warm-up/hysteresis, de-gloss the soil, add per-instance
pot jitter, and add the night garnish.

## Plan

### 0. Verification hook
- [ ] `window.greenhouseDebug.setSunTime(iso)` — force the astro clock so day /
      twilight / night can each be screenshotted headlessly.

### A. Solar lighting bands
- [ ] `dayness` ramp: full day at >= +10 deg elevation, full night at <= -6 deg.
- [ ] Sun directional intensity 4, hard shadows (small `shadow.radius`).
- [ ] New `moonLight`: pale blue directional at the real moon position,
      intensity scaled by lunar phase, soft shadows, only when bright enough.
- [ ] Only one directional shadow map live at a time (sun off at night).
- [ ] Night ambient near-black; exposure carries the shadows.
- [ ] Twilight fog density bump + deep blue hour.

### B. Lamps
- [ ] 20 SpotLights -> 20 PointLights, 2700 K, `decay 2`.
- [ ] Fixed pool of 4 (3 on touch) shadow-casting point lights repositioned to
      the nearest lamps — constant light/shadow counts, so no shader recompiles.
- [ ] Lamps switch on below +2 deg elevation, off above +3.5 deg (hysteresis),
      with a ~3.5 s filament warm-up that ramps colour and intensity.
- [ ] Dust motes confined to the lamp cones.
- [ ] One lamp flickers — own bulb mesh + per-instance cone flicker attribute.

### C. Glass
- [ ] Keep the green tint after dark (was lerping 75 % to white).
- [ ] Interior lamp reflections in the panes at night (point lights + clearcoat).

### D. Forest
- [ ] One unexplained cold light deep in the trees, night only, opaque so it
      survives the transmission buffer.

### E. Materials
- [ ] Soil: roughness 1.0, no roughness map, matte dark brown, keep bump noise.
- [ ] Terracotta: slightly rough, never wet-glossy.
- [ ] Wood: lower-contrast grain, wear marks, warm specular.

### F. Pots
- [ ] Deterministic per-slot jitter: position +-10 %, rotation, scale +-15 %, hue.
- [ ] Some slots empty (no pot), one tipped pot on a bench.

### G. Clutter
- [ ] Stacked nested pots, second soil bag.

### H. Night garnish
- [ ] Low ground fog planes.
- [ ] Condensation running down the wall panes, then dripping.
- [ ] One vine that sways.

## Proof
- Headless Chrome screenshots at forced times: noon, dusk (+3 deg), blue hour
  (-2 deg), full night.
- Diagnostics panel (F) reporting lamp level, shadow-caster count, moon phase.
- `npm test` still green.
