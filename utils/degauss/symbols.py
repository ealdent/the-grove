"""Degauss punctuation, operators and symbols.

Same drawing language as the letters: squircle bowls, flat cuts, bloom
traps at stem joints, round phosphor dots. Operators share one horizontal
extent and sit on the math axis so arithmetic lines up in code.
"""
from __future__ import annotations

import math

from geometry import union, rect, rrect, circle, beam, poly, band, column, cut_stroke
from glyphs import glyph, ring, elbow, dot, s_shape, _v_strokes
from params import C30, C45, C60, C90


def opx(p):
    return p.op_l, C60 - p.op_l


# --- dots and marks ------------------------------------------------------------------

def comma_shape(p, cx, y_bottom):
    d = p.dot
    r = d / 2
    cy = y_bottom + r
    head = circle(cx, cy, r)
    tail = cut_stroke((cx + r * 0.22, cy - r * 0.1), (cx - r * 0.78, y_bottom - d * 1.25), d * 0.58, 'h', 'h')
    return head | tail


@glyph('.', C30)
def period(p):
    return dot(p, C30 / 2, 0)


@glyph(',', C30)
def comma(p):
    return comma_shape(p, C30 / 2 + 8, 0)


@glyph(':', C30)
def colon(p):
    return dot(p, C30 / 2, 0) | dot(p, C30 / 2, p.X - p.dot)


@glyph(';', C30)
def semicolon(p):
    return comma_shape(p, C30 / 2 + 8, 0) | dot(p, C30 / 2 + 8, p.X - p.dot)


def excl_shape(p, cx):
    gap = round(p.V * 0.86)
    return rect(cx - p.V / 2, p.dot + gap, cx + p.V / 2, p.C) | dot(p, cx, 0)


@glyph('!', C30)
def exclam(p):
    return excl_shape(p, C30 / 2)


def question_shape(p, cx=C60 / 2):
    x0, x1 = cx - 300 + p.sbcr + 22, cx + 300 - p.sbcr - 22
    th = p.H
    ym = round(p.C * 0.40)
    y1 = p.C + p.oh
    ro, _ = p.radii(x1 - x0, y1 - (ym - th / 2))
    hook = ring(p, x0, ym - th / 2, x1, y1) - rect(x0 - 50, ym - th - 1, cx - p.V / 2, y1 - ro * p.term)
    gap = round(p.V * 0.86)
    stem = rect(cx - p.V / 2, p.dot + gap, cx + p.V / 2, ym + th / 2)
    return hook | stem | dot(p, cx, 0)


@glyph('?', C60)
def question(p):
    return question_shape(p)


def tick(p, cx, top=None, h=250, w=None):
    top = p.C + 30 if top is None else top
    w = p.V * 0.92 if w is None else w
    return rect(cx - w / 2, top - h, cx + w / 2, top)


@glyph("'", C30)
def quotesingle(p):
    return tick(p, C30 / 2)


@glyph('"', C45)
def quotedbl(p):
    half = (p.V * 0.92 + 88) / 2
    return tick(p, C45 / 2 - half) | tick(p, C45 / 2 + half)


@glyph('`', C30)
def grave(p):
    return cut_stroke((104, p.C + 44), (196, p.C - 150), p.V * 0.9, 'h', 'h')


# --- operators -----------------------------------------------------------------------

@glyph('-', C60)
def hyphen(p):
    x0, x1 = opx(p)
    return rect(x0, p.M - p.H / 2, x1, p.M + p.H / 2)


@glyph('+', C60)
def plus(p):
    x0, x1 = opx(p)
    hw = (x1 - x0) / 2
    return rect(x0, p.M - p.H / 2, x1, p.M + p.H / 2) | rect(C60 / 2 - p.V / 2, p.M - hw, C60 / 2 + p.V / 2, p.M + hw)


def equal_bars(p, x0, x1):
    g = p.eq_gap
    return rect(x0, p.M + g / 2, x1, p.M + g / 2 + p.H) | rect(x0, p.M - g / 2 - p.H, x1, p.M - g / 2)


@glyph('=', C60)
def equal(p):
    return equal_bars(p, *opx(p))


def chevron(p, x_tip, x_tail, cy, hh, t=None):
    """Two arms meeting in a flat, vertically cut nose at x_tip."""
    t = p.T if t is None else t
    upper = cut_stroke((x_tail, cy + hh), (x_tip, cy), t, 'v', 'v')
    lower = cut_stroke((x_tail, cy - hh), (x_tip, cy), t, 'v', 'v')
    return upper | lower


@glyph('<', C60)
def less(p):
    x0, x1 = opx(p)
    return chevron(p, x0 + 6, x1 - 6, p.M, (x1 - x0) / 2 * 0.98)


@glyph('>', C60)
def greater(p):
    return less(p).mirror(C60 / 2)


@glyph('^', C60)
def caret(p):
    h = 300
    v = _v_strokes(p, 104, C60 - 104, h, 0, flat=p.V * 0.72, t=p.T * 0.96)
    return v.flip(h / 2).move(0, p.C - h)


def tilde_shape(p, x0, x1, cy, amp=None):
    amp = (92 if not p.bold else 84) if amp is None else amp
    th = p.H
    cx = (x0 + x1) / 2
    s = 8
    hump = ring(p, x0, cy - 400, cx + p.V / 2, cy + amp + th / 2) & band(cy - s, 2000)
    dip = ring(p, cx - p.V / 2, cy - amp - th / 2, x1, cy + 400) & band(-2000, cy + s)
    return hump | dip


@glyph('~', C60)
def asciitilde(p):
    return tilde_shape(p, *opx(p), p.M)


@glyph('_', C60)
def underscore(p):
    return rect(0, -150, C60, -150 + p.H)


@glyph('|', C30)
def bar(p):
    return rect(C30 / 2 - p.V / 2, -180, C30 / 2 + p.V / 2, 790)


def slash_shape(p, x0, x1, yb=-110, yt=770):
    wh = p.T * math.hypot(x1 - x0, yt - yb) / (yt - yb)
    return poly([(x0, yb), (x0 + wh, yb), (x1, yt), (x1 - wh, yt)])


@glyph('/', C45)
def slash(p):
    return slash_shape(p, 44, C45 - 44)


@glyph('\\', C45)
def backslash(p):
    return slash(p).mirror(C45 / 2)


# --- brackets --------------------------------------------------------------------------

BR_BOTTOM, BR_TOP = -150, 790


def paren_shape(p, xl, xr, yb=BR_BOTTOM, yt=BR_TOP, r=None):
    r = (210 if not p.bold else 220) if r is None else r
    ri = (max(r - p.V * p.ci, p.rmin), max(r - p.H * p.ci, p.rmin))
    outer = rrect(xl, yb, xr + 400, yt, (r, 0, 0, r), p.k)
    inner = rrect(xl + p.V, yb + p.H, xr + 500, yt - p.H, (ri, 0, 0, ri), p.k)
    return (outer - inner) & column(-100, xr)


@glyph('(', C45)
def parenleft(p):
    return paren_shape(p, 128 if not p.bold else 110, 350 if not p.bold else 362)


@glyph(')', C45)
def parenright(p):
    return parenleft(p).mirror(C45 / 2)


def bracket_shape(p, xl, xr, yb=BR_BOTTOM, yt=BR_TOP):
    return rect(xl, yb, xl + p.V, yt) | rect(xl, yt - p.H, xr, yt) | rect(xl, yb, xr, yb + p.H)


@glyph('[', C45)
def bracketleft(p):
    return bracket_shape(p, 138 if not p.bold else 116, 350 if not p.bold else 360)


@glyph(']', C45)
def bracketright(p):
    return bracketleft(p).mirror(C45 / 2)


def brace_shape(p, xl, xm, xr, yb=BR_BOTTOM, yt=BR_TOP):
    ym = (yb + yt) / 2
    h = p.H
    reach = 150
    top = elbow(p, xm, ym, xr, yt, 'tl', r=150)
    bot = elbow(p, xm, yb, xr, ym, 'bl', r=150)
    nub_up = elbow(p, xl, ym - h / 2, xm + p.V, ym + reach, 'br', r=110)
    nub_dn = elbow(p, xl, ym - reach, xm + p.V, ym + h / 2, 'tr', r=110)
    return top | bot | nub_up | nub_dn


@glyph('{', C45)
def braceleft(p):
    if p.bold:
        return brace_shape(p, 56, 150, 380)
    return brace_shape(p, 70, 172, 372)


@glyph('}', C45)
def braceright(p):
    return braceleft(p).mirror(C45 / 2)


# --- symbols -----------------------------------------------------------------------------

@glyph('#', C60)
def numbersign(p):
    tv, th = p.V * 0.92, p.H * 0.92
    y0, y1 = 10, 690
    xa, xb = 204, 396
    ya, yb = round(p.C * 0.33), round(p.C * 0.67)
    x0, x1 = 62, C60 - 62
    return (rect(xa - tv / 2, y0, xa + tv / 2, y1) | rect(xb - tv / 2, y0, xb + tv / 2, y1)
            | rect(x0, ya - th / 2, x1, ya + th / 2) | rect(x0, yb - th / 2, x1, yb + th / 2))


@glyph('$', C60)
def dollar(p):
    x0, x1 = p.sbcr + 10, C60 - p.sbcr - 10
    y0, y1 = 36, 664
    body = s_shape(p, x0, y0, x1, y1, p.H * 0.96, lift=6)
    w = p.V * 0.9
    return body | rect(C60 / 2 - w / 2, y1 - 20, C60 / 2 + w / 2, 790) | rect(C60 / 2 - w / 2, -90, C60 / 2 + w / 2, y0 + 20)


@glyph('%', C60)
def percent(p):
    tv, th = p.V * 0.86, p.H * 0.86
    a = ring(p, 50, 404, 256, p.C, tv=tv, th=th, f=0.36)
    b = ring(p, C60 - 256, 0, C60 - 50, p.C - 404, tv=tv, th=th, f=0.36)
    return a | b | slash_shape(p, 70, C60 - 70, 0, p.C)


@glyph('*', C60)
def asterisk(p):
    cx, cy = C60 / 2, round(p.C * 0.60)
    half = 170 if not p.bold else 184
    t = p.V * 0.9 if not p.bold else p.V * 0.66
    arms = [beam(cx - half * math.sin(a), cy - half * math.cos(a), cx + half * math.sin(a),
                 cy + half * math.cos(a), t) for a in (0, math.pi / 3, 2 * math.pi / 3)]
    return union(*arms)


@glyph('&', C60)
def ampersand(p):
    """Small loop over an open bowl; a straight tail crosses the bowl's arm."""
    th = p.Hc
    x0, x1 = p.sbcr - 6, C60 - p.sbcr + 12
    xl = x0 + 306 if not p.bold else x0 + 318           # right edge of the loop
    yw = round(p.C * 0.56)                               # waist: loop bottom
    loop = ring(p, x0 + 34, yw - th / 2, xl, p.C + p.oh, th=th, f=0.38)
    bx1 = x0 + 430
    ya = round(p.C * 0.40)                               # arm height (top edge)
    body = ring(p, x0, -p.oh, bx1, yw + th / 2, th=th)
    body = body - rect(xl - p.V, ya, bx1 + 50, yw + th + 10)
    arm = rect(bx1 - p.V, ya - th, x1 - 20, ya)
    t = p.T
    c0 = (xl - p.V * 0.62, yw)
    c1x = x1 - t * 0.62
    tail = cut_stroke(c0, (c1x, 0), t, 'h', 'h') & band(0, yw)
    return loop | body | arm | tail


@glyph('@', C90)
def at(p):
    ox0, ox1, oy0, oy1 = 64, C90 - 64, -150, p.C + p.oh
    ix0, ix1, iy0, iy1 = 262, 600, 118, 486
    inner = ring(p, ix0, iy0, ix1, iy1, sq=('br', 'tr'))
    outer = ring(p, ox0, oy0, ox1, oy1) - rect(ix1 - p.V - 30, oy0 - 50, ox1 + 50, iy0)
    link = elbow(p, ix1 - p.V, iy0, ox1, iy0 + 260, 'br', r=150)
    return inner | outer | link
