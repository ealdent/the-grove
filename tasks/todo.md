# PARISON — grok-4.6-xhigh rail shooter

## Concept (locked)

You are the last unannealed breath inside a gather of molten glass. The master
died at the bench; the gather is still on the pipe, still moving, because glass
that stops moving dies. You race the interior of the furnace-cathedral toward
the lip. Behind you the lehr cools. If it catches you, you harden into a lump.

One-liner: "You are the last breath inside a gather of molten glass, racing the
cooling pipe toward the lip — burst the bubbles, weave the iron, and do not anneal."

Not moths, not porcelain repair, not a loom, not ink-on-scroll: a glassblower's
pipe seen from inside the gather.

## File
- `rail-shooter/grok-4.6-xhigh-rail-shooter.html` — one HTML file, Three.js from CDN, procedural Web Audio, no other assets.
- Tile in `rail-shooter/index.html` after the game is verified.

## Plan
- [x] Invent world (PARISON / furnace-cathedral / The Shears)
- [x] Write the game file
- [x] Syntax check (`node --check` on extracted scripts; no backticks in GLSL comments)
- [x] HTTP + browser proof: title furnace tunnel, play HUD + stage card, WebGL scene (headless SwiftShader)
- [x] Index tile
- [x] Review section

## Structure
- States: title (living furnace) → play (I The Mouth / II Cane Bench / III Lehr) → boss THE SHEARS → win | annealed.
- Controls: mouse analog + WASD, hold LMB/Space fire, P/Esc pause, M mute, R restart.
- Player: glass parison-spirit, 3 Temper, seed-pearl shots, banking, spark trail.
- Shootable: bubbles, frit swarms, spitters, crystals. Unbreakable: drips, jacks, cane rods, pontils, rings.
- Boss: brass shears, tell volumes then snap / diamond / rain / jet. Readable safe lanes.
- Debug: `window.__game` and `#play` / `#boss` / `#god` hashes.

## Review
- File: `rail-shooter/grok-4.6-xhigh-rail-shooter.html` + tile on `rail-shooter/index.html`.
- Title screen: one-point furnace tunnel, iron ribs, molten floor, PARISON type, Begin the gather.
- Play: HUD (temper pips, score, pause/sound), stage card I · The Mouth, rings receding, bloom/heat.
- Headless `--disable-gpu` cannot create WebGL (expected). Real WebGL + SwiftShader rendered the 3D scene (~1.3MB PNG).
- Cursor browser MCP was unavailable this session; proof is HTTP + headless Chrome with WebGL.
- Not fully click-tested in an interactive Browser pane: pause/mute/restart/boss tells should be smoke-checked by a human pass.

## Structure
- States: title (living furnace) → play (I Glory Hole / II Cane Bench / III Lehr) → boss THE SHEARS → win | annealed.
- Controls: mouse analog + WASD, hold LMB/Space fire, P/Esc pause, M mute, R restart.
- Player: glass parison-spirit, 3 Temper, seed-pearl shots, banking, spark trail.
- Shootable: bubbles, frit swarms, spitters, crystals. Unbreakable: drips, jacks, cane rods, pontils, rings.
- Boss: brass shears, tell volumes then snap / diamond / rain / jet. Readable safe lanes.
- Debug: `window.__game`

## Review
- (fill after verify)

---

# THE LAST STROKE — sumi-e rail shooter (glm-5.3-max)

## Concept (locked)

You are a koi painted in living ink on an old hanging scroll. The Master died
mid-painting: the dragon at the top of the scroll has no eye, and below you the
ink is drying. You carry the Master's last drop of ink. Swim up the scroll —
river, storm, scorched scroll — and dot the dragon's eye before everything dries.

One-liner: "You are an ink koi racing up a dying hand-painted scroll, cutting
down brush-stroke demons with water beads so you can dot a blind dragon's eye."

## File
- `rail-shooter/glm-5.3-max-rail-shooter.html` — single self-contained file, no CDN, Canvas 2D hand-built perspective pipeline, Web Audio procedural score.
- Tile in `rail-shooter/index.html` AFTER the game is built (do not read other games first).

## Plan
- [x] Read tasks/lessons.md — apply: fresh-object projection (L58), avatar ~20% screen height (L56), dt-proportional particle emission (L60), rAF clock seeded from first timestamp (L64), explicit canvas CSS size (L41/80), debug stepper + input-in-update for verification (L54/87), serve over HTTP to verify (L48).
- [x] Write the game file (2,725 lines, single file, zero external deps)
- [x] Syntax check: extract <script>, `node --check` — clean after every edit
- [x] Browser verification (see Review)
- [x] Add tile to rail-shooter/index.html (first card, Z.ai / GLM-5.3 / max)
- [x] Review section below

## Review

### Verification performed (headless Chrome + in-app browser, served over HTTP :8002)
- 60s auto-played run (?t=play, god): 0 errors, kills/score/obstacles/streak all advance, full movement range exercised.
- Full 4-minute run (?t=play, 240s virtual): 0 errors, act 1→2→3 transitions, boss intro→fight at ~2.9 km, 47.5k score.
- Boss arc (?t=win): intro→fight→dying→dot→win confirmed twice; game-over arc (?t=over): wetness 2→1→0→death cinematic→over screen, stays over (earlier "restart" screenshots were a headless capture artifact, not a game bug).
- Live browser: P pauses (REST overlay), P resumes, runT advances again; title/gameplay/boss/win/over screens screenshotted and visually verified; in-page pixel probe asserts the koi renders at its projected position (L59-style assert).
- Bugs found and fixed during verification: missing drawDecals wrapper (render crash), depth-streaming sign errors (entities drifting away instead of approaching), enemy-bullet collision window unreachable, boss death check missing on body-hit branch (hp reached -40 mid-fight), title screen drew no koi, thin geometric ensos replaced with brush strokes, music scheduler ticked twice or not at all (title silence / unmute burst), opening hint never displayed.

### Known notes
- Audio is fully procedural (generative hirajoshi score + SFX); it was muted in every automated run — no human has heard it yet.
- Debug URL params (?t=play|boss|win|over, &clock=fs, &god=1, &act=N) are harness-only; double-clicking the file runs the normal game with zero dependencies (no CDN, works offline).
- tmp/rail-verify/ holds verification screenshots, safe to delete.


## Game structure
- States: title → play (Act I river / Act II storm / Act III ember) → boss (THE UNPAINTED EYE) → win | game-over. Pause, mute, restart.
- Controls: WASD/arrows or mouse (analog spring), Space/LMB spit ink beads (soft aim assist), Shift/RMB dash (i-frames), P pause, M mute, R restart.
- Player: white koi w/ vermillion crown, ribbon tail from position history, banking, dash afterimages, 3 wetness (lives), crack vignette at 1.
- Enemies: minnow schools, bleeds (blots, 3-spread fire), spatter wasps (lock+dive), stroke eels (lingering weaves), ink urchins (radial rings), mist jellies (tanky, drop health). Obstacles (indestructible): bamboo (from below), hanging willow (from above), seal rocks, Act III burning brands. Gates always leave a readable gap.
- Boss: coiled unfinished dragon, blank eye = weak point (tell windows open it). Patterns: stroke sweeps (wet→dry telegraph walls), splatter barrages, seal slam (tracking rings), dragon rush (coil tell then lane dive). Phase mix at 66/33%. Death → dot-the-eye cinematic → gold wash → win screen.
- Juice: screen shake (trauma²), hitstop, zoom punch, ink splats on lens, near-miss sparks + whoosh, floating score calligraphy, streak multiplier x1..x8, ripples when flying low.
- Audio: generative hirajoshi score (koto plucks, shakuhachi pad, taiko heartbeat) w/ per-act intensity/BPM, rain + ember layers, boss roars, full SFX set, compressor, M mute.
- Rendering: paper texture offscreen, per-act palettes w/ crossfade, parallax brush mountains, converging river w/ flow lines, mist bands, rain streaks + lightning, rising embers, prerendered glow sprites, seeded brush-stroke helpers.
- Debug: `window.__game` — start()/toAct()/boss()/god()/step(dt)/params/stats/probe().
