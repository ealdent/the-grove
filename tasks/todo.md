# Greenhouse To-Do — "Worn greenhouse in a haunted forest" visual overhaul

Goal: fully playable 3D world that feels like a messy, wet, worn old greenhouse
in a haunted forest. Realistic textures, lighting, particles, vines/ivy
everywhere, a real-looking 3D forest outside, plants that grow and wither.

## Plan

- [x] **Texture upgrades**: fBm value-noise helper; wetter/darker dirt floor with
      wet-sheen roughness map; grimy streaked glass; bark + leaf-litter +
      ivy/fern/foliage canvas textures.
- [x] **Real 3D forest**: recursive-branch tree archetypes (leafy + dead) built
      from merged tapered cylinders with foliage cluster quads at branch tips,
      instanced in near/mid bands; existing billboards pushed to the far
      backdrop band only; leaf-litter forest floor plane (with hole for the
      greenhouse footprint); instanced undergrowth (ferns/bushes); ground mist
      sprites; firefly particles at night. Wind sway on foliage.
- [x] **Wet + messy interior**: reflective puddles on the dirt floor; drip
      particles falling from the roof with ripple rings where they land;
      floating dust motes; fallen-leaf litter on floor and tables; moss patches
      on the wood bases; clutter props (stacked crates, watering can, tipped
      broken pot with shards + soil spill, coiled hose, soil bag).
- [x] **Vines & ivy**: merged-tube vine stems with one InstancedMesh of ivy
      leaves — climbers up the walls/mullions, danglers from the cross beams
      and trellises, hanging baskets with trailing vines, big potted ferns.
- [x] **Grow & wither**: plants scale up as they age; per-leaf droop/curl as
      health drops; leaves progressively detach (fallen leaves appear on the
      soil) when health gets low.
- [x] **Lighting polish**: day/night fog density + color shift, sheen on leaf
      material, night-time firefly/mist intensity tied to dayness.
- [x] **Verify**: node --check, jest suite, manual smoke via local server.

## Review

- All changes live in `utils/greenhouse-todo/app.js` (additive — gameplay,
  controls, persistence and tests untouched). The greenhouse jest suite still
  passes; the one failing suite (`arcade/mother-os-defense`) is a pre-existing
  CommonJS/ESM mismatch unrelated to this work.
- Forest: 130 instanced 3D trees (5 generated archetypes, 70/30 living/dead)
  with fissured-bark textures and ragged canopy clumps, backed by a 300-tree
  billboard wall; leaf-litter/moss forest floor; 280 instanced ferns/bushes;
  drifting mist sprites; twinkling shader fireflies after dark.
- Interior: glossy merged-geometry puddles, CPU drip particles with a ripple
  pool, GPU dust motes, ~42 procedural vines (one merged tube mesh + one
  instanced ivy-leaf mesh), 5 hanging baskets with trailing strands, 6 big
  potted ferns, moss + fallen-leaf instancing, and clutter props.
- Plants: grow from 70 % scale over 1.5 days; wither with per-leaf droop/curl,
  top-down leaf drop, and shed leaves appearing on the soil.
- Verified headless in Chromium/SwiftShader with the import-map CDN proxied to
  a local copy of three@0.160.0: scene builds with 0 console errors,
  159 geometries / 48 programs, world renders as expected.

