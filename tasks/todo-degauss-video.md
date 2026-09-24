# Degauss intro video (15 s, for X)

Goal: a 15 s launch video for Degauss built to spread on X: hook in the
first second, readable with the sound off, satisfying beats, a clear end
card with the URL, and a seamless loop (X autoplays and loops).

Format: 1080×1080 (square fills more of a phone timeline than 16:9),
60 fps, H.264 High + AAC, -14 LUFS, faststart. Everything is rendered from
the real font in headless Chrome; no generative footage (it would garble type).

## Storyboard (120 bpm, cuts on the beat)

| Time | Beat | Picture | Sound |
|------|------|---------|-------|
| 0.0–0.5 | power-on | dot → line → screen, flash | thump, crackle, whine |
| 0.5–1.0 | magnetized | DEGAUSS with rainbow purity blotches; OSD "DEGAUSS" pressed | 60 Hz buzz, click |
| 1.0–2.5 | the degauss | wobble, colour fringe, phosphor trails, settles crisp | BWOOM: thud + ringing coil + falling hum |
| 2.5–3.5 | subtitle | "a mixed-space typeface" types in | beat drops; typing ticks |
| 3.5–7.0 | widths | "firmware" in monospace cells → snaps to four widths; C30–C90 legend | each width plays its note: 2:3:4:6 is an A–E–A–E chord |
| 7.0–10.5 | ligatures | 7 ligatures form, one per beat, with language tags | ascending blips |
| 10.5–12.5 | glyph roulette | 16 glyphs at 1/4 beat, channel-flip static | ticks + riser |
| 12.5–14.5 | end card | DEGAUSS, free font, livery, URL | stinger chord |
| 14.5–15.0 | power-off | collapse to the power-off dot (loops into 0.0) | zip-down, fizz |

## Plan

- [x] `utils/degauss/video/intro.html`: frame-stepped renderer (2D scene
      canvas → WebGL2 CRT shader: curvature, bloom from mips, chroma, scanlines,
      persistence, wobble, purity blotches, power on/off) + offline WebAudio score
- [x] `render.mjs`: CDP driver → JPEG frames + WAV (poster PNG via `--poster`)
- [x] `encode.py`: two-pass loudnorm, H.264/AAC mux, contact sheet, spectrum, waveform
- [x] Review frames (contact sheet + key frames), audio (waveform/levels)
- [x] Commit the pipeline (outputs gitignored), deliver the MP4 + poster

## Review

- `out/degauss-intro.mp4`: 1080×1080 H.264 High 4:2:0, BT.709 tagged, 60 fps,
  900 frames, AAC 48 kHz stereo 256 kbit/s, 15.000 s, 23.5 MB, 12.6 Mbit/s,
  −14.2 LUFS integrated, true peak −1.6 dBFS (ebur128 on the final file).
- Loop seam: frames 896–899 and 0–3 are the same picture (power-off dot +
  end-card afterglow); mean frame difference across the seam 1.6 vs 1.1–1.5
  between neighbouring frames elsewhere (grain).
- All seven ligatures fuse in the canvas (render.mjs checks calt before
  rendering; key frames confirm → ≠ ⇒ ▷ ≡ ≤ ◇).
- Legibility checked at 390 px (phone timeline width): headings, ligatures and
  end card read; the class labels and URL are small but legible.
- Fixed during review: hue rotation alone left the near-white title uncoloured
  (added a purity colour cast); phosphor trails muddied cuts (persistence
  0.74 → 0.6, 0.45 in the roulette, 0.78 at power-off so the last frame
  matches the first); 0.6 s of near-silence before the drop (tape spin-up
  swell); degauss hit was mostly sub-bass (added shadow-mask partials at
  1.1–3.4 kHz and opened the hum filter so it carries on phone speakers).
- `aac_at` (AudioToolbox) fails to open under the command sandbox; the
  encoder uses ffmpeg's native AAC.
- Not verified: listening on real speakers/headphones (mix checked by
  loudness, peak, waveform and spectrogram only); X's re-encode of the
  upload; which frame X picks as the thumbnail (poster PNG supplied).
