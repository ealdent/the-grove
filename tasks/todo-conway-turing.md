# Life on a Turing Machine (learn/conway-turing-machine.html)

Source: a single-file Turing-machine-runs-Life demo Jason supplied. Goal: verify it, rebuild it as a Learn page
with the tape, both generations and the controller on one screen, and film a glider at high speed.

- [x] Verify the source machine against a direct B3/S23 implementation (dead edges)
- [x] Compile the controller into an explicit state x symbol table; prove it lockstep-equal to the source
- [x] Engine module + node:test suite (`tests/conway-turing-engine.test.mjs`)
- [x] Console: Go-board current/next boards, Fraktur state diagram + register, two-track paper tape, transport
- [x] Article: live table row, folding diagram, sizes table, in-page check, sources
- [x] Learn index tile + README line
- [x] Film (1080p60, frame-stepped) + poster + 2400x1260 share card
- [x] Commit and push

## Review

- Source machine: 960 random boards, n = 1..12, 7,680 generations, 0 mismatches; `back()` round-trips 9,000
  steps across a generation; glider glides SE one cell per 4 generations, then freezes into a corner block.
- Compiled table (`learn/conway-turing-engine.js`): identical tape, head, state and generation after every one
  of 1,274,822 lockstep steps against the source machine (58 runs, n = 1..16). ~178M steps/s in Node.
- Closed forms, checked by the tests: 54n + 362 states; 58 + 12n steps per cell;
  12n³ + 61n² + 20n + 29 steps per generation (first generation n² + 5n + 7 fewer).
- Design: kaya Go boards (black stones = current track, white = next), head as the only light source with
  speed-aware trail persistence, controller states in Fraktur (Turing's m-configuration habit), paper tape
  drawn as two tracks. Old Standard TT / IBM Plex Mono / UnifrakturMaguntia.
- Film: 14x14 glider, 4 -> 60,000 steps/s over 6 s, block stable at generation 44 (t = 40.0 s), 43 s total,
  26.5 MB. Re-render: `node learn/conway-turing-machine/film/capture.mjs` with the repo served on :8002.
- Harness note: driving 1,000+ canvas frames in one synchronous `Runtime.evaluate` (no compositing between
  frames) turned every canvas into a broken-image box; yielding a rAF between frames, or screenshotting each
  frame, does not. It was a test-loop artifact, not a page leak (heap stayed ~12 MB over 1.2M steps).
