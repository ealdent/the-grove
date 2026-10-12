# Apollo: the way home

Original ManimGX scene for The Grove's Apollo tutorial. The committed film is **55 seconds, 1600 × 900, 30 fps, H.264/yuv420p**, with an English ElevenLabs voiceover, matching WebVTT captions, and a JPEG poster. All linework, text, and animation are rendered by [ManimGX](https://github.com/academa-labs/manimgx); no stock imagery, historical film, or generated image assets are used.

The visual identity treats the film as an optical navigation instrument: neutral black (`#09090d`), optical white (`#f4f4ee`), signal orange (`#ff6333`), cool lavender (`#b6b1c5`), condensed heavy sans headings, concentric sighting rings, and sparse registration stars.

## Reproduce

Requires `uv`, Python 3.13 or later, `ffmpeg`, and a GPU supported by ManimGX. Dependencies are pinned in `requirements.txt`. The verified render used ManimGX **0.1.1**, Python **3.13.16**, and macOS Metal.

From the repository root:

```bash
bash scripts/apollo/render.sh
```

The script creates a temporary virtual environment, renders the source, normalizes the native variable-duration frames to constant 30 fps, and muxes the committed narration master into the web film in `learn/apollo-assets/`. The final still frame is deliberately held through 55 seconds. Intermediate MP4s and engine storyboards stay in the temporary directory. Re-rendering requires no ElevenLabs request or credentials.

To replace only the voiceover while preserving the existing picture bit-for-bit:

```bash
bash scripts/apollo/render.sh --audio-only
```

## Narration

The synthetic narrator is ElevenLabs' preset **Bill — Wise, Mature, Balanced**, using `eleven_multilingual_v2`. This is newly written educational narration, not archival NASA audio or an impersonation of mission personnel. The exact voice settings, script, and chapter windows are in [`narration.json`](narration.json). The six takes were generated through the user's ElevenLabs `local-api-mcp` with a distinct stable operation ID for each request; only overlong passages were rewritten and regenerated.

The committed `learn/apollo-assets/apollo-narration.flac` is the assembled mono 44.1 kHz master. It preserves natural speech timing, trims only detected trailing silence with a 100 ms tail, and is normalized to approximately −16 LUFS. The MP4 contains mono AAC at 128 kb/s. There is no music under the narration.

To build a new master from replacement takes, generate one MP3 per chapter from `narration.json` using the same voice/settings, name them `cover.mp3`, `state.mp3`, `injection.mp3`, `intercept.mp3`, `encounter.mp3`, and `correction.mp3`, then run:

```bash
python3 scripts/apollo/assemble_narration.py /path/to/takes
bash scripts/apollo/render.sh --audio-only
```

The assembler rejects overlapping or overlong takes instead of truncating speech. It writes the audio master and captions together. If a take does not fit, shorten its script and regenerate that take. The audio is never sped up to fit. Original provider artifacts remain local; private artifact paths and credentials are not part of this repository.

For a quick native storyboard:

```bash
manimgx inspect scripts/apollo/apollo_flight_plan.py ApolloFlightPlan \
  -t 4.1,10,22,33.4,43.5,54.9 -o /tmp/apollo-storyboard.png
```

ManimGX 0.1.1's layout inspector reports the intentional faint optical rings and registration marks behind the diagram labels as shape/text collisions. Review clean video frames as well as the annotated storyboard: the checked final frames have no cropped text or text/text overlaps.

## Chapters

| Start | Subject |
| --- | --- |
| 0:00 | Apollo: the way home |
| 0:05 | State vector: position, velocity, epoch |
| 0:15 | Prograde burn and translunar injection |
| 0:25 | Intercept the Moon's future position |
| 0:35 | Free-return geometry and lunar capture |
| 0:45 | Tracking, correction, and the Earth-entry corridor |

These are teaching schematics, explicitly labeled **not to scale**. The injection ellipse is an ideal two-body explanation. The moving spacecraft markers use illustrative timing, not Keplerian timing. The other curves are authored diagrams, not reconstructed Apollo trajectories, a numerical propagation, or guidance software. The lunar encounter finishes near the Moon rather than at its center. Free return and lunar capture are separate targeting choices; the film does not claim all Apollo missions retained a free-return trajectory.

## Historical basis

- [NASA, Apollo 11 Mission Overview](https://www.nasa.gov/missions/apollo/apollo-11/apollo-11-mission-overview/): parking orbit, translunar injection, free-return mission design, and lunar orbit insertion.
- [NASA TN D-6855, Real-Time Auxiliary Computing Facility Development](https://ntrs.nasa.gov/api/citations/19720017573/downloads/19720017573.pdf), printed pp. 8–9: integrated trajectory ephemerides with position/velocity vectors, lunar-orbit-insertion support, and optimized midcourse targeting.
- [NASA TN D-6725, Mission Planning for Apollo Entry](https://ntrs.nasa.gov/citations/19720013191): entry targeting, monitoring, and control planning.

## Verification

The final MP4 was decoded with FFmpeg without errors. `ffprobe` reports 1,650 video frames, exactly 55.000 seconds for both video and audio, 1600 × 900, 30/1 fps, H.264/yuv420p, and mono AAC at 44.1 kHz. The narration update preserves the original encoded video stream bit-for-bit. Clean frames from the cover and every chapter were visually reviewed, including the final hold. The delivery MP4 has its metadata at the front for browser streaming and is approximately 2.52 MB.
