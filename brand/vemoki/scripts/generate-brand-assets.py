#!/usr/bin/env python3
"""Export canonical Electric Violet SVG/PNG assets; never redraw the wordmark."""
from __future__ import annotations

import ctypes.util
import io
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image, ImageColor

BRAND = Path(__file__).resolve().parents[1]
SOURCES = BRAND / "sources" / "electric-violet"


def load_renderer():
    # cairocffi's default lookup can miss Homebrew Cairo outside its dlopen path.
    find_library = ctypes.util.find_library
    cairo = Path("/opt/homebrew/opt/cairo/lib/libcairo.2.dylib")
    if sys.platform == "darwin" and cairo.is_file():
        ctypes.util.find_library = lambda name: str(cairo) if name == "cairo" else find_library(name)
    try:
        import cairosvg
    finally:
        ctypes.util.find_library = find_library
    return cairosvg


def main() -> None:
    tokens = json.loads((BRAND / "tokens.json").read_text(encoding="utf-8"))
    colors = tokens["colors"]
    renderer = load_renderer()

    def vector(source: str, output: str) -> bytes:
        content = (SOURCES / source).read_text(encoding="utf-8")
        for old, new in (("#6C35FF", colors["primary"]), ("#141020", colors["ink"])):
            content = re.sub(re.escape(old), lambda _: new, content, flags=re.IGNORECASE)
        document = ET.fromstring(content)
        tags = {node.tag.rsplit("}", 1)[-1] for node in document.iter()}
        if "path" not in tags or tags.intersection({"image", "text", "script", "foreignObject"}):
            raise ValueError(f"Expected outlined vector source: {source}")
        data = content.encode("utf-8")
        (BRAND / output).write_bytes(data)
        print(f"wrote {output}")
        return data

    def compose(svg: bytes, size: tuple[int, int], padding: int = 0, background: str | None = None) -> Image.Image:
        viewbox = [float(value) for value in ET.fromstring(svg).attrib["viewBox"].split()]
        scale = min((size[0] - 2 * padding) / viewbox[2], (size[1] - 2 * padding) / viewbox[3])
        width, height = round(viewbox[2] * scale), round(viewbox[3] * scale)
        png = renderer.svg2png(bytestring=svg, output_width=width * 4, output_height=height * 4)
        with Image.open(io.BytesIO(png)) as rendered:
            artwork = rendered.convert("RGBA").resize((width, height), Image.Resampling.LANCZOS)
        fill = (*ImageColor.getrgb(background), 255) if background else (0, 0, 0, 0)
        canvas = Image.new("RGBA", size, fill)
        canvas.alpha_composite(artwork, ((size[0] - width) // 2, (size[1] - height) // 2))
        return canvas

    def save(image: Image.Image, output: str, opaque: bool = False) -> None:
        if opaque:
            image = image.convert("RGB")
        image.save(BRAND / output, format="PNG", optimize=True)
        print(f"wrote {output} ({image.width}x{image.height})")

    mark = vector("mark.svg", "mark.svg")
    vector("mark-mono-black.svg", "mark-mono.svg")
    vector("mark-mono-white.svg", "mark-white.svg")
    lockup = vector("lockup.svg", "lockup.svg")
    vector("lockup-white.svg", "lockup-white.svg")
    vector("master.svg", "master.svg")
    icon = vector("app-icon-source.svg", "app-icon-source.svg")
    save(compose(mark, (960, 660)), "mark.png")
    save(compose(mark, (512, 512), padding=48), "splash-icon.png")
    save(compose(lockup, (760, 200), padding=16), "lockup.png")
    save(compose(lockup, (600, 160), padding=20, background=colors["paper"]), "email-header.png", opaque=True)
    save(compose(lockup, (1200, 630), padding=72, background=colors["paper"]), "og.png", opaque=True)
    save(compose(icon, (1024, 1024)), "app-icon.png", opaque=True)


if __name__ == "__main__":
    main()
