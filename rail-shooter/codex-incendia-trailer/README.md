# Codex Incendia demo video pipeline

This rebuilds the 30.8 s, 1080p60 demo of [Codex Incendia](../gemini-4-argon-high-rail-shooter.html), Gemini 4 Argon's rail shooter. Every shot is in-engine footage, every sound comes from the game's own synth, and every cut lands on the 146 bpm bar grid of the game's own score.

## How it works

- **Capture copy.** `make_cap.mjs` writes `ci_cap.html` from the game. The copy:
  - never starts the rAF loop, because the harness steps frames;
  - uses a seeded `Math.random`, so a take replays identically;
  - rewrites the game's `setTimeout`s onto a game-time queue, so popups, flashes and banners last as long as they do in play;
  - exposes the game on `window.__ci` and logs every `sfx*` call with its frame time;
  - in the audio pass, swaps `AudioContext` for an `OfflineAudioContext`.
- **Frames.** `capture.mjs` drives headless Chrome (real GPU) at 1280×720 CSS, DPR 1.5. Each frame runs:
  1. the shot's script;
  2. the game timers;
  3. `update(dt)`;
  4. an optional camera override;
  5. `render()`;
  6. CSS animations pinned to game time (`document.getAnimations()`);
  7. `Page.captureScreenshot`.

  Full-page screenshots keep the game's DOM HUD (manuscript panels, graze popups, banners, boss bar), which a canvas grab would lose. A dt below 1/60 gives smooth slow motion.
- **Shots.** `clips.mjs` defines them; `toolkit.js` supplies:
  - the autopilot, which uses the game's own hit and graze model, aims with lead, holds fire until targets are close, grazes on purpose and barrel-rolls on cue;
  - cinematic cameras (crane, low shoot-up, skate cam, telephoto on the Grand Censor);
  - HUD modes;
  - scripted spawns through the game's own `spawnGroundObstacle`, `createEnemy` and `spawnBoss`.
- **Audio.** `audio.mjs` renders, through the game's own graph:
  - each take's sfx log, with auto-fire and ricochets on a quieter send;
  - one continuous score from the game's sequencer. The Folio modes switch on 4-bar lines (I → II → III → Censor → I, set in `score.json`). A noise riser leads into the boss, and the last downbeat lands on D with the boss bell.
- **Overlays.** `overlay.html` draws the title, captions, end card and flashes in the game's fonts and gold treatment. `overlays.mjs` captures them as a transparent PNG sequence.
- **Edit.** `edl.json` is the single edit list for picture and sound. `edit.py` symlinks the frame sequence, mixes the score with each segment's sfx, applies a slight crescendo across the sections, runs two-pass loudnorm to −14 LUFS, and encodes H.264 High at CRF 17 (maxrate 24M) with 256k AAC.

## Rebuild

Run everything from this folder. Chrome needs the command sandbox off (it also fetches three.js, Tailwind and Google Fonts). Requirements: Node 22, ffmpeg (9.x syntax: `-/filter_complex`, `-fps_mode`), Python 3 with Pillow and numpy, and Google Chrome.

```bash
node make_cap.mjs ../gemini-4-argon-high-rail-shooter.html ci_cap.html
node capture.mjs                 # all takes (~3.5 min); or: node capture.mjs kill,reveal
node audio.mjs && node audio.mjs --score --stingers
node overlays.mjs
python3 edit.py                  # -> out/codex_incendia_demo.mp4 + out/review.jpg
```

Review tools:

- `python3 events.py [take]` lists sfx events by frame. Use it to set in-points so kills land on beats.
- `node capture.mjs <take> --every=10` takes a quick scout.
- `python3 grid.py out/g.jpg 20 takeA takeB` shows takes side by side.
- `python3 dense.py out/<video>.mp4 t0 t1 step out/d.jpg` shows the cut over a range.
- `python3 edit.py --preview` makes a fast low-quality cut.

Every generated file is gitignored. All ffmpeg outputs carry `-t`/`-frames:v` and `-fs` limits, and audio is only ever padded with `apad=whole_dur=`.
