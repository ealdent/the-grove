#!/usr/bin/env python3
"""Asset specs for the Boots montage: writes MEDIA/specs_images.json and MEDIA/specs_clips.json for higgs.py.

    python3 assets.py MEDIA_DIR

Stills are generic documentary scenes: nobody real is depicted (figures are anonymous, mostly from behind or in
silhouette) and nothing is written in frame. Names, dates and numbers are all set in type by the edit.
"""
import json
import sys
from pathlib import Path

MONO = ('Black-and-white documentary photograph, shot on pushed Kodak Tri-X 35mm film, heavy grain, deep blacks, hard '
        'contrast, available light, candid photojournalism, cinematic wide composition. Any people are anonymous and not '
        'recognisable. Any screens, pages, boards and signs show only blank glow or illegible smudges. '
        'No text, no letters, no numbers, no logos, no watermark anywhere in the frame.')
COLOUR = ('Colour documentary photograph, shot on Kodak Portra 400 35mm film, warm golden-hour light, gentle grain, '
          'hopeful and deeply human, cinematic wide composition. Any people are anonymous ordinary people. '
          'No text, no letters, no numbers, no logos, no watermark anywhere in the frame.')

M = {  # monochrome stills
    # stanza 1
    'night_office': 'An empty open-plan research office late at night, one desk lamp left on, rows of dark monitors, a city glittering through the windows.',
    'whiteboard': 'Close on a whiteboard densely covered in hand-drawn boxes, arrows and criss-crossing lines like a wiring diagram, a hand holding a marker entering the frame.',
    'paper_stack': 'A printed academic journal article lying on a cluttered desk beside a coffee mug and an open laptop, shallow depth of field.',
    'eight_backs': 'Eight researchers seen from behind standing shoulder to shoulder facing a wall of whiteboards covered in diagrams.',
    'gpu_fans': 'Extreme close-up of a row of graphics cards in an open computer chassis, cooling fans spinning into blur, dust in a shaft of light.',
    'library_stacks': 'Towering library stacks receding into darkness, a single reader on a ladder dwarfed by thousands of books.',
    'cable_floor': 'Thick bundles of network cables snaking across a raised server-room floor, seen from ground level.',
    'typing_hands': 'Close-up of two hands typing fast on a worn keyboard at night, lit only by a monitor.',
    'server_aisle': 'A narrow aisle between tall server racks with hundreds of tiny indicator lights, strong one-point perspective.',
    'coffee_night': 'A tired graduate student asleep on folded arms at a desk beside empty coffee cups and a glowing monitor, seen from behind.',
    'vault_door': 'A massive round steel bank-vault door standing slightly ajar, light spilling through the gap.',
    'glass_tower': 'Looking straight up at a glass corporate skyscraper cutting into dramatic clouds.',
    'datacenter_wide': 'Aerial view of an enormous windowless datacenter complex in flat farmland, cooling towers venting steam at dawn.',
    'founders_room': 'A small group of people around a kitchen table crowded with laptops in a modest rented house, seen through a window from outside at night.',
    'code_screen': 'Over-the-shoulder view of a programmer at a dark monitor filled with rows of softly blurred code, face unseen.',
    'darkroom_prints': 'Dozens of surreal dreamlike photographic prints hanging on a darkroom drying line, hands lifting one from a tray.',
    'gallery_crowd': 'A dense crowd in an art gallery staring up at a huge strange painting, seen from behind.',
    'phone_glow': 'A single hand holding a smartphone in total darkness, the blank screen glowing bright white and lighting the fingers.',
    # stanza 2
    'subway_phones': 'A packed subway carriage in which every single commuter is looking down at a glowing phone.',
    'classroom': 'A high-school classroom seen from the back, every student lit by an open laptop, the teacher a blur at the blackboard.',
    'newsroom': 'A busy newspaper newsroom with reporters hunched at screens, papers flying, motion blur.',
    'kitchen_laptop': 'A parent at a kitchen table late at night working on a laptop while a child sleeps on their shoulder.',
    'lecture_hall': 'A vast university lecture hall, hundreds of students with laptops open, seen from the top row.',
    'trading_floor': 'A frantic stock-exchange trading floor, traders gesturing under banks of blurred screens.',
    'hotel_laptop': 'A lone laptop glowing on an unmade hotel bed in a dark room at three in the morning, curtains moving.',
    'stage_screen': 'A dark auditorium with a single presenter in silhouette before a gigantic glowing blank screen.',
    'reading_room': 'A grand quiet reading room with long oak tables and green lamps, one person writing by hand, sunbeams through tall windows.',
    'search_campus': 'A sprawling modern tech campus seen from above, employees crossing a plaza carrying laptops, long shadows.',
    'press_scrum': 'A crush of press photographers and television cameras, flashbulbs firing straight at the lens.',
    'tv_wall': 'A shop-window wall of televisions all showing the same blurred broadcast, passers-by stopped to stare, seen from behind.',
    'crowd_phones': 'A night-time crowd holding up hundreds of glowing phones, seen from above.',
    'signatures': 'A very long paper scroll covered in thousands of illegible handwritten signatures unrolling down a long table.',
    'old_professor_back': 'An elderly professor in a tweed jacket seen from behind, walking out of a glass corporate lobby into bright daylight carrying a small box of belongings.',
    'senate_room': 'A wood-panelled government hearing room, a lone witness at a table seen from behind facing a high dais of shadowed officials.',
    # stanza 3
    'chip_macro': 'Extreme macro photograph of a silicon microchip die, circuitry gleaming like a city seen from the air.',
    'open_gate': 'Tall iron gates swinging wide open onto a road, a crowd beginning to pour through.',
    'launch_pad': 'A rocket on a launch pad at night wreathed in venting vapour under floodlights.',
    'white_house_fence': 'The White House seen through the bars of its iron fence on an overcast day.',
    'manor_house': 'A Victorian English country manor house behind bare winter trees, black government cars on the gravel drive.',
    'flags_row': 'A long row of national flags on poles snapping in a hard wind outside a summit venue.',
    'keynote_crowd': 'A developer conference audience of thousands in darkness, faces lit by a giant blank white screen.',
    'skyline_dusk': 'A city financial-district skyline at dusk with fog rolling between the towers.',
    'boardroom_empty': 'An empty corporate boardroom, a long table, one chair pushed back and turned away from the table.',
    'phone_buzz': 'A smartphone face-down vibrating on a glass table, motion-blurred, in a dark room.',
    'hallway_run': 'A figure sprinting down a long office corridor, heavily motion-blurred, seen from behind.',
    'lobby_night': 'A glass office lobby at night seen from the street, a small knot of people in urgent conversation inside.',
    'empty_chair': 'A single empty executive chair behind a bare desk, lit by one window.',
    'office_crowd': 'Hundreds of office workers packed together in an atrium, arms crossed, seen from a balcony above.',
    'eye_screen': 'Extreme close-up of a human eye with a bright rectangular screen reflected in it.',
    'twin_stars': 'Two bright stars side by side in a dense field of stars over a dark mountain observatory.',
    'newsprint_press': 'A newspaper printing press running at full speed, paper a continuous blur between the rollers.',
    # stanza 4
    'gpu_hand': 'A gloved hand lifting a heavy graphics accelerator card out of an anti-static box, hundreds of identical boxes stacked behind.',
    'film_strip': 'Strips of motion-picture film hanging in loops against a lightbox, each frame a tiny blurred scene.',
    'gpu_rack': 'A server rack packed top to bottom with identical accelerator cards and tiny lights, shot dead-on and symmetrical.',
    'microphone': 'A vintage studio microphone in a pool of light in an otherwise dark recording booth.',
    'keynote_jacket': 'A presenter in a dark jacket seen from behind in silhouette on a vast conference stage, holding a gleaming square computer chip up high in one hand toward an enormous glowing blank screen, a huge audience in darkness.',
    'chess_clock': 'A chess clock mid-game, one hand hovering over the pieces, deep thought, shallow focus.',
    'capitol_steps': 'The steps and columns of a state capitol building, a few figures in suits climbing, low angle.',
    'veto_pen': 'A fountain pen lying across an unsigned official document on a heavy desk, the writing blurred.',
    'medal': 'A large gold medal resting on dark velvet in a presentation case, raked light.',
    'protein_model': 'A gloved scientist holding up a 3D-printed ribbon model of a folded protein under laboratory light.',
    'cursor_desk': 'An empty desk at night: a computer mouse, a keyboard and a glowing monitor, the office chair empty and slightly turned, as if someone unseen is working.',
    'plug_wall': 'A wall of hundreds of identical sockets with a single cable being plugged in by a hand.',
    'puzzle_grid': 'A wall-sized grid of small square tiles in black, white and grey forming abstract patterns, a person studying it from behind.',
    # stanzas 5-6
    'stargate_site': 'A vast data-centre construction site on a flat plain at dusk: cranes, steel frames and floodlights stretching to the horizon.',
    'lit_floor': 'A modest office tower at night in a dense Asian city, every floor dark except one brightly lit storey.',
    'terminal_night': 'A laptop on a bare desk in an empty office at night, its screen a dark window with rows of softly blurred glowing lines.',
    'power_lines': 'High-voltage transmission towers marching in a line across an empty plain into the distance under heavy clouds.',
    'wafer': 'Gloved hands in a cleanroom holding up a silicon wafer that catches the light.',
    'money_press': 'Uncut sheets of paper currency rushing through a printing press, a continuous motion blur.',
    'exam_hall': 'A vast examination hall seen from above, hundreds of students bent over desks in perfect rows.',
    'magazine_stand': 'A street news-stand at night with rows of magazines, the covers blurred, a customer reaching for one.',
    'rocket_hangar': 'A gigantic rocket lying horizontal in a hangar, tiny engineers walking beneath it.',
    'pentagon_aerial': 'Aerial view of an enormous five-sided government headquarters building surrounded by car parks.',
    'server_breach': 'A dark server room in which one rack door hangs wide open, an emergency beacon throwing hard light across the floor.',
    'ballot_box': 'Voters queuing at a small-town polling place, a huge data-centre construction site visible through the window behind them.',
    'empty_stage': 'An empty keynote stage, one spotlight on a bare lectern, thousands of empty seats in the dark.',
    'exchange_facade': 'The columned facade of a stock exchange at dawn hung with an enormous blank banner, a crowd gathering on the street below.',
    'bell_podium': 'A brass opening bell on a balcony above a packed stock-exchange floor, a hand reaching for the rope.',
    # stanza 7
    'fog_road': 'An empty two-lane road running dead straight into thick fog, centre line vanishing, seen from the middle of the road.',
    'film_robot': 'A 1950s B-movie tin robot costume standing on a soundstage under studio lights, a film crew in shadow.',
    'ruined_city': 'Movie-still of a ruined city skyline under smoke, a science-fiction apocalypse.',
    'robot_army': 'Movie-still of endless rows of identical chrome humanoid robots standing in formation in fog.',
    'bullet_train': 'A bullet train passing as a pure streak of motion blur, one small figure standing perfectly still on the platform.',
    'clock_blur': 'A wall of clocks, every hand spinning into blur in a long exposure.',
    'single_hand_globe': 'A single hand in a dark suit sleeve holding a small glass globe of the Earth against pure black.',
    'tower_shadow': 'A monolithic windowless tower casting a long shadow across a small town at dawn, aerial view.',
    'biolab': 'A researcher in a full positive-pressure biosafety suit behind thick glass handling small vials.',
    'keyboard_dark': 'Hands on a keyboard in near-total darkness lit only by screen glow, the person unseen.',
    'black_box': 'A perfect matte-black cube on a table in an empty white room, a person leaning close to inspect it with a small torch.',
    'wires_macro': 'Macro photograph of an impossibly dense tangle of hair-thin wires.',
}

C = {  # colour stills (stanza 8)
    'lab_cure': 'A young cancer patient ringing a brass bell in a hospital corridor while nurses applaud, seen from behind.',
    'hospital_window': 'A doctor holding an elderly patient\'s hand beside a sunlit hospital window.',
    'fusion_sun': 'Inside a fusion reactor chamber glowing with a ring of brilliant plasma, engineers silhouetted at the viewing port.',
    'solar_field': 'A vast solar farm at sunrise stretching to the horizon, a farmer and child walking between the rows.',
    'child_tablet': 'A girl in a rural village doing schoolwork on a tablet by lamplight, grinning with sudden understanding.',
    'village_school': 'An outdoor village classroom under a big tree, children raising hands eagerly.',
    'telescope_dome': 'An observatory dome open to a blazing Milky Way, an astronomer silhouetted beneath.',
    'microscope_eye': 'A scientist looking up from a microscope with an astonished smile, lab bathed in morning light.',
    'seedling_hands': 'Weathered hands cupping a seedling in rich soil, sunlight behind.',
    'rocket_dawn': 'A rocket rising on a pillar of fire at dawn watched by a family on a beach, seen from behind.',
    'bridge_builders': 'Construction workers of many nations high on a new bridge at sunrise, arms raised in celebration.',
    'kids_running': 'Children running flat out through a wheat field toward the sun, seen from behind.',
    'orchestra': 'A community orchestra of all ages mid-crescendo in a packed town hall.',
    'earthrise': 'The Earth rising blue and whole over the grey lunar horizon.',
    'newborn_hand': 'A newborn\'s tiny hand gripping an adult finger, soft window light.',
    'grandmother': 'A grandmother laughing with her whole face while a toddler shows her something, kitchen light.',
    'welder': 'A welder lifting her mask and smiling, sparks drifting behind her.',
    'face_farmer': 'Close portrait of a sun-weathered farmer looking straight into the lens, calm and proud.',
    'face_nurse': 'Close portrait of a tired, kind night-shift nurse looking straight into the lens.',
    'face_student': 'Close portrait of a teenage student with headphones round her neck looking straight into the lens, hopeful.',
    'face_coder': 'Close portrait of a young software engineer in a hoodie looking straight into the lens, half smiling.',
    'face_fisher': 'Close portrait of an old fisherman in a wool cap looking straight into the lens, sea behind.',
    'face_elder': 'Close portrait of a very old woman with deep laugh lines looking straight into the lens.',
    'face_child': 'Close portrait of a gap-toothed child looking straight into the lens, delighted.',
    'face_builder': 'Close portrait of a construction worker in a hard hat looking straight into the lens, dust on his face.',
    'face_dancer': 'Close portrait of a dancer catching her breath backstage looking straight into the lens.',
    'face_monk': 'Close portrait of a serene middle-aged teacher in a simple robe looking straight into the lens.',
    'feet_sneakers': 'Ground-level close-up of feet in worn sneakers striding along a road at sunrise, long shadows.',
    'feet_workboots': 'Ground-level close-up of scuffed leather work boots striding along the same road at sunrise.',
    'feet_child': 'Ground-level close-up of a small child\'s bare feet skipping along a sunlit road beside an adult.',
    'feet_child': "Ground-level close-up of a small child's feet in tiny sandals skipping along a sunlit road beside an adult's walking shoes.",
    'feet_robot_human': 'Ground-level close-up of a humanoid robot\'s metal feet walking in step beside a person in work boots on a road at sunrise.',
    'sunrise_wide': 'An immense crowd of ordinary people of every age and nation walking together down a wide road into a brilliant sunrise, seen from high behind, a few humanoid robots walking among them.',
}

KEYS = {  # keyframes for the image-to-video clips: (style, subject)
    'boots_march': (MONO, 'Low-angle close-up of the leather boots and puttees of First World War infantry marching in column along a dusty road, 1915, dust kicked up, archival press photograph.'),
    'rack_dolly': (MONO, 'A long aisle between tall server racks crowded with tiny indicator lights, strong one-point perspective, seen from waist height.'),
    'robot_walk': (MONO, 'Low-angle close-up of the metal feet and legs of humanoid robots walking in single file across a polished factory floor.'),
    'server_infinity': (MONO, 'An endless corridor of server racks vanishing to infinity in every direction, pulsing lights, vertiginous one-point perspective.'),
    'crane_build': (MONO, 'A colossal data-centre construction site: tower cranes swinging steel beams, convoys of trucks, workers in hard hats, dust in floodlights.'),
    'ticker_floor': (MONO, 'A stock-exchange floor packed with traders under walls of glowing ticker screens blurred into streaks of light.'),
    'crowd_walk': (COLOUR, 'Ground-level view of many feet walking together along a road at sunrise: sneakers, work boots, sandals, a child\'s bare feet, a prosthetic running blade, and the metal feet of one humanoid robot, all in step.'),
    'crowd_sunrise': (COLOUR, 'An immense crowd of ordinary people of every age and nation walking away from the camera down a wide road into a brilliant sunrise, seen from just above head height, a few humanoid robots walking among them.'),
}
MOTION = {
    'boots_march': 'The soldiers march steadily past, boots rising and falling in step, dust drifting. Locked-off low camera. Archival black-and-white film.',
    'rack_dolly': 'Fast smooth dolly forward down the aisle, indicator lights flickering rapidly on both sides. Black-and-white.',
    'robot_walk': 'The robots walk steadily past in step, feet rising and falling. Locked-off low camera. Black-and-white.',
    'server_infinity': 'Relentless forward flight down the endless corridor, lights pulsing in waves, accelerating. Black-and-white.',
    'crane_build': 'Cranes swing, trucks roll past in convoy, workers move fast, dust drifting through the floodlights. Slow push in. Black-and-white.',
    'ticker_floor': 'Traders surge and gesture urgently, ticker light streaming across the walls, handheld camera pushing through the crowd. Black-and-white.',
    'crowd_walk': 'Everyone walks forward together in step, feet rising and falling, warm sunrise light flaring. Low tracking camera moving with them.',
    'crowd_sunrise': 'The whole crowd walks steadily away toward the rising sun, camera slowly rising above them, light growing brighter.',
}


def main():
    media = Path(sys.argv[1])
    m, c, keys, motion = M, C, KEYS, MOTION
    images = {k: {'prompt': f'{v} {MONO}'} for k, v in m.items()}
    images.update({k: {'prompt': f'{v} {COLOUR}'} for k, v in c.items()})
    images.update({f'key_{k}': {'prompt': f'{subj} {style}'} for k, (style, subj) in keys.items()})
    clips = {k: {'prompt': motion[k], 'model': 'kling4_0', 'start': str(media / 'raw' / f'key_{k}.png'),
                 'args': ['--mode', 'image-to-video', '--aspect_ratio', '16:9', '--resolution', '1080p', '--duration', '5']} for k in keys}
    (media / 'specs_images.json').write_text(json.dumps(images, indent=1))
    (media / 'specs_clips.json').write_text(json.dumps(clips, indent=1))
    print(len(images), 'images', len(clips), 'clips')


if __name__ == '__main__':
    main()
