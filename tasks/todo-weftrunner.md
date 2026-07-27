# Task: WEFTRUNNER — THE LAST BOLT (Space Harrier descendant)

Goal: single-file, zero-dependency rail shooter at `arcade/weftrunner.html`, plus a tile in
`arcade/index.html`.

Constraints: one self-contained HTML file, no CDN/external assets, opens from `file://`,
keyboard + mouse only, 60fps, procedural Web Audio music and SFX.

Note: a concurrent session is building `arcade/gildwake.html` and has uncommitted edits to
`arcade/index.html` and `tasks/todo.md`. Do not stage their hunks — stage only the base+my-tile
blob for `index.html` (via `git hash-object` + `git update-index --cacheinfo`).

## The world

**The world is a cloth on the Great Loom.** Everything that exists is a thread in it. Ahead, at the
horizon, is **the Beam** — the wall of light where new cloth is being born. Behind you is **the
Fray**, where it is coming undone, and the Fray is faster than you are.

You are a **Mender**: a needle-spirit trailing a thread of light, running the weft toward the Beam.
You cannot stop. Stopping is being unmade.

- Ground plane = woven cloth. Weft rows rush at you (the Space Harrier checkerboard, reinterpreted).
  Warp threads stand as the pillars you must dodge. The cloth *undulates* like silk with real
  lambert + sheen shading.
- You fire **stitches**. What you kill bursts into lint and dust.
- Enemies are what eats cloth: moths (Tineo), pinflies, silverfish, snarls (knots that gained will),
  lint wraiths, bobbin drones, warp lancers.
- Obstacles: warp posts, giant pins with glass bead heads, thimble domes, spool towers.
- Health = the **FRAY** meter. Hits fray you; kills and grazes mend you; it self-mends slowly.

### Stages

| # | Name | Look | Boss |
|---|------|------|------|
| I | THE PLAIN WEAVE | dawn linen, gold Beam, clean cloth | THE SEAM-RIPPER — hooked blade, rips seams along the ground |
| II | THE MOTHWOOD | indigo dusk, holes eaten clean through the cloth | IMAGO, THE MOTH-QUEEN — scale storms, larvae, eyespot beams |
| III | THE DYEWORKS | madder red, dye rivers, steam | THE SNARL — orbiting knot nodes, thread lash, cinches the play space |
| IV | THE BEAM | white-gold cathedral of warp threads, cloth being born | THE WARDEN — lattice, shuttle pass, beam sweep |

Clear IV → second bolt (harder loop).

## Checklist

- [x] Inspect `arcade/index.html` tile format
- [x] Design the world, stages, bosses, palettes, audio plan
- [x] Part A: shell, constants, palettes, input, projection math
- [x] Part B: Web Audio engine (Karplus-Strong pluck buffer, loom-clack percussion, per-stage music)
- [x] Part C: renderer — sky, Beam, undulating woven ground w/ lambert+sheen, warp threads, holes,
      dye, overhead heddle arches, fog, CRT overlay
- [x] Part D: player (Mender + cloak + shadow + thread trail), stitches, particles, pickups, cinch
- [x] Part E: enemy types with distinct AI and procedurally drawn sprites
- [x] Part F: 4 bosses, shared phase/tell framework, distinct patterns
- [x] Part G: stage director, collisions, graze, HUD, title/gameover/pause, main loop
- [x] Verify headless: no console errors, long-run sim, screenshots of every stage + boss
- [x] Add tile to `arcade/index.html`
- [x] Commit + push to main

## Review

Shipped `arcade/weftrunner.html` — 4,777 lines, one file, zero dependencies, opens from
`file://`. Canvas 2D with a hand-built perspective pipeline (no WebGL, no CDN), procedural
Web Audio score and SFX.

**What's in it**

- Undulating woven ground plane with analytic normals → real lambert + Blinn sheen per band,
  a plain-weave over/under cell overlay near the camera, round-shaded warp threads, and a
  Beam-light pool. Weft rows are the Space Harrier checkerboard, reinterpreted as cloth.
- 4 stages that cross-fade palette, fog depth, wave amplitude and ambient particles into each
  other: Plain Weave → Mothwood (holes eaten clean through the cloth) → Dyeworks (madder, steam)
  → the Beam. Then a harder second bolt.
- 7 enemy types + 4 obstacle types, all procedurally drawn.
- 4 bosses, 13 distinct attacks, every one tell-then-strike, with destructible parts that
  shield the core.
- 5 hazard shapes (rip / lashH / lashV / lattice / scalewall), each with its own dodge.
- FRAY health that self-mends, grazes that mend and build the multiplier, a Cinch dash with
  i-frames, adaptive resolution, pause/mute/restart, localStorage high score, attract-mode
  return after 15s on the game-over screen.
- Music: Karplus-Strong plucked-string buffer synthesised at load, pitched per note; loom-shuttle
  percussion; a per-stage 4-bar pattern table in Dorian / Phrygian / Phrygian-dominant /
  Mixolydian; a separate boss track. Kills play notes from the current scale.

**Proof** (headless Chrome, `--dump-dom` with an error collector, driven through
`window.weftrunner`)

- Smoke run: boot → title → all 4 stages → all 4 bosses killed → stage clears → loop rollover to
  Bolt II (hpScale 1.55, aggro 1.42) → death → game over → attract return. All 6 screens rendered
  paused and unpaused. Resize sweep over 1920×1080 / 1280×720 / 1024×768 / 800×600 / 640×480.
  **0 errors** throughout.
- Attack sweep: all 13 boss attacks forced individually — each reached `strike` and produced its
  hazard/volley/spawn. All 5 hazards verified both dodgeable *and* lethal (fray 0 when threaded,
  22–24 when not).
- Unskilled-pilot sim (never dodges, only drifts toward the nearest enemy): survives 273s and
  reaches stage III.
- Screenshots at 1440×810 of the title, every stage, every boss, the high-fray state, and the
  arcade index with the new tile.

**Bugs found by the harness and fixed**

1. `b.def.atks` was never defined — every boss threw on its first attack decision.
2. `IN.fire` latched true forever after the first Space press (it was only cleared on mouseup).
3. Lattice bars were drawn at `gw*1.5` spacing while the pass test used `gw`, so there was an
   invisible kill band between the gap edge and the first bar.
4. The Warden's charge checked `|P.y - passY| < 3.0` against a boss that never left its own
   altitude — undodgeable. Now it locks the player's altitude during the tell, draws a charge
   lane, and the window is 2.0.
5. Boss hazards spawned 20 world units out at 66 u/s → 0.3s of reaction. Rips/lashes now spawn
   behind the boss at ~30 u/s and walls at z≈100.
6. Boss part offsets were in world units but drawn through a different scale factor, so the
   Snarl's nodes rendered at 76% of their hitbox position.
7. `tracked()` was left at whatever `textAlign` the previous draw set, so every tracked string
   after a `fillText` centred each glyph on top of the next.
8. Obstacles kept spawning during boss fights and ate the player's stitches.
9. The fray meter and cinch gauge rendered below the bottom edge at 810px tall.

**Art passes driven by screenshots** — the first render had a flat desert instead of cloth (added
the weave-cell overlay, round-shaded threads, 2× wave amplitude, ambient motes/steam/sparks); the
Mender read as a beetle (rebuilt as a hooded figure with shoulders, arms and a spine seam); the
Seam-Ripper read as a white mushroom (rebuilt as the actual forked tool with the red safety ball).

**Not verified**

- Audio output. Synthesis is silent until a user gesture by design, so the headless runs prove
  only that it never throws — the actual score has not been heard.
- Real 60fps on real hardware. Headless runs with `--disable-gpu` (software rasterisation), where
  a full render costs ~13ms at 1440×810; a GPU-composited canvas should be far cheaper, but that
  is inference, not measurement. Mitigated by adaptive resolution, which drops DPR in four steps
  when the rolling frame time exceeds 21ms and restores it when it falls under 11.5ms.
- Human play feel. Movement, fire rate and boss HP are tuned from simulation, not from playing.

**Residual risk** — balance. The bosses need roughly 10s / 20s / 25s / 28s of accurate fire at a
65% hit rate. If a real player's accuracy is much lower than the sim's, the later fights will drag.
