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
