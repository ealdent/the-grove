# Greenhouse vine border as a standalone shader demo (2026-08-13)

Goal: lift the vine border shader out of the greenhouse to-do dialogs into its own page under
`utils/`, matching the existing shader demos there, then push to `origin/main`.

## Plan

- [x] Locate the shader — `utils/greenhouse-todo/ui-vines.js`, one fullscreen-quad fragment shader
- [x] Copy the GLSL verbatim into a standalone page modelled on the other two shader demos
- [x] Port `VineFrame`'s canvas sizing (the parts that are load-bearing, not just the maths)
- [x] Add demo controls, and a mock dialog for the vines to wrap
- [x] Verify in a browser: render, sizing, reflow, every control
- [x] List it on the utils index and push

## Review

- New page: `utils/greenhouse-vines-shader-demo.html`, self-contained, no imports (works over
  `file://` like its neighbours). Listed on `utils/index.html` as the third shader card.
- Fragment shader is byte-identical to the app's apart from six lines implementing three demo-only
  uniforms — `uSeed`, `uStrands`, `uGlow`. At their defaults (0, 5, 1) the page reproduces the
  dialog exactly; verified by diffing the extracted GLSL from both files.
- Ported deliberately, not just pasted: `clientWidth`/`clientHeight` rather than
  `getBoundingClientRect()`, explicit CSS width/height on the canvas (a canvas is a replaced
  element, so `width: auto` resolves to the drawing buffer and doubles the scale at DPR 2), DPR
  capped at 2, premultiplied `ONE, ONE_MINUS_SRC_ALPHA` blending.
- `--overflow` is stated once in the CSS and read back by the JS. It is not a free parameter: the
  outermost lane sits 50px out, its harmonics add 22px, a leaf on that reaches 24px more. An early
  draft cut it to 72px on narrow windows, which sawed the tips off the back strands.
- Pause freezes the clock rather than zeroing `uMotion` as the app does — same visual hold, but the
  strands keep their current shape instead of snapping back to t=0. Reduced motion starts paused.
- Verified at DPR 2: buffer = CSS × 2 and canvas offset = −overflow; expanding the panel's notes
  grew it 342 → 449px with the canvas tracking exactly (+192 = 2 × overflow), which exercises the
  ResizeObserver path; growth pin, drift, strands, glow, pause, regrow and reseed all confirmed;
  no console errors. Screenshots reviewed at full growth and pinned at 0.40.
- Not verified: Firefox and Safari (Chromium only), and real-device mobile.

## Revision: leaves that actually attach (2026-08-13, Jason: "some of the leaves don't properly
attach to the vines")

- Diagnosed before touching anything: replicated the leaf maths in Node with the shader's own hash
  functions and measured the gap from each blade to its stem. 88% of leaves were detached, median
  gap 2.1px, worst 8.9px. Not an occasional glitch — the construction could not do better.
- Root cause: the blade was an ellipse centred 5–12px off the stem and rotated about its own
  middle, so it only reached back when lLen * sin(angle) exceeded the offset. Offset and length
  both came from lh.x while the angle came from lh.y, so the condition was near-uncorrelated with
  the thing it had to beat, and a blade lying along the strand could never touch it at all.
- Fix: build the leaf in a frame whose origin is ON the stem centre-line and grow it outward —
  attachment becomes structural rather than coincidental. Blade profile t^0.55 * (1 - t) (widest a
  third of the way up, pinched at both ends, peak normalised to lWid), with a 0.6px stalk floor so
  the join does not go sub-pixel exactly where it meets the stem, and edges antialiased in real
  pixels instead of blade-normalised units.
- Re-measured: 900 leaves over 6 seeds, all touching, worst gap 0.00px. Weakest join opacity 0.64
  at the centre-line, where the stem core is already solid.
- Ported the same fix back into `utils/greenhouse-todo/ui-vines.js` — the demo's whole claim is that
  it is the app's shader, so fixing only the copy would have left the real dialog wrong and the two
  quietly divergent. A comment-stripped diff confirms the only executable difference is still the
  three demo knobs.
- Two self-inflicted breakages caught in verification, both worth remembering: a backtick in a GLSL
  comment (around a variable name) silently terminated the JS template literal holding the shader
  and killed the whole page with no console output; and `vec2 dir` collided with the strand loop's
  existing `float dir`. Added a check that greps the shader literals for backticks, looks for
  redeclarations in the strand loop, and node --checks the extracted script.
- Verified the app's copy compiles by inlining its exact VERT/FRAG into a throwaway WebGL harness:
  vertex, fragment and link all OK. Harness deleted.
- Not verified: the jest suite could not run — `node_modules` is absent and `npm install` fails on a
  root-owned npm cache (`sudo chown -R 501:20 ~/.npm`). No test references the vine shader.

## Revision: generic panel content (2026-08-13, Jason: "make the content of the dialog box more
generic for a demo and without buttons so it doesn't look like another part of configuration")

- Replaced the mock greenhouse to-do dialog with neutral copy about what the border does. Zero
  interactive elements inside the panel now (asserted: 0 button/input/select/a in its subtree), and
  `role="dialog"` dropped for a plain labelled section — it was never a real dialog.
- The removed "Show notes" button had been the one-click demo of the ResizeObserver reflow. Rather
  than lose that, the reflow moved to a Panel width slider in the controls bar, which is where
  controls belong and is exactly the user's point. Say the word to drop it.
- Its readout reports the width the panel actually reached (`offsetWidth`), not the width requested:
  on a narrow screen the panel's own max-width overrides the top of the slider's range, and a
  readout insisting on 460px next to a 345px panel would be a lie.
- Fixed a pre-existing narrow-viewport bug found while testing this: `.stage` used the implicit auto
  grid column, which refuses to shrink below the panel's min-content, so a 460px panel kept its full
  width at 375px and overflowed (clipped, not scrolled, so it never showed as a scrollbar).
  `grid-template-columns: minmax(0, 1fr)` lets the panel's max-width apply.
- Verified: canvas tracks the panel at 240/300/460/520px (CSS = panel + 192, buffer = CSS x 2 at
  every step), no horizontal scroll, panel fits the viewport at 375px, shader still compiles, and
  the shader parity check against the app still shows only the three demo knobs.

# Gonka explainer review fixes (2026-08-11)

Goal: resolve the three review findings in `learn/gonka-decentralized-ai-explainer.html`, verify the fixes, and push them to `origin/main`.

## Plan

- [x] Reproduce the motion, chart-grid, and source-map issues in the current page
- [x] Fix SVG motion pausing, asymmetric chart padding, and source-section anchors
- [x] Run focused checks and review the diff
- [x] Commit and push the fixes to `origin/main`

## Review

- Inline JavaScript parses; all source-map fragment targets exist, with Governance mapped to section 12 and Consensus comparison mapped to the thesis section.
- Extracted motion logic passes reduced-motion and pause/resume assertions using stubbed SVG animation methods.
- Extracted chart-grid logic passes asymmetric-padding geometry assertions for all outer gridlines.
- `git diff --check` is clean.
- Not verified in a real browser because no local browser binary or connected browser tool was available; visual screenshot, console, and network checks remain outstanding.

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
