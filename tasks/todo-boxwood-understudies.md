# Plan — THE BOXWOOD UNDERSTUDIES (`gemini-4-carbon-high-time-loop-puzzle.html`)

## Creative Brief Summary
- **Title**: *The Boxwood Understudies* (zero banned words)
- **Setting & Premise**: Lyon, November 1804. Deafened master joiner Lazare Vian works alone overnight in the *Atelier de la Croix-Rousse* to complete the three-hall Grand Seal Commission before the Guild Syndics arrive at dawn. Wearing a brass Scribing Harness linked to a 40-beat Jacquard Drum, each pass punches a Manila Card-Lace (stride holes + mechanical load-notches) hung into the chest of up to four life-sized Jura Boxwood Lay-Figures (*Understudies I–IV*).
- **Causal Catastrophe**: Lay-Figures march blind by punched card and porcelain tension-pawl. Any mismatch between recorded load-notch and live floor state (barred Reed-Grate, missing or unexpected Plumb-Block, missing Organ, falling Grate, or Rig Fouling body collision) seizes the Jacquard Drum, highlights the offending Lay-Figure and flagstone in cochineal red, reports exact Card-Lace, Beat, Expected vs. Actual in Lazare's bench voice, and offers Back One Card (`Z`), Unlace Last Pass (`U`), or Re-Chalk Hall (`R`).
- **Palette**: Warm roasted walnut & chestnut (`#1A120D`, `#281C14`, `#3D2B1F`), Lyon terracotta flagstones (`#8E5B3A`, `#6E452B`), oiled Manila card-stock (`#E8D5B5`), Jura boxwood (`#D4A86A`), burnished brass (`#E0B35A`), verdigris copper (`#4E7A6B`), Venetian minium (`#B55233`), saffron ochre (`#CCA649`), cast plumb-iron (`#46403A`), cochineal vermilion (`#C8372D`). Old-style serif typography throughout; zero navy/cyan/magenta, zero gradients, zero monospace.

## Checklist
- [x] Write and verify pure deterministic simulation engine (`simulate(level, tokenLog)`) with documented chronological conflict resolution (`0 .. P`), causal load-notch checks, 40-beat loop, up to 4 concurrent Boxwood Lay-Figures, and cross-boundary single-beat undo.
- [x] Author and verify 3 narrative halls (`14x12` grids):
  - [x] Hall I — *Céleste's Draughting Floor* (*The Mainspring Barrel*, 2 passes, Plumb-Block + 2 channels)
  - [x] Hall II — *Bastian's Foundry Bay* (*The Geneva Star-Wheel*, 3 passes, caged Plumb-Block relay + 3 channels)
  - [x] Hall III — *Noé's Chancel Gallery* (*The Singing-Bird Bellows*, 3 passes, "protect the past" corked-throat puzzle)
- [x] Verify all 3 intended solutions, bypass resistance, causal catastrophe diagnostics, simultaneous same-tile deterministic rule, and full undo-to-tick-0 + replay identity via Node harness.
- [x] Build complete single-file HTML (`time-loop/gemini-4-carbon-high-time-loop-puzzle.html`) with:
  - [x] Top-of-file design document comment (Title, 231-word Premise, Art Direction with hexes, 1-sentence Voice) + intended solution sequences in comments
  - [x] Atmospheric canvas title screen with in-voice premise
  - [x] Multi-shape Canvas-drawn Lazare, articulated Boxwood Lay-Figures, custom Master Organs, taut hemp cordage, Plumb-Blocks, Treadles, Reed-Grates, diagonal clerestory sunshaft + wandering sawdust motes + tallow cresset flicker
  - [x] Diegetic Manila Jacquard Card-Lace UI, Shear-Cord / Undo controls, WebAudio workshop ear-trumpet foley & dawn songbird organ
  - [x] Dawn ending scene resolving the premise + streaming headless Bench Proof (`Self-Test`)
- [x] Verify syntax, headless Node engine self-test, JSDOM interactive/canvas verification (DPR 1 & DPR 2, zero console errors, all acceptance criteria).
- [x] After game is completely finished, update `time-loop/index.html` sorted alphabetically by model, commit specific paths, and push to `main`.

## Review & Verification
- **Pure Functional Engine**: Extracted `// @@ENGINE-BEGIN` … `// @@ENGINE-END` from the shipped HTML file and verified in Node:
  - Hall I (*Céleste's Draughting Floor*): 42 tokens → `won` on Pass 2, Beat 26; 42-step cross-pass undo to Card 00 + replay bit-identical.
  - Hall II (*Bastian's Foundry Bay*): 61 tokens → `won` on Pass 3, Beat 37; 61-step cross-pass undo to Card 00 + replay bit-identical.
  - Hall III (*Noé's Chancel Gallery*): 57 tokens → `won` on Pass 3, Beat 26; 57-step cross-pass undo to Card 00 + replay bit-identical.
  - Verified causal pawl catches (`missing_push`, `barred_grate`, `falling_grate`, `rig_collision`), blocked-move tick consumption, and 4 concurrent understudies + live joiner across 40-beat wraps.
- **Interactive UI & Style Audit**: Verified Premise word count (`231` words), 1-sentence Voice, zero banned words/styles/network calls, DPR 1 (`644x552`) & DPR 2 (`1288x1104`) canvas sizing, Dawn ending tableau, and 10/10 streaming in-page `Bench Proof` (`Self-Test`) with zero console errors.
- **Gallery Integration**: Added row `06` (`Gemini 4 Carbon`, `High`) to `time-loop/index.html` in alphabetical model order between `Gemini 3.8 Flash` and `GLM-5.3`, renumbering subsequent ordinals `07`–`14`.
