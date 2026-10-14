# Contact sheet of a captured take: python3 sheet.py <clip> [step] [cols] [width]
import os, sys
from PIL import Image, ImageDraw
clip = sys.argv[1]; step = int(sys.argv[2]) if len(sys.argv) > 2 else 15
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4; W = int(sys.argv[4]) if len(sys.argv) > 4 else 480
fs = sorted(f for f in os.listdir(f'frames/{clip}') if f.endswith('.jpg'))
fs = [f for f in fs if int(f[2:7]) % step == 0]
H = W * 9 // 16; rows = (len(fs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W, rows * H))
for k, f in enumerate(fs):
    im = Image.open(f'frames/{clip}/{f}').convert('RGB').resize((W, H), Image.LANCZOS)
    ImageDraw.Draw(im).text((6, H - 16), f'{clip} {int(f[2:7])}', fill=(255, 255, 0))
    sheet.paste(im, ((k % cols) * W, (k // cols) * H))
os.makedirs('out', exist_ok=True)
sheet.save(f'out/sheet_{clip}.jpg', quality=88); print(f'out/sheet_{clip}.jpg', len(fs), 'frames')
