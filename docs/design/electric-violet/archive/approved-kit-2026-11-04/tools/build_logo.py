#!/usr/bin/env python3
"""Rebuild the Electric Violet vector master and its exports from the approved masks.

Requires Pillow, numpy, CairoSVG, and Potrace 1.16. Run from any directory:
    python3 docs/design/electric-violet/tools/build_logo.py
The masks are fixed evidence extracted from the approved logo-suite raster.
"""
from __future__ import annotations

import ctypes.util
import io
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image

# Homebrew Cairo is present on the design Mac but not on Python's default
# dlopen path. Resolve only this exact library for cairocffi.
_find_library = ctypes.util.find_library
ctypes.util.find_library = lambda name: (
    "/opt/homebrew/opt/cairo/lib/libcairo.2.dylib"
    if name == "cairo" and Path("/opt/homebrew/opt/cairo/lib/libcairo.2.dylib").exists()
    else _find_library(name)
)
import cairosvg  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
SVG = ROOT / "logo/svg"
PNG = ROOT / "logo/png"
ARCHIVE = ROOT / "archive/trace-svg"
PROOF = ROOT / "proof"
GEOMETRY_TRANSFORM = "translate(0,250) scale(0.1,-0.1)"
COMMENT = """<!--
    CLEAN VECTOR MASTER (user quality request, 2026-11-04):
    Potrace 1.16 fits long straight segments and cubic Beziers to the two
    approved-image masks in sources/. The same two paths in logo/master.svg
    are reused here; no live text, font dependency, or raster embed.
    Coordinate space is the approved 950x250 hero ROI. Existing layout
    transforms, colors, and EV-05 viewBoxes are preserved.
  -->"""


def render(svg: bytes | str, width: int, height: int, supersample: int = 4) -> Image.Image:
    data = svg.encode() if isinstance(svg, str) else svg
    hi = cairosvg.svg2png(
        bytestring=data, output_width=width * supersample, output_height=height * supersample
    )
    im = Image.open(io.BytesIO(hi)).convert("RGBA")
    return im.resize((width, height), Image.Resampling.LANCZOS) if supersample > 1 else im


def trace(mask_name: str) -> str:
    source = Image.open(ROOT / "sources" / f"{mask_name}-mask.png").convert("L")
    assert source.size == (950, 250)
    with tempfile.TemporaryDirectory() as tmp:
        bitmap = Path(tmp) / "mask.pbm"
        output = Path(tmp) / "path.svg"
        source.point(lambda p: 0 if p > 127 else 255).convert("1").save(bitmap)
        subprocess.run(
            ["potrace", "-s", "--flat", "-t", "0", "-a", "0.9", "-O", "0.2",
             "-u", "10", "-o", str(output), str(bitmap)],
            check=True,
        )
        root = ET.parse(output).getroot()
        paths = [node.attrib["d"] for node in root.iter() if node.tag.endswith("path")]
        assert len(paths) == 1, (mask_name, len(paths))
        assert "c" in paths[0] and "l" in paths[0].lower(), mask_name
        return paths[0]


def master_svg(mark: str, word: str) -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 950 250" role="img" '
        'aria-label="Vemoki">\n'
        f'  <path transform="{GEOMETRY_TRANSFORM}" d="{mark}" fill="#6C35FF"/>\n'
        f'  <path transform="{GEOMETRY_TRANSFORM}" d="{word}" fill="#141020"/>\n'
        '</svg>\n'
    )


def replace_paths(template: str, mark: str, word: str) -> str:
    text = re.sub(r"<!--.*?-->", COMMENT, template, count=1, flags=re.S)
    paths = iter((mark, word))

    def change(match: re.Match) -> str:
        d = next(paths)
        return f'<path transform="{GEOMETRY_TRANSFORM}" d="{d}"'

    text, count = re.subn(r'<path d="[^"]+"', change, text)
    assert count in (1, 2)
    return text


def canvas(svg_path: Path) -> tuple[int, int]:
    vb = list(map(float, ET.parse(svg_path).getroot().attrib["viewBox"].split()))
    return round(vb[2]), round(vb[3])


def export(svg_path: Path, dest: Path, width: int, height: int) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    # The vector rasterizer itself antialiases; small/medium outputs receive
    # extra supersampling. 4K renders directly to avoid a >500 MB temp image.
    factor = 4 if width <= 1250 else (2 if width <= 2048 else 1)
    render(svg_path.read_bytes(), width, height, factor).save(dest)


def fit_size(svg_path: Path, *, h: int | None = None, w: int | None = None) -> tuple[int, int]:
    vw, vh = canvas(svg_path)
    if h is not None:
        return max(1, round(h * vw / vh)), h
    assert w is not None
    return w, max(1, round(w * vh / vw))


def fit_visible_height(svg_path: Path, visible_height: int) -> tuple[int, int]:
    _, vh = canvas(svg_path)
    _, top, _, bottom = verify_bounds(svg_path)
    content_height = vh - top - bottom
    return fit_size(svg_path, h=round(visible_height * vh / content_height))


def on_background(im: Image.Image, color: str) -> Image.Image:
    bg = Image.new("RGBA", im.size, color)
    bg.alpha_composite(im)
    return bg.convert("RGB")


def proof_pair(name: str, old_svg: str, new_svg: str, width: int, height: int,
               scale: int, crop: tuple[float, float, float, float] | None = None) -> None:
    """Old/new panels on white and dark at target pixel size or native 8x render."""
    w, h = width * scale, height * scale
    old = render(old_svg, w, h, 1 if scale > 1 else 4)
    new = render(new_svg, w, h, 1 if scale > 1 else 4)
    # Ink wordmark needs its reversed variant on the dark panel.
    reverse = "wordmark" in name
    old_dark = render(old_svg.replace('#141020', '#FFFFFF'), w, h,
                      1 if scale > 1 else 4) if reverse else old
    new_dark = render(new_svg.replace('#141020', '#FFFFFF'), w, h,
                      1 if scale > 1 else 4) if reverse else new
    if crop:
        box = tuple(round(v * scale) for v in crop)
        old, new = old.crop(box), new.crop(box)
        old_dark, new_dark = old_dark.crop(box), new_dark.crop(box)
    margin = 20 if scale == 1 else 40
    panel_w, panel_h = old.size
    sheet = Image.new("RGB", (panel_w * 2 + margin * 3, panel_h * 2 + margin * 3),
                      "#EAE8EF")
    for row, color in enumerate(("#FFFFFF", "#141020")):
        for col, asset in enumerate((old, new) if row == 0 else (old_dark, new_dark)):
            sheet.paste(on_background(asset, color),
                        (margin + col * (panel_w + margin),
                         margin + row * (panel_h + margin)))
    sheet.save(PROOF / f"{name}.png")


def iou(name: str, d: str) -> float:
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 950 250">'
           f'<path transform="{GEOMETRY_TRANSFORM}" d="{d}"/></svg>')
    alpha = np.array(render(svg, 950, 250, 4).getchannel("A")) > 127
    approved = np.array(Image.open(ROOT / "sources" / f"{name}-mask.png").convert("L")) > 127
    return float((alpha & approved).sum() / (alpha | approved).sum())


def segment_count(d: str) -> tuple[int, int]:
    tokens = re.findall(r"[MmLlHhVvCcSsQqTtZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", d)
    arity = {"m": 2, "l": 2, "h": 1, "v": 1, "c": 6,
             "s": 4, "q": 4, "t": 2, "z": 0}
    commands = 0
    nodes = 0
    i = 0
    while i < len(tokens):
        cmd = tokens[i].lower()
        assert cmd in arity
        i += 1
        if cmd == "z":
            commands += 1
            continue
        end = i
        while end < len(tokens) and tokens[end] not in arity and tokens[end].lower() not in arity:
            end += 1
        n = (end - i) // arity[cmd]
        assert n * arity[cmd] == end - i
        commands += n
        nodes += n * (3 if cmd == "c" else 2 if cmd in ("q", "s") else 1)
        i = end
    return commands, nodes


def path_control_points(d: str) -> list[tuple[float, float]]:
    """Endpoints and Bézier controls; their hull contains the whole path."""
    tokens = re.findall(r"[MmLlHhVvCcSsQqTtZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", d)
    arity = {"m": 2, "l": 2, "h": 1, "v": 1, "c": 6,
             "s": 4, "q": 4, "t": 2}
    points: list[tuple[float, float]] = []
    at = (0.0, 0.0)
    start = at
    previous_control = at
    previous_cmd = ""
    i = 0
    cmd = ""
    while i < len(tokens):
        if tokens[i].isalpha():
            cmd = tokens[i]
            i += 1
        lower = cmd.lower()
        if lower == "z":
            at = start
            previous_cmd = cmd
            continue
        assert lower in arity, cmd
        n = arity[lower]
        assert i + n <= len(tokens)
        values = list(map(float, tokens[i:i+n]))
        i += n
        rel = cmd.islower()
        origin = at
        def point(x: float, y: float) -> tuple[float, float]:
            return (origin[0] + x, origin[1] + y) if rel else (x, y)
        if lower in ("m", "l", "t"):
            at = point(values[0], values[1])
            if lower == "m":
                start = at
                cmd = "l" if rel else "L"
            points.append(at)
            previous_control = at
        elif lower == "h":
            at = (origin[0] + values[0], origin[1]) if rel else (values[0], origin[1])
            points.append(at)
            previous_control = at
        elif lower == "v":
            at = (origin[0], origin[1] + values[0]) if rel else (origin[0], values[0])
            points.append(at)
            previous_control = at
        elif lower == "c":
            c1 = point(values[0], values[1])
            c2 = point(values[2], values[3])
            at = point(values[4], values[5])
            points.extend((c1, c2, at))
            previous_control = c2
        elif lower == "q":
            c = point(values[0], values[1])
            at = point(values[2], values[3])
            points.extend((c, at))
            previous_control = c
        elif lower in ("s", "t"):
            assert lower != "s", "Unexpected smooth cubic; update conservative hull parser"
        previous_cmd = cmd
    assert points
    return points


def mul(a: tuple[float, ...], b: tuple[float, ...]) -> tuple[float, ...]:
    a0,a1,a2,a3,a4,a5 = a
    b0,b1,b2,b3,b4,b5 = b
    return (a0*b0+a2*b1, a1*b0+a3*b1, a0*b2+a2*b3,
            a1*b2+a3*b3, a0*b4+a2*b5+a4, a1*b4+a3*b5+a5)


def svg_transform(value: str) -> tuple[float, ...]:
    matrix = (1., 0., 0., 1., 0., 0.)
    for name, body in re.findall(r"(translate|scale|matrix)\s*\(([^)]*)\)", value):
        vals = list(map(float, re.findall(r"[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", body)))
        if name == "translate":
            item = (1., 0., 0., 1., vals[0], vals[1] if len(vals) > 1 else 0.)
        elif name == "scale":
            item = (vals[0], 0., 0., vals[1] if len(vals) > 1 else vals[0], 0., 0.)
        else:
            item = tuple(vals)
        matrix = mul(matrix, item)
    return matrix


def conservative_path_bounds(svg_path: Path) -> tuple[float, float, float, float]:
    root = ET.parse(svg_path).getroot()
    vb = list(map(float, root.attrib["viewBox"].split()))
    points: list[tuple[float, float]] = []
    def walk(node: ET.Element, parent: tuple[float, ...]) -> None:
        matrix = mul(parent, svg_transform(node.attrib.get("transform", "")))
        if node.tag.endswith("path"):
            for x, y in path_control_points(node.attrib["d"]):
                points.append((matrix[0]*x + matrix[2]*y + matrix[4],
                               matrix[1]*x + matrix[3]*y + matrix[5]))
        for child in node:
            walk(child, matrix)
    walk(root, (1., 0., 0., 1., 0., 0.))
    assert points, svg_path.name
    bounds = (min(x for x,y in points), min(y for x,y in points),
              max(x for x,y in points), max(y for x,y in points))
    margin = (bounds[0]-vb[0], bounds[1]-vb[1],
              vb[0]+vb[2]-bounds[2], vb[1]+vb[3]-bounds[3])
    assert min(margin) > 0, (svg_path.name, margin)
    return margin


def verify_bounds(svg_path: Path) -> tuple[float, float, float, float]:
    root = ET.parse(svg_path).getroot()
    vb = list(map(float, root.attrib["viewBox"].split()))
    for node in list(root.iter()):
        if node.tag.endswith("rect"):
            parent = next((p for p in root.iter() if node in list(p)), None)
            if parent is not None:
                parent.remove(node)
    isolated = ET.tostring(root, encoding="utf-8")
    width, height = round(vb[2] * 4), round(vb[3] * 4)
    alpha = render(isolated, width, height, 1).getchannel("A")
    box = alpha.getbbox()
    assert box, svg_path.name
    margin = (box[0] / 4, box[1] / 4, (width - box[2]) / 4, (height - box[3]) / 4)
    assert min(margin) >= 1, (svg_path.name, margin)
    return margin


def main() -> None:
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    if not list(ARCHIVE.glob("*.svg")):
        for src in SVG.glob("*.svg"):
            shutil.copy2(src, ARCHIVE / src.name)
    assert len(list(ARCHIVE.glob("*.svg"))) == 10, "Expected all ten historical SVG templates"
    PROOF.mkdir(parents=True, exist_ok=True)
    mark, word = trace("violet"), trace("dark")
    (ROOT / "logo/master.svg").write_text(master_svg(mark, word))
    for old in sorted(ARCHIVE.glob("*.svg")):
        (SVG / old.name).write_text(replace_paths(old.read_text(), mark, word))
    for svg_path in sorted(SVG.glob("*.svg")):
        vw, vh = canvas(svg_path)
        if svg_path.stem == "app-icon-source":
            size = (1024, 1024)
        else:
            size = (vw * 2, vh * 2)
        export(svg_path, PNG / f"{svg_path.stem}.png", *size)
        print("BOUNDS", svg_path.name, tuple(round(v, 2) for v in verify_bounds(svg_path)))
        print("HULL", svg_path.name, tuple(round(v, 2) for v in conservative_path_bounds(svg_path)))
        alpha = Image.open(PNG / f"{svg_path.stem}.png").getchannel("A").getextrema()
        assert alpha == ((255, 255) if svg_path.stem == "app-icon-source" else (0, 255)), (svg_path.name, alpha)
    for h in (24, 48, 96):
        f = SVG / "mark.svg"
        target = PNG / "sizes" / f"mark-h{h}.png"
        export(f, target, *fit_visible_height(f, h))
        box = Image.open(target).getchannel("A").point(lambda p: 255 if p > 127 else 0).getbbox()
        assert box and abs((box[3] - box[1]) - h) <= 1, (target, box)
        print("SIZE", target.name, Image.open(target).size, "visible height", box[3] - box[1])
    for h in (32, 64, 128):
        f = SVG / "horizontal-primary.svg"
        target = PNG / "sizes" / f"horizontal-primary-h{h}.png"
        export(f, target, *fit_visible_height(f, h))
        box = Image.open(target).getchannel("A").point(lambda p: 255 if p > 127 else 0).getbbox()
        assert box and abs((box[3] - box[1]) - h) <= 1, (target, box)
        print("SIZE", target.name, Image.open(target).size, "visible height", box[3] - box[1])
    for w in (2048, 4096):
        f = SVG / "horizontal-primary.svg"
        export(f, PNG / "sizes" / f"horizontal-primary-w{w}.png", *fit_size(f, w=w))
    for path in (PNG / "sizes").glob("*.png"):
        assert Image.open(path).getchannel("A").getextrema() == (0, 255), path.name
    # Presentation-only backgrounds for white and black variants.
    for stem, bg in (("horizontal-mono-black", "#FFFFFF"),
                     ("mark-mono-black", "#FFFFFF"),
                     ("horizontal-mono-white", "#141020"),
                     ("mark-mono-white", "#141020")):
        im = Image.open(PNG / f"{stem}.png").convert("RGBA")
        label = "on-light" if bg == "#FFFFFF" else "on-dark"
        on_background(im, bg).save(PNG / "presentation" / f"{stem}-{label}.png")
    old_h = ET.parse(ARCHIVE / "horizontal-primary.svg").getroot()
    old_paths = [n.attrib["d"] for n in old_h.iter() if n.tag.endswith("path")]
    old_svg = lambda d, color: (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 950 250">'
        f'<path transform="translate(0.5,0.5)" d="{d}" fill="{color}" fill-rule="evenodd"/></svg>'
    )
    new_svg = lambda d, color: (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 950 250">'
        f'<path transform="{GEOMETRY_TRANSFORM}" d="{d}" fill="{color}"/></svg>'
    )
    for name, old_d, new_d, color in (
        ("mark", old_paths[0], mark, "#6C35FF"),
        ("wordmark", old_paths[1], word, "#141020"),
    ):
        score = iou("violet" if name == "mark" else "dark", new_d)
        assert score >= 0.97, (name, score)
        print("METRIC", name, "old", segment_count(old_d),
              "new", segment_count(new_d), "IoU", round(score, 5))
        proof_pair(f"{name}-100-light-dark", old_svg(old_d, color), new_svg(new_d, color),
                   243, 64, 1)
        # ROI details at 8x native vector render: diagonal/notch for mark,
        # e/m/o curves for the wordmark.
        detail = (20, 20, 330, 225) if name == "mark" else (450, 65, 780, 210)
        proof_pair(f"{name}-800-old-new", old_svg(old_d, color), new_svg(new_d, color),
                   950, 250, 8, detail)
    approved = Image.open(ROOT / "sources/approved-hero-roi.png").convert("RGB")
    old_full = render((f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 950 250">'
                       f'<g transform="translate(0.5,0.5)"><path d="{old_paths[0]}" fill="#6C35FF" fill-rule="evenodd"/>'
                       f'<path d="{old_paths[1]}" fill="#141020" fill-rule="evenodd"/></g></svg>'), 950, 250)
    new_full = render((ROOT / "logo/master.svg").read_bytes(), 950, 250)
    comparison = Image.new("RGB", (2850, 250), "#FFFFFF")
    for i, panel in enumerate((approved, on_background(old_full, "#FFFFFF"),
                               on_background(new_full, "#FFFFFF"))):
        comparison.paste(panel, (i * 950, 0))
    comparison.save(PROOF / "approved-old-clean.png")
    kit = ROOT / "logo/vemoki-electric-violet-logo-kit.zip"
    with zipfile.ZipFile(kit, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for path in sorted([ROOT / "logo/master.svg", ROOT / "logo/README.md",
                            *SVG.glob("*.svg"), *PNG.rglob("*.png")]):
            z.write(path, path.relative_to(ROOT / "logo"))
    with zipfile.ZipFile(kit) as z:
        for name in z.namelist():
            assert z.read(name) == (ROOT / "logo" / name).read_bytes(), name
    print("ZIP", len(z.namelist()), "files byte-exact")


if __name__ == "__main__":
    main()
