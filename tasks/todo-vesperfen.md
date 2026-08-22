# Vesperfen — pure-SVG first-person exploration (GLM-5.3, max)

Deliverable: `svg-forest/glm-5.3-max-svg-forest.html` + index tile + commit/push.
Constraint: no canvas/WebGL/images — everything is SVG. Do not read other games
in svg-forest/ until finished (index read only for tile format).

## Lore (settled)
The lantern-city of Marrowlight chose drowning over darkness when the world's
tide-clock struck its final hour. The fen has kept that hour ever since. You are
the Warden of Small Lights walking the shallows: reeds hum where the city's
music settled, drowned chapels hold their rose-windows dark until a keeper
comes near. Mechanic: proximity wakes rose-windows (flare + chime + counter,
persisted). Signature: walking through reeds literally plays held synth notes.

## Plan
- [ ] Renderer: 2.5D perspective projection (f=840, eye 1.55u, far 84u), painter's
      sort, minimal DOM reorder, pooled `<use>` nodes per prop type, water
      reflections via mirrored uses under a gradient mask.
- [ ] Infinite world: 9u cells, deterministic hash-RNG spawn, spawn/prune with
      hysteresis; props: songstalks (3 geoms × 4 glow palettes), wisp-willow
      trees, drowned chapel arches, rune monoliths, reed tufts, water glints.
- [ ] Sky: single parallax strip (3 copies, one transform/frame) with stars,
      twin moons, auroras, layered treeline, sky-mantas; moon shimmer on water.
- [ ] Feel: head-bob + sway + micro-roll (respects prefers-reduced-motion,
      SMIL paused), wading wake ripples, fireflies, fog band, quality governor.
- [ ] Audio: WebAudio wind + pad + 6 proximity reed voices + bell chimes on wake.
- [ ] Controls: WASD/arrows + Q/E strafe, drag look (yaw + pitch); two true-
      multitouch pointer-captured virtual joysticks (L walk, R turn).
- [ ] Mobile hardening: touch-action none, overscroll none, viewport user-
      scalable=no, gesturestart/dblclick/contextmenu guards (overlay exempt).
- [ ] Save: fathoms + woken roses + mute in localStorage.
- [ ] Verify in real browser (render, movement, sticks, resize, console clean).
- [ ] Index tile between GLM-5.2 and GPT-5.3 Codex (zai provider, effort max).
- [ ] Commit with explicit pathspec (`git commit -- <paths>`), push to main.

## Review

Verified live in a real browser (served over HTTP, IAB tab, desktop 1280×720 +
mobile 390×844 viewports):
- Renders correctly on both viewports: sky gradient, twin moons, auroras,
  treeline, mirror water, reflections, glints, HUD, title card (vision-checked
  screenshots at 4 states: title, mid-game, portrait, full-rotation).
- Title → Begin flow works; HUD stats + mute button render.
- rAF loop: game clock tracked real time within 0.4% over a 2s sample; quality
  governor never dropped from max; DOM prop count pinned at the 96 cap with
  stable pools (no unbounded growth).
- Walking: real W keypresses moved the player and advanced the fathoms HUD.
- Look: real mouse drag changed heading by exactly dx×0.0032 rad; pitch drag
  shifts the waterline; second moon + shimmer re-verified after crossing θ=2π
  (panoramic strip wrap is seamless — no seam, gap, or duplicated moon).
- Per-instance glow palettes visibly vary (proves CSS custom properties pierce
  the use-shadow trees that the --flare rose-wake mechanism also relies on).
- Fixed during verification: DOM-leak when the visible-cap culled already-flagged
  objects (vis flags now cleared at gather start); chime routing; blur handler
  clears the shared key map in place.

Reviewed but not E2E-triggered (mouse-only harness, no synthetic events):
- Touch joysticks: reveal logic + per-pointerId capture are the same
  pointer-capture pattern proven by the mouse drag; sticks hidden without touch
  hardware. Multitouch independence is by construction (separate captured
  elements).
- Rose-wake chime/flare at <6.6u and multi-cell churn need >5u of walking;
  spawn/prune radius math is the symmetric form of the boot spawn that produced
  a correct 332-cell world.
