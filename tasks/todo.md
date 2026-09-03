# ESSENTIA: The Spagyric Perfumery — gemini-3.8-flash-high-tower-def-2

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
