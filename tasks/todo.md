# Task: Blightspore - Turn-based Puzzle Game & Cellular Automaton

## Task Overview
Build a complete, playable turn-based puzzle game ("Blightspore") in a single self-contained HTML file (`arcade/blightspore.html`) using Vanilla JS + Canvas only, and register it in `arcade/index.html`.

## Todo List
- [ ] Write detailed implementation plan in `implementation_plan.md` and check in with user
- [ ] Implement core Cellular Automaton engine (`nextCellState`, precedence rules 1-5, double buffering, 24x24 grid, 8-neighbor Moore neighborhood, out-of-bounds WALL boundary)
- [ ] Implement Gardener actions (Move 8-dir, Plant, Dig, Ignite, Wait) and heat-death condition (3+ adjacent FIRE cells)
- [ ] Implement 3-generation Prediction Preview (holding P) & Debug Assertion Mode
- [ ] Implement Unlimited Undo (Z key) & `stateChecksum()` deterministic hashing
- [ ] Author 3 levels (1. Containment, 2. Controlled burn, 3. Cultivation) with verified deterministic solution action sequences
- [ ] Implement UI: Canvas rendering (colorblind-safe states, aging ash, gardener avatar, prediction overlay), live 60-gen population chart, inspector tooltip, turn/uses counter, controls legend, level selector, win/fail modal, and "Verify Solutions" debug button
- [ ] Implement "Verify Solutions" automated headless runner for all 3 levels
- [ ] Update `arcade/index.html` to add Blightspore game card
- [ ] Verify all acceptance criteria (blinker, glider, fire spread/decay, blight starvation, prediction assertion, checksum reproducibility, headless verification)
- [ ] Commit and push to origin main
