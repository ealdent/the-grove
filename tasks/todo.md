# Redline Ascent — playability + 3D landscape overhaul

Context: Kimi built the original, a GPT cleanup pass regressed the landscape feel. Jason wants:
obstacles to be 3D things you fly through/around/into (not vanish under you), working
targeting, playable with a great vibe.

## Root causes found
- Obstacles culled at `z > ZP - 12` (the player plane) + sprite height clamped to 1.25×H
  → they stop growing and pop out of existence right in front of the ship.
- `firePlayerBolt()` aims at a fixed screen-center crosshair using `camX` (which lags the
  ship) → shots never go where the ship is pointing; tiny world-unit hit radius at depth.
- Ship is always drawn on top, so nothing can visually pass between camera and ship.

## Plan
- [x] Ship-anchored reticle: crosshair projects from (px, palt) at aim depth, moves with ship
- [x] Lock-on targeting: nearest enemy within screen-space cone of reticle gets lock brackets;
      bolts aim at the locked target and lightly home; bigger hit radius
- [x] Fly-past obstacles: keep until z≈12 behind the player plane, remove 1.25×H clamp,
      near fade in the last stretch; same treatment for enemies (raised size caps)
- [x] Depth-correct draw order: ship rendered inside the z-sorted entity list so close
      obstacles/enemies sweep OVER it
- [x] Near-miss bonus for skimming obstacles
- [x] Vibe: muzzle flash, bolt tracer trails, lock sfx tick
- [x] Build (tsc + vite + standalone) and verify in browser
- [x] Commit + push

## Review
- Aiming rewritten: reticle is ship-anchored at AIM_Z=640; lock cone is 18% of min(W,H);
  locked bolts steer at 9/s toward the target at constant 950 speed; hit radius e.r+14
  (alt weight 1.15). Verified in browser via window.__redline: lock acquired on an off-axis
  grinder and killed in 0.67 s (previously bolts flew to a fixed screen-center point).
- Obstacles/enemies now live to z=12 with a near fade; obstacle height clamp raised
  1.25×H → 12×H; enemy screen-size caps raised (warden 0.55H, grinder 0.42H, wasp 0.4H,
  mine 0.3H). Ship drawn inside the depth sort at z=ZP so close structures sweep over it.
- Verified fly-through: threaded a ring arch (+750 THREAD, overdrive, no damage) with the
  ring's arms framing the ship as it passed; silo at z=60 correctly occluded the ship.
  Near-miss (+100) fired when a crystal skimmed past. tsc, eslint, vite build all clean;
  no console errors. Standalone index.html rebuilt and verified via grove-root server.
