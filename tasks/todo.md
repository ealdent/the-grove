# Gonka decentralized AI explainer (learn/)

Goal: copy the self-contained Gonka explainer from `~/Downloads` into `learn/`, add an alphabetized tile to `learn/index.html`, verify the scoped changes, and commit/push to `origin/main`.

## Plan

- [x] Inspect repo rules, learn-page conventions, worktree, and the Downloads source
- [x] Copy `gonka-decentralized-ai-explainer.html` into `learn/`
- [x] Add the Gonka tile between “Freezing Water with Gas” and “Hist Gradient Boosting”
- [x] Run repository checks and review the diff
- [x] Commit the scoped changes and push to `origin/main`

## Review

- The copied page is byte-for-byte identical to the Downloads source.
- The inline JavaScript parses, the tile target exists, and the tile is in the expected alphabetical slot.
- `git diff --check` is clean.
- `npm test -- --runInBand` remains red on the pre-existing `arcade/mother-os-defense/js/__tests__/gameplay.test.js` suite (`require is not defined` under the repo's ESM setup); Jest also reports the existing `redline-ascent` package-name collision.

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

## Revision: section 4 rewrite (2026-08-04, Jason: "the Regression section makes no sense")

- Diagnosis: the section used regression without defining it — no mechanism for "asks all five at
  once," no demonstration of "holding the others fixed," sd units with no reason for standardizing,
  dumbbell chart before β was derived.
- Same Opus 5 subagent rebuilt s4 as a four-beat arc: (4a) the fitted formula in plain survey points
  with a respondent stepper (prediction vs actual, worst-miss jump); (4b) least squares as a literal
  error bowl — drag the price weight off fit and watch average squared miss climb; (4c) "held fixed"
  = matched comparison — staff-rating chips filter the cleanliness scatter, slope ladder
  0.80 → 0.25 → 0.05 pts; (4d) standardization motivated by unequal spreads, closing the loop to β
  (last column reproduces DEMO.betas exactly). Dumbbell/R²/bridge kept.
- My review fixed one copy error the subagent shipped: 4d caption said price ratings are "spread over
  1.75 standard deviations" — 1.75 IS the sd in points; reworded to "spread (standard deviation) of
  1.75 points" / "one standard-deviation push."
- Independent Node cross-check extended to kdaDebug.regression(): rawWeights (β·sdY/sdX), intercept
  (−3.917), meanAbsMiss (0.702), all-customers slope (0.796), the four matched-group slopes, pooled
  within-group slope (0.253) — all match to <1e-6 (worst overall diff still 4.9e-10). Zero errors
  with every new control scripted (stepper, worst, bowl slider + snap, all five chips). Prose claim
  "price scatters 1–10, taste huddles at top" verified against the data (price min 1, taste min 4,
  80% of taste ≥ 8). Screenshots of 4a–4d at 1280px reviewed.
