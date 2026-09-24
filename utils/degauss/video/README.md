# Degauss intro video

A 15 second launch video for Degauss, 1080×1080 at 60 fps. Every frame is
drawn with the real font in headless Chrome. The soundtrack is generated,
not sampled.

| Time | Picture | Sound |
|------|---------|-------|
| 0.0–1.0 | tube powers on; magnetized rainbow title; the DEGAUSSING menu appears | thump, flyback whine, 60 Hz buzz, button click |
| 1.0–2.5 | the degauss: wobble, colour fringing, phosphor trails, then the picture settles | thud, ringing shadow mask, falling hum, tape spin-up |
| 2.5–3.5 | "a mixed-space typeface" types in | beat drops, typing ticks |
| 3.5–7.0 | "firmware" in monospace cells snaps to the four widths; C30–C90 legend | each width sounds a note: 2:3:4:6 as string lengths is 660/440/330/220 Hz |
| 7.0–10.5 | seven ligatures fuse, one per beat, with language tags | ascending pentatonic blips |
| 10.5–12.5 | glyph roulette: 16 glyphs, four per beat | ticks and a riser |
| 12.5–14.5 | end card; the URL types itself out | Am9 stinger |
| 14.5–15.0 | power-off to the dot, with the end card's afterglow behind it | zip-down |

The last frame matches the first (the dot and the afterglow), so the video
loops without a visible seam.

## Files

- `intro.html` draws each scene on a 2D canvas at 1.5× and passes it through
  a WebGL2 picture-tube shader: curvature, bloom from mipmaps, colour
  fringing, scanlines, phosphor persistence, purity blotches, the degauss
  wobble and the power-on/off collapse. It also builds the score with an
  `OfflineAudioContext`. Open it with `?t=<seconds>` to look at one moment.
- `render.mjs` drives headless Chrome over the DevTools protocol (`cdp.mjs`).
  It writes `frames/f_00000.jpg`… and `wav/score.wav` in about 45 seconds.
  It stops if the canvas does not apply the font's ligatures.
- `encode.py` runs two-pass loudnorm (−14 LUFS, −1 dBTP), encodes H.264 High
  in BT.709 with AAC at 48 kHz, and writes `out/degauss-intro.mp4`. It also
  writes a contact sheet, a spectrogram and a waveform for review.

## Run

Chrome must run outside the command sandbox.

```bash
node render.mjs                 # frames + score
node render.mjs --poster 0.78   # out/degauss-poster.png (the magnetized title)
node render.mjs --stills 1.15,5.2,13.4
python3 encode.py               # needs ffmpeg
```

Outputs (`frames/`, `wav/`, `out/`, `stills/`, `prof/`) are gitignored.
