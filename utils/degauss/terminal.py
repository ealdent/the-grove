"""Degauss terminal and interface glyphs.

Box drawing and block elements fill the full line box (ASCENT to DESCENT) so
frames join between lines at line-height 1.2. Shade blocks are scanlines, not
dither: at text sizes they read as even tone, blown up they read as raster.
Also: geometric shapes, cassette transport controls, keyboard and IEC power
symbols, check marks, notes and the standard Powerline private-use glyphs.
"""
from __future__ import annotations

import math
import unicodedata

from geometry import (union, rect, rrect, circle, ellipse, beam, poly, band, column,
                      cut_stroke, outline, inset_convex)
import glyphs as L
import symbols as S
import mathsym as MS
from glyphs import GLYPHS, glyph, ring, elbow
from params import C60, C90, ASCENT, DESCENT

W = C60
BOT, TOP = DESCENT, ASCENT
CX, CY = W / 2, (ASCENT + DESCENT) / 2
# Strokes that reach the cell edge run a little past it, so neighbouring
# glyphs overlap instead of meeting on a fractional pixel and leaving a seam.
BLEED_Y, BLEED_X = 20, 12


def light(p):
    return 132 if p.bold else 80


def heavy(p):
    return 240 if p.bold else 156


# --- box drawing ---------------------------------------------------------------------------

def _dir_rect(direction, a, b):
    """Band of the line leaving the centre towards `direction`, offsets a..b."""
    if direction == 'LEFT':
        return rect(-BLEED_X, CY + a, CX, CY + b)
    if direction == 'RIGHT':
        return rect(CX, CY + a, W + BLEED_X, CY + b)
    if direction == 'UP':
        return rect(CX + a, CY, CX + b, TOP + BLEED_Y)
    return rect(CX + a, BOT - BLEED_Y, CX + b, CY)


def box_char(p, ch):
    name = unicodedata.name(ch).removeprefix('BOX DRAWINGS ')
    lt, hv = light(p), heavy(p)
    cell = rect(0, BOT, W, TOP)
    if 'DIAGONAL' in name:
        t = lt
        shapes = []
        if 'UPPER RIGHT' in name or 'CROSS' in name:
            shapes.append(beam(-30, BOT - 60, W + 30, TOP + 60, t))
        if 'UPPER LEFT' in name or 'CROSS' in name:
            shapes.append(beam(-30, TOP + 60, W + 30, BOT - 60, t))
        return union(*shapes) & cell
    if 'DASH' in name:
        count = 3 if 'TRIPLE' in name else 4 if 'QUADRUPLE' in name else 2
        t = hv if 'HEAVY' in name else lt
        horizontal = 'HORIZONTAL' in name
        span = W if horizontal else TOP - BOT
        seg = []
        for i in range(count):
            a, b = i * span / count + span / count * 0.18, (i + 1) * span / count - span / count * 0.18
            seg.append(rect(a, CY - t / 2, b, CY + t / 2) if horizontal else rect(CX - t / 2, BOT + a, CX + t / 2, BOT + b))
        return union(*seg)
    weights = ('LIGHT', 'HEAVY', 'DOUBLE', 'SINGLE')
    default = next((w for w in name.split() if w in weights), 'LIGHT')
    directions = {}
    for clause in name.replace('ARC ', '').split(' AND '):
        words = clause.split()
        weight = next((w for w in words if w in weights), default)
        for word in words:
            for d in {'VERTICAL': ['UP', 'DOWN'], 'HORIZONTAL': ['LEFT', 'RIGHT'], 'UP': ['UP'],
                      'DOWN': ['DOWN'], 'LEFT': ['LEFT'], 'RIGHT': ['RIGHT']}.get(word, []):
                directions[d] = weight
    if 'ARC' in name:
        # A squircle elbow between the two centre lines.
        r = 210
        t = lt
        h = 'RIGHT' if 'RIGHT' in directions else 'LEFT'
        v = 'UP' if 'UP' in directions else 'DOWN'
        ro, ri = r + t / 2, r - t / 2
        # Build ╭ (down and right) and reflect it into place.
        outer = rrect(CX - t / 2, BOT - 50, W + 50, CY + t / 2, (0, 0, 0, ro), p.k)
        inner = rrect(CX + t / 2, BOT - 60, W + 60, CY - t / 2, (0, 0, 0, ri), p.k)
        shape = (outer - inner) & rect(-BLEED_X, BOT - BLEED_Y, W + BLEED_X, TOP + BLEED_Y)
        if h == 'LEFT':
            shape = shape.mirror(CX)
        if v == 'UP':
            shape = shape.flip(CY)
        return shape
    kinds = set(directions.values())
    if kinds == {'DOUBLE'}:
        # Outline a wide connected path and remove its centre: true open
        # double-line elbows, tees and crosses with no stray inner stems.
        def path(width):
            half = width / 2
            shape = rect(CX - half, CY - half, CX + half, CY + half)
            for d in directions:
                shape = shape | _dir_rect(d, -half, half)
            return shape
        d_line = lt * 0.74
        gap = lt * 0.96
        return path(gap + 2 * d_line) - path(gap)
    shapes = []
    for d, kind in directions.items():
        if kind == 'DOUBLE':
            d_line, gap = lt * 0.74, lt * 0.96
            bands = [(-gap / 2 - d_line, -gap / 2), (gap / 2, gap / 2 + d_line)]
        elif kind == 'HEAVY':
            bands = [(-hv / 2, hv / 2)]
        else:
            bands = [(-lt / 2, lt / 2)]
        for a, b in bands:
            shapes.append(_dir_rect(d, a, b))
    shape = union(*shapes)
    if 'DOUBLE' in kinds:
        d_line, gap = lt * 0.74, lt * 0.96
        span = gap / 2 + d_line
        for hd in ('LEFT', 'RIGHT'):
            for vd in ('UP', 'DOWN'):
                if hd not in directions or vd not in directions:
                    continue
                if directions[hd] == 'DOUBLE':
                    shape = shape | rect(CX - lt / 2, CY - span, CX + lt / 2, CY + span)
                elif directions[vd] == 'DOUBLE':
                    shape = shape | rect(CX - span, CY - lt / 2, CX + span, CY + lt / 2)
    elif len(directions) > 1:
        w = min(hv if k == 'HEAVY' else lt for k in directions.values())
        shape = shape | rect(CX - w / 2, CY - w / 2, CX + w / 2, CY + w / 2)
    return shape


for _code in range(0x2500, 0x2580):
    GLYPHS[chr(_code)] = (W, (lambda c: (lambda p: box_char(p, c)))(chr(_code)))


# --- block elements -------------------------------------------------------------------------

def scanlines(level, pitch=50):
    """Shade as raster: horizontal lines covering `level` of each pitch."""
    h = pitch * level
    return union(*[rect(0, y, W, y + h) for y in range(BOT, TOP, pitch)])


def block_char(p, code):
    full_h = TOP - BOT
    bx0, bx1, by0, by1 = -BLEED_X, W + BLEED_X, BOT - BLEED_Y, TOP + BLEED_Y
    if code == 0x2580:
        return rect(bx0, CY, bx1, by1)
    if 0x2581 <= code <= 0x2588:
        return rect(bx0, by0, bx1, BOT + full_h * (code - 0x2580) / 8 + (BLEED_Y if code == 0x2588 else 0))
    if 0x2589 <= code <= 0x258F:
        return rect(bx0, by0, W * (0x2590 - code) / 8, by1)
    if code == 0x2590:
        return rect(CX, by0, bx1, by1)
    if 0x2591 <= code <= 0x2593:
        return scanlines((code - 0x2590) / 4)
    if code == 0x2594:
        return rect(bx0, TOP - full_h / 8, bx1, by1)
    if code == 0x2595:
        return rect(W - W / 8, by0, bx1, by1)
    quads = [rect(bx0, CY, CX, by1), rect(CX, CY, bx1, by1), rect(bx0, by0, CX, CY), rect(CX, by0, bx1, CY)]
    picks = {0x2596: [2], 0x2597: [3], 0x2598: [0], 0x2599: [0, 2, 3], 0x259A: [0, 3], 0x259B: [0, 1, 2],
             0x259C: [0, 1, 3], 0x259D: [1], 0x259E: [1, 2], 0x259F: [1, 2, 3]}
    return union(*[quads[i] for i in picks[code]])


for _code in range(0x2580, 0x25A0):
    GLYPHS[chr(_code)] = (W, (lambda c: (lambda p: block_char(p, c)))(_code))


# --- geometric shapes ------------------------------------------------------------------------

SHAPE_CY = 320


def squircle_square(p, half, filled=True, cy=SHAPE_CY, t=None):
    t = p.V * 0.9 if t is None else t
    r = half * 0.42
    outer = rrect(CX - half, cy - half, CX + half, cy + half, r, p.k)
    if filled:
        return outer
    ri = max(r - t, p.rmin)
    return outer - rrect(CX - half + t, cy - half + t, CX + half - t, cy + half - t, ri, p.k)


def rounded_poly(points, r):
    """A polygon with every corner rounded by r (grows the outline by r)."""
    return poly(points) | outline(points, 2 * r, join='round')


def triangle(p, direction, half=220, cy=SHAPE_CY, filled=True, round_r=None):
    rr = (18 if not p.bold else 22) if round_r is None else round_r
    h = half - rr
    pts = [(CX - h * 0.86, cy - h), (CX + h, cy), (CX - h * 0.86, cy + h)]
    shape = rounded_poly(pts, rr)
    if not filled:
        t = min(p.V * 0.86, half * 0.34)
        inner = inset_convex(pts, t - rr)
        if inner:
            shape = shape - poly(inner)
    if direction == 'left':
        shape = shape.mirror(CX)
    elif direction == 'up':
        shape = shape.rotate90(CX, cy)
    elif direction == 'down':
        shape = shape.rotate90(CX, cy, ccw=False)
    return shape


for _ch, (_d, _f, _s) in {'▲': ('up', True, 240), '△': ('up', False, 240), '▶': ('right', True, 240),
                          '▷': ('right', False, 240), '▼': ('down', True, 240), '▽': ('down', False, 240),
                          '◀': ('left', True, 240), '◁': ('left', False, 240), '▴': ('up', True, 130),
                          '▵': ('up', False, 150), '▸': ('right', True, 130), '▹': ('right', False, 150),
                          '▾': ('down', True, 130), '▿': ('down', False, 150), '◂': ('left', True, 130),
                          '◃': ('left', False, 150), '►': ('right', True, 190), '◄': ('left', True, 190)}.items():
    GLYPHS[_ch] = (W, (lambda d, f, s: (lambda p: triangle(p, d, s, filled=f)))(_d, _f, _s))


@glyph('■', C60)
def blacksquare(p):
    return squircle_square(p, 230)


@glyph('□', C60)
def whitesquare(p):
    return squircle_square(p, 230, filled=False)


@glyph('▪', C60)
def smallblacksquare(p):
    return squircle_square(p, 124)


@glyph('▫', C60)
def smallwhitesquare(p):
    return squircle_square(p, 130, filled=False, t=p.V * 0.8)


@glyph('◼', C60)
def mediumblacksquare(p):
    return squircle_square(p, 180)


@glyph('◻', C60)
def mediumwhitesquare(p):
    return squircle_square(p, 180, filled=False)


@glyph('▬', C60)
def blackrect(p):
    return rrect(40, SHAPE_CY - 100, W - 40, SHAPE_CY + 100, 70, p.k)


def diamond(p, half=260, filled=True):
    pts = [(CX, SHAPE_CY - half), (CX + half * 0.9, SHAPE_CY), (CX, SHAPE_CY + half), (CX - half * 0.9, SHAPE_CY)]
    pts = [(x + (CX - x) * 0.06, y + (SHAPE_CY - y) * 0.06) for x, y in pts]
    shape = rounded_poly(pts, 16)
    if not filled:
        inner = inset_convex(pts, p.V * 0.9 - 16)
        if inner:
            shape = shape - poly(inner)
    return shape


@glyph('◆', C60)
def blackdiamond(p):
    return diamond(p)


@glyph('◇', C60)
def whitediamond(p):
    return diamond(p, filled=False)


def round_ring(p, r, cy=SHAPE_CY, t=None):
    t = p.V * 0.9 if t is None else t
    return circle(CX, cy, r) - circle(CX, cy, r - t)


@glyph('●', C60)
def blackcircle(p):
    return circle(CX, SHAPE_CY, 240)


@glyph('○', C60)
def whitecircle(p):
    return round_ring(p, 240)


@glyph('◯', C60)
def largecircle(p):
    return round_ring(p, 280)


@glyph('◎', C60)
def bullseye(p):
    return round_ring(p, 250) | round_ring(p, 130)


@glyph('◉', C60)
def fisheye(p):
    return round_ring(p, 250) | circle(CX, SHAPE_CY, 120)


@glyph('◐', C60)
def halfleft(p):
    return round_ring(p, 240) | (circle(CX, SHAPE_CY, 240) & column(0, CX))


@glyph('◑', C60)
def halfright(p):
    return round_ring(p, 240) | (circle(CX, SHAPE_CY, 240) & column(CX, W))


@glyph('◒', C60)
def halflower(p):
    return round_ring(p, 240) | (circle(CX, SHAPE_CY, 240) & band(-1000, SHAPE_CY))


@glyph('◓', C60)
def halfupper(p):
    return round_ring(p, 240) | (circle(CX, SHAPE_CY, 240) & band(SHAPE_CY, 2000))


# --- cassette transport controls ----------------------------------------------------------

TCY = 330


def play(p, cx, half=190, cy=TCY):
    rr = 16 if not p.bold else 20
    h = half - rr
    return rounded_poly([(cx - h * 0.8, cy - h), (cx + h * 0.9, cy), (cx - h * 0.8, cy + h)], rr)


def tbar(p, x, half=190, w=None):
    w = (100 if not p.bold else 124) if w is None else w
    return rrect(x - w / 2, TCY - half, x + w / 2, TCY + half, 22, p.k)


@glyph('⏵', C60)
def t_play(p):
    return play(p, CX + 20)


@glyph('⏴', C60)
def t_back(p):
    return t_play(p).mirror(CX)


@glyph('⏶', C60)
def t_up(p):
    return play(p, CX + 20).rotate90(CX, TCY)


@glyph('⏷', C60)
def t_down(p):
    return play(p, CX + 20).rotate90(CX, TCY, ccw=False)


@glyph('⏸', C60)
def t_pause(p):
    return tbar(p, CX - 90) | tbar(p, CX + 90)


@glyph('⏹', C60)
def t_stop(p):
    return rrect(CX - 190, TCY - 190, CX + 190, TCY + 190, 60, p.k)


@glyph('⏺', C60)
def t_record(p):
    return circle(CX, TCY, 200)


@glyph('⏩', C90)
def t_ff(p):
    return play(p, 300) | play(p, 600)


@glyph('⏪', C90)
def t_rew(p):
    return t_ff(p).mirror(C90 / 2)


@glyph('⏫', C60)
def t_upup(p):
    one = play(p, CX, half=150).rotate90(CX, TCY)
    return one.move(0, 120) | one.move(0, -120)


@glyph('⏬', C60)
def t_dndn(p):
    return t_upup(p).flip(TCY)


@glyph('⏭', C90)
def t_next(p):
    return play(p, 250) | play(p, 540) | tbar(p, 760)


@glyph('⏮', C90)
def t_prev(p):
    return t_next(p).mirror(C90 / 2)


@glyph('⏯', C90)
def t_playpause(p):
    return play(p, 280) | tbar(p, 560, w=90) | tbar(p, 710, w=90)


@glyph('⏏', C60)
def t_eject(p):
    tri = rounded_poly([(CX - 190, 280), (CX + 190, 280), (CX, 560)], 16)
    return tri | rrect(CX - 204, 120, CX + 204, 210, 20, p.k)


# --- keyboard, power and interface symbols ----------------------------------------------------

@glyph('⌘', C60)
def command(p):
    """Four squircle loops on a square: the place-of-interest sign."""
    t = min(p.V * 0.82, 82)
    a = 104 if not p.bold else 98      # half side of the central square (centre-line)
    s = 156 if not p.bold else 196     # loop size
    cy = 330
    shapes = [rect(CX - a - t / 2, cy - a - t / 2, CX + a + t / 2, cy + a + t / 2)
              - rect(CX - a + t / 2, cy - a + t / 2, CX + a - t / 2, cy + a - t / 2)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            x0 = CX + sx * a + (-s + t / 2 if sx < 0 else -t / 2)
            y0 = cy + sy * a + (-s + t / 2 if sy < 0 else -t / 2)
            shapes.append(ring(p, x0, y0, x0 + s, y0 + s, tv=t, th=t, f=0.46))
    return union(*shapes)


@glyph('⌥', C60)
def option(p):
    t = p.H * 0.95
    top, bot = 540, 120
    x0, xa, xb, x1 = 60, 210, 390, W - 60
    diag = cut_stroke((xa - 10, top - t / 2), (xb + 10, bot + t / 2), p.T * 0.95, 'h', 'h')
    return (rect(x0, top - t, xa + 20, top) | diag | rect(xb - 20, bot, x1, bot + t) | rect(xb + 30, top - t, x1, top))


def shift_outline(p, lift=0):
    t = p.V * 0.86 if not p.bold else p.V * 0.7
    w = 250 - t / 2          # the stroke is centred on the path: keep it in the cell
    cy0 = 120 + lift + t / 2
    pts = [(CX, 600 + lift - t / 2), (CX + w, 350 + lift), (CX + 110 - t / 4, 350 + lift), (CX + 110 - t / 4, cy0),
           (CX - 110 + t / 4, cy0), (CX - 110 + t / 4, 350 + lift), (CX - w, 350 + lift)]
    return outline(pts, t)


@glyph('⇧', C60)
def shift(p):
    return shift_outline(p)


@glyph('⇪', C60)
def capslock(p):
    return shift_outline(p, lift=90) | rect(CX - 110 - p.V * 0.43, 60, CX + 110 + p.V * 0.43, 60 + p.H)


@glyph('⌃', C60)
def control(p):
    return S.caret(p).move(0, -120)


def erase_shape(p):
    t = p.Vi
    cy = 330
    pts = [(60, cy), (190, cy + 200), (W - 60, cy + 200), (W - 60, cy - 200), (190, cy - 200)]
    shape = outline(pts, t)
    h = 76
    xc = 350
    tx = p.Vi * 0.92
    return shape | beam(xc - h, cy - h, xc + h, cy + h, tx) | beam(xc - h, cy + h, xc + h, cy - h, tx)


@glyph('⌫', C60)
def eraseleft(p):
    return erase_shape(p)


@glyph('⌦', C60)
def eraseright(p):
    return erase_shape(p).mirror(CX)


def iec_ring(p, r=220, cy=330, gap_deg=0):
    t = p.Vi
    shape = circle(CX, cy, r) - circle(CX, cy, r - t)
    if gap_deg:
        half = math.radians(gap_deg / 2)
        wedge = poly([(CX, cy), (CX + math.sin(half) * 800, cy + math.cos(half) * 800),
                      (CX - math.sin(half) * 800, cy + math.cos(half) * 800)])
        shape = shape - wedge
    return shape


@glyph('⏻', C60)
def power(p):
    return iec_ring(p, gap_deg=70) | rect(CX - p.Vi / 2, 330 - 20, CX + p.Vi / 2, 330 + 290)


@glyph('⏼', C60)
def poweronoff(p):
    r = 250 if p.bold else 220
    return iec_ring(p, r=r) | rect(CX - p.Vi / 2, 330 - 110, CX + p.Vi / 2, 330 + 110)


@glyph('⏽', C60)
def poweron(p):
    return rect(CX - p.Vi / 2, 330 - 230, CX + p.Vi / 2, 330 + 230)


@glyph('⭘', C60)
def poweroff(p):
    return iec_ring(p)


@glyph('⏾', C60)
def sleep(p):
    return circle(CX, 330, 230) - circle(CX + 110, 330 + 70, 200)


@glyph('⎋', C60)
def escape(p):
    ring_ = iec_ring(p, r=230, gap_deg=0)
    ring_ = ring_ - poly([(CX, 330), (CX - 800, 330 + 800 * 0.45), (CX - 800 * 0.45, 330 + 800)])
    arr = MS.arrow(p, (CX + 10, 330 - 10), (CX - 190, 330 + 190), head=110, spread=110, t_arm=p.Vi, t_shaft=p.Vi)
    return ring_ | arr


@glyph('␣', C60)
def openbox(p):
    return rect(70, -40, W - 70, -40 + p.H) | rect(70, -40, 70 + p.V, 120) | rect(W - 70 - p.V, -40, W - 70, 120)


@glyph('✓', C60)
def check(p, t=None):
    t = p.V * 1.0 if t is None else t
    return beam(70, 300, 230, 100, t) | beam(206, 110, W - 60, 620, t)


@glyph('✔', C60)
def heavycheck(p):
    return check(p, p.V * 1.5)


@glyph('✗', C60)
def ballotx(p, t=None):
    t = p.V * 1.0 if t is None else t
    return beam(100, 90, W - 90, 590, t) | beam(110, 600, W - 110, 80, t)


@glyph('✘', C60)
def heavyballotx(p):
    return ballotx(p, p.V * 1.5)


def star_points(cx, cy, r_out, r_in, n=5):
    pts = []
    for i in range(2 * n):
        r = r_out if i % 2 == 0 else r_in
        a = math.pi / 2 + i * math.pi / n
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


@glyph('★', C60)
def blackstar(p):
    return poly(star_points(CX, 310, 280, 118))


@glyph('☆', C60)
def whitestar(p):
    t = p.V * 0.8 if not p.bold else p.V * 0.62
    pts = star_points(CX, 310, 280 - t * 0.9, 118 - t * 0.2)
    return outline(pts, t, join='round')


@glyph('☐', C60)
def ballotbox(p):
    return squircle_square(p, 240, filled=False, cy=330)


@glyph('☑', C60)
def ballotcheck(p):
    return ballotbox(p) | (check(p, p.V * 0.9).scale(0.62, 0.62, CX, 330).move(10, -10))


@glyph('☒', C60)
def ballotboxx(p):
    return ballotbox(p) | ballotx(p, p.V * 0.9).scale(0.56, 0.56, CX, 340).move(0, -10)


@glyph('♪', C60)
def eighthnote(p):
    x_stem = 316
    head = ellipse(220, 90, 110, 84)
    stem = rect(x_stem - p.V, 90, x_stem, 660)
    flag = elbow(p, x_stem - p.V, 380, 500, 660, 'tl', r=140)
    return head | stem | flag


@glyph('♫', C60)
def beamednotes(p):
    h1 = ellipse(150, 90, 96, 76)
    h2 = ellipse(420, 140, 96, 76)
    s1 = rect(246 - p.V, 90, 246, 640)
    s2 = rect(516 - p.V, 140, 516, 690)
    beam_ = cut_stroke((246 - p.V, 640 - p.H * 0.6), (516, 690 - p.H * 0.6), p.H * 1.4, 'v', 'v')
    return h1 | h2 | s1 | s2 | beam_


# --- Powerline (standard private-use assignments) ---------------------------------------------

@glyph('\ue0a0', C60)
def pl_branch(p):
    """Version-control branch: a trunk with a squircle fork to a second node."""
    t = p.Vi
    xs, xb = 170, 430
    trunk = rect(xs - t / 2, 110, xs + t / 2, 610)
    fork = elbow(p, xs - t / 2, 300 - t / 2, xb + t / 2, 560, 'br', tv=t, th=t, r=150)
    node = 64 if not p.bold else 72
    nodes = circle(xs, 110, node) | circle(xs, 610, node) | circle(xb, 610, node)
    return trunk | fork | nodes


@glyph('\ue0a1', C60)
def pl_linenumber(p):
    small = lambda ch, x, y: L.GLYPHS[ch][1](p).scale(0.5, 0.5, 0, 0).move(x, y)
    return small('L', 70, 380) | small('N', 280, 20)


@glyph('\ue0a2', C60)
def pl_padlock(p):
    t = p.V * 0.9
    body = rrect(90, 20, W - 90, 380, 60, p.k) - circle(CX, 230, 46) - rect(CX - 18, 110, CX + 18, 230)
    shackle = ring(p, 160, 300, W - 160, 660, tv=t, th=t, f=0.5) & band(360, 700)
    legs = rect(160, 330, 160 + t, 400) | rect(W - 160 - t, 330, W - 160, 400)
    return body | shackle | legs


@glyph('\ue0b0', C60)
def pl_right(p):
    return poly([(0, BOT), (W, CY), (0, TOP)])


@glyph('\ue0b2', C60)
def pl_left(p):
    return pl_right(p).mirror(CX)


@glyph('\ue0b1', C60)
def pl_right_thin(p):
    t = light(p)
    return (cut_stroke((0, TOP), (W - t, CY), t, 'v', 'v') | cut_stroke((0, BOT), (W - t, CY), t, 'v', 'v')) & rect(0, BOT, W, TOP)


@glyph('\ue0b3', C60)
def pl_left_thin(p):
    return pl_right_thin(p).mirror(CX)


def _half_squircle(p):
    return rrect(-W, BOT, W, TOP, (0, (W, (TOP - BOT) / 2), (W, (TOP - BOT) / 2), 0), p.k) & rect(0, BOT, W, TOP)


@glyph('\ue0b4', C60)
def pl_round_right(p):
    return _half_squircle(p)


@glyph('\ue0b6', C60)
def pl_round_left(p):
    return _half_squircle(p).mirror(CX)


@glyph('\ue0b5', C60)
def pl_round_right_thin(p):
    t = light(p)
    inner = rrect(-W, BOT + t, W - t, TOP - t, (0, (W - t, (TOP - BOT) / 2 - t), (W - t, (TOP - BOT) / 2 - t), 0), p.k)
    return _half_squircle(p) - inner


@glyph('\ue0b7', C60)
def pl_round_left_thin(p):
    return pl_round_right_thin(p).mirror(CX)
