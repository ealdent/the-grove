# Night lighting + glass redo (greenhouse-todo)

## Problems
1. Night is too dark globally: `environmentIntensity` floor 0.005, exposure 0.45, all fills off → only tight lamp cones visible. Can't see floor, tables, pots.
2. Lamp spotlights: ~28° half-angle, distance 6, decay 2.2 → tight puddle of light right under the bulb. Hood is a tiny cone and the bulb hangs below it (no parabolic-reflector behavior).
3. Glass is unlit `MeshBasicMaterial` with a bright grime map at opacity 0.24 — at night it renders as a constant pale-green wash that occludes the dark forest (fireflies, eyes).
4. All panes share one material; want clearer vertical wall glass vs. more diffuse/translucent roof glass.

## Plan
- [x] Reshape lamp hood into a wider parabolic shade (LatheGeometry, rim ~0.30 m), tuck the bulb up inside it at the focus.
- [x] Widen spotlights to ~51° half-angle, decay 1.6, distance 10, retune night intensity so the whole 2×3 m table + nearby floor is lit, soft penumbra for rich edge falloff.
- [x] Decouple the visible light-shaft cone from the spot angle (shaft starts at the shade rim, modest flare).
- [x] Night ambient floor: dim cool hemisphere moonlight, environmentIntensity floor 0.03, exposure 0.62 at night, warm interior bounce stays on low. Shades glow faintly warm at night.
- [x] Split glass into wall material (clearer, lighter grime, opacity 0.15) and roof material (greener, more diffuse, opacity 0.32).
- [x] Darken glass color + drop opacity with nightness so the forest reads through the panes after dark.
- [x] Slightly thinner night fog (0.009 total vs 0.012) so the woods stay visible.
- [x] Verify: node --check passes, greenhouse jest suite passes.

## Review
- Lamps: hood is now a wide parabolic reflector dish (LatheGeometry, quadratic
  profile, 0.30 m rim) with the bulb nested at the focus instead of dangling
  below. Spotlights widened from ~28° to ~51° half-angle with decay 2.2→1.6 and
  distance 6→10, so each cone covers its whole 2×3 m table with soft penumbra
  edges and spills a dim pool onto the aisle floor. The additive haze cone was
  decoupled from the light angle so it still reads as a shaft, not a wall.
- Night floor: cool moonlit hemisphere (0.12), IBL floor 0.005→0.03, exposure
  0.45→0.62, warm bounce kept on low — navigable, but lamp pools still dominate
  and corners stay dark.
- Glass: split into wall glazing (clearer: lighter grime, opacity 0.15) and
  roof glazing (greener, heavier film, opacity 0.32). Both are unlit materials,
  so updateSunAndLighting now dims their tint (×0.22) and opacity (×0.35) with
  nightness — the forest, fireflies and eyes read through the panes after dark.
  Night fog thinned (0.012→0.009) and the painted backdrop keeps a moonlit
  trace (0.06→0.11 floor).
- Verified with node --check and the greenhouse jest suite (passes). No
  headless browser in this environment for a visual smoke test.

---

# (done) Worn greenhouse in a haunted forest — visual overhaul

Completed earlier; see git history. Forest, wet interior, vines, grow/wither,
lighting polish all landed in `utils/greenhouse-todo/app.js` with jest suite
passing.

# (done) MYCELIA — Guardians of the Glowing Grove (tower defense)

Single-file, dependency-free tower defense at
`tower-def/fugu-xhigh-tower-def.html`. Greenfield build.

- Theme: bioluminescent fungal grove; cute glowing mushroom towers vs. the Blight.
- Random winding mycelial track generated each game (non-self-intersecting).
- 5 towers (Dartcap, Puffshroom, Frostfern, Sparkcap, Titanshroom), 4 upgrade
  tiers each (single / splash / slow-aura / chain-lightning / sniper archetypes).
- 8 enemy types with distinct speed/HP/armor/heal/ghost traits + 22 waves
  (bosses at 10/18/22); HP scales with wave.
- Between-wave building & upgrading, economy (spores), sell for 70% refund.
- Polished responsive UI, WebAudio SFX, particles, floating text, speed/pause/mute.
- Verified in headless Chromium: full 22-wave victory, all towers max-tier,
  desktop + mobile layouts, zero console/page errors.

---

# SVG Forest — fugu-ultra-high fresh build (ACTIVE)

## Goal
Create a new single-file, pure-SVG, first-person exploration game at `svg-forest/fugu-ultra-high-svg-forest.html`, add it to `svg-forest/index.html`, then commit and push to `main`.

## Hard requirements
- [x] Fresh implementation without using other repo game files or prior conversation history.
- [x] Single HTML file with inline CSS/JS and pure SVG rendering only.
- [x] No `<canvas>`, WebGL, Three.js, or external image assets.
- [x] Creative cohesive theme with sky, ground, and at least 2–3 stylized SVG props.
- [x] First-person 3D/2.5D exploration with indefinite/dynamic world.
- [x] Depth illusion via distance scaling/sorting and efficient SVG creation/cleanup.
- [x] Subtle movement head bob.
- [x] Desktop WASD/arrow controls plus mouse click-drag look.
- [x] Mobile responsive layout with two HTML/CSS virtual joysticks.
- [x] True multitouch: left joystick moves while right joystick turns simultaneously.
- [x] Prevent default mobile gestures.
- [x] Add a tile to `svg-forest/index.html`.
- [x] Verify, commit, and push to `main`.

## Plan
- [x] Write a fresh validation script in `/tmp` and run it red before implementation.
- [x] Implement the game file from scratch with SVG DOM pooling and projected 2.5D props.
- [x] Update only the required index tile.
- [x] Run static and syntax verification plus git review.
- [x] Commit and push only the requested game/index changes and this task record.

## Review
- Built `svg-forest/fugu-ultra-high-svg-forest.html` as a fresh pure-SVG first-person exploration game named Chroma Tidelands.
- Implemented deterministic cell/chunk generation, distance projection, scale/depth sorting, SVG group pooling, ground redraw cleanup, and movement head bob.
- Added desktop keyboard/mouse controls and independent pointer-id mobile joysticks so walking and turning can happen at the same time.
- Added the tile to `svg-forest/index.html`.
- Verification run: `/tmp/validate_svg_forest.py` passes and inline JavaScript `node --check` passes.
