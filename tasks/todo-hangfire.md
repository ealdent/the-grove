# HANGFIRE — pure-SVG first-person exploration (svg-forest, Sonnet 5.5, Max)

```text
Goal:        Single-file HTML/CSS/JS first-person exploration game; all visuals pure SVG (no canvas/WebGL/images).
Project:     the-grove (personal). Deliverable svg-forest/sonnet-5.5-max-svg-forest.html + tile in svg-forest/index.html.
Constraints: no <canvas>; responsive desktop/tablet/phone; WASD/arrows + drag-look; two true-multitouch joysticks
             (left = forward/back, right = turn) as HTML/CSS overlays; head-bob; pooled/cleaned SVG nodes.
Non-goals:   no external assets, no other-game peeking until finished (green-field originality).
Proof:       headless Chrome CDP harness: exact-viewport shots (desktop/tablet/phone), console clean,
             scripted walk, fps count, two-finger touch test, lore/reading check.
```

## World (decided before any code)

**HANGFIRE** — *hangfire (n.): the pause between a fuse taking and the charge going. Usually a heartbeat.*

Valley of Vesperine, Night of the Long Fuse: one shell per name the year took, casing lettered in lampblack,
colour = how they lived (strontium red fire-keepers, copper blue river folk, sodium gold elders, magnesium white
children, barium green growers, calcium orange makers, violet travellers, pink singers/teachers).
The last shell (the nameless Hush) reached apogee and hung; everything froze mid-bloom, at different stages of
expansion. The crowd is ash, faces turned up. The player arrives a few seconds late, the only reason they can move.

- Sky: night over a smoke-lit rose horizon, frozen bursts on the rim, the Hush (black paper shell, burning fuse)
  above the Mortar at the world origin, a spark thread from the mortar to the shell = wayfinding.
- Ground: shellglass (four centuries of fired salts fused the valley floor): glossy, reflects the blooms.
- Props: blooms on spark stems w/ name stakes (11 styles), ash-crowd figures (profile + back poses), mortar racks,
  gerbs, pinwheels, sky lanterns, cinder moths, smoke pillars, bandstand pavilion, prospect wheel, Great Mortar.
- Reading: walk to a stake/figure/notice -> caption (name, colour code, one line). Ledger counts names read.
- Ending (stretch): at the Mortar with >=12 names read, light it; the Hush finally bursts.

## Engine

- 2.5D billboard sprites, exact pitch-rotated projection, painter's sort, pooled `<use>` per symbol, DOM reconcile.
- Symbols generated procedurally into `<defs>` as `<g>`; colour/fog/LOD via CSS custom properties on each `<use>`.
- Fog = colour mix (no group opacity), quantised levels, style rewritten only on level change.
- Reflections = same symbol, flipped about its reflected centre, `--o` fresnel opacity.
- Sky in direction space (stars, far bursts, ridges, Hush) so pitch/yaw are exact; ground fog gradient tied to fog fn.
- Cells 28 m, deterministic hash, zones by low-freq noise. Adaptive quality vs best-seen cadence.
- Debug hook `window.__hangfire` (`step`, teleport, stats) + `?nointro ?x ?z ?yaw ?pitch ?q ?adapt=0`.

## Checklist

- [x] prototype: verify CSS-var + class + calc opacity + display:var + CSS animation inside `<use>` shadow trees
- [x] util/data/symbol generators + gallery page for art review
- [x] world gen + engine core + input (keys, drag, joysticks) — first screenshots
- [x] art pass: sky, ground, reflections, pools, figures, racks, structures
- [x] lore + reading + ledger + title + guide
- [x] audio (guarded), finale (stretch)
- [x] responsive + touch verification (390x844, 844x390, 820x1180, 1280x720), fps, console clean
- [x] index tile (alphabetical by model), memory notes
- [x] independent review findings addressed (12 findings, all fixed and re-tested)
- [ ] signed commit, push (blocked until 1Password approves the SSH signing request)

## Review

```text
Changed:
  svg-forest/sonnet-5.5-max-svg-forest.html   HANGFIRE, one file, ~160 KB, all visuals SVG (no canvas/WebGL/images/network)
  svg-forest/index.html                       tile + `badge--hush` theme, sorted between Sonnet 5 and Stealth / Space Bunny Alpha
  tasks/todo-hangfire.md                      this plan
Independent review (fresh-context agent, read-only, 98 tool calls) found 12 issues, none a spec violation. All fixed:
  1  quality controller hunted between levels for minutes   -> seeded from real samples, escalating probe steps, a floor-level failure ends
                                                               probing (unless things get much worse), upgrades verified; simulated on 10 device models
                                                               + real game at 2560x1440@2: 16 switches -> 2, ~26 -> ~41 fps
  2  Mortar culled when looking steeply up from close        -> tall props cull on their top, not their base
  3  hash3 XOR structure: a third of cells duplicated their point-mirror, ~8% of name reads swallowed -> sequential non-linear mixing (0% mirror, 0 collisions)
  4  held key flipped panels/mute                            -> repeat guard
  5  props at the frustum edges never loaded                 -> radial cull/fade + matching load radius; Mortar always in play (visible from afar)
  6  Space swallowed, dialog focus/labels, aria-pressed      -> Space left to buttons, focus moves to and returns from the dialog, R/F look up/down
  7  fuse button only while facing the Mortar                -> offered from any direction within 9 m
  8  caption/button collisions, 320 px title clip            -> caption height feeds a CSS var; stick size var; compact <=340 px layout
  9  malformed URL params blanked the scene                  -> validated params + NaN self-heal
  10 sticks not released on blur                             -> released on blur and when hidden
  11 reduced motion partial                                  -> flash capped, pulses off, no automatic retreat/lift (caption says "Look up.")
  12 giant burst glows transparent                           -> gradient vars added
  Also: opening seed chosen from a scan of 24 (Hush clear overhead, ash family in the foreground).
Proof (headless Chrome, CDP harness, software raster):
  keys/drag/head-bob; two-finger touch (both sticks live, release one, other stays); tap-to-begin; right stick looks up/down and auto-levels
  flow: title -> Begin -> banner -> guide/ledger -> names read; ending (Enter) fuse, step back, flash, giant burst, epilogue
  targeted review tests (t_review, t_layout2): 21 + 13 checks pass; layouts 320x568 .. 1280x720 incl. 480x320 and 768x1024
  bot walks to the Mortar from 8 directions in ~54 s at run speed, never stuck; 100 teleports/2 km: heap ~10 MB, DOM stable
  perf: 59.6 fps sprinting+turning at q3 1280x720; 39 fps at 1080p@2x (software raster); 4x CPU throttle settles at q0, 57-60 fps
Not verified:
  Safari / Firefox / real iOS or Android hardware (CSS var() paints inside <use>; a transparent fallback keeps the worst case "no glow")
  real GPU frame rates; audio by ear (graph runs without errors); a real 30 Hz device (controller simulated)
Risks:
  sprites are billboards, so looking almost straight up right beside a tall prop shows the flat sprite (the ending steps you back)
Next:
  signed commit + push once 1Password approves the signing request
```
