# LONG SHADOW — design + plan

Arcade game for `arcade/long-shadow/` (Opus 5.5). Branch `wt/arcade-game-novel-style-127b7a`.

## The style: heliotropic arcade

Your weapon is your own cast shadow, and the sun is moving. Real sun geometry sets the
shadow's direction and reach: long and fixed at dawn and dusk, short and nimble at noon,
gone entirely when the sun is overhead. Each level is one compressed day at a different
place on Earth, so the sun's path itself is the level design.

Prior art checked (2026-11-25): shadows-as-safe-zones survival ("Shadows Belong to the Sun"),
playing *as* a shadow (A Shadow's Tale, Lost in Shadow), lantern-cast enemy shadows you cut
(SHADOWLESS jam), stepping on enemy shadows. Nothing found where your own sun-cast shadow is
the blade with physical reach/direction rules, and nothing ends each level by developing the
day's shadow history as a cyanotype print.

### Rules that fall out of the physics
- **Sun at your back.** The shadow can only reach downsun. Sparks are shed by the sun, so
  they arrive from the side you can't hit. Let them pass, then cut them down.
- **Aim = tilt the pole.** The mouse marks where the shadow tip should go; the pole tilts to
  get it as close as the sun allows (IK over tilt angle). At noon that is almost a circle
  around you; at dusk a long lance with a narrow sweep.
- **Jump = shadow lunge.** In the air your whole shadow slides downsun by height/tan(elev).
  At dusk a jump throws it across the field; at noon it barely moves. Also dodges.
- **Shade is shelter.** Lamp posts, trees and houses cast moving shade. Sparks die in any
  shade; standing in someone else's shade cools your heat.
- **High sun = rain.** When the sun is high, sparks fall from overhead onto telegraphed rings
  instead of streaming in from the horizon edge.

## Art direction: a print made by the sun
- Top-down field on warm paper; shadows in Prussian-blue ink with paper grain showing through.
  Tiny top-down figures, big expressive side-profile shadows ("the shadows are the characters").
- Paper tint follows the day: rose dawn, bleached noon, amber dusk, indigo night.
- Sparks are the only hot colour (gold/orange, additive glow).
- The paper keeps an exposure buffer all day. At night it is developed into a **cyanotype
  plate**: blue where the sun hit, white ghost trails wherever shadows lay (lamp posts leave
  sundial fans, you leave your dance). Plates collect in an album; download as PNG.
- Type: IM Fell English (old letterpress). Generated art: title key art, owl portrait,
  silhouette sheets for shadow casters, a vignette per day, ending art.

## Lore (shallow, shown not told)
- The sun has a fever. By day it sheds sparks that burn what they touch but die in shade.
- A spark that dies in shade cools into a blue cinder and rises. At night the cinders are the
  stars. (The player sees it happen; the owl confirms it in one line.)
- The lamplighter (old, silent, they/them) is the last of many. Each dusk they light the lamps;
  each night the day's sparks hang in the sky.
- They walk toward the eclipse, because "fevers break in the dark."
- Ending: at totality every star you ever hung shines at noon, the sun goes quiet, the
  lamplighter lifts the pole one last time and becomes a constellation. The owl takes the pole.
  "Good morning."

Companion: a small, sleep-deprived owl who rides the lamplighter's hat and speaks in very
short lines. It is the only narrator (about 30 lines in the whole game).

## Storyboard (7 days)
| Day | Place / sun | New thing | Owl beat |
|---|---|---|---|
| I | Meadow, spring, E→S→W, peak 55° | Glints, then Sundogs; lamps; lamplighting at dusk | "Shade puts them out. Use yours." / "Keep the sun at your back." / night: "Where'd you think stars came from?" "…Good morning." |
| II | Snowfield, deep winter, peak 12° | Long lance all day; Flares (hold shade, burst into glints) | night: "There were hundreds of lamplighters, once." "Now there's you." |
| III | Salt flat, equator, sun passes overhead | Shadowless noon (survive with no weapon); Lenses (burning-glass spots) | night: "The sun's got a fever." "Fevers break in the dark. That's where we're going." |
| IV | Midnight sun, arctic summer, sun circles 360° | Shadow rotates all the way round; sundog packs; no night | dusk: "No night here. Hang them anyway." |
| V | Town, late summer | Houses cast a moving maze of shade; window glints throw sweeping beams | night: "You're slower than yesterday." "…Me too." |
| VI | The long hill, autumn | Hardest waves; huge dusk surge | night: "Who hangs the stars after you?" "Don't answer that." |
| VII | Eclipse | Moon bites the sun, light dims, crescent sun-spots under trees, frenzy; totality sweeps the field dark, all sparks die, every star of the run appears at noon | "Look up." → ending → "Good morning." |

Within a day: dawn trickle → morning build → noon squeeze (short shadows, rain from above)
→ afternoon build → dusk surge (huge shadow, power fantasy) → sunset (sparks fizzle) →
lamplighting (pole flame, touch lamps, chimes) → night (stars rise, owl) → plate.

## Audio
- Procedural adaptive day score in WebAudio (D major/modal, pad + kalimba plucks + bass +
  soft pulse), intensity from threat and time of day; kill notes are bells chosen from the
  current chord so they always harmonise; capped voices.
- Generated (ElevenLabs via local-api-mcp): title/night lullaby, eclipse/ending cue, ambience
  loops (dawn birds, cicadas, crickets, winter wind), owl hoot.

## Plan
- [ ] Generate art (Higgsfield): key art, owl, silhouette sheets, 7 vignettes, ending
- [ ] Engine: canvas layers, sun model, shadow casters (affine silhouettes + boxes), IK pole aim
- [ ] Sparks + kills + cinders + heat/lives + scoring
- [ ] Day structure: phases, waves, sunset, lamplighting, night stars, plate
- [ ] Days I–VII content and special mechanics
- [ ] Dialogue system + owl lines
- [ ] Audio: procedural score + SFX + generated tracks
- [ ] Title, pause, album, mobile touch, blur pause, debug hooks
- [ ] Verify: headless/CDP playthrough, perf, console clean, phone viewport
- [ ] Arcade tile + README line, storyboard images, PR
