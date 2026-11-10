# LOW NOON — pure-SVG first-person exploration game (Fable 5.2, max effort)

Deliverable: `svg-forest/fable-5.2-max-svg-forest.html` + a tile in `svg-forest/index.html`
(sorted alphabetically by model). No peeking at the other games in `svg-forest/` until this one
is finished.

## Lore (written before any design)

The sea that died here left its salt and waited. The moon had gone first, and a sea with nothing
to follow lies still. Then the Meridian Order raised a stone on the salt to count the hours, and
the sea came up into its shadow. **Shade is water here.** A hand deep at noon, when the sun stands
over the plain like a lid; a canal by afternoon; an ocean by night, when all the world is shade.

The Order raised ten thousand gnomons to give the sea room. They farmed the canals, bred koi that
knew the hours, and learned from the herons how to walk with the shade. Around their dials they
planted hour-lilies: twelve basins, and the lily under the shadow opens. That is how the hour is
kept.

Then they built one stone too tall. Its shadow reached the horizon and did not come back at noon,
and one evening the Order walked into the long shade and went down with the tide. The gnomons
still stand. The sea still tells the time.

You walk the dial through one whole turning. Stand by an open lily and its hour is kept; the
mark for it lights on the sun's road across the sky. Keep all twelve and the night tide does not
stop at the horizon.

Twelve hours (name + the line read when it is kept): Kindling, Long Water, the Herons' Hour,
Shortening, the Narrow Hour, the Gathering, Low Noon, the Turning, Lengthening, Gold Water,
the Great Shade, Evenfall. Night is the Deep.

## World rules that drive the engine

- Sun follows a real diurnal arc (latitude 35°, declination +13°); a whole day takes 5 minutes.
- Every gnomon's shadow is the affine image of its silhouette on the ground: one water path,
  nonzero fill, holes wound backwards (pierced stones and rings cast islands of light).
- Koi, lily pads and herons live in shadow-local coordinates, so they ride the shade as it sweeps
  and crowd to the stone at noon.
- Night: flood. The plain becomes one mirror sea (stars reflected), koi glow and roam free.
- Stones are two-facet billboards lit by the actual sun direction, so the lit side always faces
  the sun and stones go to silhouette against a low sun.

## Plan

- [x] Review notes (naming, tile format, perf lessons), pick the model label (Fable 5.2 / Max)
- [x] Lore + world rules
- [x] Engine: projection with lens-shift pitch, day cycle, sky (gradient, sun, stars, sky dial,
      clouds, ranges), ground (salt gradient, crack network), shadow water, koi, ripples
- [x] Sprites: gnomon kinds (needle, eye stele, stack, ring, blade, gate, stump), lily cups,
      sun-cups, herons (standing and in flight), beacons, great gnomons; pooled `<use>`, LIS
      reorder, fog/light vars
- [x] Input: WASD/arrows, drag look, two multitouch joysticks, browser-gesture guards
- [x] Game: head-bob, wading, keeping hours, sky marks, the Deep finale, HUD + intro
- [x] Adaptive quality, debug hook, URL params
- [x] Verify: desktop + phone portrait/landscape, real multitouch, fps, console clean
- [x] Independent review pass, fix findings
- [x] Index tile, commit, push to main

## Pause

Jason paused the work from 15:58 to 19:00 EST on 2026-11-09 ("pause until 7pm"). The reviewer was
stopped early for it, so its pass was partial (see Review). Work resumed at 19:04 from notes kept
here and finished the same evening.

## Changes of course while building

- First renders showed shade pools as slivers: at human eye height everything on the ground past
  15 m is a line. Three fixes, all folded into the fiction: the walker is on a keeper's stilts
  (eye 2.6 m), the sun is a high-latitude one that stands only 38 degrees up at noon (shade is
  never shorter than 1.3x a stone's height, and the title gained a second meaning), and stones
  got broader.
- Twelve hour basins became thirty-six lily cups that open when the dial's shade is actually on
  them (point-in-silhouette test), so the bloom runs round the dial as a wave and "the lily under
  the shadow" is literally true.
- Water reads as water only with a sky mirror (far stops take the horizon colour, near stops the
  depth colour) and glints placed at points sampled inside each silhouette.

## Review

**What shipped.** `svg-forest/fable-5.2-max-svg-forest.html` (one file, about 100 KB, no canvas,
WebGL or images), a `dial` tile in `svg-forest/index.html` between Fable 5.1 and Fugu, and a
README line. Sources and the test harness stay in the gitignored `tmp/low-noon/`.

**Checked by running it** (headless Chrome over CDP with real key, mouse and touch events):
- Desktop: click or Space/Enter to begin, W/S/arrows walk, A/D/arrows turn, drag look (also out
  of the window and back), right/middle buttons ignored, head-bob (eye 2.55 to 2.66 m), an hour
  kept by standing at an open lily, key release on blur and under Cmd.
- Phone portrait and landscape: tap to begin, both sticks at once (walks and turns), one thumb
  lifted while the other keeps working, a thumb sliding off a stick, touchcancel, a second finger
  ignored while one drags the sky, no page scroll or zoom.
- Layout at 320x480, 360x640, 568x320, 820x1180, 1280x720 and 2560x1080; rotation and a 1x1
  window mid-game.
- 60 fps at 1280x720 in software raster (script about 1 to 2 ms a frame) by day, dusk and night.
  Under 6x CPU throttle: 33 to 40 fps at quality 3, 54 to 59 at 1, 60 at 0; the governor steps
  3 > 2 > 1 on its own there, and 3 > 2 > 1 > 0 at 20x, without flapping.
- Rendering looked at in Chromium (headless and the app pane at 120 fps), iOS 26.5 Safari in the
  simulator, and Firefox.

**Independent review** (general-purpose agent, stopped early by the pause): 18 findings, 10
confirmed. All fixed except where noted:
1. Great Gnomons and their canals popped at super-cell borders: 5x5 super cells are loaded, the
   sprite fades in over 850 to 1080 m, the shade cap came down to 700 m.
2. Koi popped where their wrapped homes jumped (worst in the finale): fish shrink to nothing
   before the wrap; pops are now 3 to 5 px.
3. Gates blocked their opening and not their pillars, and a pillar slab swept the view inside
   one: colliders are per kind (two pillars; a row along a blade), and a plate fades out in its
   last 2 m.
4. Koi, pads and herons sat on the dry island in an eye stele's shade (27% of frames): its reach
   stops at the stem; 0% now.
5. Lily pads froze all night and jumped 12 m at dawn: they are placed every frame.
6. Keeping an hour showed one ring, not four. 7. The gold beam popped in at full strength on low
   quality. 8. An hour could be kept while the HUD named its neighbour: keeping and the beam now
   need the lily's hour to be the current one. 10. Stumps overlapped.
11. The faded intro's buttons stayed focusable (Enter could wipe the save): `inert` plus
    `visibility: hidden`. 12. Stone palettes stepped at 3 Hz in twilight: 6 Hz there at quality 2
    and 3. 13. Stuck key under Cmd. 14. Toast showing through the reopened intro. 15. Governor
    ignoring frames over 250 ms. 16. Great Gnomon cache eviction. 17. Night reflections unsorted.
    18. A fourth toast jumping the queue.
- Found while re-testing: Space on the focused Walk in button was swallowed by the game's key
  handler; the first night's reflections were all created in one frame (now five a frame);
  low quality now also draws less shade (the main cost at dusk).
- Left as it is: 9. wading rings are born at the feet, which the view never shows while walking
  forward; they now last long enough to reach the view when the walker stops or looks back.

**Not verified.** Touch input on a real phone (the simulator check covered rendering only; touch
was exercised through Chrome's emulation). Frame rate on real phones. The reviewer did not reach
its robustness list (localStorage throwing, reduced motion, heap growth over a long session); the
code handles the first two by inspection only.

## Follow-up 2026-11-09 evening: "glitchy and the screen flashes a lot" (Jason, on the deployed page in Chrome)

- **Cause, confirmed.** The gold light pillars and the herons' neck nod were CSS animations inside pooled `<use>` sprites.
  Chrome restarts such an animation whenever the `<use>` is moved in the DOM, and the depth re-sort moves sprites
  constantly while walking: 18 pillar restarts in 14 s past the first dial. Minimal test (`tmp/low-noon/usetest.mjs`):
  a moved `<use>` dropped from luminance 142 to 8; untouched and restyled ones carried on. Brightness trace of a near
  pillar under re-ordering (`beamtrace.mjs`): deployed build 7 sudden steps in 5 s, fixed build none.
- **Fix.** No CSS animation lives inside a pooled sprite any more: the pillar breathes through its per-frame opacity
  and the heron's nod is a custom property set from script.
- **Also smoothed while there:** water glints breathe in three groups instead of popping on and off; stone palettes
  refresh on staggered phases so the stones never all step at once; the sun's halo, glare, reflections and stars change
  in fine steps; the loop draws at a steady 60 to 90 fps on high-refresh screens (in Jason's 1920x929 2x window at
  120 Hz about 6% of frames were missing the 8.3 ms deadline).
- **How it got through.** Everything I had run was state or timing assertions and still screenshots, mostly in headless
  software rendering. None of that can see a flash. New harness pieces: `cast.mjs` / `cast2.mjs` / `cast3.mjs`
  (screencast of a real GPU window while playing), `flash.py`, `flicker.py`, `beamtrace.mjs`.
- **Checked after the fix:** real 120 Hz Chrome window at 1728x881 2x, walking and turning: steady 16.7 ms between
  presented frames (p95 17.8, max 18.6), no flashes; desktop, phone and landscape scenarios pass; console clean.
- **Not verified:** on Jason's own display (a 1920-wide window on a larger screen than the built-in one).
