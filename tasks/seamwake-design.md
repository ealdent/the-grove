# SEAMWAKE — Keep the morning together

## The world, before the code

The world wears a funeral cloth. It is not dead yet.

For generations the night-workers stitched a new dawn into the eastern hem of an enormous cloth. The cloth is landscape: linen fields, rivers of dye, velvet valleys. Its knots are villages. Its folds are mountains. Every morning is made, by hand, from a length of living golden thread.

Tonight the last worker has disappeared. Her shears have become the Unpicker, a creature that mistakes silence for peace. It is cutting the cloth back into nothing. The destruction follows the cut, so staying still is impossible. One moth escaped from the worker's sleeve carrying the last living stitch. It rides her silver needle toward the eastern hem. Sew the morning before the Unpicker reaches the last seam.

One-sentence fantasy: fly a moth on a sewing needle across an unraveling funeral cloth to stitch dawn back into the world.

## A visual identity with physical rules

This is a textile world, not outer space. Everything has weight, wear, and construction. The ground is woven and folded. Dawn is a gigantic button caught in taut golden threads. Needles planted in the cloth are silver and dark at the eye. Porcelain button masks have holes, ridged rims, and warm ivory faces. Flying bobbins unwind real curling trails. The Unpicker has brass finger rings, crossed steel blades, and an exposed red seam at its hinge.

Art direction: candlelit ivory, tarnished gold, ink indigo, bruised mulberry, coral threat markings. Black means deep cloth shadow rather than a void. Large silhouettes, material shading, silk highlights, embroidery, atmospheric depth, shaft-like threads of sunrise, and a close, animated moth are the visual priorities. No pixel art, neon grids, starfields, floating HUD boxes, or generic spacecraft.

The interface is a specimen label from the missing worker's sewing book: Georgia capitals, small widely spaced sans-serif annotations, fine gold rules, thread spools for integrity, and an embroidered route. The title screen already travels through the world. Its left-hand text gives the right-hand vista room to sell the premise.

## The journey

The campaign takes approximately two to three minutes and grows faster across three authored phases. Wave onset is staged so play teaches movement and firing without stopping for a tutorial.

1. **The Ivory Orchard.** Warm linen dunes beneath honey light; planted needles and thread flowers establish physical obstacles. Gentle button-mask formations introduce automatic stitching. Needles first occupy one side, then weave across the course. Surviving the initial reach gives the player a free spool pulse.
2. **The Indigo Flood.** The cloth drinks its own dye. Blue silk reflects a copper sky; sharp red loose stitches rain through the air. Bobbin wasps orbit and fire aimed, delayed shots. Cross-thread formations and mirrored masks require vertical movement. The arrangement gains cello pulses and brushed loom percussion.
3. **The Red Selvage.** Red velvet swells under a pale sky. Tall needle forests, tighter enemy braids, and attacks combining vertical and horizontal gaps raise the intensity. The horizon contains the shadow of a pair of shears. The final boss physically enters the same flight space; the journey continues beneath it.

## Flight and combat

The moth moves in a free horizontal/vertical plane. WASD/arrows accelerate with a short, responsive damped response; moving the mouse engages direct spring-follow flight. The silver needle banks while the moth's wings beat and its cloak trails. The camera follows just enough to convey mass without fighting control.

The needle shoots luminous stitches automatically. Moving into the path of an enemy aims the stitches; a restrained aim assist keeps distant targets legible. Shots travel in world depth and use swept collision. Enemies stream from the horizon and become genuinely larger in perspective. Ivory buttons and bobbin wasps are shootable. Tall grounded needle obstacles cannot be destroyed, including by a spool pulse. Near misses reward thread charge and score; kills build a visible multiplier that decays after a missed encounter or injury.

Space releases a **backstitch** when the thread spool is full: a golden shock wave breaks flying enemies and incoming loose stitches, grants a short grace interval, and leaves the planted needles standing. Its charge refills by flying, kills, and close shaves. Five stitches of integrity allow mistakes; brief invulnerability and clear impact feedback prevent one formation from taking every life. A phase transition repairs one stitch.

## The Unpicker

Brass rings, long steel blades, a red hinge, and dangling thread give the boss an immediately readable physical identity. The hinge is the vulnerable point. Large visual and musical tells precede each attack:

- **Snip:** the blades open, a coral strip marks one vertical lane, then the shears send a flat wall of loose stitches through that lane. Leave the strip before it reaches the flight plane.
- **Comb:** the handles rotate; a horizontal row of threads advances with a conspicuous moving gap. Fly through the gap.
- **Unwind:** the hinge glows and winds up; a short burst tracks the player's position at the instant of firing. Keep moving after the sound resolves.

Below half integrity the Unpicker chains patterns faster, but every attack retains its tell and travel time. Boss damage flashes the hinge and sheds brass fragments. Victory opens the shears into a harmless frame, sews the sun button to the horizon, warms the linen, and resolves the chamber score. Failure tears the moth into strands and offers an immediate restart with the score, best score, journey reached, and near-miss count.

## Engineering and proof

One zero-dependency HTML file contains HTML, CSS, raw WebGL2 geometry/shaders, simulation, and procedural Web Audio. Depth rendering uses real perspective, animated material normals, fog, and a bounded bloom/composite pass. Instanced mesh buffers batch detailed repeated objects. No external assets, fonts, fetches, libraries, or build step. A real file URL is an acceptance target.

Bounded pools and maximum entity lifetimes constrain extended play. Variable frame time is clamped; collisions sweep between old and new depth values. Simulation and render clocks freeze during pause. Focus loss pauses, input is cleared, and resume requires a gesture. Mute persists safely when storage is unavailable. Context loss exposes a visible recovery action. Restart resets progression, entities, timers, visual transients, and input.

Proof must include source parsing, direct-file browser rendering, real keyboard/pointer/button flows, boss tell and damage coverage, obstacle immunity, loss/replay, victory/replay, pause/mute persistence, finite render buffers, a bounded performance sample, output audio signal, and an independent skeptical pass. Automated campaign evidence is distinct from a full human-earned victory. Do not claim 60 fps on untested hardware.
