"""Original Degauss letterforms.

Each builder takes a Params object and returns a Shape. The drawing language:
squircle "picture tube" bowls; square outer corners wherever a stem runs on;
bloom traps (slots) where a bowl or arch meets a stem; round phosphor dots.
No outlines are imported from any other font.
"""
from __future__ import annotations

import math

from geometry import Shape, rect, rrect, circle, ellipse, beam, poly, band, column, cut_stroke
from params import C30, C45, C60, C90

GLYPHS: dict[str, tuple[int, object]] = {}
CORNERS = ('bl', 'br', 'tr', 'tl')


def glyph(chars, advance):
    def register(fn):
        for ch in chars:
            GLYPHS[ch] = (advance, fn)
        return fn
    return register


# --- construction helpers -----------------------------------------------------

def ring(p, x0, y0, x1, y1, sq=(), tv=None, th=None, f=None):
    """Squircle ring. Corners named in sq stay square inside and out, because a
    stem runs straight through them."""
    tv = p.V if tv is None else tv
    th = p.H if th is None else th
    ro, ri = p.radii(x1 - x0, y1 - y0, tv, th, f)
    outer = [0 if c in sq else (ro, ro) for c in CORNERS]
    inner = [0 if c in sq else ri for c in CORNERS]
    return (rrect(x0, y0, x1, y1, outer, p.k)
            - rrect(x0 + tv, y0 + th, x1 - tv, y1 - th, inner, p.k))


def elbow(p, x0, y0, x1, y1, corner, tv=None, th=None, r=None):
    """An L-shaped stroke hugging one corner of a box; free ends cut flat."""
    tv = p.V if tv is None else tv
    th = p.H if th is None else th
    w, h = x1 - x0, y1 - y0
    r = p.rf * min(w, h) if r is None else min(r, w, h)
    ri = (max(r - tv * p.ci, p.rmin), max(r - th * p.ci, p.rmin))
    big = 50
    if corner == 'bl':
        return rrect(x0, y0, x1, y1, (r, 0, 0, 0), p.k) - rrect(x0 + tv, y0 + th, x1 + big, y1 + big, (ri, 0, 0, 0), p.k)
    if corner == 'br':
        return rrect(x0, y0, x1, y1, (0, r, 0, 0), p.k) - rrect(x0 - big, y0 + th, x1 - tv, y1 + big, (0, ri, 0, 0), p.k)
    if corner == 'tr':
        return rrect(x0, y0, x1, y1, (0, 0, r, 0), p.k) - rrect(x0 - big, y0 - big, x1 - tv, y1 - th, (0, 0, ri, 0), p.k)
    if corner == 'tl':
        return rrect(x0, y0, x1, y1, (0, 0, 0, r), p.k) - rrect(x0 + tv, y0 - big, x1 + big, y1 - th, (0, 0, 0, ri), p.k)
    raise ValueError(corner)


def trap(p, x, y, dx, dy, th=None):
    """Bloom trap at the inner corner (x, y) where a stroke meets a stem.

    dx points from the stem into the counter, dy from the counter into the
    joining stroke. The CRT counterpart of an ink trap: phosphor bloom fills
    it, so a glowing joint stays as light as the strokes around it.
    """
    th = p.H if th is None else th
    style = getattr(p, 'trap_style', 'dog')
    if style == 'slot':
        w, d = p.trap_w, p.trap_d * th
        return rect(min(x, x + dx * w), min(y - dy, y + dy * d), max(x, x + dx * w), max(y - dy, y + dy * d))
    if style == 'diag':
        w = p.trap_w
        length = 0.62 * th
        return beam(x + dx * w * 0.4, y - dy * w * 0.4, x - dx * length * 0.7071, y + dy * length * 0.7071, w)
    if style == 'dog':
        rr = p.trap_r * th
        return circle(x - dx * rr * 0.18, y + dy * rr * 0.18, rr)
    # 'wedge': a tapered notch that thins the joint, opening toward the counter.
    d = p.trap_d * th
    w = p.trap_wedge * th
    return poly([(x, y - dy * 2), (x, y + dy * d), (x + dx * w, y - dy * 2)])


def dot(p, cx, y_bottom, d=None):
    d = p.dot if d is None else d
    return circle(cx, y_bottom + d / 2, d / 2)


def arch(p, x0, x1, top, bottom=0, traps=True):
    """The n-shoulder: square top-left where the stem runs on, squircle
    top-right, legs cut flat at `bottom`."""
    shape = ring(p, x0, bottom - 600, x1, top, sq=('bl', 'br', 'tl')) & band(bottom, top + 10)
    if traps:
        shape = shape - trap(p, x0 + p.V, top - p.H, 1, 1)
    return shape


def bowl(p, x0, x1, y0, y1, stem='left', th=None, traps=True):
    """A D-shaped squircle bowl whose flat side merges into a stem."""
    th = p.H if th is None else th
    sq = ('bl', 'tl') if stem == 'left' else ('br', 'tr')
    shape = ring(p, x0, y0, x1, y1, sq=sq, th=th)
    if traps:
        if stem == 'left':
            shape = shape - trap(p, x0 + p.V, y1 - th, 1, 1, th) - trap(p, x0 + p.V, y0 + th, 1, -1, th)
        else:
            shape = shape - trap(p, x1 - p.V, y1 - th, -1, 1, th) - trap(p, x1 - p.V, y0 + th, -1, -1, th)
    return shape


def open_right(p, shape, x0, y0, x1, y1, lo=None, hi=None, th=None, f=None):
    """Cut the aperture out of a round ring's right side (c, e, s, C, G, S)."""
    th = p.H if th is None else th
    ro, _ = p.radii(x1 - x0, y1 - y0, p.V, th, f)
    cx = (x0 + x1) / 2
    y_hi = y1 - ro * (p.term if hi is None else hi)
    y_lo = y0 + ro * (p.term if lo is None else lo)
    return shape - rect(cx, y_lo, x1 + 50, y_hi)


# --- lowercase ------------------------------------------------------------------

def _n_box(p):
    return p.sb, C60 - p.sb


@glyph('n', C60)
def n(p):
    x0, x1 = _n_box(p)
    return arch(p, x0, x1, p.X + p.oh)


@glyph('h', C60)
def h(p):
    x0, x1 = _n_box(p)
    return arch(p, x0, x1, p.X + p.oh) | rect(x0, 0, x0 + p.V, p.A)


@glyph('m', C90)
def m(p):
    x0, x1 = p.sb, C90 - p.sb
    xm = C90 / 2 - p.V / 2
    top = p.X + p.oh
    return arch(p, x0, xm + p.V, top) | arch(p, xm, x1, top)


@glyph('u', C60)
def u(p):
    return n(p).rotate180(C60 / 2, p.X / 2)


@glyph('o', C60)
def o(p):
    return ring(p, p.sbr, -p.o, C60 - p.sbr, p.X + p.o)


def _b_bowl(p):
    x0, x1 = p.sb, C60 - p.sbr
    return x0, x1, bowl(p, x0, x1, -p.oh, p.X + p.oh)


@glyph('b', C60)
def b(p):
    x0, x1, shape = _b_bowl(p)
    return shape | rect(x0, 0, x0 + p.V, p.A)


@glyph('d', C60)
def d(p):
    return b(p).mirror(C60 / 2)


@glyph('p', C60)
def p_(p):
    x0, x1, shape = _b_bowl(p)
    return shape | rect(x0, p.D, x0 + p.V, p.X)


@glyph('q', C60)
def q(p):
    return p_(p).mirror(C60 / 2)


@glyph('c', C60)
def c(p):
    x0, y0, x1, y1 = p.sbr, -p.o, C60 - p.sbr + 6, p.X + p.o
    return open_right(p, ring(p, x0, y0, x1, y1), x0, y0, x1, y1)


@glyph('e', C60)
def e(p):
    x0, y0, x1, y1 = p.sbr, -p.o, C60 - p.sbr, p.X + p.o
    th = p.Hc
    yb = round(0.53 * p.X - th / 2)
    shape = ring(p, x0, y0, x1, y1, th=th) | rect(x0 + p.V / 2, yb, x1 - p.V / 2, yb + th)
    ro, _ = p.radii(x1 - x0, y1 - y0, p.V, th)
    return shape - rect((x0 + x1) / 2, y0 + ro * p.term, x1 + 50, yb)


@glyph('a', C60)
def a(p):
    x0, x1 = p.sbr + 4, C60 - p.sb
    th = p.Hc
    top = p.X + p.oh
    xa = x0 + 14
    ro, ri = p.radii(x1 - xa, p.X, p.V, th)
    hook = (rrect(xa, -600, x1, top, (0, 0, ro, 0), p.k)
            - rrect(xa - 60, -600, x1 - p.V, top - th, (0, 0, ri, 0), p.k)) & band(0, top + 10)
    yb = round(0.60 * p.X + th / 2)
    return hook | bowl(p, x0, x1, -p.oh, yb, stem='right', th=th)


def s_shape(p, x0, y0, x1, y1, th, lift=6, tv=None):
    """The squircle S: two half-height rings sharing a horizontal spine,
    each opened on opposite sides with terminal cuts through the corner."""
    tv = p.V if tv is None else tv
    ym = round((y0 + y1) / 2 + lift)
    cx = (x0 + x1) / 2
    top = ring(p, x0, ym - th / 2, x1, y1, tv=tv, th=th)
    bot = ring(p, x0, y0, x1, ym + th / 2, tv=tv, th=th)
    rt, _ = p.radii(x1 - x0, y1 - ym + th / 2, tv, th)
    rb, _ = p.radii(x1 - x0, ym + th / 2 - y0, tv, th)
    top = top - rect(cx, ym - th, x1 + 50, y1 - rt * p.term)
    bot = bot - rect(x0 - 50, y0 + rb * p.term, cx, ym + th)
    return top | bot


@glyph('s', C60)
def s(p):
    return s_shape(p, p.sbr + 6, -p.o, C60 - p.sbr - 6, p.X + p.o, p.Hc)


@glyph('i', C30)
def i(p):
    xs = C30 / 2 - p.V / 2
    return rect(xs, 0, xs + p.V, p.X) | dot(p, C30 / 2, p.X + p.dot_gap)


@glyph('l', C30)
def l(p):
    xs = C30 / 2 - p.V / 2 - 30
    return elbow(p, xs, -p.oh, C30 - 44, p.A, 'bl', r=118 if not p.bold else 140)


@glyph('j', C45)
def j(p):
    xr = C45 - 100
    xs = xr - p.V
    tail = elbow(p, 58, p.D, xr, 1, 'br', th=p.Ht, r=150)
    return tail | rect(xs, 0, xr, p.X) | dot(p, xs + p.V / 2, p.X + p.dot_gap)


@glyph('f', C45)
def f(p):
    xs = 116
    hook = elbow(p, xs, 0, C45 - 34, p.A + p.oh, 'tl', r=150)
    return hook | rect(44, p.X - p.H, C45 - 64, p.X)


@glyph('t', C45)
def t(p):
    xs = 116
    tail = elbow(p, xs, -p.oh, C45 - 40, p.X + 132, 'bl', r=150)
    return tail | rect(44, p.X - p.H, C45 - 64, p.X)


@glyph('r', C45)
def r(p):
    x0 = 86
    xe = C45 - 44
    # The virtual shoulder ends where its inner edge clears the cut, so only
    # the arm survives: a vertical cut through the start of the corner.
    x1 = xe + p.V + 22
    return (arch(p, x0, x1, p.X + p.oh) & column(-100, xe)) | rect(x0, 0, x0 + p.V, p.X)


@glyph('g', C60)
def g(p):
    x0, x1 = p.sbr, C60 - p.sb
    shape = bowl(p, x0, x1, -p.oh, p.X + p.oh, stem='right')
    tail = elbow(p, x0 + 10, p.D, x1, 1, 'br', th=p.Ht)
    return shape | rect(x1 - p.V, 0, x1, p.X + p.oh) | tail


@glyph('y', C60)
def y(p):
    x0, x1 = _n_box(p)
    return u(p) | elbow(p, x0 + 16, p.D, x1, 1, 'br', th=p.Ht)


def _v_strokes(p, x0, x1, top, bottom=0, flat=None, t=None):
    """Two diagonals meeting in a flat vertex at `bottom` (v, w, V, W, y)."""
    t = p.T if t is None else t
    cx = (x0 + x1) / 2
    flat = p.V * 0.62 if flat is None else flat
    dy = top - bottom
    run = (cx - flat / 2) - x0
    wh = t * math.hypot(run, dy) / dy
    left = poly([(x0, top), (x0 + wh, top), (cx - flat / 2 + wh, bottom), (cx - flat / 2, bottom)])
    hull = poly([(x0, top), (x1, top), (cx + flat / 2, bottom), (cx - flat / 2, bottom)])
    return (left | left.mirror(cx)) & hull


@glyph('v', C60)
def v(p):
    return _v_strokes(p, p.sb - 14, C60 - p.sb + 14, p.X)


@glyph('w', C90)
def w(p):
    x0 = p.sb - 14
    cx = C90 / 2
    left = _v_strokes(p, x0, cx + p.V * 0.55, p.X)
    return left | left.mirror(cx)


@glyph('x', C60)
def x(p):
    import math
    x0, x1 = p.sb - 8, C60 - p.sb + 8
    t = p.T
    dy = p.X
    wh = t * math.hypot(x1 - x0, dy) / dy * 0.96
    a = poly([(x0, 0), (x0 + wh, 0), (x1, p.X), (x1 - wh, p.X)])
    return a | a.mirror(C60 / 2)


@glyph('z', C60)
def z(p):
    import math
    x0, x1 = p.sb + 4, C60 - p.sb - 4
    th = p.H
    dy = p.X - 2 * th
    wh = p.T * math.hypot(x1 - x0, dy) / dy
    diag = poly([(x0, th), (x0 + wh, th), (x1, p.X - th), (x1 - wh, p.X - th)])
    return diag | rect(x0, p.X - th, x1, p.X) | rect(x0, 0, x1, th)


def _k_limbs(p, x0, x1, top, yj, stem_top):
    """Stem, an arm from the stem to the top right, and a leg that springs
    from the arm (k and K)."""
    t = p.T
    xs = x0 + p.V
    arm_dir = (x1 - xs, top - yj)
    # Arm: vertical cut hidden in the stem, horizontal cut at the top edge.
    wh = t * math.hypot(*arm_dir) / arm_dir[1]
    arm = cut_stroke((xs - 1, yj), (x1 - wh / 2, top), t, 'v', 'h') & band(-10, top)
    f = 0.36
    ax, ay = xs + (x1 - wh / 2 - xs) * f, yj + (top - yj) * f
    leg_dx, leg_dy = x1 - ax, ay
    whl = t * math.hypot(leg_dx, leg_dy) / leg_dy
    leg = cut_stroke((ax, ay), (x1 - whl / 2, 0), t * 1.02, arm_dir, 'h')
    stem = rect(x0, 0, xs, stem_top)
    return stem | ((arm | leg) & column(x0, 5000) & band(0, top))


@glyph('k', C60)
def k(p):
    x0, x1 = p.sb, C60 - p.sb + 8
    return _k_limbs(p, x0, x1, p.X, round(p.X * 0.30), p.A)


@glyph(' \u00a0', C60)
def space(p):
    return Shape()


# --- capitals -----------------------------------------------------------------

def _cap_box(p):
    return p.sbc, C60 - p.sbc


def _bar(p, center=0.5):
    """Bottom edge of a crossbar centred at `center` of the cap height."""
    return round(p.C * center - p.H / 2 + 6)


@glyph('H', C60)
def H_(p):
    x0, x1 = _cap_box(p)
    yb = _bar(p)
    return rect(x0, 0, x0 + p.V, p.C) | rect(x1 - p.V, 0, x1, p.C) | rect(x0, yb, x1, yb + p.H)


@glyph('E', C60)
def E_(p):
    x0, x1 = p.sbc + 6, C60 - p.sbc + 4
    yb = _bar(p)
    return (rect(x0, 0, x0 + p.V, p.C) | rect(x0, p.C - p.H, x1, p.C)
            | rect(x0, yb, x1 - 34, yb + p.H) | rect(x0, 0, x1, p.H))


@glyph('F', C60)
def F_(p):
    x0, x1 = p.sbc + 8, C60 - p.sbc + 4
    yb = _bar(p) - 10
    return rect(x0, 0, x0 + p.V, p.C) | rect(x0, p.C - p.H, x1, p.C) | rect(x0, yb, x1 - 40, yb + p.H)


@glyph('L', C60)
def L_(p):
    x0, x1 = p.sbc + 12, C60 - p.sbc + 6
    return rect(x0, 0, x0 + p.V, p.C) | rect(x0, 0, x1, p.H)


@glyph('T', C60)
def T_(p):
    x0, x1 = p.sbc - 16, C60 - p.sbc + 16
    return rect(x0, p.C - p.H, x1, p.C) | rect(C60 / 2 - p.V / 2, 0, C60 / 2 + p.V / 2, p.C)


@glyph('I', C45)
def I_(p):
    cx = C45 / 2
    half = 150 if not p.bold else 156
    return (rect(cx - p.V / 2, 0, cx + p.V / 2, p.C) | rect(cx - half, p.C - p.H, cx + half, p.C)
            | rect(cx - half, 0, cx + half, p.H))


def _O_box(p):
    return p.sbcr, -p.oc, C60 - p.sbcr, p.C + p.oc


@glyph('O', C60)
def O_(p):
    return ring(p, *_O_box(p))


@glyph('C', C60)
def C_(p):
    x0, y0, x1, y1 = _O_box(p)
    x1 += 6
    return open_right(p, ring(p, x0, y0, x1, y1), x0, y0, x1, y1)


@glyph('G', C60)
def G_(p):
    x0, y0, x1, y1 = _O_box(p)
    ro, _ = p.radii(x1 - x0, y1 - y0)
    cx = (x0 + x1) / 2
    top = round(p.C * 0.50 + p.H / 2)
    shape = ring(p, x0, y0, x1, y1) - rect(cx, top, x1 + 50, y1 - ro * p.term)
    return shape | rect(cx - 6, top - p.H, x1, top)


@glyph('Q', C60)
def Q_(p):
    x0, y0, x1, y1 = _O_box(p)
    tail = beam(x1 - 176, 176, x1 + 20, -118, p.T * 1.04)
    return ring(p, x0, y0, x1, y1) | (tail & band(-104, 400))


@glyph('D', C60)
def D_(p):
    x0, x1 = p.sbc, C60 - p.sbcr
    return bowl(p, x0, x1, 0, p.C) | rect(x0, 0, x0 + p.V, p.C)


@glyph('P', C60)
def P_(p):
    x0, x1 = p.sbc, C60 - p.sbcr - 4
    yb = round(p.C * 0.42 - p.H / 2)
    return bowl(p, x0, x1, yb, p.C) | rect(x0, 0, x0 + p.V, p.C)


@glyph('R', C60)
def R_(p):
    x0, x1 = p.sbc, C60 - p.sbcr - 4
    yb = round(p.C * 0.42 - p.H / 2)
    xm = x0 + p.V + (x1 - x0 - p.V) * 0.30
    xr = C60 - p.sbc + 4
    whl = p.T * math.hypot(xr - xm, yb) / yb
    leg = cut_stroke((xm, yb + p.H / 2), (xr - whl / 2, 0), p.T, 'h', 'h')
    return bowl(p, x0, x1, yb, p.C) | rect(x0, 0, x0 + p.V, p.C) | leg


@glyph('B', C60)
def B_(p):
    x0, x1 = p.sbc, C60 - p.sbcr
    ym = round(p.C * 0.53)
    th = p.H
    upper = bowl(p, x0, x1 - 26, ym - th / 2, p.C, traps=False)
    lower = bowl(p, x0, x1, 0, ym + th / 2, traps=False)
    shape = upper | lower | rect(x0, 0, x0 + p.V, p.C)
    # Full traps at the outer joints; half-depth ones either side of the waist.
    shape = shape - trap(p, x0 + p.V, p.C - th, 1, 1) - trap(p, x0 + p.V, th, 1, -1)
    half = p.H * 0.55
    return shape - trap(p, x0 + p.V, ym + th / 2, 1, -1, half) - trap(p, x0 + p.V, ym - th / 2, 1, 1, half)


@glyph('U', C60)
def U_(p):
    x0, x1 = _cap_box(p)
    return ring(p, x0, -p.oh, x1, p.C + 700, sq=('tl', 'tr')) & band(-50, p.C)


@glyph('J', C60)
def J_(p):
    x0, x1 = p.sbc - 4, C60 - p.sbc - 4
    ro, _ = p.radii(x1 - x0, 700)
    shape = ring(p, x0, -p.oh, x1, p.C + 700, sq=('tl', 'tr')) & band(-50, p.C)
    return shape - rect(x0 - 50, ro * 1.05 + 30, (x0 + x1) / 2, p.C + 50)


@glyph('S', C60)
def S_(p):
    return s_shape(p, p.sbcr + 4, -p.oc, C60 - p.sbcr - 4, p.C + p.oc, p.H, lift=8)


def _A_squircle(p):
    x0, x1 = _cap_box(p)
    yb = _bar(p, 0.40)
    shape = ring(p, x0, -700, x1, p.C + p.oh, sq=('bl', 'br')) & band(0, p.C + 20)
    return shape | rect(x0, yb, x1, yb + p.H)


def _A_diagonal(p, bar=True):
    x0, x1 = p.sbc - 20, C60 - p.sbc + 20
    cx = C60 / 2
    flat = p.V * 0.9
    t = p.T
    dy = p.C
    run = (cx - flat / 2) - x0
    wh = t * math.hypot(run, dy) / dy
    left = poly([(x0, 0), (x0 + wh, 0), (cx - flat / 2 + wh, p.C), (cx - flat / 2, p.C)])
    hull = poly([(x0, 0), (x1, 0), (cx + flat / 2, p.C), (cx - flat / 2, p.C)])
    shape = left | left.mirror(cx)
    if bar:
        yb = _bar(p, 0.30)
        shape = shape | rect(x0, yb, x1, yb + p.H)
    return shape & hull


@glyph('A', C60)
def A_(p):
    return _A_squircle(p)


@glyph('V', C60)
def V_(p):
    return _v_strokes(p, p.sbc - 22, C60 - p.sbc + 22, p.C, flat=p.V * 0.78)


@glyph('W', C90)
def W_(p):
    x0 = p.sbc - 18
    cx = C90 / 2
    # The inner strokes share one flat apex; keep their tops overlapping.
    left = _v_strokes(p, x0, cx + p.V * 0.55, p.C, flat=p.V * 0.7)
    return left | left.mirror(cx)


@glyph('M', C90)
def M_(p):
    x0, x1 = p.sbc, C90 - p.sbc
    yv = round(p.C * 0.22)
    vee = _v_strokes(p, x0, x1, p.C, bottom=yv, flat=p.V * 0.8)
    return rect(x0, 0, x0 + p.V, p.C) | rect(x1 - p.V, 0, x1, p.C) | vee


@glyph('N', C60)
def N_(p):
    x0, x1 = _cap_box(p)
    t = p.T
    run = x1 - x0 - p.V
    wh = t * math.hypot(run, p.C) / p.C
    diag = poly([(x0, p.C), (x0 + wh, p.C), (x1, 0), (x1 - wh, 0)])
    return rect(x0, 0, x0 + p.V, p.C) | rect(x1 - p.V, 0, x1, p.C) | diag


@glyph('X', C60)
def X_(p):
    x0, x1 = p.sbc - 12, C60 - p.sbc + 12
    wh = p.T * math.hypot(x1 - x0, p.C) / p.C * 0.97
    a = poly([(x0, 0), (x0 + wh, 0), (x1, p.C), (x1 - wh, p.C)])
    return a | a.mirror(C60 / 2)


@glyph('Y', C60)
def Y_(p):
    x0, x1 = p.sbc - 18, C60 - p.sbc + 18
    ym = round(p.C * 0.40)
    vee = _v_strokes(p, x0, x1, p.C, bottom=ym, flat=p.V)
    return vee | rect(C60 / 2 - p.V / 2, 0, C60 / 2 + p.V / 2, ym + 2)


@glyph('Z', C60)
def Z_(p):
    x0, x1 = p.sbc + 2, C60 - p.sbc - 2
    th = p.H
    dy = p.C - 2 * th
    wh = p.T * math.hypot(x1 - x0, dy) / dy
    diag = poly([(x0, th), (x0 + wh, th), (x1, p.C - th), (x1 - wh, p.C - th)])
    return diag | rect(x0, p.C - th, x1, p.C) | rect(x0, 0, x1, th)


@glyph('K', C60)
def K_(p):
    x0, x1 = p.sbc, C60 - p.sbc + 10
    return _k_limbs(p, x0, x1, p.C, round(p.C * 0.30), p.C)


# --- figures (tabular, C60) -------------------------------------------------------

def _fig_box(p):
    return p.sbcr + 8, 0, C60 - p.sbcr - 8, p.C


@glyph('0', C60)
def zero(p):
    x0 = 92 if not p.bold else 62
    x1 = C60 - x0
    body = ring(p, x0, -p.oc, x1, p.C + p.oc, f=0.44)
    # The power-off dot: a picture tube collapsing to its last bright point.
    # It always keeps clear of the counter walls (no theta, no slashed O).
    counter = x1 - x0 - 2 * p.V
    dw = min(p.dot, 0.54 * counter)
    dh = min(p.dot * 1.3, dw * 1.36)
    return body | ellipse(C60 / 2, p.C / 2, dw / 2, dh / 2)


@glyph('1', C60)
def one(p):
    xs = C60 / 2 - p.V / 2 + 24
    stem = rect(xs, 0, xs + p.V, p.C)
    flag = cut_stroke((xs + p.V * 0.5, p.C - p.T * 0.5), (xs - 128, p.C - 190), p.T * 0.96, 'v', 'h')
    base = rect(118, 0, C60 - 118, p.H)
    return stem | (flag & band(0, p.C)) | base


@glyph('2', C60)
def two(p):
    x0, y0, x1, y1 = _fig_box(p)
    y1 += p.oh
    th = p.H
    ym = round(p.C * 0.47)
    cx = (x0 + x1) / 2
    ru, _ = p.radii(x1 - x0, y1 - ym + th / 2)
    upper = ring(p, x0, ym - th / 2, x1, y1) - rect(x0 - 50, ym - th, cx, y1 - ru * p.term)
    lower = ring(p, x0, 0, x1, ym + th / 2, sq=('bl', 'br')) - rect(cx, th, x1 + 50, ym + th)
    return upper | lower


@glyph('3', C60)
def three(p):
    x0, y0, x1, y1 = _fig_box(p)
    y0, y1 = -p.oh, y1 + p.oh
    th = p.H
    ym = round(p.C * 0.53)
    cx = (x0 + x1) / 2
    ru, _ = p.radii(x1 - x0, y1 - ym + th / 2)
    rl, _ = p.radii(x1 - x0, ym + th / 2 - y0)
    upper = ring(p, x0 + 12, ym - th / 2, x1 - 12, y1) - rect(x0 - 50, ym - th, cx, y1 - ru * p.term)
    lower = ring(p, x0, y0, x1, ym + th / 2) - rect(x0 - 50, y0 + rl * p.term, cx, ym + th)
    return upper | lower | rect(x0 + 118, ym - th / 2, cx + 2, ym + th / 2)


@glyph('4', C60)
def four(p):
    x0, y0, x1, y1 = _fig_box(p)
    x0 -= 10
    x1 += 6
    xs = x1 - p.V - 42
    yb = round(p.C * 0.24)
    stem = rect(xs, 0, xs + p.V, p.C)
    bar = rect(x0, yb, x1, yb + p.H)
    dy = p.C - yb
    run = xs - x0
    wh = p.T * math.hypot(run, dy) / dy
    diag = poly([(x0, yb + p.H / 2), (x0 + wh, yb + p.H / 2), (xs + wh * 0.5, p.C), (xs - wh * 0.5, p.C)])
    return stem | bar | (diag & column(x0, xs + p.V) & band(yb, p.C))


@glyph('5', C60)
def five(p):
    x0, y0, x1, y1 = _fig_box(p)
    y0 = -p.oh
    th = p.H
    ym = round(p.C * 0.56)
    cx = (x0 + x1) / 2
    rl, _ = p.radii(x1 - x0, ym + th / 2 - y0)
    lower = ring(p, x0, y0, x1, ym + th / 2, sq=('tl',)) - rect(x0 - 50, y0 + rl * p.term, cx, ym - th / 2)
    lower = lower - trap(p, x0 + p.V, ym + th / 2 - th, 1, 1)
    return lower | rect(x0, ym - th / 2, x0 + p.V, p.C) | rect(x0, p.C - th, x1 - 8, p.C)


def _six(p):
    x0, y0, x1, y1 = _fig_box(p)
    y0, y1 = -p.oh, y1 + p.oh
    th = p.H
    ym = round(p.C * 0.57)
    cx = (x0 + x1) / 2
    rbig, _ = p.radii(x1 - x0, y1 - y0)
    hood = (ring(p, x0, y0, x1, y1) & band(ym - th / 2, 2000)) - rect(cx, y0 - 50, x1 + 50, y1 - rbig * p.term)
    bowl_ = ring(p, x0, y0, x1, ym + th / 2, sq=('tl',)) - trap(p, x0 + p.V, ym + th / 2 - th, 1, 1)
    return hood | bowl_


@glyph('6', C60)
def six(p):
    return _six(p)


@glyph('9', C60)
def nine(p):
    return _six(p).rotate180(C60 / 2, p.C / 2)


@glyph('7', C60)
def seven(p):
    x0, y0, x1, y1 = _fig_box(p)
    x0 -= 4
    th = p.H
    xb = x0 + 104
    wh = p.T * math.hypot(x1 - xb, p.C) / p.C
    diag = cut_stroke((x1 - wh / 2, p.C - th / 2), (xb + wh / 2, 0), p.T, 'h', 'h')
    return rect(x0, p.C - th, x1, p.C) | (diag & column(0, x1))


@glyph('8', C60)
def eight(p):
    x0, y0, x1, y1 = _fig_box(p)
    y0, y1 = -p.oh, y1 + p.oh
    th = p.H
    ym = round(p.C * 0.54)
    return ring(p, x0 + 22, ym - th / 2, x1 - 22, y1) | ring(p, x0, y0, x1, ym + th / 2)
