"""Degauss accents and extended Latin.

Covers Latin-1 Supplement and Latin Extended-A completely, plus the Latin
Extended-B letters European languages and programmers reach for (Romanian
comma-below letters, schwa, florin, dotless j). Accented letters are drawn
from the same shapes as their base letters with purpose-drawn marks; marks
for capitals are flatter so every accent clears the line above.
"""
from __future__ import annotations

import unicodedata

from geometry import rect, circle, slant, beam, band
import glyphs as L
from glyphs import GLYPHS, glyph, ring, elbow, dot, bowl, _v_strokes
import symbols as S
from params import C30, C45, C60, C90


def base(p, ch):
    return GLYPHS[ch][1](p)


def advance(ch):
    return GLYPHS[ch][0]


# --- marks ------------------------------------------------------------------------------
# Each mark is drawn centred on cx with its lowest point at y0. `cap` selects
# the flatter capital variant.

def _mk_t(p):
    return p.V * 0.86


def m_acute(p, cx, y0, cap=False):
    h = 128 if cap else 158
    run = 96 if cap else 104
    return slant(cx - run / 2, y0, cx + run / 2, y0 + h, _mk_t(p))


def m_grave(p, cx, y0, cap=False):
    return m_acute(p, cx, y0, cap).mirror(cx)


def m_circumflex(p, cx, y0, cap=False):
    h = 124 if cap else 150
    w = 268 if not p.bold else 290
    v = _v_strokes(p, cx - w / 2, cx + w / 2, h, 0, flat=p.V * 0.7, t=_mk_t(p))
    return v.flip(h / 2).move(0, y0)


def m_caron(p, cx, y0, cap=False):
    h = 124 if cap else 150
    w = 268 if not p.bold else 290
    return _v_strokes(p, cx - w / 2, cx + w / 2, h, 0, flat=p.V * 0.7, t=_mk_t(p)).move(0, y0)


def m_breve(p, cx, y0, cap=False):
    h = 118 if cap else 140
    w = 250 if not p.bold else 280
    tv, th = p.V * 0.84, p.H * 0.84
    return ring(p, cx - w / 2, y0, cx + w / 2, y0 + h * 2.2, tv=tv, th=th, f=0.36) & band(y0 - 5, y0 + h)


def m_macron(p, cx, y0, cap=False):
    w = 290 if not p.bold else 310
    th = p.H * 0.94
    return rect(cx - w / 2, y0 + 24, cx + w / 2, y0 + 24 + th)


def _mark_dot(p):
    return p.dot * (0.9 if not p.bold else 0.84)


def m_dieresis(p, cx, y0, cap=False):
    d = _mark_dot(p)
    gap = 100 if not p.bold else 108
    return circle(cx - gap, y0 + d / 2, d / 2) | circle(cx + gap, y0 + d / 2, d / 2)


def m_dot(p, cx, y0, cap=False):
    d = _mark_dot(p)
    return circle(cx, y0 + d / 2, d / 2)


def m_ring(p, cx, y0, cap=False):
    h = 150 if cap else 172
    w = 168 if not p.bold else 196
    return ring(p, cx - w / 2, y0, cx + w / 2, y0 + h, tv=p.V * 0.78, th=p.H * 0.78, f=0.46)


def m_tilde(p, cx, y0, cap=False):
    w = 300 if not p.bold else 316
    amp = 36 if cap else 44
    th = p.H * 0.86
    tv = p.V * 0.86
    x0, x1 = cx - w / 2, cx + w / 2
    cy = y0 + amp + th / 2
    s = 6
    hump = ring(p, x0, cy - 400, cx + tv / 2, cy + amp + th / 2, tv=tv, th=th) & band(cy - s, 2000)
    dip = ring(p, cx - tv / 2, cy - amp - th / 2, x1, cy + 400, tv=tv, th=th) & band(-2000, cy + s)
    return hump | dip


def m_dblacute(p, cx, y0, cap=False):
    off = 76 if not p.bold else 86
    return m_acute(p, cx - off, y0, cap) | m_acute(p, cx + off, y0, cap)


def m_cedilla(p, cx, y0=None, cap=False):
    """A short stub under the letter and a reversed-c hook, open to the left."""
    tv, th = p.V * 0.82, p.H * 0.82
    stub = rect(cx - tv / 2, -84, cx + tv / 2, 14)
    x0, x1 = cx - 190, cx + (96 if not p.bold else 110)
    y_top, y_bot = -84 + th, -218
    hook = ring(p, x0, y_bot, x1, y_top, tv=tv, th=th, f=0.46)
    hook = hook - rect(x0 - 50, y_bot + th - 1, cx - tv / 2, y_top + 50) - rect(x0 - 50, y_bot - 50, cx - 96, y_bot + th + 1)
    return stub | hook


def m_ogonek(p, x_left, y0=None, cap=False):
    tv, th = p.V * 0.84, p.H * 0.84
    return elbow(p, x_left, -200, x_left + tv + 104, 12, 'bl', tv=tv, th=th, r=86)


def m_comma_below(p, cx, y0=None, cap=False):
    k = 0.86 if not p.bold else 0.6
    top = -46
    return S.comma_shape(p, cx, top - p.dot).scale(k, k, cx, top)


def m_comma_turned(p, cx, y0, cap=False):
    """Turned comma above (ģ)."""
    return S.comma_shape(p, cx, 0).rotate180(cx, 0).move(0, y0 + p.dot)


MARKS = {
    '̀': m_grave, '́': m_acute, '̂': m_circumflex, '̃': m_tilde,
    '̄': m_macron, '̆': m_breve, '̇': m_dot, '̈': m_dieresis,
    '̊': m_ring, '̋': m_dblacute, '̌': m_caron,
}
BELOW = {'̧': m_cedilla, '̨': m_ogonek, '̦': m_comma_below}


def mark_base_y(p, ch):
    """Lowest point of a top mark above base letter ch."""
    if ch.isupper():
        return p.C + (44 if not p.bold else 40)
    if ch in 'bdfhklt':
        return p.A + 44
    return p.X + (72 if not p.bold else 64)


def ink_center(p, ch, shape):
    b = shape.bounds
    return (b[0] + b[2]) / 2


def anchor_x(p, ch, shape):
    special = {
        'i': C30 / 2, 'ı': C30 / 2,
        'j': C45 - 100 - p.V / 2, 'ȷ': C45 - 100 - p.V / 2,
        'l': C30 / 2 - 30,
        'L': p.sbc + 12 + p.V / 2 + 60,
        'r': 86 + p.V / 2 + 70,
        'g': C60 / 2, 'y': C60 / 2, 'u': C60 / 2, 'a': C60 / 2 + 8,
    }
    if ch in special:
        return special[ch]
    return ink_center(p, ch, shape)


def ogonek_x(p, ch, shape):
    b = shape.bounds
    table = {
        'a': C60 - p.sb - p.V * 0.84, 'A': C60 - p.sbc - p.V * 0.84,
        'e': C60 / 2 + 60, 'E': C60 - p.sbc - 130,
        'i': C30 / 2 - p.V * 0.42, 'I': C45 / 2 - p.V * 0.42,
        'u': C60 - p.sb - p.V * 0.84, 'U': C60 / 2 + 70,
    }
    return table.get(ch, (b[0] + b[2]) / 2)


def apostrophe_mark(p, x_left, top):
    """The ’-shaped caron that Czech and Slovak hang beside ď ľ ť Ľ."""
    d = p.dot
    k = 0.9 if not p.bold else 0.72
    return S.comma_shape(p, x_left + d / 2, top - d).scale(k, k, x_left, top)


# --- dotless forms and helpers -----------------------------------------------------------

@glyph('ı', C30)
def dotless_i(p):
    xs = C30 / 2 - p.V / 2
    return rect(xs, 0, xs + p.V, p.X)


@glyph('ȷ', C45)
def dotless_j(p):
    xr = C45 - 100
    return elbow(p, 58, p.D, xr, 1, 'br', th=p.Ht, r=150) | rect(xr - p.V, 0, xr, p.X)


def compose(p, ch):
    """Build a precomposed letter from its NFD decomposition."""
    decomposed = unicodedata.normalize('NFD', ch)
    letter, marks = decomposed[0], decomposed[1:]
    # i and j lose their dot under a top mark, as in Latin type design.
    has_top = any(m in MARKS for m in marks)
    base_ch = {'i': 'ı', 'j': 'ȷ'}.get(letter, letter) if has_top else letter
    shape = base(p, base_ch)
    y = mark_base_y(p, letter)
    cx = anchor_x(p, letter, shape)
    for m in marks:
        if m in MARKS:
            mark = MARKS[m](p, cx, y, cap=letter.isupper())
            shape = shape | mark
            y = mark.bounds[3] + 40
        elif m == '̧':
            shape = shape | m_cedilla(p, cx)
        elif m == '̨':
            shape = shape | m_ogonek(p, ogonek_x(p, letter, shape))
        elif m == '̦':
            shape = shape | m_comma_below(p, cx)
        else:
            raise ValueError(f'no mark design for U+{ord(m):04X} in {ch}')
    return shape


def _register_composites():
    specials = set('ĸĿŀŉŊŋŒœĲĳĦħŁłŦŧĐđıſ') | set('ÆæØøÐðÞþß')
    targets = [chr(c) for c in range(0x00C0, 0x0180)] + ['Ș', 'ș', 'Ț', 'ț']
    for ch in targets:
        if ch in specials or ch in GLYPHS or ch in '×÷':
            continue
        decomposed = unicodedata.normalize('NFD', ch)
        if len(decomposed) < 2:
            continue
        letter = decomposed[0]
        if letter not in GLYPHS:
            continue
        GLYPHS[ch] = (advance(letter), (lambda c: (lambda p: compose(p, c)))(ch))


# --- Czech and Slovak apostrophe carons ----------------------------------------------

@glyph('ď', C60)
def d_caron(p):
    return base(p, 'd') | apostrophe_mark(p, C60 - p.sb + (30 if not p.bold else 18), p.A + 10)


@glyph('ľ', C45)
def l_caron(p):
    xs = C30 / 2 - p.V / 2 - 30
    return base(p, 'l') | apostrophe_mark(p, xs + p.V + 64, p.A + 10)


@glyph('Ľ', C60)
def L_caron(p):
    x0 = p.sbc + 12
    return base(p, 'L') | apostrophe_mark(p, x0 + p.V + 66, p.C + 10)


@glyph('ť', C45)
def t_caron(p):
    return base(p, 't') | apostrophe_mark(p, 116 + p.V + 56, p.X + 150)


@glyph('ģ', C60)
def g_cedilla(p):
    return base(p, 'g') | m_comma_turned(p, C60 / 2, p.X + 64)


@glyph('Ĺ', C60)
def L_acute(p):
    x0 = p.sbc + 12
    return base(p, 'L') | m_acute(p, x0 + p.V / 2 + 20, p.C + 44, cap=True)


@glyph('ĺ', C30)
def l_acute(p):
    xs = C30 / 2 - p.V / 2 - 30
    return base(p, 'l') | m_acute(p, xs + p.V / 2 + 14, p.A + 44, cap=True)


# --- stroked letters ----------------------------------------------------------------------

def _slash_through(p, x0, y0, x1, y1, t=None):
    t = p.V * 0.88 if t is None else t
    return beam(x0, y0, x1, y1, t)


@glyph('Ø', C60)
def O_slash(p):
    x0, y0, x1, y1 = L._O_box(p)
    return base(p, 'O') | (_slash_through(p, x0 + 10, y0 - 30, x1 - 10, y1 + 30) & band(y0 - 40, y1 + 40))


@glyph('ø', C60)
def o_slash(p):
    x0, x1 = p.sbr, C60 - p.sbr
    return base(p, 'o') | (_slash_through(p, x0 + 10, -40, x1 - 10, p.X + 40) & band(-50, p.X + 50))


def _stroke_bar(p, x0, x1, y):
    th = p.H * 0.92
    return rect(x0, y - th / 2, x1, y + th / 2)


@glyph('ÐĐ', C60)
def D_stroke(p):
    x0 = p.sbc
    return base(p, 'D') | _stroke_bar(p, x0 - 48, x0 + p.V + 110, p.C * 0.49)


@glyph('đ', C60)
def d_stroke(p):
    x1 = C60 - p.sb
    return base(p, 'd') | _stroke_bar(p, x1 - p.V - 118, x1 + 44, 632)


@glyph('Ħ', C60)
def H_stroke(p):
    x0, x1 = L._cap_box(p)
    return base(p, 'H') | _stroke_bar(p, x0 - 34, x1 + 34, p.C * 0.77)


@glyph('ħ', C60)
def h_stroke(p):
    x0 = p.sb
    return base(p, 'h') | _stroke_bar(p, x0 - 50, x0 + p.V + 118, 632)


@glyph('Ł', C60)
def L_stroke(p):
    x0 = p.sbc + 12
    return base(p, 'L') | (beam(x0 - 46, p.C * 0.30, x0 + p.V + 110, p.C * 0.58, p.H * 0.94))


@glyph('ł', C30)
def l_stroke(p):
    xs = C30 / 2 - p.V / 2 - 30
    return base(p, 'l') | beam(xs - 52, 300, xs + p.V + 60, 470, p.H * 0.9)


@glyph('Ŧ', C60)
def T_stroke(p):
    return base(p, 'T') | _stroke_bar(p, 150, C60 - 150, p.C * 0.47)


@glyph('ŧ', C45)
def t_stroke(p):
    return base(p, 't') | _stroke_bar(p, 44, C45 - 64, 300)


@glyph('Ŀ', C60)
def L_dot(p):
    x0 = p.sbc + 12
    return base(p, 'L') | dot(p, x0 + p.V + 150, p.C * 0.42)


@glyph('ŀ', C45)
def l_dot(p):
    return base(p, 'l').move(20, 0) | dot(p, 330, p.X * 0.52)


@glyph('ŉ', C90)
def n_apostrophe(p):
    d = p.dot * 0.9
    return base(p, 'n').move(300, 0) | S.comma_shape(p, 150, p.A - d).scale(0.95, 0.95, 150, p.A)


@glyph('Ŋ', C60)
def Eng(p):
    x0, x1 = L._cap_box(p)
    return base(p, 'N') | elbow(p, x1 - 250, p.D, x1, 12, 'br', th=p.Ht, r=150)


@glyph('ŋ', C60)
def eng(p):
    x0, x1 = L._n_box(p)
    return base(p, 'n') | elbow(p, x1 - 250, p.D, x1, 12, 'br', th=p.Ht, r=150)


@glyph('ĸ', C60)
def kra(p):
    x0, x1 = p.sb, C60 - p.sb + 8
    return L._k_limbs(p, x0, x1, p.X, round(p.X * 0.30), p.X)


@glyph('ſ', C45)
def long_s(p):
    return elbow(p, 116, 0, C45 - 34, p.A + p.oh, 'tl', r=150)


@glyph('Ĳ', C90)
def IJ(p):
    return base(p, 'I').move(-30, 0) | base(p, 'J').move(C90 - C60 + 10, 0)


@glyph('ĳ', C60)
def ij(p):
    xs = 110
    stem_i = rect(xs, 0, xs + p.V, p.X) | dot(p, xs + p.V / 2, p.X + p.dot_gap)
    xr = C60 - 100
    j_ = elbow(p, 220, p.D, xr, 1, 'br', th=p.Ht, r=150) | rect(xr - p.V, 0, xr, p.X) | dot(p, xr - p.V / 2, p.X + p.dot_gap)
    return stem_i | j_


# --- ligature letters -----------------------------------------------------------------------

@glyph('Æ', C90)
def AE(p):
    x0, x1 = p.sbc, C90 - p.sbc + 4
    xm = 430
    yb = L._bar(p, 0.40)
    left = ring(p, x0, -700, xm + p.V, p.C + p.oh, sq=('bl', 'br', 'tr')) & band(0, p.C + 20)
    ybm = L._bar(p)
    return (left | rect(x0, yb, xm + p.V, yb + p.H) | rect(xm, p.C - p.H, x1, p.C)
            | rect(xm, ybm, x1 - 34, ybm + p.H) | rect(xm, 0, x1, p.H))


@glyph('Œ', C90)
def OE(p):
    x0, x1 = p.sbcr, C90 - p.sbc + 4
    xm = 440
    left = ring(p, x0, 0, xm + p.V, p.C, sq=('br', 'tr'))
    ybm = L._bar(p)
    return left | rect(xm, p.C - p.H, x1, p.C) | rect(xm, ybm, x1 - 34, ybm + p.H) | rect(xm, 0, x1, p.H)


def _e_part(p, x0, x1, left_square=False):
    y0, y1 = -p.o, p.X + p.o
    th = p.Hc
    yb = round(0.53 * p.X - th / 2)
    sq = ('bl', 'tl') if left_square else ()
    shape = ring(p, x0, y0, x1, y1, sq=sq, th=th) | rect(x0 + p.V / 2, yb, x1 - p.V / 2, yb + th)
    ro, _ = p.radii(x1 - x0, y1 - y0, p.V, th)
    return shape - rect((x0 + x1) / 2, y0 + ro * p.term, x1 + 50, yb)


@glyph('æ', C90)
def ae(p):
    xm = 420
    left = L.a(p).move(xm + p.V - (C60 - p.sb), 0)
    return left | _e_part(p, xm, C90 - p.sbr, left_square=True)


@glyph('œ', C90)
def oe(p):
    xm = 424
    left = ring(p, p.sbr, -p.o, xm + p.V, p.X + p.o, sq=('br', 'tr'))
    return left | _e_part(p, xm, C90 - p.sbr, left_square=True)


@glyph('ß', C60)
def germandbls(p):
    """A stem carrying a 3: the open waist and foot keep it clear of B."""
    x0, x1 = p.sb, C60 - p.sbr
    th = p.Hc
    ym = round(p.A * 0.55)
    gap = 44 if not p.bold else 50
    xo = x0 + p.V + gap
    upper = ring(p, x0, ym - th / 2, x1 - 34, p.A + p.oh, th=th) - rect(x0 - 50, ym - th - 10, xo, ym + th / 2 + 1)
    lower = ring(p, x0, -p.oh, x1, ym + th / 2, th=th) - rect(x0 - 50, -p.oh - 50, xo, ym + th + 50)
    return upper | lower | rect(x0, 0, x0 + p.V, ym + th)


@glyph('ð', C60)
def eth(p):
    x0, x1 = p.sbr, C60 - p.sbr
    bowl_ = ring(p, x0, -p.o, x1, p.X + p.o)
    neck = elbow(p, C60 / 2 - 40, p.X - 60, x1, p.A, 'tr', r=150)
    bar = beam(x1 - p.V - 120, p.A - 250, x1 + 20, p.A - 150, p.H * 0.9)
    return bowl_ | neck | bar


@glyph('Þ', C60)
def Thorn(p):
    x0, x1 = p.sbc, C60 - p.sbcr - 4
    return bowl(p, x0, x1, round(p.C * 0.18), round(p.C * 0.82)) | rect(x0, 0, x0 + p.V, p.C)


@glyph('þ', C60)
def thorn(p):
    x0, x1 = p.sb, C60 - p.sbr
    return bowl(p, x0, x1, -p.oh, p.X + p.oh) | rect(x0, p.D, x0 + p.V, p.A)


# --- Latin Extended-B picks ---------------------------------------------------------------

@glyph('ƒ', C60)
def florin(p):
    xs = C60 / 2 - p.V / 2
    top = elbow(p, xs, 300, C60 - 70, p.A + p.oh, 'tl', r=150)
    bot = elbow(p, 70, p.D, xs + p.V, 310, 'br', th=p.Ht, r=150)
    return top | bot | rect(130, p.X - p.H, C60 - 150, p.X)


@glyph('ə', C60)
def schwa(p):
    return L.e(p).rotate180(C60 / 2, p.X / 2)


@glyph('Ə', C60)
def Schwa(p):
    x0, y0, x1, y1 = p.sbcr, -p.oc, C60 - p.sbcr, p.C + p.oc
    th = p.H
    yb = round(0.52 * p.C - th / 2)
    shape = ring(p, x0, y0, x1, y1, th=th) | rect(x0 + p.V / 2, yb, x1 - p.V / 2, yb + th)
    ro, _ = p.radii(x1 - x0, y1 - y0, p.V, th)
    shape = shape - rect((x0 + x1) / 2, y0 + ro * p.term, x1 + 50, yb)
    return shape.rotate180(C60 / 2, p.C / 2)


_register_composites()
