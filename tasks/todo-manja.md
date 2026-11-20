# MANJA: The Severed Kite — Build & Verification Plan

Target file: `rail-shooter/gemini-4-neon-xhigh-rail-shooter.html`  
Index entry: `rail-shooter/index.html` (`Gemini 4 Neon`, `xHigh`, Google provider)

## World & Concept
- **Premise:** Your kite string snaps mid-festival during the Rooftop Kite War. You are a rogue crimson silk fighter-kite riding a howling gale over an endless sunlit-to-monsoon city, whipping razor-glass *manja* darts through rival guild kites, dodging architectural obstacles, skimming roofs/arches for Slipstream Grazes, and climbing into the Eye of the Typhoon to sever **Shatapada, the Imperial Centipede Kite**.
- **3 Distinct Stages + 2 Gatekeepers + 3-Phase Final Boss:**
  1. **Stage I — The Terracotta Roofs** (Blazing cerulean noon, terracotta tile courtyards, brick chimneys, cobalt domes, flapping saffron laundry arches, wooden water towers) -> Gatekeeper: **The Grand Charkhi** (rotating 4-pod box-kite fortress).
  2. **Stage II — The Monsoon Aqueducts** (Copper squall & gathering storm, flooded sky-mirror canal, stone aqueduct arches to thread, spinning cloth-sail windmills, rain streaks) -> Gatekeeper: **The Twin-Spool Mantas** (paired storm-manta kites linked by a sweeping razor-manja arc).
  3. **Stage III — The Eye of the Typhoon** (Towering sunlit spiral cloud eye-wall amphitheater, rain-slicked slate pagodas, taut storm mooring cables, god-rays) -> Final Boss: **Shatapada, the Imperial Centipede Kite** (12 articulated fluttering segments + sculpted Demon-Mask head, 3 distinct telegraphed phases).

## Architecture Checklist
- [x] **WebGL2 3D Engine (Zero External Dependencies):**
  - [x] Atmospheric sky shader (Rayleigh-inspired 3-stage gradient, sun corona, FBM drifting clouds, volumetric sun shafts, 3D swirling Typhoon Eye-Wall in Stage III).
  - [x] Procedural infinite ground shader (Stage I terracotta roof-tile mosaic, Stage II reflective flooded aqueduct canal with sky reflection & rain ripples, Stage III slate & swirling typhoon mist) + dynamic projected entity shadow map array.
  - [x] Painterly 3D lit mesh shader with backlit silk translucency, GPU wind-flutter vertex animation, metallic brass warm-wrap speculars, emissive lantern glow, and horizon aerial fog.
  - [x] Dynamic 3D ribbon shader (player kite's dual physics-driven crimson/gold tails, severed glass string, enemy streamers, taut *manja* trip-wires, dart wakes).
  - [x] 3D tumbling particle/confetti/smoke/rain/pigeon system with camera-near proximity fade.
  - [x] Offscreen FBO post-processing pass (1/3-res separable Gaussian bloom, warm ACES filmic tone mapping with vibrancy lift, speed-feel edge vignette, smooth hit chromatic recoil).
- [x] **Procedural 3D Models:**
  - [x] Bowed player fighter-kite tilted at 34° aerodynamic angle-of-attack with bamboo spars, luminous gold sun-crest, backlit translucent silk, dynamic roll/pitch banking.
  - [x] Architectural obstacles with compound exact hitboxes: chimneys (with smoke), cobalt domes, flapping laundry arches (fly-under gap), water towers, aqueduct arches (fly-through gap), rotating windmills (blade gap collision), pagoda spires, mooring cables, destructible gold lantern-shrines.
  - [x] 6 enemy archetypes: Diamond Scout, Swooping Paper Hawk, Revolving Box-Kite, Spool-Runner pair (with taut wire), Rokkaku Lantern Bomber, Naga Ribbon serpent.
  - [x] Stage I Gatekeeper (Grand Charkhi), Stage II Gatekeeper (Twin-Spool Mantas), Stage III Final Boss (Shatapada 3-phase Imperial Centipede).
- [x] **Gameplay, Controls & Juice:**
  - [x] Seamless analog Mouse + WASD/Arrow controls, Space/Left-Click rapid Manja Darts, Shift/Right-Click **Gale Snap** 360° wind-cleave.
  - [x] Dual-depth 3D-projected aiming reticle with gold target lock-on.
  - [x] Slipstream Graze near-miss detection with climbing multiplier, golden wing-ring, Gale charge, and floating callouts.
  - [x] Hitstop, directional recoil, silk-tear feedback (4 Silk Panels), Silk Mend pickups, death stall spiral, victory ribbon shower.
  - [x] Tutorial-free onboarding + live animated 3D title flyover + instant restart + pause/mute/focus-blur handling + `prefers-reduced-motion` support.
- [x] **Procedural Web Audio Engine:**
  - [x] Dynamic multi-stage modal soundtrack (Title, Stage I D Mixolydian, Stage II G Dorian, Stage III A Lydian/Mixolydian, Boss D Phrygian Dominant).
  - [x] Velocity/altitude-reactive wind & silk-flutter ambient bed.
  - [x] Theme-matched non-fatiguing SFX routed through DynamicsCompressor + -4.5 dB treble shelf.
- [x] **Verification & Integration:**
  - [x] Added card tile to `rail-shooter/index.html` (`Gemini 4 Neon`, `xHigh`, Google provider).
  - [x] Automated Chrome CDP verification directly over `file://`: zero JS/WebGL/console errors, strict crimson/gold pixel assert at projected player kite coordinates (`RGBA [207, 94, 49, 255]`), ~0.12 ms avg frame step+render CPU time.
  - [x] Visually inspected all 8 screenshots across Title, Stage I, Grand Charkhi Gatekeeper, Stage II Monsoon Aqueducts, Stage III Typhoon Eye, Shatapada Final Boss, Pause, and Victory.
  - [x] Caught and fixed 5 real bugs & visual polish issues during screenshot review (Stage III gold-inlay inverted mask, backlit gold emblem olive shading, boss bar persisting across restart, near-camera particle blowup, upward-curling ribbon perspective).

## Review Notes
- Verified directly over `file://` in real macOS Google Chrome (WebGL2) with zero external assets or CDN dependencies.
- Note on audio: procedural Web Audio synth graph compiles and unlocks cleanly without errors in Chrome; live human listening verification on speakers is left to the user.
