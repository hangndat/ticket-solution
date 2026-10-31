#!/usr/bin/env python3
"""Regenerate brand/vemoki raster assets from vendored approved Logo Kit sources."""
from __future__ import annotations

import base64
import io
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

REPO = Path(__file__).resolve().parents[3]
BRAND = REPO / "brand" / "vemoki"
WEB = REPO / "apps" / "web"
MARK_SRC = BRAND / "sources" / "vemoki-v-mark.png"
ICON_SRC = BRAND / "sources" / "icon.png"
OG_SRC = BRAND / "sources" / "opengraph-image.png"
FONT_DISPLAY = WEB / "fonts" / "Sora-Variable.ttf"
FONT_BODY = WEB / "fonts" / "BeVietnamPro-Medium.ttf"
FONT_BODY_BOLD = WEB / "fonts" / "BeVietnamPro-Bold.ttf"

INK = (11, 18, 32)
PAPER = (244, 246, 248)
SIGNAL = (225, 29, 72)
BANNER_BG = (247, 246, 241)


def _hex(rgb: tuple[int, int, int]) -> str:
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def load_mark() -> Image.Image:
    return Image.open(MARK_SRC).convert("RGBA")


def sora(size: int, weight: int = 700) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_DISPLAY), size, index=0)


def be_vietnam(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_BODY_BOLD if bold else FONT_BODY
    return ImageFont.truetype(str(path), size)


def compose_lockup(
    width: int,
    height: int,
    *,
    bg: tuple[int, int, int],
    ink: tuple[int, int, int],
    mark_height: int,
    word: str = "Vemoki",
    word_size: int | None = None,
    pad_x: int = 32,
    gap: int = 28,
    right_text: str | None = None,
    right_size: int = 22,
) -> Image.Image:
    canvas = Image.new("RGB", (width, height), bg)
    mark = load_mark()
    mark_w = int(mark.width * mark_height / mark.height)
    mark = mark.resize((mark_w, mark_height), Image.Resampling.LANCZOS)
    mark_y = (height - mark_height) // 2
    canvas.paste(mark, (pad_x, mark_y), mark)

    if word_size is None:
        word_size = max(48, int(mark_height * 0.52))
    font = sora(word_size)
    draw = ImageDraw.Draw(canvas)
    text_x = pad_x + mark_w + gap
    bbox = font.getbbox(word)
    text_y = (height - (bbox[3] - bbox[1])) // 2 - bbox[1]
    draw.text((text_x, text_y), word, font=font, fill=ink)

    if right_text:
        rfont = be_vietnam(right_size, bold=True)
        rb = rfont.getbbox(right_text)
        rx = width - pad_x - (rb[2] - rb[0])
        ry = (height - (rb[3] - rb[1])) // 2 - rb[1]
        draw.text((rx, ry), right_text, font=rfont, fill=ink)

    return canvas


def write_lockup() -> None:
    img = compose_lockup(760, 200, bg=PAPER, ink=INK, mark_height=156, word_size=72, gap=24)
    out = BRAND / "lockup.png"
    img.save(out, format="PNG", optimize=True)
    print(f"wrote {out}")


def write_email_header() -> None:
    img = compose_lockup(
        600,
        160,
        bg=PAPER,
        ink=INK,
        mark_height=112,
        word_size=52,
        pad_x=24,
        gap=20,
        right_text="VEMOKI.COM",
        right_size=18,
    )
    out = BRAND / "email-header.png"
    img.save(out, format="PNG", optimize=True)
    print(f"wrote {out}")


def write_app_icon() -> None:
    icon = Image.open(ICON_SRC).convert("RGBA")
    out_size = 1024
    icon = icon.resize((out_size, out_size), Image.Resampling.LANCZOS)
    out = BRAND / "app-icon.png"
    icon.save(out, format="PNG", optimize=True)
    print(f"wrote {out}")


def write_og() -> None:
    og = Image.open(OG_SRC).convert("RGB")
    if og.size != (1200, 630):
        og = og.resize((1200, 630), Image.Resampling.LANCZOS)
    out = BRAND / "og.png"
    og.save(out, format="PNG", optimize=True)
    print(f"wrote {out}")


def _png_data_uri(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    b64 = base64.standard_b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def write_mark_svg(mono: bool = False) -> None:
    mark = load_mark()
    if mono:
        mark = ImageOps.grayscale(mark.convert("RGB")).convert("RGBA")
        # preserve alpha from original
        alpha = load_mark().split()[-1]
        mark.putalpha(alpha)
        out = BRAND / "mark-mono.svg"
    else:
        out = BRAND / "mark.svg"
    w, h = mark.size
    href = _png_data_uri(mark)
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {w} {h}" role="img" aria-label="Vemoki mark">
  <image width="{w}" height="{h}" href="{href}"/>
</svg>
"""
    out.write_text(svg, encoding="utf-8")
    print(f"wrote {out} ({w}x{h}, raster embedded)")


def main() -> None:
    for path in (MARK_SRC, ICON_SRC, OG_SRC, FONT_DISPLAY, FONT_BODY):
        if not path.is_file():
            raise SystemExit(f"missing source: {path}")
    write_lockup()
    write_email_header()
    write_app_icon()
    write_og()
    write_mark_svg(mono=False)
    write_mark_svg(mono=True)


if __name__ == "__main__":
    main()
