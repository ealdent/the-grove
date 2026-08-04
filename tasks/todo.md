# Key Driver Analysis interactive tutorial (learn/)

Goal: new single-file interactive tutorial `learn/key-driver-analysis.html` teaching Key Driver Analysis
to a stats-101 audience, plus an alphabetized tile on `learn/index.html`. Coding by Opus 5 subagent;
planning + review by main session. Commit and push to origin/main.

## Plan

- [x] Explore learn/ conventions (self-contained page, own theme, back-link to index.html, alphabetized tiles, optional tile-model credit)
- [x] Review tasks/lessons.md + memory (commit pathspec, signing flag, headless verify recipe, push needs sandbox off)
- [x] Write detailed spec; spawn Opus 5 subagent to build `learn/key-driver-analysis.html`
- [x] Review the page myself (code read + skeptical pass)
- [x] Verify headlessly: no console errors, sections render, math cross-checked in Node vs `window.kdaDebug` (correlations, betas, Shapley), screenshot desktop + narrow
- [x] Add tile to learn/index.html (alphabetical: between "Hist Gradient Boosting" and "Loop Engineering…"), tile-model "Claude Opus 5"
- [ ] Commit with pathspec + `--gpg-sign=~/.ssh/id_ed25519.pub`, push (sandbox off)

## Tutorial content spec (stats-101 target)

1. Hook: coffee-shop chain survey — overall satisfaction + 5 attribute ratings; which lever to pull?
2. Correlation refresher (interactive scatter, slider for r)
3. Naive approach: driver↔outcome correlations bar chart; the trap — drivers correlate with each other (intercorrelation heatmap, halo effect)
4. Multiple regression: standardized betas = "holding others constant"; side-by-side r vs beta showing a redundant driver collapse
5. Relative importance via Shapley (credit-sharing among teammates analogy); live subset-R² walkthrough on 3 drivers
6. Importance × Performance quadrant chart (the KDA deliverable); sliders move driver performance
7. Sandbox: set true weights + intercorrelation + n, generate data, full pipeline, compare recovered importance to truth; rerun shows sampling noise
8. Pitfalls: causation, halo, multicollinearity, range restriction, small n
9. Quiz (4–5 MCQ with feedback) + cheat sheet

## Review

- Opus 5 subagent built `learn/key-driver-analysis.html` (2065 lines, single file, vanilla JS + SVG,
  seeded so every number is reproducible; `window.kdaDebug` exposes the full pipeline).
- Independent verification (main session): recomputed correlations, the 5×5 intercorrelation matrix,
  standardized betas, R², and all-subsets Shapley/LMG in Node from the page's actual X/y — worst
  |diff| 4.9e-10 vs page values (page uses a 1e-9 ridge; explains the residual). Trio subset R² lattice
  and sandbox seed-777 run also match. Zero iframe errors; `regenSandbox(777)` twice is bit-identical.
- Visual review at 1280px full page (14500px tall shot): all 10 sections render; found and fixed one
  defect the subagent missed — section-3 bar chart drew the "correlation r" axis title at the same y
  as the tick labels, colliding with the 0.40 tick (pad.b 26→40, ticks h−24, title h−8). Re-verified.
- Added alphabetized tile to `learn/index.html` with "Claude Opus 5" model credit; screenshot confirms.
- Demo-dataset story lands as specced: Cleanliness r=0.52 → β=0.03 (r=0.71 with Staff), Shapley
  restores 10.4%; Price fairness is the lone fix-first quadrant occupant.
- Not verified: real-device mobile rendering (subagent probed 390px headless: no overflow; I did not
  independently re-shoot narrow), Google Fonts rendering (offline fallback stacks only), screen readers.
