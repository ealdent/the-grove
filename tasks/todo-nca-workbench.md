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

## Fix: the field froze after a second (2026-11-04)

Report: "This thing keeps running and steps go up but i see nothing happening."

Cause, measured on the GPU: every hand-wired rule was a leaky diffusion driven by constant sources, so it had one stable state. The readout changed by less than 10^-3 per 25 steps after about 400 steps, and the default rule changed by exactly 0 after 1,600, while the step counter kept climbing.

- [x] Prototype dynamic rules on the real shader (fp16 state, random update gate) in a gitignored harness.
- [x] Pacemaker waves (default): a piecewise-linear FitzHugh-Nagumo excitable medium; emitters and anchors are pacemakers at different rates, voids are inert. Rings annihilate, and the faster emitters overdrive the anchors within about a minute. A scramble breaks fronts into spirals.
- [x] Ripple tank: the damped wave equation (semi-implicit Euler, a viscous term against the noise the random update order grows, a small restoring term against drift), driven by a shared clock in c12-c13. Emitters are plungers, voids reflect and anchors absorb.
- [x] Spiral turbulence: the pacemaker medium with slower recovery and fast-recovering emitters, so beats fail and the fronts break into self-sustaining turbulence.
- [x] Switching rules clears the hidden state and keeps the painted sensors; legends name each channel for the current rule; the copy no longer promises that the pattern "grows back".
- [x] Verify: motion, boundedness at p = 0.1/0.6/1.0, scramble, rule switching, console, phone width.

### Review

The weights now come from a small builder (unit, split, relay, gated, leak) with 34, 46 and 36 of the 64 hidden units used. A sensor-gated term is a ReLU pair whose input carries 8 times the 0/1 sensor and whose bias is -8, so it is off wherever the sensor is 0.

Evidence (Browser pane, real GPU): the mean change of the displayed readout over 25 steps stays at 0.16-0.17 (pacemaker waves), 0.19 (ripple tank) and 0.07-0.08 (spiral turbulence) through step 9,000, and is still 0.15, 0.16 and 0.09 1,500 steps after a scramble; the old rules gave 0. Running live at 120 fps, 480 steps/s, the rings move between screenshots. The ripple tank's force-driven emitters resonated to the +/-4 clamp, so the emitters became plungers; afterwards the height stays about 1 inside the emitters and 1.1-1.3 outside at p = 0.1, 0.6 and 1.0. Spiral turbulence was still turbulent at 28,000 steps. Switching rules kept a painted emitter (c0 total 1,437 before and after) and cleared c4-c15 to 0. gl.getError() stayed 0, the console logged nothing, and the 375 px layout has no overflow.

Not verified: Safari/iOS and phone-GPU frame rate, as before. Wave speed scales with the display's refresh rate (steps per frame), so 120 Hz screens run twice as fast as 60 Hz.
