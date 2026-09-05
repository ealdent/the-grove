# CHRONOSTRATA: THE PETRIFIED ORRERY — gemini-3.8-flash-high pure SVG 3D exploration game

## Concept & Creative Brief
In the petrified sea-bed of the Chronostrata, colossal bronze astrolabes, crystalline resonance spires, bioluminescent phosphor lotus pods, and nomadic automaton seraphs stand silent beneath a fractured celestial ring. The player explores this infinite procedural expanse in first-person perspective, with a full 3D/2.5D SVG projection engine, smooth head-bobbing, dynamic chunk generation, desktop WASD + drag controls, and true multitouch dual virtual joysticks for mobile.

## Files
- `svg-forest/gemini-3.8-flash-high-svg-forest.html`: Single self-contained HTML/CSS/JS file. Zero external dependencies, pure SVG graphics & rendering engine.
- `svg-forest/index.html`: Alphabetically sorted card under Gemini 3.8 Flash (High) (added ONLY after game is finished without reading other game files).

## Plan Checklist
- [x] 1. Lore & Art Direction Specification:
  - Atmospheric backstory: The Silent Sea of Kyros and the Petrified Orrery.
  - Color palette: Twilight obsidian, starlight cyan, antique brass, celestial amethyst, and phosphor gold.
  - Detailed SVG asset definitions for Sky (rings, moons, aurora, parallax ridges), Ground (perspective depth grid, glowing fault lines), and 4 distinct props (Chrono-Orrery, Phosphor Lotus, Resonance Spire, Seraph Automaton) plus Ancient Relic Altars.
- [x] 2. Mathematical 3D-to-SVG Projection Engine:
  - Camera system: position (x, y, z), yaw, pitch, focal length, eye height + dynamic head-bob.
  - 3D coordinate transform (world-to-camera rotation, near-plane clipping, perspective division).
  - Depth sorting (painter's algorithm) and atmospheric depth haze attenuation.
  - Smooth ground perspective grid & 360-degree celestial panorama wrapping.
- [x] 3. Endless Procedural World Generation & Object Pooling:
  - Deterministic spatial hash grid (infinite chunks) ensuring consistency when revisiting coordinates.
  - Dynamic chunk activation and culling based on distance.
  - High-performance SVG element pooling (fixed pool of 45 `<g>` instances with transform updates to avoid DOM churn).
  - Wandering atmospheric aether motes / spore particles in 3D space.
- [x] 4. Responsive Controls & Mobile Joysticks:
  - Desktop: WASD/Arrows movement, mouse drag look (and optional pointer lock), smooth interpolation.
  - Mobile: True multitouch dual virtual joysticks (Pointer Events with `pointerId` tracking, left = move, right = turn/look).
  - Mobile browser gesture prevention (`touch-action: none`, `overscroll-behavior: none`, user-scalable=no).
  - Diegetic UI: Brass compass rose, coordinate readout, discovery radar, help overlay, Web Audio ambient synth with mute toggle [M].
- [x] 5. Verification & Testing:
  - Code syntax check with `node --check` / `vm.Script` (100% clean).
  - In-game headless test harness (`__runChronostrataTests`) passing all 12 assertions.
  - JSDOM simulation verifying keyboard walking and concurrent multitouch joystick control.
- [x] 6. Index Tile & Release:
  - Add card to `svg-forest/index.html` sorted alphabetically under `Gemini 3.8 Flash (High)`.
  - Verify index page rendering, dropdown population, and links.
  - Document results in `tasks/todo.md` review section.
  - Commit and push to main with specific pathspecs (`git commit -- ...`).

## Review: Chronostrata (Gemini 3.8 Flash High)
- **Game File**: `svg-forest/gemini-3.8-flash-high-svg-forest.html` (single self-contained HTML/CSS/JS file, zero `<canvas>`, zero WebGL, pure SVG rendering engine).
- **Index Tile**: Added to `svg-forest/index.html` sorted alphabetically by model between `Gemini 3.7 Flash` and `GLM-5.2` with `badge--brass` styling.
- **Lore & Aesthetics**:
  - Setting: The Petrified Orrery of Kyros-V. A dried ammonia seabed beneath a fractured planetary ring system, twin crescent moons, and sweeping auroral curtains.
  - Visuals: Multi-faceted obsidian ridges, perspective ground depth lines, glowing mineral faults, and 5 distinct SVG prop models (`#prop-orrery`, `#prop-lotus`, `#prop-spire`, `#prop-seraph`, `#prop-relic`).
- **Mathematical 3D Projection**:
  - Full perspective projection: world-to-camera matrix rotation, near-plane clipping, perspective division $scale = F / rz$, screen-space downward Y mapping, and painter's depth sorting ($rz$ descending).
  - Subtle head-bobbing: sinusoidal vertical displacement and subtle camera roll during movement with smooth exponential decay upon stopping.
- **Performance & Object Pooling**:
  - Fixed SVG element pool of 45 `<g>` slots updated via transforms (`translate`, `scale`, `opacity`) without DOM allocation during traversal.
  - Infinite procedural chunk engine with deterministic hash seeding so revisiting coordinates always yields identical flora, spires, and orreries.
- **Responsive Controls & Mobile Multitouch**:
  - Desktop: WASD / Arrow keys, mouse drag-to-look with pointer capture, keyboard typing guard.
  - Mobile: Dual on-screen virtual joysticks with independent pointer ID tracking, enabling simultaneous walking and turning without touch gesture conflicts.
  - Gesture suppression via `touch-action: none` and `overscroll-behavior: none`.
- **Sound & Exploration**:
  - Web Audio API procedural soundscape: cosmic drone synth in Dorian mode, bandpass-filtered atmospheric wind, and celestial crystal chime harmonics on relic discovery.
  - 8 discoverable Ancient Astrolabe Altars scattered across the landscape with discovery telemetry and notifications.
- **Verification**:
  - In-engine test suite (`__runChronostrataTests()`) verifies 12 technical assertions covering SVG constraints, projection depth decay, coordinate hash determinism, object pool stability, and touch controls.
  - Simulation confirmed keyboard movement, coordinate HUD updates, and dual multitouch pointers.

---



## Plan Checklist
- [x] 1. Architecture & Design Document: Header comment block with Title, Premise (150-300 words), Art Direction (hex values, light source, typography), and Voice.
- [x] 2. Core Deterministic Engine:
  - Pure function discrete grid state engine (14x11).
  - Fixed 45-beat loop cycle with early ribbon commit ([Space]).
  - Replay system running up to 4 concurrent Maelzel Automata with input playback.
  - Causal consistency detector checking expected vs actual actions on every tick, triggering precise in-voice derangement halts.
  - Unlimited tick & loop-boundary undo ([Z]) with deterministic replay verification.
  - Documented deterministic simultaneous conflict resolution rule (antiquity order).
- [x] 3. Level Authoring & Narrative Arc:
  - Level 1: L'Incroyable de Minuit (Inciting situation: single pneumatic gate & treadle).
  - Level 2: La Double Bielle (Escalation: dual interdependent gates & hamper shifting).
  - Level 3: Le Précédent Fragile (Climax: historical protection, timing around past automata).
  - Narrative Epilogue resolving Henri's watch at dawn.
  - Headless automated self-test embedded in game and executable via UI/debug key ([T]).
- [x] 4. Visual & Audio Presentation:
  - Belle Époque brass/parquet/parchment aesthetic without banned tropes.
  - Rich Canvas-drawn characters (Henri with apron/bag, Maelzel Automata with brass casing, gears, winding keys).
  - Diegetic UI: brass regulator clock, unspooling punched telegraph tape, pressure dials.
  - Ambient motion: warm gaslight flicker, wandering dust motes, rising steam wisps.
  - Procedural Web Audio: escapement clicks, pneumatic whooshes, gear snaps, bell fanfares, mute toggle ([M]).
- [x] 5. Verification & Testing:
  - Syntax check with `node --check` (clean, 0 errors).
  - Node.js automated test runner checking determinism, solutions, error reports, and deep undo (100% pass rate across all 7 tests).
  - Browser inspection, DPR 1 and DPR 2 canvas scaling, zero console errors.
- [x] 6. Index & Delivery:
  - Add tile to `time-loop/index.html` sorted alphabetically by model (between Gemini 3.6 and GLM-5.3).
  - Document results in `tasks/todo.md` review section.
  - Commit and push to main with specific pathspecs (`git commit -- ...`).

## Review
- **Game File**: `time-loop/gemini-3.8-flash-high-time-loop-puzzle.html` (single self-contained HTML file, zero CDN/external dependencies, pure Canvas 2D + Web Audio).
- **Index Tile**: Added to `time-loop/index.html` in alphabetical order by model between `Gemini 3.6 Flash` and `GLM-5.3`.
- **Lore & Aesthetics**: 1897 Belle Époque Parisian pneumatic post sorting vault (Pont-Neuf) with oak parquet floorboards (`#231a14`, `#2e2118`), polished brass escapements (`#d4a34b`), cast iron vacuum piping (`#34383c`), punched copper telegraph ribbon (`#ebe1cb`), and imperial wax seal red (`#a83226`). Soft overhead gaslight illumination with wandering dust motes.
- **Voice**: Chief Dispatch Inspector Delacroix—stern, exacting Parisian civil servant whose dry regulatory directives treat both Henri and the automata as expendable gears in the Republic's mail machinery.
- **Deterministic Loop & Automata**:
  - Replay of inputs, not positions, for up to 4 Maelzel Automata.
  - Causal consistency verification halts simulation into formal *Procès-Verbal d'Avarie Mécanique* identifying automaton ID, regulator beat, expected action, and actual obstacle.
  - Unlimited undo across loop boundaries ([Z]).
- **Narrative Arc**:
  - Level 1 (*L'Incroyable de Minuit*): Single pneumatic gate and pressure treadle.
  - Level 2 (*La Double Bielle*): Interdependent gates and wicker hamper relocation.
  - Level 3 (*Le Précédent Fragile*): Climax requiring protecting history; avoiding crossing past automata paths or disturbing earlier treadle weights.
  - Epilogue (*La Clôture du Service de Nuit*): Dawn arrives over the Seine as Inspector Delacroix stamps the night watch accomplished.
- **Verification**:
  - In-game self-test suite ([T]) runs all 3 levels headlessly, verifying all 3 solutions, causal desynchronization detection, single-tick undo, and deep rewind to tick 0 with 100% success.
  - Node.js test driver verified syntax and execution.

---



## Concept & Lore (Locked)
In 1888, high above Grasse in the limestone caves of Provence, Master Perfumer Jean-Luc Vaneau unsealed the *Septième Distillat* — an eternal fragrance capable of distilling human memory into golden liquid. The uncorking pierced the olfactory ether, summoning the **Abyssal Malodors**: rancid tallow creeps, vinegar wraiths, rotting mold-mites, and sulfurous colossi hungry to spoil the Great Flacon. Players command Jean-Luc's brass spagyric stills, cryogenic condenser coils, and aromatic atomizers to preserve the Flacon across 20 escalating watches of distillation.

## Key Files
- `tower-def/gemini-3.8-flash-high-tower-def-2.html`: Self-contained, dependency-free HTML5/Canvas/WebAudio tower defense game.
- `tower-def/index.html`: Alphabetically ordered tile under Gemini 3.8 Flash (High).

## Plan Checklist
- [x] 1. Architecture & Lore Specification: finalize lore journal, 5 towers with 4 upgrade tiers each, 8 enemy archetypes, 20 distinct wave compositions, procedural spline track generator.
- [x] 2. Implementation of `gemini-3.8-flash-high-tower-def-2.html`:
  - Canvas 2D render pipeline with offscreen cached background (slate lab table, brass grid, alembic flourishes)
  - Procedural spline track generation with guaranteed valid paths, entry hopper & exit Flacon
  - 5 towers: Bergamot Pipette (Sniper/Dart), Lavender Cryo-Condenser (Aura Slow), Ambergris Mortar (Splash Catapult), Clove-Spark Coil (Chain Lightning), Rose-Attar Prism (Searing Beam)
  - 4 upgrade tiers per tower (Tier 0 to Tier 4) with distinctive mechanics, stats, and visual upgrades
  - Targeting priorities: First, Last, Strongest, Closest
  - 8 enemy types with varied speeds, hitpoints, armor/shields, and distinct visual animations
  - 20 varied waves with wave lore journal excerpts, swarms, fast scouts, shield carriers, splitters, and boss encounters (Wave 5, 10, 15, and 20 Grand Miasma Lord)
  - Inter-wave preparation phase with tower inspection, upgrading, selling, wave intel
  - Web Audio procedural sound synthesis (glass clinks, steam hisses, electrical sparks, brass resonant gongs, ambient chime chords) with mute toggle
  - Responsive HUD, speed controls (1x, 2x, 3x), pause/resume, new track generation, restart
- [x] 3. Verification & Testing:
  - Extract script and verify syntax with `node --check`
  - Run headless Node verification script to verify game engine, path generation, wave progression, tower placements, upgrade mechanics, audio context initialization
  - Test responsive layout and retina devicePixelRatio rendering
- [x] 4. Add tile to `tower-def/index.html` in alphabetical order by model (`Gemini 3.8 Flash`, `High`)
- [x] 5. Document results in `tasks/todo.md` review section
- [x] 6. Commit and push to main with specific pathspecs

## Review
- **Files Created / Modified**:
  - `tower-def/gemini-3.8-flash-high-tower-def-2.html`: Completely self-contained, dependency-free HTML5/Canvas/WebAudio tower defense game.
  - `tower-def/index.html`: Added "Essentia" game tile in alphabetical order by model (Gemini 3.8 Flash, High).
- **Theme & Lore**: Set in an 1888 subterranean laboratory in Grasse, Provence. Master Perfumer Jean-Luc Vaneau has distilled the *Septième Distillat* ("The Memory of Dawn"). Players defend the Great Flacon from creeping Abyssal Malodors (tallow mites, vinegar phantoms, rust carapaces, mold sporelings, and the Grand Miasma Lord).
- **Towers & Upgrades**: 5 distinct towers, each with 4 upgrade tiers (Tiers 0 to 4):
  1. *Bergamot Pipette*: Rapid kinetic citrus darts, armor shred, piercing, and tri-burst solar ignition.
  2. *Lavender Cryo-Condenser*: Pulsing frost aura, slow scaling up to 60%, vulnerability debuff, flash-freeze, and death shattering.
  3. *Ambergris Mortar*: Viscous resin catapult with arc physics, area blast, burning puddles, lesson 92-compliant knockback impulse, and 2.5x armor crushing.
  4. *Clove-Spark Coil*: High-voltage eugenol electrical arcs chaining up to 10 targets, micro-stuns, zero falloff, and EMP shockwaves.
  5. *Rose-Attar Prism*: Continuous ruby laser beam with escalating ramp DPS (up to 8x), blinding slow, refracted dual beams, and petal explosion cascades.
- **Enemies & Waves**: 10 enemy archetypes with varied speeds, armor, resistances, split behaviors, and dashes across 20 escalating narrative waves with journal dispatches and miniboss/boss encounters (Wave 5, 10, 15, and 20).
- **Inter-wave Preparation & Inspection**: Full control during prep phase to inspect stats (DPS, kills, range, fire rate), upgrade tiers, set targeting priority (First, Last, Strongest, Closest), sell for 75% refund, review enemy intel, or roll a new procedural track.
- **Engine Quality & Optimization**:
  - Offscreen canvas background caching (Lesson 6).
  - Explicit canvas styles and high-DPI scaling via `devicePixelRatio` (Lessons 41, 80).
  - `dt * 60` scaling for frame-rate independence (Lesson 7).
  - Capped knockback impulse with per-target cooldowns (Lesson 92).
  - `fillRect` particle rendering (Lesson 6).
  - Procedural Web Audio API polyphonic sound synth (drops, hisses, thuds, zaps, gongs, chimes).
- **Automated Verification**:
  - `node --check` extracted script: 100% syntax valid.
  - 50 procedural spline tracks tested: 100% valid geometry without NaN or loops.
  - Tower placement & upgrade matrix: all 5 towers and all 4 upgrade tiers verified for costs, stat scaling, and sell refunds.
  - 20-wave automated combat simulation: verified wave progression, kill rewards, and clean loop.

---

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
---

# CODEX IMPERIUM — gemini-3.8-flash-high tower defense

## Concept & Backstory (Locked)
In 1888 of the Aether-Era, deep within the subterranean archives of the Imperial Alexandria-on-Thames, the legendary automated steam-press—the *Codex Aegis*—is printing the Universal Compendium of Human Memory onto endless ribbons of living vellum parchment. 
From the mists of the forgotten censors emerges the **Obscurantist Rot**: typographical abominations, redaction bars, punctuation mites, and ink-leeches marching along the vellum feeder track to destroy the Master Matrix.
As Master Typographer, deploy five brass-engineered press defenses along procedural vellum tracks, tuning them through four masterwork upgrade tiers across 20 distinct waves to defend the Archive of Truth.

One-liner: "Defend the Grand Steam-Press of Alexandria against swarms of living ink-blots, redaction beasts, and errata across procedural vellum scrolls with molten typecasters, hydraulic platens, and prismatic solar optics."

## File & Destination
- Game: `tower-def/gemini-3.8-flash-high-tower-def.html` (single-page HTML, zero dependencies, no CDN, procedural Web Audio, pure Canvas 2D)
- Tile: `tower-def/index.html` (inserted in alphabetical order: right after `Gemini 3.7 Flash High` and before `GLM-5`)

## Plan
- [x] Research & Lore Document: Deep lore integration, 5 tower blueprint systems with 4 upgrades each, 7 enemy classes + 3 bosses, 20-wave progression table.
- [x] Architectural Design: Responsive canvas engine with DPR scaling, procedural self-avoiding spline vellum track generator (exempting previous two cells per lesson 91), particle system using fillRect (lesson 6), sound synthesizer via Web Audio.
- [x] Create `tower-def/gemini-3.8-flash-high-tower-def.html`:
  - [x] UI & Shell: Victorian brass/parchment styling, responsive layout, HUD, speed controls (1x, 2x, 4x), sound toggle, codex lore modal.
  - [x] Procedural Web Audio: Mechanical clatter, hydraulic thumps, laser hums, ink splats, fanfare, ambient drone.
  - [x] Procedural Map Generator: Smooth Catmull-Rom spline track on parchment with brass rivets, ink wells, and non-overlapping build zones.
  - [x] 5 Towers with 4 Upgrades each (25 total tier designs with unique graphics, projectiles, and mechanics):
    1. Hot-Lead Typecaster (Rapid kinetic lead slugs / flying letters)
    2. Vitriol Illuminator (Corrosive ink mist & slow puddles)
    3. Gilded Platen (Hydraulic shockwave / impulse knockback with target cooldown per lesson 92)
    4. Optic Prism Loupe (Extreme range sniper / concentrated solar laser)
    5. Bookbinder's Coil (Chain electric thread arcing & binding tethers)
  - [x] 7 Enemy Types + 3 Bosses across 20 distinct waves with lore briefings.
  - [x] Tower targeting system (First, Last, Strongest, Weakest, Closest), upgrade panel, refund on sell.
  - [x] Juice: hit flashes, damage numbers, ink splatters, screen shake, floating victory/defeat banners, endless mode.
- [x] Verification & Testing:
  - [x] Syntax check: `node --check` on inline script (clean, 0 parse errors).
  - [x] Simulation test: verified track generation, all 5 tower placements, all 4 upgrades each (to tier 5), sell refunds, targeting modes, and 0 runtime errors.
  - [x] 20-wave full campaign test: cleared waves 1 through 20 including Wave 5 Miniboss (Censor's Shears), Wave 10 Boss (Palimpsest Phantom), and Wave 20 Final Boss (THE OBLIVION LEXICON).
  - [x] Lesson compliance check: DPR canvas sizing (L41, L80), knockback cooldown (L92), frame-rate independence (L7), audio volume normalization (L61).
- [x] Add Tile to `tower-def/index.html` (Google / Gemini 3.8 Flash / High).
- [ ] Git commit and push to main.
- [x] Document results in `tasks/todo.md` review section.

## Review
- **Game File**: `tower-def/gemini-3.8-flash-high-tower-def.html` (single-page self-contained HTML file, zero CDN/external dependencies, pure Canvas 2D + Web Audio).
- **Index Tile**: Added to `tower-def/index.html` in alphabetical order by model between `Gemini 3.7 Flash High` and `GLM-5`.
- **Lore & Aesthetics**: Victorian Steampunk Print-Vault setting (Imperial Alexandria-on-Thames, 1888) with living vellum ribbons, brass guide-rails, ink wells, and typographic errata. Integrated lore compendium modal.
- **Towers**: 5 mechanically distinct towers, each with 4 masterwork upgrades (5 tiers total = 25 tiers).
- **Enemies & Waves**: 7 distinct enemy archetypes + 3 bosses across 20 narrative chapters, plus Endless Folio mode.
- **Verification**: Verified with custom Node.js test drivers executing full simulation cycles, verifying economy balance, upgrade ladders, sell refunds, and complete 20-wave clears without exceptions.


## 2026-09-04 — The Rainkeeper (greenfield tower defense)

Goal: Deliver an original, dependency-free, single-file tower defense game and gallery tile; commit and push to main.
Project: Personal / The Grove. Scope: new tower-def HTML, tower-def/index.html, this task record.
Constraints: No previous games, chats, or repo content used as creative/implementation references. Read index only for integration. Preserve unrelated work.
Design: The last ocean is carried by a glass snail; a miniature weather bureau defends it against drought. Procedural atlas map, five weather instruments, four sequential upgrades each, 24 authored waves, build/upgrade intermissions, touch and keyboard controls.
Proof: Static dependency/syntax checks, deterministic simulation and gameplay-state tests, real desktop/mobile browser checks, screenshots, independent skeptical review, clean exact-file commit and verified push.

- [x] Develop the world, visual direction, and combat rules before implementation.
- [x] Build the standalone responsive game and integrate its model/effort tile.
- [x] Verify randomized maps, progression, all upgrades, and terminal states.
- [x] Playtest desktop/mobile and address independent review findings.
- [x] Prepare exact task files for the authorized main commit/push; verify a clean baseline and current remote.

Review:
- Delivered `tower-def/gpt-6-astra-ultra-tower-def.html` (about 98 KB), all CSS/JS/vector artwork/audio inline. Gallery metadata uses GPT-6 Astra / Ultra, between GPT-5.6 Terra and Grok 4.2.
- Lore was developed before implementation: Vesper carries the last ocean; four acts end with its return as rain. Five instruments each have four named sequential refits, seven enemy types, 24 authored fronts, two randomized route families, wet/slow/lightning interactions, and bosses on fronts 6/12/18/24.
- Simulation: 250 map seeds across both families passed no-intersection, clearance, and placement checks; 29–32 docks each. Twenty legal greedy expeditions cleared all 24 fronts using earned condensate. Undefended play lost; invalid purchase/refit, upgrade cap, cumulative salvage, splitting, wet suppression, wave-clear gating, and terminal state checks passed.
- Independent static review found three issues, all corrected and rechecked: artwork selection hit area, act boundaries at boss fronts, and mobile zoom sizing.
- UI proof URL: `file:///Users/jason/dev/personal/the-grove/tower-def/gpt-6-astra-ultra-tower-def.html`. Environment: installed Chrome, Playwright headless, offline context; role: local player. All 24 fronts cleared using legal game APIs and earned money. Actual UI clicks verified purchase/refit/salvage, instrument artwork selection, pause/resume, guide, audio toggle, rain availability, victory/defeat/retry, restart confirmation, mobile placement, zoom, persisted best score, blocked storage, and reduced motion.
- Responsive widths 320/390/768/1440 passed without horizontal page overflow. Console errors: 0. Failed requests: 0. External requests: 0. Script syntax and dependency scans passed. Gallery tile is unique, correctly labeled, and alphabetically positioned.
- Screenshots: `/private/tmp/rainkeeper-desktop-final.png`, `/private/tmp/rainkeeper-mobile-final.png`, `/private/tmp/rainkeeper-battle-final.png`, `/private/tmp/rainkeeper-victory.png`. Test tools are temporary development artifacts; players need only the HTML file.
- Not verified: Firefox, Safari, physical-device touch, or subjective audio output. The page documents that refresh starts a fresh expedition; only best completed front persists where storage is available.
- Publication preflight: main checked out; origin is `git@github.com:ealdent/the-grove.git`; fetched origin/main has zero divergence; only the three intended task files changed and no pre-existing staged changes. Commit/push outcome is recorded in the final task response and Git history.

## 2026-09-04 — GPT-6 Astra Ultra SVG exploration

Goal: Build a complete, original first-person exploration game in one HTML file; add its alphabetically sorted gallery tile; commit and push to main.
Project: Personal / The Grove.
Files: `svg-forest/gpt-6-astra-ultra-svg-forest.html`, `svg-forest/index.html`, this task record.
Constraints: All world graphics and rendering use SVG only, no canvas/WebGL/images/dependencies. Do not inspect other games in svg-forest before the new game is finished. Preserve other work.
Design brief: An endless dry ocean and an orchard of porcelain sound archives; warmly colored illustrated sky, patterned mineral ground, architectural bell trees, shell archives, and airborne folded creatures. Recover six memories with a listening instrument; exploration continues afterward.
Implementation: Perspective projection of reusable SVG symbols; bounded deterministic chunk generation and pooled visible SVG nodes; depth sorting/fog; delta-time movement and subtle head bob; keyboard/drag and two independently captured pointer joysticks; responsive field journal and optional procedural audio.
Proof: Parse/dependency checks, live Chromium desktop/mobile flows, simultaneous touch-pointer test, long-travel node bounds and deterministic generation, offline loading, visual screenshots, independent skeptical review. Verify exact-file diff, clean baseline, remote main, and published commit.

- [x] Finish the lore and visual specification before artwork implementation.
- [x] Build the single-file SVG world, exploration loop, and responsive controls.
- [x] Playtest, inspect rendered desktop/mobile views, and address independent review.
- [x] After the game is complete, add and validate the alphabetically placed gallery tile.
- [x] Prepare the exact-file main commit and push; verify remote outcome in the final response and Git history.

Lore locked: Porcelain Tide — an orchard for vanished oceans. The vanished keepers stored sea sounds in porcelain Brinebells; stilted nautilus Tide Archives and folded Sailmoths tend the endless salt. Six recovered human memories return a tide to the air, after which exploration remains open. Palette: coral, celadon, ivory, ink; engraved botanical forms beneath an eclipsed sun.

Review:
- Delivered `svg-forest/gpt-6-astra-ultra-svg-forest.html` (52,730 bytes), a standalone SVG-only perspective game with original inline artwork, synthesized optional audio, six recovered memories, a returning tide, persistent position/progress, field notes, and indefinite exploration. No existing SVG game or gallery content was opened until this game was finished.
- Added one unique GPT-6 Astra / Ultra tile to `svg-forest/index.html`, between GPT-5.6 Terra and Grok 4.5. All 30 model tiles remain alphabetically ordered; clicking the tile launches the new game.
- Independent final behavioral proof: 24/24 checks passed. Real keyboard and mouse events; all six unique memories; movement after completion; pause/blur cleanup; saved progress and invalid/blocked storage; true Chromium CDP multitouch with independent pointer identities, simultaneous walking/turning, individual release, cancellation, and no page zoom/pan. Zero runtime errors, failed requests, or external game asset requests.
- Streaming proof: 360 jumps through both positive and negative world coordinates (roughly 24,000 units from origin); fixed 121 chunks and fixed SVG node count throughout, maximum 650 entities and 88 visible sprites, within a 180-slot pool. Regenerated chunks matched deterministically.
- UI proof: installed Google Chrome in isolated Playwright contexts, offline `file://` game and local HTTP gallery at `http://127.0.0.1:8786/svg-forest/index.html`; local player, no authentication. Desktop 1440×960, tablet 768×1024, mobile 390×844 and 320×568, landscape 844×390 all checked for layout and overflow. Journal pause/focus trap, optional sound toggle/audio context, reduced-motion default, gentle camera, six-memory finale, and gallery link passed. Measured 120-frame median/p95 intervals of 16.7 ms; renderer median 0.2 ms and p95 0.4 ms on this machine.
- Skeptical review found and resolved backward head-bob asymmetry and a tide clipping chord. Reviewer verified both corrections. Syntax, SVG-only dependency scan, local link, unique metadata, ordering, and `git diff --check` passed.
- Screenshots: `/private/tmp/porcelain-1440-intro-final.png`, `/private/tmp/porcelain-390-play-final.png`, `/private/tmp/porcelain-320-intro-final.png`, `/private/tmp/porcelain-844-play-final.png`, `/private/tmp/porcelain-complete-final.png`, `/private/tmp/porcelain-gallery-tile.png`. Reproducible temporary harnesses and JSON reports live under `/private/tmp/porcelain-*`; the game itself has no runtime dependencies.
- Not verified: Safari, Firefox, physical touchscreen devices or device-specific browser edge gestures, and subjective audio output. Chrome mobile testing used emulated touch; timing applies to this machine. No known remaining blockers.
- Publication preflight: clean initial main checkout, origin `git@github.com:ealdent/the-grove.git`, fetched remote main with zero divergence. Only the new game, gallery index, and this task record are included in the authorized commit/push. Local playable preview served at `http://127.0.0.1:8786/svg-forest/gpt-6-astra-ultra-svg-forest.html`.

# 2026-09-04 — Phosphor Wake font

Goal: Create an original, installable pixel monospace with a worn CRT character, a beautiful specimen under utils/, downloadable font/web kit, and an index entry. Commit and push to main.
Project: Personal / The Grove. Initial state: clean main at 00abbd5; origin git@github.com:ealdent/the-grove.git.
Design: Phosphor Wake. Original pixel construction; clean and distressed Burn cuts. Broad Latin/coding/arrow/terminal coverage. True soft phosphor halo supplied as an adjustable web effect, with this distinction explicit in the downloads.
Scope: utils/phosphor-wake.html, utils/phosphor-wake/ font sources/assets/docs, utils/index.html, index.html category description, README.md, this record. Preserve unrelated changes.
Proof: Font parsing and consistent cell metrics; coverage and shaping checks; real desktop/mobile browser interaction, font loading, downloads, console/network and screenshots; skeptical review; exact-file commit and verified remote publication.

- [x] Build original font outlines, installable TTFs, WOFF2s, source and downloadable package.
- [x] Build responsive specimen, live tester, coding examples, glyph explorer and download section.
- [x] Add utility index and README entries.
- [x] Verify fonts, page behavior, responsive layout, downloads and independent review.
- [x] Complete publication preflight for the authorized main commit/push; final remote outcome is recorded in Git history and the final response.

Review:
- Delivered Phosphor Wake and Phosphor Wake Burn: original hand-authored pixel outlines, 632 encoded characters, 665 glyphs, 32 optional coding ligatures. Complete printable ASCII, Latin-1 Supplement, Latin Extended-A, box-drawing and block-element ranges; selected math, arrows, Greek symbols and seven Powerline glyphs. All encoded characters have 720-unit advances at 1200 UPM; ligatures preserve N source cells. Burn includes monochrome distressed contours; CSS supplies soft light.
- Installable TTFs, compact WOFF2s, MIT license, installation/editor instructions, exact coverage manifest, original drawings, deterministic fontTools builder, pinned requirements, and HarfBuzz verifier are included in the downloadable ZIP. No external runtime dependencies on the specimen page.
- Final font pass corrected double-line corner/tee joins and connected pipeline/arrow beams; added actual-outline topology and confusable-character checks. Two rebuilds produced identical artifacts. Final ZIP: 163,418 bytes; SHA-256 `ebc0e7bfc7cbd3668d4b6aeff8e068ca470ae75194e6aa80610f93c4adebb830`.
- Font proof: `/private/tmp/phosphor-font-venv/bin/python utils/phosphor-wake/verify.py` passed both faces, exact cmap coverage, fixed metrics and bounds, all 32 ligatures enabled/disabled with HarfBuzz, WOFF2 round trips, and ZIP byte parity. Native CoreText process-scope registration accepted both TTFs with the exact family names, monospace traits, and all 95 ASCII glyphs at 12pt advances for a 20pt font. No fonts were installed globally or editor settings changed.
- UI proof URL: `http://127.0.0.1:8788/utils/phosphor-wake.html`; local static server, installed Google Chrome through Playwright, anonymous visitor. 49 checks passed: actual custom face in code samples, all nine coverage groups, glyph/stylesheet clipboard, type/cut/color/glow/scanline/ligature/reset controls, four language samples, six actual file downloads with exact byte comparisons, index navigation, reduced motion, touch navigation, and visible font/manifest failure fallbacks. No JavaScript errors, failed requests, HTTP errors, or external runtime requests.
- Responsive screenshots and overflow checks: 320, 390, 701, 768, 1050 and 1440px widths. Visually inspected desktop hero/full page/code and mobile hero/tester/glyph grid. Proof report and reusable browser harness: `/private/tmp/phosphor-browser-report.json`, `/private/tmp/phosphor-browser-proof.cjs`. Screenshots: `/private/tmp/phosphor-desktop-hero.png`, `/private/tmp/phosphor-desktop-full.png`, `/private/tmp/phosphor-desktop-code.png`, `/private/tmp/phosphor-320-hero.png`, `/private/tmp/phosphor-390-tester.png`, `/private/tmp/phosphor-390-glyphs.png`.
- Skeptical independent review covered page, integration, source geometry, metadata, glyph coverage, ligatures, docs/license and generated TTF tables; no remaining blockers. Visual QA caught and fixed the browser's default code-element font overriding the custom face; final proof checks the computed code font explicitly.
- Not verified: Windows/Linux installation, Safari/Firefox, individual editor ligature/cursor implementations, or physical touchscreen hardware. Monochrome TTFs carry the Burn contours; luminous glow requires the included CSS or an application's own rendering support.
- Publication preflight: initial clean main at 00abbd5, correct origin `git@github.com:ealdent/the-grove.git`, fresh fetch and zero divergence from origin/main. GitHub Pages is configured for main/root at `https://ealdent.github.io/the-grove/`. Only the task files are included in the authorized main commit/push.

# 2026-09-05 — Phosphor Wake display-scale cleanup

Goal: Fix the choppy large Burn lettering shown in the user's GENESIS COLONY screenshot, rebuild every font/download asset, update the specimen, and commit/push to origin/main.
Project: Personal / The Grove. Baseline: clean main at 54d4b14, origin git@github.com:ealdent/the-grove.git.
Diagnosis: Random microcell sparks and deep horizontal slits baked into Burn outlines become teeth and grooves when enlarged. The small-scale glow hides those defects.
Design: Preserve original pixel skeleton, coverage, family names and monospace spacing. Replace destructive distress with a small, consistent contour expansion; leave scanlines and soft phosphor halo to rendering. Publish version 1.100 to distinguish replacement fonts and refresh web assets.
Scope: font generator/verifier, both TTF/WOFF2s, coverage, kit ZIP, CSS/docs, demo page, utility wording, this plan and correction lesson. The attached game screenshot is a visual reference only; no other project files will be touched.
Proof: raw/glowing before/after title and code rendering at 24/48/160/240px, DPR 1/2, fixed metrics/coverage/shaping/topology, native CoreText loading, browser interactions/downloads, independent skeptical review, clean exact-file publication and live byte parity.

- [x] Remove ragged/scored font geometry and rebuild versioned font assets.
- [x] Update demo/kit copy and large-size inspection controls.
- [x] Inspect before/after large and small renderings; pass font/native/browser/package verification.
- [x] Complete skeptical review and publication preflight for the authorized main commit/push; final remote outcome is recorded in Git history and the final response.

Review:
- Replaced the Burn face's microcell scatter and deep scanline scores with an even eight-unit contour expansion. The outline has no extra islands, teeth, or cut-out damage; wide text preserves its pixel silhouette. Softened the CSS halo's inner edge and reduced screen scanline opacity. Actual font binaries carry the fix independently of the demo's effects.
- Preserved 632 encoded characters, 665 glyphs, 32 source-width coding ligatures, family/file names, 720-unit advances and 1200 UPM. Added version 1.100 to font identity/version/head fields, manifest, CSS, demo, and cache-versioned download URLs; both TTFs/WOFF2s and the complete ZIP were rebuilt.
- Boundary tracing now separates loops that touch at a vertex before expanding them, preventing a folded Powerline ring counter. Regular appearance is preserved: 659 glyphs are byte-identical; six equivalent contour decompositions matched the original at all 15,552 tested microcell centers. The checker lives at `/private/tmp/phosphor-regular-parity.py`.
- Added 24/48/160px presets, a 240px maximum, and a Raw pixels toggle that removes glow and scanlines. Large text stays inside a scrollable specimen; updated installation instructions explain replacing earlier fonts. Updated root README wording and recorded the correction in tasks/lessons.md.
- Font proof: `verify.py` passed cmap/metrics/bounds, confusable distinctions, box topology, HarfBuzz on/off shaping, WOFF2 parity, metadata versions, no added damage contours, preserved counter winding, continuous stroke probes and ZIP byte parity. CoreText process registration accepted both final fonts as monospace with all ASCII at 12pt advances for a 20pt font; no system fonts were installed globally.
- Visual proof: reproduced GENESIS COLONY with the original and revised fonts, raw and glowing, at 24/48/160/240px and DPR 1/2. Inspected the original broken edges and revised clean silhouettes, readable small code, full desktop hero, and the demo's raw 240px title. Images: `/private/tmp/phosphor-v110-before-dpr1.png`, `/private/tmp/phosphor-v110-after-dpr1.png`, `/private/tmp/phosphor-v110-light-dpr1.png`, `/private/tmp/phosphor-v110-micro-dpr1.png`, `/private/tmp/phosphor-v110-max-dpr2.png`, `/private/tmp/phosphor-v110-desktop-hero.png`, `/private/tmp/phosphor-v110-demo-240-raw.png`.
- Browser proof: 65 checks passed in installed Chrome/Playwright at `http://127.0.0.1:8788/utils/phosphor-wake.html`, anonymous local visitor. Coverage groups, controls, raw/preset/max-size behavior, preserved code font, clipboard, downloads, failure fallbacks, reduced motion, touch navigation, and 320/390/701/768/1050/1440px document overflow checks all passed; no page errors or failed/external requests. Final package pass independently downloaded all six assets with exact byte comparisons and loaded both versioned families through the bundled CSS. Reports: `/private/tmp/phosphor-v110-browser-report.json`, `/private/tmp/phosphor-v110-package-report.json`.
- Two rebuilds yielded identical TTF/WOFF2/manifest/ZIP hashes. Final ZIP: 102,799 bytes, SHA-256 `94804b1ea555e79a2d34ab3e8fa787ca77074d6f2105e253577a919e4f4c7238`. Independent static reviewer approved geometry/loops/overlap flags, metadata, links, and tester behavior with no actionable findings.
- Publication preflight: fresh origin/main fetch matches local main (zero divergence), correct GitHub remote and clean initial checkout; only these font/demo/documentation/task files are included. Not verified: Windows/Linux font installation, Safari/Firefox or individual consuming apps. Existing installations or bundled copies must be replaced with v1.100; soft light remains a rendering effect.
