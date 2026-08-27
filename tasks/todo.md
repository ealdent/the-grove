# TODO: Blood Splat Submit — physics rebuild + live config + revive transition

Source: user request — the demo is "a bit crap": gloppy circle-growth splatter, giant
video-game button, no controls, instant reset. Rebuild it.

## Forensic model (from BPA research, 2026-08-27)
- Spatter = parent stain + spines (tapered, point in direction of travel) + satellite
  stains + mist (high velocity aerosol <1 mm).
- Velocity inverse-sizes droplets: fast → smaller, more numerous, mist; slow → few fat drops.
- Satellites elongate into ellipses/spinelike shapes with distance from origin.
- 90° impact → circular scalloped parent with even spines; rivulets run down vertical surfaces.

## Plan
- [x] Research impact spatter (Springer / SWGSTAIN terminology / Wikipedia BPA)
- [x] Rewrite `shaders/blood-splat-submit-shader-demo.html`
  - [x] Impact spatter: click point = impact origin; scalloped parent pool, tapered
        radiating spines with terminal droplets, distance-elongated satellites,
        velocity-scaled mist, gravity rivulets. No more growing-circle glop.
  - [x] Live config panel: Amount, Velocity, Spread, Mist, Drips, Drying speed,
        Flaking sliders — all uniforms, no recompile, real-time.
  - [x] Smooth re-enable: on "Re-enable" (or optional auto re-enable after delay),
        drying + flaking fast-forward (~1.6 s), button rises back, revive sheen sweep.
        Never an instant snap.
  - [x] Realistic submit button: small contained web button inside a sign-in form card
        (title, input, placeholder), SDF "SUBMIT" label, hover/press/disabled states.
  - [x] Light/dark theme toggle — page chrome AND shader scene cross-fade.
  - [x] URL test hooks: ?auto=1&pin=<sec>&recover=<sec>&theme=light + config overrides,
        deterministic seed/impact for headless screenshots.
- [x] Verify: headless Chrome screenshots (idle dark/light, impact, wet, drying,
      flaking, recovering, restored), iterate until it reads as real spatter.
- [ ] Commit + push origin/main.

## Notes
- lessons.md #33/#38: headless Chrome + virtual-time gives rAF dt≈0 — verify via
  pinned deterministic states (URL params), not wall-clock captures.
- lessons.md #17: no backticks inside the GLSL template literal.

## Review

### Verification evidence (2026-08-27)
- **Syntax**: inline `<script>` extracted to `tmp/blood/extracted.js`, `node --check` clean.
- **Headless renders** (Chrome headless + SwiftShader, `tmp/blood/shot-blood.sh`,
  1440×900, `--virtual-time-budget=9000`; pinned states via URL hooks,
  PNGs in `.shots/blood/`):
  - `idle-dark` / `idle-light`: form card with real-looking indigo SUBMIT button,
    panel chrome matches theme, phase badge READY ✓
  - `burst-dark` (`pin=0.18`): mid-flight — pool forming, spines extending, satellites
    airborne, phase IMPACT ✓
  - `wet-dark` / `wet-light` (`pin=1.2`): full spatter — scalloped parent pool,
    radiating tapered spines with terminal droplets, distance-elongated satellites,
    wet sheen; reads as impact spatter, not circle growth (confirmed at native
    resolution crop) ✓
  - `dry-dark` (`pin=6`): colour shifted wet red → dried brown, phase DRYING ✓
  - `flake-dark` / `flake-light` (`pin=13`): crust eroding in crumbly patches,
    SUBMIT label re-emerging, phase FLAKING ✓
  - `recover-dark` (`recover=0.5`): fast-forwarded erosion mid-restore, phase
    RESTORING ✓
  - `restored-dark` (`recover=1.8`): blood fully gone, button back to enabled,
    phase READY ✓ — quick transition, not an instant snap
- Phase badge walked READY → IMPACT → WET → DRYING → FLAKING → RESTORING → READY
  across the shots; Re-enable/Reset disabled states followed the mode.
