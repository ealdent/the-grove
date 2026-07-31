# Paradox Vault — time-loop grid puzzle

Single self-contained file: `arcade/paradox-vault.html`. Vanilla JS + Canvas,
no libraries, no assets, no network calls.

## Plan

- [x] Pure simulation core — `simulate(level, tokens)` with zero DOM/clock/RNG reads
- [x] 12x12 grid, discrete ticks, bumps consume a tick
- [x] 40-tick loops, `R` to end early, up to 4 concurrent echoes
- [x] Pressure plates → linked doors (held by entity *or* box)
- [x] Sokoban box pushing
- [x] Key pickup + vault win condition
- [x] Paradox detection via recorded-outcome comparison
- [x] Undo (`Z`) with unlimited depth, crossing loop boundaries
- [x] 3 hand-authored levels with commented solutions
- [x] "Verify solutions" debug button, runs headlessly
- [x] HUD: tick/loop counters, per-echo timeline bar, door states
- [x] 5-tick ghost forecast on `Space`
- [x] Level select, win screen, on-screen legend + controls
- [x] Arcade tile in `arcade/index.html`

## Key design decision

The whole game is a **view over a token log**. The only authoritative state is
a flat array of input tokens; the world is recomputed from scratch by the pure
`simulate()` after every keypress. That makes undo `log.pop()`, makes
"undo-then-replay is identical" true by construction rather than by careful
bookkeeping, and makes the headless verifier trivially able to reproduce any
live state. A full level is ~240 ticks, so re-simulating per keypress is free.

Paradox detection falls out of the same idea: the recorder stores each tick's
*outcome* (moved / destination / box shove / key pickup) alongside its input.
Replay recomputes the outcome and diffs it. One comparison covers every case
the spec lists — vanished box, closed door, collision with the live player —
instead of three special-cased checks.

All 11 rule ambiguities are resolved and documented as R1–R11 in a header
comment block in the file (tick order, stacked spawn, door timing, box rules,
what counts as divergence, why echoes cannot break each other, the echo
budget, early reset, key handling, the win condition, turn-based pacing).

## Levels

| # | Name | Solved in | Teaches |
|---|------|-----------|---------|
| 1 | Understudy | loop 2, tick 19, 1 echo | pin a plate with an early reset |
| 2 | Relay | loop 3, tick 31, 2 echoes | chained doors + a box on a plate |
| 3 | Inheritance | loop 2, tick 32, 1 echo | the short route destroys your own past |

Level 3's shortest-looking path to the key shoves the very box its echo must
push onto the plate each loop. Both ways of ruining it ship as automated
paradox probes.

## Review / results

Two suites, both green, both runnable headlessly against the shipped HTML:

- **In-file `verifyAll()`** — 17/17. Per level: intended solution wins; two
  independent runs hash-equal; the level definition is not mutated; every
  prefix of the solution is paradox-free; full unwind-to-empty then replay
  reproduces the identical hash at every step; level 3's two paradox probes
  fire at the exact expected loop, tick and cause.
- **External adversarial suite** — 23/23. Covers the cases the shipped
  solutions don't happen to hit: same-tile contention (older entity wins,
  later one bumps but still burns its tick), an echo blocked by the live
  player, a door that was shut being open on replay, head-on swaps, the
  4-echo cap retiring loop 1, no win without the key, and undo across a loop
  boundary retiring that loop's echo.

Verified in-browser: level 1 driven to a win through real `KeyboardEvent`s,
paradox overlay showing `Loop 1, tick 9: expected to shove the box out of
(5,3) toward (5,2), but there is no box there any more`, forecast tracing an
echo's real path, in-page verify button reporting 17/17. No console errors at
any point.

Three fixes came out of visual review: wall/floor contrast was too low to read
the maze at a glance; the forecast markers drew *under* the entities so a
frozen echo hid its own markers (now drawn on top, and positions the echo
merely holds are skipped); and the paradox scrim buried the on-board highlight
the spec asks for (panel now docks to the bottom over a gradient).
