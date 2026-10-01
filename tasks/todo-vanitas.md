# Task: VANITAS — a candle flame's run down the painter's table (Space Harrier descendant)

Goal: single-file, zero-dependency rail shooter at `rail-shooter/fable-5.1-xhigh-rail-shooter.html`,
plus a tile in `rail-shooter/index.html`. Commit + push to origin main.

Constraints: one self-contained HTML file, no CDN, opens from `file://`, keyboard + mouse only,
60 fps, procedural Web Audio music and SFX, no placeholders / TODOs, pause + mute + restart work.

Non-goals: mobile/touch, multiplayer, external assets.

Note: `tasks/todo-weftrunner.md` shows a previous session already built a loom/cloth rail shooter
(`fable-5-ultra`), so the loom theme was dropped. `THE LAST STROKE` (sumi-e) exists too, so the
world here is the *table*, not "a painting"; the frame/plaque is only the museum conceit.

## The world

A Dutch Golden Age still life at night, seen from an inch above the table. **You are a candle flame
that has left its wick.** A flame that stops is smoke, and behind you the varnish is drying: whatever
it reaches is painted still forever. Ahead the table runs into darkness; you are the only warm light
in the room (a cold window at the back-left gives every far thing a blue rim).

- Ground = the table: white damask cloth with folds (stage 1), a red Turkish rug (stage 2),
  black velvet + scattered papers (stage 3). Beyond |x| ≈ 9 the table edge drops into black.
- You fire **embers**. They light the cloth as they fly. Kills burn things to ash.
- Pillars to dodge: roemer glasses (near-missing one *rings* it), candlesticks, bottles, the pewter
  jug, bread loaves and cheese (low, fly over), walnuts (rolling), a lemon-peel spiral, books, the
  hourglass, the lute, a clay pipe.
- What hunts you: flies, wasps, ants (ground columns), bread weevils, snails, oysters (turrets that
  spit pearls), grapes, death's-head moths, spiders on silk, smoke wraiths from a snuffed candle,
  soap bubbles (score fodder: *homo bulla*).
- Bosses: **The Mouse** (mice eat tallow candles), **The Lobster**, **The Skull**, and the
  **Hand with the Snuffer**.
- Health = the wick: three lengths of candle. Score in points; distance in inches of table.
- Sound: chaconne on a lament bass (D–C–B♭–A), Karplus-Strong lute, viol drone, ticking pocket
  watch as the hi-hat; flies buzz in stereo as they approach; glass pings on grazes.

## Plan

- [x] Scaffold: scratchpad `src/*.js` + `style.css` + `template.html` → `build.mjs` concatenates
- [x] GL core + ground/sky shader (ray-cast plane, flame point light, window key light, fog to dark)
- [x] Sprite atlas (canvas 2D vector art) + instanced sprite pipeline (billboard / flat / segment / flame)
- [x] Player + input (WASD/arrows + mouse) + camera + juice (shake, hitstop, flicker)
- [x] Entities: enemies, obstacles, projectiles, particles, popups, pickups; collisions; grazes
- [x] Wave director: 3 stages with hand-authored openers + procedural beats; loop escalation
- [x] Bosses ×4 with tells, phases
- [x] Audio: engine, chaconne sequencer, SFX
- [x] UI: framed title + plaque, HUD, banners, pause, game over → plaque, high score
- [x] Main loop, adaptive render scale, visibility pause, reduced motion
- [x] Verify: CDP harness (fps, console, playthrough bot, screenshots per stage/boss, controls)
- [x] Independent review agent
- [x] Index tile, commit, push

## Review notes

Shipped as `rail-shooter/fable-5.1-xhigh-rail-shooter.html` (211 KB, raw WebGL2, no libraries), commit a759d20.

Proof (all with headless Chrome via a CDP harness unless noted):
- Autopilot soak with god mode, 420 s: stage 1 → Mouse → stage 2 → Lobster → stage 3 → Skull → the Varnish → Hand → loop into "the second sitting"; every boss pattern state observed; zero console errors or exceptions.
- Autopilot soak without god mode, 240 s: lost one wick in stage 2 and one in stage 3, reached stage 3 alive.
- Real GPU (Browser pane, Apple M5 Pro, ANGLE Metal): 120 fps at 2560x1440, worst frame gap 9.3 ms; adaptive render scale stays at 1.0.
- Flow: title → Space starts; WASD/arrows and mouse both move the flame; Space/click fire; P and Escape pause (AudioContext suspends, panel shows, Resume button works); M mutes and persists; three hits → dying → game over plaque with stats; new best stored in localStorage; Space restarts with reset state; Back to the frame returns to the title with the best line; R restarts from pause.
- Audio: context running, chaconne scheduler at 92 BPM, master-bus RMS never silent during play, SFX peaks register, mute drops RMS to 0.00003; fly buzz pans by x and pitches by species.
- Visual review: atlas quadrants, controlled frozen scenes for all three stages, popups, surface transition seam, onboarding hint, 1280x720 and 1920x1080 layouts, title/pause/over screens.

Not verified: a human play session (difficulty tuned from a bot that reacts every frame); Firefox/Safari rendering (built for current desktop browsers, WebGL2 required).

Independent review (second commit): the reviewer found that seven boss attacks (mouse tail, lobster snaps, sweep and antennae, the painter's brush) were declared 1.5-3.5 units ahead of the flame's plane and could never connect; `checkHazards` now meets a hazard whose plane lies within 3.6 units ahead in x/y. Also fixed from the review: swept crossing tests for enemies, obstacles, enemy shots and pickups (no tunnelling at the 50 ms frame clamp or in deep loops), no scoring or grazes outside play, autofire no longer sticks when the mouse button is released off-window, the stage-1 hem is periodic in the 256-unit scroll wrap, the Hand's entry no longer depends on a first-frame equality, a warm screen flash on boss death, `?stage=`/`?scale=` guard against NaN, and unused helpers/sprites removed. Re-verified with a hazard harness that uses the game's real collision test (every hazard connects), the reviewer's tunnelling harness (26/26 passes at every frame rate), the full flow test and a stage 2 soak through the Lobster.

Note: while this was being built, another session pushed "Gutter Saint" (GPT-6 Astra), also a candle carried along a banquet table. The themes converged independently; VANITAS leans on vanitas painting iconography (chiaroscuro, the Fates-free memento mori: skull, hourglass, snuffer, the painter's hand, the varnish, the framed plaque).
