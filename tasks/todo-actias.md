# ACTIAS — Space Harrier descendant (arcade/actias.html)

## The world (locked before code)

**ACTIAS** — You are the last luna moth, on the seventh night of her life.
Luna moths live seven nights and have no mouths; they cannot stop, cannot eat,
they fly for one thing only. The ancient moon-road every moth once flew is
drowned in electric glare — porch lights, bug zappers, sodium streetlamps, and
a lighthouse whose lamp claims to be the Moon. She carries the Moon's last
thread of silver dust and snuffs the lying lights one by one. If she stops,
the Glare takes her like it took all the others.

One-sentence pitch: *a rail shooter where the last luna moth flies the drowned
moon-road at night, extinguishing the electric lights that lie to moths, until
the lighthouse itself unscrews its lamp and fights back as a false moon.*

- **Stages (nights):** I — The Meadow (grass heads, foxgloves, orb-weaver webs,
  fireflies, bats) · II — The Powerline Road (telegraph poles, sagging catenary
  wires, searing streetlamp cones, bug zappers, arc-eels, june beetles) ·
  III — The Lighthouse Shore (moonlit water, pier pilings, wrecked masts,
  sweeping lighthouse beam) → **BOSS: VESPER, THE FALSE MOON** (the lamp itself,
  ringed by burned moths; tell-based patterns, vent-window weak point, 2 phases).
  Then the road loops — Night IV, V, VI… with deeper palettes and more speed.
- **Environmental storytelling:** stars thin out under the light-pollution dome
  in Night II; crickets fade from the mix; the ground itself becomes the
  glittering moon-path on water in Night III.
- **Audio (all Web Audio, procedural):** music-box/celesta nocturne in D minor
  pentatonic over warm pads and a slow heart-pulse; procedural crickets, owl,
  buoy bell; the villain leitmotif is a 60 Hz mains hum, deliberately out of
  key. Shots are in-key celesta grace notes; kills are bulb-pops with a
  power-down whine.

## Build checklist

- [x] Read lessons.md + memory refs (headless verify, canvas profiling, DPR 2,
      git signing/push quirks)
- [x] `arcade/actias.html` — single self-contained file, no CDN, canvas 2D with
      hand-built projection pipeline (117 KB, zero external requests)
  - [x] Projection + camera-follow + fog (moon-haze) + ground streaming
  - [x] Player moth: flap cycle, banking, procedural hindwing tail streamers
        (loses one when wounded), dust wake, wing-tatter damage states,
        mouse **and** WASD/arrow control
  - [x] Enemy roster: cinder chains, pyralids (burned moths), bats with
        echolocation-ring tells, bug zappers (radial + aimed bolts), june
        beetles (telegraphed chargers), arc-eels (serpents), ember swarms
  - [x] Obstacles: grass heads, foxgloves, web gates (thread the gap for +300),
        telegraph poles, catenary wires (over/under), searing lamp cones
        (snuffable heads, poles remain), pilings, masts, rocks, beacon sweep
  - [x] Director: per-night timelines, scripted set-pieces, intensity ramp,
        graze rewards, streak multiplier, chain-snuff bonus
  - [x] Boss VESPER: intro card, twin sweep/filament lash/moth tithe/strobe
        ring patterns w/ audible+visible tells, vent crit windows, phase 2 at
        half health, glass-crack damage states, slow-mo shatter → Moon brightens,
        heal + Night IV onward
  - [x] Juice: screenshake, hitstop, slow-mo death, muzzle glow, popups,
        damage flash+vignette, palette crossfades per night (incl. Night VII
        violet), adaptive DPR ladder
  - [x] Screens: title (attract mode), night cards, pause, game over w/ stats,
        instant restart; mute persisted; auto-pause on blur/hidden tab
  - [x] Debug handle `window.ACTIAS` + hash params (#play/#stage2/#stage3/#boss)
- [x] Verify (see below)
- [x] Tile in `arcade/index.html` (card-actias, ☾ icon, pale luna green, first slot)
- [x] Commit (signed) + push

## Review

Changed:
- `arcade/actias.html` (new, 2,560 lines): complete game.
- `arcade/index.html`: ACTIAS card + hover theme.
- `.claude/launch.json`: additive `grove-root-alt` entry on port 8003 (8002 was
  held by another session's server).

Proof:
- `node --check` on extracted script: clean.
- Deterministic headless suite (game + injected driver, Chrome headless,
  `window.ACTIAS.step`): **17/17 PASS** — boot→title, begin→play, onboarding
  spawns, autofire kills, playerHit/hp, 70 s piloted stress run (no NaN,
  objects bounded ≤21, 48 kills, night 1→2 transition), boss spawn → pattern
  loop → death in 158 damage steps → night IV stage 0, player death → dying →
  game over → instant restart, pause overlay, every stage render path
  exception-free.
- Headless screenshots at DPR 1 and DPR 2 (1440×900): title, meadow, powerline
  road, lighthouse shore, boss — layout identical across DPR (no replaced-
  element/sizing bug).
- Real browser via `grove-root-alt` (port 8003): zero console errors after a
  full interaction pass; dispatched-key tests: Enter starts, P pause/unpause,
  M mute/unmute, held D moves +6.3 world units; AudioContext constructed on
  key handler.
- Perf: 120 full update+draw frames averaged **0.36 ms/frame** at a 1600×1200
  buffer (async-skewed optimistic, but ~45× headroom on 16.7 ms); adaptive DPR
  ladder remains as backstop.

Not verified:
- Audible sound output (requires a real user gesture; AC.resume() sits inside
  the keydown/mousedown handlers, the canonical unlock — but no speaker-level
  proof headlessly).
- Sustained real-GPU frame pacing on a weaker machine (adaptive resolution
  ladder is the mitigation).

Risks:
- Fonts: logo/cards use Didot/Bodoni with Georgia fallback — Windows renders
  Georgia (still fine, less couture).
- Balance is tuned by construction + autopilot runs, not human playtesting;
  night VII+ difficulty is extrapolated scaling.

Next (optional ideas, not started): gamepad support, a second boss for loop 2,
touch controls for mobile.
