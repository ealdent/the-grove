# Neural Cellular Automata Workbench (Learn)

Goal: add the downloaded `16_channel_webgl2_mrt_nca_workbench.html` to `/learn` and pretty it up, then commit and push.

Source check (before changes): the page runs; all three hand-wired presets converge to a fixed pattern (no drift between steps 3,000 and 3,500) and recover from the 40% hidden-state scramble within about 200 steps. Their original blurbs promise more than the screen shows: the "flux router" makes halos around pads rather than paths between them, the "Med-NCA segmenter" is a hand-wired edge-ring detector (not the Med-NCA paper), and the "truss" settles into a steady glow without forming a lattice.

Plan check-in: proceed under the user's build-and-push authorization.

- [x] Keep the GPU engine and preset weights; replace the Tailwind CDN dashboard with a self-contained stylesheet in a dark instrument style.
- [x] Fix real defects: viewport stretched on wide screens, no touch painting (`touch-action`), gappy fast strokes, inconsistent 40/45% scramble, active-brush colour, fake initial telemetry.
- [x] Add an intro, a "How it works" section (state, perception, network, weight-texture and .bin layout), and accurate preset descriptions.
- [x] Learn index tile (alphabetical, under N) and README line.
- [x] Verify in a browser: desktop and phone layouts, every display mode and preset, painting, probe, weight hover, .bin load/export, shader dialog, console, gallery tile.
- [x] Commit and push.

## Review

`learn/nca-workbench.html` keeps the original shaders and weight compiler; the only shader changes are the scramble threshold (0.45 to 0.40, matching its label) and a display-resolution brush cursor. New: drawing buffer sized to the displayed canvas (crisp cells at any DPR), stroke interpolation, guarded pointer capture plus `pointercancel`, a 4 × 4 "well plate" probe laid out by texture, a per-lane weight map with hover readout of what each weight connects, a highlighted shader dialog (step, brush, display), axis ticks, per-mode legend, and fallbacks for no WebGL2, no `EXT_color_buffer_float`, an incomplete framebuffer, shader errors and context loss.

Presets were renamed to what they visibly do (Flux halos, Boundary rings, Activator–inhibitor); keys and export file names are unchanged.

Evidence (Browser pane, real GPU): a fresh tab logged nothing to the console and `gl.getError()` stayed 0 across every preset × display mode, scramble, strokes and the dialog. A 70-cell pointer jump painted with 0 gaps, and a real mouse drag in the pane painted one continuous stroke. A 100-byte .bin was rejected with a clear message, a 21,504-byte file loaded bit-exactly, and export produced 21,504 bytes. The 128, 256 and 512 grids reported 1.0, 4.0 and 16 MB of state with matching axis labels. With WebGL2 stubbed out, and separately with the float extension stubbed out, the field showed the right message. At 375 px the layout viewport stayed 375 px with no overflow; an early run had found the top-bar meters overflowing to 531 px (specificity bug, fixed). Tablet (1024 px) and desktop (1440 px) layouts were checked by screenshot. The Learn index lists 21 tiles in alphabetical order with no tile falling back from the shared WebGL decoration.

Not verified: Safari/iOS (needs WebGL2 with float render targets, as the original did), and frame rate on phone GPUs.
