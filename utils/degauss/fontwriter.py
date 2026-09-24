"""Turn Degauss shapes into TrueType (quadratic) and CFF (cubic) fonts."""
from __future__ import annotations

from fontTools.agl import UV2AGL
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.roundingPen import RoundingPen

from params import UPM, ASCENT, DESCENT


def glyph_name(ch: str) -> str:
    cp = ord(ch)
    if cp in UV2AGL:
        return UV2AGL[cp]
    return f'uni{cp:04X}' if cp <= 0xFFFF else f'u{cp:05X}'


def _ttglyph(shape):
    pen = TTGlyphPen(None)
    # Cu2Qu reverses contours: PostScript counter-clockwise outers become the
    # clockwise outers TrueType expects.
    shape.draw(RoundingPen(Cu2QuPen(pen, max_err=0.6, reverse_direction=True)))
    return pen.glyph()


def _charstring(shape, advance):
    pen = T2CharStringPen(advance, None)
    shape.draw(RoundingPen(pen))
    return pen.getCharString()


def _lsb(shape):
    if shape.empty:
        return 0
    pen = BoundsPen(None)
    shape.draw(RoundingPen(pen))
    return round(pen.bounds[0]) if pen.bounds else 0


def build(glyphs, cmap, *, cff=False, names=None, os2=None, post=None, fea=None,
          head=None, extra=None):
    """glyphs: ordered {name: (shape, advance)} starting with .notdef."""
    order = list(glyphs)
    fb = FontBuilder(UPM, isTTF=not cff)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    metrics = {}
    if cff:
        charstrings = {}
        for name in order:
            shape, adv = glyphs[name]
            charstrings[name] = _charstring(shape, adv)
            metrics[name] = (adv, _lsb(shape))
        ps = (names or {}).get('psName', 'Degauss')
        fb.setupCFF(ps, {'FullName': (names or {}).get('fullName', ps)}, charstrings, {})
    else:
        outlines = {}
        for name in order:
            shape, adv = glyphs[name]
            outlines[name] = _ttglyph(shape)
            metrics[name] = (adv, _lsb(shape))
        fb.setupGlyf(outlines)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=ASCENT, descent=DESCENT, lineGap=0)
    if names:
        fb.setupNameTable(names)
    fb.setupOS2(**(os2 or {}))
    fb.setupPost(**(post or {}))
    if not cff:
        fb.setupMaxp()
        # Unhinted outlines: ask Windows for greyscale, symmetric smoothing at every size.
        from fontTools.ttLib import newTable
        gasp = newTable('gasp')
        gasp.version = 1
        gasp.gaspRange = {0xFFFF: 0x0002 | 0x0008}
        fb.font['gasp'] = gasp
    if fea:
        from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
        addOpenTypeFeaturesFromString(fb.font, fea)
    if head:
        for key, value in head.items():
            setattr(fb.font['head'], key, value)
    if extra:
        extra(fb.font)
    return fb.font
