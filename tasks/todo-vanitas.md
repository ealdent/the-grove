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
- [ ] Independent review agent
- [ ] Index tile, commit, push

## Review notes

(filled in at the end)
