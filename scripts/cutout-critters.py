# python3 scripts/cutout-critters.py [style]   (needs Pillow: pip install pillow)
# Turns Muse Image critters (on a plain white/cream background) into transparent cutouts the Hangout can
# place in its scene. Reads public/seed/critters/<style>/*.webp (default style: soft), writes
# public/seed/critters/art/<id>.webp: background removed from the edges inward, cropped to the character,
# bottom-aligned on a square canvas so every critter's feet sit on the same line.
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

STYLE = sys.argv[1] if len(sys.argv) > 1 else "soft"
SRC = Path("public/seed/critters") / STYLE
OUT = Path("public/seed/critters/art")
SIZE = 512
KEY = (255, 0, 255)
# How far from the background color still counts as background. Higher clears the soft floor shadow;
# pale critters need a gentler value or the cut eats into them.
THRESH = 60
THRESH_FOR = {"alex": 24}

OUT.mkdir(parents=True, exist_ok=True)
for src in sorted(SRC.glob("*.webp")):
    rgb = Image.open(src).convert("RGB")
    w, h = rgb.size
    keyed = rgb.copy()
    # Flood the background from points around the border; the character is never connected to the edge.
    for x, y in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (0, h // 2), (w - 1, h // 2), (w // 2, h - 1)]:
        if keyed.getpixel((x, y)) != KEY:
            ImageDraw.floodfill(keyed, (x, y), KEY, thresh=THRESH_FOR.get(src.stem, THRESH))
    alpha = Image.eval(keyed.convert("RGB").split()[0], lambda _: 255)
    px_k, px_a = keyed.load(), alpha.load()
    for y in range(h):
        for x in range(w):
            if px_k[x, y] == KEY:
                px_a[x, y] = 0
    # Soften the cut so fuzzy edges don't look jagged.
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.4))
    rgba = rgb.copy()
    rgba.putalpha(alpha)
    box = alpha.point(lambda a: 255 if a > 24 else 0).getbbox()
    if not box:
        print(f"skip {src.name}: nothing left after cutout")
        continue
    art = rgba.crop(box)
    scale = (SIZE * 0.94) / max(art.size)
    art = art.resize((max(1, round(art.width * scale)), max(1, round(art.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(art, ((SIZE - art.width) // 2, SIZE - art.height - 4), art)
    dest = OUT / src.name
    canvas.save(dest, "WEBP", quality=90, method=6)
    print(f"{src.name} -> {dest} ({dest.stat().st_size // 1024} KB)")
