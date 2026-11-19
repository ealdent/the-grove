# Boots: LLM-history montage to the 1915 Taylor Holmes recitation

Source in `videos/boots/` (README there). Media and renders in gitignored `tmp/boots-march/`.

## Plan

- [x] Map the recitation: word timings, voice onsets, eight stanzas (33.5 s to 183.7 s in the transfer)
- [x] Research and fact-check the timeline, weighted to mid-2025 through 19 Nov 2026
- [x] Treatment: one era per stanza, monochrome + red type, colour turn in the last stanza
- [x] Edit engine (canvas, frame-stepped) and the beat-locked cut list
- [x] Stills and clips (Higgsfield), no real people depicted
- [x] Soundtrack: voice up front, Eleven Music bed, synthesised stomps/risers on the cuts
- [x] Render, contact-sheet review, caption fact pass
- [ ] Jason's notes on v1

## Stanza map

| Stanza | Source s | Era |
|---|---|---|
| 1 | 33.0-54.6 | 2017-2022: the Transformer to the eve of ChatGPT |
| 2 | 54.6-73.1 | Nov 2022-May 2023: the numbers, the pause letter, the extinction statement |
| 3 | 73.1-91.7 | 2023: Nvidia $1T, Bletchley, the five days of Altman's firing |
| 4 | 91.7-110.2 | 2024: chips, the release race, two Nobels, agents |
| 5 | 110.2-128.7 | 2025: Stargate, DeepSeek, $4T and $5T, GPT-5 |
| 6 | 128.7-146.3 | 2026 to 19 Nov: Mythos, the backlash, Huang resigns, Anthropic lists |
| 7 | 146.3-164.6 | Past the present: not the movie; speed, power, misuse, control |
| 8 | 164.6-189.4 | In colour: cures, energy, teachers, discovery; everyone's feet; together |

## Review

v1 (2026-11-19): `tmp/boots-march/out/boots.mp4`, 1920x1080 at 30 fps, 2:36, 240 cuts, -14 LUFS.
- `verify.py`: all 239 planned cuts found in the file; the recitation sits 0.0 ms from where the cut list expects it.
- Whisper still transcribes stanzas 1-7 of the finished mix correctly; the shouted last "boots" line is the weak spot.
- Also made: `boots-x-full.mp4` (8 Mbps). Jason has X Premium, so no shortened cut is needed.
- Not done: nobody has watched it at speed yet; the judgement so far is from contact sheets and measurements.

v2 (2026-11-19, Jason's notes): the danger section now reads "THE DANGER IS REAL" then "THIS IS NOT A SCI-FI MOVIE",
with no red X. Every card was re-checked by two independent passes; one ordering slip (xAI before Llama 2) and about
a dozen over-precise captions were corrected (list in `videos/boots/README.md`). 238 of 238 planned cuts verified.
