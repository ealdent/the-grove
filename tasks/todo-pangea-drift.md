# Pangaea to Present — interactive ASCII plate reconstruction

Goal: a self-contained `learn/` tutorial that animates the breakup of Pangaea into the
modern continents as full-screen colour ASCII art, with time controls, pan/zoom
(mouse, touch, keyboard), dark + light themes, and a guided chapter sequence.

Project: The Grove (personal). Boundary: single new page + one data module + tests + hub tile.

## Data provenance (the accuracy requirement)

Source: **Young, A., Flament, N., Maloney, K., Williams, S., Matthews, K., Zahirovic, S.,
Müller, D. (2018). *Global kinematics of tectonic plates and subduction zones since the
late Paleozoic Era.* Geoscience Frontiers 9(1), 199–270. CC-BY 4.0.**
Zenodo record 10525370 → `Global_250-0Ma_Young_et_al.rot`, `Global_410-250Ma_Young_et_al.rot`,
`Global_coastlines_Young_et_al_low_res.shp`.

Model lineage (cite alongside): Müller et al. 2016 (AREPS, doi:10.1146/annurev-earth-060115-012211),
Domeier & Torsvik 2014 (doi:10.1016/j.gsf.2014.01.002), Matthews et al. 2016.

### Rotation convention — reverse-engineered and verified

The GPlates `.rot` column order is `plate age pole_LAT pole_LON angle fixedPlate` — column 3
stays within ±90 across all 4,235 samples and hits exactly 90.0 for plate `070`
(`LGS-TPWC`, documented in-file as a "10 degree longitudinal shift"), which is only a
longitude shift if that column is latitude. Column 4 spans the full ±180.

Reconstruction rule: present-day (lon, lat) → position at t by applying the composed chain
matrix **directly** (verified: Boston moves east going back in time, Africa–South America
separates westward). Chain = walk `fixed` pointers from the plate up to **701 (Africa)**,
which is held at its present position — matching the published animation, in which Africa
sits at its modern longitude at 200 Ma and 100 Ma. Plates 070/004/001 (the true-polar-wander
and longitudinal-shift corrections) are deliberately *excluded*: they are the model's
"moving hotspot" frame corrections, not continental drift.

Interpolation must be **quaternion slerp**, not linear interpolation of the Euler pole
parameters. Plate 501 jumps from pole (19.2°E, 22.2°N, −52.7°) at 83 Ma to
(152.8°W, −23.2°S, +55.8°) at 100 Ma — the *same* rotation in the antipodal branch. Linear
interpolation of the pole longitude drags India through the middle of the Pacific.

## Verification ledger

- [x] Column order proven from data (column range + the polar LGS entry)
- [x] Direction proven from physics (NA east / SAM west going back in time)
- [x] Africa as root proven from the published animation frames at 200/100/320 Ma
- [x] Net finite rotation of every major plate vs Africa is smooth and monotonic 0→330 Ma
- [x] Magnitudes match published values (NA–AFR ≈ 81°, SAM–AFR ≈ 56°, IND–AFR ≈ 63°,
      ANT–AFR ≈ 57°, AUS–AFR ≈ 55°, EUR–AFR ≈ 66°)
- [x] North America verified against the published animation: Boston (-71, 42) → (-18, 24)
      at 200 Ma, i.e. seated against Africa's west margin — the textbook Pangaea
      configuration. Pole at 320 Ma is 64.3°N / 14.7°W, +78.05°, which is the published
      Domeier & Torsvik / Labails Pangaea-closure pole.

### KNOWN LIMITATION — carried into the UI, not hidden

The published animation reconstructs **topological plate polygons** (1 Myr resolved
topologies, half-stage reconstruction), not rigid coastlines. Reducing the same .rot
model to "rotate each coastline polygon by its plate's finite rotation" cannot reproduce
it for every plate: no single uniform sense works. North America needs the net rotation
applied forward, South America does not — under either sense plate 201 fails to sit
against Africa at 250 Ma, while the same rule seats 101, 801, 802, 501 and 503 correctly.

Consequences, stated plainly rather than papered over:
- The app ships the uniform forward convention (the one verified against the published
  frames for the North Atlantic and for Africa).
- The time range is capped at 0–250 Ma: Pangaea assembled → today. That is the tutorial's
  actual subject and the best-constrained window; the 250–330 Ma file carries its own
  documented geomagnetic-dipole-frame caveat.
- The "How to read this" panel names the reduction, the reference plate, the excluded
  true-polar-wander/longitudinal-shift corrections, and the fact that deep-time
  positions for plates other than North America are approximate.

- [x] Node test suite: 15/15 pass — `node --test tests/pangea-engine.test.mjs`
- [x] Headless Chrome: renders land + ocean, no page errors, pan/zoom/keys/themes all work,
      verified at DPR 1 (1600x950) and DPR 2 (2880x1800 buffer for a 1440x900 CSS box,
      `scaleOk: true`, 7546 distinct colours, 0 errors)
- [x] Hub tile added alphabetically with its shader shell (15 entries, order verified)

## What shipped

- `learn/pangea-plate-data.js` (152 KB, generated) — 301 plates, 1073 polygons, 14 540 vertices,
  37 sample times. Base-64, 12 bits per value.
- `learn/pangea-engine.js` — decode, quaternion-slerped finite rotations, scanline land
  rasteriser, two-pass chamfer distance transform. No DOM, so it is testable in Node.
- `learn/pangea-drift.html` — the page: full-screen colour ASCII, 9-chapter guided tour,
  transport, both themes, mouse/touch/keyboard camera, `window.__pg` test hook.

## Measured proof

Headless Chrome (CDP driver `utils/degauss/video/cdp.mjs`), macOS, `--headless=new`,
served over `python3 -m http.server` (never `file://`), cache disabled:

| Check | Result |
|---|---|
| Page boots | `#boot` removed, 0 page JS errors, 0 uncaught rejections |
| Grid | 1596x948 CSS, 266x79 cells at 10px (240x75 at DPR 2) |
| Content | 1135 distinct colours at 250 Ma, 982 at 0 Ma; 30-31 labels placed and moving |
| Time scrub | 250 / 200 / 100 / 0 Ma all redraw, era labels track |
| Play forward | 250 -> 243 Ma in 2.5 s at 3 Myr/s (7.0 Myr, correct) |
| Reverse | 242.5 -> 250 Ma, correct direction |
| Pan (drag) | zoom readout moves 2.2 deg/cell -> 1.9 deg/cell, view follows |
| Wheel zoom | 6 notches, readout 1.9 -> 0.82 deg/cell |
| Keyboard | Space, arrows, +/-, 0, R, T, G, [ ], , . all handled; no error |
| Themes | dark and light both render, 1127 colours in light, persisted to localStorage |
| About panel | opens, 2667 characters of prose + source links |
| Frame rate | 60.7 fps animating, 46.7 fps idle on this machine |

## Bugs found and fixed during the build

1. **Sprite key bug (the map was blank).** The glyph atlas keyed sprites on a running
   counter rather than the variant index, so keys came out `0|0, 1|1, 2|2, ...` and every
   render lookup missed. Only ~40 of 7840 cells drew.
2. **Ramp string escaping.** `RAMP_A` contained `\'` and a backtick, which made the
   measured length disagree with the intent. Replaced with pure ASCII.
3. **Labels built from the raw `LABELS`** instead of `atlas.labels`, so every anchor had
   `plateIndex === undefined` -> `rotationAt` produced NaN -> all 31 labels fell back to
   their static position at (0,0) and overlapped into what looked like mojibake.
4. **Euler round trip was wrong.** `mat_to_euler` assigned the rotation vector's X
   component to latitude and ignored Y. The 320 Ma Pangaea pole came out at
   (lon 84.8, lat 26.7) instead of (lon 14.7, lat 64.3). Fixed to
   `lon = atan2(n_y, n_x)`, `lat = asin(n_z)`; round-trip error is now 2.8e-16.
5. **Douglas-Peucker collapsed closed rings.** The closing segment of a ring is
   zero-length, so the perpendicular distance was 0 for every point and 1269 of 1271
   rings reduced to 2 points.
6. **Branch sign lost in packing.** `canonical_series` can emit a negative rotation
   angle; the packer clamped it to 0. The angle is now packed over [-180, 180].
7. **Root plate was not skipped.** Africa's own `.rot` row describes its motion relative
   to the hotspot frame, so composing it moved Africa and every continent with it.
8. **Degrees-per-cell camera wasted a third of the rows.** Fixing `d` rather than the view
   span meant a 269-degree-tall view on a 79-row grid. The camera now stores a latitude
   span and derives the cell size, so the world always fills the frame.
9. **Shoreline rim swallowed the map.** The rim was 2 raster cells wide, which at these
   landmass sizes covered everything; it is now a true one-cell edge.
10. **Engine scoping.** `Land.rasterize` destructured `atlas` from `this.atlas` (a
    property that does not exist on the atlas) instead of reading `this.atlas`.

## Second pass: flat map -> rotatable globe

The map is now an **orthographic globe** rather than a flat equirectangular
sheet, and can be spun.

- Cells are sampled on concentric **rings of constant solid angle**, not on a
  rectangular lat/lon grid, so glyphs stay square on the ground and foreshorten
  towards the limb instead of shearing towards the corners.
- The camera is `(lon, lat, theta)` where `theta` is the view's angular radius
  (6-90 degrees). Dragging across the disc's diameter sweeps ~175 degrees of
  longitude. Wheel zooms **about the cursor**: the point under the pointer is
  unprojected, the radius changes, and the globe is rotated to put it back.
- The far side of the planet is genuinely culled, not faded. Labels hide when
  they cross the horizon.
- The graticule is evaluated per cell from the projected lat/lon, so it curves
  over the sphere for free.
- Added a shaded disc under the glyphs plus an outer halo. Without it the globe
  does not read as a sphere: open ocean is deliberately near-blank so the land
  stays legible, and a field of sparse characters looks like noise, not a ball.

Verified (headless Chrome, DPR 1 and DPR 2, 0 page errors, 60.9 fps animating):
whole globe at 78 deg, spin -70 deg, zoom to 7.8 deg with the cursor anchored,
tilt to 55 deg latitude, time scrub 250/200/100/0 Ma, 24 labels placed and
culled, both themes, About panel 3519 chars. DPR 2: 2400x1512 buffer for a
1200x756 CSS box, `scaleOk: true`.

### Bugs fixed in this pass

11. **Duplicate DOM id `zoomOut`.** The HUD readout and the zoom-out button both
    used it, so `getElementById` returned the readout and the button's click
    handler was bound to a `<div>`. The zoom-out button did nothing.
12. **Ring cell count used the wrong circle.** `nCell` measured arc on the
    sphere, which is foreshortened, so the outer rings came out three cells wide
    and the globe rendered as a handful of scattered marks. It has to count
    cells along the PROJECTED ring: `2*PI*R*sin(gamma)/(sin(theta)*cellW)`.
13. **`dGamma` was inverted** and missing its radian-to-degree conversion, so
    `cellAngle()` reported 3109 degrees and the raster resolution clamped to its
    floor.
14. **HUD went stale.** It was only written from `setMa`, so zooming left the old
    view angle on screen. It now refreshes on every camera change.

## Not verified

- Physical touch on iOS/Android hardware. Chrome touch emulation was used for the
  pointer plumbing (pointer capture, pinch, `touch-action: none`), which is not the
  same as a real finger on glass.
- Display in Safari or Firefox. Only Chromium was driven.
- Behaviour on a 4K or ultrawide viewport; 1600x950 and 1440x900 were exercised.
- Frame rate on low-end hardware. 60 fps here is not a guarantee elsewhere.
- Deep-time positions for plates other than North America and Africa. See the
  limitation above; this is a property of the published model reduced to rigid
  coastlines, not of the rendering.

