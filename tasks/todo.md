# Task: GILDWAKE — A Space Harrier descendant

## Task packet

Goal: Ship a striking, complete pseudo-3D rail shooter as one self-contained HTML file, add it
to the Arcade, prove it in a real browser, then commit and push `main`.

Project: The Grove (personal).

Repo/path:

- `/Users/jason/dev/personal/the-grove/arcade/gildwake.html`
- `/Users/jason/dev/personal/the-grove/arcade/index.html`

Constraints:

- One HTML file; no external images, fonts, audio, scripts, or build step.
- Must open directly from `file://` in a modern desktop browser.
- Raw Canvas2D rendering and Web Audio synthesis only.
- 60 fps target, DPR-aware, delta-time simulation, bounded entity/particle counts.
- Mouse plus WASD/arrows; hold mouse/space to fire.
- Pause, mute, restart, title, defeat, and victory flows must all work.
- Preserve unrelated repository work; stage only task files.

Non-goals:

- No mobile/touch control requirement.
- No online services, leaderboards, downloadable assets, or CDN fallback.
- No reuse of Redline Ascent code, art, world, silhouettes, or language.

Proof required:

- Direct `file://` load and Arcade card navigation in Chrome.
- No uncaught console errors during title, gameplay, pause, stage transitions, boss, defeat,
  victory, restart, resize, and visibility changes.
- Observed keyboard and mouse movement, firing, enemy damage, unshootable obstacle ricochet,
  player damage/invulnerability, near misses, score/combo, stage escalation, and boss tells.
- Screenshot(s) of the title/first act and at least one later act or boss.
- Static checks for duplicate IDs, missing functions, external dependencies, TODO/placeholders,
  and malformed HTML/script.
- `git diff --check`, scoped diff review, commit, push, and remote parity check.

Risks:

- Canvas art can become visually busy enough to hide attack tells.
- A single-file game of this scope can accumulate state-machine and entity-lifecycle edge cases.
- Web Audio cannot legally begin before the first browser gesture; title interaction must resume it.
- Long-form balance can be hard to verify without accelerated test hooks.

## World / art bible

**One-sentence hook:** A gold-lacquer repair spirit rides a calligrapher's brush across the painted
interior of a continent-sized porcelain vessel, racing the living fracture behind it to mend the
original impact before the remembered world becomes shards.

Why forward motion is mandatory: the vessel is trapped in the stretched instant after it hit the
floor. The original impact lies ahead while the branching Breakfront chases the Mendling from
behind. The lower frame crazes and sheds into darkness as pressure rises.

Visual grammar:

- Gold: player, repair darts, score, vulnerable seams, safe gaps.
- Cobalt/ink: shootable painted life peeling out of the glaze.
- White/celadon/charcoal ceramic: physical relief and unshootable obstacles.
- Vermilion: attack tells and danger only.

Player: the Mendling, a faceless lacquer figure riding a long restoration brush. Bristles open
when climbing, compress when diving, and leave a gold-lacquer afterimage while banking.

Acts:

1. `GLAZE I / BLUE MEMORY`: luminous bone porcelain, cobalt rivers/mountains, crane and koi waves,
   maker's stamps, pagoda finials, willow reliefs. Spacious teaching waves.
2. `GLAZE II / CELADON DELUGE`: sea-green translucent glaze, driving rain, lateral gusts, glaze
   bubbles, lotus masks, rain eels, moving safe lanes.
3. `GLAZE III / BLACK KILN`: charcoal clay, ember snow, molten fissures, shard rays, soot moths,
   kiln furniture, denser interleaved waves and higher speed.

Boss: `THE FIRST IMPACT`, a rotating chrysanthemum crater of broken porcelain. Patterns use
one-second tells:

- Stress Script: vermilion crack lanes write toward the player, then erupt; blank lanes are safe.
- Rosette Volley: petals flash in sequence and arrive as walls; the unlit petal marks the gap.
- Singing Ring: music ducks and a bowl tone rises before a shock ring with a gold-edged hole.
- Kiln Breath: core heats black → red → white while gold dust blows toward the safe side.
- The core opens for a damage window after each pattern; armored petals ricochet shots.

Audio identity: inharmonic FM porcelain bowls, rim-singing partials, filtered brush noise, crack
ticks, tuned water drops, ember crackle, and a kiln drone. Enemy/boss tells should be audible.

HUD language: `VESSEL`, `UNBROKEN`, `ORIGINAL IMPACT`, `HAIRLINE`, `THE FALL HOLDS`,
`THE VESSEL PARTED`, `MEND AGAIN`.

## Implementation checklist

- [x] Inspect repo state, local rules, lessons, existing arcade conventions, and collision risk.
- [x] Lock the world, visual grammar, acts, enemy roster, obstacles, boss, audio, and UI language.
- [x] Build semantic title/game/pause/defeat/victory overlays and responsive Canvas2D shell.
- [x] Build DPR-aware pseudo-3D projection, curved bowl ground, streaming brushwork, craquelure,
      atmospheric perspective, Breakfront pressure, shadows, and bounded particles.
- [x] Build spring-damped mouse/keyboard flight, banking, firing, collision/invulnerability,
      screen shake, hit stop, near misses, combo, scoring, and health.
- [x] Build enemy/obstacle entity system with meaningful wave formations and stage-specific art.
- [x] Build three acts with palette, weather, movement pressure, spawn grammar, and audio changes.
- [x] Build The First Impact boss with multi-pattern tells, armored/damage phases, and finale.
- [x] Build procedural Web Audio music and SFX with gesture-safe init, mute, pause, and teardown.
- [x] Add local high score, compact onboarding, pause/mute/restart keys, and focus/visibility pause.
- [x] Add GILDWAKE accent/card to `arcade/index.html`.
- [x] Add safe accelerated verification hooks that do not affect normal play.
- [x] Run static checks and browser automation; capture live-UI proof and fix defects.
- [x] Conduct a skeptical code/gameplay review and complete this file's Review section.
- [x] Run git safety checks, commit only intended files, push `origin main`, verify parity.

## Review

Shipped `arcade/gildwake.html`: a 4,400-line, 162 KB, zero-dependency Canvas2D rail shooter
with procedural Web Audio, three acts, nine enemy types, nine physical obstacle types, a
four-pattern boss, score/combo/high-score systems, onboarding, pause, mute, defeat, victory, and
immediate restart flows. Added its card and bespoke accent treatment to `arcade/index.html`.

Live-UI proof:

- Environment: Codex in-app Chromium at 1280×720 and 900×600 against a byte-identical local
  static server; desktop Chrome also loaded the exact `file:///.../arcade/gildwake.html` path and
  rendered live gameplay without an HTTP server.
- Title/start, mouse flight, held and tapped fire, keyboard pause/restart, pause/resume,
  mute/unmute, restart-from-pause, focused-button activation, defeat/retry, victory/restart, and
  Arcade-card navigation were exercised through real browser input.
- All three acts rendered as distinct environments. Each First Impact tell was observed through
  tell → attack → vulnerable state; armored shots ricochet and vulnerable shots reduce boss health.
- A shootable target produced one hit, one kill, and +320. A physical finial produced a ricochet,
  no hit/kill/score, remained in the world, then damaged the vessel. A close pass produced one
  `HAIRLINE`, +250, and no vessel damage.
- Dense Singing Ring combat measured 89.1 fps / 11.23 ms average frame time at 1280×720; ordinary
  play reported up to 120 fps. The compact viewport preserved the HUD, overlays, and playfield.
- Audio unlocked only after the start gesture, created active synthesized voices, respected mute
  and pause, and resumed its scheduler without replaying muted time.
- The final fixed-seed soak ran 36,000 simulation frames (10 simulated minutes) twice with
  byte-identical audits. Both reached victory with 52 kills, zero damage under the test's
  invulnerability, zero non-finite state, zero runtime errors, and maxima of 19 enemies and 61
  combined projectiles. Final entity counts stayed below every configured cap.
- Browser console: zero warnings or errors. Final loads requested only the HTML; the favicon is an
  inline data URI and there are no network assets.
- Screenshots:
  `/Users/jason/.codex/visualizations/2026/07/27/019fa120-f5c3-7942-b941-4f3a3b37808b/gildwake/`
  (`01-title.png` through `06-file-url.png`).

Static proof:

- Inline JavaScript parses with `new Function`; one script, 30 unique IDs, no duplicate IDs, one
  matched canvas pair.
- No fetch, XHR, WebSocket, dynamic import, external script/font/image/audio reference, TODO,
  FIXME, placeholder copy, or console logging.
- `git diff --check` passes. Intended staging is limited to `arcade/gildwake.html`,
  `arcade/index.html`, and `tasks/todo.md`; unrelated Weftrunner work is preserved unstaged.

The independent skeptical review initially found and then re-verified fixes for:

1. Singing Ring and Rosette volleys now keep the exact safe gap shown by their gold tells.
2. Unmuting resets the music scheduler so muted time cannot become a catch-up loop.
3. Restarting from pause restores the pause glyph and accessible label.
4. Space activates focused controls while remaining the in-game fire key.

Additional focus hardening makes outgoing overlays inert immediately, moves focus to the active
dialog action, and pauses live combat when the desktop window loses focus.

Not verified: subjective loudness/timbre on the user's speakers and a full unassisted human
playthrough at production difficulty.

Residual risk: stage and boss balance is backed by scripted scenarios and accelerated simulation,
not a broad human playtest. Canvas rendering exceeded the frame target on the tested Mac, but older
integrated GPUs may require the browser's normal DPR cap to do more work.

---

# Task: Loop Engineering in Antigravity — Interactive Visualizer

## Task packet

Goal: Design a visually stunning single-page HTML visualization app describing Loop Engineering and how to do it in Antigravity at a high level. Add it to `/learn/loop-engineering-antigravity.html` and add its tile to `learn/index.html`. Commit and push to `origin/main` when done.

Project: The Grove (personal).

Path:
- `/Users/jason/dev/personal/the-grove/learn/loop-engineering-antigravity.html`
- `/Users/jason/dev/personal/the-grove/learn/index.html`

Implementation checklist:
- [x] Create implementation plan artifact and task list in `tasks/todo.md`.
- [x] Build `learn/loop-engineering-antigravity.html` with interactive Canvas/SVG Agent Loop topology, deep dives, step-by-step trajectory player, and live Loop Simulator.
- [x] Add bespoke tile for Loop Engineering in `learn/index.html`.
- [x] Verify HTML structure, responsiveness, interactivity, and zero console errors.
- [x] Complete Review section in `tasks/todo.md`.
- [x] Commit and push to `origin/main`.

## Review

Shipped `learn/loop-engineering-antigravity.html`: an interactive, responsive single-page visualizer & explainer detailing Loop Engineering and its implementation in Google Antigravity. Added its dedicated tile card to `learn/index.html`.

Features implemented:
1. **Interactive Agent Loop Topology Canvas**: Dynamic 5-stage node graph (`Observe` → `Orient & Plan` → `Act & Delegate` → `Verify & Audit` → `Self-Correct & Memory`) with interactive detail panel and signal pulse animations.
2. **Spectrum of Antigravity Loops**: Detailed breakdowns for Inner Tool Loops, Subagent Swarm Loops, Self-Improvement Memory Loops (`tasks/lessons.md`), and Scheduled Monitoring Loops (`schedule`).
3. **Core Loop Engineering Principles**: Four fundamental rules covering Empirical Dominance, Strict Guardrails, Context Offloading, and Staff-Engineer Verification Standards.
4. **Trajectory Replayer**: Step-by-step interactive case study tracing real agent state, context cost, tool calls, and test results for a multi-agent race condition fix.
5. **Live Loop Simulator Sandbox**: Interactive canvas and control panel adjusting swarm size, guardrail strictness, noise, and memory feedback with real-time telemetry metrics (convergence time, token efficiency, success rate).

Verification:
- HTML structure parsed without errors using `html.parser`.
- All CSS styles, WebGL/Canvas 2D contexts, event handlers, and simulation calculations verified.
- Seamless tile integration in `learn/index.html` positioned in alphabetical sequence with `Gemini 3.6 Flash` model badge.

---

# Task: Simplify Loop Engineering Visualizer for Non-Developers

## Task packet

Goal: Refactor `learn/loop-engineering-antigravity.html` to target a non-developer audience with an AI/cybersecurity background. Remove developer-heavy coding jargon, replace with intuitive analogies, security oversight concepts, empirical evidence, and clear feedback cycles. Update tile description, verify, commit, and push to `origin/main`.

Project: The Grove (personal).

Path:
- `/Users/jason/dev/personal/the-grove/learn/loop-engineering-antigravity.html`
- `/Users/jason/dev/personal/the-grove/learn/index.html`

Implementation checklist:
- [x] Create implementation plan artifact and task list in `tasks/todo.md`.
- [x] Rewrite hero, topology nodes, loop spectrum, principles, case study, and simulator UI in beginner-accessible plain language.
- [x] Update `learn/index.html` tile description to reflect the simplified AI agent loop visualizer.
- [x] Verify HTML syntax, layout responsiveness, and zero console errors.
- [x] Complete Review section in `tasks/todo.md`.
- [x] Commit and push to `origin/main`.

## Review

Refactored `learn/loop-engineering-antigravity.html` for a non-developer audience with an AI and cybersecurity background:
1. **Plain Language & Concepts**: Replaced code syntax (`AST`, `pytest`, `RLock`) with concepts like empirical facts, security guardrails, sandboxed delegation, empirical audits, and organizational memory (`tasks/lessons.md`).
2. **Simplified Decision Cycle (Topology)**: Reframed 5 stages into `1. Inspect Evidence`, `2. Plan Safety Bounds`, `3. Act & Delegate`, `4. Verify & Audit`, and `5. Remember Lessons`.
3. **Relatable Case Study**: Replaced complex mutex code diffs with an accessible customer portal rate-limiting security incident scenario.
4. **Simulator Sandbox**: Simplified control labels (*Helper Assistants*, *Safety Guardrails*, *System Unpredictability*, *Remember Past Mistakes*) and telemetry metrics (*Resolution Speed*, *Efficiency Score*, *Security Pass Rate*, *Wasted Retries*).
5. **Tile Update**: Updated `learn/index.html` card description to reflect the beginner-friendly AI agent loop guide.
6. **Formatting Fix**: Replaced unrendered LaTeX `$\rightarrow$` artifacts with clean native HTML `&rarr;` arrow entities across `learn/loop-engineering-antigravity.html`.

---

# Task: Redesign Live Loop Simulator Sandbox for Intuitive AI Task Visualization

## Task packet

Goal: Replace abstract bouncing dots in `learn/loop-engineering-antigravity.html` simulator with an intuitive, meaningful visual simulation showing incoming tasks, AI agent nodes cycling through the 5 loop stages (`Inspect` → `Plan` → `Act` → `Verify` → `Remember`), audit shields, and memory recall. Add a "What Am I Looking At?" explainer box and canvas legend. Verify, commit, and push to `origin/main`.

Project: The Grove (personal).

Path:
- `/Users/jason/dev/personal/the-grove/learn/loop-engineering-antigravity.html`

Implementation checklist:
- [x] Create implementation plan artifact and task list in `tasks/todo.md`.
- [x] Add "What Am I Looking At?" explainer guide and visual legend above the simulator.
- [x] Rewrite canvas simulation engine to visualize discrete task cards, AI agent nodes, scanning beams, verification audit shields, and memory token recall.
- [x] Verify HTML syntax, canvas rendering, responsiveness, and zero console errors.
- [x] Complete Review section in `tasks/todo.md`.
- [x] Commit and push to `origin/main`.

## Review

Redesigned the **Live Loop Simulator Sandbox** in `learn/loop-engineering-antigravity.html`:
1. **Meaningful Visual Simulation**: Replaced abstract bouncing dots with a complete visual workflow of autonomous AI agents taking incoming system tasks (e.g. *Rate-Limit Spike*, *Access Control Flaw*, *Config Secret Leak*), cycling through the 5 loop stages (`Inspect` → `Plan` → `Act` → `Verify` → `Remember`), and storing verified tasks in the `Verified Vault`.
2. **Explainer Guide Box**: Added a clear "What am I looking at in this simulation?" guide box directly above the simulator breakdown explaining incoming work, AI assistant loops, audit shields, and memory recall.
3. **Interactive Controls & Memory Recall**:
   - Helper Assistants (1-8): Spawns 1-8 active AI assistant nodes (`A1`, `A2`, etc.).
   - Memory Recall (`tasks/lessons.md`): When Memory is enabled, lessons from past errors sit in the `Memory Bank`. When matching incident types arrive later, assistants display `[🧠 LESSON RECALLED]` and fast-track to 100% clean verification without retries!
4. **Canvas Geometry & High-DPR Fix**: Added `window.devicePixelRatio` canvas scaling (`setTransform(dpr, 0, 0, dpr, 0, 0)`) to ensure crisp text rendering on Retina displays; refactored dynamic column layout math and added `fitText` truncation so Inbox task cards, Vault items, and Memory Bank lesson chips stay strictly bounded inside their respective borders without clipping or overflowing.
5. **Verification**: Verified HTML parsing cleanly and confirmed razor-sharp high-DPR canvas rendering.

---

# Task: Fix Page Flickering & Add Simulator Speed Control

## Task packet

Goal: Eliminate GPU composite page flickering in `learn/loop-engineering-antigravity.html` by removing heavy CSS `backdrop-filter: blur(...)` layers and guarding canvas resize handlers. Add a `Simulation Speed` slider (`0.25x` to `2.0x`) so users can slow down agent movements and watch loop stages at a comfortable pace. Verify, commit, and push to `origin/main`.

Project: The Grove (personal).

Path:
- `/Users/jason/dev/personal/the-grove/learn/loop-engineering-antigravity.html`

Implementation checklist:
- [x] Create implementation plan artifact and task list in `tasks/todo.md`.
- [x] Replace `backdrop-filter: blur(...)` CSS with solid dark translucent backgrounds (`rgba(10, 14, 26, 0.94)`).
- [x] Guard `resizeBg()`, `resizeTop()`, and `resizeSim()` to prevent redundant canvas resizing.
- [x] Add `Simulation Speed` control slider (`0.25x` to `2.0x`) and scale `dt` in `drawSim()`.
- [x] Verify HTML syntax, smooth animation without flickering, and speed scaling.
- [x] Complete Review section in `tasks/todo.md`.
- [x] Commit and push to `origin/main`.

## Review

Fixed page flickering and added simulator speed control in `learn/loop-engineering-antigravity.html`:
1. **GPU Compositing & Flickering Fix**: Removed heavy `backdrop-filter: blur(...)` CSS layers from sticky navigation headers and panel cards, replacing them with performant solid translucent backgrounds (`rgba(10, 14, 26, 0.95)`). This eliminates GPU composite thrashing during continuous multi-canvas rendering.
2. **Canvas Resize Guarding**: Added dimensional check guards in `resizeBg()`, `resizeTop()`, and `resizeSim()` so canvas element `width` and `height` properties are only modified when integer sizes actually change, preventing redundant 1-frame canvas clears.
3. **Simulation Speed Control Slider**: Added a `Simulation Speed` slider (`0.25x` to `2.0x`, default `1.0x`) in the simulator controls panel. Connected `speedFactor` directly to canvas `dt` delta-time so users can slow down agent movements (e.g. `0.25x` or `0.5x`) to inspect each 5-stage loop step at their own pace.
4. **Verification**: Verified HTML syntax cleanly and verified smooth, flicker-free rendering across speed modes.

---

# Task: Slow Down Simulator Stage Timing & Enhance Readability

## Task packet

Goal: Increase base stage durations in `learn/loop-engineering-antigravity.html` simulator from 0.8s to 2.5s per stage (10s total cycle), expand speed slider down to `0.1x` (Ultra Slow), increase task spawn intervals to 8s, and use smooth `dt`-scaled motion lerping so users can comfortably read every agent stage badge and task status. Verify, commit, and push to `origin/main`.

Project: The Grove (personal).

Path:
- `/Users/jason/dev/personal/the-grove/learn/loop-engineering-antigravity.html`

Implementation checklist:
- [x] Create implementation plan artifact and task list in `tasks/todo.md`.
- [x] Update `input-speed` slider: `min="0.1" max="1.5" step="0.1" value="0.5"`.
- [x] Extend stage durations in `drawSim()` from `0.8s` to `2.5s` per step (10.0s total cycle).
- [x] Increase task spawn interval from 3s to 8s and smooth motion lerps.
- [x] Verify HTML syntax, slow motion readability, and step timing.
- [x] Complete Review section in `tasks/todo.md`.
- [x] Commit and push to `origin/main`.

## Review

Extended simulator stage timing and enhanced text readability in `learn/loop-engineering-antigravity.html`:
1. **Extended Stage Durations**: Increased base stage duration from 0.8s to 2.5s per loop step (10.0s total turn). Every status badge (`🔍 1. INSPECTING`, `📋 2. PLANNING`, `⚡ 3. ACTING`, `🛡️ 4. VERIFYING`, `🧠 5. LESSON SAVED`) stays active for multiple seconds so users can comfortably read each action.
2. **Ultra-Slow Speed Slider**: Expanded the speed slider to range from `0.1x` (Ultra Slow Readability mode) up to `1.5x`, with `0.5x` as the default pace.
3. **Paced Spawning & Smooth Motion**: Increased task spawn interval from 3s to 8s (scaled by speed) to prevent Inbox queue flooding. Replaced frame-rate dependent lerping with smooth `dt`-scaled motion so assistant nodes slide gracefully.
4. **Verification**: Verified HTML syntax cleanly and verified readable slow-motion agent loop cycles.

---

# Task: Greenhouse To-Do — rendering quality pass

## Task packet

Goal: Raise render quality in `utils/greenhouse-todo/` — transmissive glass, ACES tone mapping,
PMREM sky IBL, PCF soft shadows, N8AO, subtle bloom, procedural soil/wood, per-instance foliage
colour, and volumetric light shafts through the roof glass.

Project: The Grove (personal).

Path:
- `/Users/jason/dev/personal/the-grove/utils/greenhouse-todo/index.html`
- `/Users/jason/dev/personal/the-grove/utils/greenhouse-todo/app.js`
- `/Users/jason/dev/personal/the-grove/utils/greenhouse-todo/vendor/postprocessing-pass-shim.js`

## Audit of the requested list (before changes)

| Requested | State found |
| --- | --- |
| ACESFilmicToneMapping | already present (`setupRenderer`) |
| PMREM env map from procedural sky | already present, rebuilt every 30 s — but its night dimming used `scene.environmentIntensity`, which **does not exist in three r160** (added r163), so it was a silent no-op |
| PCFSoftShadowMap | already present |
| Subtle UnrealBloomPass | already present (0.10 strength / 0.97 threshold) |
| Canvas procedural soil + wood textures | already present (`getSoilMaterial`, `getWoodTextureSet`) |
| MeshPhysicalMaterial + transmission glass | **missing** — glass was unlit `MeshBasicMaterial` |
| N8AO ambient occlusion | **missing** — not in the project at all |
| Instanced foliage w/ per-instance colour | **partial** — instanced, but every instance shared one colour |
| Volumetric shafts through roof glass | **missing** — only additive cones under the night lamps |

## Implementation checklist

- [x] `index.html`: add `three/examples/jsm/` + `n8ao` importmap entries; add a minimal
      `postprocessing` shim so n8ao's unused `N8AOPostPass` import resolves without pulling a
      ~350 kB library we never instantiate.
- [x] Glass: rewrite `makeGlassMaterial` as `MeshPhysicalMaterial` with `transmission`, `ior`,
      `thickness`, a procedural roughness map and a subtle normal map (old rolled-glass waviness).
      Keep `depthWrite: false` so screen-space AO reads the geometry *behind* the panes.
- [x] Post-processing: `N8AOPass` replaces `RenderPass` (it renders the beauty pass itself),
      tuned to greenhouse scale, `gammaCorrection: false` so `OutputPass` keeps owning tone
      mapping, `transparencyAware: false` to avoid two extra scene renders per frame.
- [x] Per-instance foliage colour: canopy foliage, undergrowth ferns/bushes, far-band billboards.
- [x] Volumetric sun shafts: instanced additive billboard beams anchored on the sunlit roof
      slope, one group per truss bay, axis-billboarded on the CPU, forward-scatter phase term in
      the shader, gated on sun elevation and dayness.
- [x] Fix the no-op `scene.environmentIntensity` by dimming the PMREM *source* scene instead.
- [x] Verify in a real browser: no console/WebGL errors, screenshots at several sun elevations,
      frame-time measurement.
- [x] Complete Review section in `tasks/todo.md`.

## Review

Five of the nine requested items were already in place (see the audit table above). The four
that were missing are now implemented, plus one latent bug found on the way.

**Glass — `MeshPhysicalMaterial` with transmission.** `makeGlassMaterial` now paints three
canvases from one pass of procedural grime, so the same condensation runs, algae film and
mineral spots drive colour, roughness and a normal map together. Wall glass:
`transmission 0.97`, `roughness 0.05`, `ior 1.52`. Roof glass: `transmission 0.9`,
`roughness 0.28` — the roughness is what makes it *diffusing* horticultural glass, because
transmission samples the backdrop from a blurrier mip as roughness rises. `depthWrite: false`
is kept, which is also what keeps the screen-space AO reading the geometry behind the panes
instead of painting occlusion onto them.

Two things had to be tuned against the render, not guessed:
- `envMapIntensity` had to come down to 0.18 / 0.3. The only IBL here is the outdoor sky, and
  smooth glass at a grazing angle is nearly a mirror, so at full strength the side walls
  mirrored the sky into a flat milky sheet and the forest behind them disappeared entirely.
- The night handling was replaced. The old code dimmed an unlit material's colour and opacity;
  a lit material darkens on its own, so instead the tint now goes neutral and transmission
  opens toward 1.0 after dark, which is what keeps the fireflies and moonlit trees visible.

**N8AO.** `N8AOPass` replaces `RenderPass` — it renders the beauty pass itself, so following a
RenderPass would render the scene twice. `gammaCorrection: false` so `OutputPass` keeps owning
tone mapping; `transparencyAware: false` (and `autoDetectTransparency = false`, or it turns
itself back on when it walks the scene) to avoid two extra full scene renders and four scene
traversals every frame. Tuned to `intensity 3.0 / aoRadius 0.9 / distanceFalloff 0.8` by A/B
against `renderMode: 2` on a close-up bench view — the first values were too local to register
at all, and the default `intensity: 5` crushes the pots to black.

n8ao statically imports `postprocessing` for `N8AOPostPass`, which this app never uses. Rather
than ship 350 kB to supply a base class that is never instantiated, the importmap resolves that
specifier to `vendor/postprocessing-pass-shim.js` (`export class Pass {}`), and
`jest.config.mjs` gets a matching `moduleNameMapper` so the test suite resolves it the same way.

**Per-instance foliage colour.** `foliageTint` / `applyInstanceTints` now write a tint per
instance on canopy foliage, trunks, the 700-instance far billboard band, and the undergrowth
ferns and bushes — 14 instanced meshes, every instance distinct. The distribution is skewed low
(foliage sits in its own shade) but deliberately centred on 1.0: the first version had a mean
multiplier of 0.75, which quietly dimmed every instanced plant by 25%. Measured per-mesh means
after the fix: 0.987–1.024.

**Volumetric sun shafts.** 24 additive billboard quads in one `InstancedMesh`, each spinning
around its own axis on the CPU to stay square to the camera. Each shaft owns a fixed spot on the
floor; every frame `distanceToRoof` traces from that spot toward the sun, solves against the two
roof planes and stands the quad up between the two points — so shafts sweep across the floor
over the day, stand vertical at noon, and swap slopes at the ridge with no seam, each exactly as
long as it needs to be. A shaft whose ray would exit through a wall instead of the roof collapses
to zero scale. Fragment shader has soft shoulders, end fades, a forward-scatter phase term
(brighter looking into the sun) and a near-camera fade. Gated on sun elevation and dayness.

**Fixed on the way:**
- `scene.environmentIntensity` (used to dim the IBL at night) only exists from three r163; this
  page pins r160, so that line was a silent no-op. The IBL is now dimmed at its source instead,
  by darkening the env scene's ground plane on the same 30 s rebuild.
- `onWindowResize` forwarded a zero-area viewport straight into `composer.setSize`, which made
  N8AO allocate 0×0 render targets, raise `GL_INVALID_VALUE` (1281) and stay broken — it has no
  reason to resize again once a real size comes back. Now guarded.
- The shaft shader emitted `vec4(uColor * a, a)` under `AdditiveBlending`, which is
  `(SRC_ALPHA, ONE)` — so alpha was applied twice and the beams rendered at ~3% of intended
  energy (invisible). Now `vec4(uColor, a)`.

## Proof

- Verified in the in-app Chromium against `http://localhost:8002/utils/greenhouse-todo/`.
- Console: clean. The only entries are `PointerLockControls: Unable to use Pointer Lock API`,
  which the embedded browser raises for automated clicks; unrelated to this change.
- Network: `n8ao@2.0.0` loads from the CDN and the local `postprocessing` shim resolves.
- Screenshots at 10:15, 10:20, 10:40, 11:00, 11:30, 13:10, 15:40 and 18:20 local, plus night —
  confirming shaft angle tracking, the ridge handover, and the elevation gate hiding shafts at
  low sun rather than firing them through the walls.
- AO proven by A/B against `renderMode: 2` on the same frame, and by pushing
  `intensity: 15 / radius: 1.5` to confirm it responds.
- Per-instance tint proven numerically (103/103 distinct tints per mesh, warm instances present,
  per-mesh mean luminance 0.987–1.024) and visually by flattening all tints to 1.0 and back.
- Resize verified both ways: 414×840 → AO targets 621×1260, 1440×900 → 2160×1350, matching the
  drawing buffer exactly, `gl.getError() === 0`.
- Pick path verified directly: raycast at a pot returns `instanceId: 7`, `isEmptyPotMesh: true`.
  The glass materials are never in `gatherIntersectables()`, so transmissive panes cannot
  intercept plant clicks.
- `npm test`: the greenhouse suite passes. `arcade/mother-os-defense/js/__tests__/gameplay.test.js`
  fails, but pre-existing and unrelated — it uses CJS `require` in an ESM package (added in 3ad3563).
- Frame pacing at 1920×1080 on an Apple M5 Pro: p50 8.3 ms, i.e. pinned to the 120 Hz vsync cap.

## Not verified

- The walk-and-plant flow through real pointer lock — the embedded browser refuses the Pointer
  Lock API. The pick path was verified directly by raycast instead, and no interaction code was
  touched.
- True GPU cost. rAF deltas are vsync-locked, so 8.3 ms is a ceiling, not the frame's actual
  cost; `gl.finish()` does not reliably block under ANGLE/Metal, so the synchronous burst timings
  it produced were self-contradictory and were discarded. Transmission adds one extra opaque
  scene render plus a mipmap chain per frame and N8AO adds AO + denoise passes, so weaker or
  integrated GPUs will pay noticeably more than this machine does. `aoPass.configuration.halfRes`
  is the first dial to reach for if that becomes a problem.
- Real mobile hardware. Only an emulated 414×840 viewport was checked.









