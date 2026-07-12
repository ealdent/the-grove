# Todo: Moonberry Meadow Tower Defense

## Plan

- [x] Inspect only `tower-def/index.html` to understand the listing pattern; do not open any existing game files.
- [x] Create `tower-def/gpt56sol-xhigh-tower-def.html` as a dependency-free, single-page canvas game.
- [x] Implement a randomized playable route with safe build zones and a regenerated layout on restart.
- [x] Implement five distinct towers, each with four upgrade levels and meaningful stat/behavior progression.
- [x] Implement varied enemy speeds, health, armor, resistances, splitting, and boss behavior across at least 20 waves.
- [x] Enforce a between-wave planning phase for building, upgrading, and selling towers.
- [x] Add polished responsive UI, controls/help, sound toggle, pause/speed controls, and cute cartoony canvas art.
- [x] Add the game to `tower-def/index.html` without inspecting any other game.
- [x] Verify HTML/JavaScript structure, required game content, deterministic logic invariants, and the final diff.

## Review

- Created Moonberry Meadow, a 74 KB dependency-free canvas game with five tower families, four upgrades each, seven enemy variants, 24 waves, random 1,120–1,370 px routes, and build-only upgrades.
- Added the matching GPT-5.6 Sol xHigh card to the tower-defense collection index.
- Verified JavaScript syntax, 27 unique DOM IDs, absence of external dependencies, whitespace-clean diff, 240 generated route invariants, intro-phase blocking, and a playable wave-1 planning → combat → planning simulation.

---

# Todo: Procedural Creature Simulation

## Product Spec

- Build a polished single-page “pocket ecology” in one `arcade/` HTML file, with all game CSS and JavaScript inline and only a pinned Three.js runtime loaded externally.
- Make the simulation deterministic from a visible seed. Creatures inherit a compact genome that controls body proportions, palettes, appendages, movement, metabolism, perception, and temperament.
- Generate recognizable 3D creatures entirely from reusable primitive geometry and materials: distinct silhouettes, animated gaits, eyes, tails, ears/horns, and per-specimen markings without external models or image assets.
- Simulate a stable lifecycle: roaming, seeking food and water, resting, aging, energy use, reproduction with crossover/mutation, and death. Keep the population bounded and dispose specimen-specific Three.js resources safely.
- Give the player three clear habitat interventions—plant food, call rain, and splice the selected creature—plus creature selection, specimen details, pause/speed controls, reset/new-seed controls, camera orbit/zoom, sound, keyboard shortcuts, and touch support.
- Present the world as a warm field-research diorama rather than a generic dashboard: a lush floating habitat, readable field-note overlays, a focused specimen card, and responsive layouts for desktop and mobile.
- Respect accessibility and performance: semantic buttons, visible focus, ARIA live updates, reduced-motion behavior, frame-rate-independent simulation, capped pixel ratio/population/effects, graceful WebGL/import failure states, and no heavy filters around the live canvas.

## Plan

- [x] Confirm the repository integration point, technical constraints, gameplay loop, visual direction, and verification strategy.
- [x] Create the single-file Three.js habitat and procedural creature generator with deterministic seeded genomes.
- [x] Implement creature behavior, lifecycle, reproduction/mutation, world resources, interventions, and simulation balancing.
- [x] Implement selection, camera/input controls, responsive HUD, onboarding/help, accessibility, sound, pause/speed, and reset flows.
- [x] Add the simulation to `arcade/index.html` with a matching card theme and concise description.
- [x] Verify static HTML/JavaScript integrity, deterministic generation, simulation invariants, responsive behavior, real-browser rendering/interactions, console health, and final diff cleanliness.
- [x] Revisit the finished implementation for the simplest elegant shape, fix any defects found, and record results below.

## Review

- Created Mosslight, a 108 KB single authored HTML file with a floating low-poly habitat, three constrained creature archetypes, deterministic genomes, inherited morphology and behavior, procedural names, gait animation, food seeking, rain response, aging, reproduction, mutation, and bounded population recovery.
- Added a playable caretaker loop with regenerating Biocharge, targeted spore/rain placement, manual variant budding, visible mutation summaries, diversity/generation goals, specimen inspection, orbit/zoom controls, pause/speed/sound, seeded world regeneration, event feedback, keyboard shortcuts, multi-touch guards, reduced-motion handling, and explicit WebGL/import/context-loss states.
- Added a responsive Arcade card and compact layouts with 44 px controls, an inert/focus-managed introduction, collapsible mobile inspector, mobile event toast, and Help-dialog sound access. All authored CSS and game logic are inline; the pinned Three.js 0.184.0 runtime is the sole network dependency.
- Verified module syntax, 45 unique DOM IDs and resolved references, whitespace-clean diff, zero browser warnings/errors, deterministic same-seed signatures and snapshots after 600 ticks, different-seed divergence, 10,000-tick finite/in-bounds stability, natural population reservation at 20/22, manual Bud behavior at 21→22→reject, and flat renderer memory across 15 seeded regenerations.
- Verified real-browser onboarding isolation, specimen selection, keyboard mutation, spore and rain placement, the Rain → Bud affordability regression, seeded replay, pause behavior, Help/sound access, and responsive layouts at 1280×720, 390×844, 320×568, and 568×320.
