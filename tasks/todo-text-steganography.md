# Text Steganography tutorial (learn/text-steganography.html)

Goal: single-page interactive tutorial on text steganography for the Learn hub.
Theme: "the censor's desk" — light-mode paper/archive world; signature element is a
UV lamp (WebGL shader) that reveals invisible ink; violet = the lamp, fluorescent
green = revealed secrets, stamp red = the censor, blue-black ink on bright paper.

## Plan
- [x] Survey learn/ conventions (importmap three@0.184, alphabetical tiles, footer format)
- [x] Build learn/text-steganography.html
  - [x] Hero: three.js paper shader + pointer UV lamp revealing "THE CONVOY LEAVES AT DAWN" (idle auto-sweep, reveal-all toggle, reduced-motion = full reveal, no-WebGL fallback letter)
  - [x] §1 The idea: crypto vs stego cards — stego card genuinely embeds the typed secret with zero-width chars
  - [x] §2 Why text is hard: LSB image demo (0–6 bits/channel + diff ×30) vs one flipped bit in a sentence (binary readout)
  - [x] Technique 1 — arrangement: real 1918 "PERSHING SAILS FROM NY JUNE I" cable with 3 selectable extraction rules + acrostic postcard builder (26-letter line bank)
  - [x] Technique 2 — invisible: zero-width encoder (as-seen vs x-ray views, copy→decoder round trip) + decoder
  - [x] Technique 3 — choices: synonym channel, 8 choice points = 1 byte, two-way (type a letter ⇄ click words)
  - [x] §6 The censor's desk: scanner (zero-width, homoglyphs, spacing) + 3 specimens + DETAINED/CLEARED stamp + payload recovery
  - [x] §7 Today: AI watermarks, canary traps, invisible tags, honest-limits note
  - [x] Finale strip: second shader canvas, auto-sweep reveal
- [x] Tile in learn/index.html (alphabetical: after Strange Attractors, model tag "Claude Fable 5")
- [x] Verify
- [x] Commit (signed) + push (sandbox off)

## Review
- Proof: node --check passed on both inline scripts + importmap JSON. Browser-pane
  verification at desktop and 375px mobile: hero lamp + reveal toggle, LSB slider
  0/1/5 bits, bit-flip ('s'→'q' with binary), null-cipher rules (second letter →
  PERSHINGSAILSFROMNYJUNEI; first/last → noise), acrostic "SEND HELP", zero-width
  round trip ("9pm dock" recovered in decoder), synonym channel H→Z two-way,
  scanner specimens A/B/C (CLEARED / DETAINED + "wire the funds at 5" recovered /
  5 homoglyphs), finale auto-sweep. docW == innerWidth on mobile (no overflow).
- Bugs found & fixed during build:
  1. String.replace `$$` → `$` collapse in a codemod broke the `$$` helper
     (both errors surfaced as "Cannot set properties of undefined"). Lesson added.
  2. `aspect-ratio` + `min-height` transfers the min through the ratio into a
     min-WIDTH (480px), overflowing 375px phones. Fixed with media-query aspect
     change instead of min-height. Lesson added.
  3. Canvas-drawn letter lines clipped on narrow stages — font size now measured
     with measureText and shrunk to fit the longest line.
  4. Finale fallback text wasn't hidden when WebGL initialized (missing
     `.has-gl` rule); §1 stego card originally restated the secret verbatim —
     now genuinely hides it with the shared zwEncode.
- Not verified: prefers-reduced-motion rendering (code path exists: uReveal=1,
  static frame); Safari/Firefox; real clipboard write (fallback fills decoder).
- Risks: zero-width chars can be stripped by some clipboard managers (page says
  so explicitly); Google Fonts dependency matches the rest of the site.
