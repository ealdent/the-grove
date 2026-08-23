# JACK IN THE GREEN — time-loop benchmark (GLM-5.3, max effort)

Deliverable: `time-loop/glm-5.3-max-time-loop-puzzle.html` + index tile + commit/push main.

## Why morris dancing, not theater
The time-loop index already carries "Changeover" (Fable 5): closing theater,
stagehand, pale memories of past passes, contradiction = stage manager's hold.
A theater fiction would read as a riff on it. Switched to an unused fiction:
**English morris dancing on a village green, Midsummer Eve, 1920s Cotswolds.**

## Design (locked)
- Title: **Jack in the Green** (banned words: none used).
- Premise: you are the new Fool of the Hallowfield side; the Great War took the
  old dancers; a green keeps every dance stepped on it (worn like a path);
  when the 91-year-old fiddler plays, past rehearsals step out beside you.
  Contradict worn steps → the ribbons knot, the rite raises nothing.
- Voice: the old fiddler — unsentimental, fond of the village, strict about
  figures; every string in his voice.
- Nouns (load-bearing): Fool (player), Footfalls (recordings; grass-and-blossom
  dancers, kit per rehearsal), Rehearsal (iteration), step (tick), the green
  (grid), thorn (wall), flowered mark (plate), ribbon gate (door held open only
  while mark occupied), the wain (pushable cart, Sokoban), the garland
  (carryable), the pole (goal: crown it), the tangle (divergence halt),
  bow out (end rehearsal early), the fiddler takes you back a step (undo),
  the muster (self-test), fresh turf (restart).
- Art: golden-hour pastoral. Turf greens #3E5A2E/#6E8F3C, meadowlight gold
  #F2D98B, madder red #B33A2B, woad #3E5D7E, sloe #6E4668, saffron #D9A036,
  walnut #6B4A2C, parchment #F1E6C4. Low western sun, hawthorn hedge frame,
  bunting. Serif (Georgia stack), Title Case; no monospace, no letterspacing,
  no gradients on text, no glow grids.
- Diegetic UI: bunting pennant per step (countdown), "Tonight's Side" notice
  board (rehearsals), caller's crib strip (per-rehearsal input arrows), fiddler
  saws on every step, wreaths glow when weighted, ribbon gates visibly lift.

## Mechanics (all benchmark items)
- 12x12 grids, 4-dir, blocked move consumes a step. N per level: 30/40/52.
- Rehearsal ends on N or "bow out" (C); Footfalls replay inputs; cap 4
  (oldest wears away when a 5th completes).
- Marks hold ribbon gates up while occupied (bodies or the wain). Wain:
  Sokoban. Garland: auto-pickup, X sets down, carried or set down on exit;
  pole needs garland + open gate.
- Order rule (documented): eldest Footfall first each step, the Fool last;
  no entering an occupied tile (wings/gate-onto-green tile may stack).
  A gate never drops onto an occupied tile (waits for clear).
- Divergence = Footfall outcome ≠ recorded outcome → tangle halt naming
  rehearsal, step, expected vs actual in-voice; U untreads last rehearsal,
  R fresh turf.
- Undo: one step, unlimited, across boundaries (pops into prior rehearsal
  mid-run, drops that recording). Determinism: full re-simulate from
  (level, input log); expectations re-derived by replaying each run in its
  own context.
- Levels: I "The Garland" (one footfall must hold the mark), II "The Wain"
  (wain parks on far mark, footfall holds near mark, timing through two
  gates), III "Midsummer Eve" (three loads on the pole gate; the tempting
  center road crosses the worn wain-line and the standing Footfalls →
  tangle; solution hugs the west/south apron and waits). Ending resolves
  the premise (crown, bow, Jack rises, fiddler leaves, "the green rests").
- Muster (T / node harness): all 3 solutions win; determinism hash; undo
  identity; L1 interference tangle at Run I step 8; expected-B/actual-M
  tangle on a synthetic stage; order/stacking rule; wain-holds-mark; gate
  waits for clear; bow-out trim; blocked consumes step; X-while-empty
  ignored; garland left behind on exit; 4-recording cap.

## Steps
- [x] Read lessons.md, index conventions, naming (glm-5.3-max-*)
- [x] Write single-file HTML (design doc comment, pure sim, renderer, UI,
      WebAudio, muster)
- [x] Node harness: extract <script>, run muster headless until green
- [x] Browser proof: title, play Scene I (win), deliberate tangle, untread
      across boundary, T muster panel, wain-on-mark gate, index tile
- [x] index.html tile at position 3 (ord 03, renumbered 03→04,04→05,05→06)
- [x] Review section below; commit with pathspec; push main
- [x] Did NOT open other games in time-loop/

## Review
Verification, all reproducible:
- **Muster (headless node, `__GL.runMuster()`)**: 15/15 pass — all three
  intended solutions crown; determinism hash; full-depth undo/replay
  identity; both tangle directions at exact (run, step, expected→actual);
  eldest-first order + gate-on stacking; wain holds mark; ribbons wait for
  a clear tile; bow-out trim; blocked step spends; X-empty ignored;
  garland set down on exit; four-recording cap.
- **Full-game stub run**: entire script (DOM layer included, canvas
  stubbed) plays all three scenes, the ending beats, muster overlay, fresh
  turf — zero exceptions.
- **Browser (IAB, hand-played)**: title premise in voice; Scene I crowned
  live (with a non-canonical opening — first step blocked — still won);
  bow-out; Footfall replay + stacking at the gate-on; wain parked on the
  south mark holding its gate up; deliberate tangle card fired with
  "Rehearsal I, step 5" + expected/actual in the fiddler's voice; U
  untread across the boundary removed the recording and resumed rehearsal 1
  mid-dance; T showed the 15-check muster card; index tile renders 3rd
  with renumbered rows.
- Bugs found and fixed on the way: miscounted W-run lengths in solution
  literals (now `repeat(n)`), interior thorn walls ('T') treated as floor,
  win-check crash on garland-less test stages, truthy-string muster
  returns, screen-transition sceneIdx handling, pole-less scene guard.
- Audio: WebAudio synth, initialized on first gesture, M mutes; not
  audibly verified by a human.
- Keyboard automation note: IAB CUA keypress needs a prior click for
  focus; playwright body.press worked once focus existed.
