# STET — tower defense in movable type (Sonnet 5.5, max)

```text
Goal:        one self-contained tower-def page, random track every load, 5 towers x 4 upgrades,
             varied enemies, 27 waves, upgrade bench between waves, professional + quirky, responsive.
Project:     the-grove (personal)
Deliverable: tower-def/sonnet-5.5-max-tower-def.html  +  a tile in tower-def/index.html (alphabetical by model)
Constraints: zero dependencies / network; system font stacks only; green field (no other tower-def pages consulted).
Non-goals:   no build tooling committed; no external assets.
Proof:       headless Chrome (CDP, exact viewports): no console errors, scripted bot playthrough of all 27 waves,
             screenshots at desktop / tablet / phone; Node sim runs for balance.
Risks:       untested balance -> bot sweeps over seeds and map aspect ratios; sprite/font fallback across platforms.
```

## Concept

**STET** — the last print shop of a city that wrote everything down. The map is a printed page of names (the Roll);
the enemy path is a white typographic river through it; towers are type sorts (dagger, ampersand, pilcrow,
interrobang, fleuron); enemies are printing defects (typos, widows, orphans, ghosts, redactions...). Lives are
*Names*: leaks erase them from the page. Each of 27 waves is one letter of the alphabet (A-Z, then &).
Upgrades are only possible on the Bench (between waves) because a running press has a locked forme.
Lore lives in: title prologue, per-chapter marginalia (which black out as names are lost), bestiary, tower blurbs,
and the two names in the V block marked with a red hand. Full bible kept with the session scratch notes.

## Plan

- [x] Lore bible + mechanics decided before any code
- [x] Sim core (map gen, towers, enemies, waves, economy) + Node bot for balance
- [x] Art (paper/riso look, names page, glyph towers, enemy sprites, particles, printing-press sweep)
- [x] UI (HUD, type case, inspector, bench, chapter plates, errata, menus) + responsive + input (mouse/touch/keys)
- [x] Audio (WebAudio synthesized SFX + generative score), polish, hints
- [x] Verify: console clean, full bot run, screenshots (desktop / tablet / phone portrait / phone landscape)
- [x] Skeptical review pass (separate agent) and fixes
- [x] Add tile to tower-def/index.html, commit (signed), push

## Review

```text
Changed:   tower-def/sonnet-5.5-max-tower-def.html (one file, ~212 KB, no network, no dependencies)
           tower-def/index.html (card between Sonnet 5 and Space Bunny Alpha, Anthropic logo, Max)
           tasks/todo-stet.md (this file)
```

**What it is.** STET: five type sorts (Dagger, Ampersand, Pilcrow, Interrobang, Fleuron), four named retunings each,
14 enemy kinds (11 ordinary, 4 bosses incl. the finale), 27 chapters (A-Z, then &) plus an endless second printing,
a random river per edition (`?seed=` reprints one), three difficulties, upgrades locked while the press runs and open
on the Bench between chapters, DELE and STET marks, generative score + synthesized SFX, keyboard and touch play.
Lore is carried by systems: lives are Names erased from a printed page, cleared chapters are rolled solid, the
marginal notes black out as names are lost (`~soft~` words) except the dotted *stet* words, two names in the V block
carry a red hand.

**Proof.**
- Mechanics: 59 assertions (`mech_test`) check every upgrade against its tooltip (pierce, Dele, chain length, Tie echo,
  Pilcrow slow/rubric/push/freeze with immunity windows, two shells, Fleuron buffs/income, refunds, forme lock).
- Balance (DOM-free sim + Node bots, 48 runs per cell): Rough Draft ~96% win for the good bot, Proof ~45-75%,
  Fine Press ~35%; careless builds mostly die in chapters 9-16 on every tier; mono-Dagger/Ampersand builds lose.
- Headless Chrome via CDP at exact viewports (390x844 dpr2, 844x390, 568x320, 820x1180, 1024x768, 1280x720, 1920x1080,
  360x640, 2560): no console errors, no horizontal overflow, no external requests.
- Full 27-chapter playthroughs through the real UI loop (desktop and phone size); 4 fuzz seeds x 180 random
  clicks/keys/resizes; touch two-step placement; keyboard-only placement; audio recipes run without exceptions.
- 60 fps with 78 enemies + 19 towers (software raster; draw 0.4 ms, sim 0.06 ms per frame).
- Independent skeptical review (separate agent, 10 findings + lows). Fixed: landscape phones <720px got the portrait
  layout; difficulty varied with window size (speed now `1.05*(len/45)^0.3`, HP nudged for very long/short rivers);
  resizing un-printed chapters and re-rolled erased names; Roll missing letters on tiny phones; Fleuron auras one
  upgrade stale; DELE could not kill a paired Moire, Dele could delete three stacked enemies; DELE stayed armed after
  a wave; Enter/Space on the title ignored focus; no dialog focus trap; board not keyboard-operable; short-window
  inspector hidden behind the marks bar; plus lows (`?diff=0`, tooltip numbers, Hyphen split healing, stun immunity
  blocking the freeze, end-screen focus, a nested-markup lore bug).

**Not verified.** Sound by ear (only that the synth code runs and an offline render has sane levels); real iOS/Android
Safari (touch is emulated); balance is measured against bots, not people; reduced-motion and blocked-localStorage paths
are covered by reading, not by a run.

**Risks.** The bots still find Fleuron and Pilcrow near-mandatory and the last three chapters (especially the Blank,
whose Hush silences towers within 3 tiles) are the wall; Proof may feel hard to a casual player, Rough Draft is there.
`window.__stet` (debug handle) is left in the page.

**Next.** If it plays too hard in practice, `TUNE.gm` (global health) in `02-data.js` is the single dial.
