"""Compose store screenshots: a headline over a framed app capture, for every language.

  python3 scripts/store-shots.py <captures dir> [lang ...]

<captures dir>/<lang>/<shot>.png come from scripts/capture-shots.sh.
Captions come from assets/store/generic/listings/<lang>.json, in the order of SHOTS.
Output: build/store-out/<lang>/<set>/<prefix>-<n>-<shot>.png. build/ is not committed:
this script can always remake the images.
"""
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont

src = sys.argv[1]
only = sys.argv[2:]
LISTINGS = 'assets/store/generic/listings'
OUT = 'build/store-out'
OUTFIT = 'node_modules/@expo-google-fonts/outfit/600SemiBold/Outfit_600SemiBold.ttf'
# Outfit has only Latin letters (Turkish included); other scripts use a system font.
FONTS = {
    'ru': ('/System/Library/Fonts/HelveticaNeue.ttc', 1), 'kk': ('/System/Library/Fonts/HelveticaNeue.ttc', 1),
    'ja': ('/System/Library/Fonts/Hiragino Sans GB.ttc', 2),
    'zh': ('/System/Library/Fonts/Hiragino Sans GB.ttc', 2),
    'ko': ('/System/Library/Fonts/AppleSDGothicNeo.ttc', 6),
}
BG, INK, LINE = (11, 11, 13), (244, 244, 245), (48, 48, 54)
SHOTS = ['home', 'add', 'plan', 'event', 'activity', 'insights', 'accounts', 'themes']
# One set per store size. Everything is laid out on a 1080-wide design and scaled.
SETS = [('play', 'phone', 1080, 1920), ('appstore-6.9', 'iphone', 1320, 2868), ('appstore-6.5', 'iphone', 1284, 2778), ('appstore-6.3', 'iphone', 1206, 2622)]


def rounded(im, r):
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.size[0], im.size[1]], r, fill=255)
    im.putalpha(mask)
    return im


def fit_font(draw, text, path, index, size, max_w):
    """The largest size up to `size` at which every caption line fits the canvas."""
    while size > 30:
        font = ImageFont.truetype(path, size, index=index)
        if max(draw.textlength(line, font=font) for line in text.split('\n')) <= max_w:
            return font
        size -= 2
    return ImageFont.truetype(path, size, index=index)


langs = sorted(d for d in os.listdir(src) if os.path.isdir(f'{src}/{d}'))
if only:
    langs = [l for l in langs if l in only]
for lang in langs:
    captions = json.load(open(f'{LISTINGS}/{lang}.json'))['captions']
    path, index = FONTS.get(lang, (OUTFIT, 0))
    for set_name, prefix, W, H in SETS:
        out = f'{OUT}/{lang}/{set_name}'
        os.makedirs(out, exist_ok=True)
        k = W / 1080
        for i, (name, caption) in enumerate(zip(SHOTS, captions), 1):
            canvas = Image.new('RGB', (W, H), BG)
            d = ImageDraw.Draw(canvas)
            font = fit_font(d, caption, path, index, round(76 * k), W - round(96 * k))
            d.multiline_text((W / 2, 96 * k), caption, font=font, fill=INK, anchor='ma', align='center', spacing=14 * k)
            cap = Image.open(f'{src}/{lang}/{name}.png').convert('RGBA')
            w = round(880 * k)
            cap = cap.resize((w, round(cap.height * w / cap.width)), Image.LANCZOS)
            x, y = (W - w) // 2, round(380 * k)
            b = round(3 * k)
            d.rounded_rectangle([x - b, y - b, x + w + b, y + cap.height + b], round(75 * k), outline=LINE, width=b)
            canvas.paste(rounded(cap, round(72 * k)), (x, y), cap)
            canvas.save(f'{out}/{prefix}-{i}-{name}.png')
    print('composed', lang)
