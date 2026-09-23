import json
F = ("Retro 1990s arcade 3D game art in the spirit of early texture-mapped polygon shooters: chunky low-poly shapes with crisp "
     "hand-painted pixel-art textures, bold readable silhouettes, slightly exaggerated proportions. Palette by role: scenery in each "
     "zone's own saturated palette, enemies in vivid purple, magenta and gold with glowing cyan or red eyes, the hero rocket in orange "
     "and cream. Bright heroic mood, flat even lighting. High contrast between game elements and backgrounds, clean edges.")
def tile(desc, view="viewed straight from above"):
    return (f"seamless tileable game texture tile of {desc}, uniform pattern density, {F}, perfectly seamless edges that wrap "
            f"horizontally and vertically, no border, no vignette, flat even lighting, no single focal object, {view}")
def pano(desc, key):
    return (f"wide 360-degree panoramic game skybox horizon strip of {desc}, the distant skyline fills only the bottom third of the "
            f"image, {F}, everything above the skyline is one flat solid uniform bright {key} color with no clouds and no gradient, "
            f"the left edge continues seamlessly into the right edge, no foreground, no characters, no text, no sun")
def concept(desc):
    return (f"game 3D asset concept of {desc}, single object, three-quarter isometric view showing top and two sides, centered, {F}, "
            f"low-poly faceted geometry, on a pure flat white background, no shadow, no ground plane, nothing cropped at the edges")
jobs = []
T = lambda i, d, v="viewed straight from above": jobs.append(dict(id=i, model="nano_banana_2", ar="1:1", prompt=tile(d, v)))
# terrain: ground, highland, cliff rock per zone
T("t_meridian_ground", "lush short meadow grass with tiny clover leaves and small flower specks, bright spring green")
T("t_meridian_high", "golden dry grass turf with wheat-colored tufts, warm yellow")
T("t_meridian_rock", "layered tan sandstone cliff face with horizontal strata and small cracks", "viewed straight on")
T("t_saffron_ground", "fine rippled orange desert sand with scattered small pebbles")
T("t_saffron_high", "cracked dry red clay earth with small stones")
T("t_saffron_rock", "red sandstone mesa cliff wall with bold horizontal strata bands", "viewed straight on")
T("t_noctiluca_ground", "dark indigo glassy stone ground with faint thin glowing cyan cracks")
T("t_noctiluca_high", "deep violet crystalline rock surface with small magenta glints")
T("t_noctiluca_rock", "dark blue-violet basalt cliff made of hexagonal columns", "viewed straight on")
T("t_emberfall_ground", "black volcanic ash ground with thin glowing orange ember cracks")
T("t_emberfall_high", "dark grey cooled lava rock with rough bubbly texture")
T("t_emberfall_rock", "black obsidian cliff face with thin red magma veins", "viewed straight on")
T("t_cirrus_ground", "pale lilac marble with soft white veins")
T("t_cirrus_high", "pink rose quartz stone with soft white inclusions")
T("t_cirrus_rock", "white chalk cliff face with thin lilac strata lines", "viewed straight on")
# prop materials
T("m_stone", "smooth carved pale stone blocks with fine chisel marks", "viewed straight on")
T("m_bark", "rough brown tree bark with vertical grooves", "viewed straight on")
T("m_metal", "plain brushed gunmetal grey steel panels with rivets along the seams and light scratches, no icons, no symbols, no pictures, no colored panels", "viewed straight on")
# horizon panoramas (keyed sky)
P = lambda i, d, key: jobs.append(dict(id=i, model="gpt_image_2_5", ar="21:9", quality="high", res="2k", prompt=pano(d, key)))
P("p_meridian", "misty slate-blue mountain ranges behind rolling green hills and a few distant red-and-white striped stone columns", "magenta #FF00FF")
P("p_saffron", "a red rock desert of flat-topped mesas, tall buttes and thin hoodoo spires in warm orange haze", "green #00FF00")
P("p_noctiluca", "dark indigo mountains at night with tall glowing cyan and magenta crystal spires", "green #00FF00")
P("p_emberfall", "black jagged volcanoes with glowing red lava flows and dark smoke plumes", "green #00FF00")
P("p_cirrus", "towering white and pink cloud castles and floating lilac rock islands", "green #00FF00")
# effects
jobs.append(dict(id="fx_explosion", model="gpt_image_2_5", ar="1:1", quality="high", res="1k", prompt=(
    "a 4x4 grid sprite sheet of 16 animation frames of a cartoon fireball explosion, frames in reading order from a small white-hot "
    f"flash to a large billowing orange and yellow fireball to dissipating dark grey smoke puffs, each frame centered in its own cell, {F}, "
    "on a solid pure black background, no grid lines, no text, no borders")))
# 3D concepts
C = lambda i, d: jobs.append(dict(id=i, model="nano_banana_2", ar="1:1", prompt=concept(d)))
C("c_skate", "a flying manta-ray shaped alien attack drone with wide swept wings, a glowing cyan eye at the nose, purple and magenta armor plates with gold trim")
C("c_mask", "a floating ancient stone head idol with a heavy brow, glowing red eyes, a stern carved face and a flat stone crown, weathered tan stone with gold inlay")
C("c_spinner", "a floating spiked mine orb with six long gold spikes, a red armored core and a glowing yellow center")
C("c_turret", "a squat armored ground cannon turret with a domed swivel head and one thick barrel, gunmetal grey with orange warning stripes and a red sensor eye")
C("c_wyrmhead", "the head of a serpentine green dragon with swept-back golden horns, glowing yellow eyes, an open jaw with white teeth and cream belly scales")
C("c_wyrmseg", "one short armored body segment of a serpentine green dragon, a thick scaled drum shape with one golden dorsal spike on top, two small pink side fins and cream belly plates")
C("c_halocore", "a large faceted magenta and violet crystal gem with a glowing white center, held by four grey metal petal plates")
C("c_halopod", "a small floating cyan crystal drone pod shaped like an octahedron with a glowing white ring around its middle")
C("c_rider", "a pilot in an orange flight suit and white helmet lying prone on top of a long orange-and-white striped rocket, gripping handlebars near the dark steel nose cone, small swept fins at the tail, seen from the rear-left")
C("c_tree", "a stylized round-canopy tree with a chunky brown trunk and a lumpy bright green crown")
C("c_bush", "a lumpy round bright green bush made of a few leafy clumps")
C("c_boulder", "a large rounded grey-tan boulder with a few cracks and patches of moss")
C("c_crystal", "a cluster of tall clear cyan crystal shards growing from a small dark rock base")
C("c_mushroom", "a giant fantasy mushroom with a thick pale stem and a wide glowing magenta cap with white spots")
C("c_deadtree", "a gnarled dead black tree with twisted bare branches and faint glowing ember cracks")
C("c_neontree", "a stylized alien tree with a thin dark trunk and a glowing magenta crystal diamond-shaped canopy")
C("c_spire", "a tall jagged black obsidian rock spire with thin glowing orange magma veins")
C("c_mesa", "a tall flat-topped red sandstone mesa butte with bold horizontal strata layers and sheer cliff walls")
C("c_hoodoo", "a thin tall red rock hoodoo pillar with a wider balanced cap rock on top and banded strata")
json.dump(jobs, open(__file__.replace('manifest.py', 'jobs.json'), 'w'), indent=1)
print(len(jobs), 'jobs')
