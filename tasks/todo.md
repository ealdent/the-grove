# StegScan Forensic Detection Upgrade (2026-08-15)

## Task packet

- Goal: make StegScan surface the known watermark in the supplied `Nigredo` specimen while reducing noisy false-positive "payloads".
- Project: The Grove (personal).
- Repo/path: `utils/text-steganography-decoder.html` plus focused regression tooling/documentation.
- Constraints: entirely client-side and static-hostable; preserve the existing visual language; explain evidence rather than claiming certainty; do not damage existing curated specimen decoding.
- Non-goals: identifying authorship, asserting that stylistic imitation itself is steganography, or adding a remote/LLM dependency.
- Proof required: deterministic regression cases, inline-script syntax check, clean-control/noise checks, and live browser verification with the supplied poem at desktop and narrow viewport.
- Risks: overfitting one poem, combinatorial extraction noise, and presenting probabilistic signals as decoded payloads.

## Plan

- [x] Inspect production behavior, repository state, prior lessons, and current detector architecture.
- [x] Reproduce the supplied specimen and establish the hidden channel independently.
- [x] Add high-signal structural/textual watermark checks with explicit evidence and bounded search.
- [x] Separate decoded payloads from leads/anomalies so raw gibberish does not masquerade as a match.
- [x] Add deterministic regression coverage for the new channel, existing specimens, and clean controls.
- [x] Verify syntax, regressions, desktop/narrow UI, console, and production-equivalent local behavior.
- [x] Review the diff skeptically, document results here, and prepare the exact commit scope.

## Review

- Established the structural channel from the authored poem body: Unicode-aware line word-count parity across six quatrains produces the raw ring `#3A7D10`. The carrier's cycle/backward and explicit blue cues bound one right RGB-byte rotation to the likely watermark `#103A7D`; the `7D1` window equals hexadecimal 2001 on the line containing “year”. The UI retains the raw/inverted evidence and labels this an extraction lead, not a confirmed decode.
- Added a pure client-side engine for repeated-block structural analysis, exact 7/8-bit decoding, finding classification (`decoded`, `lead`, `observation`), deduplication, score clamping, and low-information noise suppression.
- Reduced the supplied specimen from 10 misleading “matches” (ordinary em dashes, punctuation Morse, and raw null streams) to 0 decoded payloads, 1 structural lead, and 1 typography observation.
- Hardened Unicode and punctuation checks: isolated invisible-character inventory, supplementary variation selectors, strict mixed-symbol dash/quote decoding, dedicated-run Morse only, and contextual typography/statistics observations. The UI now states the limitation of keyless detection for keyed model watermarks.
- Regression proof: `node --test tests/text-steganography-engine.test.mjs` passes 9/9, including the full fixture, scope isolation, mutation/flattening controls, arbitrary-quatrain control, short deterministic payloads, and exact bit-group consumption. Standalone engine and extracted page-module syntax checks pass.
- Live browser proof: all eight curated specimens retain their intended semantics; the clean control reports 0 / 0; a zero-width `OK` Studio roundtrip produces exactly one decode and copies exactly two characters. At 1440px and 390px, the grid changes from two columns to one without horizontal overflow. The supplied specimen renders `#103A7D` with its dark-blue swatch and full stanza evidence. The page and engine return HTTP 200 with no relevant console or network failures.
- Independent skeptical review found and verified fixes for deterministic short-payload suppression, truncated 7-bit fallback, and whitespace-contaminated copy output; final verdict: no remaining code blockers.

---

# Text Steganography Decoder (initial implementation)

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
