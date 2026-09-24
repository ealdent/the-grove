"""Degauss metrics and per-weight drawing parameters.

Widths are discrete. Every advance is one of four classes, named like tape
lengths: C30, C45, C60 and C90 are 300, 450, 600 and 900 units, the 2:3:4:6
ratio of an octave, a fifth and a fourth. Bold and Regular share advances.
"""
from __future__ import annotations

UPM = 1000
C30, C45, C60, C90 = 300, 450, 600, 900
WIDTH_CLASSES = {C30: 'C30', C45: 'C45', C60: 'C60', C90: 'C90'}

X_HEIGHT = 530
CAP = 700
ASC = 750          # ascender of b d f h k l
DESC = -200        # descender of g j p q y
MATH = 300         # axis of + - = < > and friends
ASCENT, DESCENT = 930, -270   # line box; box drawing fills it exactly


class Params:
    """Everything a glyph builder may ask about the current weight."""

    def __init__(self, bold: bool = False):
        self.bold = bold
        self.weight = 700 if bold else 400
        self.style = 'Bold' if bold else 'Regular'
        self.X, self.C, self.A, self.D, self.M = X_HEIGHT, CAP, ASC, DESC, MATH
        # Strokes: vertical stems, horizontal strokes, and diagonals.
        self.V = 146 if bold else 84
        self.H = 126 if bold else 74
        self.T = 140 if bold else 82          # diagonal true thickness
        self.Hc = 112 if bold else 70         # horizontals in crowded letters (e s a g 8 B)
        self.Ht = 104 if bold else 72         # descender tails (g j y)
        self.Vi = 96 if bold else 76          # outline icons (circled operators, keys, power)
        # Overshoots for round forms (squircles need less than circles).
        self.o = 8                             # fully round bowls (o c e s)
        self.oh = 4                            # half-round bowls and arches
        self.oc = 9                            # round capitals
        # Sidebearings inside a C60 cell: straight sides and round sides.
        self.sb = 62 if bold else 68
        self.sbr = 50 if bold else 56
        self.sbc = 60 if bold else 66           # capitals and figures
        self.sbcr = 48 if bold else 54
        # Squircle corner system.
        self.k = 0.66                          # handle ratio (0.5523 = circle)
        self.rf = 0.40                         # outer radius / smaller box side
        self.ci = 0.94                         # inner radius = outer - stroke * ci
        self.rmin = 26 if bold else 30         # smallest inner radius
        self.term = 0.62                       # terminal cut, as a share of the corner
        # Bloom traps: slots where a bowl or arch meets a stem.
        self.trap_style = 'wedge'
        self.trap_w = 20 if bold else 15
        self.trap_d = 0.58 if bold else 0.50
        self.trap_r = 0.30                     # dog-bone radius / stroke
        self.trap_wedge = 0.84 if bold else 0.70   # wedge run along the joining stroke / stroke
        # Operators share one horizontal extent inside the C60 cell.
        self.op_l = 86 if bold else 98
        self.eq_gap = 88 if bold else 102      # clear space between = bars
        # Phosphor dots.
        self.dot = 168 if bold else 108        # diameter
        self.dot_gap = 88 if bold else 96      # stem top to dot bottom (i, j)

    def radii(self, w, h, tv=None, th=None, f=None):
        """Outer radius and inner (rx, ry) for a ring in a w x h box."""
        tv = self.V if tv is None else tv
        th = self.H if th is None else th
        ro = (self.rf if f is None else f) * min(w, h)
        rxi = max(ro - tv * self.ci, self.rmin)
        ryi = max(ro - th * self.ci, self.rmin)
        return ro, (rxi, ryi)
