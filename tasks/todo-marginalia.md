# Marginalia — tower defense (Fable 5.1, max effort)

Deliverable: `tower-def/fable-5.1-max-tower-def.html` (single file, zero deps) + tile in `tower-def/index.html`
(between "Fable 5" and "Fugu", effort "Max"). Commit + push to main.

## Plan

- [x] Read tile format, memory notes (headless verify, signing, push sandbox, concurrent staging)
- [x] Lore bible (below)
- [x] Game file: CSS + DOM shell (header, stage, legend sidebar, overlays)
- [x] Seeded RNG, random chart generation (spaced self-avoiding walk with restarts, Catmull-Rom road, coast, decorations)
- [x] Static parchment layer (offscreen canvas) + dynamic layer, letterboxed logical coords, DPR-aware
- [x] 5 towers x (base + 4 upgrades), 17 blight types, 20 authored waves + endless addenda
- [x] Input: place/select/upgrade/sell, hover ghost, keyboard, touch (tap to aim, tap again to draw)
- [x] UI: lamps, ink, wave panel with preview + marginal note, codex overlay, intro, game over/win
- [x] Minimal WebAudio (mute toggle, persisted)
- [x] Debug API `window.__marginalia` for deterministic headless stepping
- [x] Verify: headless Chrome scripted 20-wave playthroughs, desktop/DPR-2 screenshots, Browser pane at 390px
- [x] Add tile to index.html
- [x] Commit (signed), push (sandbox off)

## Lore bible

**Premise.** In 1687 hydrographic draughtswoman **Ysolde Marrow** drew Sheet XIV of an Admiralty
coastal survey: the harbour town of **Vellamere** on the Paper Coast. On 19 Nov 1690 ("the Long
Wave") the sea took the town in one night. The chart is all that remains — and the town is still in
it: lamps move in drawn windows, smoke leaves drawn chimneys. A town drawn carefully enough
remembers itself. But paper is mortal. Everything that ruins paper — damp, foxing, silverfish,
ink-blots, bookworms, an archivist's eraser, a restorer's scalpel, and at last a clean "fair copy"
with no town on it — comes up the **Ink Road** from **the Wound** (the torn edge of the sheet).
Ysolde filled the margins with the only defenders a chart has: its decorations, drawn carefully
enough to remember themselves. They are **the Marginalia**. The player commands them.

**Lamps = lives.** Vellamere's twelve harbour lamps still burn in the chart (drawn lit on the mole
and quay; they go dark as they are lost). Each blight that reaches the harbour puts one out.

**Ink = currency.** Iron-gall ink, Ysolde's own recipe. Destroying a blight recovers the pigment it ate.

**Villain.** Edmund Sallow (1709–1771), hydrographer, made a 1751 "fair copy" of Sheet XIV
"corrected of its spurious town and marginal fancies." **The Fair Copy** is the final boss:
accurate, clean, empty; it whitens the road behind it. Its instruments (Ruling Pen, White Lead,
Corrections) appear from wave 7.

**Subtle touches.** A marginal note in her hand on every chart: "T. — the ninth lamp is yours."
Neatline text "Y. Marrow del. 1687 · Hydrographic Office · not for publication". The wreck marker
"the Long Wave, 1690" in the sea off the harbour. Wave notes read as archive history 1690–2026.

### Marginalia (towers) — base + 4 upgrades
1. **Compass Rose** — needles (armour applies, moths dodge). Sixteen Winds → Thirty-two Winds (pierce) → Fleur-de-lis → Lodestone (seeking).
2. **Wind-Head** — cone: slows + one shove per blight per few seconds (heavy blights lean in). Zephyr → Gale → Tempest (scour) → Boreas (frost doubles scour on slowed).
3. **Sea Serpent** — bites toughest in reach, splash, ignores armour, hits hidden, may sit in the sea. Coiled → Venom → Hydra (two heads) → Leviathan.
4. **Lighthouse** — rotating beam DPS, reveals the Faded, ignores armour, moths take double, White Lead immune. Trimmed Wick → Argand Lamp → Twin Lanterns → Fresnel (scorch).
5. **Cartouche** — support: dmg/range/rate buffs (max, not stacking), ink patronage per wave, Imprimatur adds crits.

### Blights (17)
Silverfish, Droplet, Foxing, Ink Blot (splits), Damp (regen), Bookworm (burrows), Moth (dodges,
2x from light), Faded (hidden), Mildew (shield aura), Coffee Ring (miniboss, sheds), Ruling Pen
(armoured, dashes), Eraser (boss w10, unpushable), Censor (slows tower fire, 2 lamps), White Lead
(light-immune), Scalpel (fast, 60% armour), Fair Copy (final, 12 lamps, sheds Corrections), Correction.

### The Twenty Blights
1690 Sea-Chest · 1691 First Foxing · 1702 Long Damp Winter · 1714 The Bookbinder · 1729 Moth Season ·
1733 The Worm · 1751 Sallow's Copy (rumour) · 1766 Mildew · 1780 Fading Light · 1799 The Eraser ·
1812 Coffee at the Admiralty · 1834 Estate Sale · 1851 Great Exhibition · 1877 The Flood ·
1903 Accession No. 14 · 1918 Redaction · 1941 Deep Storage · 1968 The Restorer · 1994 Deaccession ·
2026 The Fair Copy. Then endless "Addenda" (seeded, escalating).

## Review

- Balance (headless scripted build, best-coverage placement, greedy upgrades): wins all 20 waves on
  seeds 5, 99, 8080, 12345 with 11–12 lamps; final boss dies at 60–104 s. Roses-only build loses at
  wave 13 after the Faded (wave 9) take 6 lamps — hidden blights gate the Lighthouse as intended.
  No tower build leaks 8 lamps on wave 1 alone.
- Bugs found and fixed during verification: (1) road walk spacing rule rejected every turn, so all
  roads were the L-shaped fallback → exclude the two most recent cells from the adjacency check;
  (2) Wind-Head could hold pushable heavy blights forever at the cone edge → redesigned as slow +
  per-blight shove impulse on a cooldown, pushback capped at 110 units behind max progress;
  (3) codex level lists overflowed on phones (nowrap spans joined without spaces).
- Verified: syntax (node --check), 20-wave playthroughs on 6 seeds, desktop 1600×1000 and DPR-2
  1400×900 headless screenshots, Browser pane at 390×844 (portrait chart generated, header 72px,
  no horizontal overflow), codex + end overlays.
- Not verified: real touch hardware; audio only checked for absence of exceptions; endless waves
  only via definition (not played).
- Known limits: a very tall headless viewport (3200×2000 CSS at DPR 2) did not present the canvas
  in headless Chrome — not reproduced at normal sizes or in the Browser pane.
