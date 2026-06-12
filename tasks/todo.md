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
