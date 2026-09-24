#!/usr/bin/env python3
"""Validate the built Degauss fonts and kit with fontTools and HarfBuzz.

Checks the files a user downloads, not the generator's intentions: coverage,
the four width classes, Regular/Bold parity, metadata, outline direction,
TTF/OTF/WOFF/WOFF2 agreement, real ligature shaping, and kit integrity.
"""
from __future__ import annotations

import json
import zipfile
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.areaPen import AreaPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent
CLASSES = {300, 450, 600, 900}
EMPTY = {0x20, 0xA0, 0xAD, 0x2002, 0x2003, 0x2007, 0x2008, 0x2009, 0x202F}


def shape(path, text, calt=True):
    font = hb.Font(hb.Face(path.read_bytes()))
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, {'calt': calt})
    return buf.glyph_infos, buf.glyph_positions


def glyph_area(glyph_set, name):
    pen = AreaPen(glyph_set)
    glyph_set[name].draw(pen)
    return pen.value


def main():
    manifest = json.loads((ROOT / 'coverage.json').read_text())
    version = manifest['version']
    expected = {int(c['codepoint'][2:], 16): c for c in manifest['characters']}
    assert len(expected) == manifest['characterCount']
    grouped = ''.join(g['characters'] for g in manifest['groups'])
    assert len(grouped) == len(set(grouped)) == len(expected), 'groups must partition the coverage'
    assert set(range(32, 127)) <= expected.keys(), 'printable ASCII'
    assert set(range(0xA0, 0x180)) <= expected.keys(), 'Latin-1 Supplement and Latin Extended-A'
    assert set(range(0x2500, 0x25A0)) <= expected.keys(), 'box drawing and block elements'
    assert set(range(0x0410, 0x0450)) <= expected.keys(), 'Russian Cyrillic'
    assert set(range(0x03B1, 0x03CA)) <= expected.keys(), 'Greek lowercase'

    fonts = {}
    for family in manifest['families']:
        style = family['style']
        ttf = TTFont(ROOT / family['ttf'], checkChecksums=2)
        otf = TTFont(ROOT / family['otf'], checkChecksums=2)
        fonts[style] = ttf
        cmap = ttf.getBestCmap()
        assert cmap.keys() == expected.keys(), f'{style}: cmap differs from coverage.json'
        assert otf.getBestCmap() == cmap, f'{style}: OTF cmap differs'
        assert otf.getGlyphOrder() == ttf.getGlyphOrder(), f'{style}: OTF glyph order differs'
        assert otf['hmtx'].metrics.keys() == ttf['hmtx'].metrics.keys()
        for name in ttf.getGlyphOrder():
            assert otf['hmtx'][name][0] == ttf['hmtx'][name][0], (style, name, 'OTF advance')
        # Names, style linking and flags.
        name = ttf['name']
        assert name.getDebugName(1) == 'Degauss' and name.getDebugName(2) == style
        assert name.getDebugName(4) == f'Degauss {style}' and name.getDebugName(6) == f'Degauss-{style}'
        assert name.getDebugName(5) == f'Version {version}'
        assert name.getDebugName(3).startswith(version + ';')
        assert abs(ttf['head'].fontRevision - float(version)) < 1e-4
        assert ttf['head'].created == ttf['head'].modified == 3873052800, 'fixed timestamps'
        os2 = ttf['OS/2']
        bold = style == 'Bold'
        assert os2.usWeightClass == (700 if bold else 400)
        assert bool(os2.fsSelection & 0x20) == bold and bool(os2.fsSelection & 0x40) == (not bold)
        assert os2.fsSelection & 0x80, 'USE_TYPO_METRICS'
        assert bool(ttf['head'].macStyle & 1) == bold
        assert os2.fsType == 0, 'installable embedding'
        assert ttf['post'].isFixedPitch == 0, 'mixed-space, not monospaced'
        assert ttf['hhea'].ascent == os2.sTypoAscender == 930 and ttf['hhea'].descent == os2.sTypoDescender == -270
        # Width classes and outlines.
        gs = ttf.getGlyphSet()
        otf_gs = otf.getGlyphSet()
        y_max = y_min = 0
        for cp, gname in cmap.items():
            adv = ttf['hmtx'][gname][0]
            assert adv in CLASSES, (style, hex(cp), adv)
            width_name = expected[cp]['width']
            assert adv == int(width_name[1:]) * 10, (style, hex(cp), 'manifest width class')
            pen = BoundsPen(gs)
            gs[gname].draw(pen)
            if cp in EMPTY:
                continue
            assert pen.bounds, (style, hex(cp), 'empty outline')
            x0, y0, x1, y1 = pen.bounds
            y_max, y_min = max(y_max, y1), min(y_min, y0)
            assert -80 <= x0 and x1 <= adv + 80, (style, hex(cp), 'ink escapes its cell', pen.bounds)
            assert -300 <= y0 and y1 <= 990, (style, hex(cp), 'vertical overflow', pen.bounds)
            # TrueType outers run clockwise (negative area); CFF counter-clockwise.
            assert glyph_area(gs, gname) < 0, (style, hex(cp), 'TrueType winding')
            assert glyph_area(otf_gs, gname) > 0, (style, hex(cp), 'CFF winding')
        assert os2.usWinAscent >= y_max and os2.usWinDescent >= -y_min, 'win metrics clip no glyph'
        # Solid box drawing and blocks join between lines: they fill the line box
        # and bleed a hair past it, so neighbours overlap rather than seam.
        # (Dashed lines stop short by design so the dash rhythm tiles evenly.)
        for ch in '█│║┃▐':
            pen = BoundsPen(gs)
            gs[cmap[ord(ch)]].draw(pen)
            assert -300 <= pen.bounds[1] <= -270 and 930 <= pen.bounds[3] <= 960, (style, ch, pen.bounds)
        for ch in '█─═':
            pen = BoundsPen(gs)
            gs[cmap[ord(ch)]].draw(pen)
            assert -30 <= pen.bounds[0] <= 0 and 600 <= pen.bounds[2] <= 630, (style, ch, pen.bounds)
        # Signature details survive in the built outlines.
        zero = ttf['glyf'][cmap[ord('0')]]
        assert zero.numberOfContours == 3, (style, 'the power-off dot must float free of the zero')
        assert ttf['glyf'][cmap[ord('o')]].numberOfContours == 2
        for a, b in [('0', 'O'), ('1', 'l'), ('1', 'I'), ('l', 'I'), ('I', '|'), ('5', 'S'), ('2', 'Z'),
                     ('8', 'B'), ('ß', 'B'), (',', '.'), ("'", '`'), ('‘', '’'), ('δ', '6'), ('б', '6')]:
            ga, gb = ttf['glyf'][cmap[ord(a)]], ttf['glyf'][cmap[ord(b)]]
            assert ga.compile(ttf['glyf']) != gb.compile(ttf['glyf']), (style, 'confusable', a, b)
        # Web fonts are the same font.
        for key in ('woff2', 'woff'):
            web = TTFont(ROOT / family[key])
            assert web.getBestCmap() == cmap and web['hmtx'].metrics == ttf['hmtx'].metrics
            for tag in ('glyf', 'GSUB', 'name', 'OS/2'):
                assert web[tag].compile(web) == ttf[tag].compile(ttf), (style, key, tag)
        # Ligatures: calt swaps in spacers and one drawing; advances never change.
        path = ROOT / family['ttf']
        order = ttf.getGlyphOrder()
        for seq in manifest['ligatures']:
            off, poff = shape(path, seq, False)
            on, pon = shape(path, seq, True)
            want = [ttf['hmtx'][cmap[ord(c)]][0] for c in seq]
            assert [order[g.codepoint] for g in off] == [cmap[ord(c)] for c in seq], (style, seq, 'calt off')
            assert len(on) == len(seq), (style, seq, 'one glyph per character')
            assert [p.x_advance for p in pon] == want == [p.x_advance for p in poff], (style, seq, 'advances')
            names = [order[g.codepoint] for g in on]
            assert all(n.startswith('lig.C') for n in names[:-1]) and names[-1].endswith('.liga'), (style, seq, names)
        # Only whole operator runs ligate.
        for text in ['https://example.com', '=>>', '-->-', '<<=', '->>=', '====', '!!!', 'a::::b', 'cat <<-EOF']:
            names = [order[g.codepoint] for g in shape(path, text)[0]]
            assert not any(n.endswith('.liga') or n.startswith('lig.') for n in names), (style, text, names)
        names = [order[g.codepoint] for g in shape(path, 'x = 0xFF + 10x5')[0]]
        assert names.count('x.hex') == 1, (style, 'hex prefix x', names)
        # Code in many languages shapes with no missing glyphs and exact widths.
        samples = ['const f = (a, b) => a?.b ?? 0x0F;', 'fn main() -> Result<(), E> { x != y }',
                   'data |> Enum.map(&(&1 * 2)) |> IO.inspect()', 'if x <= 10 && y >= 2 || !z:',
                   'let xs = [1..10] >>= pure <$> f', 'SELECT * FROM t WHERE a <> b;', '<!-- x --> </a>',
                   'Grüße, Ærøskøbing, Łódź, Șoseaua, Ελληνικά, Кириллица, Україна', '┌─┬─┐ │▓│░│ └─┴─┘',
                   '⏵ ⏸ ⏹ ⏺ ⏏ ⏻ → ⇒ ≠ ≤ ∞ ∑ λ']
        for text in samples:
            infos, poss = shape(path, text)
            assert all(g.codepoint != 0 for g in infos), (style, text, 'missing glyph')
            want = sum(ttf['hmtx'][cmap[ord(c)]][0] for c in text)
            assert sum(p.x_advance for p in poss) == want, (style, text, 'total advance')
        print(f'PASS {family["ttf"]}/{family["otf"]}/woff2/woff: {len(cmap)} characters, '
              f'{len(manifest["ligatures"])} ligatures, width classes, winding, metadata, shaping')

    # Bold keeps Regular's advances: syntax bolding never reflows a line.
    reg, bold = fonts['Regular'], fonts['Bold']
    assert reg.getGlyphOrder() == bold.getGlyphOrder()
    for gname in reg.getGlyphOrder():
        assert reg['hmtx'][gname][0] == bold['hmtx'][gname][0], ('bold advance', gname)
    print('PASS Regular and Bold share every advance and glyph name')

    with zipfile.ZipFile(ROOT / 'Degauss-font-kit.zip') as kit:
        assert kit.testzip() is None
        for entry in kit.namelist():
            assert kit.read(entry) == (ROOT / Path(entry).name).read_bytes(), entry
        assert len(kit.namelist()) >= 20
    print('PASS kit archive integrity and byte parity with the folder')


if __name__ == '__main__':
    main()
