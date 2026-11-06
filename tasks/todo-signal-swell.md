# Signal Swell — plexus wave shader

## Goal
A new shader experiment after the orange network-wave band on bombora.com
(their `Bombora_Waves_5.mp4`, a pre-rendered 18 s loop): a jittered triangle
mesh riding a slow swell, tiny binary digits hovering over the far crest,
shallow depth of field (far crest sharp, near rows melting into soft blobs),
orange ink on white. Our own live, procedural version: no video, no assets.

## Files
- `shaders/signal-swell-shader-demo.html` — fullscreen demo
- `shaders/index.html` — experiment 07 card + live tile
- `README.md` — Shaders section entry (by hand, never `update_readme.py`)

## Approach
- One WebGL program, one draw call, no textures. Every edge, node dot and
  bit label is a quad in a static buffer; the vertex shader places it on the
  swell (sum of warped directional sines), projects it, and sizes it by its
  circle of confusion. The fragment shader draws an energy-conserving
  profile (line ink ~ w0/r, dot ink ~ (r0/r)^2), so defocus spreads ink
  instead of adding it.
- Every layer is the same orange, laid with premultiplied "over"
  (`blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`), which is order-independent when
  the colour is constant: overlaps saturate toward the ink, never past it.
  (A first pass multiplied Beer-Lambert ink into the paper; dense crests
  went brown, unlike the reference.)
- The swell table generates both the GLSL and a JS copy, so click-to-focus
  can find the node under the pointer and rack focus to its depth.

## Plan
- [x] Demo page: mesh builder, vertex/fragment program, controls (Focus,
      Aperture, Swell, Pause), click-to-focus, pointer parallax, `?pin=`,
      `window.__demo`, reduced-motion still
- [x] Index card + tile drawing the same program inside the shared canvas
      (restore blend/attribute state after), no-WebGL still
- [x] README entry (plus the missing 05/06 lines and the stale "all four
      previews" subtitle)
- [x] `node --check` on extracted scripts; no backticks in GLSL
- [x] Real-browser check: console clean, screenshot vs reference, controls,
      click-to-focus, phone width, index tile + neighbours still render
- [x] Commit and push to `origin/main`

## Review
- Mesh: 4,536 nodes, 13,392 edges, 871 bit labels = 18,799 quads, one
  `drawArrays`. 120 fps (vsync cap) at 2048x1536 in the Browser pane, and
  still 120 with 11 draws per frame, so one draw is well under 0.75 ms.
- Rendering bugs found by looking at native-resolution crops, not the
  downscaled screenshot:
  - Dither keyed only to the pixel: twenty stacked blurred quads added the
    same error twenty times, a visible speckle. Now keyed to the quad too.
  - Edges as full-strength capsules: their round caps stacked into a bokeh
    ball wherever six edges meet. Now a true blurred segment (perpendicular
    profile times the running integral along it, half strength at each end).
  - Glyph ink normalised like a line (s/r) overpowered once the blur
    outgrew the glyph; scaled by stroke length over radius as well.
  - Near node dots carried world-size ink into big discs; size capped.
- The tile's scene block is a verbatim copy of the demo's (between the
  "copied verbatim" markers in `shaders/index.html`), guarded by
  `node --test tests/signal-swell-copy.test.mjs` (fails on a one-constant
  drift). Only the camera framing (tighter lens, higher horizon) and the
  hover focus pull differ, and those live outside the copied block.
- Verified: WebKit (Browser pane) and Chromium/ANGLE (headless Chrome,
  SwiftShader) both compile and render the demo and all seven gallery tiles;
  console clean. Click-to-focus racked to 3.3 on a foreground click;
  Aperture 0 + Swell 0 gives a flat, fully sharp sheet; Pause freezes time;
  375x812 layout fits; tile hover pulls focus from the crest to mid rows.
- Not verified: an actual phone GPU, Firefox.
