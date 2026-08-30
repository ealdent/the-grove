# Stillroom Shaft — sunlight-in-a-dark-room shader

## Goal
A new fragment-shader experiment: a dark, still room cut by a single
sunlight shaft, with drifting dust motes and stark contrast. Standalone
demo page plus a live preview tile on `shaders/index.html`.

## File
- `shaders/stillroom-shaft-shader-demo.html` — fullscreen WebGL study
- `shaders/index.html` — experiment 06 card + miniature preview program

## Plan
- [x] Write the fullscreen demo (one pass, no textures, no backticks in GLSL)
- [x] Tile + preview shader + still fallback on the shaders index
- [x] Syntax-check extracted `<script>` with `node --check`
- [x] Compile-check both fragment programs in a headless WebGL context
- [x] Screenshot / pixel-probe the shaft (bright diagonal) vs the room (near-black)
- [x] Commit and push to `origin/main`

## Review
- Files: `shaders/stillroom-shaft-shader-demo.html`, tile + `SUN_FRAG` on `shaders/index.html`.
- Pushed to `origin/main` as `a83e84b`.
- `node --check` clean on both extracted scripts. No backticks in GLSL.
- Headless SwiftShader screenshot of `?pin=8`: dark room, shuttered golden shaft, dust motes, chair silhouette. Midframe contrast p95/p05 = 93.8; shaft_upper luma 108 vs dark corners ~1–2.5; shaft is warm (r > b).
- Index Experiment 06 card live-previews the same look. Interactive pass: SHAFT dims/brightens, DUST clears/densifies, Pause/Resume, click-through from the index.

## Visual spec
- Dark plaster walls, wood floor; no visible window or fixture
- One warm volumetric shaft from the top-left of the screen
- Soft leaf-like fbm dents in the beam, not shutter slats
- Dust motes that wander freely and catch in the beam
- Stark contrast: crushed shadows, bright core, floor patch
- Reduced-motion still frame; `?pin=` and `window.__demo` for harnesses

## Follow-up (no source, no slats, freer motes)
- [x] Hide the window / light source; origin off the top-left of the frame
- [x] Remove periodic slat bands; replace with diffuse leaf fbm
- [x] Per-mote wander so dust moves more freely
- [x] Match the index preview and copy
- [ ] Re-verify: no fixture, one continuous shaft, motes wander
