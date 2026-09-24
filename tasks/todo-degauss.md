# Degauss — mixed-space CRT / cassette-futurist typeface

Goal: an original, installable Regular + Bold typeface with discrete width
classes, full coding coverage, coding ligatures, and a specimen page in
`utils/` with downloads in several formats (same pattern as Phosphor Wake).

Project: Moon Dog Atlas personal (the-grove). Repo path: `utils/degauss/`,
specimen `utils/degauss.html`.

## Design system (decided)

- Name: **Degauss** (CRT degauss coil + tape bulk-eraser: both magnetic).
  "Kinescope" was the first pick but is a Mark Simonson typeface.
- Four width classes named like tape lengths: C30 / C45 / C60 / C90 =
  300 / 450 / 600 / 900 units (2:3:4:6 — octave, fifth, fourth).
- Space = C60 so box art, tree output and most code align on the C60 cell.
- Squircle "tube" bowls; square outer corners where a stem continues.
- Bloom traps: wedge notches at stem joints (CRT analogue of ink traps).
- Round phosphor dots (tittles, periods, colons); dotted "power-off" zero.
- Bold keeps identical advances (no reflow when syntax bolds a keyword).
- Ligatures via calt + width-matched spacer glyphs so every source character
  keeps its own glyph and exact caret position.

## Plan

- [x] Geometry core (skia-pathops shapes, squircle rrect, rings, cut strokes, dots)
- [x] Lowercase a–z, proof, iterate (traps: slot → diag → dog-bone → wedge)
- [x] Uppercase A–Z, digits (segment-style 2 3 5 6 9, power-off zero)
- [x] ASCII punctuation / symbols (redrew & and ~)
- [x] Latin-1 + Latin Extended-A + Romanian, schwa, florin, dotless j
- [x] Greek + Cyrillic, arrows, math, box drawing, blocks, shapes,
      transport controls, keyboard + IEC power symbols, Powerline
- [x] 60 ligatures (calt spacer scheme); `<<-` dropped (shell heredocs)
- [x] Build: TTF, OTF (CFF), WOFF2, WOFF, CSS, coverage.json, zip kit
- [x] verify.py: coverage, width classes, bold/regular parity, winding,
      web-font parity, ligature shaping (HarfBuzz), negative cases, kit
- [x] Specimen page `utils/degauss.html` + card in `utils/index.html` +
      README line (by hand)
- [x] Browser verification: desktop full-page, 375px (no overflow), 500px
      narrow capture, interactions via JS, console clean
- [x] Independent review findings addressed
- [x] Commit (signed) + push (d83c47e)

## Assumptions

- "Many common languages" = programming languages for ligatures; Latin
  coverage plus Greek and Cyrillic added for human languages.
- No kerning: kerning would break the discrete-width concept.
- Unhinted outlines (like Phosphor Wake).

## Review

- 913 characters and 978 glyphs per weight; 60 ligatures; widths C30 45,
  C45 95, C60 716, C90 57. Rebuilds are byte-identical.
- `verify.py` passes for both weights (TTF/OTF/WOFF2/WOFF) and the kit.
- Page checked at 1320px (full-page headless capture), 375px (pane, no
  horizontal overflow), 500px (headless narrow capture).
- Fixed during review: Bold icon clogging (lighter icon stroke), box-drawing
  seams (20-unit bleed), mobile grid blowouts (`minmax(0, 1fr)`), stray
  `data-size` attributes that the tester would have bound as size presets.
- Independent review (fresh agent): no correctness bugs in tokenizer, pad(),
  injection or calt (3.25M exhaustive + 3M random HarfBuzz cases). Fixed its
  accessibility/UX findings: clipped focus rings (inset outlines), AA
  contrast for --faint, tester height snapping on keystrokes, width strips
  sliced on phones (now wrap), ARIA on non-landmark elements (roles added),
  hex-prefix card moved out of the 60-ligature groups, inspector/filter sync
  with an empty state, debounced screen-reader summary, parallel manifest
  fetch, copy feedback reset, and verify.py now also rejects stray spacers.
- Background block added at the end of the specimen page (2026-09-24): Monotype,
  Linotype duplex, IBM Executive, CJK duospacing, iA Writer Duo/Quattro, sourced.
  History is background only; the term "mixed-space" stays.
- Not verified: Safari/CoreText shaping, real screen-reader output, Windows
  rendering of the unhinted TTF (gasp table added for greyscale smoothing).
