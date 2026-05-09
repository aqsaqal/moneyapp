#!/usr/bin/env python3
"""Generate flavor-specific app icons.

Flow (generic): dark navy background, bold green F centerpiece.
Amanah (islamic): dark emerald background, gold 8-point star (rub el hizb)
— a classical Islamic geometric motif, not calligraphy.

Output: 1024x1024 PNG masters at assets/{generic,islamic}/icon.png +
adaptive-icon.png (Android adaptive foreground on transparent bg) +
splash-icon.png.

Usage: python3 scripts/generate-icons.py
"""

import math
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZE = 1024
RADIUS = 224  # iOS-style continuous-curve corner radius (~22% of 1024)

# Flavor palettes.
FLOW = {
    "bg_top": (15, 23, 42),       # slate-900
    "bg_bot": (8, 14, 28),
    "fg": (16, 185, 129),         # emerald-500 (matches theme.accent)
    "fg_glow": (52, 211, 153),
}
AMANAH = {
    "bg_top": (10, 60, 50),       # rich emerald
    "bg_bot": (5, 36, 30),
    "fg": (212, 175, 55),         # warm gold (geometric mark)
    "fg_glow": (240, 200, 90),
}


def rounded_rect_mask(size: int, radius: int) -> Image.Image:
    """iOS-style squircle-ish rounded rectangle alpha mask."""
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def vertical_gradient(size: int, top, bot) -> Image.Image:
    g = Image.new("RGB", (size, size), top)
    px = g.load()
    for y in range(size):
        t = y / (size - 1)
        r = int(top[0] * (1 - t) + bot[0] * t)
        gc = int(top[1] * (1 - t) + bot[1] * t)
        b = int(top[2] * (1 - t) + bot[2] * t)
        for x in range(size):
            px[x, y] = (r, gc, b)
    return g


def draw_flow_mark(canvas: Image.Image, palette: dict) -> None:
    """Bold geometric F — two horizontal bars + vertical stem, with a soft
    diagonal slice on the bottom of the stem to evoke 'flow'."""
    d = ImageDraw.Draw(canvas, "RGBA")
    cx, cy = SIZE // 2, SIZE // 2
    # F bounding box ~520x600 centered.
    w, h = 460, 600
    left = cx - w // 2 + 30
    top = cy - h // 2
    stem_w = 110
    bar_h = 110
    bar_top_w = w
    bar_mid_w = int(w * 0.72)

    fg = palette["fg"]
    glow = palette["fg_glow"]

    # Subtle radial glow behind the F.
    glow_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_layer)
    gd.ellipse((cx - 380, cy - 380, cx + 380, cy + 380), fill=(*glow, 28))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(60))
    canvas.alpha_composite(glow_layer)

    # Vertical stem (rounded ends).
    d.rounded_rectangle(
        (left, top, left + stem_w, top + h),
        radius=stem_w // 2,
        fill=fg,
    )
    # Top bar.
    d.rounded_rectangle(
        (left, top, left + bar_top_w, top + bar_h),
        radius=bar_h // 2,
        fill=fg,
    )
    # Middle bar (~42% down).
    bar2_top = top + int(h * 0.42)
    d.rounded_rectangle(
        (left, bar2_top, left + bar_mid_w, bar2_top + bar_h),
        radius=bar_h // 2,
        fill=fg,
    )


def draw_amanah_mark(canvas: Image.Image, palette: dict) -> None:
    """Eight-pointed star (rub el hizb / khatam) — two overlapping squares
    rotated 45° apart, drawn as a single polygonal star with a center dot."""
    d = ImageDraw.Draw(canvas, "RGBA")
    cx, cy = SIZE // 2, SIZE // 2
    R_outer = 360
    R_inner = 200

    fg = palette["fg"]
    glow = palette["fg_glow"]

    # Soft glow.
    glow_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_layer)
    gd.ellipse(
        (cx - R_outer - 60, cy - R_outer - 60, cx + R_outer + 60, cy + R_outer + 60),
        fill=(*glow, 30),
    )
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(70))
    canvas.alpha_composite(glow_layer)

    # 16-vertex star (8 outer points alternating with 8 inner points).
    points = []
    for i in range(16):
        angle = math.radians(-90 + i * (360 / 16))
        r = R_outer if i % 2 == 0 else R_inner
        points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    d.polygon(points, fill=fg)

    # Hollow center dot.
    inner_r = 72
    d.ellipse(
        (cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r),
        fill=palette["bg_bot"],
    )
    # Tiny accent dot in the very center.
    dot_r = 22
    d.ellipse(
        (cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r),
        fill=fg,
    )


def make_icon(palette: dict, draw_mark) -> Image.Image:
    bg = vertical_gradient(SIZE, palette["bg_top"], palette["bg_bot"]).convert("RGBA")
    draw_mark(bg, palette)
    return bg


def make_adaptive_foreground(palette: dict, draw_mark) -> Image.Image:
    """Android adaptive foreground: mark only on transparent bg, with the
    safe-zone constraint (108dp inner, 72dp content). We center the mark
    within the inner ~66% to keep it inside Android's launcher mask."""
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    # Draw on a fresh canvas with the same logic so the mark stays sized
    # consistently with the master.
    draw_mark(layer, palette)
    return layer


def save_with_squircle(img: Image.Image, out: str) -> None:
    """Apply iOS-style rounded-corner mask, save."""
    mask = rounded_rect_mask(SIZE, RADIUS)
    out_img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out_img.paste(img, (0, 0), mask)
    out_img.save(out, format="PNG", optimize=True)


def main() -> None:
    for flavor, palette, draw_mark in [
        ("generic", FLOW, draw_flow_mark),
        ("islamic", AMANAH, draw_amanah_mark),
    ]:
        outdir = os.path.join(ROOT, "assets", flavor)
        os.makedirs(outdir, exist_ok=True)
        master = make_icon(palette, draw_mark)
        # iOS / square / app store icon (with rounded-rect mask).
        save_with_squircle(master, os.path.join(outdir, "icon.png"))
        # Splash uses the same mark on the brand background — full-bleed
        # square (no rounded corners).
        master.save(os.path.join(outdir, "splash-icon.png"), format="PNG", optimize=True)
        # Android adaptive foreground (transparent bg, mark only).
        adaptive = make_adaptive_foreground(palette, draw_mark)
        adaptive.save(os.path.join(outdir, "adaptive-icon.png"), format="PNG", optimize=True)
        print(f"[{flavor}] wrote icon.png, splash-icon.png, adaptive-icon.png in {outdir}")


if __name__ == "__main__":
    main()
