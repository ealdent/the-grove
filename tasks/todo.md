# Todo: Auralis Drift SVG Exploration

## Product Spec

- Build `svg-forest/gpt56-terra-ultra-svg-forest.html` as a fully self-contained first-person exploration game whose renderer and every in-world graphic are pure SVG.
- Create a distinctive "Auralis Drift" alien wind-garden: a layered dusk sky and glass-sand ground populated with projected sail trees, whistle blooms, prism cairns, and drifting ray-creatures.
- Stream a deterministic endless world through a bounded chunk cache and reuse a fixed pool of SVG prop nodes so exploration stays smooth.
- Support frame-rate-independent keyboard, arrow-key, mouse-drag, and true multitouch dual-joystick movement, including moving-and-turning together, head bob, responsive sizing, and browser gesture suppression.
- Do not inspect another `svg-forest` game file before this new game is authored; only then add one alphabetically placed OpenAI / GPT-5.6 Terra / ultra gallery tile.

## Plan

- [x] Author the new single-file SVG game from first principles, including visual language, SVG definitions, deterministic world streaming, and pooled perspective projection.
- [x] Add desktop input, mouse-drag look, independent two-pointer virtual joysticks, accessibility guidance, responsive layout, and mobile gesture guards.
- [x] Inspect and update only `svg-forest/index.html` after the game is complete, placing the matching tile in case-insensitive model order.
- [x] Verify static constraints, syntax, runtime behavior, desktop/mobile input, resource bounds, console/network health, and final diff; complete a skeptical review.
- [x] Commit the scoped files to `main` and push them to its configured upstream.

## Review

- Created `svg-forest/gpt56-terra-ultra-svg-forest.html`, a 41 KB dependency-free first-person SVG game. Auralis Drift streams a deterministic 9×9 chunk window while reusing a fixed 192-slot SVG prop pool; the world uses a glass-sand ground, layered dusk sky, sail trees, whistle blooms, prism cairns, wind harps, and raylings.
- Added frame-rate-independent forward/back movement and turning, keyboard and mouse-drag look, moving-only head bob, gesture guards, responsive HUD/onboarding, and independently captured pointer IDs for the two touch joysticks. Reduced-motion preference disables head bob, ray drift/sway, and sparkle motion.
- Added exactly one OpenAI / GPT-5.6 Terra / ultra tile to `svg-forest/index.html` between GPT-5.6 Sol Pro and Grok 4.5. Static model-order verification found 20 gallery cards in case-insensitive order; the browser tile opened the correct game URL and reported no console warnings/errors.
- Static proof passed: inline JavaScript parses; there is one SVG scene with 41 paths, 13 gradients, SVG-only dynamic element creation, no canvas/WebGL/Three.js, no external asset/dependency, no network API, 40 unique IDs, and a whitespace-clean diff.
- Browser proof passed in the in-app browser: the intro dismissed, mouse drag changed the compass to Eastward bloom, W input moved the player, the renderer held 192 pooled slots with 36–45 visible depth-projected props, and console warnings/errors were empty. Desktop and 390×844 portrait captures were visually reviewed; portrait had a full-viewport scene, no page overflow, and both 97.5 px joysticks in bounds. Compact 568×320 layout testing caught and fixed an onboarding overflow; it then fit within the viewport with no page overflow. A final scoped CSS review fixed the overlapping mobile-landscape hint transform as well.
- Skeptical review found no core rendering/input or index blocker. Physical iOS/Android multitouch hardware was unavailable, so true concurrent touch was verified by independent pointer-capture implementation and static review rather than a device run.

---

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

---

# Todo: Lumenwood SVG Forest

## Plan

- [x] Create a pure-SVG first-person forest with projected pooled props, depth sorting, and head bob.
- [x] Add desktop keyboard/mouse controls and independent multitouch mobile joysticks.
- [x] Add the Lumenwood tile to `svg-forest/index.html`.
- [x] Verify syntax, responsive layout, control input, and console/network health in a real browser.

## Review

- New file: `svg-forest/gpt56-luna-med-svg-forest.html`.
- Theme: moonlit bioluminescent forest with singing spires, glass lanterns, glowcap mushrooms, ferns, and luminous stones.
- Verification: JavaScript syntax, pure-SVG dependency scan, desktop render screenshot, and mobile viewport screenshot completed; Chrome headless emitted only unrelated updater/crashpad messages.

---

# Todo: Vesperglass SVG Exploration

## Plan

- [x] Create `svg-forest/gpt56-sol-ultra-svg-forest.html` from first principles without opening any existing game files.
- [x] Build a responsive pure-SVG first-person renderer with deterministic endless world streaming, perspective scaling, depth ordering, and bounded element pools.
- [x] Design a cohesive alien twilight environment with an SVG sky, terrain, atmospheric layers, and at least three distinct projected prop families.
- [x] Implement frame-rate-independent movement, keyboard turning, mouse-drag look, head bob, and independent true-multitouch virtual joysticks.
- [x] Finish the new game before inspecting `svg-forest/index.html`, then add one matching gallery tile without opening any other game.
- [x] Verify structural constraints, JavaScript syntax, deterministic streaming/pool bounds, desktop and mobile rendering, simultaneous input, console/network health, and final diff cleanliness.
- [x] Perform a skeptical second-pass review and document the completed proof here.

## Review

- Created Vesperglass, a 55,874-byte dependency-free HTML game whose sky, terrain, atmosphere, five prop families, perspective renderer, and animated world are pure SVG. The deterministic 9×9 chunk window remains bounded at 81 chunks while a fixed 180-slot prop pool avoids per-frame SVG creation/removal.
- Added frame-rate-independent forward/back movement and turning, mouse-drag look, moving-only head bob, responsive HUD/onboarding, safe-area-aware mobile controls, independent pointer ownership, capture fallback cleanup, resize reprojection, and screen-reader instructions.
- Added exactly one Vesperglass tile to `svg-forest/index.html`; opening it through the tile and navigating Back both succeeded.
- Static proof passed: the inline JavaScript parses; all 51 IDs are unique; all DOM and SVG fragment references resolve; there is no canvas, image/media element, WebGL, Three.js, network API, external script/style, or external CSS URL; and no trailing whitespace or invalid generated attribute was found.
- Browser proof passed in Chrome 150: W moved 10.75 units, S produced a -2.91 forward-axis delta, ArrowUp produced a +4.32 forward-axis delta, D turned 1.12 radians, W+D changed position and heading together, mouse drag turned 1.08 radians, head bob reversed nine times and settled to 0.005 logical units, and perspective depth/scale correlation was -0.77.
- A 61-unit streaming run held SVG nodes at 622, loaded chunks at 81, and pool capacity at 180 with finite camera state, no invalid attributes, and a 10.3 ms observed p95 frame interval. Targeted boundary proof faded the farthest sampled prop to 0.001 opacity at depth 77.68, crossed the yaw wrap with a maximum 11.2-unit circular star step, and produced no empty prop kinds or out-of-range generated values.
- Fresh-profile CDP multitouch proof delivered two distinct touch pointer IDs with forward and turn axes both at 0.99; releasing one left the other active, and final release reset both axes and recentered both knobs. Seven viewports from 320×568 through 1440×900 had no page scrolling, full-viewport SVG, and in-bounds 82–142 px joysticks.

### UI Proof

- URL: `http://127.0.0.1:8765/svg-forest/gpt56-sol-ultra-svg-forest.html`
- Environment: local repository served by Python HTTP server.
- User/role: anonymous local player.
- Browser/session: Chrome 150 headless with fresh temporary desktop and mobile-emulated profiles, driven through CDP.
- Steps: opened directly and through the gallery tile; dismissed onboarding; walked, reversed, turned, combined movement/turning, dragged to look, crossed streamed chunks, resized through seven viewports, and drove both touch controls simultaneously.
- Expected result: responsive pure-SVG exploration with stable depth, bounded world resources, working desktop/mobile input, and no runtime/network failures.
- Actual result: matched expected behavior; desktop, portrait, and landscape captures were visually reviewed.
- Console errors: none. Failed network requests/responses: none in the instrumented game run. A separate browser launch requested a benign missing `/favicon.ico`; the game itself loaded no subresources.
- Screenshots: `/tmp/vesperglass-intro.png`, `/tmp/vesperglass-desktop.png`, `/tmp/vesperglass-explored.png`, `/tmp/vesperglass-mobile.png`, and `/tmp/vesperglass-mobile-landscape.png`.
- Result: pass.
- Remaining uncertainty: physical-device iOS Safari and Android Chrome multitouch/performance were not available; OS-reserved edge gestures cannot be fully controlled by page code.

---

# Todo: SVG Forest Model Sort

## Plan

- [x] Derive a stable case-insensitive alphabetical order from every tile's `data-model` value, preserving duplicate-model order.
- [x] Reorder only the existing tile blocks in `svg-forest/index.html` without changing tile content or filter behavior.
- [x] Verify source and rendered DOM order, provider/model filtering, console/network state, and final diff cleanliness.

## Review

- Reordered all 19 gallery tiles into stable case-insensitive alphabetical order by their literal `data-model` values, from Fable 5 through Sonnet 5. The three Gemini 3.1 Pro and two Opus 4.6 duplicates retain their original relative order.
- Static comparison against `HEAD` confirmed the href inventory and every complete card block are unchanged; only block positions moved. The `.no-results` element remains after all cards, and `git diff --check` passed.
- Chrome 150 browser proof confirmed 19 rendered cards, 16 alphabetized model-menu entries, correct duplicate counts, the expected provider menu/counts, working Gemini/OpenAI/GPT-5.6 Sol filters, and restoration to all 19 cards.
- No JavaScript exceptions, failed requests, or application-resource failures occurred. Chrome made one benign request for the absent `/favicon.ico`, which returned 404.
- Independent review found no correctness, scope, or regression issues. Screenshot: `/tmp/svg-forest-index-alphabetical.png`. Result: pass.

---

# Todo: Jam Jar Jamboree Tower Defense

## Task Packet

- Goal: Create an original, cute cartoony, dependency-free tower-defense game that opens directly in a browser.
- Project: The Grove / Tower Defense gallery.
- Repo/path: `tower-def/gpt-5.6-terra-ultra-tower-def.html` and the gallery's `tower-def/index.html`.
- Constraints: One standalone HTML file; randomized path; five tower families with four upgrades each; varied enemies and at least 20 waves; building/upgrading only between waves; do not inspect any other tower-defense game.
- Non-goals: External packages, remote assets, reuse of existing game code or game designs.
- Proof required: static checks, direct browser playthrough checks, responsive UI proof, clean scoped diff, and an independent skeptical review.
- Risks: generated path must always be playable and buildable; effects must remain bounded during long sessions; the index entry must follow the existing alphabetical listing convention.

## Plan

- [x] Author the new standalone HTML game from first principles, with a procedural meadow path, original game art, and all CSS/JavaScript inline.
- [x] Implement five differentiated towers and four meaningful upgrades per tower, with readable selection, range, and upgrade UI.
- [x] Implement diverse enemy behavior and an authored 24-wave progression, including a clear between-wave planning phase.
- [x] Only after the game is complete, inspect `tower-def/index.html` and add the new entry in its correct alphabetical position.
- [x] Verify syntax, standalone constraints, game-flow invariants, real-browser desktop/mobile behavior, console/network health, and final diff cleanliness.
- [x] Perform a skeptical second-pass review and record results below.

## Review

- Created a 96 KB dependency-free Jam Jar Jamboree game with a regenerated non-self-crossing blanket route, five tower families, four sequential and mechanically distinct upgrades per family, nine enemy variants, and 24 authored waves.
- Building, selling, and upgrades are locked to planning phases. The in-game tray, inspector, range previews, pause/speed controls, and restart flow make that state explicit. A final safeguard asks for confirmation before a fresh picnic clears an active or built-up game.
- Added the GPT-5.6 Terra / Ultra Jam Jar Jamboree card after GPT-5.6 Sol xHigh and before Grok 4.2, preserving the gallery model order.
- Static proof passed: inline JavaScript parses; exactly five tower definitions each expose four upgrades; 24 waves are defined; the new HTML has no external scripts, stylesheets, URLs, media, or image dependencies; and whitespace checks are clean.
- Browser proof passed locally over HTTP: desktop placement and an upgrade changed crumbs/rate as expected; wave 1 launched with animated enemies; upgrades and selling became disabled during combat; New picnic generated a visibly different route and seed; Chrome at 390 by 844 had a 390 px page width with no horizontal overflow and a reviewed mobile layout. Console warnings/errors were empty.
- Skeptical review found no blockers. Its mocked-canvas all-24-wave simulation completed without a runtime exception; the only P2 reset-risk note was addressed with the confirmation guard. Direct file navigation could not be run in the browser harness because that harness blocks file URLs, but the static dependency scan establishes that the file has no network or install requirement.
