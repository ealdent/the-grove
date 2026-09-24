"""Degauss Cyrillic: Russian, Ukrainian, Belarusian, Bulgarian, Serbian and
Macedonian letters.

Capitals are drawn once; most lowercase letters are true small caps of them,
drawn at x-height with full-weight strokes rather than scaled-down capitals.
"""
from __future__ import annotations

import copy

from geometry import union, rect, band, column
import glyphs as L
import latin as LT
from glyphs import GLYPHS, glyph, ring, elbow, bowl, open_right, arch
from params import C30, C45, C60, C90


def base(p, ch):
    return GLYPHS[ch][1](p)


def alias(target, source):
    GLYPHS[target] = (GLYPHS[source][0], (lambda s: (lambda p: base(p, s)))(source))


def small(p):
    """Params whose cap height is the x-height: builders then draw small caps."""
    q = copy.copy(p)
    q.C = p.X
    q.oc = p.o
    return q


for _c, _l in zip('АВЕЅІЈКМНОРСТХ', 'ABESIJKMHOPCTX'):
    alias(_c, _l)
for _c, _l in zip('аеѕіјорсух', 'aesijopcyx'):
    alias(_c, _l)
alias('к', 'ĸ')


# --- capitals -------------------------------------------------------------------------------

def _box(p):
    return L._cap_box(p)


@glyph('Б', C60)
def Be(p):
    x0, x1 = p.sbc, C60 - p.sbcr
    yb = round(p.C * 0.56)
    return (bowl(p, x0, x1, 0, yb + p.H / 2) | rect(x0, 0, x0 + p.V, p.C)
            | rect(x0, p.C - p.H, x1 - 20, p.C))


@glyph('Г', C60)
def Ge(p):
    x0, x1 = p.sbc + 10, C60 - p.sbc + 4
    return rect(x0, 0, x0 + p.V, p.C) | rect(x0, p.C - p.H, x1, p.C)


@glyph('Ґ', C60)
def Gheup(p):
    x1 = C60 - p.sbc + 4
    return Ge(p) | rect(x1 - p.V, p.C - p.H, x1, p.C + (150 if p.C > 600 else 120))


def _de(p, feet=150):
    x0, x1 = p.sbc - 20, C60 - p.sbc + 20
    xl = x0 + 80
    xr = x1 - 30
    return (rect(xr - p.V, 0, xr, p.C) | rect(xl, p.C - p.H, xr, p.C) | rect(xl, p.H, xl + p.V, p.C)
            | rect(x0, 0, x1, p.H) | rect(x0, -feet, x0 + p.V, p.H) | rect(x1 - p.V, -feet, x1, p.H))


@glyph('Д', C60)
def De(p):
    return _de(p)


def _zhe(p, adv=C90):
    cx = adv / 2
    x1 = adv - p.sbc + 20
    right = L._k_limbs(p, cx - p.V / 2, x1, p.C, round(p.C * 0.34), p.C)
    return right | right.mirror(cx)


@glyph('Ж', C90)
def Zhe(p):
    return _zhe(p)


@glyph('З', C60)
def Ze(p):
    return base(p, '3')


@glyph('И', C60)
def I_(p):
    return base(p, 'N').mirror(C60 / 2)


@glyph('Й', C60)
def Ishort(p):
    return I_(p) | LT.m_breve(p, C60 / 2, p.C + 44, cap=True)


def _el(p):
    x0, x1 = _box(p)
    xl = x0 + 50
    leg = elbow(p, x0 - 26, 0, xl + p.V, p.C, 'br', r=90)
    return rect(x1 - p.V, 0, x1, p.C) | rect(xl, p.C - p.H, x1, p.C) | leg


@glyph('Л', C60)
def El(p):
    return _el(p)


@glyph('П', C60)
def Pe(p):
    x0, x1 = _box(p)
    return rect(x0, p.C - p.H, x1, p.C) | rect(x0, 0, x0 + p.V, p.C) | rect(x1 - p.V, 0, x1, p.C)


@glyph('У', C60)
def U_(p):
    """The squircle У: a cup whose right side runs on to a hooked foot."""
    x0, x1 = _box(p)
    yc = round(p.C * 0.34)
    cup = ring(p, x0, yc, x1, p.C + 700, sq=('tl', 'tr', 'br')) & band(yc - 10, p.C)
    foot = elbow(p, x0 + 20, 0, x1, yc + 10, 'br', r=150)
    return cup | foot


@glyph('Ў', C60)
def Ushort(p):
    return U_(p) | LT.m_breve(p, C60 / 2, p.C + 44, cap=True)


@glyph('Ф', C60)
def Ef(p):
    x0, x1 = p.sbcr - 10, C60 - p.sbcr + 10
    return ring(p, x0, 110, x1, p.C - 110, f=0.44) | rect(C60 / 2 - p.V / 2, 0, C60 / 2 + p.V / 2, p.C)


def _tse(p, adv=C60, stems=2, tail='right'):
    x0 = p.sbc
    x1 = adv - p.sbc
    inner = x1 - 60
    xs = [x0 + (inner - x0 - p.V) * k / (stems - 1) for k in range(stems)]
    shape = union(*[rect(x, 0, x + p.V, p.C) for x in xs]) | rect(x0, 0, inner, p.H)
    if tail == 'right':
        shape = shape | rect(inner - 20, 0, x1, p.H) | rect(x1 - p.V, -150, x1, p.H)
    return shape


@glyph('Ц', C60)
def Tse(p):
    return _tse(p)


@glyph('Ч', C60)
def Che(p):
    x0, x1 = _box(p)
    yc = round(p.C * 0.40)
    cup = ring(p, x0, yc, x1, p.C + 700, sq=('tl', 'tr', 'br')) & band(yc - 10, p.C)
    return cup | rect(x1 - p.V, 0, x1, p.C)


def _sha(p, tail=False):
    x0, x1 = p.sbc, C90 - p.sbc
    inner = x1 - 60 if tail else x1
    xs = [x0, (x0 + inner - p.V) / 2, inner - p.V]
    shape = union(*[rect(x, 0, x + p.V, p.C) for x in xs]) | rect(x0, 0, inner, p.H)
    if tail:
        shape = shape | rect(inner - 20, 0, x1, p.H) | rect(x1 - p.V, -150, x1, p.H)
    return shape


@glyph('Ш', C90)
def Sha(p):
    return _sha(p)


@glyph('Щ', C90)
def Shcha(p):
    return _sha(p, tail=True)


def _soft(p, x0, x1, flag=0):
    yb = round(p.C * 0.56)
    shape = bowl(p, x0, x1, 0, yb + p.H / 2) | rect(x0, 0, x0 + p.V, p.C)
    if flag:
        shape = shape | rect(x0 - flag, p.C - p.H, x0 + p.V, p.C)
    return shape


@glyph('Ъ', C60)
def Hard(p):
    return _soft(p, p.sbc + 70, C60 - p.sbcr + 4, flag=100)


@glyph('Ь', C60)
def Soft(p):
    return _soft(p, p.sbc + 10, C60 - p.sbcr)


@glyph('Ы', C90)
def Yeru(p):
    x1 = C90 - p.sbc
    return _soft(p, p.sbc, 560) | rect(x1 - p.V, 0, x1, p.C)


def _e_rev(p):
    x0, y0, x1, y1 = L._O_box(p)
    x0 -= 6
    body = open_right(p, ring(p, x0, y0, x1, y1), x0, y0, x1, y1).mirror(C60 / 2)
    yb = L._bar(p)
    return body | rect(x0 + 130, yb, x1 - p.V / 2, yb + p.H)


@glyph('Э', C60)
def Ereversed(p):
    return _e_rev(p)


@glyph('Є', C60)
def Ye(p):
    return _e_rev(p).mirror(C60 / 2)


@glyph('Ю', C90)
def Yu(p):
    x0 = p.sbc
    ox0, ox1 = 330, C90 - p.sbcr
    yb = L._bar(p)
    return (rect(x0, 0, x0 + p.V, p.C) | rect(x0, yb, ox0 + p.V / 2, yb + p.H)
            | ring(p, ox0, -p.oc, ox1, p.C + p.oc))


@glyph('Я', C60)
def Ya(p):
    return base(p, 'R').mirror(C60 / 2)


@glyph('Ё', C60)
def Yo(p):
    return base(p, 'Ë')


@glyph('Ї', C45)
def Yi(p):
    return base(p, 'Ï')


@glyph('Ѓ', C60)
def Gje(p):
    return Ge(p) | LT.m_acute(p, C60 / 2, p.C + 44, cap=True)


@glyph('Ќ', C60)
def Kje(p):
    return base(p, 'K') | LT.m_acute(p, C60 / 2, p.C + 44, cap=True)


def _dje_arch(p, x_stem, x1, top, hook=True):
    """The shoulder of Ђ and Ћ: an arch leaving the stem below the bar."""
    shoulder = arch(p, x_stem, x1, top, traps=True)
    if hook:
        shoulder = shoulder & band(round(top * 0.28), top + 20)
        shoulder = shoulder | elbow(p, x1 - 170, -p.oh, x1, round(top * 0.28) + 2, 'br', r=110)
    return shoulder


@glyph('Ђ', C60)
def Dje(p):
    x0, x1 = p.sbc - 30, C60 - p.sbc
    xs = x0 + 110
    return rect(x0, p.C - p.H, x1 - 90, p.C) | rect(xs, 0, xs + p.V, p.C) | _dje_arch(p, xs, x1, round(p.C * 0.60))


@glyph('Ћ', C60)
def Tshe(p):
    x0, x1 = p.sbc - 30, C60 - p.sbc
    xs = x0 + 110
    return rect(x0, p.C - p.H, x1 - 90, p.C) | rect(xs, 0, xs + p.V, p.C) | _dje_arch(p, xs, x1, round(p.C * 0.60), hook=False)


@glyph('Љ', C90)
def Lje(p):
    el = _el(p) & column(-100, C60 - p.sbc - p.V + 1)
    xm = C60 - p.sbc - p.V
    yb = round(p.C * 0.56)
    return el | bowl(p, xm, C90 - p.sbcr, 0, yb + p.H / 2) | rect(xm, 0, xm + p.V, p.C)


@glyph('Њ', C90)
def Nje(p):
    x0 = p.sbc
    xm = 470
    yb = L._bar(p)
    yb2 = round(p.C * 0.56)
    return (rect(x0, 0, x0 + p.V, p.C) | rect(x0, yb, xm, yb + p.H) | rect(xm, 0, xm + p.V, p.C)
            | bowl(p, xm, C90 - p.sbcr, 0, yb2 + p.H / 2))


@glyph('Џ', C60)
def Dzhe(p):
    x0, x1 = _box(p)
    return (rect(x0, 0, x0 + p.V, p.C) | rect(x1 - p.V, 0, x1, p.C) | rect(x0, 0, x1, p.H)
            | rect(C60 / 2 - p.V / 2, -150, C60 / 2 + p.V / 2, p.H))


# --- lowercase ------------------------------------------------------------------------------
# Small caps drawn at x-height, except where Cyrillic lowercase has its own form.

SMALL = {'в': 'В', 'г': 'Г', 'ґ': 'Ґ', 'д': 'Д', 'ж': 'Ж', 'з': 'З', 'и': 'И', 'л': 'Л', 'м': 'М', 'н': 'Н',
         'п': 'П', 'т': 'Т', 'ц': 'Ц', 'ч': 'Ч', 'ш': 'Ш', 'щ': 'Щ', 'ъ': 'Ъ', 'ы': 'Ы', 'ь': 'Ь', 'э': 'Э',
         'є': 'Є', 'ю': 'Ю', 'я': 'Я', 'ѓ': 'Ѓ', 'ќ': 'Ќ', 'љ': 'Љ', 'њ': 'Њ', 'џ': 'Џ'}

for _lc, _uc in SMALL.items():
    GLYPHS[_lc] = (GLYPHS[_uc][0], (lambda u: (lambda p: base(small(p), u)))(_uc))


@glyph('б', C60)
def be(p):
    x0, x1 = p.sbr, C60 - p.sbr
    body = ring(p, x0, -p.o, x1, p.X + p.o)
    neck = elbow(p, x0, p.X - 60, x1 - 10, p.A, 'tl', r=150)
    return body | neck


@glyph('й', C60)
def ishort(p):
    return base(small(p), 'И') | LT.m_breve(p, C60 / 2, p.X + 72)


@glyph('ф', C60)
def ef(p):
    x0, x1 = p.sbr - 12, C60 - p.sbr + 12
    return ring(p, x0, -p.o, x1, p.X + p.o) | rect(C60 / 2 - p.V / 2, p.D, C60 / 2 + p.V / 2, p.A)


@glyph('ў', C60)
def ushort(p):
    return base(p, 'y') | LT.m_breve(p, C60 / 2, p.X + 72)


@glyph('ё', C60)
def yo(p):
    return base(p, 'ë')


@glyph('ї', C30)
def yi(p):
    return base(p, 'ï')


@glyph('ђ', C60)
def dje(p):
    x0, x1 = L._n_box(p)
    shape = arch(p, x0, x1, p.X + p.oh) | rect(x0, 0, x0 + p.V, p.A)
    shape = shape | rect(x0 - 50, 600, x0 + p.V + 118, 600 + p.H * 0.92)
    return shape | elbow(p, x1 - 250, p.D, x1, 12, 'br', th=p.Ht, r=150)


@glyph('ћ', C60)
def tshe(p):
    return base(p, 'ħ')
