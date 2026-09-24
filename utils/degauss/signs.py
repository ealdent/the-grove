"""Degauss symbols beyond ASCII: Latin-1 signs, general punctuation, currency,
superscripts, fractions and letterlike symbols."""
from __future__ import annotations

import copy

from geometry import Shape, union, rect, rrect, circle, beam, poly, band, column, cut_stroke
import glyphs as L
import symbols as S
import latin as LT
from glyphs import GLYPHS, glyph, ring, elbow, dot, s_shape
from params import C30, C45, C60, C90


def base(p, ch):
    return GLYPHS[ch][1](p)


def heavier(p, f):
    """A copy of p whose strokes are f times heavier: the scaled-down forms
    (superscripts, fraction digits, enclosed letters) keep their colour."""
    q = copy.copy(p)
    for name in ('V', 'H', 'T', 'Hc', 'Ht', 'dot', 'rmin', 'trap_w'):
        setattr(q, name, getattr(p, name) * f)
    return q


SUP_SCALE = 0.60


def small_form(p, ch, x_center, y_base, scale=SUP_SCALE, weight=None):
    weight = (0.80 if not p.bold else 0.64) if weight is None else weight
    q = heavier(p, weight / scale)
    adv = GLYPHS[ch][0]
    shape = base(q, ch).scale(scale, scale, 0, 0)
    return shape.move(x_center - adv * scale / 2, y_base)


def sup(p, ch, cx=C45 / 2):
    return small_form(p, ch, cx, p.C + 12 - p.C * SUP_SCALE)


def sub(p, ch, cx=C45 / 2):
    return small_form(p, ch, cx, -150)


# --- inverted marks, cents, pounds ---------------------------------------------------------

@glyph('¡', C30)
def exclamdown(p):
    return S.excl_shape(p, C30 / 2).rotate180(C30 / 2, 275)


@glyph('¿', C60)
def questiondown(p):
    return S.question_shape(p).rotate180(C60 / 2, 275)


@glyph('¢', C60)
def cent(p):
    x0, x1 = p.sbr + 20, C60 - p.sbr - 10
    body = L.open_right(p, ring(p, x0, 40, x1, p.X - 10), x0, 40, x1, p.X - 10)
    w = p.V * 0.9
    return body | rect(C60 / 2 - w / 2, -80, C60 / 2 + w / 2, 60) | rect(C60 / 2 - w / 2, p.X - 30, C60 / 2 + w / 2, p.X + 90)


@glyph('£', C60)
def sterling(p):
    xs = 150 if not p.bold else 140
    hook = elbow(p, xs, 0, C60 - 70, p.C + p.oh, 'tl', r=170)
    yb = round(p.C * 0.42)
    return hook | rect(70, yb - p.H / 2, xs + p.V + 180, yb + p.H / 2) | rect(64, 0, C60 - 60, p.H)


@glyph('¤', C60)
def currency(p):
    cx, cy = C60 / 2, p.M + 30
    r = 150
    body = ring(p, cx - r, cy - r, cx + r, cy + r, tv=p.V * 0.9, th=p.H * 0.9, f=0.42)
    t = p.V * 0.85
    arms = [beam(cx + sx * (r - 30), cy + sy * (r - 30), cx + sx * (r + 70), cy + sy * (r + 70), t)
            for sx in (-1, 1) for sy in (-1, 1)]
    return body | union(*arms)


@glyph('¥', C60)
def yen(p):
    th = p.H * 0.92
    return (base(p, 'Y') | rect(130, p.C * 0.14, C60 - 130, p.C * 0.14 + th)
            | rect(130, p.C * 0.32, C60 - 130, p.C * 0.32 + th))


@glyph('¦', C30)
def brokenbar(p):
    x0 = C30 / 2 - p.V / 2
    return rect(x0, -180, x0 + p.V, 250) | rect(x0, 360, x0 + p.V, 790)


@glyph('§', C60)
def section(p):
    x0, x1 = p.sbcr + 28, C60 - p.sbcr - 28
    th = p.H * 0.95
    b = round((2 * p.C + th + p.oh) / 3)
    a = p.C - b
    return s_shape(p, x0, a, x1, p.C + p.oh, th, lift=0) | s_shape(p, x0, -p.oh, x1, b, th, lift=0)


@glyph('¶', C60)
def paragraph(p):
    xa = 300 if not p.bold else 290
    xb = C60 - 90
    bowl_ = rrect(84, round(p.C * 0.40), xa + p.V, p.C, (180, 0, 0, 180), p.k)
    return bowl_ | rect(xa, 0, xa + p.V, p.C) | rect(xb - p.V, 0, xb, p.C) | rect(xa, p.C - p.H, xb, p.C)


@glyph('·', C30)
def periodcentered(p):
    return circle(C30 / 2, p.M, p.dot / 2)


@glyph('∙', C30)
def bulletoperator(p):
    return circle(C30 / 2, p.M, p.dot / 2)


# --- spacing marks (C45) ------------------------------------------------------------------

def _spacing(mark, below=False):
    def build(p):
        if below:
            return mark(p, C45 / 2)
        return mark(p, C45 / 2, p.X + 72)
    return build


for _ch, _mk in {'¨': LT.m_dieresis, '¯': LT.m_macron, '´': LT.m_acute, 'ˆ': LT.m_circumflex,
                 'ˇ': LT.m_caron, '˘': LT.m_breve, '˙': LT.m_dot, '˚': LT.m_ring, '˜': LT.m_tilde,
                 '˝': LT.m_dblacute}.items():
    GLYPHS[_ch] = (C45, _spacing(_mk))
GLYPHS['¸'] = (C45, _spacing(LT.m_cedilla, below=True))
GLYPHS['˛'] = (C45, lambda p: LT.m_ogonek(p, C45 / 2 - p.V * 0.42))


# --- enclosed and small letters --------------------------------------------------------------

def _enclosed(p, ch):
    ring_ = ring(p, 70, -14, C90 - 70, p.C + 14, tv=p.Vi, th=p.Vi * 0.9, f=0.40)
    inner = small_form(p, ch, C90 / 2, p.C / 2 - p.C * 0.52 / 2, scale=0.52)
    return ring_ | inner


@glyph('©', C90)
def copyright(p):
    return _enclosed(p, 'C')


@glyph('®', C90)
def registered(p):
    return _enclosed(p, 'R')


@glyph('™', C90)
def trademark(p):
    return small_form(p, 'T', 250, p.C - p.C * 0.52 + 10, scale=0.52) | \
        small_form(p, 'M', 610, p.C - p.C * 0.52 + 10, scale=0.52)


@glyph('№', C90)
def numero(p):
    o = small_form(p, 'o', 700, p.C * 0.34, scale=0.62)
    bar = rect(700 - 130, p.C * 0.34 - 110, 700 + 130, p.C * 0.34 - 110 + p.H * 0.9)
    return base(p, 'N').move(10, 0) | o | bar


@glyph('ª', C45)
def ordfeminine(p):
    return small_form(p, 'a', C45 / 2, p.C * 0.40) | rect(C45 / 2 - 140, p.C * 0.40 - 110, C45 / 2 + 140, p.C * 0.40 - 110 + p.H * 0.9)


@glyph('º', C45)
def ordmasculine(p):
    return small_form(p, 'o', C45 / 2, p.C * 0.40) | rect(C45 / 2 - 140, p.C * 0.40 - 110, C45 / 2 + 140, p.C * 0.40 - 110 + p.H * 0.9)


@glyph('°', C45)
def degree(p):
    return ring(p, C45 / 2 - 104, p.C - 196, C45 / 2 + 104, p.C + 12, tv=p.V * 0.84, th=p.H * 0.84, f=0.46)


# --- operators beyond ASCII -------------------------------------------------------------------

@glyph('¬', C60)
def logicalnot(p):
    x0, x1 = S.opx(p)
    return rect(x0, p.M - p.H / 2 + 40, x1, p.M + p.H / 2 + 40) | rect(x1 - p.V, p.M - 150, x1, p.M + p.H / 2 + 40)


@glyph('±', C60)
def plusminus(p):
    x0, x1 = S.opx(p)
    hw = (x1 - x0) / 2
    cy = p.M + 80
    plus = rect(x0, cy - p.H / 2, x1, cy + p.H / 2) | rect(C60 / 2 - p.V / 2, cy - hw * 0.84, C60 / 2 + p.V / 2, cy + hw * 0.84)
    return plus | rect(x0, 0, x1, p.H)


@glyph('∓', C60)
def minusplus(p):
    return plusminus(p).flip(p.M + 40).move(0, 0)


@glyph('×', C60)
def multiply(p):
    x0, x1 = S.opx(p)
    h = (x1 - x0) / 2 * 0.78
    cx = C60 / 2
    t = p.V * 0.92
    return beam(cx - h, p.M - h, cx + h, p.M + h, t) | beam(cx - h, p.M + h, cx + h, p.M - h, t)


@glyph('÷', C60)
def divide(p):
    x0, x1 = S.opx(p)
    d = p.dot * 0.96
    gap = 72
    return (rect(x0, p.M - p.H / 2, x1, p.M + p.H / 2) | circle(C60 / 2, p.M + p.H / 2 + gap + d / 2, d / 2)
            | circle(C60 / 2, p.M - p.H / 2 - gap - d / 2, d / 2))


@glyph('−', C60)
def minus(p):
    return S.hyphen(p)


@glyph('«', C60)
def guillemetleft(p):
    t = p.T * 0.92
    hh = 150
    return S.chevron(p, 96, 276, p.M, hh, t) | S.chevron(p, 300, 480, p.M, hh, t)


@glyph('»', C60)
def guillemetright(p):
    return guillemetleft(p).mirror(C60 / 2)


@glyph('‹', C45)
def guilsinglleft(p):
    return S.chevron(p, 130, 316, p.M, 150, p.T * 0.92)


@glyph('›', C45)
def guilsinglright(p):
    return guilsinglleft(p).mirror(C45 / 2)


@glyph('µ', C60)
def micro(p):
    x0 = p.sb
    return base(p, 'u') | rect(x0, p.D, x0 + p.V, p.X)


# --- superscripts, subscripts, fractions --------------------------------------------------------

for _i, _ch in enumerate('⁰¹²³⁴⁵⁶⁷⁸⁹'):
    GLYPHS[_ch] = (C45, (lambda d: (lambda p: sup(p, d)))(str(_i)))
for _i, _ch in enumerate('₀₁₂₃₄₅₆₇₈₉'):
    GLYPHS[_ch] = (C45, (lambda d: (lambda p: sub(p, d)))(str(_i)))


def _fraction(p, num, den):
    n = small_form(p, num, 250, p.C - p.C * SUP_SCALE)
    d = small_form(p, den, 650, 0)
    slash = S.slash_shape(p, 330, 570, -10, p.C + 10)
    return n | d | slash


for _ch, (_n, _d) in {'¼': ('1', '4'), '½': ('1', '2'), '¾': ('3', '4')}.items():
    GLYPHS[_ch] = (C90, (lambda a, b: (lambda p: _fraction(p, a, b)))(_n, _d))


@glyph('⁄', C45)
def fractionslash(p):
    return S.slash_shape(p, 60, C45 - 60, -10, p.C + 10)


# --- general punctuation ----------------------------------------------------------------------

@glyph('‐‑\u00ad', C60)
def hyphens(p):
    return S.hyphen(p)


@glyph('‒', C60)
def figuredash(p):
    return rect(40, p.M - p.H / 2, C60 - 40, p.M + p.H / 2)


@glyph('–', C60)
def endash(p):
    return rect(20, p.M - p.H / 2, C60 - 20, p.M + p.H / 2)


@glyph('—', C90)
def emdash(p):
    return rect(20, p.M - p.H / 2, C90 - 20, p.M + p.H / 2)


@glyph('―', C90)
def horizontalbar(p):
    return rect(0, p.M - p.H / 2, C90, p.M + p.H / 2)


@glyph('‖', C45)
def dblverticalbar(p):
    return rect(C45 / 2 - 60 - p.V, -180, C45 / 2 - 60, 790) | rect(C45 / 2 + 60, -180, C45 / 2 + 60 + p.V, 790)


def quote_right(p, cx):
    """’: a comma hung from the cap line."""
    return S.comma_shape(p, cx, p.C + 30 - p.dot)


def quote_left(p, cx):
    d = p.dot
    return quote_right(p, cx).rotate180(cx, p.C + 30 - d / 2 - d * 0.35)


@glyph('’', C30)
def quoteright(p):
    return quote_right(p, C30 / 2 + 8)


@glyph('‘‛', C30)
def quoteleft(p):
    return quote_left(p, C30 / 2 - 8)


@glyph('‚', C30)
def quotesinglbase(p):
    return S.comma_shape(p, C30 / 2 + 8, 0)


def _dq_off(p):
    return (p.dot + 64) / 2


@glyph('”', C45)
def quotedblright(p):
    o = _dq_off(p)
    return quote_right(p, C45 / 2 - o + 8) | quote_right(p, C45 / 2 + o + 8)


@glyph('“‟', C45)
def quotedblleft(p):
    o = _dq_off(p)
    return quote_left(p, C45 / 2 - o - 8) | quote_left(p, C45 / 2 + o - 8)


@glyph('„', C45)
def quotedblbase(p):
    o = _dq_off(p)
    return S.comma_shape(p, C45 / 2 - o + 8, 0) | S.comma_shape(p, C45 / 2 + o + 8, 0)


@glyph('†', C60)
def dagger(p):
    return rect(C60 / 2 - p.V / 2, -130, C60 / 2 + p.V / 2, p.C + 20) | rect(120, p.C * 0.62, C60 - 120, p.C * 0.62 + p.H)


@glyph('‡', C60)
def daggerdbl(p):
    return dagger(p) | rect(120, p.C * 0.14, C60 - 120, p.C * 0.14 + p.H)


@glyph('•', C60)
def bullet(p):
    return circle(C60 / 2, p.M, 118 if not p.bold else 132)


@glyph('‣', C60)
def trianglebullet(p):
    r = 130
    return poly([(C60 / 2 - r * 0.8, p.M - r), (C60 / 2 + r, p.M), (C60 / 2 - r * 0.8, p.M + r)])


@glyph('…', C90)
def ellipsis(p):
    return dot(p, 150, 0) | dot(p, 450, 0) | dot(p, 750, 0)


@glyph('‰', C90)
def perthousand(p):
    tv, th = p.V * 0.82, p.H * 0.82
    a = ring(p, 44, 404, 234, p.C, tv=tv, th=th, f=0.36)
    b = ring(p, 356, 0, 546, p.C - 404, tv=tv, th=th, f=0.36)
    c = ring(p, 646, 0, 836, p.C - 404, tv=tv, th=th, f=0.36)
    return a | b | c | S.slash_shape(p, 60, 540, 0, p.C)


def prime_shape(p, cx):
    return cut_stroke((cx + 22, p.C + 30), (cx - 36, p.C - 170), p.V * 0.9, 'h', 'h')


@glyph('′', C30)
def prime(p):
    return prime_shape(p, C30 / 2)


@glyph('″', C45)
def dblprime(p):
    o = p.V * 0.5 + 34
    return prime_shape(p, C45 / 2 - o) | prime_shape(p, C45 / 2 + o)


@glyph('‴', C60)
def tripleprime(p):
    o = p.V + 46
    return prime_shape(p, C60 / 2 - o) | prime_shape(p, C60 / 2) | prime_shape(p, C60 / 2 + o)


@glyph('‼', C60)
def dblexclam(p):
    return S.excl_shape(p, C60 / 2 - 100) | S.excl_shape(p, C60 / 2 + 100)


@glyph('‽', C60)
def interrobang(p):
    return S.question_shape(p) | rect(C60 / 2 - p.V / 2, p.dot + round(p.V * 0.86), C60 / 2 + p.V / 2, p.C)


# --- currency ------------------------------------------------------------------------------------

def _bars(p, x0, x1, *ys, th=None):
    th = p.H * 0.9 if th is None else th
    return union(*[rect(x0, y - th / 2, x1, y + th / 2) for y in ys])


@glyph('€', C60)
def euro(p):
    x0, y0, x1, y1 = L._O_box(p)
    x0 += 40
    x1 += 30
    body = L.open_right(p, ring(p, x0, y0, x1, y1), x0, y0, x1, y1)
    return body | _bars(p, x0 - 60, x0 + 300, p.C * 0.40, p.C * 0.60)


@glyph('₽', C60)
def ruble(p):
    x0 = p.sbc + 30
    return base(p, 'P').move(30, 0) | _bars(p, x0 - 80, x0 + p.V + 200, p.C * 0.20)


@glyph('₿', C60)
def bitcoin(p):
    xa, xb = p.sbc + p.V + 40, p.sbc + p.V + 190
    w = p.V * 0.8
    return (base(p, 'B') | rect(xa - w / 2, p.C - 20, xa + w / 2, p.C + 110) | rect(xb - w / 2, p.C - 20, xb + w / 2, p.C + 110)
            | rect(xa - w / 2, -110, xa + w / 2, 20) | rect(xb - w / 2, -110, xb + w / 2, 20))


@glyph('₩', C90)
def won(p):
    return base(p, 'W') | _bars(p, 30, C90 - 30, p.C * 0.36, p.C * 0.60)


@glyph('₦', C60)
def naira(p):
    return base(p, 'N') | _bars(p, 30, C60 - 30, p.C * 0.38, p.C * 0.60)


@glyph('₱', C60)
def peso(p):
    return base(p, 'P') | _bars(p, 30, C60 - 60, p.C * 0.66, p.C * 0.86)


@glyph('₴', C60)
def hryvnia(p):
    body = s_shape(p, p.sbcr + 20, -p.oc, C60 - p.sbcr - 20, p.C + p.oc, p.H * 0.95, lift=8).mirror(C60 / 2)
    return body | _bars(p, 60, C60 - 60, p.C * 0.36, p.C * 0.64)


@glyph('₺', C60)
def lira(p):
    xs = 170
    stem = rect(xs, 0, xs + p.V, p.C)
    tb = p.H * 0.88
    bars = beam(xs - 80, p.C * 0.42, xs + p.V + 150, p.C * 0.56, tb) | beam(xs - 80, p.C * 0.62, xs + p.V + 150, p.C * 0.76, tb)
    return (stem | elbow(p, xs, 0, C60 - 64, 380, 'bl', r=200) | rect(C60 - 64 - p.V, 60, C60 - 64, 380) | bars)


@glyph('₹', C60)
def rupee(p):
    th = p.H * 0.92
    x0, x1 = 70, C60 - 70
    top = rect(x0, p.C - th, x1, p.C)
    mid = rect(x0, p.C * 0.64 - th / 2, x1, p.C * 0.64 + th / 2)
    hook = ring(p, x0 - 200, p.C * 0.34 - th / 2, x1 - 90, p.C, th=th) & column(x0 + 100, 2000)
    hook = hook - rect(x0 + 100, p.C * 0.34 + th / 2, x1 - 90 - p.V, p.C - th)
    leg = cut_stroke((x0 + 150, p.C * 0.34), (x1 - 40, 0), p.T, 'h', 'h') & band(0, p.C * 0.34)
    return top | mid | (hook & band(p.C * 0.34 - th / 2, p.C)) | rect(x0, p.C * 0.34 - th / 2, x0 + 200, p.C * 0.34 + th / 2) | leg


@glyph('₫', C60)
def dong(p):
    return LT.d_stroke(p).scale(0.86, 0.86, C60 / 2, 150) | rect(110, -150, C60 - 110, -150 + p.H * 0.9)


# --- spaces (every space is a width class too) ------------------------------------------------

@glyph('\u2007', C60)
def figurespace(p):
    return Shape()


@glyph('\u2008\u2009\u202f', C30)
def narrowspaces(p):
    return Shape()


@glyph('\u2002', C45)
def enspace(p):
    return Shape()


@glyph('\u2003', C90)
def emspace(p):
    return Shape()
