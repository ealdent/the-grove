# Gutter Saint — world and implementation contract

Written before game implementation. GPT-6 Astra / Max, confirmed from current session turn metadata.

## The world

Every night, the Host eats a day that has not happened yet. His table extends beyond the horizon: drowned velvet, wine deep enough to sail, forks taller than trees, dishes worn smooth by centuries of appetite. The candles are the only things at supper that remember daylight. Tonight only one remains.

You are that last candle. A discarded silver spoon is your skiff, its bowl catching the wind from the Host's next breath. You travel toward his place setting because the only way out of a meal is through the mouth. If you stop, your flame goes out, and tomorrow is served cold.

Your flame throws hot beads of wax. Every fallen servant gives back a little stolen warmth. Flying dangerously close to cutlery feeds the flame; collected warmth can become a sweeping flare that clears attacks. The fork forests cannot be shot away. Read their height, pass between them, and skim their edges.

## Three courses

1. The Red Reception: burgundy wine, amber candlelight, old gold. Cork gnats arrive in readable arcs. Low fork stems introduce dodging; rings of wax reward movement. Tall branching candelabra and enormous rimmed dishes frame a moving wine surface.
2. The Bone-China Choir: cold celadon, pearl fog, blue porcelain. Porcelain moths split formations; bell-mouth cups throw aimed droplets. Tall broken plates and alternating fork gates demand altitude changes. The score adds bowed glass and quicker cutlery percussion.
3. The Black Dessert: scorched plum, ember orange, black sugar. Knife fish dive across lanes, enemies weave, fork forests thicken. Heat shimmers on a dark syrup sea. The final candlelight reveals the Famished Host.

The Host is a huge empty porcelain face, crowned with forks. Cracks glow where his cheeks should be. Three readable patterns: a gold fan preceded by lit fork tips; a ring of teeth with a visible opening; and a crimson gaze whose landing zones appear before the strike. Wounded, he alternates these more quickly. Killing him opens the plate behind him into dawn; the candle survives to light tomorrow.

## Art and feel

Baroque miniature, silver and ivory against saturated wine. Real perspective geometry, fog, lit facets, moving water, reflections, towering props. A hand-shaped spoon and bent wax body are always visible; flame and a trailing ribbon make motion legible. Elegant huge serif title with small warm typesetting, restrained borders and ornamental details. Enemies are recognizable objects with animated silhouettes, not abstract space ships. All meshes, shaders, typography, particles, music and sound are inline and original.

Movement is analog via mouse or accelerated WASD/arrows, with inertia that settles quickly. Forward fire is automatic to allow attention to threading gaps; Space/click sends a stored flare. A projected targeting mark shows the firing lane. Good hits throw porcelain chips and sparks. Near misses provide sound, points and flare charge. Damage has brief hit stop, shake and a clear invulnerability halo. Death spills the wax into the sea and offers an immediate retry.

## Scope and proof

One fully offline HTML; no CDN dependency, fetch, image, audio file or font. Three roughly 40-second courses followed by a multi-pattern boss; complete win and loss flows, score/combo/local best, pause/resume, mute, restart, visibility pause and resize safety. Sound starts on the user's start gesture.

Proof: inspect title and each course in real Chrome, move/aim/fire/dodge with actual inputs, test pause/mute/retry/win/loss and saved best, check console/network, file URL opening, bounded geometry and entity counts, measured frame times, deterministic combat and collision fixtures, independent skeptical review. Gallery attribution must use GPT-6 Astra / Max across filename, href and badges. Push only scoped reviewed files, reconcile concurrent main safely, verify remote commit.
