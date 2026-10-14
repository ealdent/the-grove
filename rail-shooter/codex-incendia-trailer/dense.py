# Dense contact sheet of the cut: python3 dense.py <video> <t0> <t1> <step_frames> <out>
import io, subprocess, sys
from PIL import Image, ImageDraw
v, t0, t1, step, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
W, H, cols = 240, 135, 8
p = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', f'{t0:.3f}', '-t', f'{t1 - t0:.3f}', '-i', v,
                    '-vf', f"select='not(mod(n\\,{step}))',scale={W}:{H}", '-fps_mode', 'vfr', '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True)
data = p.stdout; ims = []
while data:
    i = data.find(b'IEND') + 8; ims.append(Image.open(io.BytesIO(data[:i])).convert('RGB')); data = data[i:]
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W, rows * H))
for k, im in enumerate(ims):
    ImageDraw.Draw(im).text((3, H - 12), f'{t0 + k * step / 60:.2f}', fill=(255, 255, 0))
    sheet.paste(im, ((k % cols) * W, (k // cols) * H))
sheet.save(out, quality=85); print(out, len(ims))
