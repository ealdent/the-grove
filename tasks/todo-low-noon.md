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
- [ ] Independent review pass, fix findings
- [ ] Index tile, commit, push to main

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

(filled in at the end)
