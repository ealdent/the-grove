"""Degauss geometry: a small shape algebra over skia-pathops.

Every glyph is a union of exactly specified primitives (rectangles, squircle
rounded rectangles, slanted strokes and circles), refined with boolean
operations. Coordinates are font units, 1000 per em, y up. Outer contours are
counter-clockwise (PostScript direction) until a font writer reverses them.
"""
from __future__ import annotations

import math

import pathops

KAPPA = 0.5523  # cubic handle length for a circular quarter arc


class Shape:
    """An immutable filled region. Operators: | union, - difference, & intersect."""

    __slots__ = ('path',)

    def __init__(self, path: pathops.Path | None = None):
        self.path = path if path is not None else pathops.Path()

    def _op(self, other: 'Shape', operator) -> 'Shape':
        return Shape(pathops.op(self.path, other.path, operator, fix_winding=True,
                                keep_starting_points=False, clockwise=False))

    def __or__(self, other): return self._op(other, pathops.PathOp.UNION)
    def __sub__(self, other): return self._op(other, pathops.PathOp.DIFFERENCE)
    def __and__(self, other): return self._op(other, pathops.PathOp.INTERSECTION)

    def transform(self, xx=1, xy=0, yx=0, yy=1, dx=0, dy=0) -> 'Shape':
        path = pathops.Path(self.path)
        path = path.transform(xx, xy, yx, yy, dx, dy)
        # A reflection reverses winding; normalise so booleans stay predictable.
        return Shape(pathops.simplify(path, fix_winding=True, keep_starting_points=False,
                                      clockwise=False))

    def move(self, dx=0, dy=0) -> 'Shape':
        return self.transform(dx=dx, dy=dy)

    def mirror(self, axis_x: float) -> 'Shape':
        """Reflect left-right about the vertical line x = axis_x."""
        return self.transform(xx=-1, dx=2 * axis_x)

    def flip(self, axis_y: float) -> 'Shape':
        """Reflect top-bottom about the horizontal line y = axis_y."""
        return self.transform(yy=-1, dy=2 * axis_y)

    def rotate180(self, cx: float, cy: float) -> 'Shape':
        return self.transform(xx=-1, yy=-1, dx=2 * cx, dy=2 * cy)

    def scale(self, sx: float, sy: float | None = None, cx: float = 0, cy: float = 0) -> 'Shape':
        sy = sx if sy is None else sy
        return self.transform(xx=sx, yy=sy, dx=cx - sx * cx, dy=cy - sy * cy)

    def shear(self, slope: float, cy: float = 0) -> 'Shape':
        """x += slope * (y - cy). (pathops takes fontTools order: x' = xx*x + yx*y.)"""
        return self.transform(yx=slope, dx=-slope * cy)

    def rotate90(self, cx: float, cy: float, ccw: bool = True) -> 'Shape':
        """Quarter turn about (cx, cy); counter-clockwise by default."""
        if ccw:
            return self.transform(0, 1, -1, 0, cx + cy, cy - cx)
        return self.transform(0, -1, 1, 0, cx - cy, cy + cx)

    @property
    def bounds(self):
        if self.empty:
            return (0, 0, 0, 0)
        return self.path.bounds

    @property
    def empty(self) -> bool:
        return len(list(self.path.contours)) == 0

    def draw(self, pen):
        self.path.draw(pen)


def union(*shapes: Shape) -> Shape:
    shapes = [s for s in shapes if s is not None and not s.empty]
    if not shapes:
        return Shape()
    builder = pathops.OpBuilder(fix_winding=True, keep_starting_points=False)
    for s in shapes:
        builder.add(s.path, pathops.PathOp.UNION)
    return Shape(builder.resolve())


# --- primitives ---------------------------------------------------------------

def _pen():
    path = pathops.Path()
    return path, path.getPen()


def poly(points) -> Shape:
    path, pen = _pen()
    pts = list(points)
    # Normalise to counter-clockwise so every primitive shares a direction.
    area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))
    if area < 0:
        pts.reverse()
    pen.moveTo(pts[0])
    for p in pts[1:]:
        pen.lineTo(p)
    pen.closePath()
    return Shape(path)


def rect(x0, y0, x1, y1) -> Shape:
    if x1 < x0:
        x0, x1 = x1, x0
    if y1 < y0:
        y0, y1 = y1, y0
    if x1 - x0 <= 0 or y1 - y0 <= 0:
        return Shape()
    return poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])


def _corners(r):
    if isinstance(r, (int, float)):
        r = (r, r, r, r)
    out = []
    for c in r:
        if c is None:
            c = 0
        out.append((float(c), float(c)) if isinstance(c, (int, float)) else (float(c[0]), float(c[1])))
    return out


def rrect(x0, y0, x1, y1, r=0, k=0.64) -> Shape:
    """Rounded rectangle with squircle corners.

    r is one radius or (bottom-left, bottom-right, top-right, top-left); each
    radius may be a number or an (rx, ry) pair. k is the cubic handle ratio:
    0.5523 draws a circular quarter, larger values square the corner off
    towards a superellipse, like the face of a picture tube.
    """
    w, h = x1 - x0, y1 - y0
    if w <= 0 or h <= 0:
        return Shape()
    bl, br, tr, tl = [(min(rx, w / 2), min(ry, h / 2)) for rx, ry in _corners(r)]
    path, pen = _pen()
    cur = [None]

    def line(p):
        if cur[0] is None or (abs(p[0] - cur[0][0]) > 1e-6 or abs(p[1] - cur[0][1]) > 1e-6):
            pen.lineTo(p)
            cur[0] = p

    def curve(c1, c2, p):
        pen.curveTo(c1, c2, p)
        cur[0] = p

    start = (x0 + bl[0], y0)
    pen.moveTo(start)
    cur[0] = start
    line((x1 - br[0], y0))
    if br[0] > 0 and br[1] > 0:
        curve((x1 - br[0] * (1 - k), y0), (x1, y0 + br[1] * (1 - k)), (x1, y0 + br[1]))
    line((x1, y1 - tr[1]))
    if tr[0] > 0 and tr[1] > 0:
        curve((x1, y1 - tr[1] * (1 - k)), (x1 - tr[0] * (1 - k), y1), (x1 - tr[0], y1))
    line((x0 + tl[0], y1))
    if tl[0] > 0 and tl[1] > 0:
        curve((x0 + tl[0] * (1 - k), y1), (x0, y1 - tl[1] * (1 - k)), (x0, y1 - tl[1]))
    line((x0, y0 + bl[1]))
    if bl[0] > 0 and bl[1] > 0:
        curve((x0, y0 + bl[1] * (1 - k)), (x0 + bl[0] * (1 - k), y0), start)
    pen.closePath()
    return Shape(path)


def circle(cx, cy, r) -> Shape:
    return ellipse(cx, cy, r, r)


def ellipse(cx, cy, rx, ry, k=KAPPA) -> Shape:
    path, pen = _pen()
    pen.moveTo((cx + rx, cy))
    pen.curveTo((cx + rx, cy + ry * k), (cx + rx * k, cy + ry), (cx, cy + ry))
    pen.curveTo((cx - rx * k, cy + ry), (cx - rx, cy + ry * k), (cx - rx, cy))
    pen.curveTo((cx - rx, cy - ry * k), (cx - rx * k, cy - ry), (cx, cy - ry))
    pen.curveTo((cx + rx * k, cy - ry), (cx + rx, cy - ry * k), (cx + rx, cy))
    pen.closePath()
    return Shape(path)


def slant(xb, yb, xt, yt, t) -> Shape:
    """A straight stroke between two horizontal cuts.

    (xb, yb) and (xt, yt) are the centre points of the bottom and top cuts; t is
    the stroke's true (perpendicular) thickness. The horizontal width grows by
    1/cos of the angle so diagonals read as heavy as vertical stems.
    """
    dx, dy = xt - xb, yt - yb
    w = t * math.hypot(dx, dy) / abs(dy)
    h = w / 2
    return poly([(xb - h, yb), (xb + h, yb), (xt + h, yt), (xt - h, yt)])


def hslant(xl, yl, xr, yr, t) -> Shape:
    """A near-horizontal stroke between two vertical cuts (true thickness t)."""
    dx, dy = xr - xl, yr - yl
    v = t * math.hypot(dx, dy) / abs(dx)
    h = v / 2
    return poly([(xl, yl - h), (xr, yr - h), (xr, yr + h), (xl, yl + h)])


def beam(x0, y0, x1, y1, t) -> Shape:
    """A stroke of true thickness t between two points, cut square to its axis."""
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy)
    nx, ny = -dy / length * t / 2, dx / length * t / 2
    return poly([(x0 - nx, y0 - ny), (x1 - nx, y1 - ny), (x1 + nx, y1 + ny), (x0 + nx, y0 + ny)])


def band(y0, y1, x0=-3000, x1=3000) -> Shape:
    """A wide horizontal slab, handy for clipping."""
    return rect(x0, y0, x1, y1)


def column(x0, x1, y0=-3000, y1=3000) -> Shape:
    return rect(x0, y0, x1, y1)


def halfplane(p0, p1, side='left') -> Shape:
    """Everything to one side of the directed line p0 -> p1 (big polygon)."""
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy)
    ux, uy = dx / length, dy / length
    big = 6000
    nx, ny = (-uy, ux) if side == 'left' else (uy, -ux)
    a = (x0 - ux * big, y0 - uy * big)
    b = (x1 + ux * big, y1 + uy * big)
    return poly([a, b, (b[0] + nx * big, b[1] + ny * big), (a[0] + nx * big, a[1] + ny * big)])


def _line_cut(point, direction, origin, cut):
    """Intersect the line origin + s*direction with a cut line through `point`.

    cut is 'v' (vertical), 'h' (horizontal) or a direction vector."""
    if cut == 'v':
        cut = (0.0, 1.0)
    elif cut == 'h':
        cut = (1.0, 0.0)
    (ox, oy), (dx, dy), (px, py), (cx, cy) = origin, direction, point, cut
    denom = dx * cy - dy * cx
    s = ((px - ox) * cy - (py - oy) * cx) / denom
    return (ox + s * dx, oy + s * dy)


def cut_stroke(c0, c1, t, cut0='h', cut1='h') -> Shape:
    """A straight stroke of true thickness t along the centreline c0 -> c1.

    Each end is cut along a line through its centre point: 'h' horizontal, 'v'
    vertical, or any direction vector (for example the axis of a stroke the end
    hides inside). This is how every diagonal in Degauss is drawn.
    """
    (x0, y0), (x1, y1) = c0, c1
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy)
    nx, ny = -dy / length * t / 2, dx / length * t / 2
    edges = []
    for sign in (1, -1):
        origin = (x0 + sign * nx, y0 + sign * ny)
        edges.append((_line_cut(c0, (dx, dy), origin, cut0), _line_cut(c1, (dx, dy), origin, cut1)))
    (a0, a1), (b0, b1) = edges
    return poly([a0, a1, b1, b0])


def outline(points, t, closed=True, join='miter', miter_limit=2.2) -> Shape:
    """Stroke a polyline of width t (centred on the path) into a filled shape."""
    path, pen = _pen()
    pen.moveTo(points[0])
    for pt in points[1:]:
        pen.lineTo(pt)
    if closed:
        pen.closePath()
    else:
        pen.endPath()
    joins = {'miter': pathops.LineJoin.MITER_JOIN, 'round': pathops.LineJoin.ROUND_JOIN,
             'bevel': pathops.LineJoin.BEVEL_JOIN}
    path.stroke(t, pathops.LineCap.BUTT_CAP, joins[join], miter_limit)
    path.convertConicsToQuads()
    return Shape(pathops.simplify(path, fix_winding=True, keep_starting_points=False, clockwise=False))


def inset_convex(points, d):
    """Move every edge of a convex polygon inward by d; None if it vanishes."""
    pts = list(points)
    area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))
    if area < 0:
        pts.reverse()
    lines = []
    for a, b in zip(pts, pts[1:] + pts[:1]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        length = math.hypot(dx, dy)
        nx, ny = -dy / length, dx / length          # inward normal for CCW
        lines.append(((a[0] + nx * d, a[1] + ny * d), (dx, dy)))
    out = []
    for (p1, d1), (p2, d2) in zip(lines[-1:] + lines[:-1], lines):
        denom = d1[0] * d2[1] - d1[1] * d2[0]
        s = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / denom
        out.append((p1[0] + s * d1[0], p1[1] + s * d1[1]))
    inner_area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(out, out[1:] + out[:1]))
    return out if inner_area > 0 else None
