# Boots

A 2:36 fast-cut history of large language models, 2017 to 19 Nov 2026 and then past the present, cut to Taylor Holmes's
1915 recitation of Kipling's "Boots". Every cut lands on a syllable of the recitation. The film is monochrome with red
type until the last stanza, which turns to colour and ends on "We're all in this together".

Only the source lives here. The media (recording, score, generated stills and clips, renders) is in the gitignored
`tmp/boots-march/` (`MEDIA` below).

## Sources

- **Voice:** "Boots", Rudyard Kipling (1903), recited by Taylor Holmes, Victor 55057, recorded 8 Jul 1915. Library of
  Congress National Jukebox item `jukebox-187752`, master WAV. US recordings published before 1923 are public domain.
  The film starts 33.0 s into the transfer, where the poem itself begins.
- **Score:** Eleven Music (`music_v2_5`), one instrumental take from a five-section plan (rise, surge, terror, dawn, end).
- **Stills and clips:** Higgsfield (`nano_banana_2`, a few `gpt_image_2_5`; clips are `kling4_0` image-to-video).
  Nobody real is depicted: figures are anonymous and nothing is written in frame. Names, dates and numbers are type.
- **Hits, risers, drone:** synthesised in `mix.py`.

## Pipeline

```
PY=tmp/.venv-whisper/bin/python          # mlx-whisper + scipy
$PY analyze.py SOURCE.wav MEDIA/analysis # word timings + voice onsets (the cut times in edit.js come from these)
python3 assets.py MEDIA                  # write the still and clip specs
python3 higgs.py MEDIA/specs_images.json MEDIA/raw     # paid; one run at a time (they share raw/jobs.json)
python3 higgs.py MEDIA/specs_clips.json MEDIA/raw      # paid; needs the key_* stills first
python3 prep.py MEDIA                    # raw/ -> img/*.jpg, clip/*/NNNN.jpg, clips.json
node export_shots.mjs                    # edit.js -> MEDIA/shots.json
$PY mix.py MEDIA SOURCE.wav MEDIA/audio/score.mp3      # -> MEDIA/audio/mix.wav
node render.mjs                          # -> MEDIA/out/boots.mp4   (--sheet 20 for contact sheets, --stills t,t)
```

Chrome, the Higgsfield CLI and mlx-whisper all need the command sandbox off.

- `edit.js` is the whole edit: one line per cut, timed in source seconds.
- `engine.js` draws a frame from its index: image moves, type, the timeline strip, flash, shake, grain.
- `mix.py` splices the two silent gaps out of the score, lands its major entrance on the first colour cut, and keeps
  the bed about 6 dB under the voice.

## On-screen facts

2017 to mid-2025 is common knowledge checked against the usual dates. Mid-2025 to Nov 2026 comes from a web-researched
timeline (kept with the media as `research/timeline.md`), and the two present-day items were re-checked against several
outlets on 19 Nov 2026: Anthropic's IPO (priced at $83 on 18 Nov, about $1.5 trillion, Nasdaq "ANT", first trade
19 Nov) and Jensen Huang's resignation as Nvidia's CEO.

Every card was then re-checked by two independent passes (2017-2024 and 2025-2026) on 19 Nov 2026. Neither found a
flat error; they found one ordering slip (xAI, 12 Jul 2023, belongs before Llama 2, 18 Jul) and a handful of captions
that claimed slightly more than the record supports, all fixed.

Wording chosen where sources disagree or the easy phrasing overstates:

- ChatGPT's "100 million users in two months" is an analyst estimate (UBS), not an OpenAI figure.
- The pause letter is stamped 22 Mar 2023 but was published on the 28th, so the card says "MAR 2023". Its 30,000+
  signatures are the eventual total.
- Hinton told Google in April 2023; 1 May is when he went public.
- Nvidia touched $1 trillion only intraday on 30 May 2023 ("briefly"); $2T is the first close (1 Mar 2024); $4T and
  $5T are the days it first crossed.
- On Tue 21 Nov 2023 (Pacific) OpenAI announced a deal for Altman's return; he was formally back on 29 Nov.
- The Times suit widened a copyright fight that authors had started months earlier.
- "Washington bans Claude" describes the 27 Feb 2026 order ending federal use. Courts later split on it.
- "AGI era" was Greg Brockman's hedged remark at the GPT-6 launch, not a company declaration.
- The 5 Nov 2026 sell-off is given as "$3 trillion" (the S&P 500's one-day loss; reports range from $2.9T to $3.2T).
- Anthropic's $1.5 trillion is the fully diluted value at the $83 IPO price.
- The Huang card says only that he resigned and that Nvidia fell below $4 trillion; it gives no reason.
- The SpaceX/xAI "$1.25 trillion" figure is Bloomberg's reporting, not a company number.
