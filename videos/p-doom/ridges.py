#!/usr/bin/env python3
"""Cut stacked east-west ridge profiles out of the Mountain Land relief (utils/contours/index.html).

    python3 ridges.py [--preview]

Writes analysis/ridges.js: window.RIDGES = {lines, points, ...} with elevations as
uint8 (0 = zmin, 255 = zmax of the window). The DEM there is USGS 3DEP, stored
as gzip'd int16 rows of first differences.
"""
from __future__ import annotations

import base64
import gzip
import json
import re
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
SRC = HERE.parent.parent / 'utils' / 'contours' / 'index.html'
# The window: Black Mountains and the Great Craggies across to Roan and Grandfather.
WIN = dict(W=-83.05, E=-81.55, S=35.55, N=36.25)
LINES, POINTS = 44, 480


def load_dem():
    s = SRC.read_text()
    region = json.loads(re.search(r'window\.REGION=(\{.*?\});?\s*</script>', s, re.S).group(1))
    d16 = np.frombuffer(gzip.decompress(base64.b64decode(region['dem'])), dtype='<i2')
    w, h = region['w'], region['h']
    elev = np.cumsum(d16.reshape(h, w).astype(np.int64), axis=1).astype(np.float32)
    return region, elev


def main():
    region, elev = load_dem()
    b = region['bbox']
    h, w = elev.shape
    print(f"DEM {w}x{h}, {elev.min():.0f}..{elev.max():.0f} m (REGION says {region['zmin']:.0f}..{region['zmax']:.0f})")
    col = lambda lon: (lon - b['W']) / (b['E'] - b['W']) * (w - 1)
    row = lambda lat: (b['N'] - lat) / (b['N'] - b['S']) * (h - 1)
    lats = np.linspace(WIN['N'], WIN['S'], LINES)
    cols = np.linspace(col(WIN['W']), col(WIN['E']), POINTS)
    prof = []
    for lat in lats:
        r = row(lat)
        r0, fr = int(np.floor(r)), r - np.floor(r)
        line = (1 - fr) * elev[r0] + fr * elev[min(h - 1, r0 + 1)]
        prof.append(np.interp(cols, np.arange(w), line))
    P = np.array(prof)
    lo, hi = float(P.min()), float(P.max())
    q = np.clip(np.round((P - lo) / (hi - lo) * 255), 0, 255).astype(np.uint8)
    out = HERE / 'analysis' / 'ridges.js'
    out.parent.mkdir(exist_ok=True)
    out.write_text('window.RIDGES = ' + json.dumps({
        'lines': LINES, 'points': POINTS, 'zmin': round(lo), 'zmax': round(hi), 'window': WIN,
        'data': base64.b64encode(q.tobytes()).decode()}) + ';\n')
    print(f'{LINES} lines x {POINTS} points, {lo:.0f}..{hi:.0f} m -> {out.relative_to(HERE)}')
    if '--preview' in sys.argv:
        from PIL import Image, ImageDraw
        img = Image.new('RGB', (1440, 1000), (10, 8, 6))
        d = ImageDraw.Draw(img)
        for i in range(LINES):
            y0 = 180 + i * 17
            pts = [(40 + x * 1360 / (POINTS - 1), y0 - q[i, x] / 255 * 260) for x in range(POINTS)]
            d.polygon(pts + [(1400, 1000), (40, 1000)], fill=(10, 8, 6))
            d.line(pts, fill=(255, 180, 71), width=2)
        img.save(HERE / 'analysis' / 'ridges-preview.png')


if __name__ == '__main__':
    main()
