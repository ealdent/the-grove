"""Degauss arrows and mathematical symbols.

Arrowheads are chevrons with a nose cut square to the shaft. Operators sit on
the math axis and share the C60 operator extent, so a = b + c <= d lines up.
"""
from __future__ import annotations

import math

from geometry import union, rect, rrect, circle, beam, poly, band, column, cut_stroke
import glyphs as L
import symbols as S
from glyphs import GLYPHS, glyph, ring, elbow, _v_strokes
from params import C30, C45, C60, C90


def base(p, ch):
    return GLYPHS[ch][1](p)


# --- arrows ----------------------------------------------------------------------------

HEAD = 196       # head length along the shaft
SPREAD = 196     # half the head's width


def arrow(p, tail, tip, head=HEAD, spread=SPREAD, shaft=True, double=False, back=False, t_arm=None,
          t_shaft=None):
    """Arrow from tail to tip; back=True puts a second head on the tail."""
    (x0, y0), (x1, y1) = tail, tip
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy)
    ux, uy = dx / length, dy / length
    nx, ny = -uy, ux
    arm_t = p.T if t_arm is None else t_arm
    shaft_t = (p.H * abs(ux) + p.V * abs(uy)) if t_shaft is None else t_shaft

    def head_at(tx, ty, sx, sy):
        # (sx, sy) points back along the shaft from the tip.
        wing = [(tx + sx * head + nx * spread * k, ty + sy * head + ny * spread * k) for k in (1, -1)]
        return union(*[cut_stroke(w, (tx, ty), arm_t, (nx, ny), (nx, ny)) for w in wing])

    shape = head_at(x1, y1, -ux, -uy)
    start, end = (x0, y0), (x1 - ux * arm_t * 0.5, y1 - uy * arm_t * 0.5)
    if back:
        shape = shape | head_at(x0, y0, ux, uy)
        start = (x0 + ux * arm_t * 0.5, y0 + uy * arm_t * 0.5)
    if shaft and not double:
        shape = shape | beam(start[0], start[1], end[0], end[1], shaft_t)
    if double:
        g = p.eq_gap
        o = g / 2 + shaft_t / 2
        # Each rail stops on the arm's centreline, hidden inside the head.
        stop = head * o / spread
        for k in (1, -1):
            sx0, sy0 = x0 + nx * o * k, y0 + ny * o * k
            if back:
                sx0, sy0 = sx0 + ux * stop, sy0 + uy * stop
            shape = shape | beam(sx0, sy0, x1 - ux * stop + nx * o * k, y1 - uy * stop + ny * o * k, shaft_t)
    return shape


def _h(p, adv=C60):
    return 64, adv - 64


def _v(p):
    return -20, p.C + 20


@glyph('→', C60)
def arrowright(p):
    a, b = _h(p)
    return arrow(p, (a, p.M), (b, p.M))


@glyph('←', C60)
def arrowleft(p):
    return arrowright(p).mirror(C60 / 2)


@glyph('↑', C60)
def arrowup(p):
    a, b = _v(p)
    return arrow(p, (C60 / 2, a), (C60 / 2, b))


@glyph('↓', C60)
def arrowdown(p):
    return arrowup(p).flip(p.C / 2)


@glyph('↔', C60)
def arrowboth(p):
    a, b = _h(p)
    return arrow(p, (a, p.M), (b, p.M), back=True, head=170)


@glyph('↕', C60)
def arrowupdn(p):
    a, b = _v(p)
    return arrow(p, (C60 / 2, a), (C60 / 2, b), back=True, head=170)


@glyph('↗', C60)
def arrowne(p):
    # Exactly 45 degrees, so the head's wings run true horizontal and vertical.
    c = p.C / 2
    return arrow(p, (100, c - 200), (C60 - 100, c + 200), head=150, spread=150)


@glyph('↖', C60)
def arrownw(p):
    return arrowne(p).mirror(C60 / 2)


@glyph('↘', C60)
def arrowse(p):
    return arrowne(p).flip(p.C / 2)


@glyph('↙', C60)
def arrowsw(p):
    return arrowse(p).mirror(C60 / 2)


@glyph('⇒', C60)
def dblarrowright(p):
    a, b = _h(p)
    return arrow(p, (a, p.M), (b, p.M), double=True, head=220, spread=250)


@glyph('⇐', C60)
def dblarrowleft(p):
    return dblarrowright(p).mirror(C60 / 2)


@glyph('⇔', C60)
def dblarrowboth(p):
    a, b = _h(p)
    return arrow(p, (a, p.M), (b, p.M), double=True, back=True, head=180, spread=240)


@glyph('⇑', C60)
def dblarrowup(p):
    a, b = _v(p)
    return arrow(p, (C60 / 2, a), (C60 / 2, b), double=True, head=220, spread=250)


@glyph('⇓', C60)
def dblarrowdown(p):
    return dblarrowup(p).flip(p.C / 2)


@glyph('⇕', C60)
def dblarrowupdn(p):
    a, b = _v(p)
    return arrow(p, (C60 / 2, a), (C60 / 2, b), double=True, back=True, head=180, spread=240)


@glyph('⟶', C90)
def longarrowright(p):
    a, b = _h(p, C90)
    return arrow(p, (a, p.M), (b, p.M))


@glyph('⟵', C90)
def longarrowleft(p):
    return longarrowright(p).mirror(C90 / 2)


@glyph('⟷', C90)
def longarrowboth(p):
    a, b = _h(p, C90)
    return arrow(p, (a, p.M), (b, p.M), back=True)


@glyph('⟹', C90)
def longdblarrowright(p):
    a, b = _h(p, C90)
    return arrow(p, (a, p.M), (b, p.M), double=True, head=230, spread=250)


@glyph('⟸', C90)
def longdblarrowleft(p):
    return longdblarrowright(p).mirror(C90 / 2)


@glyph('⟺', C90)
def longdblarrowboth(p):
    a, b = _h(p, C90)
    return arrow(p, (a, p.M), (b, p.M), double=True, back=True, head=200, spread=250)


def bar_v(p, x, h=230, cy=None):
    cy = p.M if cy is None else cy
    return rect(x - p.V / 2, cy - h, x + p.V / 2, cy + h)


@glyph('↦', C60)
def mapsto(p):
    a, b = _h(p)
    return arrow(p, (a + 20, p.M), (b, p.M)) | bar_v(p, a + p.V / 2 - 6, 170)


@glyph('↤', C60)
def mapsfrom(p):
    return mapsto(p).mirror(C60 / 2)


@glyph('⇥', C60)
def tabright(p):
    a, b = _h(p)
    return arrow(p, (a, p.M), (b - p.V - 26, p.M)) | bar_v(p, b - p.V / 2, 220)


@glyph('⇤', C60)
def tableft(p):
    return tabright(p).mirror(C60 / 2)


def _hook_arrow(p):
    """↪: a squircle hook at the tail curls up and back over the shaft."""
    y = p.M - 70
    th = p.H
    top = y + 250
    hook = ring(p, 64, y - th / 2, 330, top, f=0.46) & column(0, 230)
    return hook | arrow(p, (200, y), (C60 - 64, y), head=170, spread=170)


@glyph('↪', C60)
def hookright(p):
    return _hook_arrow(p)


@glyph('↩', C60)
def hookleft(p):
    return _hook_arrow(p).mirror(C60 / 2)


def _return_arrow(p):
    """↵: a stem from the cap line turns (squircle corner) into a left arrow."""
    x_r = C60 - 90
    y = p.M - 20
    stem = elbow(p, 200, y - p.H / 2, x_r, p.C, 'br', r=150)
    return stem | arrow(p, (240, y), (70, y), head=170, spread=180)


@glyph('↵⏎', C60)
def carriagereturn(p):
    return _return_arrow(p)


@glyph('↳', C60)
def downright(p):
    x_l = 100
    y = p.M - 40
    stem = elbow(p, x_l, y - p.H / 2, 360, p.C, 'bl', r=150)
    return stem | arrow(p, (300, y), (C60 - 64, y), head=170, spread=180)


@glyph('↲', C60)
def downleft(p):
    return downright(p).mirror(C60 / 2)


@glyph('↱', C60)
def upright(p):
    return downright(p).flip(p.M + (p.C - p.M) / 2 - 90)


@glyph('↰', C60)
def upleft(p):
    return upright(p).mirror(C60 / 2)


@glyph('⇄', C60)
def arrowsrl(p):
    a, b = _h(p)
    top = arrow(p, (a, p.M + 150), (b, p.M + 150), head=150, spread=140)
    bot = arrow(p, (b, p.M - 150), (a, p.M - 150), head=150, spread=140)
    return top | bot


@glyph('⇆', C60)
def arrowslr(p):
    return arrowsrl(p).mirror(C60 / 2)


# --- operators and relations ---------------------------------------------------------------

def _slash_over(p, shape, cy=None, h=260):
    cy = p.M if cy is None else cy
    return shape | beam(C60 / 2 - 130, cy - h, C60 / 2 + 130, cy + h, p.V * 0.9)


@glyph('≠', C60)
def notequal(p):
    return _slash_over(p, S.equal(p))


def triple_bars(p, x0, x1):
    g = p.eq_gap * 0.62
    return union(*[rect(x0, p.M + k * (g + p.H) - p.H / 2, x1, p.M + k * (g + p.H) + p.H / 2) for k in (-1, 0, 1)])


@glyph('≡', C60)
def equivalence(p):
    return triple_bars(p, *S.opx(p))


@glyph('≢', C60)
def notequivalence(p):
    return _slash_over(p, equivalence(p), h=290)


def _stack(p, amp):
    """Centre offset that keeps stacked tildes and bars an even gap apart."""
    return amp + p.H / 2 + (46 if not p.bold else 34) / 2


@glyph('≈', C60)
def approxequal(p):
    x0, x1 = S.opx(p)
    amp = 40 if not p.bold else 34
    o = _stack(p, amp)
    return S.tilde_shape(p, x0, x1, p.M + o, amp) | S.tilde_shape(p, x0, x1, p.M - o, amp)


@glyph('≃', C60)
def asymptequal(p):
    x0, x1 = S.opx(p)
    amp = 44 if not p.bold else 36
    gap = 60 if not p.bold else 44
    top = p.M + gap / 2 + amp + p.H / 2
    bar = p.M - gap / 2 - p.H / 2
    return S.tilde_shape(p, x0, x1, top, amp) | rect(x0, bar - p.H / 2, x1, bar + p.H / 2)


@glyph('≅', C60)
def congruent(p):
    x0, x1 = S.opx(p)
    amp = 40 if not p.bold else 32
    gap = 46 if not p.bold else 34
    total = 2 * amp + 3 * p.H + 2 * gap
    y = p.M - total / 2
    bars = rect(x0, y, x1, y + p.H) | rect(x0, y + p.H + gap, x1, y + 2 * p.H + gap)
    return S.tilde_shape(p, x0, x1, y + 2 * p.H + 2 * gap + amp + p.H / 2, amp) | bars


@glyph('∼', C60)
def similar(p):
    return S.asciitilde(p)


def le_shape(p):
    x0, x1 = S.opx(p)
    hh = 170
    chev = S.chevron(p, x0 + 6, x1 - 6, p.M + 70, hh)
    return chev | rect(x0, p.M - 190 - p.H / 2, x1, p.M - 190 + p.H / 2)


@glyph('≤', C60)
def lessequal(p):
    return le_shape(p)


@glyph('≥', C60)
def greaterequal(p):
    return le_shape(p).mirror(C60 / 2)


@glyph('≪', C60)
def muchless(p):
    x0, x1 = S.opx(p)
    t = p.T * 0.92
    return S.chevron(p, x0, x0 + 230, p.M, 170, t) | S.chevron(p, x1 - 230, x1, p.M, 170, t)


@glyph('≫', C60)
def muchgreater(p):
    return muchless(p).mirror(C60 / 2)


@glyph('∗', C60)
def asteriskmath(p):
    return S.asterisk(p).move(0, p.M - round(p.C * 0.60))


@glyph('∘', C60)
def ringoperator(p):
    r = 104 if not p.bold else 112
    return ring(p, C60 / 2 - r, p.M - r, C60 / 2 + r, p.M + r, tv=p.Vi, th=p.Vi * 0.92, f=0.46)


@glyph('⋅', C30)
def dotmath(p):
    return circle(C30 / 2, p.M, p.dot * 0.46)


@glyph('√', C60)
def radical(p):
    t = p.T
    top = p.C + 40
    left = cut_stroke((60, p.M + 10), (170, -10), t * 0.9, 'h', 'h')
    long_ = cut_stroke((170, 0), (400, top - p.H / 2), t, 'h', 'h')
    return left | long_ | rect(400 - t * 0.4, top - p.H, C60 - 20, top) | rect(40, p.M - 20, 110, p.M - 20 + p.H)


def _reel_strokes(p):
    return (p.V, p.H) if not p.bold else (p.V * 0.84, p.H * 0.8)


@glyph('∞', C60)
def infinity(p):
    """Two tape reels side by side, sharing one stroke."""
    tv, th = _reel_strokes(p)
    h = 128 if not p.bold else 144
    a = ring(p, 34, p.M - h, C60 / 2 + tv / 2, p.M + h, tv=tv, th=th, f=0.46)
    b = ring(p, C60 / 2 - tv / 2, p.M - h, C60 - 34, p.M + h, tv=tv, th=th, f=0.46)
    return a | b


@glyph('∝', C60)
def proportional(p):
    tv, th = _reel_strokes(p)
    h = 128 if not p.bold else 144
    a = ring(p, 50, p.M - h, C60 / 2 + tv / 2, p.M + h, tv=tv, th=th, f=0.46)
    arms = ring(p, C60 / 2 - tv / 2, p.M - h, C60 + 400, p.M + h, tv=tv, th=th, f=0.46) & column(C60 / 2, C60 - 50)
    return a | arms


def _setlike(p, x0, x1, y0, y1, bar=False):
    """Squircle ⊂ (open right), optionally with ∈'s middle bar."""
    r = min(200, (y1 - y0) * 0.42)
    ri = (max(r - p.V * p.ci, p.rmin), max(r - p.H * p.ci, p.rmin))
    shape = (rrect(x0, y0, x1 + 400, y1, (r, 0, 0, r), p.k)
             - rrect(x0 + p.V, y0 + p.H, x1 + 500, y1 - p.H, (ri, 0, 0, ri), p.k)) & column(-100, x1)
    if bar:
        shape = shape | rect(x0, (y0 + y1) / 2 - p.H / 2, x1 - 30, (y0 + y1) / 2 + p.H / 2)
    return shape


@glyph('∈', C60)
def element(p):
    return _setlike(p, 100, C60 - 90, 40, 560, bar=True)


@glyph('∉', C60)
def notelement(p):
    return element(p) | beam(190, -40, 420, 640, p.V * 0.9)


@glyph('∋', C60)
def contains(p):
    return element(p).mirror(C60 / 2)


@glyph('⊂', C60)
def subset(p):
    return _setlike(p, 100, C60 - 90, 40, 560)


@glyph('⊃', C60)
def superset(p):
    return subset(p).mirror(C60 / 2)


@glyph('⊆', C60)
def subsetequal(p):
    return _setlike(p, 100, C60 - 90, 160, 620) | rect(100, 0, C60 - 90, p.H)


@glyph('⊇', C60)
def supersetequal(p):
    return subsetequal(p).mirror(C60 / 2)


@glyph('∩', C60)
def intersection(p):
    x0, x1 = L._n_box(p)
    return ring(p, x0, -600, x1, p.X + 40, sq=('bl', 'br')) & band(0, p.X + 60)


@glyph('∪', C60)
def union_(p):
    return intersection(p).rotate180(C60 / 2, (p.X + 40) / 2)


@glyph('∧', C60)
def logicaland(p):
    return _v_strokes(p, 90, C60 - 90, p.X, 0, flat=p.V * 0.7).flip(p.X / 2)


@glyph('∨', C60)
def logicalor(p):
    return _v_strokes(p, 90, C60 - 90, p.X, 0, flat=p.V * 0.7)


def _circled(p, inner):
    r = 250
    cy = p.M
    return ring(p, C60 / 2 - r, cy - r, C60 / 2 + r, cy + r, tv=p.Vi, th=p.Vi * 0.92, f=0.46) | inner


@glyph('⊕', C60)
def circleplus(p):
    h = 150
    w = p.Vi * 0.5
    return _circled(p, rect(C60 / 2 - h, p.M - w * 0.92, C60 / 2 + h, p.M + w * 0.92)
                    | rect(C60 / 2 - w, p.M - h, C60 / 2 + w, p.M + h))


@glyph('⊖', C60)
def circleminus(p):
    h = 150
    return _circled(p, rect(C60 / 2 - h, p.M - p.Vi * 0.46, C60 / 2 + h, p.M + p.Vi * 0.46))


@glyph('⊗', C60)
def circletimes(p):
    h = 112
    t = p.Vi
    cx = C60 / 2
    return _circled(p, beam(cx - h, p.M - h, cx + h, p.M + h, t) | beam(cx - h, p.M + h, cx + h, p.M - h, t))


@glyph('⊙', C60)
def circledot(p):
    return _circled(p, circle(C60 / 2, p.M, p.dot * 0.5))


def _tack(p):
    """⊢: a stem with a bar reaching right."""
    x0 = 100
    return rect(x0, 40, x0 + p.V, 600) | rect(x0, 320 - p.H / 2, C60 - 90, 320 + p.H / 2)


@glyph('⊢', C60)
def righttack(p):
    return _tack(p)


@glyph('⊣', C60)
def lefttack(p):
    return _tack(p).mirror(C60 / 2)


@glyph('⊤', C60)
def downtack(p):
    return rect(C60 / 2 - p.V / 2, 0, C60 / 2 + p.V / 2, p.C) | rect(90, p.C - p.H, C60 - 90, p.C)


@glyph('⊥', C60)
def uptack(p):
    return rect(C60 / 2 - p.V / 2, 0, C60 / 2 + p.V / 2, p.C) | rect(90, 0, C60 - 90, p.H)


@glyph('⊨', C60)
def models(p):
    x0 = 100
    return rect(x0, 40, x0 + p.V, 600) | rect(x0, 390, C60 - 90, 390 + p.H) | rect(x0, 250 - p.H, C60 - 90, 250)


@glyph('∀', C60)
def forall(p):
    return L._A_diagonal(p).flip(p.C / 2)


@glyph('∃', C60)
def exists(p):
    return base(p, 'E').mirror(C60 / 2)


@glyph('∄', C60)
def notexists(p):
    return exists(p) | beam(170, -60, 430, p.C + 60, p.V * 0.9)


@glyph('∂', C60)
def partialdiff(p):
    x0, x1 = p.sbr, C60 - p.sbr
    return ring(p, x0, -p.o, x1, p.X + p.o) | elbow(p, C60 / 2 - 60, p.X - 60, x1, p.C, 'tr', r=170)


@glyph('∅', C60)
def emptyset(p):
    r = 240
    cy = p.C / 2
    body = ring(p, C60 / 2 - r, cy - r, C60 / 2 + r, cy + r, f=0.5)
    return body | beam(C60 / 2 - 190, cy - 330, C60 / 2 + 190, cy + 330, p.V * 0.9)


def delta_shape(p, top=None, bottom=0):
    top = p.C if top is None else top
    x0, x1 = p.sbc - 20, C60 - p.sbc + 20
    cx = C60 / 2
    flat = p.V * 0.9
    dy = top - bottom - p.H
    run = (cx - flat / 2) - x0
    wh = p.T * math.hypot(run, dy) / dy
    left = poly([(x0, bottom), (x0 + wh, bottom), (cx - flat / 2 + wh, top), (cx - flat / 2, top)])
    hull = poly([(x0, bottom), (x1, bottom), (cx + flat / 2, top), (cx - flat / 2, top)])
    return ((left | left.mirror(cx)) & hull) | rect(x0, bottom, x1, bottom + p.H)


@glyph('∆', C60)
def increment(p):
    return delta_shape(p)


@glyph('∇', C60)
def nabla(p):
    return delta_shape(p).flip(p.C / 2)


@glyph('∏', C60)
def product(p):
    x0, x1 = p.sbc, C60 - p.sbc
    return rect(x0 - 20, p.C - p.H, x1 + 20, p.C) | rect(x0, -120, x0 + p.V, p.C) | rect(x1 - p.V, -120, x1, p.C)


@glyph('∑', C60)
def summation(p):
    x0, x1 = p.sbc, C60 - p.sbc
    top, bottom = p.C, -120
    mid = (top + bottom) / 2
    t = p.T
    upper = cut_stroke((x0 + t * 0.62, top - p.H / 2), (C60 / 2 + 40, mid), t, 'h', (1, 0.0001))
    lower = cut_stroke((x0 + t * 0.62, bottom + p.H / 2), (C60 / 2 + 40, mid), t, 'h', (1, 0.0001))
    body = (upper | lower) & column(x0, x1) & band(bottom, top)
    return body | rect(x0, top - p.H, x1, top) | rect(x0, bottom, x1, bottom + p.H)


@glyph('∫', C60)
def integral(p):
    xs = C60 / 2 - p.V / 2
    top = elbow(p, xs, 200, C60 - 90, 800, 'tl', r=150)
    bot = elbow(p, 90, -200, xs + p.V, 220, 'br', r=150)
    return top | bot


def _three_dots(p, pts):
    d = p.dot * 0.9
    return union(*[circle(x, y, d / 2) for x, y in pts])


@glyph('∴', C60)
def therefore(p):
    return _three_dots(p, [(C60 / 2, 460), (170, 110), (C60 - 170, 110)])


@glyph('∵', C60)
def because(p):
    return _three_dots(p, [(C60 / 2, 110), (170, 460), (C60 - 170, 460)])


@glyph('⋮', C30)
def vellipsis(p):
    return _three_dots(p, [(C30 / 2, 60), (C30 / 2, 300), (C30 / 2, 540)])


@glyph('⋯', C90)
def midellipsis(p):
    return _three_dots(p, [(150, p.M), (450, p.M), (750, p.M)])


@glyph('⋱', C60)
def ddots(p):
    return _three_dots(p, [(110, 560), (300, 320), (490, 80)])


@glyph('⋰', C60)
def udots(p):
    return ddots(p).mirror(C60 / 2)


def _ceilfloor(p, top=True):
    xl, xr = 138, 350
    yb, yt = S.BR_BOTTOM, S.BR_TOP
    stem = rect(xl, yb, xl + p.V, yt)
    return stem | (rect(xl, yt - p.H, xr, yt) if top else rect(xl, yb, xr, yb + p.H))


@glyph('⌈', C45)
def lceil(p):
    return _ceilfloor(p, True)


@glyph('⌉', C45)
def rceil(p):
    return _ceilfloor(p, True).mirror(C45 / 2)


@glyph('⌊', C45)
def lfloor(p):
    return _ceilfloor(p, False)


@glyph('⌋', C45)
def rfloor(p):
    return _ceilfloor(p, False).mirror(C45 / 2)


@glyph('⟨', C45)
def langle(p):
    return S.chevron(p, 110, 340, (S.BR_BOTTOM + S.BR_TOP) / 2, (S.BR_TOP - S.BR_BOTTOM) / 2 - 30, p.T * 0.95)


@glyph('⟩', C45)
def rangle(p):
    return langle(p).mirror(C45 / 2)


@glyph('∣', C30)
def divides(p):
    return S.bar(p)


@glyph('∥', C45)
def parallel(p):
    return GLYPHS['‖'][1](p)


@glyph('∖', C45)
def setminus(p):
    return S.backslash(p)


@glyph('∕', C45)
def divisionslash(p):
    return S.slash(p)
