# Tower Defense Game — opus48-ultra (ACTIVE)

## Goal
Single-file, dependency-free HTML tower defense. Greenfield & original.
Unique theme w/ wow-factor, cute cartoony look, professional UI, responsive, random track.

## Hard requirements
- [x] 5 tower types, each with 4 upgrades (Tardy/Splashcap/Frost/Bolt/Sunny)
- [x] Enemies with varied speed + strength (14 types incl. 4 bosses)
- [x] 20+ distinct waves with variation (24 hand-authored waves)
- [x] Between-wave upgrade phase (build phase + 🐚 Send Wave, send-early bonus)
- [x] Nice UI / professional feel (glassy HUD, tide gauge, upgrade card)
- [x] Cute cartoony appearance (procedural googly-eyed jelly blobs)
- [x] Responsive (aspect-fit + compact <640 CSS + portrait rotate hint)
- [x] Random track each load (Catmull-Rom silt current, fresh each game)
- [x] No dependencies — pure HTML/CSS/JS, opens directly in browser (verified: 0 external refs)

## Plan
- [x] Phase 1 — Design workflow: WINNER "Tidepool Tactics: Defenders of the Droplet"
- [x] Phase 2 — Build the single HTML file (~2000 lines, main loop)
- [x] Phase 3 — Verify in browser: 0 console errors, full 24-wave win, responsive layouts
- [x] Phase 4 — Adversarial review workflow (17 confirmed findings) + all fixed & re-verified
- [x] Phase 5 — Add tile to tower-def/index.html (Opus 4.8 · Ultra · 💧 Tidepool Tactics)
- [ ] Phase 6 — Commit + push to main

## Constraints / notes
- Design must NOT reuse prior chats or repo ideas. Steered AWAY from the existing
  MYCELIA fungal/mushroom/"grove" theme (chose a magnified tide-pool droplet).
- Only read tower-def/index.html AFTER the game existed, to match tile format.

## Review
- **Theme (wow-factor):** a single magnified drop of seawater. The signature mechanic
  is a live TIDE CLOCK (~30s): HIGH TIDE speeds enemies + extends splash/chain range;
  LOW TIDE slows/exposes them with "drying" DoT + surges Sun income; every tide flip
  fires a free synchronized volley. Water body physically breathes in/out.
- **Towers:** Tardy (sniper/pierce), Splashcap (splash), Frost (slow cone), Bolt (chain),
  Sunny (economy/buff) — each mechanically distinct, 4 upgrade tiers each.
- **Enemies:** grump swarm, fast-blink zippo, armored barnacle, floaty foram, splitter
  rotifer→broodlings, tower-disabling copperhead raider, regen slime, segmented siphon,
  + 4 bosses (Crab Claw, Moon Jelly, Pincer Kings, Great Red Bloom finale).
- **Balance:** tuned so a strong build wins comfortably, a minimal build is a coin-flip
  and can lose at bosses, and no defense loses at wave 5 — tense but fair.
- **Verification:** headless sim of full 24-wave playthroughs (WIN, 0 errors); tiered
  builds mapped the difficulty gradient; visual QA of start/combat/boss/build/victory +
  desktop/landscape-mobile/compact layouts.
- **Review pass:** 4-lens adversarial workflow → 17 confirmed findings (frost-shatter
  cascade, tide-gauge swallowing clicks, unused tideHint, splitters dying on spawn under
  AoE, stale/short-stage upgrade card, dead upgrade stats, etc.) — ALL fixed and re-verified.

---

# Night lighting + glass redo (greenhouse-todo)

## Problems
1. Night is too dark globally: `environmentIntensity` floor 0.005, exposure 0.45, all fills off → only tight lamp cones visible. Can't see floor, tables, pots.
2. Lamp spotlights: ~28° half-angle, distance 6, decay 2.2 → tight puddle of light right under the bulb. Hood is a tiny cone and the bulb hangs below it (no parabolic-reflector behavior).
3. Glass is unlit `MeshBasicMaterial` with a bright grime map at opacity 0.24 — at night it renders as a constant pale-green wash that occludes the dark forest (fireflies, eyes).
4. All panes share one material; want clearer vertical wall glass vs. more diffuse/translucent roof glass.

## Plan
- [x] Reshape lamp hood into a wider parabolic shade (LatheGeometry, rim ~0.30 m), tuck the bulb up inside it at the focus.
- [x] Widen spotlights to ~51° half-angle, decay 1.6, distance 10, retune night intensity so the whole 2×3 m table + nearby floor is lit, soft penumbra for rich edge falloff.
- [x] Decouple the visible light-shaft cone from the spot angle (shaft starts at the shade rim, modest flare).
- [x] Night ambient floor: dim cool hemisphere moonlight, environmentIntensity floor 0.03, exposure 0.62 at night, warm interior bounce stays on low. Shades glow faintly warm at night.
- [x] Split glass into wall material (clearer, lighter grime, opacity 0.15) and roof material (greener, more diffuse, opacity 0.32).
- [x] Darken glass color + drop opacity with nightness so the forest reads through the panes after dark.
- [x] Slightly thinner night fog (0.009 total vs 0.012) so the woods stay visible.
- [x] Verify: node --check passes, greenhouse jest suite passes.

## Review
- Lamps: hood is now a wide parabolic reflector dish (LatheGeometry, quadratic
  profile, 0.30 m rim) with the bulb nested at the focus instead of dangling
  below. Spotlights widened from ~28° to ~51° half-angle with decay 2.2→1.6 and
  distance 6→10, so each cone covers its whole 2×3 m table with soft penumbra
  edges and spills a dim pool onto the aisle floor. The additive haze cone was
  decoupled from the light angle so it still reads as a shaft, not a wall.
- Night floor: cool moonlit hemisphere (0.12), IBL floor 0.005→0.03, exposure
  0.45→0.62, warm bounce kept on low — navigable, but lamp pools still dominate
  and corners stay dark.
- Glass: split into wall glazing (clearer: lighter grime, opacity 0.15) and
  roof glazing (greener, heavier film, opacity 0.32). Both are unlit materials,
  so updateSunAndLighting now dims their tint (×0.22) and opacity (×0.35) with
  nightness — the forest, fireflies and eyes read through the panes after dark.
  Night fog thinned (0.012→0.009) and the painted backdrop keeps a moonlit
  trace (0.06→0.11 floor).
- Verified with node --check and the greenhouse jest suite (passes). No
  headless browser in this environment for a visual smoke test.

---

# GitHub Pages Deploy Failure Investigation

## Plan
- [x] Confirm repository Pages configuration and current default branch.
- [x] Inspect recent failed automatic Pages deployment runs from GitHub Actions.
- [x] Compare failing logs against recent repository changes and Pages limits.
- [x] Identify the root cause, confidence level, and smallest remediation path.

## Review
- Repo Pages config is `legacy` GitHub Pages, deployed from `main` `/`, at
  `https://ealdent.github.io/the-grove/`.
- Failed deployments were not source/build failures. The artifact upload step
  succeeded, then `actions/deploy-pages@v5` failed while polling GitHub Pages.
- July 2 failures (`28600611267`, `28607343557`) repeatedly reported
  `Current status: deployment_queued` until the deploy step timed out after
  600000 ms and canceled the deployment.
- July 4/5 failures (`28717572745`, `28740138657`) created deployments and then
  failed with `Deployment failed, try again later.`
- GitHub Status has a matching July 2 Pages incident for slow/failing Pages
  deployments. The repo also has successful deployments after the incident,
  including latest run `28749004839`, so this is a GitHub Pages deployment
  backend/intermittent queue issue, not a bad site artifact.
- Smallest remediation: no code change required. Re-run/trigger a fresh Pages
  deploy when it happens. If it keeps recurring, toggle Pages source off/on or
  switch to an explicit checked-in workflow with concurrency cancellation so old
  deploys do not linger.

---

# (done) Worn greenhouse in a haunted forest — visual overhaul

Completed earlier; see git history. Forest, wet interior, vines, grow/wither,
lighting polish all landed in `utils/greenhouse-todo/app.js` with jest suite
passing.

# (done) MYCELIA — Guardians of the Glowing Grove (tower defense)

Single-file, dependency-free tower defense at
`tower-def/fugu-xhigh-tower-def.html`. Greenfield build.

- Theme: bioluminescent fungal grove; cute glowing mushroom towers vs. the Blight.
- Random winding mycelial track generated each game (non-self-intersecting).
- 5 towers (Dartcap, Puffshroom, Frostfern, Sparkcap, Titanshroom), 4 upgrade
  tiers each (single / splash / slow-aura / chain-lightning / sniper archetypes).
- 8 enemy types with distinct speed/HP/armor/heal/ghost traits + 22 waves
  (bosses at 10/18/22); HP scales with wave.
- Between-wave building & upgrading, economy (spores), sell for 70% refund.
- Polished responsive UI, WebAudio SFX, particles, floating text, speed/pause/mute.
- Verified in headless Chromium: full 22-wave victory, all towers max-tier,
  desktop + mobile layouts, zero console/page errors.

---

# SVG Forest — fugu-ultra-high fresh build (ACTIVE)

## Goal
Create a new single-file, pure-SVG, first-person exploration game at `svg-forest/fugu-ultra-high-svg-forest.html`, add it to `svg-forest/index.html`, then commit and push to `main`.

## Hard requirements
- [x] Fresh implementation without using other repo game files or prior conversation history.
- [x] Single HTML file with inline CSS/JS and pure SVG rendering only.
- [x] No `<canvas>`, WebGL, Three.js, or external image assets.
- [x] Creative cohesive theme with sky, ground, and at least 2–3 stylized SVG props.
- [x] First-person 3D/2.5D exploration with indefinite/dynamic world.
- [x] Depth illusion via distance scaling/sorting and efficient SVG creation/cleanup.
- [x] Subtle movement head bob.
- [x] Desktop WASD/arrow controls plus mouse click-drag look.
- [x] Mobile responsive layout with two HTML/CSS virtual joysticks.
- [x] True multitouch: left joystick moves while right joystick turns simultaneously.
- [x] Prevent default mobile gestures.
- [x] Add a tile to `svg-forest/index.html`.
- [x] Verify, commit, and push to `main`.

## Plan
- [x] Write a fresh validation script in `/tmp` and run it red before implementation.
- [x] Implement the game file from scratch with SVG DOM pooling and projected 2.5D props.
- [x] Update only the required index tile.
- [x] Run static and syntax verification plus git review.
- [x] Commit and push only the requested game/index changes and this task record.

## Review
- Built `svg-forest/fugu-ultra-high-svg-forest.html` as a fresh pure-SVG first-person exploration game named Chroma Tidelands.
- Implemented deterministic cell/chunk generation, distance projection, scale/depth sorting, SVG group pooling, ground redraw cleanup, and movement head bob.
- Added desktop keyboard/mouse controls and independent pointer-id mobile joysticks so walking and turning can happen at the same time.
- Added the tile to `svg-forest/index.html`.
- Verification run: `/tmp/validate_svg_forest.py` passes and inline JavaScript `node --check` passes.
