"""Degauss Greek: the monotonic alphabet with tonos and dialytika.

Capitals shared with Latin reuse the Latin drawings; the rest are drawn in
the same squircle system. Lowercase is its own design, not Latin in costume.
"""
from __future__ import annotations

import math

from geometry import rect, poly, band, column, cut_stroke, slant
import glyphs as L
import latin as LT
import mathsym as MS
from glyphs import GLYPHS, glyph, ring, elbow, trap, bowl, _v_strokes
from params import C30, C45, C60, C90


def base(p, ch):
    return GLYPHS[ch][1](p)


def alias(target, source):
    GLYPHS[target] = (GLYPHS[source][0], (lambda s: (lambda p: base(p, s)))(source))


for _g, _l in zip('ΑΒΕΖΗΙΚΜΝΟΡΤΥΧ', 'ABEZHIKMNOPTYX'):
    alias(_g, _l)
for _g, _l in {'ο': 'o', 'ν': 'v', 'κ': 'ĸ', 'μ': 'µ'}.items():
    alias(_g, _l)
alias(';', ';')        # Greek question mark
alias('·', '·')        # ano teleia


# --- capitals ---------------------------------------------------------------------------

@glyph('Γ', C60)
def Gamma(p):
    x0, x1 = p.sbc + 10, C60 - p.sbc + 4
    return rect(x0, 0, x0 + p.V, p.C) | rect(x0, p.C - p.H, x1, p.C)


@glyph('Δ', C60)
def Delta(p):
    return MS.delta_shape(p)


@glyph('Θ', C60)
def Theta(p):
    x0, y0, x1, y1 = L._O_box(p)
    return ring(p, x0, y0, x1, y1) | rect(x0 + p.V / 2, p.C / 2 - p.H / 2, x1 - p.V / 2, p.C / 2 + p.H / 2)


@glyph('Λ', C60)
def Lambda(p):
    return L._A_diagonal(p, bar=False)


@glyph('Ξ', C60)
def Xi(p):
    x0, x1 = p.sbc, C60 - p.sbc
    yb = L._bar(p)
    return rect(x0, p.C - p.H, x1, p.C) | rect(x0 + 50, yb, x1 - 50, yb + p.H) | rect(x0, 0, x1, p.H)


@glyph('Π', C60)
def Pi(p):
    x0, x1 = L._cap_box(p)
    return rect(x0, p.C - p.H, x1, p.C) | rect(x0, 0, x0 + p.V, p.C) | rect(x1 - p.V, 0, x1, p.C)


@glyph('Σ', C60)
def Sigma(p):
    x0, x1 = p.sbc, C60 - p.sbc
    top, bottom = p.C, 0
    mid = (top + bottom) / 2
    t = p.T
    upper = cut_stroke((x0 + t * 0.62, top - p.H / 2), (C60 / 2 + 30, mid), t, 'h', (1, 0.0001))
    lower = cut_stroke((x0 + t * 0.62, bottom + p.H / 2), (C60 / 2 + 30, mid), t, 'h', (1, 0.0001))
    body = (upper | lower) & column(x0, x1) & band(bottom, top)
    return body | rect(x0, top - p.H, x1, top) | rect(x0, bottom, x1, bottom + p.H)


@glyph('Φ', C60)
def Phi(p):
    x0, x1 = p.sbcr - 10, C60 - p.sbcr + 10
    return ring(p, x0, 110, x1, p.C - 110, f=0.44) | rect(C60 / 2 - p.V / 2, 0, C60 / 2 + p.V / 2, p.C)


@glyph('Ψ', C60)
def Psi(p):
    x0, x1 = p.sbc - 10, C60 - p.sbc + 10
    cup = ring(p, x0, round(p.C * 0.30), x1, p.C + 700, sq=('tl', 'tr')) & band(0, p.C)
    return cup | rect(C60 / 2 - p.V / 2, 0, C60 / 2 + p.V / 2, p.C)


@glyph('Ω', C60)
def Omega(p):
    """Bowl, inward-turning ends, short legs, outward feet."""
    x0, x1 = p.sbc - 24, C60 - p.sbc + 24
    cx = C60 / 2
    g = 96 if not p.bold else 88
    lift = 150
    body = ring(p, x0 + 30, lift, x1 - 30, p.C + p.oc) - rect(cx - g, lift - 10, cx + g, lift + p.H + 10)
    legs = rect(cx - g - p.V, 0, cx - g, lift + p.H) | rect(cx + g, 0, cx + g + p.V, lift + p.H)
    feet = rect(x0, 0, cx - g, p.H) | rect(cx + g, 0, x1, p.H)
    return body | legs | feet


# --- lowercase ----------------------------------------------------------------------------

@glyph('α', C60)
def alpha(p):
    x0, x1 = p.sbr, C60 - p.sb + 10
    shape = bowl(p, x0, x1 - 30, -p.oh, p.X + p.oh, stem='right')
    tail = elbow(p, x1 - 30 - p.V, -p.oh, x1 + 16, p.X + p.oh, 'bl', r=90)
    return shape | tail


@glyph('β', C60)
def beta(p):
    x0, x1 = p.sb, C60 - p.sbr
    th = p.Hc
    ym = round(p.A * 0.52)
    upper = ring(p, x0, ym - th / 2, x1 - 30, p.A + p.oh, sq=('bl',), th=th)
    lower = ring(p, x0, -p.oh, x1, ym + th / 2, sq=('tl', 'bl'), th=th)
    shape = upper | lower | rect(x0, p.D, x0 + p.V, ym)
    return shape - trap(p, x0 + p.V, ym + th / 2, 1, -1, th * 0.55) - trap(p, x0 + p.V, ym - th / 2, 1, 1, th * 0.55) \
        - trap(p, x0 + p.V, -p.oh + th, 1, -1, th * 0.9)


@glyph('γ', C60)
def gamma(p):
    x0, x1 = p.sb - 14, C60 - p.sb + 14
    vee = _v_strokes(p, x0, x1, p.X, -40, flat=p.V)
    return vee | rect(C60 / 2 - p.V / 2, p.D, C60 / 2 + p.V / 2, -38)


@glyph('δ', C60)
def delta(p):
    """Neck rises from the crown of the bowl (the digit 6 hangs from its side)."""
    x0, x1 = p.sbr, C60 - p.sbr
    body = ring(p, x0, -p.o, x1, p.X + p.o)
    xs = C60 / 2 - p.V / 2 - 30
    neck = elbow(p, xs, p.X - 40, x1 - 10, p.A, 'tl', r=130)
    return body | neck


def _epsilon(p, x0, x1, y0, y1, th):
    ym = round((y0 + y1) / 2 + 10)
    cx = (x0 + x1) / 2
    ru, _ = p.radii(x1 - x0 - 30, y1 - ym + th / 2, p.V, th)
    rl, _ = p.radii(x1 - x0, ym + th / 2 - y0, p.V, th)
    upper = ring(p, x0 + 30, ym - th / 2, x1, y1, th=th) - rect(cx, ym - th - 1, x1 + 50, y1 - ru * p.term)
    lower = ring(p, x0, y0, x1, ym + th / 2, th=th) - rect(cx, y0 + rl * p.term, x1 + 50, ym + th + 1)
    return upper | lower | rect(x0 + 60, ym - th / 2, cx + 60, ym + th / 2)


@glyph('ε', C60)
def epsilon(p):
    return _epsilon(p, p.sbr + 10, C60 - p.sbr - 10, -p.o, p.X + p.o, p.Hc)


def _tail_down(p, x_left, x_right):
    """A short descender hook hanging from a bottom stroke (ζ ξ ς)."""
    return elbow(p, x_left, p.D + 20, x_right, p.Ht, 'tr', th=p.Ht, r=100)


@glyph('ζ', C60)
def zeta(p):
    """Top bar, a diagonal, then one squircle path: corner, foot, hooked tail."""
    x0, x1 = p.sb + 6, C60 - p.sb
    th = p.H
    yv = 230                                  # top of the short upright
    top = rect(x0 + 40, p.A - th, x1, p.A)
    dy = p.A - th - yv
    wh = p.T * math.hypot(x1 - x0 - p.V, dy) / dy
    diag = poly([(x0, yv), (x0 + wh, yv), (x1, p.A - th), (x1 - wh, p.A - th)])
    foot = elbow(p, x0, 0, x1 - 40, yv + 20, 'bl', r=150)
    tail = elbow(p, x1 - 40 - 170, p.D + 20, x1 - 40, th, 'tr', th=th, r=110)
    return top | (diag & band(yv - 5, p.A)) | foot | tail


@glyph('η', C60)
def eta(p):
    x0, x1 = L._n_box(p)
    return base(p, 'n') | rect(x1 - p.V, p.D, x1, 10)


@glyph('θ', C60)
def theta(p):
    x0, x1 = p.sbr + 6, C60 - p.sbr - 6
    return ring(p, x0, -p.o, x1, p.A + p.o) | rect(x0 + p.V / 2, p.A / 2 - p.Hc / 2, x1 - p.V / 2, p.A / 2 + p.Hc / 2)


@glyph('ι', C30)
def iota(p):
    xs = C30 / 2 - p.V / 2 - 30
    return elbow(p, xs, -p.oh, C30 - 44, p.X, 'bl', r=110)


@glyph('λ', C60)
def lamda(p):
    x0, x1 = p.sb - 10, C60 - p.sb + 10
    t = p.T
    long_ = cut_stroke((x0 + 70, p.A - p.H * 0.5), (x1 - t * 0.62, 0), t, 'h', 'h') & band(0, p.A)
    ym = p.X * 0.62
    xm = x0 + 70 + (x1 - x0 - 70) * (1 - ym / p.A)
    short = cut_stroke((xm, ym), (x0 + t * 0.62, 0), t, (1, -(x1 - x0) / p.A), 'h') & band(0, p.A)
    return long_ | short | rect(x0 + 10, p.A - p.H, x0 + 90, p.A)


@glyph('ξ', C60)
def xi(p):
    """ε stretched to the ascender, its top arc flattened into a bar."""
    x0, x1 = p.sbr + 10, C60 - p.sbr - 10
    th = p.Hc
    body = _epsilon(p, x0, x1, 0, p.A, th) - rect(C60 / 2, p.A - 200, x1 + 50, p.A + 50)
    bar = rect(C60 / 2 - 10, p.A - th, x1 + 6, p.A)
    tail = elbow(p, x1 - 180, p.D + 20, x1, th, 'tr', th=th, r=110)
    return body | bar | tail


@glyph('π', C60)
def pi(p):
    x0, x1 = p.sb - 10, C60 - p.sb + 14
    return (rect(x0, p.X - p.H, x1, p.X) | rect(x0 + 56, 0, x0 + 56 + p.V, p.X)
            | elbow(p, x1 - 90 - p.V, -p.oh, x1, p.X, 'bl', r=100))


@glyph('ρ', C60)
def rho(p):
    x0, x1 = p.sb, C60 - p.sbr
    return ring(p, x0, -p.o, x1, p.X + p.o, sq=('bl',)) | rect(x0, p.D, x0 + p.V, p.X / 2)


@glyph('σ', C60)
def sigma(p):
    x0, x1 = p.sbr, C60 - p.sbr + 20
    return ring(p, x0, -p.o, x1 - 70, p.X, sq=('tr',)) | rect(C60 / 2, p.X - p.H, x1, p.X)


@glyph('ς', C60)
def finalsigma(p):
    x0, x1 = p.sbr, C60 - p.sbr + 6
    ro, _ = p.radii(x1 - x0, p.X + 2 * p.o)
    body = ring(p, x0, -p.o + 60, x1, p.X + p.o)
    body = body - rect(C60 / 2, -100, x1 + 50, p.X + p.o - ro * p.term)
    return body | _tail_down(p, C60 / 2 - 40, C60 / 2 + 120)


@glyph('τ', C60)
def tau(p):
    x0, x1 = p.sb - 10, C60 - p.sb + 10
    xs = C60 / 2 - p.V / 2 - 20
    return rect(x0, p.X - p.H, x1, p.X) | elbow(p, xs, -p.oh, xs + p.V + 150, p.X, 'bl', r=110)


@glyph('υ', C60)
def upsilon(p):
    x0, x1 = L._n_box(p)
    return ring(p, x0, -p.o, x1, p.X + 700, sq=('tl', 'tr')) & band(-50, p.X)


@glyph('φ', C60)
def phi(p):
    x0, x1 = p.sbr - 10, C60 - p.sbr + 10
    return ring(p, x0, -p.o, x1, p.X + p.o) | rect(C60 / 2 - p.V / 2, p.D, C60 / 2 + p.V / 2, p.A)


@glyph('χ', C60)
def chi(p):
    x0, x1 = p.sb - 12, C60 - p.sb + 12
    dy = p.X - p.D
    wh = p.T * math.hypot(x1 - x0, dy) / dy * 0.97
    a = poly([(x0, p.D), (x0 + wh, p.D), (x1, p.X), (x1 - wh, p.X)])
    return a | a.mirror(C60 / 2)


@glyph('ψ', C60)
def psi(p):
    x0, x1 = L._n_box(p)
    cup = ring(p, x0, -p.o, x1, p.X + 700, sq=('tl', 'tr')) & band(-50, p.X)
    return cup | rect(C60 / 2 - p.V / 2, p.D, C60 / 2 + p.V / 2, p.A)


@glyph('ω', C90)
def omega(p):
    x0, x1 = p.sb, C90 - p.sb
    cup = ring(p, x0, -p.o, x1, p.X + 700, sq=('tl', 'tr')) & band(-50, p.X)
    return cup | rect(C90 / 2 - p.V / 2, 0, C90 / 2 + p.V / 2, round(p.X * 0.74))


# --- tonos and dialytika --------------------------------------------------------------------

def tonos_cap(p, ch, target):
    """Tonos before a capital: a steep tick in the left margin."""
    t = p.V * 0.86
    mark = slant(20, p.C - 190, 90, p.C + 20, t)
    shape = base(p, ch).move(34, 0)
    return shape | mark


for _t, _b in {'Ά': 'Α', 'Έ': 'Ε', 'Ή': 'Η', 'Ί': 'Ι', 'Ό': 'Ο', 'Ύ': 'Υ', 'Ώ': 'Ω'}.items():
    GLYPHS[_t] = (GLYPHS[_b][0], (lambda b: (lambda p: tonos_cap(p, b, None)))(_b))


def _with_marks(p, ch, marks):
    shape = base(p, ch)
    if ch in ('ι', 'ı'):
        cx = C30 / 2 - 30 + p.V / 2 if ch == 'ι' else C30 / 2
    else:
        b = shape.bounds
        cx = (b[0] + b[2]) / 2
    y = p.X + (72 if not p.bold else 64)
    for m in marks:
        mark = m(p, cx, y)
        shape = shape | mark
        y = mark.bounds[3] + 36
    return shape


def _dialytika_tonos(p, cx, y0, cap=False):
    return LT.m_dieresis(p, cx, y0) | LT.m_acute(p, cx, y0 + 10)


for _t, (_b, _m) in {'ά': ('α', [LT.m_acute]), 'έ': ('ε', [LT.m_acute]), 'ή': ('η', [LT.m_acute]),
                     'ί': ('ι', [LT.m_acute]), 'ό': ('ο', [LT.m_acute]), 'ύ': ('υ', [LT.m_acute]),
                     'ώ': ('ω', [LT.m_acute]), 'ϊ': ('ι', [LT.m_dieresis]), 'ϋ': ('υ', [LT.m_dieresis]),
                     'ΐ': ('ι', [_dialytika_tonos]), 'ΰ': ('υ', [_dialytika_tonos])}.items():
    GLYPHS[_t] = (GLYPHS[_b][0], (lambda b, m: (lambda p: _with_marks(p, b, m)))(_b, _m))


@glyph('Ϊ', C45)
def Iota_dialytika(p):
    return base(p, 'I') | LT.m_dieresis(p, C45 / 2, p.C + 44, cap=True)


@glyph('Ϋ', C60)
def Upsilon_dialytika(p):
    return base(p, 'Y') | LT.m_dieresis(p, C60 / 2, p.C + 44, cap=True)
