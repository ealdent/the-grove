# What the Cylinder Keeps (time-loop, Fable 5.1 Max)

Single-file music-box time-loop puzzle: `time-loop/fable5.1-max-time-loop-puzzle.html`.

## Plan

- [x] Creative brief as the leading comment block: title, premise, art direction with hex palette, voice, glossary, decided rules.
- [x] Pure engine: `simulate(air, tokens)`; undo = pop a token and recompute. Pinned figures resolve first, oldest first, then the dancer.
- [x] Causal check per note: position, push, key-lift compared against the recorded turn; mismatch = snag with turn / note / expected / actual.
- [x] Three airs with intended solutions in comments; final air's quick route shoves a flat before the first turn can (snag on turn I, note 9).
- [x] Canvas renderer: walnut case, velvet, brass cylinder timeline with one pin track per turn, comb reading edge, plates, dust and lamp flicker.
- [x] Cards for title, between airs, snag, comb-full, ending. WebAudio tines gated behind a user gesture.
- [x] Bench test button + `#test` flag: 16 checks (solutions, undo/replay identity, prefixes, contradiction, full comb, clash order).
- [x] Index row (02, sorted by model; ordinals renumbered to 09) with `.row-cylinder` accent.

## Proof

- `node` run of the extracted engine + airs: 16/16 pass. Same 16/16 from the in-page bench test under headless Chrome; zero console errors on title, play, snag, and ending loads.
- Browser pane (real Chrome, `localhost:8002`): air I played by keyboard to the escapement; air III turns I–II recorded, undo across the turn boundary returned to turn II mid-recording with the recording removed (log 33 → 32 tokens, note 17 → 16).
- Snag card verified: "Turn I has snagged on the sixth note ... you were standing in it", tile and figure highlighted in copper, pin marked on the cylinder.

## Decisions

- Stage resets every turn; the pinned rebuild the past by repeating it.
- `Enter` fills the rest of the turn with stillness and undoes as one step.
- Fifth finished turn without a win halts the box (comb full).
- README left untouched: regenerating it also rewrites stale entries in other sections; do that separately.
