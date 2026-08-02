# Time Loop section

Promote the five time-loop games out of `arcade/` into their own top-level
section with a tower-def-style provider/model filter and a distinctive index.

## Goal

- New `time-loop/` directory + root hub tile.
- Cards ordered by model (alphabetical, effort as tiebreak) like `tower-def/`.
- Provider + Model dropdown filter, same behavior as `tower-def/index.html`.
- An index design that is nothing like the other sections.

## Games (in model order)

| # | Model | Effort | Game | File |
|---|-------|--------|------|------|
| 01 | Fable 5 | Ultra | Changeover | `fable5-ultra-time-loop-puzzle.html` |
| 02 | Gemini 3.6 Flash | High | The Organist's Ledger | `gemini-3.6-flash-high-time-loop-puzzle.html` |
| 03 | GPT-5.6 Sol | Ultra | The Loom That Ate the Dawn | `gpt-5.6-sol-ultra-time-loop-puzzle.html` |
| 04 | Opus 5 | High | Paradox Vault | `paradox-vault.html` |
| 05 | Opus 5 | Ultra | The Standing Salt | `opus5-ultra-time-loop-puzzle.html` |

Model naming follows `tower-def` / `rail-shooter` (no "Claude" prefix), not the
arcade's longer form, since this page carries the same filter.

## Design direction — "the page is itself in a loop"

Brass / bone / ink instrument-panel, not neon and not grimdark. Cinzel +
JetBrains Mono. Deliberately different from arcade (neon cyberpunk), tower-def
(neon grid), root (grimdark ash).

- **WebGL shader veil**: engraved concentric rings with a sweeping hand; shader
  time is `mod(t, LOOP)` so the field visibly *rewinds*, and two phase-shifted
  ghost copies trail behind it — prior iterations. CSS fallback if no WebGL.
- **Iteration tape**: a 48-tick strip with a playhead. On wrap, a rewind wipe
  fires and the iteration counter increments. The index is on a 12s loop.
- **Ledger rows** instead of a card grid — engraved line numbers, shift-log feel.
- **Delayed-input echoes**: each row has two outline "past selves" that replay
  your own pointer motion ~9 and ~20 frames late. That is the mechanic of these
  games, applied to the index itself. At rewind they snap into alignment.
- `prefers-reduced-motion` freezes everything on one static frame.

## Steps

- [x] `git mv` the five files `arcade/` → `time-loop/`
- [x] Write `time-loop/index.html`
- [x] Strip the five cards + dead per-card CSS from `arcade/index.html`
- [x] Add the root hub tile (inline SVG dial icon, silhouette + ember to match
      the painterly icon set)
- [x] Register the section in `scripts/update_readme.py`, regenerate README
- [x] Verify headless: no console errors, links resolve, filter + ordering
- [x] Commit + push

## Proof

Headless Chrome run over `time-loop/index.html`:

- 0 console errors / 0 page errors, WebGL context acquired, shader compiled.
- 5 rows, `data-model` order = Fable 5, Gemini 3.6 Flash, GPT-5.6 Sol, Opus 5
  (High), Opus 5 (Ultra) — matches the table above.
- Filter: Anthropic → 3 rows, Google → 1, OpenAI → 1; model `Opus 5` → 2.
- All five hrefs + the 5 moved files resolve on disk; `../` back-links in the
  moved games still point at the hub (same directory depth as before).
- Iteration tape advanced and wrapped; iteration counter incremented 01 → 02.
