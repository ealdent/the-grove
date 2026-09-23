# Contact sheet of a captured clip: sheet.py <clip> [n=12] [cols=4]
import sys, os
from PIL import Image, ImageDraw
clip = sys.argv[1]; n = int(sys.argv[2]) if len(sys.argv) > 2 else 12; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
d = f'frames/{clip}'; files = sorted(os.listdir(d)); W, H = 480, 270
idx = [round(k * (len(files) - 1) / max(1, n - 1)) for k in range(n)]
rows = (n + cols - 1) // cols
S = Image.new('RGB', (cols * W, rows * H))
for k, i in enumerate(idx):
    im = Image.open(os.path.join(d, files[i])).resize((W, H), Image.BILINEAR)
    ImageDraw.Draw(im).text((6, 250), f'{i/60:.2f}s', fill=(255, 255, 0))
    S.paste(im, ((k % cols) * W, (k // cols) * H))
S.save(f'sheet_{clip}.jpg', quality=85); print(f'sheet_{clip}.jpg')
