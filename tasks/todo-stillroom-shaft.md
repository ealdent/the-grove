# Stillroom Shaft — sunlight-in-a-dark-room shader

## Goal
A new fragment-shader experiment: a dark, still room cut by a single
sunlight shaft, with drifting dust motes and stark contrast. Standalone
demo page plus a live preview tile on `shaders/index.html`.

## File
- `shaders/stillroom-shaft-shader-demo.html` — fullscreen WebGL study
- `shaders/index.html` — experiment 06 card + miniature preview program

## Plan
- [ ] Write the fullscreen demo (one pass, no textures, no backticks in GLSL)
- [ ] Tile + preview shader + still fallback on the shaders index
- [ ] Syntax-check extracted `<script>` with `node --check`
- [ ] Compile-check both fragment programs in a headless WebGL context
- [ ] Screenshot / pixel-probe the shaft (bright diagonal) vs the room (near-black)
- [ ] Commit and push to `origin/main`

## Visual spec
- Dark plaster walls, wood floor, high window with shutter slats
- One warm volumetric shaft (absorb + emit; not additive wash)
- Slow dust motes that only catch in the beam
- Stark contrast: crushed shadows, bright core, floor patch
- Reduced-motion still frame; `?pin=` and `window.__demo` for harnesses
