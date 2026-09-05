#!/usr/bin/env python3
"""Build the original Phosphor Wake font family, webfonts, manifest, and kit.

No external font is read. All outlines come from glyphs.py or the deterministic
pixel constructions below. Coordinates are integer 20-unit microcells; the
letter skeleton uses an 80-unit pixel. See README.md for reproduction commands.
"""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path
import json
import math
import unicodedata
import zipfile

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString

from glyphs import DRAWINGS, ACCENTS

ROOT = Path(__file__).resolve().parent
UPM, ADVANCE, STEP = 1200, 720, 20
ASCENT, DESCENT = 1120, -320
FIXED_TIMESTAMP = 3871324800  # 2026-09-04 UTC, in the OpenType epoch
LIGATURES = ['===', '!==', '>>>', '<<<', '<=>', '<|>', '|>>', '<<|', '=>', '->', '<-', '|>', '<|', '==', '!=', '<=', '>=', '&&', '||', '::', '++', '--', '**', '??', '?.', '<<', '>>', ':=', '=~', '!~', '..', '...']


def rect(x0, y0, x1, y1):
    return {(x, y) for x in range(round(x0 / STEP), round(x1 / STEP))
            for y in range(round(y0 / STEP), round(y1 / STEP))}


def shift(shape, dx=0, dy=0):
    return {(x + round(dx / STEP), y + round(dy / STEP)) for x, y in shape}


def pattern(drawing, size=80, x=80, top=880):
    result = set()
    for row, pixels in enumerate(drawing.split('/')):
        pixels = pixels.strip()
        if len(pixels) != 7 or set(pixels) - {'.', '#'}:
            raise ValueError(f'Invalid original pixel row: {pixels!r}')
        for col, pixel in enumerate(pixels):
            if pixel == '#':
                result |= rect(x + col * size, top - (row + 1) * size,
                               x + (col + 1) * size, top - row * size)
    return result


def line(x0, y0, x1, y1, weight=80, step=40):
    result = set()
    count = max(1, math.ceil(max(abs(x1 - x0), abs(y1 - y0)) / step))
    for i in range(count + 1):
        x, y = x0 + (x1 - x0) * i / count, y0 + (y1 - y0) * i / count
        result |= rect(x - weight / 2, y - weight / 2, x + weight / 2, y + weight / 2)
    return result


def mini(shape, left=120, bottom=320, scale=0.5):
    result = set()
    for x, y in shape:
        result |= rect(left + x * STEP * scale, bottom + y * STEP * scale,
                       left + (x + 1) * STEP * scale, bottom + (y + 1) * STEP * scale)
    return result


def accent(base, mark, character):
    # The dot is replaced by an accent in i/j, as in Latin type design.
    if character in 'ij' and mark not in ('\u0327', '\u0328'):
        base = {(x, y) for x, y in base if y * STEP < 640}
    if mark in ('\u0327', '\u0328'):
        return base | pattern(ACCENTS[mark], size=60, x=140, top=0)
    # Lowercase accent clearance preserves room above the x-height; ascenders
    # keep the cap accent position. All top marks fit the font's 1120 ascent.
    top = 1120 if any(y * STEP >= 720 for x, y in base) else 880
    return base | pattern(ACCENTS[mark], size=60, x=140, top=top)


def circle(cx, cy, radius, thickness=80, filled=False):
    result = set()
    for x in range(round((cx-radius)/STEP), round((cx+radius)/STEP)):
        for y in range(round((cy-radius)/STEP), round((cy+radius)/STEP)):
            d = math.hypot((x+.5)*STEP-cx, (y+.5)*STEP-cy)
            if d <= radius and (filled or d >= radius-thickness):
                result.add((x, y))
    return result


def arrow(direction='right', double=False, both=False, bar=False, hook=False, diagonal=False):
    # Start with a stepped right arrow, then transform about the cell centre.
    cy = 440
    stem = rect(80, cy-40, 560, cy+40)
    if double:
        stem = rect(80, cy-120, 560, cy-40) | rect(80, cy+40, 560, cy+120)
    head = line(440, cy+240, 640, cy, 80, 40) | line(440, cy-240, 640, cy, 80, 40)
    result = stem | head
    if both:
        result |= line(280, cy+240, 80, cy, 80, 40) | line(280, cy-240, 80, cy, 80, 40)
    if bar:
        result |= rect(80, cy-240, 160, cy+240)
    if hook:
        result -= rect(80, cy-40, 200, cy+40)
        result |= rect(80, cy-40, 160, cy+240) | rect(80, cy+160, 320, cy+240)
    if direction == 'left':
        result = {(35-x, y) for x, y in result}
    elif direction in ('up', 'down'):
        # Centre stays (360,440); rotations remain inside the 720-unit cell.
        result = {(round(360/STEP) + y-round(cy/STEP), round(cy/STEP) - x+round(360/STEP)-1)
                  for x, y in result}
        if direction == 'up':
            result = {(x, round(2*cy/STEP)-1-y) for x, y in result}
    return result


def diagonal_arrow(dx, dy):
    x0, y0 = (120 if dx > 0 else 600), (160 if dy > 0 else 720)
    x1, y1 = (600 if dx > 0 else 120), (720 if dy > 0 else 160)
    return (line(x0,y0,x1,y1,80,40) | line(x1-dx*240,y1,x1,y1,80,40)
            | line(x1,y1-dy*240,x1,y1,80,40))


def box_character(character):
    name = unicodedata.name(character).removeprefix('BOX DRAWINGS ')
    cx, cy, bottom, top = 360, 400, DESCENT, ASCENT
    if 'DIAGONAL' in name:
        result = set()
        if 'UPPER RIGHT' in name or 'CROSS' in name:
            result |= line(0,bottom,720,top,60,40)
        if 'UPPER LEFT' in name or 'CROSS' in name:
            result |= line(0,top,720,bottom,60,40)
        return {(x,y) for x,y in result if 0 <= x < 36 and bottom//20 <= y < top//20}
    if 'DASH' in name:
        count = 3 if 'TRIPLE' in name else 4 if 'QUADRUPLE' in name else 2
        weight = 160 if 'HEAVY' in name else 80
        result = set()
        span = 720 if 'HORIZONTAL' in name else top-bottom
        for i in range(count):
            a, b = i*span/count+20, (i+1)*span/count-20
            result |= rect(a,cy-weight/2,b,cy+weight/2) if 'HORIZONTAL' in name else rect(cx-weight/2,bottom+a,cx+weight/2,bottom+b)
        return result
    global_weight = next((word for word in name.split() if word in ('LIGHT','HEAVY','DOUBLE','SINGLE')), 'LIGHT')
    directions = {}
    for clause in name.replace('ARC ', '').split(' AND '):
        words = clause.split()
        weight = next((word for word in words if word in ('LIGHT','HEAVY','DOUBLE','SINGLE')), global_weight)
        for word in words:
            for direction in {'VERTICAL':['UP','DOWN'],'HORIZONTAL':['LEFT','RIGHT'],'UP':['UP'],'DOWN':['DOWN'],'LEFT':['LEFT'],'RIGHT':['RIGHT']}.get(word,[]):
                directions[direction] = weight
    if 'ARC' in name:
        # A square-pixel rounded elbow: a two-step bevel, no bezier curves.
        horizontal = 'RIGHT' if 'RIGHT' in directions else 'LEFT'
        vertical = 'UP' if 'UP' in directions else 'DOWN'
        sx, sy = (1 if horizontal=='RIGHT' else -1), (1 if vertical=='UP' else -1)
        return (line(cx+sx*160,cy,720 if sx>0 else 0,cy,80,40)
                | line(cx+sx*160,cy,cx,cy+sy*160,80,40)
                | line(cx,cy+sy*160,cx,top if sy>0 else bottom,80,40)) & rect(0,bottom,720,top)
    if set(directions.values()) == {'DOUBLE'}:
        # Outline a wide connected path, then remove its narrow centre path.
        # This gives true open double-line elbows, tees and crosses without
        # dangling inner stems inside the central counter.
        def connected_path(weight):
            half=weight/2
            path=rect(cx-half,cy-half,cx+half,cy+half)
            for direction in directions:
                if direction=='LEFT': path|=rect(0,cy-half,cx,cy+half)
                if direction=='RIGHT': path|=rect(cx,cy-half,720,cy+half)
                if direction=='UP': path|=rect(cx-half,cy,cx+half,top)
                if direction=='DOWN': path|=rect(cx-half,bottom,cx+half,cy)
            return path
        return connected_path(200)-connected_path(80)
    result = set()
    for direction, kind in directions.items():
        bands = [(-100,-40),(40,100)] if kind=='DOUBLE' else [(-80,80)] if kind=='HEAVY' else [(-40,40)]
        for a,b in bands:
            if direction=='LEFT': result |= rect(0,cy+a,cx,cy+b)
            if direction=='RIGHT': result |= rect(cx,cy+a,720,cy+b)
            if direction=='UP': result |= rect(cx+a,cy,cx+b,top)
            if direction=='DOWN': result |= rect(cx+a,bottom,cx+b,cy)
    # At mixed single/double joins, extend the single beam across both parallel
    # strokes. Uniform double-line topology was handled above.
    if any(kind=='DOUBLE' for kind in directions.values()):
        for h in ('LEFT','RIGHT'):
            for v in ('UP','DOWN'):
                if h not in directions or v not in directions: continue
                hk, vk = directions[h], directions[v]
                if hk=='DOUBLE':
                    result |= rect(cx-40,cy-100,cx+40,cy+100)
                elif vk=='DOUBLE':
                    result |= rect(cx-100,cy-40,cx+100,cy+40)
    elif len(directions)>1:
        widths = [160 if k=='HEAVY' else 80 for k in directions.values()]
        w=min(widths)
        result |= rect(cx-w/2,cy-w/2,cx+w/2,cy+w/2)
    return result


def block_character(code):
    lo, hi = DESCENT, ASCENT
    full = rect(0,lo,720,hi)
    if code==0x2580: return rect(0,400,720,hi)
    if 0x2581<=code<=0x2588: return rect(0,lo,720,lo+(hi-lo)*(code-0x2580)/8)
    if 0x2589<=code<=0x258f: return rect(0,lo,720*(0x2590-code)/8,hi)
    if code==0x2590: return rect(360,lo,720,hi)
    if 0x2591<=code<=0x2593:
        level=code-0x2590
        return {(x,y) for x,y in full if (x//2+2*(y//2))%4 < level}
    if code==0x2594: return rect(0,hi-(hi-lo)/8,720,hi)
    if code==0x2595: return rect(630,lo,720,hi)
    quads = [rect(0,400,360,hi),rect(360,400,720,hi),rect(0,lo,360,400),rect(360,lo,720,400)]
    selections = {0x2596:[2],0x2597:[3],0x2598:[0],0x2599:[0,2,3],0x259a:[0,3],0x259b:[0,1,2],0x259c:[0,1,3],0x259d:[1],0x259e:[1,2],0x259f:[1,2,3]}
    return set().union(*(quads[i] for i in selections[code]))


def make_characters():
    chars={c:pattern(d) for c,d in DRAWINGS.items()}
    chars[' ']=set()
    chars['\u00a0']=set()
    chars['\u00ad']=set() # HarfBuzz treats SOFT HYPHEN as default ignorable.
    chars['\u00b7']=rect(280,360,440,520)
    chars['\u00b1']=chars['+'] | rect(80,0,640,80)
    chars['\u00b5']=chars['u'] | rect(80,-240,240,80)
    chars['\u00aa']=mini(chars['a'],120,360,.6) | rect(180,280,500,340)
    chars['\u00ba']=mini(chars['o'],120,360,.6) | rect(180,280,500,340)
    for c,mark in {'¨':'\u0308','¯':'\u0304','´':'\u0301','¸':'\u0327','˘':'\u0306','˙':'\u0307','˚':'\u030a','˛':'\u0328','˝':'\u030b','ˇ':'\u030c','ˆ':'\u0302','˜':'\u0303'}.items():
        chars[c]=pattern(ACCENTS[mark],60,140,800 if mark!='\u0327' else 0)
    for c,base in {'Ø':'O','ø':'o','Đ':'D','đ':'d','Ħ':'H','ħ':'h','Ł':'L','ł':'l','Ŧ':'T','ŧ':'t'}.items():
        if c in 'Øø': extra=line(120,80,600,800 if c=='Ø' else 520,60,80)
        elif c in 'Łł': extra=line(80,240,520,560,80,80)
        else: extra=rect(40,560 if c.isupper() else 600,560,640 if c.isupper() else 680)
        chars[c]=chars[base]|extra
    chars['ı']={(x,y) for x,y in chars['i'] if y*STEP<640}
    chars['Ŀ']=chars['L']|rect(400,400,560,560)
    chars['ŀ']=chars['l']|rect(440,400,600,560)
    chars['ŉ']=chars['n']|pattern('##...../##...../#......',60,100,1040)
    # Unicode specifies an apostrophe rather than a caron above d/l/t.
    for c,base in {'ď':'d','ľ':'l','ť':'t','Ľ':'L'}.items():
        chars[c]=chars[base]|rect(580,920,660,1080)|rect(540,880,620,960)
    for code in range(0x00c0,0x0180):
        c=chr(code)
        if c in chars: continue
        decomposed=unicodedata.normalize('NFD',c)
        if len(decomposed)!=2 or decomposed[0] not in chars or decomposed[1] not in ACCENTS:
            raise ValueError(f'Undesigned Latin character {c} U+{code:04X}')
        chars[c]=accent(chars[decomposed[0]],decomposed[1],decomposed[0])
    # Compact counters for enclosed marks are original procedural outlines.
    chars['©']=circle(360,440,320,60)|mini(chars['C'],200,200,.5)
    chars['®']=circle(360,440,320,60)|mini(chars['R'],180,200,.5)
    chars['™']=mini(chars['T'],40,420,.5)|mini(chars['M'],350,420,.5)
    for c,digit in {'¹':'1','²':'2','³':'3','⁰':'0','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'}.items():
        chars[c]=mini(chars[digit],140,400,.5)
    for c,num,den in [('¼','1','4'),('½','1','2'),('¾','3','4')]:
        chars[c]=mini(chars[num],0,480,.45)|mini(chars[den],360,0,.45)|line(100,40,600,840,60,80)
    punctuation={'‘':"'",'’':"'",'‚':',','‛':"'",'“':'"','”':'"','„':'"','‟':'"','‐':'-','‑':'-','‒':'-','–':'-','−':'-','⁄':'/','∕':'/','∖':'\\'}
    for c,base in punctuation.items(): chars[c]=set(chars[base])
    # Curly quotes have opposing tails; an em dash reaches closer to cell edges.
    chars['‘']={(35-x,y) for x,y in chars["'"]}
    chars['‛']=chars['‘']
    chars['“']={(35-x,y) for x,y in chars['"']}
    chars['‟']=chars['“']
    chars['„']=shift(chars['"'],0,-640)
    chars['—']=rect(20,360,700,480)
    chars['…']=rect(80,0,160,160)|rect(320,0,400,160)|rect(560,0,640,160)
    chars['•']=circle(360,440,160,filled=True)
    chars['‣']=line(240,200,480,440,120)|line(240,680,480,440,120)|rect(200,200,320,680)
    chars['†']=rect(280,0,440,880)|rect(80,560,640,720)
    chars['‡']=chars['†']|rect(80,240,640,400)
    chars['‰']=mini(chars['%'],20,320,.65)|rect(360,0,480,160)|rect(540,0,660,160)
    chars['‹']=chars['<']; chars['›']=chars['>']
    chars['‖']=rect(180,0,300,880)|rect(420,0,540,880)
    chars['⁅']=chars['[']|rect(80,360,240,520)
    chars['⁆']=chars[']']|rect(480,360,640,520)
    for c,direction in {'←':'left','↑':'up','→':'right','↓':'down'}.items(): chars[c]=arrow(direction)
    chars['↔']=arrow(both=True); chars['↕']=arrow('up',both=True)
    for c,dx,dy in [('↖',-1,1),('↗',1,1),('↘',1,-1),('↙',-1,-1)]: chars[c]=diagonal_arrow(dx,dy)
    for c,direction in {'⇐':'left','⇑':'up','⇒':'right','⇓':'down'}.items(): chars[c]=arrow(direction,double=True)
    chars['⇔']=arrow(double=True,both=True); chars['⇕']=arrow('up',double=True,both=True)
    chars['↤']=arrow('left',bar=True); chars['↦']=arrow(bar=True)
    chars['↥']=arrow('up',bar=True); chars['↧']=arrow('down',bar=True)
    chars['↪']=arrow(hook=True); chars['↩']=arrow('left',hook=True)
    chars['↵']=arrow('left',hook=True)|rect(560,440,640,960)
    chars['⇄']=shift(mini(arrow(),0,0,.75),80,360)|shift(mini(arrow('left'),0,0,.75),80,-100)
    chars['⇆']=shift(mini(arrow('left'),0,0,.75),80,360)|shift(mini(arrow(),0,0,.75),80,-100)
    chars['↞']=chars['←']|line(400,200,200,440,80)|line(400,680,200,440,80)
    chars['↠']=chars['→']|line(320,200,520,440,80)|line(320,680,520,440,80)
    chars['↟']=arrow('up')|line(120,400,360,600,80)|line(600,400,360,600,80)
    chars['↡']=arrow('down')|line(120,480,360,280,80)|line(600,480,360,280,80)
    chars['⇥']=arrow()|rect(640,200,700,680)
    chars['⇤']=arrow('left')|rect(20,200,80,680)
    for code in range(0x2500,0x2580): chars[chr(code)]=box_character(chr(code))
    for code in range(0x2580,0x25a0): chars[chr(code)]=block_character(code)
    # Mathematical and programming symbols use the same skeleton and stroke.
    math_patterns={
        '∞':'......./......./......./.##.##./#######/##.#.##/##.#.##/#######/.##.##.',
        '∑':'#######/#######/.##..../..##.../...##../....##./...##../..##.../.##..../#######/#######',
        '∏':'#######/#######/.##.##./.##.##./.##.##./.##.##./.##.##./.##.##./.##.##./.##.##./.##.##.',
        '√':'.....##/.....##/....##./....##./....##./#..##../##.##../.####../.####../..##.../..##...',
        '∫':'....###/...####/...##../...##../...##../...##../...##../...##../...##../.####../.###...',
        '∂':'...##../....##./.....##/.....##/.######/#######/##...##/##...##/##...##/#######/.#####.',
        '∇':'#######/#######/##...##/##...##/.##.##./.##.##./.##.##./..###../..###../...#.../...#...',
        '∈':'......./......./.######/#######/##...../######./######./##...../#######/.######',
        '∋':'......./......./######./#######/.....##/.######/.######/.....##/#######/######.',
        '∧':'......./......./...#.../..###../..###../.##.##./.##.##./##...##/##...##',
        '∨':'......./......./##...##/##...##/.##.##./.##.##./..###../..###../...#...',
        '∩':'......./......./.#####./#######/##...##/##...##/##...##/##...##/##...##',
        '∪':'......./......./##...##/##...##/##...##/##...##/##...##/#######/.#####.',
        '⊂':'......./......./..#####/.######/##...../##...../##...../.######/..#####',
        '⊃':'......./......./#####../######./.....##/.....##/.....##/######./#####..',
        '∀':'##...##/##...##/##...##/#######/#######/.##.##./.##.##./..###../..###../...#.../...#...',
        '∃':'#######/#######/.....##/.....##/.....##/.######/.######/.....##/.....##/#######/#######',
        '∴':'......./......./...#.../..###../..###../......./......./.##.##./.##.##.',
        '∵':'......./......./.##.##./.##.##./......./......./..###../..###../...#...',
        'λ':'.##..../..##.../...##../...##../..####./..####./.##.##./.##.##./##..##./##...##/##...##',
        'π':'......./......./......./......./#######/#######/.##.##./.##.##./.##.##./.##.###/.##..##',
        'Δ':'...#.../..###../..###../.##.##./.##.##./.##.##./##...##/##...##/##...##/#######/#######',
        'Ω':'.#####./#######/##...##/##...##/##...##/##...##/##...##/.##.##./.##.##./###.###/###.###',
    }
    chars.update({c:pattern(d) for c,d in math_patterns.items()})
    chars['≠']=chars['=']|line(160,80,560,800,80,80)
    chars['≡']=rect(80,160,640,280)|rect(80,400,640,520)|rect(80,640,640,760)
    chars['≈']=shift(chars['~'],0,160)|shift(chars['~'],0,-160)
    chars['≃']=shift(chars['~'],0,120)|rect(80,160,640,280)
    chars['≤']=shift(chars['<'],0,100)|rect(80,0,640,80)
    chars['≥']=shift(chars['>'],0,100)|rect(80,0,640,80)
    chars['≪']=mini(chars['<'],0,200,.65)|mini(chars['<'],300,200,.65)
    chars['≫']=mini(chars['>'],0,200,.65)|mini(chars['>'],300,200,.65)
    chars['∉']=chars['∈']|line(160,80,560,800,80,80)
    chars['∅']=circle(360,440,300,100)|line(120,160,600,720,80,80)
    chars['∝']=chars['∞']-rect(520,280,640,600)
    chars['⊆']=shift(chars['⊂'],0,100)|rect(80,0,640,80)
    chars['⊇']=shift(chars['⊃'],0,100)|rect(80,0,640,80)
    chars['⊕']=circle(360,440,320,80)|rect(320,240,400,640)|rect(160,400,560,480)
    chars['⊗']=circle(360,440,320,80)|line(200,280,520,600,80,40)|line(200,600,520,280,80,40)
    chars['⊥']=rect(320,160,400,800)|rect(80,80,640,160)
    chars['⊤']=rect(320,80,400,720)|rect(80,720,640,800)
    chars['⊢']=rect(80,80,160,800)|rect(160,400,640,480)
    chars['⊣']=rect(560,80,640,800)|rect(80,400,560,480)
    chars['⊨']=rect(80,80,160,800)|rect(160,280,640,360)|rect(160,520,640,600)
    chars['⋅']=rect(280,360,440,520)
    chars['⋮']=rect(280,0,440,160)|rect(280,360,440,520)|rect(280,720,440,880)
    chars['⋯']=shift(chars['…'],0,360)
    chars['⋱']=rect(80,720,240,880)|rect(280,360,440,520)|rect(480,0,640,160)
    chars['⌈']=chars['[']-rect(160,0,640,160)
    chars['⌉']=chars[']']-rect(80,0,560,160)
    chars['⌊']=chars['[']-rect(160,720,640,880)
    chars['⌋']=chars[']']-rect(80,720,560,880)
    chars['⌘']=pattern('.##.##./##.#.##/##.#.##/.#####./..#.#../.#####./##.#.##/##.#.##/.##.##.')
    chars['⌥']=line(80,720,240,720,80)|line(240,720,480,160,80)|line(480,160,640,160,80)|rect(480,680,640,760)
    chars['⌃']=shift(chars['^'],0,-160)
    chars['⇧']=arrow('up')-rect(320,440,400,640)
    chars['⌫']=pattern('......./......./..#####/.######/##.#.##/#...#.#/##.#.##/.######/..#####')
    chars['⎋']=circle(360,440,320,60)|arrow('up')
    chars['⏎']=chars['↵']
    chars['␣']=rect(80,160,160,400)|rect(80,160,640,240)|rect(560,160,640,400)
    for c,filled in [('○',False),('●',True)]: chars[c]=circle(360,440,280,80,filled)
    chars['□']=rect(80,160,640,720)-rect(160,240,560,640)
    chars['■']=rect(80,160,640,720)
    chars['◇']=line(360,800,640,440,80)|line(640,440,360,80,80)|line(360,80,80,440,80)|line(80,440,360,800,80)
    chars['◆']=set().union(*(rect(360-w,y,360+w,y+40) for y in range(120,800,40) for w in [max(20,280-abs(y-440))]))
    chars['✓']=line(80,440,280,160,120)|line(280,160,640,800,120)
    chars['✗']=line(80,160,640,800,120)|line(80,800,640,160,120)
    chars['★']=pattern('...#.../...#.../..###../#######/.#####./..###../.#####./.##.##./.#...#.')
    # Standard Powerline private-use assignments. No broad PUA mapping.
    chars['\ue0a0']=line(200,120,200,760,80)|line(200,320,520,640,80)|circle(200,760,120,60)|circle(520,640,120,60)|circle(200,120,120,60)
    chars['\ue0a1']=pattern('.##.##./#######/.##.##./.##.##./#######/.##.##./......./####.../.##..../.##..../.#####.')
    chars['\ue0a2']=rect(120,0,600,520)|circle(360,600,200,80)-rect(0,0,720,520)
    chars['\ue0a2']-=rect(320,160,400,360)
    chars['\ue0b0']=set().union(*(rect(0,y,720*(1-abs((y+10-400)/720)),y+20) for y in range(DESCENT,ASCENT,20)))
    chars['\ue0b2']={(35-x,y) for x,y in chars['\ue0b0']}
    chars['\ue0b1']=(line(40,DESCENT,680,400,80)|line(680,400,40,ASCENT,80))&rect(0,DESCENT,720,ASCENT)
    chars['\ue0b3']={(35-x,y) for x,y in chars['\ue0b1']}
    # Each advertised code point must be deliberately present. No missing-char
    # loop aliases unsupported characters to a box, question mark, or A.
    assert all(chr(c) in chars for c in range(32,127))
    assert all(chr(c) in chars for c in range(160,384))
    assert all(chr(c) in chars for c in range(0x2500,0x25a0))
    return chars


def burn(shape, key, advance=ADVANCE, edge_to_edge=False):
    if not shape: return set()
    # A solid one-microcell bloom makes the face heavier. A second sparse halo
    # scatters along the horizontal scan rhythm. These are monochrome outlines,
    # not alpha, colour, a bitmap strike, or a baked soft blur.
    result=set(shape)
    near=set()
    for x,y in shape:
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
            if (x+dx,y+dy) not in shape: near.add((x+dx,y+dy))
    result |= near
    seed=sum(ord(c) for c in key)
    for x,y in near:
        for dx,dy in ((2,0),(-2,0),(1,1),(-1,-1)):
            nx,ny=x+dx,y+dy
            if (nx*11+ny*7+seed)%7 in (0,1) and (nx,ny) not in shape:
                result.add((nx,ny))
    # One 20-unit scan slit through broad strokes every 160 units. The two end
    # microcells are retained so stems stay connected and small marks survive.
    for x,y in tuple(shape):
        if y%8==3 and all((x+dx,y+dy) in shape for dx in (-1,0,1) for dy in (-1,0,1)):
            result.discard((x,y))
    # Preserve adjoining cell boundaries for terminal frames and separators.
    return {(x,y) for x,y in result if 0 <= x < advance//STEP and DESCENT//STEP <= y < ASCENT//STEP}


def outline(shape):
    pen=TTGlyphPen(None)
    if not shape: return pen.glyph()
    outgoing=defaultdict(set)
    for x,y in shape:
        if (x,y-1) not in shape: outgoing[(x+1,y)].add((x,y))
        if (x+1,y) not in shape: outgoing[(x+1,y+1)].add((x+1,y))
        if (x,y+1) not in shape: outgoing[(x,y+1)].add((x+1,y+1))
        if (x-1,y) not in shape: outgoing[(x,y)].add((x,y+1))
    def direction(a,b):
        dx,dy=b[0]-a[0],b[1]-a[1]
        return 0 if dx>0 else 1 if dy>0 else 2 if dx<0 else 3
    while outgoing:
        start=min(outgoing)
        points=[start]
        current=start
        previous=(start[0]-1,start[1])
        while True:
            candidates=outgoing[current]
            d=direction(previous,current)
            next_point=min(candidates,key=lambda p: ((direction(current,p)-d+1)%4,p))
            candidates.remove(next_point)
            if not candidates: del outgoing[current]
            previous,current=current,next_point
            if current==start: break
            points.append(current)
        corners=[]
        for i,p in enumerate(points):
            before,after=points[i-1],points[(i+1)%len(points)]
            if (p[0]-before[0])*(after[1]-p[1]) != (p[1]-before[1])*(after[0]-p[0]): corners.append(p)
        assert len(corners)>=4
        pen.moveTo(tuple(c*STEP for c in corners[0]))
        for point in corners[1:]: pen.lineTo(tuple(c*STEP for c in point))
        pen.closePath()
    return pen.glyph()


def glyph_name(character): return f'uni{ord(character):04X}'


def ligature_shape(sequence,chars):
    # Keep every source symbol recognizable and every N-character cluster N
    # cells wide. Neighbouring arrow/pipeline strokes receive a continuous beam.
    result=set().union(*(shift(chars[c],i*ADVANCE) for i,c in enumerate(sequence)))
    if sequence in ('->','<-','=>','|>','<|','<=>','<|>','|>>','<<|'):
        for i in range(len(sequence)-1):
            pair=sequence[i:i+2]
            if pair in ('->','|>','>>'):
                result|=rect(i*ADVANCE+400,400,(i+1)*ADVANCE+480,480)
            elif pair in ('<-','<|','<<'):
                result|=rect(i*ADVANCE+240,400,(i+1)*ADVANCE+400,480)
            elif pair in ('=>','<='):
                left=600 if pair=='=>' else 280
                right=320 if pair=='=>' else 120
                result|=rect(i*ADVANCE+left,160,(i+1)*ADVANCE+right,320)
                result|=rect(i*ADVANCE+left,480,(i+1)*ADVANCE+right,640)
    elif sequence in ('==','===','!=','!=='):
        # Two shared horizontal rails; the exclamation remains an exclamation.
        for i in range(len(sequence)-1):
            if sequence[i:i+2]=='==':
                result|=rect(i*ADVANCE+600,200,(i+1)*ADVANCE+120,320)
                result|=rect(i*ADVANCE+600,520,(i+1)*ADVANCE+120,640)
    return result


def build_font(chars, burned=False):
    family='Phosphor Wake Burn' if burned else 'Phosphor Wake'
    stem='PhosphorWake-Burn' if burned else 'PhosphorWake-Regular'
    fb=FontBuilder(UPM,isTTF=True)
    names=['.notdef']+[glyph_name(c) for c in sorted(chars,key=ord)]+[f'lig_{i:02d}' for i in range(len(LIGATURES))]
    fb.setupGlyphOrder(names)
    fb.setupCharacterMap({ord(c):glyph_name(c) for c in chars})
    raw={glyph_name(c):(s,ADVANCE,c) for c,s in chars.items()}
    notdef=rect(80,0,640,880)-rect(160,80,560,800)
    notdef|=line(160,160,560,720,60,80)
    raw['.notdef']=(notdef,ADVANCE,'.notdef')
    for i,seq in enumerate(LIGATURES): raw[f'lig_{i:02d}']=(ligature_shape(seq,chars),ADVANCE*len(seq),seq)
    glyphs={}
    metrics={}
    for name,(shape,width,key) in raw.items():
        if burned: shape=burn(shape,key,width)
        glyphs[name]=outline(shape)
        metrics[name]=(width,min((x*STEP for x,y in shape),default=0))
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=ASCENT,descent=DESCENT,lineGap=0)
    fb.setupNameTable({
        'familyName':family,'styleName':'Regular','uniqueFontIdentifier':f'1.000;JADA;{stem}',
        'fullName':family+' Regular','psName':stem,'version':'Version 1.000',
        'copyright':'Copyright 2026 Jason Adams. Original Phosphor Wake font software.',
        'manufacturer':'The Grove','designer':'Jason Adams / The Grove',
        'description':'Original heavy pixel monospace. Burn has monochrome scanline texture and a dithered outline halo. Web CSS adds optional soft phosphor glow.',
        'licenseDescription':'MIT License. Free to use, install, embed, modify and redistribute, including commercially. Preserve the copyright and license notice.',
        'licenseInfoURL':'https://opensource.org/license/mit',
    })
    fb.setupOS2(version=4,sTypoAscender=ASCENT,sTypoDescender=DESCENT,sTypoLineGap=0,
               usWinAscent=ASCENT,usWinDescent=-DESCENT,sCapHeight=880,sxHeight=560,
               usWeightClass=700 if burned else 600,usWidthClass=5,fsType=0,
               fsSelection=0x40|0x80,panose={'bFamilyType':2,'bSerifStyle':11,'bWeight':8 if burned else 7,'bProportion':9,'bContrast':1,'bStrokeVariation':1,'bArmStyle':1,'bLetterForm':1,'bMidline':1,'bXHeight':1})
    fb.setupPost(isFixedPitch=1,underlinePosition=-200,underlineThickness=80)
    fb.setupMaxp()
    font=fb.font
    font['OS/2'].xAvgCharWidth=ADVANCE
    font['head'].created=FIXED_TIMESTAMP
    font['head'].modified=FIXED_TIMESTAMP
    font.recalcTimestamp=False
    # Longest source sequences precede their prefixes. calt can be disabled by
    # editors, and the source text/copy operation remains ordinary ASCII.
    rules=[]
    for i in sorted(range(len(LIGATURES)),key=lambda i:-len(LIGATURES[i])):
        rules.append('sub '+' '.join(glyph_name(c) for c in LIGATURES[i])+f' by lig_{i:02d};')
    feature='languagesystem DFLT dflt;\nlanguagesystem latn dflt;\nfeature calt {\n'+'\n'.join(rules)+'\n} calt;'
    addOpenTypeFeaturesFromString(font,feature)
    path=ROOT/(stem+'.ttf')
    font.save(path)
    font.flavor='woff2'
    font.save(ROOT/(stem+'.woff2'))
    return path,len(glyphs)


def manifest(chars,glyph_count):
    ordered=sorted(chars,key=ord)
    groups=[]
    consumed=set()
    selectors=[
        ('latin-basic','ASCII / coding',lambda c:32<=ord(c)<=126),
        ('latin-1','Latin-1 supplement',lambda c:160<=ord(c)<=255),
        ('latin-extended','Latin Extended-A',lambda c:256<=ord(c)<=383),
        ('arrows','Arrows',lambda c:0x2190<=ord(c)<=0x21ff),
        ('math','Math / logic',lambda c:0x2200<=ord(c)<=0x22ff or c in 'λπΔΩ'),
        ('box-drawing','Box drawing',lambda c:0x2500<=ord(c)<=0x257f),
        ('blocks','Block elements',lambda c:0x2580<=ord(c)<=0x259f),
        ('powerline','Powerline',lambda c:0xe000<=ord(c)<=0xf8ff),
        ('symbols','Punctuation / symbols',lambda c:True),
    ]
    for gid,label,predicate in selectors:
        selected=[c for c in ordered if c not in consumed and predicate(c)]
        consumed.update(selected)
        groups.append({'id':gid,'label':label,'count':len(selected),'characters':''.join(selected),
                       'codepoints':[f'U+{ord(c):04X}' for c in selected]})
    pua_names={0xe0a0:'POWERLINE BRANCH',0xe0a1:'POWERLINE LINE NUMBER',0xe0a2:'POWERLINE PADLOCK',0xe0b0:'POWERLINE RIGHT SOLID SEPARATOR',0xe0b1:'POWERLINE RIGHT THIN SEPARATOR',0xe0b2:'POWERLINE LEFT SOLID SEPARATOR',0xe0b3:'POWERLINE LEFT THIN SEPARATOR'}
    return {'name':'Phosphor Wake','version':'1.000','characterCount':len(chars),'glyphCount':glyph_count,
            'unitsPerEm':UPM,'cellWidth':ADVANCE,'capHeight':880,'xHeight':560,
            'ascent':ASCENT,'descent':DESCENT,'lineGap':0,'groups':groups,'ligatures':LIGATURES,
            'families':[{'name':'Phosphor Wake','ttf':'PhosphorWake-Regular.ttf','woff2':'PhosphorWake-Regular.woff2'},
                        {'name':'Phosphor Wake Burn','ttf':'PhosphorWake-Burn.ttf','woff2':'PhosphorWake-Burn.woff2'}],
            'characters':[{'character':c,'codepoint':f'U+{ord(c):04X}','name':unicodedata.name(c,pua_names.get(ord(c),'UNNAMED'))} for c in ordered],
            'coverageNotes':['Complete printable ASCII, Latin-1 supplement and Latin Extended-A.','Complete Unicode Box Drawing (U+2500–U+257F) and Block Elements (U+2580–U+259F).','Selected arrows, mathematics, punctuation, keyboard symbols, and seven standard Powerline private-use glyphs.','Combining marks are not encoded separately; precomposed Latin letters are covered.','Space, nonbreaking space and soft hyphen have intentionally empty outlines.','The Burn face has physical monochrome texture. Soft luminous blur and colour require a rendering effect, supplied in the web CSS.']}


def main():
    chars=make_characters()
    paths=[]
    for burned in (False,True):
        path,count=build_font(chars,burned)
        paths.append(path)
        print(f'Built {path.name}: {len(chars)} characters, {count} glyphs')
    data=manifest(chars,count)
    (ROOT/'coverage.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    files=['PhosphorWake-Regular.ttf','PhosphorWake-Burn.ttf','PhosphorWake-Regular.woff2','PhosphorWake-Burn.woff2','phosphor-wake.css','LICENSE.txt','README.md','coverage.json','build.py','glyphs.py','requirements.txt','verify.py']
    with zipfile.ZipFile(ROOT/'PhosphorWake-font-kit.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        for name in files:
            path=ROOT/name
            if not path.exists(): raise FileNotFoundError(f'Kit source missing: {path}')
            info=zipfile.ZipInfo('PhosphorWake/'+name,date_time=(2026,9,4,0,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=0o644<<16
            archive.writestr(info,path.read_bytes())
    print('Wrote coverage.json and PhosphorWake-font-kit.zip')


if __name__=='__main__': main()
