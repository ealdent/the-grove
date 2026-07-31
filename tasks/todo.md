# Task: Rail Shooter gallery section

## Task packet

Goal: Add a Rail Shooter tile to the root hub, build `rail-shooter/index.html` as a gallery
(filterable by model and provider like `tower-def/` and `svg-forest/`), and include
`rail-shooter/redline-ascent/index.html` with its model listed as "Multiple".

Paths:

- `index.html` (root hub tile)
- `rail-shooter/index.html` (gallery)
- `rail-shooter/redline-ascent/index.html` (game, self-contained build)
- Pre-staged game files: `rail-shooter/fable-5-ultra-rail-shooter.html` (ACTIAS),
  `rail-shooter/gpt-5.6-sol-ultra-rail-shooter.html` (GILDWAKE),
  `rail-shooter/opus-5-ultra-rail-shooter.html` (WEFTRUNNER)

Constraints:

- Gallery must be filterable by model and model provider (same dropdown mechanics as tower-def).
- Design should be a showpiece: innovative web techniques, rail-shooter appropriate.
- Redline Ascent is a multi-model build: `data-model="Multiple"`, provider `other`.

## Review (done)

- Root `index.html`: new `.badge-rail` theme (red ember, pulse animation) + tile with
  `images/icons/beacon.png`, linking `rail-shooter/`, placed after Tower Defense.
- `rail-shooter/redline-ascent/index.html`: copied the fully self-contained 2.9 MB build from
  `arcade/redline-ascent/index.html` (no external asset refs; verified boots standalone).
- `rail-shooter/index.html`: cockpit/HUD mission-select design —
  - Canvas warp-tunnel starfield; vanishing point drifts with the pointer.
  - CSS 3D "rail" floor (perspective grid scrolling toward viewer, amber center rails).
  - Custom crosshair cursor (lerped, mix-blend difference, target-lock state, HUD coords).
  - Cards: pointer-tracked 3D tilt with layered inner parallax (`preserve-3d`, per-layer
    `translateZ`), specular sheen, animated conic-gradient border via `@property --spin`,
    per-card `--accent` colors matching the arcade accents.
  - Chromatic-aberration glitch title, scanlines, vignette, HUD corner brackets, live status
    strip (sortie/provider counts computed from DOM).
  - Staggered card entrance via IntersectionObserver.
  - Provider/model dropdown filters ported from tower-def (logos, counts, Escape/close).
  - `prefers-reduced-motion`: static starfield, no tilt/crosshair/glitch; touch devices skip
    custom cursor and tilt.
- Cards: ACTIAS (Anthropic, Fable 5, Ultra), GILDWAKE (OpenAI, GPT-5.6 Sol, Ultra),
  WEFTRUNNER (Anthropic, Opus 5, Ultra), Redline Ascent (Other, Multiple).

## Proof

- Served locally (`python3 -m http.server`); all routes 200: `/`, `/rail-shooter/`,
  `/rail-shooter/redline-ascent/`, all three game HTML files.
- Headless Chrome screenshots: root hub tile renders; gallery renders fully revealed with all
  four cards; redline-ascent boots to its title screen.
- `--dump-dom` verified filter JS ran: status strip "4 Sorties / 3 Providers"; provider menu
  (all, anthropic, openai, other); model menu (all, Fable 5, GPT-5.6 Sol, Opus 5, Multiple).
- Small-screen layout: headless Chrome clamps innerWidth to 500 px, so sub-480 rules were
  verified via a debug copy with widened breakpoints — title fits (h1 shrunk to 1.75rem at
  ≤480px), filters stack, HUD tags hide; single-column rule applies at true ≤480px.
