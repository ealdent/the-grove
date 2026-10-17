# SVG Forest index redesign

Goal: replace the parchment "SVG Adventure" index with a theme that matches the games: a night-time first-person walk, rendered by a shader behind the page.
Deliverable: `svg-forest/index.html` only. Commit and push to `main`.
Project: the-grove / svg-forest
Constraints: keep the tile markup copyable for the recurring per-model prompt (`a.badge.badge--<theme>` with `data-provider/model/effort`, ribbon, icon, title, desc, foot); keep the provider/model filters; no build step; one WebGL context.
Non-goals: per-game screenshots or thumbnails; changing any game; listing `ox-alpha-xhigh-svg-forest.html` (committed as WIP, never tiled).

## Design

- Background: one fixed WebGL2 canvas. A raymarched forest (5 m hashed cells: pines, giant glowcaps, crystal spires, rune stones, small caps and crystals; the trail stays clear), wisps floating over the trail, height mist with drifting patches, twin moons, stars and a rayed aurora. Fireflies and spores are additive point sprites depth-tested against `gl_FragDepth` from the forest pass.
- The camera walks the trail by itself with head-bob. W/S walk, A/D turn, dragging the trailhead looks around, and scrolling walks deeper while the view tilts up and dims behind the cards.
- Each world relights the forest from its two theme colours: on hover or focus with a mouse, and as its card crosses the middle of the screen on touch.
- Type follows the games' title cards: Cinzel caps, EB Garamond, JetBrains Mono for hints and labels.
- Resolution scale adapts to frame time (with a ceiling after any drop); shaders compile in parallel where supported; context loss hides the canvas and a restore rebuilds it; no WebGL2 falls back to a CSS night gradient; reduced motion renders on demand only.
- Tiles: copied verbatim from the old page, with `h2` -> `h3` (under the new "The Worlds" heading) and "Play now" -> "Walk in". Theme colours are now one rule per theme: `.badge--x { --c1: var(--x); --c2: var(--x-light); }`.

## Checklist

- [x] Contact sheet of all 40 game files to calibrate the theme
- [x] Shader scene, palettes, motes
- [x] Page layout, cards, filters, hero
- [x] Browser pane: desktop 1024 and 1440, phone 390x844, relit palettes
- [x] Headless CDP checks
- [x] Independent review, findings applied
- [x] Commit and push

## Review findings and fixes

- High: an adaptive resize inside a frame called `wake()` and started a second rAF chain (six after five drops). `wake()` now does nothing while a frame runs; probes show one callback per vsync through every drop.
- High: halos were cut to the bounding cylinders (glow only accumulated past the early-out). Glow now comes from stand-in spheres/capsules measured before the early-out; caps and crystals have round halos.
- Adaptive quality: learns the display cadence from 12 empty frames first (a 30 Hz power-save rate no longer drives the scale to the floor), clamps the scale to the pixel cap, lets old drops expire, restores steps/lights above 0.55, skips samples after a wake and while paused, and holds a still frame if the floor still misses budget.
- Pause/play button (WCAG 2.2.2), remembered in `localStorage`; paused or reduced motion freezes the clock, the walk and the scroll parallax. Half rate behind the cards or after 45 s idle, loop stops after 3 min idle.
- Filter toggles announce their value again (`aria-labelledby` label + current); visible focus rings on toggles and options; small mono text at 0.7 alpha and 11-12 px with shadows and scrims.
- Smaller fixes: card top line (paint containment clipped `top:-1px`), context-loss guard in `checkReady`, unknown `data-provider` maps to Other, hero text selectable (drag-to-look starts off the text), near-miss hits when steps run out, pine tips no longer clipped, fireflies follow the facing direction, no time wrap, no-WebGL hides the forest-only copy, focus-out restores a hovered card's light.

## Verification

- GPU cost on an Apple M5 Pro (fenced with a 1-pixel read): 4.7 ms per frame at 1024x768, 3.0 ms at the default 0.72 scale, 1.0 ms for a 390x844 phone at 0.75. Main thread while walking: about 0.06 ms script and 0.05 ms style per frame.
- Headless Chrome (SwiftShader, `?q=0.2`), 28/28: auto-walk, W speed, tab order (back, pause, descend, two filters, first card), focus ring, focused card relights the forest, dropdown keyboard (ArrowDown opens on the active option, Enter selects and refocuses, Escape closes), filter reset, scroll walk and dim, drag-to-look, context loss and restore, pause/play with storage, no overflow at 1280, reduced motion (one draw, idle loop, relight animates then stops, scale untouched), phone touch relight and default light back at the trailhead, no-WebGL fallback, no page errors.
- Fake-clock probes: 30 Hz cadence keeps one callback per vsync and climbs to the 0.85 cap; slow frames step 0.72 -> 0.34 and then stop on a still frame with the button showing play.
- Layout at 320x568, 375x667, 568x320, 740x360, 1024x600, 3440x1440: no overflow; the pause button covers no line of text.
- Text contrast over rendered frames (5 positions x 4 palettes): medians 4.5-8.5 for the small labels (were 3.0-3.8).

## Safari / iOS follow-up

A WebKit pass (iOS 26.5 simulator, Mobile Safari at 390x844) found the shader compiling and linking with empty logs, 60 fps, and relight, pause, reload, toolbar collapse and context loss all working. It also found two defects, now fixed:
- The pause button was inside `.hero { z-index: 1 }`, so the fixed button could not rise above `.worlds` and sat under the cards once you scrolled (all browsers). `.hero` no longer sets a z-index; the button stays second in tab order. Proven with `elementFromPoint` at the button centre while cards scroll under it: card on top on 3a253bb, button on top now, in headless Chrome (1280x800, 390x844) and in Mobile Safari (four scroll positions).
- Safari 26 paints the strips around its floating toolbar from a fixed element's `background-color`; the canvas had none, so page background showed with a hard edge. `#world` now has `background-color: var(--night)`.
- Also: the "Choose a world" drip stops while paused (`html.is-still`), and the pause button's hover ring only applies on hover-capable pointers.
Desktop Safari stays untested (it needs "Allow remote automation" in Safari's Developer settings).
