# Codex Incendia — 30 s X demo video

Goal: ~30 s 1080p60 H.264/AAC demo of `rail-shooter/gemini-4-argon-high-rail-shooter.html` (CODEX INCENDIA, Gemini 4 Argon High) for posting on X.
Pipeline: `rail-shooter/codex-incendia-trailer/` (scripts committed, generated media gitignored). Output: `tmp/codex-incendia-trailer/`.

Assumptions (recorded, not asked): 16:9 landscape; in-engine footage only; game's own synth music + SFX; HUD visible in gameplay shots, hidden in cinematic shots; end card credits the model and the URL.

## Plan
- [x] Capture copy of the game: no rAF loop, seeded `Math.random`, game exposed on `window.__ci`, game `setTimeout`s on a game-time queue, CSS animations stepped per frame, SFX calls logged, damage disabled.
- [x] CDP driver: 1280×720 CSS at DPR 1.5 (1920×1080 out, HUD legible on phones); per frame `update(1/60)` → camera override → `render()` → `Page.captureScreenshot` (JPEG).
- [x] Autopilot: analog mouse target, dodges hazards, lines up on enemies, grazes on purpose, dash barrel rolls on cue, skating runs.
- [x] Shots: skate cam, Folio I combat + divider fly-under + grazes, Folio II (shears/ophanim/nibs), Folio III inferno, boss reveal (telephoto), telegraph sweep, quill slam, mask shatter, defeat.
- [x] Audio: OfflineAudioContext pass; one continuous 146 bpm score with the game's mode switches on 4-bar lines (I → II → III → boss → back to I for the end card) + per-shot SFX; final downbeat rings out.
- [x] Overlays: title + end card rendered in Chrome with the game's fonts (Cinzel Decorative gold), transparent PNG sequences.
- [x] Edit: cuts on the 146 bpm grid, no black, music from frame 1, ends on picture; loudnorm −14 LUFS; X-friendly encode.
- [x] Verify: duration/streams via ffprobe, contact sheet, audio onset vs cut sync, watch-through frames.

## Review
- Output: `tmp/codex-incendia-trailer/codex_incendia_demo_1080p60.mp4`: 30.83 s, 1920×1080, 60 fps, H.264 High, AAC 256k, 64 MB (17.5 Mbps), 18 shots.
- Verified with ffmpeg:
  - −14.2 LUFS integrated, LRA 3.2;
  - no black frames (the darkest, at luma ~20, is the defeat burst);
  - every planned cut shows a frame-difference spike at its frame;
  - kick onsets sit +6 ms from the 146 bpm grid (IQR 5–7 ms);
  - music runs from frame 1 to a final downbeat that rings out under the end card.
- Fixes made along the way:
  - The autopilot chased moths it could never reach at the scroll edge. Targets are now limited to reachable ones near the player.
  - The boss dies inside `update()`, so the post-kill camera computed `i - undefined` and rendered NaN frames (a 0.8 s blank). The guard now lives in the camera code, and `smoothCam` throws on non-finite input.
  - The defeat read small in telephoto. It now has a 0.3x crash zoom into the burst before the crane-out.
  - Auto-fire sfx were as loud as the score. They now go through a quieter send and a lower sfx bus.
- Not verified: how X re-encodes it, and listening on real speakers (the audio was checked numerically only).
