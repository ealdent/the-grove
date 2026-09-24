#!/usr/bin/env python3
"""Build the Degauss family: TTF, OTF (CFF), WOFF2, WOFF, manifest and kit.

No existing font is read. Every outline comes from the construction code in
this folder. Timestamps and ZIP entries are fixed, so a rebuild reproduces
the same files. See README.md for commands.
"""
from __future__ import annotations

import json
import unicodedata
import zipfile
from pathlib import Path


import fontwriter
from fontwriter import glyph_name
from geometry import rrect, ellipse
from params import Params, UPM, ASCENT, DESCENT, X_HEIGHT, CAP, C60, WIDTH_CLASSES
import glyphs as G
import symbols  # noqa: F401  (each module registers its glyphs on import)
import latin  # noqa: F401
import signs  # noqa: F401
import mathsym  # noqa: F401
import terminal  # noqa: F401
import greek  # noqa: F401
import cyrillic  # noqa: F401
import ligatures as LG

ROOT = Path(__file__).resolve().parent
VERSION = '1.000'
FAMILY = 'Degauss'
CREATED = 3873052800          # 2026-09-24 00:00 UTC in the OpenType epoch
ZIP_DATE = (2026, 9, 24, 0, 0, 0)
PUA_NAMES = {0xE0A0: 'POWERLINE BRANCH', 0xE0A1: 'POWERLINE LINE NUMBER', 0xE0A2: 'POWERLINE PADLOCK',
             0xE0B0: 'POWERLINE RIGHT SOLID SEPARATOR', 0xE0B1: 'POWERLINE RIGHT THIN SEPARATOR',
             0xE0B2: 'POWERLINE LEFT SOLID SEPARATOR', 0xE0B3: 'POWERLINE LEFT THIN SEPARATOR',
             0xE0B4: 'POWERLINE RIGHT ROUND SEPARATOR', 0xE0B5: 'POWERLINE RIGHT THIN ROUND SEPARATOR',
             0xE0B6: 'POWERLINE LEFT ROUND SEPARATOR', 0xE0B7: 'POWERLINE LEFT THIN ROUND SEPARATOR'}
EMPTY = {' ', '\u00a0', '\u2002', '\u2003', '\u2007', '\u2008', '\u2009', '\u202f'}


def notdef(p):
    """No signal: an empty picture tube with its power-off dot."""
    t = p.V * 0.9
    outer = rrect(70, 0, C60 - 70, CAP, 150, p.k)
    inner = rrect(70 + t, t, C60 - 70 - t, CAP - t, max(150 - t, 30), p.k)
    return (outer - inner) | ellipse(C60 / 2, CAP / 2, 46, 46)


def glyph_set(p):
    chars = sorted(G.GLYPHS, key=ord)
    shapes = {'.notdef': (notdef(p), C60)}
    cmap = {}
    for ch in chars:
        adv, fn = G.GLYPHS[ch]
        if adv not in WIDTH_CLASSES:
            raise ValueError(f'{ch!r} U+{ord(ch):04X} advance {adv} is not a width class')
        shape = fn(p)
        if shape.empty and ch not in EMPTY and ch != '\u00ad':
            raise ValueError(f'{ch!r} U+{ord(ch):04X} drew nothing')
        name = glyph_name(ch)
        if name in shapes:
            raise ValueError(f'duplicate glyph name {name}')
        shapes[name] = (shape, adv)
        cmap[ord(ch)] = name
    shapes.update(LG.glyph_shapes(p, glyph_name))
    return chars, shapes, cmap


def names(p):
    ps = f'{FAMILY}-{p.style}'
    return {
        'familyName': FAMILY, 'styleName': p.style,
        'uniqueFontIdentifier': f'{VERSION};JADA;{ps}',
        'fullName': f'{FAMILY} {p.style}', 'psName': ps, 'version': f'Version {VERSION}',
        'copyright': 'Copyright 2026 Jason Adams. Original Degauss font software.',
        'manufacturer': 'The Grove', 'designer': 'Jason Adams / The Grove',
        'description': ('Mixed-space typeface for screens that remember: every glyph is one of four '
                        'tape-length widths (C30, C45, C60, C90). Squircle picture-tube bowls, bloom '
                        'traps, phosphor dots and a power-off zero. Coding ligatures via calt.'),
        'licenseDescription': ('MIT License. Free to use, install, embed, modify and redistribute, '
                               'including commercially. Preserve the copyright and license notice.'),
        'licenseInfoURL': 'https://opensource.org/license/mit',
        'sampleText': 'DEGAUSS: four tape lengths, one signal. 0x0F |> decode() != noise',
    }


def build_weight(p):
    chars, shapes, cmap = glyph_set(p)
    order = list(shapes)
    fea = LG.feature_code(glyph_name, order)
    y_max = max(s.bounds[3] for s, _ in shapes.values() if not s.empty)
    y_min = min(s.bounds[1] for s, _ in shapes.values() if not s.empty)
    advances = [a for _, a in shapes.values() if a]
    os2 = dict(version=4, usWeightClass=p.weight, usWidthClass=5, fsType=0,
               fsSelection=(0x20 if p.bold else 0x40) | 0x80, achVendID='JADA',
               sTypoAscender=ASCENT, sTypoDescender=DESCENT, sTypoLineGap=0,
               usWinAscent=max(ASCENT, round(y_max)), usWinDescent=max(-DESCENT, round(-y_min)),
               sxHeight=X_HEIGHT, sCapHeight=CAP, xAvgCharWidth=round(sum(advances) / len(advances)),
               ySubscriptXSize=600, ySubscriptYSize=600, ySubscriptYOffset=150,
               ySuperscriptXSize=600, ySuperscriptYSize=600, ySuperscriptYOffset=390,
               yStrikeoutSize=round(p.H), yStrikeoutPosition=p.M,
               panose={'bFamilyType': 2, 'bSerifStyle': 11, 'bWeight': 8 if p.bold else 5, 'bProportion': 3,
                       'bContrast': 2, 'bStrokeVariation': 2, 'bArmStyle': 3, 'bLetterForm': 2,
                       'bMidline': 2, 'bXHeight': 4})
    post = dict(isFixedPitch=0, underlinePosition=-140, underlineThickness=round(p.H * 0.9))
    head = dict(created=CREATED, modified=CREATED, fontRevision=float(VERSION),
                macStyle=0x01 if p.bold else 0x00)

    def finish(font):
        font['OS/2'].recalcUnicodeRanges(font)
        font['OS/2'].recalcCodePageRanges(font)
        font.recalcTimestamp = False

    out = {}
    stem = f'{FAMILY}-{p.style}'
    for cff in (False, True):
        font = fontwriter.build(shapes, cmap, cff=cff, names=names(p), os2=os2, post=post, fea=fea,
                                head=head, extra=finish)
        path = ROOT / (stem + ('.otf' if cff else '.ttf'))
        font.save(path)
        out['otf' if cff else 'ttf'] = path
        if not cff:
            for flavor in ('woff2', 'woff'):
                font.flavor = flavor
                wpath = ROOT / f'{stem}.{flavor}'
                font.save(wpath)
                out[flavor] = wpath
    return chars, order, out


def group_of(ch):
    cp = ord(ch)
    selectors = [
        ('ascii', 'ASCII / code', lambda c: 32 <= c <= 126),
        ('latin', 'Latin accents & letters', lambda c: (0x00C0 <= c <= 0x024F and c not in (0x00D7, 0x00F7)) or c in (0x00AA, 0x00BA, 0x00B5)),
        ('greek', 'Greek', lambda c: 0x0370 <= c <= 0x03FF),
        ('cyrillic', 'Cyrillic', lambda c: 0x0400 <= c <= 0x04FF),
        ('arrows', 'Arrows', lambda c: 0x2190 <= c <= 0x21FF or 0x27F0 <= c <= 0x27FF),
        ('math', 'Math & logic', lambda c: 0x2200 <= c <= 0x22FF or c in (0x00AC, 0x00B1, 0x00D7, 0x00F7, 0x2308, 0x2309, 0x230A, 0x230B, 0x27E8, 0x27E9)),
        ('box', 'Box drawing', lambda c: 0x2500 <= c <= 0x257F),
        ('blocks', 'Blocks & shades', lambda c: 0x2580 <= c <= 0x259F),
        ('interface', 'Interface & transport', lambda c: 0x2300 <= c <= 0x23FF or 0x25A0 <= c <= 0x27BF or 0x2B00 <= c <= 0x2BFF or 0xE000 <= c <= 0xF8FF),
        ('punctuation', 'Punctuation, currency & signs', lambda c: True),
    ]
    for gid, label, test in selectors:
        if test(cp):
            return gid, label
    raise AssertionError


def manifest(chars):
    groups = {}
    for ch in chars:
        gid, label = group_of(ch)
        groups.setdefault(gid, {'id': gid, 'label': label, 'characters': ''})['characters'] += ch
    for g in groups.values():
        g['count'] = len(g['characters'])
    classes = {name: [] for name in WIDTH_CLASSES.values()}
    for ch in chars:
        classes[WIDTH_CLASSES[G.GLYPHS[ch][0]]].append(ch)
    seqs = sorted(LG.LIGATURES, key=lambda s: (len(s), s))
    return {
        'name': FAMILY, 'version': VERSION, 'unitsPerEm': UPM,
        'widthClasses': {name: {'advance': adv, 'count': len(classes[name]), 'characters': ''.join(classes[name])}
                         for adv, name in WIDTH_CLASSES.items()},
        'metrics': {'ascent': ASCENT, 'descent': DESCENT, 'lineGap': 0, 'capHeight': CAP, 'xHeight': X_HEIGHT},
        'characterCount': len(chars),
        'groups': list(groups.values()),
        'ligatures': seqs,
        'families': [{'style': s, 'weight': w, **{k: f'{FAMILY}-{s}.{k}' for k in ('ttf', 'otf', 'woff2', 'woff')}}
                     for s, w in (('Regular', 400), ('Bold', 700))],
        'characters': [{'character': c, 'codepoint': f'U+{ord(c):04X}', 'width': WIDTH_CLASSES[G.GLYPHS[c][0]],
                        'name': unicodedata.name(c, PUA_NAMES.get(ord(c), 'UNNAMED'))} for c in chars],
        'notes': [
            'Every advance is 300, 450, 600 or 900 units (C30, C45, C60, C90); Bold matches Regular exactly.',
            'Space, figure space and box drawing are C60, so trees and frames align on the C60 cell.',
            'Coding ligatures use calt with width-matched spacers; each source character keeps its glyph.',
            'Combining marks are not encoded separately; precomposed letters are covered.',
            'Glow, scanlines and burn-in are rendering effects in the web CSS, not part of the outlines.',
        ],
    }


KIT = ['Degauss-Regular.ttf', 'Degauss-Bold.ttf', 'Degauss-Regular.otf', 'Degauss-Bold.otf',
       'Degauss-Regular.woff2', 'Degauss-Bold.woff2', 'Degauss-Regular.woff', 'Degauss-Bold.woff',
       'degauss.css', 'LICENSE.txt', 'README.md', 'coverage.json', 'requirements.txt',
       'build.py', 'verify.py', 'fontwriter.py', 'geometry.py', 'params.py', 'glyphs.py', 'symbols.py',
       'latin.py', 'signs.py', 'mathsym.py', 'terminal.py', 'greek.py', 'cyrillic.py', 'ligatures.py']


def main():
    for bold in (False, True):
        p = Params(bold)
        chars, order, paths = build_weight(p)
        print(f'Built {p.style}: {len(chars)} characters, {len(order)} glyphs -> '
              + ', '.join(path.name for path in paths.values()))
    data = manifest(chars)
    (ROOT / 'coverage.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    with zipfile.ZipFile(ROOT / 'Degauss-font-kit.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as kit:
        for name in KIT:
            path = ROOT / name
            if not path.exists():
                raise FileNotFoundError(f'kit source missing: {path}')
            info = zipfile.ZipInfo(f'Degauss/{name}', date_time=ZIP_DATE)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            kit.writestr(info, path.read_bytes())
    print(f'Wrote coverage.json ({len(chars)} characters, {len(data["ligatures"])} ligatures) and Degauss-font-kit.zip')


if __name__ == '__main__':
    main()
