# Tower Defense — Greenfield Build

## Task
Build a single-file, dependency-free tower defense game + tile in the arcade.

## Spec (from user)
- Single HTML file, no deps, opens in browser directly
- Random (procedural) track each game
- 5 tower kinds × 4 upgrades each
- Enemies with different speeds/strengths
- 20+ waves (target: 24)
- Upgrade between waves
- Professional UI, responsive, quirky/innovative appearance
- Meaningful lore woven in

## Theme decision
**INK & ASH — The Last Codex.** Defend the last living book from "the Redaction"
(un-writing force). Scriptorium towers (Quill, Inkwell, Red Pen, Illuminator, Press).
Enemies are manifestations of deletion: Scribbles, Smudges, Censors, White-Outs,
Plot Holes, and the boss "Final Draft." Parchment/ink/gold/red palette.

## Steps
- [x] Inspect index.html tile format + naming convention
- [x] Develop lore/backstory (intro modal + per-wave blurbs)
- [x] Write game file `deepseek-v4-pro-0813-xhigh-tower-def.html`
- [x] Add tile to `tower-def/index.html` (alphabetical by model)
- [x] Syntax-check JS (node --check)
- [x] Runtime smoke test (vm harness: spawn/move/leak/kill, all 24 waves, boss draw)
- [x] Commit + push to main

## Review
- Built **Ink & Ash — The Last Codex**: defend a living book from "the Redaction".
- 5 towers (Quill, Inkwell, Red Pen, Illuminator, Press) × 4 upgrades; chapter-bond synergy.
- 6 enemy kinds (Scribble/Smudge/Censor/White-Out/Plot Hole/Final Draft boss) with distinct abilities.
- 24 named waves with lore blurbs; intermission upgrades; random winding track per game.
- Offline single file (no fonts/deps), Web Audio sfx, responsive letterboxed canvas + touch.
- Verified: node --check + vm harness (all checks passed); fixed spawn-timer unit bug
  (ms vs s) and an `ang` scoping bug caught by the harness.
