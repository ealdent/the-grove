"""Degauss coding ligatures.

Contextual alternates (calt) with width-matched spacers. For a sequence of n
characters, the first n-1 become empty spacers with the same width class as
the character they replace, and the last becomes a glyph that draws the whole
ligature leftwards across its neighbours. Every source character keeps its own
glyph and advance, so carets, selections and copy/paste behave exactly as
with ligatures off. A mixed-space font needs only four spacers: C30, C45,
C60 and C90.

Ligatures apply only to whole runs of operator characters: `->` joins, but
`-->-` and `://` stay as written unless the full run is itself a ligature.
"""
from __future__ import annotations

from geometry import Shape, union, rect, beam
from glyphs import GLYPHS
import symbols as S
from params import C30, C45, C60, C90, WIDTH_CLASSES

LIGATURES: dict[str, object] = {}
OPERATORS = set('<>=-|!~:.+*/\\&?%^#$@_')


def lig(*sequences):
    def register(fn):
        for seq in sequences:
            LIGATURES[seq] = fn
        return fn
    return register


def adv(ch):
    return GLYPHS[ch][0]


def total(seq):
    return sum(adv(c) for c in seq)


def offset(seq, i):
    return sum(adv(c) for c in seq[:i])


def part(p, seq, i, dx=0, dy=0):
    return GLYPHS[seq[i]][1](p).move(offset(seq, i) + dx, dy)


def packed(p, seq, gap, shifts=None):
    """Components packed ink-to-ink with `gap`, centred in the sequence width."""
    shapes = [GLYPHS[c][1](p) for c in seq]
    boxes = [s.bounds for s in shapes]
    width = sum(b[2] - b[0] for b in boxes) + gap * (len(seq) - 1)
    x = (total(seq) - width) / 2
    out = []
    for i, (s, b) in enumerate(zip(shapes, boxes)):
        extra = shifts[i] if shifts else 0
        out.append(s.move(x - b[0] + extra, 0))
        x += b[2] - b[0] + gap
    return union(*out)


# --- arrows --------------------------------------------------------------------------------

def _heads(p):
    x0, x1 = S.opx(p)
    tip_in = x0 + 6                     # nose inset from the cell edge, as in < and >
    tail_in = x1 - 6
    hh = (x1 - x0) / 2 * 0.98
    return tip_in, tail_in, hh


def right_head(p, cell_start, hh=None):
    tip_in, tail_in, h = _heads(p)
    return S.chevron(p, cell_start + C60 - tip_in, cell_start + C60 - tail_in, p.M, hh or h)


def left_head(p, cell_start, hh=None):
    tip_in, tail_in, h = _heads(p)
    return S.chevron(p, cell_start + tip_in, cell_start + tail_in, p.M, hh or h)


def _arrow_ends(p, seq):
    x0, _ = S.opx(p)
    tip_in = _heads(p)[0]
    left = seq[0] == '<'
    right = seq[-1] == '>'
    start = tip_in if left else x0
    end = total(seq) - (tip_in if right else x0)
    return left, right, start, end


@lig('->', '-->', '<-', '<--', '<->', '->>')
def single_arrow(p, seq):
    left, right, start, end = _arrow_ends(p, seq)
    W = total(seq)
    shapes = [rect(start + (p.T * 0.4 if left else 0), p.M - p.H / 2, end - (p.T * 0.4 if right else 0), p.M + p.H / 2)]
    if right:
        shapes.append(right_head(p, W - C60))
        if seq.endswith('>>'):
            shapes.append(right_head(p, W - 2 * C60))
    if left:
        shapes.append(left_head(p, 0))
    return union(*shapes)


@lig('=>', '==>', '<==', '<=>', '<==>')
def double_arrow(p, seq):
    left, right, start, end = _arrow_ends(p, seq)
    W = total(seq)
    tip_in, tail_in, hh = _heads(p)
    o = p.eq_gap / 2 + p.H / 2
    # A rail stops on the arm's centre line, hidden in the head.
    stop = (tail_in - tip_in) * (o / hh)
    x_a = start + (stop if left else 0)
    x_b = end - (stop if right else 0)
    rails = rect(x_a, p.M + o - p.H / 2, x_b, p.M + o + p.H / 2) | rect(x_a, p.M - o - p.H / 2, x_b, p.M - o + p.H / 2)
    shapes = [rails]
    if right:
        shapes.append(right_head(p, W - C60))
    if left:
        shapes.append(left_head(p, 0))
    return union(*shapes)


@lig('~>', '<~')
def squiggle_arrow(p, seq):
    W = total(seq)
    x0, _ = S.opx(p)
    tip_in = _heads(p)[0]
    if seq == '~>':
        wave = S.tilde_shape(p, x0, 700, p.M, 70)
        shaft = rect(700 - p.V, p.M - p.H / 2, W - tip_in - p.T * 0.4, p.M + p.H / 2)
        return wave | shaft | right_head(p, W - C60)
    return squiggle_arrow(p, '~>').mirror(W / 2)


def _pipe_triangle(p, bar_x, tip_x, hh):
    t = p.T
    arms = S.chevron(p, tip_x, bar_x, p.M, hh, t)
    reach = hh + t * 0.62
    return arms | rect(bar_x - p.V / 2, p.M - reach, bar_x + p.V / 2, p.M + reach)


@lig('|>')
def pipe_right(p, seq):
    W = total(seq)
    return _pipe_triangle(p, C30 / 2, W - _heads(p)[0], 226)


@lig('<|')
def pipe_left(p, seq):
    return pipe_right(p, '|>').mirror(total(seq) / 2)


@lig('<|>')
def pipe_both(p, seq):
    W = total(seq)
    mid = C60 + C30 / 2
    tip = _heads(p)[0]
    return _pipe_triangle(p, mid, W - tip, 226) | _pipe_triangle(p, mid, tip, 226)


# --- equality and comparison -------------------------------------------------------------------

def long_bars(p, x0, x1, count=2):
    if count == 2:
        o = p.eq_gap / 2 + p.H / 2
        offsets = (-o, o)
    else:
        g = p.eq_gap * 0.62 + p.H
        offsets = (-g, 0, g)
    return union(*[rect(x0, p.M + k - p.H / 2, x1, p.M + k + p.H / 2) for k in offsets])


def strike(p, cx, h=290):
    return beam(cx - 150, p.M - h, cx + 150, p.M + h, p.V * 0.92)


@lig('==')
def eq2(p, seq):
    x0, _ = S.opx(p)
    return long_bars(p, x0, total(seq) - x0)


@lig('===')
def eq3(p, seq):
    x0, _ = S.opx(p)
    return long_bars(p, x0, total(seq) - x0, 3)


@lig('!=')
def neq(p, seq):
    W = total(seq)
    return long_bars(p, 70, W - S.opx(p)[0]) | strike(p, W / 2)


@lig('!==')
def neq3(p, seq):
    W = total(seq)
    return long_bars(p, 70, W - S.opx(p)[0], 3) | strike(p, W / 2, 330)


@lig('=/=')
def erlang_neq(p, seq):
    W = total(seq)
    x0 = S.opx(p)[0]
    return long_bars(p, x0, W - x0) | strike(p, W / 2)


def _le(p, W):
    x0, x1 = 150, W - 150
    hh = 190
    cy = p.M + 64
    return S.chevron(p, x0, x1, cy, hh) | rect(x0, p.M - 196 - p.H / 2, x1, p.M - 196 + p.H / 2)


@lig('<=')
def less_equal(p, seq):
    return _le(p, total(seq))


@lig('>=')
def greater_equal(p, seq):
    W = total(seq)
    return _le(p, W).mirror(W / 2)


@lig('<>')
def diamond(p, seq):
    W = total(seq)
    tip_in, _, hh = _heads(p)
    return S.chevron(p, tip_in, W / 2, p.M, hh) | S.chevron(p, W - tip_in, W / 2, p.M, hh)


# --- assignment, scope, ranges -------------------------------------------------------------------

def _axis_colon(p, cx):
    """A colon whose dots line up with the rails of = (for := and ::=)."""
    d = p.dot * 0.92
    o = p.eq_gap / 2 + p.H / 2
    from geometry import circle
    return circle(cx, p.M + o, d / 2) | circle(cx, p.M - o, d / 2)


@lig(':=')
def walrus(p, seq):
    W = total(seq)
    x1 = W - S.opx(p)[0]
    return _axis_colon(p, 190) | long_bars(p, 300, x1)


@lig('::=')
def bnf(p, seq):
    W = total(seq)
    x1 = W - S.opx(p)[0]
    return _axis_colon(p, 170) | _axis_colon(p, 400) | long_bars(p, 530, x1)


@lig('::', ':::')
def scope(p, seq):
    return packed(p, seq, 70 if not p.bold else 60)


@lig('..')
def range2(p, seq):
    return packed(p, seq, 76)


@lig('..=', '..<')
def range_incl(p, seq):
    dots = packed(p, '..', 64).move(40, 0)
    last = GLYPHS[seq[2]][1](p).move(C30 * 2 - 30, 0)
    return dots | last


@lig('?.', '?:', '??')
def questions(p, seq):
    return packed(p, seq, 36 if seq != '??' else 50)


@lig('&&', '||', '!!')
def doubles(p, seq):
    gap = {'&&': 20, '||': 64, '!!': 56}[seq]
    return packed(p, seq, gap if not p.bold else gap * 0.8)


@lig('++', '+++')
def pluses(p, seq):
    return packed(p, seq, -1)


@lig('--', '---')
def dashes(p, seq):
    x0, _ = S.opx(p)
    return rect(x0, p.M - p.H / 2, total(seq) - x0, p.M + p.H / 2)


@lig('**', '***')
def stars(p, seq):
    return packed(p, seq, 14)


@lig('//', '///')
def slashes(p, seq):
    return packed(p, seq, -150 if not p.bold else -120)


@lig('/*', '*/')
def comment(p, seq):
    return packed(p, seq, -30)


@lig('<<', '>>', '<<<', '>>>')
def chevrons(p, seq):
    return packed(p, seq, -130 if not p.bold else -110)


@lig('>>=')
def bind(p, seq):
    W = total(seq)
    x0 = S.opx(p)[0]
    chev = packed(p, '>>', -130 if not p.bold else -110).move(-40, 0)
    tip = chev.bounds[2]
    return chev | long_bars(p, tip - p.T * 0.9, W - x0)


@lig('=<<')
def rbind(p, seq):
    W = total(seq)
    return bind(p, '>>=').mirror(W / 2)


@lig('<$>', '<*>', '<+>')
def applicative(p, seq):
    return packed(p, seq, 28)


# --- markup ------------------------------------------------------------------------------------

@lig('</')
def close_tag(p, seq):
    return part(p, seq, 0) | part(p, seq, 1, dx=-110)


@lig('/>')
def self_close(p, seq):
    return part(p, seq, 0, dx=110) | part(p, seq, 1)


@lig('</>')
def fragment(p, seq):
    return part(p, seq, 0, dx=60) | part(p, seq, 1) | part(p, seq, 2, dx=-60)


@lig('<!--')
def html_comment(p, seq):
    W = total(seq)
    x0 = S.opx(p)[0]
    return part(p, seq, 0) | part(p, seq, 1, dx=-40) | rect(C60 + C30 + 30, p.M - p.H / 2, W - x0, p.M + p.H / 2)


# --- names and feature code ----------------------------------------------------------------------

def spacer_name(width):
    return f'lig.{WIDTH_CLASSES[width]}'


def liga_name(seq, glyph_name):
    return '_'.join(glyph_name(c) for c in seq) + '.liga'


def glyph_shapes(p, glyph_name):
    """{name: (shape, advance)} for spacers, ligature glyphs and the hex x."""
    out = {spacer_name(w): (Shape(), w) for w in (C30, C45, C60, C90)}
    for seq, fn in LIGATURES.items():
        W = total(seq)
        last = adv(seq[-1])
        out[liga_name(seq, glyph_name)] = (fn(p, seq).move(-(W - last), 0), last)
    x = GLYPHS['x'][1](p)
    out['x.hex'] = (x.scale(0.74, 0.74, C60 / 2, 0).move(0, round(p.C / 2 - p.X * 0.74 / 2)), C60)
    return out


def feature_code(glyph_name, all_glyph_names):
    """calt: longest sequences first; only whole operator runs ligate."""
    ops = sorted({glyph_name(c) for c in OPERATORS if c in GLYPHS})
    extra = [n for n in all_glyph_names if n.startswith('lig.') or n.endswith('.liga')]
    hexd = [glyph_name(c) for c in '0123456789ABCDEFabcdef']
    alnum = [glyph_name(c) for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789']
    lines = ['languagesystem DFLT dflt;', 'languagesystem latn dflt;', 'languagesystem grek dflt;',
             'languagesystem cyrl dflt;', '',
             f'@OPS = [{" ".join(ops + extra)}];',
             f'@HEX = [{" ".join(hexd)}];',
             f'@ALNUM = [{" ".join(alnum)}];', '',
             'feature calt {']
    lines += ['  lookup hex_x {', f'    ignore sub @ALNUM {glyph_name("0")} {glyph_name("x")}\';',
              f'    sub {glyph_name("0")} {glyph_name("x")}\' @HEX by x.hex;', '  } hex_x;']
    for seq in sorted(LIGATURES, key=lambda s: (-len(s), s)):
        names = [glyph_name(c) for c in seq]
        spacers = [spacer_name(adv(c)) for c in seq]
        tag = 'l_' + '_'.join(names)
        lines.append(f'  lookup {tag} {{')
        lines.append(f"    ignore sub @OPS {names[0]}' {' '.join(names[1:])};")
        lines.append(f"    ignore sub {names[0]}' {' '.join(names[1:])} @OPS;")
        n = len(seq)
        lines.append(f"    sub {' '.join(spacers[:n - 1])} {names[-1]}' by {liga_name(seq, glyph_name)};")
        for k in range(n - 2, -1, -1):
            back = ' '.join(spacers[:k])
            ahead = ' '.join(names[k + 1:])
            lines.append(f"    sub {back + ' ' if back else ''}{names[k]}' {ahead} by {spacers[k]};")
        lines.append(f'  }} {tag};')
    lines.append('} calt;')
    return '\n'.join(lines) + '\n'
