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
