#!/usr/bin/env python3
"""Compose apps/web/app/opengraph-image.png (1200×630, neon dark, safe margins)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "app" / "opengraph-image.png"
MARK_SRC = ROOT / "public" / "marketing" / "neon" / "vemoki-v-mark.png"
FONT_DISPLAY = ROOT / "fonts" / "Sora-Variable.ttf"
FONT_BODY = ROOT / "fonts" / "BeVietnamPro-Medium.ttf"

W, H = 1200, 630
MARGIN = 64
MARK_HEIGHT = 320
TITLE_SIZE = 76
SUBTITLE_SIZE = 34
LINE_GAP = 20


def _vertical_gradient(size: tuple[int, int]) -> Image.Image:
    w, h = size
    top = (26, 16, 56)
    mid = (10, 6, 24)
    bottom = (5, 5, 16)
    img = Image.new("RGB", size)
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        if t < 0.55:
            u = t / 0.55
            r = int(top[0] + (mid[0] - top[0]) * u)
            g = int(top[1] + (mid[1] - top[1]) * u)
            b = int(top[2] + (mid[2] - top[2]) * u)
        else:
            u = (t - 0.55) / 0.45
            r = int(mid[0] + (bottom[0] - mid[0]) * u)
            g = int(mid[1] + (bottom[1] - mid[1]) * u)
            b = int(mid[2] + (bottom[2] - mid[2]) * u)
        draw.line([(0, y), (w, y)], fill=(r, g, b))
    return img


def main() -> None:
    canvas = _vertical_gradient((W, H))
    mark = Image.open(MARK_SRC).convert("RGBA")
    mark_w = int(mark.width * MARK_HEIGHT / mark.height)
    mark = mark.resize((mark_w, MARK_HEIGHT), Image.Resampling.LANCZOS)

    mark_x = MARGIN
    mark_y = (H - MARK_HEIGHT) // 2
    canvas.paste(mark, (mark_x, mark_y), mark)

    title_font = ImageFont.truetype(str(FONT_DISPLAY), TITLE_SIZE)
    sub_font = ImageFont.truetype(str(FONT_BODY), SUBTITLE_SIZE)

    title = "Vemoki"
    subtitle = "Nền tảng sự kiện & vé"
    title_bbox = title_font.getbbox(title)
    sub_bbox = sub_font.getbbox(subtitle)
    title_h = title_bbox[3] - title_bbox[1]
    sub_h = sub_bbox[3] - sub_bbox[1]
    block_h = title_h + LINE_GAP + sub_h
    text_x = mark_x + mark_w + 72
    text_y = (H - block_h) // 2

    draw = ImageDraw.Draw(canvas)
    draw.text((text_x, text_y), title, font=title_font, fill=(244, 246, 248))
    draw.text(
        (text_x, text_y + title_h + LINE_GAP),
        subtitle,
        font=sub_font,
        fill=(168, 176, 196),
    )

    canvas.save(OUT, format="PNG", optimize=True)
    print(f"wrote {OUT} ({W}x{H})")


if __name__ == "__main__":
    main()
