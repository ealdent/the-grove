# Pearlwatch: Dentistry for a Sleeping Moon

Original design, authored before implementation. No prior game artifacts are creative references.

## World and premise
The moon is a sleeping animal called Nacre. Its teeth break the surface as islands. Their enamel reflects sunlight; their roots move the tides. For generations, people lived on the crowns and mistook the soft glow beneath them for geology. Water miners pierced a molar. Acid organisms from the hollow jaw have found that bore and now follow its cooling channels toward the living root.

You are Iona, the last dentist on the night shift. Your teacher vanished into the bore, leaving five peculiar tools and a handwritten warning: save the tooth without waking the moon. The inhabitants are not the intruders' natural enemies; drilling caused the breach. Winning seals the channel and lets both the islanders and the creatures live in their respective depths. Tower kills are neutralizations, not exterminations. The last boss is an acid pressure vessel, not Nacre.

The story progresses through four six-wave acts: discovery, the work of repair, the teacher's signal, and closing the wound. Brief written shift notes and wave names carry the lore without blocking play. End state acknowledges the repair, not conquest.

## Visual direction
An enamel garden suspended in ink-blue space. Irregular ivory plates, carved concentric growth lines, dark organic seams, a coral-lit coolant channel, mint light at the living root. Towers are tiny dental automata with copper hardware and distinctive moving silhouettes. Enemies are asymmetric soft creatures and mineral shells with expressive faces. Editorial serif title, crisp system-font UI, mono numerals. Warm white, jade, coral, midnight, muted brass. Canvas artwork drawn entirely in code; no images or fonts to load.

## Play
24 authored, progressively stronger waves. A freshly randomized meandering channel per run. Build sockets grow beside the route and have generous pointer/touch hit targets. Between waves the game waits indefinitely for refits; starting the next wave is always an explicit action. Manual pause, 1x/2x/3x speed, optional synthesized sound, keyboard shortcuts, a once-per-wave emergency Rinse. Towers may be built and refit during a wave as well.

Start with enough enamel credit for several complementary tools. Neutralizations and successful shifts award credit. The root has 24 integrity. Sell returns 75 percent of total investment. All five tools have a base level plus four sequential upgrades, named stages with explicit next-level effects. Useful upgrade descriptions and targeting options (first, strongest, nearest) are available on the selected tool.

## Five tools
1. Pinprick Observatory: accurate brass needle, high single-target damage; upgrades add range, cadence, penetration, then a powerful regular puncture.
2. Floss Harp: rotating silver threads that bind several creatures and slow them; upgrades add duration, range, damage and binding capacity.
3. Clove Still: violet vapor coats enemies with armor-bypassing damage over time; upgrades increase coating, linger, reach and spreading splash.
4. Molar Press: porcelain jaw with a copper piston, slow area strikes; upgrades increase impact, radius, reach and aftershock.
5. Halo Mirror: suspended curved mirrors that send mint light between creatures; upgrades add chain links, range, damage and amplification against bound creatures.

Every tower's outline and attack animation must communicate its role before text is read. Four upgrade prices and measurable stat increases per tower.

## Seven enemy kinds
Sour Drop: baseline acid blob. Sugar Mite: tiny, much faster and fragile. Tartar Baron: slow, heavily armored mineral shell. Thread Leech: fast, slowly regenerates. Split Husk: breaks into two smaller mites on neutralization. Choir Pearl: absorbs initial damage in a visible shield. Jawbreaker: huge slow acid-pressure boss with heavy armor and a large root penalty; appears at act boundaries, with a reinforced final form.

Enemy HP scales with wave; speed and armor stay distinct. Telegraph the next wave with counts, types, and the specific threat. Keep early waves forgiving enough to discover each tool. Late waves require a mixed upgraded defense and considerate use of Rinse.

## Acceptance and evidence
The saved HTML opens directly via file://, runs offline, and makes no requests. Check base and all four upgrades for each tool, affordability, hit-target placement, targeting, slow/DoT/splash/chain, armor, shields, splitting, regeneration, rewards, leak penalties, pause, speed, Rinse reset, explicit intermissions, terminal states and replay. Sample many route seeds for valid endpoints, adequate length, non-overlapping path, and at least 28 usable build sockets. Prove a complete 24-wave game with credit actually earned in play. Inspect responsive desktop and narrow portrait layouts, canvas sizing, button readability, and no horizontal overflow. Exercise a real user flow with mouse and touch emulation.

Scope remains four authored files: the game, gallery tile, this design, and the task-plan section. Test drivers and screenshots are temporary verification artifacts outside the repository.
