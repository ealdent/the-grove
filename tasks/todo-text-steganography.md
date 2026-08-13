# Text Steganography tutorial (learn/text-steganography.html)

Goal: single-page interactive tutorial on text steganography for the Learn hub.
Theme: "the censor's desk" — light-mode paper/archive world; signature element is a
UV lamp (WebGL shader) that reveals invisible ink; violet = revealed secrets,
stamp red = the censor, blue-black ink on bright paper.

## Plan
- [x] Survey learn/ conventions (importmap three@0.184, alphabetical tiles, footer format)
- [ ] Build learn/text-steganography.html
  - [ ] Hero: three.js paper shader + pointer UV lamp revealing hidden phrases (autopilot sweep, reduced-motion = full reveal, WebGL fallback)
  - [ ] §1 The idea: crypto vs stego cards
  - [ ] §2 Why text is hard: LSB image demo (1,000 hidden bits + diff amplifier) vs one flipped bit in a sentence
  - [ ] Technique 1 — arrangement: WWI null-cipher cable reveal + postcard acrostic builder (26-letter line bank)
  - [ ] Technique 2 — invisible: zero-width encoder (as-seen vs x-ray views, copy) + decoder
  - [ ] Technique 3 — choices: synonym channel, 8 choice points = 1 byte, bidirectional (type a letter / click words)
  - [ ] §6 The censor's desk: scanner (invisible chars, homoglyphs, spacing) + 3 specimens + verdict stamp + ZW recovery
  - [ ] §7 Today: AI watermarks, canary traps, "stego hides existence, not content"
  - [ ] Finale strip: second shader canvas, auto-sweep reveal
- [ ] Tile in learn/index.html (alphabetical: after Strange Attractors)
- [ ] Verify: node parse check on inline scripts; headless Chrome (swiftshader) screenshots desktop; Browser pane for interactions
- [ ] Commit (signed) + push (sandbox off)

## Review
(fill after verification)
