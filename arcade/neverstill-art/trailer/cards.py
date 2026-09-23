# Title cards for the trailer, drawn with Neverstill's own 5x7 pixel font (parsed from the game) and the same
# gradient/extrusion/slant treatment as the in-game NEVERSTILL logo. Writes 1920x1080 PNGs into cards/.
import re, os, sys
from PIL import Image, ImageDraw, ImageFilter

GAME = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'neverstill.html')
src = open(GAME, encoding='utf-8').read()
block = src[src.index('const FONT_SRC = {'):src.index('};', src.index('const FONT_SRC = {'))]
FONT = {}
for m in re.finditer(r"""(?:'([^']+)'|"([^"]+)"|([A-Z]))\s*:\s*'([0-9A-F]{14})'""", block):
    ch = m.group(1) or m.group(2) or m.group(3)
    FONT[ch] = [int(m.group(4)[r * 2:r * 2 + 2], 16) for r in range(7)]
assert 'A' in FONT and '.' in FONT and '/' in FONT, 'font parse failed'

W, H = 1920, 1080
GRAD = ['#fffbd4', '#ffe66a', '#ffc23a', '#ff8a2a', '#ff4a5a', '#e02a90', '#9a2ab8']
os.makedirs('cards', exist_ok=True)


def logo_text(text, sc, grad=GRAD, sl=0.32):
    """The game's logoCanvas() for any text: per-row gradient, dark extrusion, outline, top highlight."""
    gw, depth = 6 * sc, max(2, sc)
    ow = max(1, sc // 5)
    w = int(len(text) * gw + 7 * sc * sl + depth + 6 + ow * 2)
    h = 7 * sc + depth + 6 + ow * 2
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    px = []
    for i, ch in enumerate(text):
        rows = FONT.get(ch, FONT.get(ch.upper(), FONT['?']))
        for r in range(7):
            for b in range(5):
                if (rows[r] >> (4 - b)) & 1:
                    px.append((3 + ow + i * gw + b * sc + (6 - r) * sc * sl, 3 + ow + r * sc, r))
    for dd in range(depth, 0, -1):
        col = '#12001e' if dd == depth else '#3a0a52'
        for x, y, r in px: d.rectangle([round(x + dd), round(y + dd), round(x + dd) + sc, round(y + dd) + sc - 1], fill=col)
    for x, y, r in px: d.rectangle([round(x - ow), round(y - ow), round(x) + sc + ow, round(y) + sc - 1 + ow], fill='#12001e')
    for x, y, r in px: d.rectangle([round(x), round(y), round(x) + sc, round(y) + sc - 1], fill=grad[r])
    for x, y, r in px:
        if r == 0: d.rectangle([round(x), round(y), round(x) + sc, round(y) + max(1, sc // 6) - 1], fill=(255, 255, 255, 205))
    return im


def pixel_text(text, sc, color, shadow='#0a0414', outline=True):
    """In-game HUD text: 5x7 glyphs on a 6-px pitch, drop shadow offset by one pixel, optional outline."""
    w, h = len(text) * 6 * sc - sc + 4 * sc, 7 * sc + 4 * sc
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    def draw(col, ox, oy):
        for i, ch in enumerate(text):
            rows = FONT.get(ch, FONT.get(ch.upper(), FONT['?']))
            for r in range(7):
                for b in range(5):
                    if (rows[r] >> (4 - b)) & 1:
                        x, y = sc + ox + (i * 6 + b) * sc, sc + oy + r * sc
                        d.rectangle([x, y, x + sc - 1, y + sc - 1], fill=col)
    if outline:
        for ox, oy in ((-sc // 2, 0), (sc // 2, 0), (0, -sc // 2), (0, sc // 2)): draw(shadow, ox, oy)
    draw(shadow, sc, sc)
    draw(color, 0, 0)
    return im


def glow(im, radius, alpha=0.55):
    g = im.filter(ImageFilter.GaussianBlur(radius)); a = g.split()[3].point(lambda v: int(v * alpha)); g.putalpha(a); return g


def canvas():
    return Image.new('RGBA', (W, H), (0, 0, 0, 0))


def place(c, im, cx, cy, glow_r=0):
    x, y = cx - im.width // 2, cy - im.height // 2
    if glow_r: c.alpha_composite(glow(im, glow_r), (x, y))
    c.alpha_composite(im, (x, y))


def scanlines(im, alpha=46, period=4):
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for y in range(0, im.height, period): d.line([(0, y + period - 1), (im.width, y + period - 1)], fill=(0, 0, 0, alpha))
    out = im.copy(); out.alpha_composite(ov); return out


def keyart_bg(dark=0.0):
    ka = Image.open('art/keyart.png').convert('RGBA').resize((1920, 1076), Image.NEAREST)
    bg = Image.new('RGBA', (W, H), (8, 2, 16, 255)); bg.alpha_composite(ka, (0, 2))
    if dark: bg.alpha_composite(Image.new('RGBA', (W, H), (10, 3, 22, int(255 * dark))))
    return bg


def vgrad(top_alpha, h, color=(10, 3, 22)):
    g = Image.new('RGBA', (W, h), (0, 0, 0, 0)); d = ImageDraw.Draw(g)
    for y in range(h): d.line([(0, y), (W, y)], fill=color + (int(top_alpha * (1 - y / h) ** 1.4),))
    return g


# --- title: key art, darkened at the top for the logo --------------------------------------------------
bg = keyart_bg(); bg.alpha_composite(vgrad(215, 520)); bg.save('cards/title_bg_ns.png'); scanlines(bg).save('cards/title_bg.png')
scanlines(Image.new('RGBA', (W, H), (0, 0, 0, 0)), alpha=46).save('cards/scan.png')
c = canvas(); place(c, logo_text('NEVERSTILL', 24), W // 2, 205, glow_r=18); c.save('cards/title_logo.png')
c = canvas(); place(c, pixel_text('YOU NEVER STOP MOVING', 7, '#7ff7ff'), W // 2, 385, glow_r=8); c.save('cards/title_tag.png')

# --- tagline cards (logo style), upper third so the rocket and the game's own banners stay clear ------------
for name, text in [('norails', 'NO RAILS.'), ('nobrakes', 'NO BRAKES.'), ('neverstop', 'NEVER STOP.'), ('chain', 'CHAIN YOUR KILLS.')]:
    c = canvas(); place(c, logo_text(text, 17 if len(text) < 12 else 13), W // 2, 232, glow_r=14); c.save(f'cards/{name}.png')
    # a pure-white copy for the one-frame flash when a card lands
    wim = logo_text(text, 17 if len(text) < 12 else 13, grad=['#ffffff'] * 7)
    c = canvas(); place(c, wim, W // 2, 232, glow_r=20); c.save(f'cards/{name}_flash.png')

# --- end card ---------------------------------------------------------------------------------------------
bg = keyart_bg(dark=0.62)
place(bg, logo_text('NEVERSTILL', 26), W // 2, 300, glow_r=22)
place(bg, pixel_text('YOU NEVER STOP MOVING', 7, '#7ff7ff'), W // 2, 470, glow_r=8)
place(bg, pixel_text('PLAY FREE IN YOUR BROWSER', 9, '#ffe14a'), W // 2, 640, glow_r=10)
place(bg, pixel_text('KEYBOARD - GAMEPAD - TOUCH', 5, '#ffffff'), W // 2, 760)
place(bg, pixel_text('EALDENT.GITHUB.IO/THE-GROVE/ARCADE/NEVERSTILL.HTML', 5, '#ff7ae0'), W // 2, 880, glow_r=7)
scanlines(bg).save('cards/endcard.png')
print('cards written:', sorted(os.listdir('cards')))
