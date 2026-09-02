# Knotside — first-person SVG exploration (Fable 5.1, max effort)

Deliverable: `svg-forest/fable-5.1-max-svg-forest.html` (single file, pure SVG rendering, no canvas/WebGL/images)
+ tile in `svg-forest/index.html` (between "Fable 5" and "Fugu", model "Fable 5.1", effort "Max"). Commit + push to main.

## Plan

- [x] Read tile format, memory notes (headless verify, signing, push sandbox, concurrent staging)
- [x] Lore bible (below)
- [x] Shell: CSS, HTML overlays (title card, caption, HUD, two joysticks), single `<svg>` root
- [x] Projection core: camera (x, z, yaw, pitch, eye height), near-plane clipping, ground-plane + sky-direction projection
- [x] Sky: gradient, warp threads, star-knots, floats (dye ribbons), the Idle Shuttle (sun) trailing its weft
- [x] Ground: gradient, perspective-correct warp/weft thread quads (2 paths, gradient-stroke fog), dye patches
- [x] Props as `<defs>` groups + `<use>` with `currentColor` dye: spindle trees, needle stones, knot-hills,
      dropped stitches, tassel grass, satin flowers, Mender's cairns, hanging ends
- [x] Creatures: shuttlewrens (flocks, trailing thread), bobbin beetles (roll, unspool a trail on the cloth)
- [x] Chunked world (14u chunks, radius 4, hash-seeded, biome noise), node pool, painter's sort with minimal DOM moves
- [x] Movement: WASD/arrows (+Q/E strafe, Shift run), drag-look (mouse + touch), joysticks (pointer capture, multitouch),
      soft collision with big props, head-bob (vertical + sway + eye-height modulation)
- [x] Lore captions on approaching landmarks; HUD row counter
- [x] Mobile hardening: touch-action none, no pinch/pull-to-refresh/swipe-nav, dvh sizing, safe-area insets
- [x] Debug API `window.__knotside` + `?seed=&x=&z=&yaw=&t=&nointro=1` for deterministic headless shots
- [x] Verify: headless Chrome screenshots (desktop, DPR2, portrait), Browser pane 390px multitouch simulation, perf timing
- [x] Add tile to index.html (new `.badge--knot` colour pair)
- [x] Commit (signed), push (sandbox off)

## Lore bible

**Premise.** The world is a tapestry. The Weaver — the *Ravelwife* — wove the *Fair Face* for seven ages:
mountains, seas, cities, the faces of everyone who would ever live. Then she set the shuttle down and slept.
The Loom did not stop. Every day the *Idle Shuttle* still crosses the sky, laying one more row of weft.

Nobody has ever seen the Fair Face. Everything that lives, lives on the **Knotside** — the back of the cloth —
among tied-off ends, floated threads, carried colours and knots. *Every beauty on the Fair Face is a knot on the
Knotside.* A mountain on the front is a tangle back here. A river is a long float of indigo hanging in the sky.

**The player** is a **Mender**: one of the folk who walk the Knotside tying off what comes loose. The Menders'
creed: *"We cannot see the picture. We can keep it from coming apart."* The game is a walk with no end, because
the cloth has no end: the Loom lays new rows faster than anyone can cross them.

**Landscape (props).**
- *Spindle trees* — the Ravelwife planted her spindles where she set colour aside; the wound thread still holds the dye.
- *Needle stones* — great leaning needles left standing where the sisters last worked, thread still through the eye,
  sagging to the ground. Menders carve sayings into them.
- *Knot-hills* — tangles the size of houses. Each one is something beautiful on the other side.
- *Dropped stitches* — holes in the cloth. Light from the Fair Face leaks up through them: a colour with no dye.
  Menders do not mend them; a Mender who looks through one sees what they look like on the front.
- *Hanging ends* — loose threads that come down out of the sky and knot into the ground. Left by the Weaver, never cut.
- *Tassel grass, satin flowers* — small embroidery on the back: the places where the front was worked most finely.
- *Menders' cairns* — stacked empty spools with a lamp, marking a day's mending.

**Creatures.**
- *Shuttlewrens* — small birds shaped like shuttles. They fly in loops and trail one thread; a flock stitches the air.
- *Bobbin beetles* — spools on legs that roll across the cloth, unspooling a coloured line behind them.

**Sky.** Dusk that never ends on the Knotside: the warp shows through as faint vertical threads; long *floats* of dye
hang across the sky like slack aurora; knots of thread stand where stars would be. The Idle Shuttle circles the horizon
at a hand's height, trailing today's weft.

**Palette (natural dyes).** undyed linen `#e8d9bd`, madder `#a4373a`, cochineal `#b03050`, indigo `#243560`,
woad `#5c7fa6`, weld `#d9b44a`, verdigris `#5f8250`, walnut `#5a4130`.

## Review (2026-09-02)

**Changed.** New `svg-forest/fable-5.1-max-svg-forest.html` (~67 KB, one file, no deps, pure SVG). Tile + `.badge--knot`
colour pair in `svg-forest/index.html` between Fable 5 and Fugu. Lesson added to `tasks/lessons.md`.

**Proof.**
- Headless Chrome (classic `--headless --screenshot`) frames: spawn vista, Idle Shuttle view (`?yaw=118&t=100`),
  title card, dropped-stitch close-up, cairn close-up, index page with the new tile in its alphabetical slot.
- Browser pane, `__knotside.step()` driven (rAF is paused in the pane): W+D for 120 frames → yaw 212°, walked 8.0 u
  (spec: 1.85 rad/s, 4 u/s); W only → +8.0 u along the 212° heading. Drag 100 px right → +10.7° yaw; 40 px up → +3.8° pitch.
  Head-bob: ground horizon oscillates 352–368 px while walking, flat when still. No console errors.
- Mobile preset 375×812: `body.touch` set, both sticks laid out in the bottom corners with safe-area insets; two
  simultaneous synthetic touch pointers (ids 1 and 2) on the sticks for 60 frames → walked 3.49 u AND yaw +115° at once;
  both sticks reset to 0 / id null on release.
- Performance (CDP script `perf.mjs`, headless=new, `--disable-gpu`, 1280×800, `?auto=1` walking + turning):
  241 rAF frames in 4.01 s = 60.2 fps, longest gap 16.8 ms, JS 0.8–0.9 ms/frame, 120–150 visible props, 81 chunks resident.
- `node --check` on the extracted script; regex sweep for canvas/WebGL/img/data-image URLs finds only the header comment.

**Not verified.** Real iOS Safari / Android Chrome touch (only emulated pointer events); GPU-composited paint cost on a
low-end phone (headless software raster held 60 fps, which is the conservative case for CPU but not for mobile GPUs).

**Risks.** Group `opacity` on fogged props forces offscreen compositing (~half the visible set); if a phone struggles,
lower `CFG.far` or fade with fewer steps. Knot-hill symbols are the heaviest (20+ stroked curves each).
