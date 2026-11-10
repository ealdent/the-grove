# HOLD FAST — tower defense (Fable 5.2, max effort)

Deliverable: `tower-def/fable-5.2-max-tower-def.html` (single file, no dependencies) plus a card in
`tower-def/index.html`. Green field: no other game in this repo was opened for ideas.

## Lore bible (written before any code)

**Premise.** Every sailor's tattoo is a charm, and every charm is bought on credit. Each time a
charm worked (each time the sea should have had him and did not) the sea wrote it down.

**The sleeper.** Ned Curnow, Able Seaman, born Falmouth 1866. Forty-one years at sea (1880 to 1921).
It is the winter of 1934 and he is asleep in a rented room above a ship-chandler's on Arwenack
Street. The tide comes up the stairs at night to settle the account.

**The rope.** The sea walks in along the rope inked round his body, heading for the heart, where
MOTHER is written (Ada Curnow, 1841 to 1909; his first tattoo, done the night before he first
sailed, aged fourteen). An old man turns in his sleep, so the rope never lies the same way twice.
That is the random track, and "Turn over" is the new-game button.

**You** are the ink. The tattoos wake when he sleeps.

**Time** is kept the way a ship keeps it: three watches of eight bells, one bell each half hour.
First Watch (8 pm to midnight), Middle Watch (the graveyard watch), Morning Watch (4 to 8 am).
Twenty-four bells = twenty-four waves; the bell is actually struck in pairs at each wave start.
"Eight bells" is also what is rung for a dead sailor, which is the game's quiet double meaning.

**Luck** is the currency (a sailor carries luck like tobacco: it can be spent and it can run out).
Turning a collector back takes back the luck it came to repossess. **Heart** is the life total.

**The wreck.** The barque *Marigold* of Falmouth, lost off the Horn in 1894 with all hands but one.
He came ashore on a hencoop, a few months after a Honolulu needle-man put a pig on one foot and a
rooster on the other. The Shipmates who walk the rope late in the night are her crew: "They mean no
harm. They only want you to come along." He is the one the sea missed.

**Nell** kept a lamp in the window eleven years, then stopped, and was right to.

**Ending.** Dawn: eight bells, the rooster crows, the tide goes out. It will be back tonight. It is
owed, and it is patient. But ink is patient too. Defeat: "he slipped his cable at N bells".

Period detail used: swallows per 5,000 nautical miles; anchor for the Atlantic; full-rigged ship
for rounding the Horn; pig and rooster against drowning; HOLD FAST on the knuckles for grip aloft;
hand-poked work before O'Reilly's electric machine (Chatham Square, 1891); Hori Chiyo's Yokohama;
St Anthony Head light at Falmouth; the Lizard's two lights (until 1903); Mother Carey's chickens
(storm petrels); corposants (St Elmo's fire); purple transfer stencils.

## Tattoos (towers): five, four upgrades each

| Key | Tattoo | What it does |
|---|---|---|
| 1 | The Swallows | Birds leave the skin, strike, and fly home. More birds per upgrade. Reach the air. |
| 2 | The Anchor | Heavy hook that ignores shell and hauls its catch back down the rope. |
| 3 | The Light | A turning beam: flash damage, dazzle (slow), burns off fog. Reaches the air. |
| 4 | The Clipper | Long-range broadsides that rake the rope. Blind close in. |
| 5 | Pig & Rooster | Hop onto the rope and brawl, holding collectors in place. Capstone cheats one leak per bell. |

Every upgrade is a later sitting in another port, with a line of the life attached.
Plus the HOLD FAST knuckles: a charged grip that freezes everything on the rope.

## The sea's collectors (enemies): each one is a specific debt

Whitecap (fodder), Bilge Rat (fast), Barnacle (armoured, slow), Storm Petrel (flying), Fogbank
(halves reach into it), Corposant (blinks, cannot be held), Riptide (hastes neighbours),
Man-o'-War (bursts into bluebottles), Doldrum (vast, becalms tattoos), Siren (sings a tattoo to
sleep), Shipmate (the *Marigold*'s crew). Bosses at eight bells of each watch: the Dutchman,
Mother Carey, the Locker.

## Look

Old-school flash: cream skin, bold blue-black line, red / gold / green fills, hard shadows, a
hand-built stroke alphabet for all display lettering (no font files). Placement shows a purple
transfer stencil that is then inked in. Tattoos that go out to fight leave their stencil behind.
The sea is drawn in indigo wash, and leaves wet marks that dry. Lamp light, then moonlight, then dawn.

## Plan

- [x] Theme, lore, design (this file)
- [x] DOM-free simulation (seeded rope generator, towers, collectors, 24 bells)
- [x] Balance with a headless bot across seeds, board shapes and skill levels
- [x] Art: stroke alphabet, tattoo pen, towers, collectors
- [x] Renderer, UI, audio (all synthesised)
- [x] Verify in real browsers: desktop, phone portrait, phone landscape; console clean
- [x] Fresh-eyes code review, findings fixed
- [x] Index card, commit, push to main

## Review

**What shipped.** One 211 KB file, about 3,660 lines, nothing loaded. Five tattoos with four
sittings each, eleven collectors plus bluebottles and three bosses, twenty-four authored bells in
three watches, a build phase between every bell, three difficulties, a seeded random rope
(`?night=N` replays one), a charged HOLD FAST grip, a Book (how it works, the flash, the ledger),
synthesised bell, needle, sea and concertina, and best-run memory in localStorage.

**How it was built.** Parts in gitignored `tmp/holdfast/src/` (maths, data, sim, lettering, art,
sea, render, audio, ui, css, markup) concatenated by `build.mjs`; the shipped file is plain,
unminified source and is the thing to edit from here on.

**Balance** (24 seeds per cell, win rate desk / phone; bots, not people):

| | upgrade-first bot | cheapest-next bot | noisy casual bot |
|---|---|---|---|
| Landsman | 100 / 100 | 100 / 100 | 83 / 92 |
| Able Seaman | 96 / 100 | 92 / 96 | 67 / 79 |
| Old Salt | 67 / 79 | 8 / 17 | 17 / 21 |

Mono-tower builds and base-towers-only builds lose. Damage share in a mixed build: swallows 34%,
clipper 28%, light 21%, anchor 13%, pig and rooster 3% (their job is holding, not damage). The
first curve was boss-gated (no leaks, then a coin flip at the Locker); fixed by tougher, quicker
ordinary tanks, about a third less boss HP, and thinner boss summons, so hearts now go at bells
7, 14 to 16, 19 to 20 and 22 rather than all at 24.

**Checked.**
- Full 24-bell night played through the real page by an in-page bot, desktop and phone: clean
  console, 60 fps in software rendering.
- Real mouse, keyboard and touch input through CDP: place, drag out of the tray, press-slide-lift,
  select, upgrade, target, two-step wipe, pause, book, lose, restart (35 checks), plus 12 regression
  checks for the review findings.
- Thirteen screen shapes from 320x568 to 2560x1080: nothing off-screen or overlapping.
- Mobile Safari (iOS 26.5 simulator): load, safe areas, start with sound unlocked, pick, place,
  select, upgrade, strike the bell. Brief: another session was using the simulators.
- Sound rendered offline through a fake AudioContext: every cue fires, peak 0.77, music about
  12 dB under effects. Nobody has listened to it.
- 240 random-action games with invariants checked every few ticks: no faults, no stuck bells.
- A fresh-eyes review found 18 things; fixed: HOLD FAST button covering the rope and sometimes the
  heart on phones (it now sits beside the bell), key auto-repeat confirming its own "Sure?",
  saved "sound off" ignored on the title card, bell never swinging, Man-o'-War always drawn
  small, selling after the night ended, stale heart count, `?tier=constructor`, long-press
  cancelling placement on touch, weather left on screen after a loss, four descriptions that did
  not match the numbers, and a first-crossing-the-Line date that came after Callao.

**Not verified.** Firefox and desktop Safari were not run. Android was only emulated. Balance
figures are from bots; a person has not played it through.
