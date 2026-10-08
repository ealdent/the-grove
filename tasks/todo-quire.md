# Quire (svg-forest, Haiku 5.5 Max)

Goal: single-file, pure-SVG first-person walk through an endless paper country.
Deliverable: `svg-forest/haiku-5.5-max-svg-forest.html`, a tile in `svg-forest/index.html` (alphabetical by `data-model`), commit and push to `main`.
Project: the-grove / svg-forest
Constraints: no canvas, WebGL, or images. No opening, listing, or running other svg-forest games until this one is finished.
Non-goals: audio, save files, multiplayer, collision beyond the props.
Proof required: headless Chrome over CDP at desktop 1280x800, phone 390x844 dpr2 with touch, landscape 844x390, tablet 820x1180. Console clean. Two-thumb walk and turn. Shrine lighting. Soak walk with bounded DOM. Frame-rate probe. Screenshots reviewed by eye.
Risks: DOM reorder cost (LIS diff keeps moves low), NaN in camera state blanking the scene (guarded), iOS gesture events (prevented), Android pinch and pull-to-refresh (touch-action plus touchmove).

## Lore

QUIRE: a country folded from one unbound book.

When the Tide came for Halden, the Scrivener folded the whole land into a quire and pressed it shut. Rivers became ridges. Forests became stacked green paper. The last cranes were folded from spare margins to watch the creases.

The book has been closed for a thousand years. At dusk the creases warm and soften, and a walker can open the country a few steps at a time. The player is a Folio. Shrines along the margins restore what the Tide erased. There is no last page.

## Design

- Projection: pinhole, yaw and pitch, principal point at (W/2, 0.56H), focal length min(0.85H, 0.9W).
- Ground: world-fixed accordion folds (three tones) and horizontal creases, clipped to the near plane.
- Sky: gradient, pinhole stars, paper moon, folded ridges sampled by azimuth, horizon mist band.
- Props: pine, stone, shrine (lit on visit), lantern-lily, crane flocks. One pooled `<use>` per visible prop. DOM order by radial distance, reconciled with a longest-increasing-subsequence diff.
- World: 9-unit cells, hashed, value-noise forest density, start clearing, opening shrine at (4, 13).
- Controls: WASD or arrows walk, A/D strafe, arrows or Q/E turn, mouse drag looks. Touch: left stick walks, right stick turns, each tracked by pointer id.

## Checklist

- [x] Plan and lore
- [x] Game file
- [x] Headless verification
- [x] Independent review, findings applied
- [x] Index tile
- [ ] Commit and push

## Verification

Headless Chrome over CDP, with the `__quire` hook behind `?harness`:
- Desktop 1280x800: walk 4.65 units in 1.5 s, turn 2.3 rad in 1 s, mouse drag 0.252 rad yaw, shrine lit and lore toast shown.
- Soak: 90 s from the origin across 90 distinct cells and 311 units. Node count peaks at 141 against a cap of 330. Cell window stays at 225. DOM order holds in all 90 samples (far to near).
- Phone 390x844 dpr2 with touch: two thumbs down (pointer ids 3 and 4), walking and turning together, sticks reset on release, no horizontal scroll.
- Landscape 844x390 and tablet 820x1180: play screens render; quality steps to the touch default.
- Gestures prevented (touchmove, gesturestart/change/end, ctrl-wheel). Computed touch-action none.
- NaN guard: a NaN step leaves the state finite and the scene drawn.
- Frame rate 60 fps, script 0.26 ms per frame. Console and exceptions clean.
- Hook absent without `?harness`.

## Sort key measurement

Painter order by view depth (not radial distance) fixes 0.8 to 2% of overlapping sprite pairs. Cost while turning at 2.3 rad/s, measured in Chrome:
- 1x: DOM moves 25 per frame (max 35). Task time 1.82 ms per frame, against 1.51 ms with radial order.
- 4x CPU throttle: task time 6.3 ms per frame, against 5.2 ms with radial order. Still inside a 16.7 ms frame.

## Review

Independent read-only review: 10 findings. Applied all of them:
1. Props fade near the walker and near the draw distance, so none pop.
2. Painter order by view depth (measured above).
3. Ground folds and creases reach twice the draw distance. Checked at low quality, with no seam at the horizon.
4. Mouse-drag look ends when no button is held, on lost capture, and on window blur.
5. NaN guard covers phase and amplitude too. Joystick input is sanitised, and a zero-size stick is ignored.
6. A stick whose pointer was lost recovers on the next touch.
7. HUD and hint get a translucent backing for legibility.
8. Touch is detected from the primary pointer, and switches on the first finger. A pen no longer drags the look.
9. At the node cap, idle nodes are retargeted across types instead of dropping props.
10. The verification hook is behind `?harness`.

Not verified: real devices, iOS Safari gesture events, the landscape-phone intro scroll, and enclosed pockets from overlapping collision circles.
