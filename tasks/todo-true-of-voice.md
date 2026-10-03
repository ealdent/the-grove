# TRUE OF VOICE — time-loop puzzle (Opus 5.5, max)

Deliverable: `time-loop/opus-5.5-max-time-loop-puzzle.html` (single file, vanilla JS + one canvas, no network),
tile in `time-loop/index.html` (alphabetical by model), commit + push to main.
No peeking at other games in `time-loop/` until finished (index read only for the tile).

## Concept
Hori, outline-draughtsman of the Place of Truth (Deir el-Medina), dead with his tomb unfinished, walks the
hours of the Duat he painted. Each hour turns back after 42 oar-strokes of the barque of Ra; Thoth writes each
spent turning onto one of Hori's four home-made shabti ("answerers"), which replay the *inputs*. A contradiction
is a lie in Thoth's record: Apep rises and swallows the hour. Items = parts of the self (name, shadow, ba, heart).
Final hour: his daughter Tamit's own answerer is already in the box (history) — protect what she remembers.

## Plan
- [x] Engine (pure, Node-testable): parse levels, step(state, token), simulate(level, log), lies, undo by log
- [x] Rules decisions documented (order: eldest answerer first, live last; doors settle at end of stroke; etc.)
- [x] Solver tooling (BFS planner with subgoals; 0-answerer unsolvability) to design levels
- [x] Levels I, IV, VII, XII with solutions in comments + self-test (solutions, determinism, undo/replay, lie cases, same-square rule, clay limit)
- [x] Art: tomb-painting renderer (paint progression per hour), Hori, 4 answerers + Tamit's, weights, pans, doors, gate, items, Apep, barque, Thoth
- [x] Diegetic UI: barque band (strokes), papyrus record (inputs), answerer box, Thoth panel, "in this hour" key; subordinate legend
- [x] Title screen, hour cards, lie screen, spent screen, ending sequence (weighing, Tamit's inscription, Khepri)
- [x] WebAudio sfx + drone, mute
- [x] Touch/mouse controls, responsive layout (desktop, portrait phone, landscape phone)
- [x] Verify: Node tests, headless CDP shots (5 viewports), in-page self-test, console clean, real-key playthrough, Browser pane
- [x] Independent review pass → fixes
- [x] Index tile (row 11), README line
- [x] Commit + push

## Review
- Engine is pure (state = f(hour, log)); Node + in-page self-test: 28/28 (four solutions; determinism; undo every
  stroke to the first and replay → identical hash; a planted lie per hour caught at the exact turning/stroke; the
  same-square rule; threshold stacking; undo across a turning; four answerers max; empty-box writes refused).
- Levels (14x12): I needs 1 answerer, IV needs 2 (the stele stops the weight reaching the Djed pan), VII intended 3
  (2 possible), XII intended 2 + Tamit (1 possible). Solo BFS proves none can be passed alone.
- Independent reviewer (5 viewports, real keys, touch, 12k random runs, no rule violations) found UI bugs, all fixed:
  stacked hit-areas under sheets, out-of-order queued keys, Esc losing the hour, phone-landscape layout, sheets
  hiding the liar (now placed to avoid it: 68 random lies, 0 covered), imprecise lie wording for footings and
  blocked shoves, cropped portrait ending, keyboard words for touch players, win not saved before Enter.
- Perf: 60 fps at 1440x900 and 390x844@2 in software raster; 53 fps at 1440x900@2.
- Not verified: real iOS/Android devices (touch tested through CDP emulation only); audio judged only for errors.
