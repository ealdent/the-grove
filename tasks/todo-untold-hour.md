# The Untold Hour (time-loop benchmark, Fable 5.2, high)

Deliverable: `time-loop/fable-5.2-high-time-loop-puzzle.html` plus row 03 in `time-loop/index.html`
and a line in the README's Time Loop list.

Fiction: a masonry observatory whose dials have lost their styles; the hour cannot be told, so it
repeats. Each repeat leaves a shade (your owed shadow) that replays your keys. Sun-eyes hold bars
shut while they see the sun; a walker, a stone globe or a gnomon's moving shadow shades them. The
style must be carried to the Seat. A contradiction is an eclipse. The Astronomer's daybook narrates,
and her own forty-year-old shade is the past to protect in court IV.

## Plan
- [x] Pure engine: `simulate(court, log)`; undo = drop the last key
- [x] Four courts designed and checked in Node (solutions, one-casting BFS, lie cases)
- [x] Canvas rendering: court, moving shadows, characters, marble hour scale, daybook page
- [x] Title, court intros, eclipse entry, won cards, ending
- [x] Hidden proofs (T on the title, or `#proofs`), browser verification
- [x] Independent review, fixes
- [x] Index row, README line

## Review
- Built from split sources in the session scratchpad (`src/00..99`, `build.mjs`), so the HTML is
  the only artifact in the repo.
- Verified with a headless-Chrome CDP harness: real key events, mouse clicks, touch taps and
  swipes; 1400x860, 1280x800 at dpr 2, 390x844 and 844x390 touch; 60 fps; no console errors.
- Proofs (17): each court's intended solution wins on its last key; every prefix unsaid back to
  nothing and said again gives the same state; seven deliberate contradictions halt at the expected
  casting, mark, expected and found; the four-shade limit; the elder-steps-first rule.
- One-casting BFS finds no win in any court.
