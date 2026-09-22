# The Upturned Sea — pure-SVG first-person exploration (Opus 5.5, max effort)

Deliverable: `svg-forest/opus-5.5-max-svg-forest.html` (single file, zero deps, no canvas/WebGL/images)
+ tile in `svg-forest/index.html` (alphabetical by model). Commit (signed) + push to main.
Rule from the brief: do not open other games in `svg-forest/` until this one is finished.
(Theme pivot: an antique-map world was dropped because `tower-def` already has "Marginalia".)

## Lore bible

- **The Turning.** Three hundred years ago the sea went up. It lifted off the world like a cloth
  drawn from a table and hung itself twenty fathoms overhead, surface facing down. It stayed.
- **The Overwater.** Ships still sail it, upside down to us, masts pointing at our heads. Whales pass
  over like weather. Light comes down through it green; caustics crawl over the sand.
- **The Floor.** The old seabed, dry and bright. Coral kept building out of habit. Kelp still climbs
  toward water it can almost touch. Whale-falls bleach; wrecks lie where they let go.
- **Letters.** Sailors always threw letters into the sea. Now the sea drops them down to us, and a
  thin shaft of light follows each bottle to the sand.
- **You** are a Floorwalker. No goal but walking and reading. Somewhere, they say, the sea still
  touches the ground. Nobody has found it.

## Plan

- [x] Lore + art direction (teal ceiling-sea, sand floor, coral/kelp accents, flat cel style)
- [x] Engine: yaw+true-pitch projection, floor/ceiling plane lines with near clipping, screen-space fog gradients
- [x] Sprites: `<use>` pool, CSS-variable fog (no per-level symbol copies), depth sort with minimal DOM moves
- [x] Procedural symbols: kelp (short/tall), staghorn, sea fan, brain coral, sponges, anemone, rocks,
      whale ribs/skull/vertebrae, wreck, upside-down galleon, anchor + chain, jellyfish, bottle, glint, pillars
- [x] World: chunked jittered-grid generation, warped Voronoi regions (reef/kelpwood/barrens), named regions
- [x] Ceiling: swell lines, whitecaps, whale shadows, sun glow; voyaging + anchored ships
- [x] Floor: ripples, shells/starfish, footprints, animated caustics; motes; light shafts
- [x] Controls: WASD/arrows, drag-look, twin multitouch joysticks, gesture suppression, resize/self-heal
- [x] HUD: compass ribbon, letters + fathoms, region banner, letter reader, SVG intro card
- [x] Adaptive quality + debug hook `window.__upturned` (step/teleport/stats)
- [x] Verify: headless Chrome shots (desktop), Browser pane mobile + multitouch, fps probe
- [x] Skeptical review pass, fixes
- [x] Index tile (between Opus 5 and Sonnet 4.6), commit (signed), push

## Review notes

- Perf (headless, software raster, 1280x720): render() JS ~1.9 ms/frame; paint of detailed sprites
  dominated. Hiding the world layer gave 60 fps; so LOD switches were tightened (fine detail < ~27 m,
  medium < ~55 m), coral thickness classes cut 4 -> 3, reef/kelp density trimmed. After: spawn 60,
  reef 40-60, kelpwood 50-54, walking 60 fps. genChunk ~0.065 ms.
- Multitouch proven with synthetic PointerEvents (ids 11/12): walk + turn at once, release one keeps the other.
- Beacon shafts needed near-plane polygon clipping: shafts leaning toward the camera were being dropped.
- Review (sub-agent, 9 findings, all fixed): sprite near-plane clip tested at NEAR but clipped at 3*NEAR
  (2,000 px pops walking through ribs; now <= 56 px per 5 cm step); adaptive quality judged frame
  interval against 60 Hz (30 Hz displays lost quality forever; now relative to best cadence seen);
  whales spawned inside their visible range; Cmd-chords left keys stuck on macOS; taken bottles shifted
  the chunk RNG stream; glints outlived the streamed radius; ripple highlight cut-off; sticks reset on
  letters / stale centre after rotation; HUD ignored safe-area insets; gradient colours rewritten per frame.
