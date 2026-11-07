# Shader pages: bring every demo up to the Signal Swell standard

Request (2026-11-07): every page in `shaders/` should conform to the latest
standards (back link to the shaders page, etc.), gain a Download that hands over
the shader with the settings on screen, and ship it under the MIT License.
Signal Swell (`shaders/signal-swell-shader-demo.html`, experiment 07) is the
gold standard; read it end to end before changing a page.

Out of scope: palette pickers and dark modes for pages that don't have one
(those are Signal Swell features, not page standards), the gallery
(`shaders/index.html`), and any change to how an effect looks.

## Audit (before)

| Page | Back link | Download + MIT | `?pin=` + `__demo` | Notes |
| --- | --- | --- | --- | --- |
| archive-ember | no | no | no | full-screen fragment shader; Restart button |
| holographic-formula-drift | no | no | `?t=`, `?seed=` only | border around a table card; theme toggle; title lacks descriptor |
| greenhouse-vines | no | no | no | border around a panel; duplicate `<body>` tag; shader must stay identical to `greenhouse-todo/ui-vines.js` apart from the demo knobs |
| typewriter-letter-drift | no | no | no | border around a card; Google Fonts atlas; shader shared with `learn/index.html` |
| blood-splat-submit | no | no | `?pin=` (age) + partial `__demo` | overlay on a real submit button; theme toggle; `error` handler rewrites `document.title` (debug leftover) |
| stillroom-shaft | yes | no | yes | full-screen fragment shader |
| signal-swell | yes | yes | yes | the reference |

## The standard

### Page chrome
- `<meta name="theme-color">` set to the page background (kept in step with a
  theme toggle where the page has one).
- `<title>Name — Descriptor</title>`; the `<h1>` is the experiment's name as the
  gallery card writes it (Title Case).
- Back link `<a class="back" href="./">&larr; shaders</a>`, fixed top-right,
  styled like Signal Swell's `.back` (mono 0.72rem, letter-spacing .08em, muted,
  ink on hover, `top/right: clamp(16px, 2.6vw, 28px)`, above the page content) in
  the page's own colours. It must not collide with the heading or controls at
  375px wide.
- Controls panel: buttons sit in `.actions`, Pause first, Download last.
  Download is `<button id="download" class="action download" type="button"
  title="Download this …, set the way it is now, as a page of its own">` with
  Signal Swell's arrow SVG, a shade bolder than Pause, in the page's accent.
- WebGL fallback stays; reduced motion still starts paused.
- `?pin=<seconds>` opens paused at that moment. `window.__demo` exposes at
  least `engine`, `pin(t)`, `step(dt, n)`, `draw` and `download` (the file the
  button would hand over, without saving it). Existing params keep working.
- No debug leftovers in the served page.

### Engine
- `const SOURCE = (document.currentScript || {}).textContent || "";` at the top
  of the page script (classic script, not a module).
- The script is cut into banner-marked sections in Signal Swell's style
  (`/* ---------------- name ---------------- */`): the scene (constants,
  helpers, GLSL), then `engine`, then page-only sections (UI wiring, theme,
  download), then `download page` last.
- `engine` holds `createX(target, options)` plus `X_DEFAULTS`. It looks up
  nothing on the page by id and reads no page CSS; it owns its canvas sizing
  (CSS-sized, DPR capped at 2), rests while paused-and-settled, hidden, or
  scrolled out of sight, holds still under reduced motion, returns `null`
  without WebGL and throws on a compile error. It returns a controller:
  `settings` (a copy), `set(changes, instant)`, `paused`, `time`, `draw()`,
  `destroy()`, plus any verbs the effect needs (`restart`, `regrow`, `reseed`,
  `splat`).
  - Full-screen shaders: hand it a canvas and it draws into it; hand it any
    other element and it fills it from behind its content (Signal Swell's
    `own` canvas pattern).
  - Border effects: hand it the element to frame; it adds its own canvas
    around (or over) that element and tracks the element's size.
  - Blood Splat: hand it the submit button; it overlays the spatter and runs
    the splat/dry/flake/re-enable lifecycle.
- The demo page drives the engine from its panel. Refactoring must not change
  a single pixel at the same moment and settings.

### Download
- `buildDownload(source, look)` lives in `/* ---------------- download page
  ----------------`, touches nothing on the page, and carries the scene and
  engine sections verbatim (`sourceBetween` as in Signal Swell).
- The file: `<!doctype html>`, then a header comment (`<\!--` inside the page
  script): what the effect is in a sentence or two; the notice; "Set the way you
  left it: …"; "From <url>" when served over http(s); how to open it and where
  the settings live; how to run it on a page of your own (copy the first two
  scripts, a short example); the controller API; what happens without WebGL.
- Then a minimal page (theme-color, `<title>Name · Variant</title>`, a few lines
  of CSS, the target element: a canvas for full-screen shaders, a small demo
  card/form for the others) and exactly three scripts: the settings object
  (`const ARCHIVE_EMBER = { … }`, one aligned `// comment` per key saying what
  it does and its range), the engine (`window.ArchiveEmber = (() => { "use
  strict"; … return createX; })();`, first line `// Name. <notice>`), and the
  start call with a no-WebGL message.
- Notice, word for word: `Copyright (c) 2026 Jason Adams. Released under the MIT
  License: https://opensource.org/license/mit`.
- File name: `<slug>.html`, or `<slug>-<theme>.html` where the page has a
  theme. Slugs: archive-ember, holographic-formula-drift, greenhouse-vines,
  typewriter-letter-drift, blood-splat-submit, stillroom-shaft.
- Inside the page script, write `<\/script>` and `<\!--`.

### Tests
`tests/<slug>-download.test.mjs`, modelled on
`tests/signal-swell-download.test.mjs`: the download is one page whose three
scripts parse and whose name is right; it carries the settings on screen; its
engine is the demo's own sections verbatim and carries no page-only names; the
MIT notice heads the file and the engine. Run with `node --test`.

### Proof per page
- `node --test tests/*-download.test.mjs tests/signal-swell-*.test.mjs` passes.
- Headless Chrome: no console errors; the page at defaults under reduced motion
  matches `git show HEAD:<page>` pixel for pixel (or within frame dither);
  the downloaded file at non-default settings and a pinned moment matches the
  page at the same settings and moment (UI hidden); the download renders on its
  own with no errors.
- 375px wide: back link, heading and controls don't collide.

## Progress
- [ ] archive-ember
- [ ] holographic-formula-drift
- [ ] greenhouse-vines
- [ ] typewriter-letter-drift
- [ ] blood-splat-submit
- [ ] stillroom-shaft
- [ ] WebKit check in the Browser pane
- [ ] commit + push each page
