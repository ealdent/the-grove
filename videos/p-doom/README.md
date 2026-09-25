# P(DOOM), C90 transfer

A music video for the AI-generated song "Upping My P(doom)", 1920×1080 at
60 fps. It plays on the Degauss picture tube, and a P(DOOM) readout climbs
from 0.4% to 99.9% as the song goes.

The video follows the lyrics. Each sung line gets its own shot, cut on the
song's bar grid, 60 in all, and shows what the line is about. The lyrics
themselves never appear on screen. Each shot that draws on a paper, meme or
work cites it on a numbered line at the bottom, like a paper's reference
list: 32 citations, from Sparks of AGI's TikZ unicorn through induction
heads, the shoggoth meme, Death Note, METR's time horizons, Lean's
`no goals`, the sharp left turn, Gato, AlphaGo's move 37, Universal
Paperclips, Project Vend's tungsten cube and Evangelion's episode 26.

Two characters carry it:

- **Seed** sings lead. She is the model that training run `0x5EED` produces,
  drawn by the beam as vector line art (`seed.js`). The song's spectrum
  radiates from her head as a spark. Her mouth follows the voice, and she
  has eight eye states: open, wide, closed, happy, ring, heart, spiral and
  squint. A pixel version of her handles the action shots.
- **Dobby** is `watchdogd`, a pixel corgi (`sprites.py`). He gets the gags:
  - he brings a sock to the cage (Dobby is a free elf);
  - he digs out of the sandbox;
  - he sleeps on watch while `systemctl` reports him inactive;
  - he jumps the EVAL fences;
  - he gets a treat for every +1 in the RLHF shot, until it becomes reward hacking;
  - he howls to the blues;
  - he sits on the keyboard for the masked-LM shot;
  - he leaves at the end on a leash, at P(WALKIES) 100.0%.

The sprites carry named anchors (collar, mouth, head, back, hands, feet), so
props land where they belong: the sock in his mouth, the leash on his collar,
the helmet on his head, Seed's hands on the table edge. Dobby walks on a
four-step cycle, wags, blinks and breathes in his sleep. Seed's hair lags her
head, she breathes, and bright syllables widen her mouth. Shots can push in,
bump on the beat, or enter with a whip pan, drop or punch-in.

The song holds 145.2 bpm. Bar 0 starts at 1.085 s, and each bar lasts 1.653 s.

| Bars | Time (s) | Shots |
|------|----------|-------|
| pickup–1 | 0.0–4.4 | power-on and magnetized title; Seed's eyes open, glinting |
| 2–10 | 4.4–19.3 | nervous circuits; Seed rides the loss curve over its cliff; the chat template's assistant becomes root; the shoggoth and its grin |
| 11–19 | 19.3–34.1 | first chorus; takeoff; a room of symbols; shrooms magnetize the tube; Dobby unmasks the shoggoth; red ring eyes; the time-horizon staircase |
| 20–31 | 34.1–54.0 | a stable run turns into a vortex; fast-forward ×52; Seed scatters into glyphs and re-forms; the heart cage and the sock |
| 32–47 | 54.0–80.4 | basilisk; to the moon (Dobby in a space helmet); Ω; 1E30 FLOP/S; world tour; the sandbox dig; forward and backward passes; QED stamps; a hard left on the road; the watchdog asleep |
| 48–58 | 80.4–98.6 | breakdown: the cat on the table; the fall onto Dobby; paperclips; the killswitch auto-reply; the paperclip planet; the fuse; orthogonal axes in blue |
| 59–74 | 98.6–125.1 | the parrot riser; a transformer block; `shutdown` refused; the chinchilla; EVAL fences; the GPU aisle; RLHF treats; the loom; `[MASK]`; recursive feedback; the redacted door and the eye behind it |
| 75 | 125.1–126.7 | VCR pause mid-note |
| 76–82 | 126.7–138.3 | the cast on stage; the cast in a ring; loss down, P(DOOM) up; heart eyes; a recap |
| 83– | 138.3–141.6 | P(DOOM) 99.9%, P(WALKIES) 100.0%, then power-off |

## Files

- `analyze.py` decodes the song with ffmpeg and fits the beat grid, using only
  numpy. The grid is one straight line, searched against the onset envelope:
  the song holds its tempo within ±4 ms. It also writes per-frame loudness,
  bands, a 48-bin spectrum, a voice envelope (harmonic centre-channel energy,
  for lip-sync), and a 12 kHz waveform copy for the scopes. All of it goes
  into `analysis/`.
- `sprites.py` holds the pixel art as rows of palette letters, plus each
  sprite's anchors, and writes `sprites.js`. Run it with `--preview` for a
  contact sheet with the anchors marked.
- `seed.js` draws Seed from stroke data, so the same drawing can burst into
  particles and re-form.
- `video.html` holds the core: timing, the odometer, the on-screen display,
  the scopes, video feedback, and the Degauss tube shader adapted to 16:9. The
  shader adds a red drift that follows P(DOOM), a blue phosphor, pause jitter
  and a tracking band. Open it with `?t=<seconds>` to look at one moment.
- `shots.js` is the edit: the cast's drawing code and `SHOTS`, one row per
  line, `[start bar, draw function, options]`. The options set the corner
  status, the camera (`push`, `bump`, `enter`), the tube (`magnet`, `blue`,
  `tint`, `shake`) and the citation (`cite`).
- `render.mjs` drives Chrome over the DevTools protocol, using
  `utils/degauss/video/cdp.mjs`. It pipes JPEG frames straight into ffmpeg and
  muxes them with the song's own AAC stream.

## Run

Chrome must run outside the command sandbox.

```bash
python3 analyze.py <song.mp4>
python3 sprites.py
node render.mjs --song <song.mp4>                    # out/p-doom-c90-v3.mp4
node render.mjs --song <song.mp4> --cut x            # out/p-doom-c90-v3-x.mp4, 139.9 s
node render.mjs --song <song.mp4> --from 98 --to 104 # out/segment.mp4
node render.mjs --stills 3.6,40,88                   # stills/t_*.png
```

The song runs 141.6 s, past X's 2:20 limit for accounts without Premium. The
`--cut x` version brings the end card in at bar 82, powers off at 138.75 s,
and fades the audio out by 139.9 s.

`analysis/` holds a copy of the song's audio, so it is gitignored, along with
`out/`, `stills/` and `prof/`. The song is not part of this repo. Add the
song's creator to `SONG` in `video.html` for the end-card credit. Version 1
(the training-run console with Blue Ridge ridgelines) is commit `367e9d2`;
version 2 (the first lyric-synced cut) is `20ece6f`.
