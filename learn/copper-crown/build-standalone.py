#!/usr/bin/env python3
"""Embed the Copper Crown viewer and GLB in the learning page.

Requires esbuild 0.25.12 on PATH, or --esbuild /path/to/esbuild. The page
itself needs no build tools, network, module imports, or model file to render.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
PAGE = HERE.parent / 'copper-crown.html'
SOURCE = HERE / 'viewer.js'
MODEL = HERE / 'assets' / 'copper-crown.glb'
POSTER = HERE / 'assets' / 'copper-crown-poster.jpg'
THREE = HERE / 'vendor' / 'build' / 'three.module.js'
LICENSE = HERE / 'vendor' / 'LICENSE'
BEGIN = '<!-- BEGIN GENERATED COPPER CROWN VIEWER -->'
END = '<!-- END GENERATED COPPER CROWN VIEWER -->'


def read_embedded_model():
    data = MODEL.read_bytes()
    if len(data) < 20:
        raise ValueError('GLB is truncated')
    magic, version, length, json_length, json_kind = struct.unpack_from('<IIIII', data)
    if (magic, version, length, json_kind) != (0x46546C67, 2, len(data), 0x4E4F534A):
        raise ValueError('Invalid GLB header')
    gltf = json.loads(data[20:20 + json_length])
    for kind in ('buffers', 'images'):
        if any(item.get('uri') for item in gltf.get(kind, [])):
            raise ValueError(f'GLB has an external {kind} URI; the viewer must be self-contained')
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--esbuild', default='esbuild', help='path to esbuild 0.25.12')
    args = parser.parse_args()
    version = subprocess.check_output([args.esbuild, '--version'], text=True).strip()
    if version != '0.25.12':
        raise ValueError(f'Expected esbuild 0.25.12, found {version}')
    data = read_embedded_model()
    with tempfile.TemporaryDirectory(prefix='copper-viewer-') as directory:
        output = Path(directory) / 'viewer.js'
        subprocess.run([
            args.esbuild, str(SOURCE), '--bundle', '--format=iife', '--platform=browser',
            '--target=es2020', '--supported:template-literal=false', '--minify',
            '--legal-comments=none', '--charset=utf8',
            f'--alias:three={THREE}', f'--outfile={output}',
        ], check=True)
        bundle = output.read_text()
    bundle = re.sub(r'</script', r'<\\/script', bundle, flags=re.IGNORECASE)
    license_text = LICENSE.read_text().replace('*/', '* /')
    digest = hashlib.sha256(data).hexdigest()
    encoded = base64.b64encode(data).decode('ascii')
    generated = (f'{BEGIN}\n'
                 f'<script id="copper-crown-model" type="application/octet-stream" data-sha256="{digest}">{encoded}</script>\n'
                 f'<script>\n/*\n{license_text}\n*/\n{bundle}\n</script>\n{END}')
    html = PAGE.read_text()
    if html.count(BEGIN) != 1 or html.count(END) != 1:
        raise ValueError('Expected exactly one generated viewer section')
    poster = base64.b64encode(POSTER.read_bytes()).decode('ascii')
    html, count = re.subn(
        r'(<img class="viewer-poster" id="viewer-poster" src=")[^"]*(")',
        lambda match: match.group(1) + 'data:image/jpeg;base64,' + poster + match.group(2),
        html,
    )
    if count != 1:
        raise ValueError('Expected exactly one viewer poster')
    start, end = html.index(BEGIN), html.index(END) + len(END)
    PAGE.write_text(html[:start] + generated + html[end:])
    print(f'Embedded {len(data):,} model bytes (SHA-256 {digest}) and {len(bundle):,} JavaScript characters')


if __name__ == '__main__':
    main()
