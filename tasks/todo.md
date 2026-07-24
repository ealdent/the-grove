# Task: LAMPBLACK — Opus 5 Ultra tower defense (green field)

Goal: single-file, zero-dependency tower defense at `tower-def/opus5-ultra-tower-def.html`, plus a tile
in `tower-def/index.html` (provider anthropic / model "Opus 5" / effort "Ultra").

Constraints: no external deps (no CDN fonts/scripts), opens from `file://`, random track per run,
dark grungy look, responsive, professional UI. No borrowing from other games in this repo.

## Theme / hook

**LAMPBLACK — Deep Shift**: a flooded, collapsed colliery. The Pilot Flame at the shaft head is the
core. The attackers are *the Unlit* — things made of absence that crawl the old rail line.

Central mechanic: **light is a weapon.**
- Every tower projects a *lumen field*. Enemies inside any lumen field are REVEALED.
- Enemies outside all lumen are SHROUDED: reduced damage taken, faster, slow regen.
- Losing core integrity dims the whole mine (compounding), restorable with scrap ("Stoke").
- Enemy counterplay: Lightleech (dims towers), Nightcap (suppression aura), Gloamwisp (self-shroud).
- Tower counterplay: the Sounder reveals by sonar (no light needed) and ignores the shroud penalty.

## Checklist

- [x] Inspect index.html tile format + confirm filters auto-derive from cards
- [x] Procedural track generator (randomized DFS, non-touching corridors, length band, fallback)
- [x] Fit-to-container world transform (DPR aware, grid sized so a tile lands near 56 screen px)
- [x] Darkness/lumen compositing layer (half-res, destination-out light sprite, additive bloom)
- [x] 5 towers x 4 upgrades, distinct roles + Mk5 transformations + 4 targeting modes
- [x] 16 kinds of Unlit (speed/HP/armour/trait variety) incl. 4 bosses
- [x] 25 waves with named modifiers (Blackout, Firedamp, Damp Air, Static Storm, Veil, Rush, Boss)
- [x] Prep phase between waves (manual send), build + upgrade + sell any time, Stoke sink
- [x] Grunge UI: top stat bar, machine shop, works order, wave preview, shaft log
- [x] Responsive: desktop sidebar -> mobile stacked rail; pointer + keyboard input
- [x] WebAudio SFX (synth only, muted-safe, created on first gesture)
- [x] Title / victory / defeat overlays with sticky CTA
- [x] Verify headless: no console errors, path gen over many seeds, 25-wave sim
- [x] Add index.html tile (Opus 5 / Ultra, alphabetical slot after opus48)
- [x] Commit + push to main

## Review

Shipped `tower-def/opus5-ultra-tower-def.html` (~3.9k lines, zero dependencies, opens from
`file://`) plus the index tile. Theme: **LAMPBLACK — Deep Shift**, a collapsed colliery where
light is the weapon and the dark is the enemy's armour.

Proof captured:

- **Track generator**, 400 generated tracks across varied grid sizes: 0 failures, 0 self-touching
  corridors, 0 disconnected steps, correct entry/exit edges, length 25-177 tiles.
- **25-shift simulation**, three scripted build strategies, no exceptions and no console errors in
  any run:
  - spam Mk1 machines everywhere (109 towers) → dies wave 24
  - half-upgraded spread (20 towers, 8 maxed) → holds 92% integrity to wave 24, dies to the
    Deepmother on 25
  - focused, sounder-heavy, everything maxed (11 towers) → wins 25/25 at 100% integrity, 788 kills
  That gradient is the intent: depth beats breadth, and the final boss is the skill check.
- **Live input path** driven with real pointer/DOM events in a browser: shop select → canvas click
  places a machine (scrap 210→140), auto-selects it, works order shows the next upgrade, klaxon
  starts the shift with the right queue. 18-control sweep (speed, mute, pause, stoke, sell, all
  keyboard shortcuts, help, defeat, restart, restart→send) — every one clean, `window.onerror`
  empty throughout.
- **Screenshots** at 1440x900, 800x869 and 390x844 confirming layout, the lighting model, the
  build-mode grid, wave-modifier banner and mobile HUD/shop.

Bugs found and fixed during verification (both were visible only in a render, not in the sim):

1. `offsetPoly` used `na+nb` as the miter vector, which doubles the offset on straight runs — the
   rails drew as a bright outline at the trench edge instead of two rails inside it. Correct miter
   is `(na+nb)/(1+na·nb)`.
2. The trench floor was stroked near-black, so the (lighter) sleepers read as a glowing ladder
   across the map. Rebuilt the rail bed: lighter ballast, parametric chippings placed along the
   path, sleepers sunk darker than the ballast.
3. Enemy hit-flash was a filled white disc at 0.8 alpha that swallowed the whole creature; now a
   rim highlight.
4. Core embers were spawned from the render pass, so particles accumulated while paused or on the
   title screen. Gated on a `G.simming` flag.

Not verified: real human play at speed on a touchscreen (only synthetic pointer events), and audio
output (synthesis is silent until the first user gesture by design, so headless runs prove only
that it never throws).

Residual risk: balance is tuned by simulation with scripted build orders rather than human play. A
player who ignores the light mechanic — no Sounder coverage on the Deepmother, which smothers
itself and so can never be revealed by lamps — will find shift 25 close to unkillable. That is the
designed counterplay and it is stated in the briefing, the Sounder blurb and the Deepmother
tooltip, but it is the one lesson the game teaches late and hard.
