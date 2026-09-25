# P(DOOM), C90 transfer

A music video for the AI-generated song "Upping My P(doom)", 1920×1080 at
60 fps. It plays a training run on the Degauss picture tube, and a P(DOOM)
readout climbs from 0.4% to 99.9% one beat at a time. Every frame is drawn in
headless Chrome with the grove's own fonts, Degauss and Phosphor Wake. The
cuts follow the song's beat grid, and the scopes, meters and spectra read the
song's audio frame by frame. The video shows none of the lyrics.

The song holds 145.2 bpm. Bar 0 starts at 1.085 s, and each bar lasts 1.653 s.

| Bars | Time (s) | Scene | Song |
|------|----------|-------|------|
| pickup–1 | 0.0–4.4 | power-on, magnetized title, degauss on the first downbeat | intro |
| 2–7 | 4.4–14.3 | boot log, one line every two beats; the 128-node cluster lights up | intro |
| 8–11 | 14.3–20.9 | training loss on a scope graticule, with a cliff on the last beat | build |
| 12–19 | 20.9–34.1 | next-token softmax, one token per bar: "p(doom) is just a number, right?" | groove |
| 20–27 | 34.1–47.4 | giant odometer readout and LED spectrum | groove |
| 28–31 | 47.4–54.0 | attention matrix, one head per beat | turn |
| 32–39 | 54.0–67.2 | scaling law: loss falls, then P(DOOM) (right axis) rises on the same compute | groove |
| 40–47 | 67.2–80.4 | the eye: polar waveform, radial spectrum, and a blink every four bars | groove |
| 48–58 | 80.4–98.6 | Blue Ridge ridgelines cut from `utils/contours` relief; Dobby on the front ridge | breakdown, no sub |
| 59 | 98.6–100.3 | readouts multiply 1 → 4 → 16 → 64 and the tube shakes | riser |
| 60–67 | 100.3–113.5 | montage: one panel per beat, then one every two beats | final chorus |
| 68–74 | 113.5–125.1 | `./train --self`: video feedback, copies nesting into a corridor | final chorus |
| 75 | 125.1–126.7 | VCR pause at 97.0%, with a tracking band | the stop |
| 76–82 | 126.7–138.3 | everything at once; watchdogd barks on each downbeat | last hits |
| 83– | 138.3–141.6 | end card, P(DOOM) 99.9% and P(WALKIES) 100.0%, then power-off | tail |

## Files

- `analyze.py` decodes the song with ffmpeg and fits the beat grid, using only
  numpy. The grid is a straight line fitted to the onset envelope: the song is
  machine-made and holds its tempo within ±4 ms. It finds the downbeat and
  gives per-bar energy and novelty for picking sections, plus per-frame
  loudness, bands, a 48-bin spectrum and a 12 kHz waveform copy. All of it
  goes into `analysis/`.
- `ridges.py` cuts 44 east-west elevation profiles, from the Black Mountains
  across to Grandfather, out of the USGS relief embedded in
  `utils/contours/index.html`.
- `video.html` draws each scene on a 2D canvas at 1.25× and passes it through
  the Degauss tube shader, adapted to 16:9. The shader adds a red drift that
  follows P(DOOM), plus pause jitter and a tracking band. Open it with
  `?t=<seconds>` to look at one moment.
- `render.mjs` drives Chrome over the DevTools protocol, using
  `utils/degauss/video/cdp.mjs`. It pipes JPEG frames straight into ffmpeg and
  muxes them with the song's own AAC stream, so no frames are written to disk.

## Run

Chrome must run outside the command sandbox.

```bash
python3 analyze.py <song.mp4>
python3 ridges.py
node render.mjs --song <song.mp4>                    # out/p-doom-c90.mp4
node render.mjs --song <song.mp4> --cut x            # out/p-doom-c90-x.mp4, 139.9 s
node render.mjs --song <song.mp4> --from 98 --to 104 # out/segment.mp4
node render.mjs --stills 3.6,40,88                   # stills/t_*.png
```

The song runs 141.6 s, past X's 2:20 limit for accounts without Premium. The
`--cut x` version brings the end card in at bar 82, powers off at 138.75 s,
and fades the audio out by 139.9 s.

`analysis/` holds a copy of the song's audio, so it is gitignored, along with
`out/`, `stills/` and `prof/`. The song is not part of this repo. Add the
song's creator to `SONG` in `video.html` for the end-card credit.
