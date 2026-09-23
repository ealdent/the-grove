# NEVERSTILL — free-roaming Space Harrier descendant (arcade/neverstill.html)

Goal: single-file 3D arcade shooter that plays like Space Harrier, but the
terrain is fully navigable (no rail). The one hard rule: you can never stop
moving forward. You can turn, climb, dive, brake to a minimum speed, boost,
barrel-roll and fly in circles forever.

## Design locks

- **Look:** 1990-ish arcade polygon board. Scene rendered at ~270 lines,
  integer-upscaled, ordered-dither quantized colour, bloom, CRT scanlines +
  mild barrel. Checkerboard terrain with real hills/ridges/lakes, gradient
  skies with parallax mountain silhouettes, flat-shaded low-poly everything,
  blob shadows that conform to terrain (computed in the terrain shader).
- **Tech:** WebGL2, zero dependencies, zero network requests. CPU-built
  terrain chunks (4 LODs, geomorph + skirts) streamed around the camera.
  Instanced meshes, point-sprite particles, pixel-font HUD on a 2D canvas
  composited in the post pass.
- **Player:** a pilot strapped prone to a striped rocket (twin side cannons,
  trailing scarf). The rocket can't be throttled off, which is the fiction for
  the never-stop rule. Low flight kicks up a dust/spray plume. Speed never
  drops below the brake minimum.
- **Key art:** Higgsfield GPT Image 2.5 pixel-art card (rocket rider over a
  twin-sun checkerboard desert), downscaled to 480x269 and quantised to 64
  colours, embedded as a data URI. It alternates with the live demo on the title.
- **Enemies:** Skate formations, stone Masks that lead you, kamikaze
  Spinners, ground Turrets. Bosses: WYRM (segmented serpent that circles
  you), HALO (pod-shielded core you have to circle). 5 zones, looping
  harder.
- **Scoring:** kill chains, low-altitude x2, ring chains, graze, gates,
  stage-clear tally, extends, top-5 initials table in localStorage.
- **Audio:** Web Audio FM-style sequencer (stage theme, boss theme,
  jingles), synthesized SFX, wind/engine bed tied to speed, optional
  speechSynthesis call-outs.
- **Input:** keyboard, gamepad, touch (stick + buttons), optional
  pointer-lock mouse steering.

## Checklist

- [x] Engine: GL setup, FBOs, programs, mesh builder, instancing
- [x] Terrain: height fn per zone, chunk LOD streaming, water, sky
- [x] Player flight + camera + scarf + animation (reworked into a rocket rider after the user's reference image)
- [x] Props (columns, trees, gates, mesas, hoodoos, ...) + collision
- [x] Weapons, lock-on, enemies, bullets, pickups, rings
- [x] Bosses (WYRM, HALO), stage flow, scoring
- [x] HUD, menus, settings, hiscores, touch UI
- [x] Audio: music + SFX + voice
- [x] Post: bloom (emissive alpha mask) + CRT
- [x] Verify: browser pane screenshots, console clean, headless sim of
      stage flow, perf check
- [x] Arcade tile + README line (added by hand; the regen script drops
      curated sections), commit, push

## Review

Proof (Browser pane, localhost:8003, plus headless Chrome for a fresh-profile 16:9 title):
- All five zones rendered and screenshotted (MERIDIAN, SAFFRON, NOCTILUCA, EMBERFALL, CIRRUS).
- Flow: title -> play -> waves -> WARNING -> WYRM/HALO -> bossdown -> tally -> warp -> next stage. A 6-stage
  forced soak looped back to MERIDIAN round 2 with no exceptions; the chunk cache stayed at ~150.
- Game over -> initials entry (keyboard) -> high-score table -> CONTINUE, and countdown -> title.
- Menus by click and keyboard, settings toggles, pause/help. Touch portrait and landscape: tap START,
  stick steer, FIRE. Audio: context running, music bus peak ~0.3 / RMS ~0.1, SFX while firing.
- Perf: median 1.6 ms (p90 2.7 ms) per update+render+readPixels sync mid-boss at 682x512 internal ->
  2048x1536 output, on this Mac's GPU.

Independent review (subagent) found 10 defects, all fixed and re-tested: continue countdown and fade
loop, enemies spawning during boss death, damage during clear/warp, warp not reset on quit, accuracy
over 100%, a pod scored twice, attract demo with no enemies, invert-Y applied to the autopilot,
gamepad Start confirming while paused, a double initials commit. Plus boss-bonus split timing.

Not verified: real gamepad hardware, speechSynthesis voice quality, a physical phone (emulated
viewport only), and actual feel/difficulty with a human at the controls (tuned from autopilot runs).

## Follow-up: enemy AI rework (user: enemies too fast, too agile, too few)

- Enemies now hold stations in a lagged copy of the player's heading (turns at most 0.6 rad/s).
  Steering is acceleration-capped (55 u/s², cruise + 34 u/s max), and models face their motion
  relative to the player.
- Skate vees slide in at 30–38 u/s relative and pass beside you. Crossing flights drift across your
  view. Masks hover 130–180 ahead and leave after about 20 s. Spinners hover, telegraph for 0.7 s,
  then lunge slowly. The WYRM weaves in front and makes periodic side passes instead of orbiting.
- HP: mask 6→3, spinner 2→1, turret 4→3. Enemy bullets 105→72 u/s. Models scaled ×1.35–1.7 with an
  emissive floor so they read against bright skies.
- Numbers: groups of 6–8 skates, 3–4 masks, 4–5 spinners, 3–4 turrets; cap 14 + 1.5/stage (max 26);
  spawns every 1.7–2.9 s; quota 30 + 4/stage. WYRM HP 96→150.
- Measured, same seed, 90 s autopilot, before → after: enemies spawned 53 → 103, lock-on time
  27% → 48%, median enemy lifetime before being shot 1.8 s → 5.0 s, median closing speed 60 → 25 u/s
  (p90 186 → ~100). Non-god autopilot took 4 hits in 2 min over stages 1–2. WYRM fight ~30 s.

## Follow-up: Invert Y + Higgsfield art upgrade

Invert Y: I couldn't reproduce a failure. Real CDP key events, touch drags, a mocked gamepad and
the full click flow (SETTINGS -> INVERT Y -> BACK -> START) all invert correctly, pitch +0.61 -> -0.60.
Made it robust and visible anyway:
- Inversion now happens once in `pollInput` for every human input.
- An `INV Y` HUD tag shows while it's on.
- A banner confirms each change.
- `I` toggles it in flight, and HOW TO PLAY lists it.

Art pipeline (the scratchpad `assets/` scripts: manifest.py, gen_one.sh, gen3d.sh, poll3d.sh, glb2nvm.py,
build_blob.py):
- One fixed style formula in every prompt: retro 90s texture-mapped arcade, chunky low-poly,
  hand-painted pixel textures, palette by role.
- 15 terrain tiles (ground/high/rock per zone) and 3 prop material tiles via nano_banana_2. Seams
  fixed with the Higgsfield pipeline.py, then 128 px, 48 colours.
- 5 keyed horizon panoramas via gpt_image_2_5 (21:9), 1024 px wide, mirrored 4x around the horizon.
- A 16-frame explosion flipbook (gpt_image_2_5), drawn premultiplied.
- 17 image_to_3d models from nano_banana_2 concept art: 4 enemies, 4 boss parts, the rocket rider,
  8 props. Packed as quantized NVM1 binary plus a 128/256 px texture.
- Everything lives in a JSON blob in the page, so it's still one file. `?art=0` falls back to the
  flat-shaded original.

Proof (Browser pane, fresh tab):
- All 5 zones render with textured terrain, triplanar cliffs and painted skylines.
- Generated models appear in game: mask, skate, rider, trees, crystals, WYRM, HALO.
- A 5-stage forced soak with all art loaded threw no exceptions and left a clean console.
- Frame timing: median 1.2 ms, p99 2.5 ms, max 8.1 ms (update + render + readPixels sync).
- `?art=0` fallback still works.
- Credits: about 89 for the 2D set and about 510 for 17 models (1025 -> ~425 remaining).
- Page grew from 276 KB to 3.3 MB (24 textures + 17 models + key art, base64 in a JSON blob).

## Follow-up: settings audit + no more hugging AI

User: can't turn off the music or change its volume; check all settings. Then: no AI should hug the player
or loop behind; the WYRM just flies in circles.

Audio root cause: lead, bell, arp and snare (and some SFX) sent to the reverb before the fader, so MUSIC 0
still played reverb at -42 dB and the wet part never changed. Fixed:
- Per-bus reverb sends that track their fader.
- Bus levels are a pure function of the settings and the pause state, re-applied every frame. This also
  fixes music staying ducked after QUIT TO TITLE from pause.
- Squared taper.
- A click on a volume bar sets the level under it (before, clicking the bar could only raise it).
- Held arrows repeat in menus.

Settings proof (Browser pane, output metered at the compressor feeding the destination):

| Setting | Measured |
|---|---|
| MUSIC, levels 0/1/3/5/7/10 | -180 (silence) / -53 / -34 / -25 / -19.8 / -14 dB; 7 matches the old mix |
| MUSIC, pause | -18.8 -> -29.5 dB, back to -18.8 after quitting |
| SOUND FX, while firing | silent at 0; -33 dB at 8, raised from the pause menu |
| Volume bar clicks | levels 3/10/0/6/1 land exactly; a real mouse click set 4 and it saved |
| Held arrow | steps 0 -> 10 |
| INVERT Y | pitch -0.54 on vs +0.54 off |
| SCREEN SHAKE | camera offset 0 off vs 1.07 on |
| MOUSE STEER | 1 pointer-lock request on vs 0 off |
| VOICE | boss warning spoken only when on |
| CRT | corner pixel 128 -> 74 |
| PIXELS | 270P -> 360P gives 293x461 -> 390x615 |
| All settings | persist across reload |

AI rework:
- WYRM (1.5x larger, HP 150 -> 195):
  - Surfaces ahead along the pilot's predicted heading, with a rumble and dirt.
  - Weaves in front, then makes a head-on run and dives into the ground before reaching you.
  - Burrows if out of view for 0.5 s.
- HALO: holds 130-210 ahead in a lagged heading frame. If out of view for 0.8 s it blinks out and re-forms
  ahead.
- Skates: break outward and climb at close range instead of sliding past.
- Masks: rise away instead of drifting back past you.
- Any enemy out of view for 0.6 s flies off on its own heading and frees its spawn slot.
- Autopilot (demo + test pilot): prefers targets in front, skips fleeing ones, and does not orbit targets
  inside its turn circle.

Proof: same autopilot in both builds, 45 s per boss with HP pinned.

| Boss | In front, before -> after | Hugging (<250 u, >60 deg off nose), before -> after |
|---|---|---|
| WYRM | 45 -> 85% | 44 -> 2.5% |
| HALO | 37 -> 93% | 43 -> 1.6% |
| 2x WYRM | 40 -> 88% | 43 -> 0.6% |
| Any boss, circling pilot | | 46-57 -> 0-1.4% |

- Wave enemies with a circling pilot: close beside or behind 15.2 -> 0%.
- Time to quota: median 19.1 -> 20.8 s, max 28.8 -> 23.7 s over 12 runs.
- Real fights (no god): WYRM 26-36 s -> about 36 s after the HP bump; HALO 111+ s -> 54-77 s; 2x WYRM 80-91 ->
  60-69 s, with fewer hits taken.
- Soak: all six boss configs cleared with no errors, including `?art=0`.

Not verified: how it feels with a human at the controls, and real gamepad hardware.
