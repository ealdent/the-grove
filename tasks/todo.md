# Shaders section + Greenhouse promotion

## Plan

- [x] `git mv` the three shader demos from `utils/` into a new `shaders/` directory
- [x] `git mv utils/greenhouse-todo` → `greenhouse-todo/` (top level); untracked dot-scripts moved with it
- [x] Update `.gitignore`, `jest.config.mjs`, and the ui-vines path comment in the vines demo
- [x] Create `shaders/typewriter-letter-drift.html` — standalone page for the learn/ tile border shader (WebGL border experiment 04), with controls (glyphs, drift, ink, aura, card width, pause, re-ink)
- [x] Create `shaders/index.html` — shader-heavy gallery: one fullscreen WebGL canvas, domain-warped iridescent background + four live scissored preview shaders (ember / holo / vines / typewriter), hover excitation, live HUD, reduced-motion stills, no-WebGL fallback
- [x] Main `index.html`: Shaders badge with its own live spectral WebGL border around just that tile; Greenhouse To-Do badge with inline greenhouse SVG icon
- [x] `utils/index.html`: removed greenhouse + 3 shader cards and their CSS
- [x] `README.md`: Shaders section (4 entries), Greenhouse To-Do top level, Utils pruned
- [x] Jest: greenhouse suite passes from new path (`npm test` pattern; the arcade/mother-os-defense failure is pre-existing and unrelated)
- [x] Headless-verified with swiftshader WebGL: main index (both new tiles render, border shader live), shaders gallery (all 5 programs compile, previews render, HUD live), typewriter page (drift renders, fallback hidden), utils index clean
- [x] Commit + push to main

## Review

- `shaders/` now holds the three moved demos plus two new pages. The gallery renders its background and all four card previews on a single WebGL context via scissored viewports — 5 fragment programs, one canvas.
- Greenhouse To-Do lives at `greenhouse-todo/` top level; jest config, .gitignore, and the vines demo comment all updated. Its local probe dot-scripts moved with the directory.
- Screenshots verified via headless Chrome + swiftshader (see memory note reference_headless_verify). Two visual iterations: typewriter preview rewritten from border-frame glyphs (read as a starburst) to upright perimeter-scattered type; vines fireflies quieted at rest.
