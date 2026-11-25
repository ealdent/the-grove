# Silva Machinarum: short-story benchmark index

Request (2026-11-22): a new index, "Silva Machinarum", for Jason's short-story
benchmark (an immortal woman on a generation ship). First entry: Gemini 4 Neon,
High. Pages are named `{model}-{version}-{effort}-silva-machinarum.html`. The
benchmark prompt must not appear anywhere on the site. Shader-driven, vibrant,
artistic; commit and push to origin/main when done.

## Plan

- [x] Read the hub, the four benchmark indexes and `tasks/lessons.md` for conventions
- [x] Copy the story in unchanged as `silva-machinarum/gemini-4-neon-high-silva-machinarum.html`
- [x] Build `silva-machinarum/index.html`
  - [x] Fixed WebGL2 scene: a gilt-framed "tunnel book" of forest rings, flown
        through on scroll into a treeline under a star-sown sky with the pale world ahead
  - [x] Gilded title lit in real time (canvas glyph mask to height map)
  - [x] Story leaves catalogued by incipit, each with a gilded initial (one shared GL context)
  - [x] Closing scene: the world risen over the wood
  - [x] Pause control, reduced motion, blur pause, no-WebGL fallback, 60 fps cap, adaptive resolution
- [x] Hub badge (alphabetical: after Shaders) and README section
- [x] Share card image and Open Graph / X tags
- [x] Verify: Chromium, Firefox and Mobile Safari, desktop and phone widths, DPR 2, console clean, frame cost
- [x] Commit and push

## What was built

`silva-machinarum/index.html` is one file with no dependencies beyond two Google
Fonts (Fraunces, Michroma).

- **Scene** (`fs-scene`, one fullscreen fragment shader on a fixed canvas). Seven
  paper "leaves" at increasing depth, each an annulus whose inner edge is a ring
  of tree silhouettes built from 2D signed distances. Four are flown through; the
  last three become the treeline the page settles among. Scroll drives the camera:
  `p` (0 to 1 over the pinned stage) is the flight, `e` is how far the closing
  section has come into view. The same shader draws the gilt frame, the sown page
  around it, the sky, the planet, fireflies, lamps and one small figure.
- **Gilding.** The title and each story's initial are drawn to a 2D canvas, blurred
  twice with the `shadowBlur` trick (works in Safari, unlike `ctx.filter`), packed
  into RGB and lit in the shader as a height map under one moving lamp (the
  pointer, or a slow orbit when idle). Initials share a second, offscreen context
  and are copied into per-story 2D canvases, so the count of stories never
  touches the WebGL context limit.
- **Page.** Stories are catalogued by their opening words. Clicking one covers
  the page in that story's own paper colour (`data-paper`) before navigating.
  Roman numerals, the tally and each link's accessible name are filled in by
  script; a maker filter appears at six or more stories.
- **The prompt is not on the site.** The colophon states the premise in one
  sentence of its own and nothing of the brief's wording or craft instructions.

## Adding a story

1. Save the model's page as `silva-machinarum/{model}-{version}-{effort}-silva-machinarum.html`, unchanged.
2. Copy the `<li>` in `#folios`, keeping file-name order. Set `href`,
   `data-provider`, `data-model`, `data-effort`, `data-paper` (the story page's
   background), `--ground` / `--ground2` / `--accent` (borrow the story page's
   own palette), the title, the opening sentence with its first letter in
   `.cap`, and the word count. When that first letter only begins a word
   ("Every"), put the rest of the word in `.lead` so it is set in capitals
   after the initial; a ship's name the story italicises goes in `<em>`.
   Update the static numerals and the "Five stories" fallback text too (the
   script overwrites both, but they are what shows without it).
3. Add the README line by hand under "Silva Machinarum", in the same order.

## Stories

- 2026-11-22: *The Graft*, Gemini 4 Neon, High (2,110 words).
- 2026-11-23: *The Arithmetic of Shedding Skin*, Gemini 4 Carbon, High
  (1,324 words). Its paper is near-black (`#090c0f`), so the click wipe reads
  as the lights going out. Its 23-word opening sentence and long title were
  the first to stretch a tile, which led to three layout changes:
  - Tiles in one row share their three bands through CSS subgrid, so header
    rules, initials and feet line up whatever the title lengths.
  - The initial sits level with the first line of a long opening (and stays
    centred beside a short one); `text-box: trim-both cap alphabetic` makes
    the frame meet the capitals exactly.
  - `.lead` and upright `<em>` inside the italic line, as above.
  Checked in headless Chrome 158 (1920, 1440, 1024, 820, 390 and 320 px wide;
  hover, click-through, Back, keyboard focus, no WebGL, reduced motion),
  Firefox 160, and Mobile Safari 26.5 in the iPhone 17 simulator (phone width,
  and a 1100 px layout viewport for the two-column case).
- 2026-11-23: *Reclamation*, Fable 5.2, Medium (1,061 words).
- 2026-11-25: *Later*, Opus 5.5, Max (1,000 words). Taken byte for byte from
  its claude.ai artifact; last in file-name order, so leaf IV. Its initial is
  grounded in the story's painted blue over its soil-dark paper, and the
  horizon turns the real planet's rust on hover.
- 2026-11-25: *The Ambering*, Gemini 4 Argon, High (1,000 words). Second in
  file-name order (leaf II), grounded in cerium-amber (`#7a4b1e` / `#281508`)
  with a warm honey horizon (`#e5b363`) over obsidian-parchment (`#0d0907`).

## Verification (2026-11-23)

- Headless Chrome 158 on the real GPU (`tmp/silva/shot.mjs`, gitignored): hero,
  nine moments of the flight, reading and closing states at 1280x800; hero at
  eight viewports from 1920x1080 to 844x390; phone at 390x844 DPR 2 with no
  horizontal overflow; console clean throughout.
- Behaviour: 60.5 rAF/s with the loop running; pause button holds and resumes
  time; a synthetic blur stops the clock; wheel scroll moves `p`; hover sets the
  accent; click runs the paper wipe and lands on the story; Back returns with
  the wipe cleared and scroll restored; the "Into the wood" glide reaches
  `#leaves` and moves focus there.
- Reduced motion: no flight, a dip to dark between the two poses, loop idle.
- No WebGL (context creation stubbed): plain gold type, CSS roundel, flat
  initials. Context loss and restore both handled.
- Frame cost: 1.0 to 1.5 ms at 2048x1536 on the M5 Pro (Browser pane), 4.2 ms at
  2560x1600 in headless Chrome.
- Firefox 159 (WebDriver BiDi, `tmp/silva/ff.mjs`) and Mobile Safari 26.5 in the
  iPhone 17 simulator: scene compiles and renders the same, no errors.

## Not verified

- A real phone. The simulator proves WebKit compiles and lays the page out, not
  what an iPhone or a mid-range Android GPU costs; the page starts at full
  resolution, probes once, and steps its resolution down if frames run long.
- The share card on X itself. Tags follow the P(DOOM) set that is known to work
  there, minus the video.
