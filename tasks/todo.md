# SynthID-Text Interactive Learning Experience (2026-08-15)

## Task packet

- Goal: create a comprehensive, source-grounded tutorial under `learn/` that teaches SynthID-Text and adjacent provenance/detection methods through progressive explanation, hands-on simulations, and an expressive WebGL/Three.js experience; add it to the Learn index.
- Project: The Grove (personal).
- Repo/path: `learn/synthid-text.html`, companion public-behavior modules/tests, `learn/index.html`, and this task record.
- Constraints: static GitHub Pages deployment; primary sources only for technical claims; explain tokens/probabilities before watermark jargon; clearly distinguish a faithful toy model from Google’s keyed production detector; one bounded WebGL context with accessible fallbacks, reduced-motion support, keyboard/touch behavior, and mobile-safe canvas sizing.
- Non-goals: claiming to detect Gemini output, shipping Google’s production key/configuration, running an LLM in-browser, copying paper figures, or presenting watermarks as complete AI-authorship proof.
- Proof required: red-green public-interface tests for the simulations, deterministic scientific invariants, module/HTML syntax checks, source-link/anchor checks, all interactive flows in a real browser, desktop/mobile/DPR2 layout, reduced motion and WebGL fallback, console/network inspection, screenshot proof, independent skeptical review, clean exact-path commit, and deployed-page verification.
- Risks: mathematically misleading toy behavior, confusing marginal non-distortion with identical outputs, overstating robustness or provenance, WebGL resource/retina sizing bugs, CDN failure, and too much spectacle obscuring the lesson.

## Plan

- [x] Inspect repository state, prior lessons, Learn conventions, and deployment shape.
- [x] Research the paper, official implementation, evaluation, limitations, and adjacent methods from primary sources.
- [x] Define public simulation behavior and complete vertical red-green test slices.
- [x] Hand off a bounded first meaningful preview with the hero and first probability interaction.
- [x] Build the complete progressive tutorial, labs, source map, WebGL/Three.js layer, and Learn index entry.
- [x] Verify scientific invariants, syntax, sources, accessibility, responsiveness, performance, browser behavior, console, and network state.
- [x] Complete independent skeptical review, resolve blockers, document results, and prepare the exact publication scope.

## Review

- Built an eleven-chapter paper guide with eight inspectable labs covering next-token probability, context-keyed g-values, tournament sampling, the paper's exact vectorized fruit example, marginal non-distortion, repeated-context-aware detection, length/entropy separation, calibrated thresholds and abstention, edit robustness, adjacent methods, and hard verification limits.
- Added a deterministic pure simulation module and red-green coverage for probability normalization, literal and vectorized tournaments, generator- and detector-side repeated-context masking, matching/wrong-key ensembles, low-entropy null behavior, marginal preservation, evidence statistics, edit propagation, and threshold confusion accounting.
- Fixed the skeptical review's release blocker: repeated contexts now bypass tournament watermarking during generation, the detector excludes the same contexts, and each simulated population member receives an independent prompt seed. At 64 tokens the open-distribution means are `0.662` marked / `0.504` null / `0.499` wrong-key; the nearly-certain distribution separates by only `0.016`.
- Grounded mechanism, equations, evaluation numbers, implementation caveats, and related-method comparisons in the Nature article and supplement, DeepMind's pinned reference code, Google's responsible-AI guidance, pinned Hugging Face source, original greenlist/robust-watermark papers, and the C2PA specification. The page explicitly states that neither it nor StegScan is a Gemini/SynthID verifier.
- Added one bounded Three.js custom-shader field with deterministic particles, capped DPR, resize handling, visibility/document/pause gating, disposal, a static reduced-motion render, and a content-complete fallback when the CDN or WebGL is unavailable.
- Automated proof: `node --test tests/*.test.mjs` passes all 23 repository tests (14 SynthID-specific), both new JavaScript modules pass `node --check`, page IDs/anchors/source boundaries/index ordering are asserted, and `git diff --check` passes.
- Live browser proof: all labs changed state as expected; local HTML/modules/Three/fonts returned HTTP 200 with no failed requests or console warnings; the Three-blocked fallback kept all 22 controls working; reduced-motion switched to a static field; DPR2 and 390px layouts had no horizontal overflow; every input had a label and every button/nav target measured at least 44px. The Learn hub rendered all 14 shader tiles without context loss or warnings in the tested Chrome session.
- Independent scientific and code reviewers approved after the repeated-context fix. Residual risk: the existing Learn hub architecture now opens 14 eager WebGL contexts, which passed Chrome verification but remains close to common per-browser limits and was not separately tested in Safari.

---

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
