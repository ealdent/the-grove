# Neverstill trailer pipeline

This rebuilds the 52 s, 1080p60 demo trailer from the live game. Everything in it is in-engine footage, and the audio is the game's own synth.

## How it works

- **Frame-stepped capture.** `make_cap.mjs` writes a capture-only copy of `../../neverstill.html`. That copy:
  - has no rAF loop;
  - pins `performance.now` to game time;
  - uses a seeded `Math.random`, so every take replays identically;
  - exposes the game internals on `window.__nvcap`;
  - logs every SFX call with its game time.

  `capture.mjs` then drives headless Chrome (GPU, 1920×1080) over CDP. Each frame it runs the clip's input script, then `update(1/60)`, then an optional camera override, then `render()`, and grabs the canvas as JPEG. Footage is perfectly smooth no matter how fast the machine renders.
- **Shots** are defined in `clips.mjs`. Input goes through a fake analog gamepad (`toolkit.js`), which provides:
  - scripted flight;
  - a close-range combat pilot;
  - a telephoto camera locked on the boss;
  - a low ground camera for the WYRM breaking out.

  A clip with `prepass: true` flies the take once without capturing, so the real take can place objects (the ring chain) exactly on the path the rocket flies.
- **Audio.** `audio.mjs` gives the capture page an `OfflineAudioContext` in place of its `AudioContext`, so the game builds its whole audio graph offline: buses, reverb, compressor, and the engine/wind beds. It then:
  - replays each clip's SFX log and per-frame engine state at the exact frame times;
  - renders the main, boss and clear themes by ticking the game's own sequencer from suspend points;
  - renders single-SFX stingers.
- **Cards.** `cards.py` draws the title and end cards with the game's 5×7 font, parsed from the HTML, and its logo treatment (gradient, extrusion, slant).
- **Edit.** `edit.py` holds one edit list for both picture and sound, with every cut on the beat grid of the game's music (148, 166 and 150 bpm). It mixes each segment's SFX under its pictures, adds the announcer lines and stingers, runs two-pass loudnorm to −14 LUFS, and writes H.264 with AAC.

## Rebuild

Run everything from this folder. Chrome and `say` need the command sandbox off. Requirements: Node 22, ffmpeg, Python 3 with Pillow and numpy, and Google Chrome.

```bash
node make_cap.mjs ../../neverstill.html nv_cap.html
node capture.mjs            # all clips (~10 min); or: node capture.mjs wyrm,halo
node audio.mjs && node audio.mjs --music && node audio.mjs --stingers
node export_art.mjs && python3 cards.py && ./vox.sh
python3 edit.py             # -> out/neverstill_trailer.mp4 (CRF 16 master) + out/review.jpg
```

Use `python3 sheet.py <clip>` to get a contact sheet of any take, and `python3 edit.py --preview` for a fast low-quality cut.

Every generated file is gitignored; see `.gitignore`. All ffmpeg outputs carry `-t`/`-frames:v` and `-fs` limits. An unbounded `apad` once filled the disk with a 281 GB WAV, so pad audio only with `apad=whole_dur=...`.
