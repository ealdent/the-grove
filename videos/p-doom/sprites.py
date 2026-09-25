#!/usr/bin/env python3
"""Pixel sprites for the P(DOOM) video: Dobby, Seed (chibi) and the cast.

    python3 sprites.py            writes sprites.js
    python3 sprites.py --preview  also writes analysis/sprites.png

Each sprite is rows of palette letters; '.' is transparent. The renderer
tints them from the same palette, so the art stays on the tube's phosphors.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# Palette letters -> preview colours (the renderer maps the same letters to its own tokens).
PALETTE = {
    'T': (255, 180, 71),   # amber: Dobby's coat, jackets
    'W': (255, 231, 191),  # core white
    'D': (154, 90, 40),    # dark amber detail
    'K': (0, 0, 0),        # black (eyes, noses); drawn opaque
    'H': (255, 122, 69),   # hot orange: Seed's hair
    'R': (241, 70, 44),    # alarm red
    'G': (141, 255, 180),  # OSD green
    'A': (201, 150, 92),   # dim amber
    'S': (90, 64, 48),     # deep shadow
}


def grid(text: str) -> list[str]:
    rows = [r for r in text.strip('\n').split('\n')]
    w = max(len(r) for r in rows)
    return [r.ljust(w, '.') for r in rows]


def paste(base: list[str], part: list[str], x: int, y: int) -> list[str]:
    """Overlay part onto base at (x, y), growing base as needed; '.' in part is transparent."""
    h = max(len(base), y + len(part))
    w = max(len(base[0]) if base else 0, x + len(part[0]))
    out = [list(r.ljust(w, '.')) for r in base] + [['.'] * w for _ in range(h - len(base))]
    for j, row in enumerate(part):
        for i, ch in enumerate(row):
            if ch != '.':
                out[y + j][x + i] = ch
    return [''.join(r) for r in out]


def flip(sprite: list[str]) -> list[str]:
    return [r[::-1] for r in sprite]


# --- Dobby (Pembroke corgi, facing right) ------------------------------------------------------
DOG_HEAD = grid("""
...T.....T...
..TT....TT...
..TDT..TDT...
..TDDTTDDT...
.TTTTTWTTTT..
.TTTTTWTTKTT.
.TTTTWWWTTTTT
.TTTTWWWWWWWK
..TTWWWWWWW..
""")
DOG_HEAD_BARK = grid("""
...T.....T...
..TT....TT...
..TDT..TDT...
..TDDTTDDT...
.TTTTTWTTTT..
.TTTTTWTTKTT.
.TTTTWWWTTTTT
.TTTTWWWWWWWK
..TTWWW......
..TWWWWWWW...
""")
DOG_HEAD_SLEEP = grid("""
...T.....T...
..TT....TT...
..TDT..TDT...
..TDDTTDDT...
.TTTTTWTTTT..
.TTTTTWTDDTT.
.TTTTWWWTTTTT
.TTTTWWWWWWWK
..TTWWWWWWW..
""")
DOG_BODY = grid("""
..TT....................TWWWWWWW...
.TTTT..................TTWWWWW.....
TTTTTTTTTTTTTTTTTTTTTTTTWWWWW......
TTTTTTTTTTTTTTTTTTTTTTTWWWWWW......
TTTTTTTTTTTTTTTTTTTTTTTWWWWW.......
TTTTTTTTTTTTTTTTTTTTTTTWWWWW.......
.TTTTTTTTTTTTTTTTTTTTTTWWWW........
.TTTWWWWWWWWWWWWWWWWTTTWWWW........
""")
LEGS_STAND = grid("""
..TTT.............TTT.WWW..........
..TTW.............TTW.WWW..........
..WWW.............WWW.WWW..........
""")
LEGS_RUN_A = grid("""
TTT................TT..WWW.........
TW..................TW...WWW.......
WW...................WW....WW......
""")
LEGS_RUN_B = grid("""
...TTT...........TTT..WWW..........
....TWW.........TWW..WWW...........
.....WW........WW...WW.............
""")


LEGS_WALK_1 = grid("""
.TTT..............TTT...WWW........
.TTW...............TTW...WWW.......
WWW.................WWW...WWW......
""")
LEGS_WALK_3 = grid("""
...TTT...........TTT.WWW...........
....TTW.........TTW.WWW............
.....WWW.......WWW.WWW.............
""")
DOG_HEAD_BLINK = [r if y != 5 else '.TTTTTWTTDTT.' for y, r in enumerate(DOG_HEAD)]
COLLAR = grid("""
.RRR
RRR.
..A.
""")


def dog(head=DOG_HEAD, legs=LEGS_STAND, tail=0):
    """tail: -1 down, 0 level, 1 up (a wag is 0, 1, 0, -1)."""
    s = paste(paste([], head, 22, 0), DOG_BODY, 0, 9)
    if tail > 0:
        s = paste(s, grid("""
...T
..TTT
"""), 0, 8)
    elif tail < 0:
        s = [r if y not in (9, 10) else '.' * 5 + r[5:] for y, r in enumerate(s)]
        s = paste(s, grid("""
.TTT
TTTT
"""), 0, 10)
    s = paste(s, COLLAR, 23, 9)
    return paste(s, legs, 0, 17)


DOG_SIT = grid("""
.............T.....T.
............TT....TT.
............TDT..TDT.
............TDDTTDDT.
...........TTTTTWTTTT
...........TTTTTWTTKT
...........TTTTWWWTTT
...........TTTTWWWWWK
............RRRWWWWW.
..........TRRRWWWWW..
........TTTTTTWWWW...
......TTTTTTTTWWWW...
.....TTTTTTTTTWWWW...
....TTTTTTTTTTWWWW...
...TTTTTTTTTTTWWW....
..TTTTTTTTTTTTWWW....
..TTTTTTTTTTT.WWW....
.TTTTTTTTTT...WWW....
.TTTTTTTTT....WWW....
..TTTTTWWW...WWWW....
...WWWWWWW..WWWWW....
""")

DOG_SLEEP = grid("""
.......................T.....T....
......................TT....TT....
......................TDT..TDT....
.........TTTTTTTTTT...TDDTTDDT....
......TTTTTTTTTTTTTTTTTTTTTWTTTT..
....TTTTTTTTTTTTTTTTTTTTTTTWTDDTT.
...TTTTTTTTTTTTTTTTTTTTTTTWWWTTTTT
..TTTTTTTTTTTTTTTTTTTTTTTTWWWWWWWK
..TTTTTTTTTTTTTTTTTTTTTTTWWWWWWW..
.TTTTTTTTTTTTTTTTTTTTTTTWWWWWWW...
.TTTTTTTTTTTTTTTTTTTTWWWWWWWWW....
..WWWWWWWWWWWWWWWWWWWWWWWWWWW.....
""")

# The sploot: flat on the belly, back legs straight out behind.
DOG_SPLOOT = grid("""
..........................T.....T...
.........................TT....TT...
.........................TDT..TDT...
.........................TDDTTDDT...
........................TTTTTWTTTT..
........................TTTTTWTTKTT.
........................TTTTWWWTTTTT
..............TTTTTTTTTTTTTTWWWWWWWK
.......TTTTTTTTTTTTTTTTTTTTTTWWWWWW.
WW.TTTTTTTTTTTTTTTTTTTTTTTTTWWWWW...
WWTTTTTTTTTTTTTTTTTTTTTTTTTTWWWWWWW.
.WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
""")

SOCK = grid("""
.WWWW
.RRRR
.WWWW
.WWWW
.RRRR
.WWWW
.WWWWW
WWWWWWW
.WWWWW.
""")

BONE = grid("""
WW.....WW
WWWWWWWWW
WWWWWWWWW
WW.....WW
""")

# --- Seed, chibi (front view): head and bodies -------------------------------------------------
SEED_HEAD = grid("""
.....HHHHHHHHHH.....
...HHHHHHHHHHHHHH...
..HHHHHHHHHHHHHHHH..
.HHHHHHHHHHHHHHHHHH.
.HHHHHHHHHHHHHHHHHH.
.HHWHHWHHWWHHWHHWHH.
DHHWWWWWWWWWWWWWWHH.
DHHWKKWWWWWWWWKKWHH.
DHHWKGWWWWWWWWKGWHH.
.HHWKKWWWWWWWWKKWHH.
.HHWWWWWWWWWWWWWWHH.
.HHWWWWWWRRWWWWWWHHD
.HH.WWWWWWWWWWWWDDH.
.HH..WWWWWWWWWW.HH..
.......WWWWWW.......
""")
SEED_HEAD_SING = grid("""
.....HHHHHHHHHH.....
...HHHHHHHHHHHHHH...
..HHHHHHHHHHHHHHHH..
.HHHHHHHHHHHHHHHHHH.
.HHHHHHHHHHHHHHHHHH.
.HHWHHWHHWWHHWHHWHH.
DHHWWWWWWWWWWWWWWHH.
DHHWKKWWWWWWWWKKWHH.
DHHWKGWWWWWWWWKGWHH.
.HHWKKWWWWWWWWKKWHH.
.HHWWWWWWKKWWWWWWHH.
.HHWWWWWWKKWWWWWWHHD
.HH.WWWWWWWWWWWWDDH.
.HH..WWWWWWWWWW.HH..
.......WWWWWW.......
""")
SEED_HEAD_JOY = grid("""
.....HHHHHHHHHH.....
...HHHHHHHHHHHHHH...
..HHHHHHHHHHHHHHHH..
.HHHHHHHHHHHHHHHHHH.
.HHHHHHHHHHHHHHHHHH.
.HHWHHWHHWWHHWHHWHH.
DHHWWWWWWWWWWWWWWHH.
DHHWWKWWWWWWWWKWWHH.
DHHWKWKWWWWWWKWKWHH.
.HHWWWWWWWWWWWWWWHH.
.HHWWWWWKKKKWWWWWHH.
.HHWWWWWWKKWWWWWWHHD
.HH.WWWWWWWWWWWWDDH.
.HH..WWWWWWWWWW.HH..
.......WWWWWW.......
""")
SEED_HEAD_WORRY = grid("""
.....HHHHHHHHHH.....
...HHHHHHHHHHHHHH...
..HHHHHHHHHHHHHHHH..
.HHHHHHHHHHHHHHHHHH.
.HHHHHHHHHHHHHHHHHH.
.HHWHHWHHWWHHWHHWHH.
DHHWKWWWWWWWWWWKWHH.
DHHWWKKWWWWWWKKWWHH.
DHHWWKGWWWWWWKGWWHH.
.HHWWKKWWWWWWKKWWHH.
.HHWWWWWWWWWWWWWWHH.
.HHWWWWWWKKWWWWWWHHD
.HH.WWWWKWWKWWWWDDH.
.HH..WWWWWWWWWW.HH..
.......WWWWWW.......
""")
SEED_BODY_STAND = grid("""
.....TTTTWWTTTT.....
....TTTTTWWTTTTT....
...TTTTTTWWTTTTTT...
...TT.TTTWWTTT.TT...
...TT.TTTWWTTT.TT...
...WW.TTTTTTTT.WW...
......DDDDDDDD......
.....DDDDDDDDDD.....
.....DDDDDDDDDD.....
.......WW..WW.......
.......WW..WW.......
.......WW..WW.......
......AAA..AAA......
""")
SEED_BODY_SING = grid("""
.....TTTTWWTTTTWW...
....TTTTTWWTTTTTW...
...TTTTTTWWTTTTT....
...TT.TTTWWTTT......
...TT.TTTWWTTT......
...WW.TTTTTTTT......
......DDDDDDDD......
.....DDDDDDDDDD.....
.....DDDDDDDDDD.....
.......WW..WW.......
.......WW..WW.......
.......WW..WW.......
......AAA..AAA......
""")
SEED_BODY_CHEER = grid("""
WW...TTTTWWTTTT...WW
.TT.TTTTTWWTTTTT.TT.
..TTTTTTTWWTTTTTTT..
......TTTWWTTT......
......TTTWWTTT......
......TTTTTTTT......
......DDDDDDDD......
.....DDDDDDDDDD.....
.....DDDDDDDDDD.....
.......WW..WW.......
.......WW..WW.......
.......WW..WW.......
......AAA..AAA......
""")
SEED_BODY_POINT = grid("""
.....TTTTWWTTTT.....
....TTTTTWWTTTTTTTWW
...TTTTTTWWTTTTTTT..
...TT.TTTWWTTT......
...TT.TTTWWTTT......
...WW.TTTTTTTT......
......DDDDDDDD......
.....DDDDDDDDDD.....
.....DDDDDDDDDD.....
.......WW..WW.......
.......WW..WW.......
.......WW..WW.......
......AAA..AAA......
""")
SEED_BODY_FALL = grid("""
WW...TTTTWWTTTT...WW
.TT.TTTTTWWTTTTT.TT.
..TTTTTTTWWTTTTTTT..
......TTTWWTTT......
......TTTTTTTT......
.....DDDDDDDDDD.....
....DDDDDDDDDDDD....
...WW..........WW...
..WW............WW..
.AA..............AA.
""")
SEED_BODY_SHRUG = grid("""
.....TTTTWWTTTT.....
..TTTTTTTWWTTTTTTT..
.TT..TTTTWWTTTT..TT.
WW...TTTTWWTTTT...WW
......TTTWWTTT......
......TTTTTTTT......
......DDDDDDDD......
.....DDDDDDDDDD.....
.....DDDDDDDDDD.....
.......WW..WW.......
.......WW..WW.......
.......WW..WW.......
......AAA..AAA......
""")


SEED_HEAD_BLINK = [r if y not in (7, 8, 9) else ['DHHWWWWWWWWWWWWWWHH.', 'DHHWKKKWWWWWWKKKWHH.', '.HHWWWWWWWWWWWWWWHH.'][y - 7]
                   for y, r in enumerate(SEED_HEAD)]
SEED_LEGS_WALK_A = grid("""
......WW...WW.......
.....WW.....WW......
.....WW.....WW......
....AAA.....AAA.....
""")
SEED_LEGS_WALK_B = grid("""
.......WW.WW........
.......WW.WW........
.......WW.WW........
......AAA.AAA.......
""")
SEED_BODY_CLAP = grid("""
.....TTTTWWTTTT.....
....TTTTTWWTTTTT....
...TTTTTTWWTTTTTT...
....TTTTTWWTTTTT....
......TTWWWWTT......
......TTTTTTTT......
......DDDDDDDD......
.....DDDDDDDDDD.....
.....DDDDDDDDDD.....
.......WW..WW.......
.......WW..WW.......
.......WW..WW.......
......AAA..AAA......
""")


def seed(head=SEED_HEAD, body=SEED_BODY_STAND, legs=None):
    s = paste(paste([], body, 0, 14), head, 0, 0)
    if legs:
        s = [r if y < 23 else '.' * 20 for y, r in enumerate(s)]
        s = paste(s, legs, 0, 23)
    return s


def seed_hang():
    """Arms straight up, hands at the top: for hanging off ledges."""
    s = paste([], seed(SEED_HEAD_WORRY, SEED_BODY_STAND), 1, 4)
    s = [r[:2] + r[2:4].replace('W', '.') + r[4:18] + r[18:20].replace('W', '.') + r[20:] if 21 <= y <= 24 else r for y, r in enumerate(s)]
    for y in range(2, 20):
        s = paste(s, ['TT'], 0, y)
        s = paste(s, ['TT'], 20, y)
    s = paste(s, ['WW', 'WW'], 0, 0)
    return paste(s, ['WW', 'WW'], 20, 0)




# --- the cast ----------------------------------------------------------------------------------
CAT = grid("""
.A.....A..................
.AA...AA..................
.AWA.AWA..................
.AAAAAAA..................
AAKAAAKAA.................
AAAAWAAAA.................
.AAWWWAA..AAAAAAAAAAA.....
..AAAAAAAAAWAAWAAWAAAA....
..AAAAAAAAAAWAAWAAWAAAAA..
..AAAAAAAAAAAAAAAAAAAAAAAA
.WWAAAAAAAAAAAAAAAAAAAA..A
WWWW.WWAAAAAAAAAAAAAAA...A
.......WW.......WW.......A
""")
PARROT = grid("""
....GGGG....
...GGGGGG...
..GGGKGGWW..
..GGGGGGWWD.
..GGGGGG.DD.
.GGGGGGG....
.GGGGGGGG...
GGGGGGGGG...
GGGGGGGGG...
.GGGGGGGG...
..GGGGGG....
...AA.AA....
...GGGGGG...
....GGGGGG..
.....GGGGGG.
""")
CHINCHILLA = grid("""
..AAA......AAA...
.AAWAA....AAWAA..
.AAWAA....AAWAA..
..AAAAAAAAAAAA...
.AAAAAAAAAAAAAA..
AAAKKAAAAAAKKAAA.
AAAKGAAAAAAKGAAA.
AWWWWAAADAAWWWWA.
AWWWWWAAAAWWWWWA.
AWWWWWWAAWWWWWWA.
.AWWWWWWWWWWWWA..
.AAWWWWWWWWWWAA..
..AAAAAAAAAAAA...
...AA......AA....
""")
MUSHROOM = grid("""
...RRRRR...
..RRWRRRR..
.RRRRRRWRR.
RRWRRRRRRRR
RRRRRWRRRWR
...WWWWW...
...WWWWW...
...WWWWW...
..WWWWWWW..
""")
HEART = grid("""
.RR...RR.
RRRR.RRRR
RRRRRRRRR
RRRRRRRRR
.RRRRRRR.
..RRRRR..
...RRR...
....R....
""")
SANDCASTLE = grid("""
T.T....T.T....T.T
TTT....TTT....TTT
TTT....TTT....TTT
TTTTTTTTTTTTTTTTT
TTTTTTTKKTTTTTTTT
TTTTTTKKKKTTTTTTT
TTTTTTKKKKTTTTTTT
""")
CAR = grid("""
.......................WWWWW..............
......................WW...WW.............
.........AAAAAAAAAAAAAAAAAAAAAAAAAAA......
......AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA..
....AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAW
...AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAW
..AAAAAAKKKKKAAAAAAAAAAAAAAAAAAKKKKKAAAAAA
..AAAAAKKKKKKKAAAAAAAAAAAAAAAAKKKKKKKAAAA.
.......KKAAAKK................KKAAAKK.....
........KKKKK..................KKKKK......
""")
LIGHTSTICK = grid("""
.GG.
GGGG
GGGG
.GG.
.WW.
.WW.
.WW.
""")

HAN_ZHONG = grid("""
....W....
.WWWWWWW.
.W..W..W.
.W..W..W.
.WWWWWWW.
....W....
....W....
....W....
""")
HAN_WEN = grid("""
....W....
WWWWWWWWW
..W...W..
...W.W...
....W....
...W.W...
.WW...WW.
W.......W
""")
EMOJI = grid("""
..AAAAA..
.AAAAAAA.
AAKAAAKAA
AAKAAAKAA
AAAAAAAAA
AKAAAAAKA
AAKKKKKAA
.AAAAAAA.
..AAAAA..
""")
FLOPPY = grid("""
AAAAAAAAAA.
AAWWWWWWAAA
AAWWWWWWAAA
AAAAAAAAAAA
AAAAAAAAAAA
AAWWWWWWWAA
AAWKKKWWWAA
AAWWWWWWWAA
AAAAAAAAAAA
""")
JOYSTICK = grid("""
...RR...
...RR...
....D...
....D...
.AAAAAA.
AAAAAAAA
""")
CHAT = grid("""
.GGGGGGG.
GGWGWGWGG
GGGGGGGGG
.GGGGGGG.
..GG.....
.G.......
""")
ARM = grid("""
......AA
.....AA.
....AA..
AAAAA...
AA......
AA......
AAAA....
""")

SPRITES = {
    'dog_stand': dog(),
    'dog_wag': dog(tail=1),
    'dog_wag_down': dog(tail=-1),
    'dog_blink': dog(head=DOG_HEAD_BLINK),
    'dog_bark': dog(head=DOG_HEAD_BARK, tail=1),
    'dog_walk_1': dog(legs=LEGS_WALK_1, tail=1),
    'dog_walk_3': dog(legs=LEGS_WALK_3, tail=-1),
    'dog_run_a': dog(legs=LEGS_RUN_A),
    'dog_run_b': dog(legs=LEGS_RUN_B, tail=1),
    'dog_sit': DOG_SIT,
    'dog_sleep': DOG_SLEEP,
    'dog_sploot': DOG_SPLOOT,
    'sock': SOCK,
    'bone': BONE,
    'seed_stand': seed(),
    'seed_blink': seed(SEED_HEAD_BLINK),
    'seed_sing': seed(SEED_HEAD_SING, SEED_BODY_SING),
    'seed_joy': seed(SEED_HEAD_JOY, SEED_BODY_CHEER),
    'seed_cheer': seed(SEED_HEAD_SING, SEED_BODY_CHEER),
    'seed_worry': seed(SEED_HEAD_WORRY, SEED_BODY_STAND),
    'seed_point': seed(SEED_HEAD, SEED_BODY_POINT),
    'seed_fall': seed(SEED_HEAD_WORRY, SEED_BODY_FALL),
    'seed_shrug': seed(SEED_HEAD_WORRY, SEED_BODY_SHRUG),
    'seed_walk_a': seed(SEED_HEAD, SEED_BODY_STAND, SEED_LEGS_WALK_A),
    'seed_walk_b': seed(SEED_HEAD, SEED_BODY_STAND, SEED_LEGS_WALK_B),
    'seed_clap': seed(SEED_HEAD_JOY, SEED_BODY_CLAP),
    'seed_hang': seed_hang(),
    'seed_head': SEED_HEAD,
    'seed_head_sing': SEED_HEAD_SING,
    'seed_head_joy': SEED_HEAD_JOY,
    'cat': CAT,
    'parrot': PARROT,
    'chinchilla': CHINCHILLA,
    'mushroom': MUSHROOM,
    'heart': HEART,
    'sandcastle': SANDCASTLE,
    'car': CAR,
    'lightstick': LIGHTSTICK,
    'han_zhong': HAN_ZHONG,
    'han_wen': HAN_WEN,
    'emoji': EMOJI,
    'floppy': FLOPPY,
    'joystick': JOYSTICK,
    'chat': CHAT,
    'arm': ARM,
}
# Bowing, front view: the head drops onto the shoulders and the eyes close.
SPRITES['seed_bow'] = paste(paste([], SEED_BODY_STAND, 0, 17), SEED_HEAD_BLINK, 0, 4)

# Anchors, in sprite pixels from the top-left (col, row): where props, leashes and riders attach.
DOG_ANCHORS = {'collar': (24.5, 9.5), 'mouth': (33.5, 8.2), 'head': (28, 3.5), 'nose': (34.6, 7.4), 'back': (12, 9.5), 'feet': (17.5, 20)}
SEED_ANCHORS = {'handL': (3.5, 19.5), 'handR': (16, 19.5), 'head': (10, 0), 'eyes': (10, 8), 'feet': (10, 27)}
ANCHORS = {}
for name in SPRITES:
    if name.startswith('dog_') and name not in ('dog_sit', 'dog_sleep', 'dog_sploot'):
        ANCHORS[name] = DOG_ANCHORS
    elif name.startswith('seed_') and not name.startswith('seed_head'):
        ANCHORS[name] = dict(SEED_ANCHORS)
ANCHORS['dog_sit'] = {'collar': (12.5, 9.5), 'mouth': (20.5, 8.2), 'head': (16, 3.5), 'feet': (10, 21)}
ANCHORS['dog_sploot'] = {'head': (30, 3.5), 'collar': (27, 7.5), 'feet': (18, 12)}
ANCHORS['dog_sleep'] = {'head': (28, 3.5), 'feet': (17, 12)}
for n in ('seed_joy', 'seed_cheer'):
    ANCHORS[n].update(handL=(0.5, 14.5), handR=(19.5, 14.5))
ANCHORS['seed_point'].update(handR=(19.5, 15.5))
ANCHORS['seed_sing'].update(handR=(16, 14.5))
ANCHORS['seed_clap'].update(handL=(9, 18.5), handR=(11, 18.5))
ANCHORS['seed_hang'] = {'handL': (1, 0), 'handR': (21, 0), 'head': (11, 4), 'feet': (11, 31)}
ANCHORS['seed_bow'] = dict(SEED_ANCHORS, head=(10, 4), feet=(10, 30))
ANCHORS['seed_fall'].update(handL=(0.5, 14.5), handR=(19.5, 14.5))
ANCHORS['seed_shrug'].update(handL=(0.5, 17.5), handR=(19.5, 17.5))


def main():
    for name, s in SPRITES.items():
        bad = {ch for r in s for ch in r} - set(PALETTE) - {'.'}
        if bad:
            sys.exit(f'{name}: unknown palette letters {bad}')
    out = HERE / 'sprites.js'
    out.write_text('// Generated by sprites.py; edit the sprites there.\nwindow.SPRITES = ' +
                   json.dumps(SPRITES, separators=(',', ':')) + ';\nwindow.SPRITE_ANCHORS = ' +
                   json.dumps(ANCHORS, separators=(',', ':')) + ';\n')
    print(f'{len(SPRITES)} sprites -> sprites.js')
    if '--preview' in sys.argv:
        from PIL import Image, ImageDraw
        px, pad, cols = 8, 16, 6
        cells = list(SPRITES.items())
        cw = max(len(s[0]) for _, s in cells) * px + pad
        ch = max(len(s) for _, s in cells) * px + pad + 14
        rows = (len(cells) + cols - 1) // cols
        img = Image.new('RGB', (cols * cw, rows * ch), (14, 12, 10))
        d = ImageDraw.Draw(img)
        for k, (name, s) in enumerate(cells):
            x0, y0 = (k % cols) * cw + pad // 2, (k // cols) * ch + 14
            d.text((x0, y0 - 12), name, fill=(200, 200, 200))
            for ax, ay in ANCHORS.get(name, {}).values():
                d.line([x0 + ax * px - 5, y0 + ay * px, x0 + ax * px + 5, y0 + ay * px], fill=(0, 200, 255))
                d.line([x0 + ax * px, y0 + ay * px - 5, x0 + ax * px, y0 + ay * px + 5], fill=(0, 200, 255))
            for y, r in enumerate(s):
                for x, c in enumerate(r):
                    if c != '.':
                        col = PALETTE[c] if c != 'K' else (40, 40, 60)
                        d.rectangle([x0 + x * px, y0 + y * px, x0 + x * px + px - 1, y0 + y * px + px - 1], fill=col)
        img.save(HERE / 'analysis' / 'sprites.png')


if __name__ == '__main__':
    main()
