# Aurelia Vitrea — Pure-SVG First-Person Exploration Game Plan

## 1. World, Backstory & Visual Identity
- [x] Establish **Aurelia Vitrea: The Singing Glasslands** lore (Ninth Kiln Gilders, the Fractured Meridian, the Stillness, Tuner-Errant journey, 12 Field Journal resonance fragments).
- [x] Palette: Eternal Vespers twilight (deep obsidian-indigo zenith → royal plum → coral terracotta → molten apricot-gold horizon) with smoked-teal glass, hammered brass, copper-verdigris, and cyan-gold resonance accents.
- [x] Pure SVG constraint: 100% SVG `<defs>`, gradients, paths, polygons, circles, and transforms. Zero `<canvas>`, WebGL, Three.js, or external images.

## 2. SVG Rendering Engine & Atmospheric Depth
- [x] Dynamic responsive SVG `viewBox` synced to viewport aspect ratio (`100dvw × 100dvh`) for undistorted 3D perspective on desktop, tablet, and portrait/landscape mobile.
- [x] 360° panoramic celestial dome: zenith-to-horizon twilight sky, twinkling constellation starfield, **Shattered Meridian Astrolabe** arcs, **Twin Moons** (*Opaline* & *Cinder*), low **Vespers Sun** with directional sun-bloom, drifting stylized clouds, and 3-layer parallax crystalline mesa skyline.
- [x] True 3D perspective glass-flat ground plane: feathered specular sunset reflection path (clipped cleanly at `y >= 0`), dynamic perspective salt-crust meridian survey lines, glowing perspective-projected brine mirror pools, and soft prop contact shadows.
- [x] **6 distinct handcrafted SVG environmental archetypes** with `<defs>` templates & depth-graded atmospheric haze overlay (zero expensive SVG filter bottlenecks):
  1. **Kiln-Spire Organ** (tall fluted blown-glass pipes, brass collars, thermal vapour, spinning wind-vane — 2 variants)
  2. **Prism-Willow (*Salix vitrea*)** (twisted copper-verdigris trunk, multi-tiered Art-Nouveau weeping spun-glass boughs & brass filaments — 2 variants)
  3. **Astrolabe Reliquary Cairn** (interactive obsidian plinth, rotating gimbal brass rings, glowing lens orb that attunes when approached & casts a skyward resonance beam + 3D ground ripple)
  4. **Silica Agave Cluster** (faceted low-profile rose-quartz & amethyst crystal rosettes — 2 variants)
  5. **Gilder Kiln-Arch** (monumental hollow smoked-glass & brass filigree portal arch you can walk straight through)
  6. **Vesper Moth (*Lanternae silicae*)** (3D-orbiting translucent stained-glass creature with animated flapping wings)
- [x] 3D foreground drifting silica dust motes for visceral motion parallax.
- [x] Infinite deterministic chunked world streaming (`CHUNK_SIZE = 28m`) with biome modulation (Kiln Colonnade, Whispering Salix Grove, Meridian Causeway, Mirror Flats), smooth collision avoidance, strict frustum culling, efficient SVG DOM node creation/cleanup, and minimal-thrash Painter's Algorithm sorting.

## 3. Immersion, Controls & Accessibility
- [x] Smooth damped movement (`W/S`/`ArrowUp/ArrowDown` walk, `A/D`/`ArrowLeft/ArrowRight` turn, `Q/E` strafe, `Shift` brisk stride) + subtle sinusoidal head-bob (respects `prefers-reduced-motion`).
- [x] Mouse click-and-drag look around (horizontal yaw + gentle clamped vertical pitch) via Pointer Events with `setPointerCapture`.
- [x] True multitouch HTML/CSS virtual joysticks in bottom corners (`env(safe-area-inset-*)` padded, `>=44px` coarse targets): left joystick = walk forward/backward, right joystick = turn left/right (independent `pointerId` tracking for simultaneous walk + turn).
- [x] Prevent default mobile browser gestures (`overscroll-behavior: none`, `touch-action: none`, `-webkit-user-select: none`, `gesturestart`/`touchmove` prevention outside modal).
- [x] Optional procedural Web Audio harmonic soundscape (gentle footsteps on glass, soft wind-chime ambience, cairn attunement chord — user-initiated with accessible Mute toggle).
- [x] Minimalist HUD: responsive 3-column grid (2-row on narrow mobile) with Meridian Compass Ribbon, nearest unattuned Cairn indicator, Field Journal `<dialog>`, Sound/Bob/Sticks toggles, and arrival overlay.

## 4. Verification & Integration
- [x] Validated pure-SVG constraints (zero `<canvas>`, WebGL, Three.js, or external assets) and JS syntax (`node --check`).
- [x] Tested live in headless Chrome (1440×900 desktop & 390×844 mobile portrait):
  - Verified 0 console errors and steady ~60 FPS.
  - Verified keyboard movement, head-bob activation, mouse click-and-drag rotation, Cairn proximity attunement (beam, ground ripple, toast, unlocked Journal fragment), chunk eviction & bounded SVG DOM node counts (`<= 78` visible props, `49` active chunks across long sprint).
  - Verified mobile HUD zero-overlap check and true simultaneous multitouch walking + turning via dual CDP touch points on both virtual joysticks.
  - Caught and fixed three subtle visual issues from screenshot inspection: SVG `hidden` attribute toggling (`toggleAttribute('hidden', ...)` + `[hidden] { display: none !important; }`), mobile HUD overlap via grid-flow compass, and `#ground-clip` + cubic ease-out sun halo stops to eliminate horizon reflection bleed.
- [x] Added `AURELIA VITREA` tile to `svg-forest/index.html` sorted alphabetically by model (`Gemini 4 Argon` → `Gemini 4 Neon` → `GLM-5.2`) and verified tile rendering and count (`47 worlds`).
- [x] Commit and push cleanly to `main`.
