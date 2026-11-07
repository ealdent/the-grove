# Signal Swell — plexus wave shader

## Goal
A new shader experiment: a jittered triangle mesh riding a slow swell, tiny
binary digits hovering over the far crest, shallow depth of field (far crest
sharp, near rows melting into soft blobs), orange ink on white. Live and
procedural: no video, no assets.

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

# Palettes and dark mode (2026-11-06)

## Goal
A dark version of the demo plus an easy colour-scheme control: cobalt
blue, warning-light red, construction yellow, royal purple and friends,
quick to try and remembered.

## Approach
- A palette is one ink over one paper per theme, since every layer is the
  same ink; the shader needed no change, only its two colour uniforms.
  The palette table and scheme resolver sit inside the copied scene block,
  so the gallery tile shares them.
- Hazard Yellow turns to signage in the light theme: black ink on
  construction yellow (yellow ink on white paper all but vanishes).
- Custom inks keep their hue but are mixed toward black or white until
  they reach 3:1 against their paper.

## Plan
- [x] Palette table (7 presets) + custom ink + resolver in the scene block
- [x] Theme tokens for both themes; a head script sets `data-theme` before
      first paint (link `?theme=`, then saved, then the system)
- [x] Ink strip (radio chips, each a drop of ink on its paper) + custom
      colour chip + sun/moon switch (`role="switch"`); saved in
      localStorage; picking the system's own theme clears the override
- [x] Canvas crossfades paper and ink (~0.5 s; instant under reduced motion)
- [x] Scheme UI runs before WebGL starts, so the fallback page follows it
- [x] Gallery tile reads the saved scheme (again on pageshow, storage and a
      system theme change); the card accent takes the palette's dark ink
- [x] Tests: `tests/signal-swell-palettes.test.mjs` (every preset >= 3:1 in
      both themes, resolver fallbacks, custom legibility); copy test passes
- [x] Real-browser check in the pane and headless Chrome; README line

## Review
- Pane (ANGLE Metal): real clicks on the Cobalt chip and the theme switch,
  ArrowRight across the radio group, reload persistence, Hazard light and
  dark, custom ink through the picker's `input` event (a near-black pick on
  dark paper lifts to #646973). Canvas paper pixel matched the scheme after
  the crossfade; console clean across every load.
- Phone width (375x812): ink strip and switch share one row, no overflow;
  a 6 px label misalignment (switch taller than the chips) fixed by giving
  the chip row the switch's height.
- Headless Chrome (SwiftShader): all 14 palette/theme pairs render; the
  gallery tile follows a seeded scheme.
- The hidden pane pumps no rAF on the gallery page, so its tile was checked
  in headless Chrome only.
- Not verified: reduced-motion paths at runtime (reviewed in code), the
  native colour picker UI itself, Firefox, a phone GPU.

# Download with your settings (2026-11-06)

## Goal
Set the sliders, ink and theme, press Download, and get the swell as a file
of your own that draws exactly what the page showed.

## Approach
- One file, `signal-swell-<ink>-<theme>.html`: opens full-window anywhere,
  works offline, and its scripts lift into any page.
- No second copy of the renderer. The demo's renderer becomes an engine
  section (`createSwell(target, settings)`), the demo drives it from its
  panel, and the download is built from the demo's own script text: the
  scene sections (minus palettes, moved to the end of the shared block) and
  the engine, verbatim, plus a settings object with a note on every line.
- The engine also fills a plain element (behind its content), takes any CSS
  colour or "transparent", rests while off screen or settled, and returns a
  controller (`set`, `paused`, `destroy`).

## Plan
- [x] Move palettes to the end of the shared block (hexRGB to the helpers);
      re-sync the gallery copy; END marker becomes the engine header
- [x] Engine section; demo panel, hooks and fallback rebuilt on it
- [x] Download button beside Pause, and the page builder
- [x] Test: build a download from the file on disk; scripts parse, settings
      carried, engine defines itself with nothing from the page
- [x] Headless Chrome: real click downloads the file; it matches the demo
      pixel for pixel at the same moment; element mode over a page background
- [x] Pane (WebKit): button layout desktop + phone, download intercepted,
      exported page renders; README line

## Review
- Node: `tests/signal-swell-download.test.mjs` builds a download from the file
  on disk: one page, three scripts that parse, the settings carried, both
  sections verbatim, and the engine defines itself with no page at all.
  Copy and palette tests pass with the shared block's new end marker.
- Headless Chrome (CDP, real clicks): Cobalt chip + theme switch + a click
  on the swell (focus 8.4 -> 6.3, slider followed) + sliders; Download saved
  `signal-swell-cobalt-blue-light.html` (30.9 KB). Opened under reduced
  motion it holds at t = 37.5 with every setting; against the pinned demo
  with the panel hidden, 0.12% of pixels differ, none by more than 2%
  (frame dither). Running free it moves; element mode over a gradient:
  canvas at z -1 under the heading, 52% of it see-through, a click pulls
  focus, time stops while scrolled away and resumes, destroy() removes it.
- Paused and settled, the demo draws nothing (0 draws in 2 s); a crossfade
  or the camera easing redraws until it lands. Pause/Resume and the gallery
  tile unchanged.
- Pane (WebKit, hidden): Pause and Download share a row at 375 px (155 px
  each, no overflow); a real click on Download (save intercepted) handed
  over `signal-swell-phosphor-green-light.html` with the panel's settings;
  the downloaded cobalt page renders at dpr 2; console clean.
- MIT notice (Copyright (c) 2026 Jason Adams) in the download's header and
  on the engine script's first line, so a copied engine keeps it; tested,
  and a real click in the pane handed over both lines. The repo itself
  stays unlicensed.
- Not verified: a real save dialog in Safari or iOS (the pane intercepted
  the save; Chrome's real download path was exercised headless), Firefox.
