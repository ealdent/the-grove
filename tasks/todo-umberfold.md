# Umberfold — shadow-play tower defense (Opus 5.5 · Max)

Deliverable: `tower-def/opus-5.5-max-tower-def.html` (single file, no dependencies) plus a gallery
tile in `tower-def/index.html` between Opus 5 and ox-alpha.

## Lore (written before implementation)

**Umberfold** is a valley town so far north that every winter the sun drops behind the Tallowback
mountains and does not come back for forty days. They call it the Long Dark. Oil is money there, and
a candle stub is a gift.

Without the sun to cast them fresh each day, shadows slowly forget whose they are. On the fortieth
night, the longest one, they come loose all at once and crawl toward the last light still burning:
**Old Sun**, the great lamp behind the paper screen of the Lanternwright Theatre. Shadows blame the
light for cutting them loose, so they mean to put it out.

For three hundred winters the Lanternwright Players have performed *The Long Night*, a shadow play
in twenty-four scenes that runs from dusk to the first sunrise. A shadow that sees its own shape
performed remembers it, and a shadow that remembers its shape goes home.

**Master Orrin Moth** led the Long Night for fifty-one winters. He died this afternoon in his chair
in the wings, with the prompt book open on his knee. You are his apprentice. He called you
*Little Wick*. Tonight the lamp is yours.

Threads to reveal slowly, only through margin notes, bestiary lines and the ending:
- Lune, the mirror puppet, is modelled on **Lunet**, Orrin's wife. She silvered mirrors for a living
  and drowned when the ferry went down in the flood forty-four winters ago.
- The penny-farthing was hers. The town clock stopped at twenty past four that night. Scene XVI is
  the ferry. Orrin says there is always one passenger too few.
- The Teller is Orrin's self-portrait. The last shadow of the night is his own. The last page of the
  prompt book has no note, only a small drawing of a moth.
- One seat in the front row is empty all night. At dawn a moth settles on it.

### How the lore maps to mechanics
| Fiction | Mechanic |
|---|---|
| The backlit paper screen | Playfield. A new road is cut from the dark rim to the lamp's eye at the centre every night (seeded; `?night=N` replays one) |
| Old Sun's flame | Lives. Each shadow that reaches the eye drinks flame and the whole screen dims |
| Sending a shadow home | Kills. A wisp flies to its owner in the audience, who bounces |
| Coppers thrown by the audience | Currency |
| The master's puppets | Five towers. Pressed to the screen they're crisp, held away from it they blur (placement animation) |
| Scenes and intermissions | Waves. Between scenes you upgrade, and you can re-block (move) puppets for free |
| Dawn | Victory after scene XXIV. Encore (endless) unlocks afterwards |

## The Company (towers, 1 base + 4 upgrades each)
1. **Madame Snip, Tailor-Heron.** Quick, close cutting. Whetstone Beak → Pinking Edge (fray bleed) →
   Second Neck (two targets) → The Last Alteration (every 4th snip is a clean cut and executes).
2. **Old Glim, Lamplighter.** Light aura that burns everything in it, ignores glaze and reveals the
   Faint. Brass Chimney → Pitch & Tallow (scorch: +15% damage taken) → Seven Wicks (flare pulse) →
   The Lighthouse (a rotating long beam).
3. **Bramble, Drum-Bear.** Pulses that hurt and slow in an area. Taut Hide → Double Beat → Thunder
   Skin (daze) → The Mountain Drum (every 4th beat booms: pushback is capped per target, and it reveals).
4. **Lune, Mirror-Bearer.** Long piercing beam reflected from the lamp. Up to +30% damage the closer
   she stands to Old Sun. Polished Silver → Burning Glass (burn) → Twin Moons → Eclipse.
5. **The Teller.** Support aura (damage and rate for nearby puppets, which doesn't stack) plus glyph
   shots. Rhyme & Meter → Foreshadowing (reveal, +range) → Plot Twist (turns a shadow around) →
   Once Upon a Time (bigger aura, +50% coppers, chaining glyphs).

## Loose shadows (enemies)
Wanderer (baseline), Moth (fast swarm), Cat (pounces), Penny-farthing (very fast, resists slows),
Teapot (glazed armour), Umbrella (shelters neighbours from light), Wardrobe (slow tank, full of
moths), Crow (hops, untouchable mid-air), Faint (invisible outside light), Mourner (heals), Ox (heavy,
ignores crowd control), Gossip (splits into two Whispers).
Bosses: Grandfather Clock (VIII, chime freezes puppets), The Last Ferry (XVI, drops passengers),
The Shadow in the Wings (XXIV, summons, bows twice, dawn sends everything home).

## Plan
- [x] Lore, towers, enemies, scene list
- [x] Engine: seeded road generator (edge → centre, no touching), movement, targeting, statuses
- [x] Five puppets × five tiers, twelve shadows plus three bosses, 24 scripted scenes plus Encore
- [x] Rendering: glowing paper screen, crisp articulated puppets on rods, soft blurred shadows,
      audience band with wisps, lamp dimming, dawn and gutter sequences
- [x] UI: top bar, company tray, inspector with the 4-step upgrade ladder, next-scene card with
      margin note and cast, title screen with difficulty tickets, prompt book (lore, bestiary,
      margins), pause menu, end screen, saved nights (resume between scenes)
- [x] Responsive: side panel on wide screens, bottom panel on portrait and phones, and the grid is
      transposed in portrait whenever that gives bigger squares
- [x] WebAudio sound (synthesised, mutable), keyboard shortcuts, reduced motion
- [x] Verification (details below)
- [x] Gallery tile, commit, push

## Review

What shipped: a single 236 KB HTML file with no external requests (fonts are system stacks, the
paper grain is an inline SVG data URI, and all sound is synthesised with WebAudio). The board is
seeded (`?night=N`), so every visit cuts a new road unless one is asked for.

Verification, all headless Chromium (Playwright) against the built file:
- Road generator: 500 seeds, no failures; every road runs rim → eye with 4-connected steps, has no
  touching stretches (8-neighbour clearance), and is 49–56 cells long.
- Balance, with a scripted bot that plays whole nights through `window.__umbra` (nights reaching dawn):
  | House | upgrade-first | build-wide | never upgrades | herons only |
  |---|---|---|---|---|
  | Matinee | 4/4 dawn | 4/4 | 4/4 | 2/4 |
  | Evening | 4/4 | 3/4 | 3/4 | 0/4 (gutters at IX–X) |
  | The Long Night | 2/4 | 0/4 | 0/4 | 0/4 (gutters at VIII) |
  No scene ever stalled (every scene either cleared or ended the night). The Clock (VIII), the
  wardrobes (IX) and the oxen (XIII) are the deliberate walls.
- UI flow with real clicks and keys (21 checks), phone touch flow (7), save/resume (7) and the
  code-review regressions (10) all pass, with no console errors or warnings. The UI flow ran six
  times in a row without a failure once its own placement randomness was removed.
- Layout at nine viewports (1920×1080 down to 360×640, phone landscape, iPad both ways, DPR 1 and 2):
  no page overflow, the Upgrade button is always reachable without scrolling, and the canvas backing
  store matches CSS size × DPR.
- Performance: the simulation step costs about 0.06 ms. The renderer was profiled: puppets are baked
  to per-tier sprites with only their moving parts drawn live, and the canvas is capped near 3.6 MP.
  Headless (software raster, no GPU) a crowded late scene renders at about 13 ms at 1440×900.

Independent code review (a subagent that read only the game file) found five real defects. All are fixed and
covered by `fixes` checks:
1. Closed dialogs were only transparent, so Tab could still reach and trigger their buttons (for
   example "Cut a new road" mid-scene soft-locked the game). Closed overlays are now
   `visibility: hidden`, and the game is `inert` while any dialog is open.
2. A lost night could become a win if the final boss died later in the same simulation step that
   guttered the lamp. Dawn can now only begin from a live scene.
3. Key auto-repeat confirmed a press-twice sale and toggled pause at random. Repeats are ignored.
4. Resuming a saved night forgot the full refund on puppets bought that intermission. The save
   now keeps it. Starting a new night also clears the single save slot.
5. Upgrades and sales still worked during the dawn and gutter sequences. Both are now refused
   there, and the selection is dropped.

Lessons applied from `tasks/lessons.md`: knockback is a capped impulse with a per-target cooldown;
buffs are recomputed only when the company changes; static layers are cached offscreen; canvas
`style.width/height` are set explicitly and checked at DPR 2; the road generator exempts the previous
two cells from its clearance rule and its invariants were checked numerically; commits name their
paths explicitly.
