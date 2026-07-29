# Greenhouse — solar-driven lighting, lamps, materials, garnish

Target file: `utils/greenhouse-todo/app.js`

## Goal
Drive every light in the scene off real solar elevation, rebuild the lamp rig as
warm point lights with warm-up/hysteresis, de-gloss the soil, add per-instance
pot jitter, and add the night garnish.

## Plan

### 0. Verification hook
- [x] `window.greenhouseDebug.setSunTime(iso)` — force the astro clock so day /
      twilight / night can each be screenshotted headlessly.

### A. Solar lighting bands
- [x] `dayness` ramp: full day at >= +10 deg elevation, full night at <= -6 deg.
- [x] Sun directional intensity 4, hard shadows (small `shadow.radius`).
- [x] New `moonLight`: pale blue directional at the real moon position,
      intensity scaled by lunar phase, soft shadows, only when bright enough.
- [x] Only one directional shadow map live at a time (sun off at night).
- [x] Night ambient near-black; exposure carries the shadows.
- [x] Twilight fog density bump + deep blue hour.

### B. Lamps
- [x] 20 SpotLights -> 20 PointLights, 2700 K, `decay 2`.
- [x] Fixed pool of 4 (3 on touch) shadow-casting point lights repositioned to
      the nearest lamps — constant light/shadow counts, so no shader recompiles.
- [x] Lamps switch on below +2 deg elevation, off above +3.5 deg (hysteresis),
      with a ~3.5 s filament warm-up that ramps colour and intensity.
- [x] Dust motes confined to the lamp cones.
- [x] One lamp flickers — own bulb mesh + per-instance cone flicker attribute.

### C. Glass
- [x] Keep the green tint after dark (was lerping 75 % to white).
- [x] Interior lamp reflections in the panes at night (point lights + clearcoat).

### D. Forest
- [x] One unexplained cold light deep in the trees, night only, opaque so it
      survives the transmission buffer.

### E. Materials
- [x] Soil: roughness 1.0, no roughness map, matte dark brown, keep bump noise.
- [x] Terracotta: slightly rough, never wet-glossy.
- [x] Wood: lower-contrast grain, wear marks, warm specular.

### F. Pots
- [x] Deterministic per-slot jitter: position +-10 %, rotation, scale +-15 %, hue.
- [x] Some slots empty (no pot), one tipped pot on a bench.

### G. Clutter
- [x] Stacked nested pots, second soil bag.

### H. Night garnish
- [x] Low ground fog planes.
- [x] Condensation running down the wall panes, then dripping.
- [x] One vine that sways.

## Proof
- Headless Chrome screenshots at forced times: noon, dusk (+3 deg), blue hour
  (-2 deg), full night.
- Diagnostics panel (F) reporting lamp level, shadow-caster count, moon phase.
- `npm test` still green.

## Review

All spec items landed. Verified by headless render at forced clock times plus
deterministic state dumps (`window.greenhouseDebug`).

### Measured

```
warm-up ramp     t=0.00s level=0.103 I=0.05 #ff4d0d   (cold ember)
                 t=1.40s level=0.515 I=1.74 #ff974b
                 t=3.15s level=1.000 I=7.50 #ffa957   (2700 K)
hysteresis       dusk: off at +5.2, off at +3.4, ON at +2.0
                 dawn: ON at -2.8 ... still ON at +2.4   (dead band holds)
lamps            decay=2 distance=9 colour=#ffa957, 4/20 cast shadows
shadows          every map autoUpdate=false (on demand only)
sun              intensity 4, shadow.radius 1, 2048 map
moon             #bcd0f2, radius 7; full moon I=1.08 shadow=true
                 half moon  I=0.19 shadow=false
night ambient    hemisphere 0.035, exposure 0.95
fog              day 0.0030, twilight 0.0088, night 0.0080
pots             120 slots, 16 bare, scale 0.857..1.150, 5 firing tints
garnish          3 ground-fog layers, 30 pane drops, vine swinging
particles        520 beam motes, 60 moths
```

### Fixed along the way (same defect family, not in the original list)

- `makeFbmField` silently returns an all-NaN field for a non-integer `baseFreq`
  (it indexes its lattice with `gy % freq`). NaN lands in a Uint8ClampedArray as
  0, so a new wear field at `baseFreq 2.4` produced a black albedo and a
  roughness map of zero — mirror-finish benches reflecting the sky as flat blue
  sheets.
- The floor's painted "pebbles" were 13 cm across and much lighter than the soil
  at this texel scale, reading as pale discs scattered over the aisle.
- Puddles at `envMapIntensity 1.5` were flat white cut-outs; water reads as
  water because it is dark with a sharp highlight.
- Moss instance tints were saturated green, squaring up into kelly-green plates.
- Ripple rings were a thin bright outline — a drawn circle, not a disturbance.
- The far forest light was initially placed at 75 m, behind the opaque painted
  backdrop cylinder at 64 m, so it never drew at all.

### Not verified

- Real-GPU frame timings. All renders here are SwiftShader, which is far slower
  than any real device; the on-demand shadow maps were added because 25 shadow
  passes per frame made headless verification impossible, and they are a clear
  win, but the resulting frame rate on hardware is unmeasured.
- Touch devices take the 3-shadow-caster / 1024-map path; only the desktop path
  (4 casters, 2048) was rendered.

### Residual risk

- Toggling `sunLight.visible` and `moonLight.visible` changes the light counts,
  which recompiles every material. It happens about four times per real day
  (dawn, dusk, moonrise, moonset) and will show as a brief hitch.
