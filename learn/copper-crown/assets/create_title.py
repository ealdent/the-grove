"""Create the transparent opening title used in the Copper Crown film."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

SCALE = 2
image = Image.new('RGBA', (960 * SCALE, 540 * SCALE), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
serif = ImageFont.truetype('/System/Library/Fonts/Supplemental/Georgia.ttf', 35 * SCALE)
mono = ImageFont.truetype('/System/Library/Fonts/Supplemental/Courier New.ttf', 11 * SCALE)

def centered(text, y, font, fill):
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    draw.text(((960 * SCALE - (right - left)) / 2, y * SCALE), text, font=font, fill=fill)

centered('THE COPPER CROWN', 88, serif, (245, 231, 204, 255))
draw.line((387 * SCALE, 147 * SCALE, 573 * SCALE, 147 * SCALE), fill=(198, 158, 101, 200), width=SCALE)
centered('AN ILLUSTRATED DISTILLATION WORKSHOP', 162, mono, (219, 185, 136, 255))
image.resize((960, 540), Image.Resampling.LANCZOS).save(Path(__file__).with_name('copper-crown-title.png'))
