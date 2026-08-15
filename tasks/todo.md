# Text Steganography Decoder (utils/text-steganography-decoder.html)

## Plan
- [x] Inspect existing `utils/` index and styling tokens
- [x] Design and implement single-page forensic station `utils/text-steganography-decoder.html`
  - [x] WebGL background shader (cybernetic CRT scanline, radar reticle, phosphor bloom, mouse/pulse reactive) + fallback
  - [x] Multi-channel decoding algorithms:
    - [x] Zero-width & invisible Unicode (permutations, base4, base8, tag characters, soft hyphens)
    - [x] Homoglyphs & confusable Cyrillic/Greek/Math Unicode detection & binary recovery
    - [x] Whitespace & SNOW (trailing spaces/tabs, double spaces, non-breaking spaces)
    - [x] Null ciphers (1st, 2nd, 3rd, last letter of words, line/sentence acrostics, stepping)
    - [x] Bacon's cipher & Case modulation (5-bit Baconian, 8-bit case binary, capitals stream)
    - [x] Punctuation & Morse modulation
    - [x] Heuristic language & intelligibility scoring ranker
  - [x] Interactive UI:
    - [x] Multi-scan trigger with progress telemetry & audio FX
    - [x] Interactive X-Ray Lens visualizer highlighting hidden characters
    - [x] Presets / Mystery Puzzle library (8 curated specimens)
    - [x] Steganography Studio / Encoder lab for crafting hidden messages
    - [x] Drag-and-drop file upload & clipboard tools
  - [x] Web Audio synthesizer for retro terminal audio feedback + mute toggle
- [x] Add tool tile to `utils/index.html`
- [x] Verification:
  - [x] Syntax check with `node --check`
  - [x] Test decoding all specimens across all methods
  - [x] Test encoding -> decoding roundtrips in Stego Studio
  - [x] Test mobile responsiveness, WebGL resizing, audio toggle, and error handling
- [x] Commit with clean git command and push to origin main

## Review
- Built **STEG·SCAN // Deep Text Steganography Forensic Station** in `utils/text-steganography-decoder.html`.
- Implemented comprehensive multi-channel decoding:
  1. Zero-width invisible Unicode permutations (ZWSP, ZWNJ, ZWJ, BOM, Word Joiner, Base-4 quaternary, soft hyphens).
  2. Unicode Language Tag Characters (U+E0000..U+E007F) used in modern synthetic AI watermarks.
  3. Homoglyphs and confusable Unicode letters (Cyrillic, Greek, Math Latin) with normalized sanitization and binary bit extraction.
  4. Whitespace SNOW trailing spaces/tabs and inter-word space modulation.
  5. Arrangement & Null Ciphers (1st, 2nd [Pershing cable], 3rd, last letters, line acrostics, telestichs).
  6. Baconian 5-bit case modulation and capital letter streams.
  7. Punctuation sequence and Morse code extractions.
  8. Heuristic Intelligibility evaluation ranking findings by confidence.
- Built interactive features:
  - Procedural WebGL background shader with cybernetic radar sweep, phosphor particles, mouse reactive coordinates, and scan pulse burst.
  - Web Audio synthetic retro sound engine with mute/unmute control.
  - Interactive Unicode X-Ray Lens highlighting invisible and confusable characters with inspectable badges.
  - 8 curated mystery specimens & puzzles for 1-click loading.
  - Stego Studio / Encoder Lab for generating custom steganographic texts.
  - Drag-and-drop text file loader and clipboard copy actions.
- Added styled tile card on `utils/index.html`.
- Verified with node script syntax check and full test harness simulating all steganographic decodings.
