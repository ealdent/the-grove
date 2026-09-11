# Pixiecast roster — five kinds of pixie (utils/pixiecast.html)

Goal: selectable pixies of different kinds (not palette swaps): gender incl. non-binary, skin tones,
distinct anatomy (ears, wings, hair, horns/antennae, build), a home prop, a full wardrobe kit in their
own style, and their own voice in the dressing note.

## Plan
- [x] Pixie data model: PIXIES (name, kind, pronouns, blurb, skin/hair/eye palette, anatomy flags, scale, home, voice, lines, kit)
- [x] Kits as data: garments {id, label, shape, st} per slot/band; dress() reads the active kit
- [x] Parametric garment drawers keyed by shape (sleeveless/tee/longsleeve/sweater/coat/parka, shorts/skirt/pants/snowpants,
      sandals/bare/sneakers/boots/rainboots/snowboots, raincoat/poncho/vinyl/oilskin, umbrella kinds, hats, holds, shades)
- [x] Anatomy drawers: wings (gossamer/leaf/moth/ember/dragonfly), ears (pointed/long/tufted/small/fin), hair styles
      (bob/locs/undercut/flame/crest) × states (normal/windy/wet/frizz, covered by hat), extras (antlers/antennae), eye styles
- [x] Homes: toadstool, stump, moon lamp, kiln, reeds
- [x] Picker UI with live portraits; persist pixie in localStorage + ?pixie=; name/pronoun-aware copy
- [x] ?gallery view: every pixie × preset for a wardrobe overview (and my own verification)
- [x] Verify in Browser pane: each pixie across presets, picker, persistence, console clean; update README/index blurb
- [ ] Commit (signed, pathspec-only) and push

## Review
(2026-09-10)
- The roster: Wisp (meadow, she/her, light warm skin, teal bob, gossamer wings, toadstool), Bramble (hedge, he/him, deep brown skin,
  moss-green locs, twig antlers, oak-leaf wings, taller build, hollow stump), Nix (moth, they/them, lilac-grey skin, silver undercut,
  feathered antennae, eyespot moth wings, big dark eyes, slim build, moon lamp), Ember (hearth, she/her, terracotta-brown skin,
  flame-gradient afro that steams in rain, ember wings, gold freckles, clay kiln), Fen (river, he/him, golden-tan skin, slicked crest,
  fin ears, dragonfly wings, stocky build, reeds and a frog).
- Each kit re-skins every slot: 6 tops, 4 bottoms, 5 kinds of footwear, rain layer (slicker / oilskin cape / clear vinyl / poncho /
  sou'wester oilskin), an umbrella that is a leaf, a lily pad, a moth wing, or a fringed parasol, 4 hats, scarf, mittens, shades,
  and four held things (lantern / firefly jar / moon jar / struck match / glass float, etc.).
- Verified in the Browser pane: `?gallery` renders 50 scenes (5 pixies × 10 presets) with an empty console; full-size checks of
  Bramble rain + arctic, Nix night + drizzle (translucent vinyl), Ember heat + storm (steam), Fen rain + gale (inverted lily pad);
  clicking a portrait switches pixie, rewrites the heading/note, sets `?pixie=`, saves to localStorage, and toggles aria-checked;
  390px layout has no horizontal overflow with the picker centred.
- Not verified: live geolocation success path (pane denies location); portraits eyeballed only at picker size.
