# Plan — WOLF TONE (`rail-shooter/gemini-4-carbon-high-rail-shooter.html`)

## World & Creative Concept
- **Title**: **WOLF TONE**
- **One-Sentence Pitch**: *"You are a feral Wolf Tone—a winged tuning-fork resonance born inside a dying maestro's infinite grand piano—skimming over miles of humming copper strings, shattering lead mute-weights with sympathetic overtones, dodging slamming scarlet-felt hammers and brass tuning pins, and racing toward the Soundhole before the Great Damper drops behind you and silences the chord forever."*
- **Why You Move Forward & Cannot Stop**: At the climax of the *Midnight Concerto*, the Maestro collapsed onto the keys. Behind you, the **Great Scarlet Damper** is slamming down string by string from the keyboard toward the tail-block, drinking every vibration into dead silence. You are a traveling acoustic wave: if you stop, your amplitude collapses to zero. Skimming close to the copper strings below (**String Grazing**) feeds sympathetic harmonics into your multiplier and sustains your tone.
- **Visual & Architectural Arc**:
  1. **Movement I — *Allegro Focoso: The Sitka Soundboard***: Sunlit concert-hall clerestory godrays, warm honeyed Sitka spruce woodgrain, purfling inlay, vibrating wound-copper bass strings, blued-steel hexagonal Tuning Pins, and low Maple Bridges.
  2. **Movement II — *Presto Agitato: The Cast-Iron Harp***: Nocturnal Prussian-blue concert darkness lit by silver moonlight and bronze-gilt Cast-Iron Harp Arches (fly through circular lightening oculi!) while giant Scarlet-Felt Mahogany Hammers telegraph lanes and slam onto the strings.
  3. **Movement III — *Vivace Infernale: The Split Rose***: Over the fractured soundhole cavern where glowing vermilion-and-gold Chladni sand-mandalas pulse on suspended harmonic plates, crossed by brass Agraffe Gates, Sostenuto Rods, and elite Diapason Censors.
  4. **Cadenza Boss — *The Grand Regulator***: A cathedral-scale brass-and-obsidian Baroque Pendulum Automaton guarding the Great Rose Soundhole, featuring 3 tell-based phases (*Pendulum Cleave*, *3-Lane Chord Slam*, *Sympathetic Phase-Rings + Open Quartz Escapement Heart*), shattering in slow-motion before the player ascends through the Golden Rose into dawn air (with optional *Encore Loop* for high-score chasers).

## Checklist
- [x] **1. Architecture & Rendering Pipeline (`Three.js r160` + Custom GLSL + Crisp 2D HUD)**
  - [x] Single self-contained HTML file (`rail-shooter/gemini-4-carbon-high-rail-shooter.html`), Three.js ESM via jsDelivr CDN, inline SVG favicon, zero external image/font/audio files, works via `file://` double-click and HTTP.
  - [x] Custom GLSL Soundboard Shader (procedural Sitka spruce grain, luthiery purfling, stage color transitions, pulsing Chladni nodal sand-mandalas, soundhole cavern glow) + vertex-vibrating 3D copper/silver strings + procedural Concert-Hall Luthiery PMREM IBL environment map + cathedral vault ribs & flanking brass choir pipes.
  - [x] Fixed light pool (no dynamic light-count shader recompiles), clamped particle `gl_PointSize` in custom `ShaderMaterial`, soft near-faded volumetric clerestory light shafts, explicit DPR-safe canvas sizing, zero `backdrop-filter`.
  - [x] Sculpted 3D Wolf Tone avatar (~18% screen width, upright U-shaped tuning-fork dorsal crest, 3-bladed feathered resonator wings, tilted gyroscopic Chladni rings, twin live 3D wingtip harmonic streamers, real ground shadow on strings) + magnetic 3D dual-depth reticle.
- [x] **2. Gameplay Skeleton, Controls, Obstacles & Enemies**
  - [x] Fluid analog Mouse/Pointer AND WASD/Arrow controls, Hold LMB/Space rapid Overtone Darts, Shift/RMB *Octave Slip* barrel-roll with i-frames and graze counter, Pause (`P`/`Esc`), Mute (`M`), Quick Restart (`R`).
  - [x] Tutorial-free onboarding via early Movement I pacing, String-Graze rooster-tail sparks (`y < 1.58`), Near-Miss harmonic bonuses, ricochet sparks on indestructible obstacles.
  - [x] 5 Indestructible Obstacle types (Tuning Pins, Maple Bridges, Cast-Iron Harp Oculus Arches, Telegraphing Scarlet-Felt Slamming Hammers, Brass Agraffe Bars).
  - [x] 5 Shootable Enemy archetypes (Felt Mute-Moths, Plectrum Jacks, Lead Wolf-Weights, Segmented Coiled Wire-Vipers, Silver Diapason Censors + Golden Rosin Sustain pickups) + sculpted Dissonant Silence Knots & Cymatic Phase-Rings.
  - [x] 3-Phase Boss (*The Grand Regulator*) with audible + visual beat tells, opening Quartz Heart crit window, destructible Diapason flank, slow-mo defeat sequence, Victory screen + Encore mode + instant-retry Game Over ("DAMPED TO SILENCE").
- [x] **3. Procedural Web Audio Concert Synth & Foley**
  - [x] Single master bus routing (all dry + wet reverb/delay scaled cleanly by Mute/Volume) with sympathetic string plucks, harmonic hit chimes, bass piano hammer slams, metallic pin ricochets, Doppler graze zings, metronome boss tells, and 3 stage-evolving musical scores + D-Major Picardy Third victory resolution.
- [x] **4. Rigorous Verification & Gallery Integration**
  - [x] Extract inline script and verify clean parse via `node --check` (zero backticks in GLSL comments, zero `TODO`/`FIXME`).
  - [x] Deterministic debug/test harness (`window.__game`) verifying title → Movement I → II → III → Boss → Victory & Game Over, boss body+heart kill paths, obstacle indestructibility, pause/mute/restart, DPR 1 & DPR 2 sizing, mobile `390x844` layout, 60fps frame budget (`mean 0.188 ms`, `p95 0.4 ms`), and pixel/visual verification in headless Chrome over HTTP + `file://` (`0` console errors, `0` runtime exceptions).
  - [x] Add alphabetized `Gemini 4 Carbon` (`High`) sortie card to `rail-shooter/index.html`, document verification in Review section below, commit exact paths, and push to `origin/main`.

## Review & Verification
- **Deliverables**:
  - `rail-shooter/gemini-4-carbon-high-rail-shooter.html`: Single self-contained HTML5/WebGL/Three.js (`r160` CDN) + 2D HUD + procedural Web Audio rail shooter.
  - `rail-shooter/index.html`: Added **Wolf Tone** sortie card under `Google` / `Gemini 4 Carbon` (`High`), placed alphabetically between `Gemini 4 Argon` and `Gemini 4 Neon`.
- **Visual & Architectural Second-Pass Refinements**:
  - Added a procedural Luthiery Concert-Hall `PMREMGenerator` environment map (`scene.environment`) so blued-steel tuning pins, gilded bronze harp oculi, silver diapason censors, and the Boss's obsidian-and-brass gears catch warm amber and clerestory reflections instead of reflecting dark sky.
  - Added repeating soaring mahogany-and-brass cathedral case-vault arches and flanking brass choir-pipes for strong peripheral parallax from the very first frame on the Title screen.
  - Refined the Wolf Tone's rear silhouette with an upright U-shaped golden tuning-fork crest, 3-bladed feathered resonator wings, tilted gyroscopic Chladni rings, and twin live 3D wingtip harmonic ribbon streamers; replaced flat enemy orbs with multi-ring Dissonant Silence Knots; synced top HUD score readout on Victory/Game Over transitions.
- **Verification Summary (Chrome Headless WebGL + CDP)**:
  - Static & syntax: `node --check` passed cleanly on extracted module script; zero GLSL backticks, zero placeholders.
  - Canvas & Responsive: DPR 2 retina check (`2880×1800` buffer on `1440×900` CSS box for both WebGL and HUD canvases) and `390×844` mobile check (zero horizontal overflow) passed; `elementFromPoint` confirmed HUD overlays do not intercept playfield pointer input.
  - Full Progression & Mechanics: Verified Title showcase, Movement I (`70 u/s`), Movement II (`86 u/s`), Movement III (`102 u/s`), String Grazing multiplier ramp (`x1` → `x8`), Octave Slip i-frames, Pause/Resume/Mute state integrity, all 6 Boss sub-states (`prep`, `cleaveTell`, `cleaveSwing`, `chordTell`, `chordSlam`, `heartWindow`), 50% HP Diapason Arm shatter, Boss body-hit & heart-hit defeat transitions to Victory, 5-hit Sustain loss to Game Over + instant Retry, and direct `file://` origin boot (`0` page exceptions, `0` console errors).
  - Frame Timing: 240 full simulation + WebGL + 2D HUD render steps measured `0.188 ms` mean, `0.400 ms` p95, `0.500 ms` max.
  - Note: Procedural Web Audio score and foley were verified programmatically for clean node graph & mute bus behavior in automated Chrome; physical human listening and live desktop mouse/keyboard feel were not performed in this automated run.
