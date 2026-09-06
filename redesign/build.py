#!/usr/bin/env python3
"""Render the three hub mockups from redesign/src/*.html + manifest.json.

Two flavours of each page are written:
  repo      -> redesign/<name>.html   (links ../, thumbs as files in redesign/thumbs/)
  artifact  -> <out-dir>/<name>.html  (absolute links to the live site, thumbs inlined)
Thumbnails: any PNG in --png-dir named after a work's path (slashes -> "__") is
converted once to a 480px JPEG at redesign/thumbs/<id>.jpg.
"""
import argparse, base64, io, json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RD = os.path.join(ROOT, 'redesign')
LIVE = 'https://ealdent.github.io/the-grove/'

ap = argparse.ArgumentParser()
ap.add_argument('--png-dir', default='')
ap.add_argument('--out-dir', default='')
args = ap.parse_args()

M = json.load(open(os.path.join(RD, 'manifest.json'), encoding='utf-8'))

if args.png_dir:
    from PIL import Image
    n = 0
    for w in M['works']:
        src = os.path.join(args.png_dir, w['path'].replace('/', '_').replace('.html', '') + '.png')
        dst = os.path.join(RD, 'thumbs', w['id'] + '.jpg')
        if os.path.exists(src) and not os.path.exists(dst):
            try:
                im = Image.open(src).convert('RGB')
                im.thumbnail((480, 480))
                im.save(dst, 'JPEG', quality=74, optimize=True, progressive=True)
                n += 1
            except Exception as e:  # a truncated capture is not worth stopping the build
                print('skip', src, e, file=sys.stderr)
    print(f'converted {n} thumbnails')

thumbs_file, thumbs_data = {}, {}
for w in M['works']:
    p = os.path.join(RD, 'thumbs', w['id'] + '.jpg')
    if os.path.exists(p):
        thumbs_file[w['id']] = 'thumbs/' + w['id'] + '.jpg'
        thumbs_data[w['id']] = 'data:image/jpeg;base64,' + base64.b64encode(open(p, 'rb').read()).decode()
print(f'{len(thumbs_file)} of {len(M["works"])} works have a thumbnail')

manifest_json = json.dumps(M, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')

def render(src, thumbs, site):
    return (src.replace('__MANIFEST_JSON__', manifest_json)
               .replace('__THUMBS_JSON__', json.dumps(thumbs))
               .replace('__SITE_BASE__', site))

for name in sorted(os.listdir(os.path.join(RD, 'src'))):
    if not name.endswith('.html'): continue
    src = open(os.path.join(RD, 'src', name), encoding='utf-8').read()
    out = os.path.join(RD, name)
    open(out, 'w', encoding='utf-8').write(render(src, thumbs_file, '../'))
    print('wrote', os.path.relpath(out, ROOT), f'{os.path.getsize(out)//1024} KB')
    if args.out_dir:
        os.makedirs(args.out_dir, exist_ok=True)
        out = os.path.join(args.out_dir, name)
        open(out, 'w', encoding='utf-8').write(render(src, thumbs_data, LIVE))
        print('wrote', out, f'{os.path.getsize(out)//1024} KB')
