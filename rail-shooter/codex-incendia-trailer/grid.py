# Rows = clips, columns = frames every `step`: python3 grid.py out.jpg step clipA clipB ...
import os, sys
from PIL import Image, ImageDraw
out, step, clips = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
W, H = 256, 144
cols = max(len([f for f in os.listdir(f'frames/{c}') if f.endswith('.jpg') and int(f[2:7]) % step == 0]) for c in clips)
sheet = Image.new('RGB', (cols * W, len(clips) * H))
for r, c in enumerate(clips):
    fs = sorted(f for f in os.listdir(f'frames/{c}') if f.endswith('.jpg') and int(f[2:7]) % step == 0)
    for k, f in enumerate(fs):
        im = Image.open(f'frames/{c}/{f}').convert('RGB').resize((W, H), Image.LANCZOS)
        ImageDraw.Draw(im).text((4, H - 13), f'{c} {int(f[2:7])}', fill=(255, 255, 0))
        sheet.paste(im, (k * W, r * H))
sheet.save(out, quality=85); print(out)
