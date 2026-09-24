#!/usr/bin/env python3
"""Development proofs: build quick fonts and render PNG sheets with FreeType.

    python proof.py OUT.png "line one" "line two" [--size 140] [--weights rb]

Big lines get metric guides (descender, baseline, x-height, cap, ascender) and
width-class ticks under every glyph. Not part of the release build.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

import fontwriter
from geometry import rect
from params import Params, ASCENT, DESCENT, X_HEIGHT, CAP, ASC, DESC


OVERRIDES = {}
LONG = 16


def quick_font(bold: bool, out: Path):
    import glyphs as G
    import symbols  # noqa: F401  (registers punctuation and symbols)
    import latin  # noqa: F401
    import signs  # noqa: F401
    import mathsym  # noqa: F401
    import terminal  # noqa: F401
    import greek  # noqa: F401
    import cyrillic  # noqa: F401
    p = Params(bold)
    for key, value in OVERRIDES.items():
        setattr(p, key, value)
    shapes = {'.notdef': (rect(60, 0, 540, 700) - rect(120, 60, 480, 640), 600)}
    cmap = {}
    for ch, (adv, fn) in sorted(G.GLYPHS.items(), key=lambda kv: ord(kv[0])):
        name = fontwriter.glyph_name(ch)
        shapes[name] = (fn(p), adv)
        cmap[ord(ch)] = name
    font = fontwriter.build(shapes, cmap, names={'familyName': 'Degauss Proof', 'styleName': p.style,
                                                  'psName': f'DegaussProof-{p.style}'},
                            os2={'sTypoAscender': ASCENT, 'sTypoDescender': DESCENT, 'usWinAscent': ASCENT,
                                 'usWinDescent': -DESCENT, 'sxHeight': X_HEIGHT, 'sCapHeight': CAP})
    font.save(out)
    return out


def render(out, lines, size, weights, scratch, dark=False):
    fonts = {w: quick_font(w == 'b', scratch / f'proof-{w}.ttf') for w in weights}
    pad = 40
    bg, ink, guide = ((10, 18, 12), (200, 255, 170), (60, 90, 60)) if dark else ((246, 244, 236), (20, 24, 20), (200, 196, 180))
    rows = []
    for w in weights:
        for text in lines:
            big = size if len(text) <= LONG else max(36, size // 3)
            rows.append((w, text, big))
    scale = lambda s: s / 1000
    height = sum(int((ASCENT - DESCENT) * scale(s)) + 24 for _, _, s in rows) + 2 * pad
    width = 2400
    img = Image.new('RGB', (width, height), bg)
    draw = ImageDraw.Draw(img)
    y = pad
    for w, text, s in rows:
        font = ImageFont.truetype(str(fonts[w]), s)
        base = y + int(ASCENT * scale(s))
        if s >= 100:
            for level in (0, X_HEIGHT, CAP, ASC, DESC):
                yy = base - int(level * scale(s))
                draw.line([(pad, yy), (width - pad, yy)], fill=guide, width=1)
        x = pad
        for ch in text:
            draw.text((x, base), ch, font=font, fill=ink, anchor='ls')
            adv = font.getlength(ch)
            if s >= 100:
                draw.line([(x, base + 14), (x + adv - 3, base + 14)], fill=(214, 88, 44), width=3)
            x += adv
        y += int((ASCENT - DESCENT) * scale(s)) + 24
    img.save(out)
    print(f'wrote {out} ({width}x{height})')



def render_shaped(out, lines, size, weights, dark=True, compare=False):
    """Whole lines through HarfBuzz (libraqm) with the built release fonts."""
    root = Path(__file__).resolve().parent
    files = {'r': root / 'Degauss-Regular.ttf', 'b': root / 'Degauss-Bold.ttf'}
    bg, ink, dim = ((8, 20, 13), (190, 255, 160), (70, 110, 70)) if dark else ((246, 244, 236), (20, 24, 20), (150, 150, 140))
    rows = [(w, t, feat) for w in weights for t in lines for feat in ((['-calt'], ['calt']) if compare else (['calt'],))]
    lh = int(size * 1.45)
    img = Image.new('RGB', (2400, lh * len(rows) + 60), bg)
    draw = ImageDraw.Draw(img)
    y = 30
    for w, text, feat in rows:
        font = ImageFont.truetype(str(files[w]), size, layout_engine=ImageFont.Layout.RAQM)
        color = dim if compare and feat == ['-calt'] else ink
        draw.text((40, y + size), text, font=font, fill=color, anchor='ls', features=feat)
        y += lh
    img.save(out)
    print(f'wrote {out}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('lines', nargs='+')
    ap.add_argument('--size', type=int, default=160)
    ap.add_argument('--weights', default='r')
    ap.add_argument('--dark', action='store_true')
    ap.add_argument('--long', type=int, default=16, help='lines longer than this render small')
    ap.add_argument('--built', action='store_true', help='shape whole lines with the built fonts')
    ap.add_argument('--compare', action='store_true', help='with --built: each line without, then with calt')
    ap.add_argument('--set', action='append', default=[], help='override a Params field, key=value')
    args = ap.parse_args()
    for item in args.set:
        key, value = item.split('=', 1)
        try:
            value = float(value)
        except ValueError:
            pass
        OVERRIDES[key] = value
    LONG = args.long
    scratch = Path(args.out).resolve().parent
    if args.built:
        render_shaped(args.out, args.lines, args.size, list(args.weights), True, args.compare)
    else:
        render(args.out, args.lines, args.size, list(args.weights), scratch, args.dark)
