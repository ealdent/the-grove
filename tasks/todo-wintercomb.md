# WINTERCOMB — Pure-SVG First-Person Exploration Game Plan

## Theme & Lore
- **Title**: **WINTERCOMB** (*The Hived Sun*)
- **Model**: Gemini 4 Carbon (`High` effort) -> `svg-forest/gemini-4-carbon-high-svg-forest.html`
- **Backstory**:
  Seven autumns ago, an early Frost fractured the sky's ecliptic. Before the afternoon sun could freeze and fall as ash, the Keepers opened every skep in the valley. For forty days the Great Swarm climbed the cold air and drank October's failing sun drop by drop—storing its noon-light inside monumental beeswax combs. Now the valley endures a century-long twilight, warmed only by what the bees hived away. As the Night Apiarist, you wander endless frost-silvered heather meadows beneath the Hollow Corona, practicing the old custom of *Telling the Bees*—whispering news of the sleeping world to dormant Shrine Skeps so the swarm keeps dreaming until spring returns.

## Architecture & Visual Design (100% Pure SVG)
- [x] **Zero `<canvas>`, WebGL, Three.js, or external assets**: All visuals built from inline `<svg>`, `<defs>`, `<linearGradient>`, `<radialGradient>`, `<clipPath>`, `<polygon>`, `<path>`, `<circle>`, and `<ellipse>`.
- [x] **Compositor & Performance Discipline**:
  - Dynamic responsive `viewBox` (`vh = 900`, `vw` scaled to viewport aspect) wrapped in `<g clip-path="url(#vpClip)">` so no geometry escapes viewport bounds.
  - Zero CSS animations or transitions inside `#scene`; all motion (wingbeats, smoke curls, honey-glow breath, swaying lanterns, 3D pollen motes) driven cleanly from JS in `requestAnimationFrame`.
  - Distance atmospheric perspective achieved by color-mixing prop fills/strokes toward the plum-amber horizon haze color (no `<g opacity>` over separately transformed children, no ghost-transparent overlapping props).
  - Pause loop cleanly on `blur` / `visibilitychange` (with `?alwayson=1` opt-out for automated harnesses) and guard `dt === 0` against `NaN`.
- [x] **Sky & Ground**:
  - Deep buckwheat-velvet to smoked-plum to beeswax-amber horizon sky gradient.
  - **The Hollow Corona**: Frosted hexagonal eclipse ring where the sun once sat, with parhelia (sundogs), ecliptic meridian arcs, and 360°-wrapping apiary star constellations + distant hexagonal comb-ridge silhouettes.
  - **Rolling Frost-Heather Ground**: Undulating terrain heightfield `groundY(x, z)` with near-plane-clipped 3D-projected hexagonal honey-glow ground plates, frost stepping-stones, and swaying foreground heather tufts.
- [x] **Stylized Pure-SVG Props (Pooled & Chunk-Streamed)**:
  1. **Colossal Comb-Spires** (3 architectural variants: Royal Stepped Spire, Twin-Pillar Honey-Bridge Gate, and Canted Cracked Ecliptic Prism) with capped ivory cells, glowing molten-sun cells, and swelling honey droplets.
  2. **Propolis Lantern-Trees** (2 botanical silhouettes: Orchard Mother-Oak & Apiary Birch) with gnarled plum-bark boughs, silver-frosted crown rims, and swaying hexagonal beeswax brood-lanterns anchored directly to boughs.
  3. **Telling-Shrine Skeps**: Coiled straw skeps with winter straw hackle caps and draped Telling-cloths on oak stands; approaching within 6.8m "Tells the Bees," waking golden noon-light, orbiting scout-bees, optional Web Audio harmonic chimes, and 12 whispered verses.
  4. **Keeper's Smoker-Censers**: Wrought-brass bellows tripods with glowing ember grates and animated Bezier ribbons of silvery-lavender soothing smoke.
  5. **Cathedral Sun-Bees**: Slow, giant glass-winged bees patrolling in 3D figure-eight curves with JS-animated veined wings and glowing honey-filled abdomens.
- [x] **Controls & Mobile Multitouch**:
  - Desktop: `WASD` / `Arrow` keys to walk & turn, `Shift` brisk walk, mouse click-and-drag to look (`yaw` + `pitch`).
  - Mobile: Overscroll/pinch/pull-to-refresh disabled; dual bottom-corner HTML/CSS virtual joysticks (`#joyLeft` forward/backward, `#joyRight` turn left/right) tracking independent `touch.identifier`s for simultaneous multitouch walk + turn, plus independent open-sky touch-look.
- [x] **Gallery Integration & Verification**:
  - Added `.badge--wintercomb` and alphabetical `Gemini 4 Carbon` (`High`) card to `svg-forest/index.html` (between `Gemini 4 Argon` and `Gemini 4 Neon`, updating fallback count to `Forty-eight`).
  - Verified JS syntax, zero `<canvas>`/`<img>` tags, chunk streaming & pool reclamation over a 2.5 km multi-sector walk, zero `NaN` SVG attributes, desktop keyboard/drag, and simultaneous mobile multitouch joystick independence.
  - Committed with explicit pathspecs and pushed to `main`.

## Review & Verification Notes
- **Pure-SVG Audit**: Verified `0` `<canvas>` tags, `0` `<img>` tags, `0` CSS `@keyframes` inside `#scene`, and `0` `NaN`/`undefined` SVG attributes across initial bootstrap and a 20-leg (~2.5 km) exploration sweep.
- **Chunk Streaming & DOM Pooling**: Active chunks remain bounded (`81` steady-state `22m × 22m` chunks around the player), total allocated pooled prop `<g>` nodes plateaued at `110` across 2.5 km of streaming with ~649 total live SVG nodes in `#scene`.
- **Controls & Lifecycle**: Verified `WASD`/Arrows movement, head-bob engagement, Shrine Skep proximity awakening ("Telling the Bees" verses), `blur`/`focus` loop pause/resume, and simultaneous independent `touch.identifier` tracking on `#joyLeft` and `#joyRight` (including independent single-thumb release while the other thumb stays active).
- **Coverage Note**: Verified deterministically via Node VM + DOM/SVG harness (`verify-wintercomb.mjs`); live GPU window frame-capture was not invoked per session browser-tool rules.
