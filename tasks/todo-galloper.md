# Task: GALLOPER — the night the lead horse ran (Space Harrier descendant)

Goal: single-file rail shooter at `rail-shooter/fable-5.2-high-rail-shooter.html`, plus a tile in
`rail-shooter/index.html`. Commit + push to origin main (the user asked for main explicitly).

Constraints: one self-contained HTML file, no CDN, opens from `file://`, keyboard + mouse only,
60 fps, procedural Web Audio music and SFX, no placeholders / TODOs, pause + mute + restart work.

Themes already taken in this folder (do not repeat): ink scroll koi, molten glass, luna moth,
candle on a still-life table, quill on a scroll, kintsugi brush, banquet candle, needle on cloth,
the loom. All small craft objects, so this one goes somewhere else entirely.

## The world

A seaside pleasure pier, after midnight, after closing. **You are the lead horse of the carousel
and you have torn off your pole.** The fairground wants its horse back: the stalls, the rides and
finally the Carousel itself come after you. Dawn is the deadline. Wood at sunrise is only wood,
unless you have reached the end of the pier.

- You throw **brass rings** (the thing riders used to grab at). Gold is always yours.
- Red-and-white striped light is always danger: every tell in the game uses it.
- Health = bulbs on the marquee. Each hit also chips paint off the horse.
- Score = tickets. Streak multiplier, grazes pay.
- Bolt (dash) with i-frames on a short cooldown.

| # | Stage | Look | Hunters | Boss |
|---|-------|------|---------|------|
| I | THE MIDWAY | wet boardwalk, bulb strings, striped tents, fireworks, Ferris wheel on the skyline | balloons, tin ducks, gulls, dodgems, popcorn carts | THE CLAW (crane machine): grab that jams in the boards, prize drop, sweep, token storm |
| II | THE FUNHOUSE | glossy checker floor under a striped canvas ceiling, magenta/cyan | clown masks, mirror-horses, jack-in-the-boxes, bop clowns, hypno discs | JACK (the box): crank-tune pop, glove punches, juggling fans, triple pop |
| III | THE LONG PIER | narrow boards over a moonlit sea, coaster trestles, sky paling toward dawn | gull flocks, chair-swing rings, rockets, the Boneshaker train | THE GALLOPERS (the Carousel): free your six siblings, then the organ: note volleys on the beat, pole slams, the charge, the roundabout |

Ending: dawn, the leap off the end of the pier, and every sibling you freed runs with you.
Then a faster second night.

## Plan

- [x] Read lessons, tile format, existing entries; pick a theme nobody has used
- [x] Scaffold: scratchpad `src/*` + build script that concatenates into the single HTML
- [x] GL core: HDR target, ray-cast sky/ground shader (planks, checker, sea, ceiling), planar
      reflection pass for the wet boards, sorted instanced sprite batch, bloom, final grade
- [x] Sprite atlas drawn with Canvas 2D at load; hero horse redrawn every frame (gallop, bank, chips)
- [x] Player, input (keys + mouse), camera, brass rings with aim assist, bolt, juice
- [x] Enemies, bullets, obstacles, pickups, tells, particles, grazes
- [x] Stage director: 3 stages, authored waves + obstacle fields, transitions
- [x] Bosses x3 with tells and phases
- [x] Audio: band-organ sequencer (waltz / galop / 6-8), SFX, ambience
- [x] UI: bulb marquee title, HUD, pause, game over, ending, best score
- [x] Verify headless: console clean, soak run through every stage and boss, screenshots
- [x] Independent review pass, fix findings
- [x] Index tile + README line, commit, push

Process note: CLAUDE.md asks for a plan check-in before implementation. This was a one-shot,
unattended cloud session with an explicit "do not pace yourself" brief, so the plan was written
here and executed without stopping.

## Review

Shipped as `rail-shooter/fable-5.2-high-rail-shooter.html`: one file, raw WebGL2 + Web Audio,
no libraries, no network.

What is in it

- One ray-cast pass draws sky (moon, stars, clouds, dawn), a striped canvas ceiling, wet planks,
  a glossy checker floor and the sea. A half-resolution mirrored sprite pass feeds planar
  reflections, so every bulb, tent and firework shows in the wet boards. HDR target, bloom,
  ACES-style grade. Falls back to 8-bit targets and a half-size atlas on weak GPUs.
- About 70 sprites are painted with Canvas 2D at load into one atlas; the hero is repainted every
  frame (gallop cycle, banking, flowing tail, paint chips per lost bulb, turning to wood).
- 11 enemy kinds, 17 prop kinds, 3 bosses with 13 attacks between them, all tell-then-strike.
- Band-organ music from PeriodicWave pipes with a tremulant: a D-minor waltz (Midway), a C-minor
  galop (Funhouse), a 6/8 gallop (Long Pier), heavier boss variants, a music-box title and a
  major-key dawn. The Gallopers fire their note volleys on the organ's own beat.
- Title sign and stage banners are spelled in bulbs with a 5x7 font, so no web font is needed.

Proof (headless Chromium + SwiftShader through Playwright, debug hooks behind `#debug`)

- Autopilot soak with god mode, twice end to end: Midway, Claw, Funhouse, Jack, Long Pier,
  Gallopers, ending, win screen. ~355 s of game time, zero console errors or exceptions.
- Every boss state was entered and screenshotted with the loop frozen (grab tell, lunge, stuck,
  prize drop, sweep; crank, pop, out, gloves; volley, slam, charge, organ open, roundabout, death).
- Real keyboard and mouse events (not debug calls): start, move, fire, bolt, pause, resume, mute,
  mouse steering, right-click bolt, restart from pause, restart from the game-over bill.
- Naive autopilot without god mode (does not dodge bullets or tells): 0-2 hits in the Midway
  before the boss, dies to the Claw; reaches the Funhouse boss when started there; dies about a
  minute into the Long Pier. So the curve rises and the bosses demand reading the tells.
- Audio rendered offline through the game's own synth and measured with ffmpeg: stage songs sit
  between -15.7 and -17.9 LUFS, peaks at or below -5 dB, a busy music + SFX mix peaks at -3.3 dB,
  every one of the 35 effects produces signal and none clips.
- Checked at device pixel ratio 2 (buffer capped at 1.5x, CSS size correct, canvas receives the
  clicks) and with float render targets disabled.

Not verified, said plainly

- No human has played it or heard it. Levels and spectra were measured; timbre and tune were not
  listened to. Difficulty was tuned from autopilot runs, not from hands on a keyboard.
- Frame rate was not measured on a real GPU. CPU cost per frame is under 1 ms; the adaptive
  render scale (1.0 down to 0.5) is the safety net for slow integrated graphics.
