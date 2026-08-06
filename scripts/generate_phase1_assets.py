#!/usr/bin/env python3
"""Generate deterministic Phase 1 pixel assets for PIXEL PANIC."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend/public/assets/pixel-panic"
SRC = ROOT / "assets-src/pixel-panic"

C = {
    "ink": "#172033", "navy": "#24314D", "navy2": "#34486B", "cream": "#FFF4D6",
    "aqua": "#39BFF2", "aqua_dark": "#1975C5", "fix": "#FFD34E", "fix_dark": "#D98C2B",
    "buddy": "#FF6577", "buddy_dark": "#C93F5B", "success": "#70D98B", "warning": "#F58B3D",
    "danger": "#F04455", "grass": "#80C96B", "grass_dark": "#3F8F5B", "water": "#54C7EC",
    "water_dark": "#287DB2", "dirt": "#D7AA68", "wood": "#9B603F", "metal": "#A9C4D4",
    "smoke": "#667085", "white": "#FFFFFF", "yellow_hot": "#FFF3A3", "orange": "#FFB23D",
}

NEAREST = Image.Resampling.NEAREST


def ensure_dirs() -> None:
    for base in (OUT, SRC):
        for path in (
            "brand", "ui/panels", "ui/buttons", "ui/icons", "ui/portraits", "ui/screens",
            "world", "characters", "fx", "style",
        ):
            (base / path).mkdir(parents=True, exist_ok=True)


def rgba(size: tuple[int, int], fill=(0, 0, 0, 0)) -> Image.Image:
    return Image.new("RGBA", size, fill)


def save(img: Image.Image, relative: str, source_copy: bool = False) -> None:
    target = OUT / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    img.save(target, "PNG", optimize=True)
    if source_copy:
        src_target = SRC / relative
        src_target.parent.mkdir(parents=True, exist_ok=True)
        img.save(src_target, "PNG")


def scale(img: Image.Image, factor: int) -> Image.Image:
    return img.resize((img.width * factor, img.height * factor), NEAREST)


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            try:
                return ImageFont.truetype(candidate, size=size, index=0)
            except OSError:
                continue
    return ImageFont.load_default()


def hard_text(img: Image.Image, xy: tuple[int, int], text: str, size: int, fill: str, anchor: str = "mm") -> None:
    mask = Image.new("L", img.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.text(xy, text, font=font(size), fill=255, anchor=anchor, stroke_width=0)
    mask = mask.point(lambda value: 255 if value >= 112 else 0)
    color = Image.new("RGBA", img.size, fill)
    img.alpha_composite(Image.composite(color, rgba(img.size), mask))


def outline_rect(draw: ImageDraw.ImageDraw, box, fill: str, width: int = 2, outline: str | None = None) -> None:
    outline = outline or C["ink"]
    draw.rectangle(box, fill=outline)
    x0, y0, x1, y1 = box
    draw.rectangle((x0 + width, y0 + width, x1 - width, y1 - width), fill=fill)


def pixel_heart(draw: ImageDraw.ImageDraw, x: int, y: int, color: str, unit: int = 1) -> None:
    cells = [(1,0),(2,0),(4,0),(5,0),(0,1),(1,1),(2,1),(3,1),(4,1),(5,1),(6,1),(0,2),(1,2),(2,2),(3,2),(4,2),(5,2),(6,2),(1,3),(2,3),(3,3),(4,3),(5,3),(2,4),(3,4),(4,4),(3,5)]
    for cx, cy in cells:
        draw.rectangle((x + cx * unit, y + cy * unit, x + (cx + 1) * unit - 1, y + (cy + 1) * unit - 1), fill=color)


def draw_robot(tile: Image.Image, robot: str, state: str = "ready") -> None:
    d = ImageDraw.Draw(tile)
    primary = C[robot]
    shadow = C[f"{robot}_dark"]
    # Distinct silhouettes: tank, square helmet/tool, or long rescue arms.
    if robot == "aqua":
        d.rounded_rectangle((5, 9, 11, 25), radius=2, fill=C["aqua_dark"], outline=C["ink"], width=2)
        d.rectangle((3, 17, 7, 25), fill=C["aqua"], outline=C["ink"])
        d.rectangle((24, 15, 31, 20), fill=C["aqua_dark"], outline=C["ink"])
    elif robot == "fix":
        d.rectangle((5, 3, 27, 9), fill=C["fix"], outline=C["ink"], width=2)
        d.rectangle((2, 17, 7, 24), fill=C["fix_dark"], outline=C["ink"])
        d.rectangle((25, 13, 30, 27), fill=C["metal"], outline=C["ink"])
        d.rectangle((23, 11, 31, 15), fill=C["metal"], outline=C["ink"])
    else:
        d.rectangle((0, 14, 7, 19), fill=C["buddy"], outline=C["ink"])
        d.rectangle((25, 14, 31, 19), fill=C["buddy"], outline=C["ink"])
        d.rectangle((1, 17, 4, 27), fill=C["buddy_dark"], outline=C["ink"])
        d.rectangle((28, 17, 31, 27), fill=C["buddy_dark"], outline=C["ink"])
        d.rectangle((14, 1, 18, 5), fill=C["danger"], outline=C["ink"])
    d.rounded_rectangle((7, 5, 25, 18), radius=4 if robot != "fix" else 2, fill=primary, outline=C["ink"], width=2)
    d.rectangle((9, 8, 23, 15), fill=C["ink"])
    eye = C["cream"] if state == "ready" else primary
    if state == "fail":
        d.line((12, 11, 14, 13), fill=eye, width=1); d.line((14, 11, 12, 13), fill=eye, width=1)
        d.line((18, 11, 20, 13), fill=eye, width=1); d.line((20, 11, 18, 13), fill=eye, width=1)
    else:
        d.rectangle((12, 10, 14, 12), fill=eye); d.rectangle((18, 10, 20, 12), fill=eye)
    d.rounded_rectangle((8, 17, 24, 27), radius=3, fill=primary, outline=C["ink"], width=2)
    if robot == "buddy": pixel_heart(d, 13, 19, C["cream"], 1)
    elif robot == "fix": d.rectangle((14, 20, 18, 24), fill=C["fix_dark"])
    else: d.ellipse((13, 19, 19, 25), fill=C["aqua_dark"], outline=C["ink"])
    d.rectangle((8, 26, 13, 30), fill=shadow, outline=C["ink"]); d.rectangle((19, 26, 24, 30), fill=shadow, outline=C["ink"])
    if state == "busy":
        d.rectangle((10, 15, 22, 16), fill=C["cream"])
    if state == "fail":
        d.rectangle((8, 6, 11, 8), fill=C["smoke"]); d.rectangle((21, 17, 24, 20), fill=C["smoke"])


def make_logo() -> None:
    logo = rgba((256, 64))
    d = ImageDraw.Draw(logo)
    # Chunky shadow plates keep the generated logo clean and legible.
    d.rounded_rectangle((5, 5, 251, 47), radius=7, fill=C["ink"], outline=C["cream"], width=2)
    hard_text(logo, (128, 25), "PIXEL PANIC", 28, C["fix"])
    d.rectangle((67, 47, 189, 62), fill=C["navy"], outline=C["ink"], width=2)
    hard_text(logo, (128, 54), "AI 구조대", 9, C["cream"])
    for x, color in ((20, C["aqua"]), (228, C["buddy"])):
        d.rectangle((x - 5, 49, x + 5, 58), fill=color, outline=C["ink"])
    save(scale(logo, 2), "brand/pp_brand_logo_horizontal.png", True)

    mark = rgba((32, 32))
    m = ImageDraw.Draw(mark)
    # Rescue robot emblem: beacon, heart badge, expressive visor and armored chin.
    m.rectangle((12, 0, 20, 5), fill=C["ink"])
    m.rectangle((14, 1, 18, 4), fill=C["danger"])
    m.point((14, 1), fill=C["cream"])
    m.rectangle((10, 4, 22, 7), fill=C["ink"])
    m.rectangle((12, 5, 20, 6), fill=C["fix"])

    helmet = [(8, 6), (24, 6), (24, 8), (27, 8), (27, 11), (30, 11), (30, 24), (27, 24),
              (27, 27), (23, 27), (23, 30), (9, 30), (9, 28), (5, 28), (5, 25), (2, 25),
              (2, 11), (5, 11), (5, 8), (8, 8)]
    m.polygon(helmet, fill=C["ink"])
    helmet_inner = [(9, 8), (23, 8), (23, 10), (26, 10), (26, 13), (28, 13), (28, 22),
                    (25, 22), (25, 25), (21, 25), (21, 27), (11, 27), (11, 25), (7, 25),
                    (7, 22), (4, 22), (4, 13), (7, 13), (7, 10), (9, 10)]
    m.polygon(helmet_inner, fill=C["navy"])
    m.rectangle((7, 10, 9, 12), fill=C["navy2"])
    m.rectangle((23, 10, 25, 12), fill=C["navy2"])

    for hx, hy in ((14, 8), (17, 8), (13, 9), (14, 9), (15, 9), (16, 9), (17, 9), (18, 9),
                   (14, 10), (15, 10), (16, 10), (17, 10), (15, 11), (16, 11)):
        m.point((hx, hy), fill=C["buddy"])

    visor = [(7, 12), (25, 12), (27, 14), (27, 20), (25, 22), (7, 22), (5, 20), (5, 14)]
    m.polygon(visor, fill=C["ink"])
    visor_inner = [(8, 14), (24, 14), (25, 15), (25, 19), (24, 20), (8, 20), (7, 19), (7, 15)]
    m.polygon(visor_inner, fill=C["aqua"])
    m.line((8, 14, 24, 14), fill=C["cream"])
    for eye_x in (10, 20):
        m.rectangle((eye_x - 1, 16, eye_x + 2, 19), fill=C["ink"])
        m.point((eye_x, 16), fill=C["cream"])
        m.point((eye_x + 2, 19), fill=C["aqua_dark"])

    m.rectangle((2, 15, 5, 21), fill=C["navy2"])
    m.rectangle((3, 16, 4, 18), fill=C["cream"])
    m.rectangle((27, 15, 30, 21), fill=C["navy2"])
    m.rectangle((28, 16, 29, 18), fill=C["cream"])
    m.rectangle((3, 21, 5, 23), fill=C["fix_dark"])
    m.rectangle((27, 21, 29, 23), fill=C["fix_dark"])

    m.rectangle((12, 21, 20, 27), fill=C["ink"])
    m.rectangle((14, 22, 18, 24), fill=C["metal"])
    m.rectangle((14, 25, 15, 27), fill=C["navy2"])
    m.rectangle((17, 25, 18, 27), fill=C["navy2"])
    m.rectangle((8, 27, 12, 29), fill=C["fix_dark"])
    m.rectangle((20, 27, 24, 29), fill=C["fix_dark"])
    m.rectangle((13, 29, 19, 31), fill=C["fix"])
    m.rectangle((15, 29, 17, 30), fill=C["cream"])
    save(scale(mark, 4), "brand/pp_brand_logo_mark.png", True)


def building(d: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, color: str, roof: str, symbol: str) -> None:
    d.rectangle((x, y + 10, x + w, y + h), fill=color, outline=C["ink"], width=2)
    d.polygon([(x - 3, y + 12), (x + w // 2, y - 3), (x + w + 3, y + 12)], fill=roof, outline=C["ink"])
    d.rectangle((x + w // 2 - 4, y + h - 13, x + w // 2 + 4, y + h), fill=C["wood"], outline=C["ink"])
    d.rectangle((x + 5, y + 17, x + 13, y + 25), fill=C["water"], outline=C["ink"])
    d.rectangle((x + w - 13, y + 17, x + w - 5, y + 25), fill=C["water"], outline=C["ink"])
    if symbol == "bread":
        d.ellipse((x + w // 2 - 6, y + 3, x + w // 2 + 6, y + 10), fill=C["fix"], outline=C["ink"])
    elif symbol == "bolt":
        d.polygon([(x+w//2, y+2),(x+w//2-4,y+8),(x+w//2,y+8),(x+w//2-2,y+14),(x+w//2+6,y+6),(x+w//2+2,y+6)], fill=C["fix"], outline=C["ink"])
    elif symbol == "heart":
        pixel_heart(d, x + w // 2 - 4, y + 3, C["buddy"], 1)


def scene_background(kind: str) -> Image.Image:
    img = rgba((320, 180), C["white"])
    d = ImageDraw.Draw(img)
    sky = "#8CDBF6" if kind != "fail" else "#8390A4"
    grass = C["grass"] if kind != "fail" else "#698B64"
    d.rectangle((0, 0, 319, 73), fill=sky)
    d.rectangle((0, 74, 319, 179), fill=grass)
    # clouds
    for x, y in ((18, 18), (252, 25), (105, 12)):
        d.rectangle((x, y + 5, x + 28, y + 10), fill=C["cream"])
        d.rectangle((x + 6, y, x + 18, y + 12), fill=C["cream"])
    # river and plaza
    d.polygon([(0, 135), (78, 122), (150, 140), (220, 128), (319, 145), (319, 179), (0, 179)], fill=C["water_dark"])
    d.polygon([(0, 139), (80, 127), (151, 145), (220, 133), (319, 150), (319, 166), (220, 145), (151, 157), (80, 139), (0, 151)], fill=C["water"])
    d.rectangle((101, 81, 219, 137), fill=C["dirt"], outline=C["wood"], width=2)
    d.rectangle((148, 81, 172, 137), fill="#E8C78A")
    d.rectangle((101, 105, 219, 119), fill="#E8C78A")
    building(d, 15, 70, 60, 48, "#F2B16E", "#B95742", "bread")
    building(d, 245, 67, 58, 51, "#C9D7DF", "#465A7A", "bolt")
    building(d, 127, 59, 66, 48, "#DCE7EC", "#34486B", "heart")
    # trees around the edges
    for x, y in ((5, 45), (77, 67), (230, 72), (300, 55), (88, 145), (242, 145)):
        d.rectangle((x + 6, y + 13, x + 10, y + 26), fill=C["wood"])
        d.ellipse((x, y, x + 18, y + 20), fill=C["grass_dark"], outline=C["ink"])
        d.rectangle((x + 4, y + 4, x + 12, y + 11), fill=C["grass"])
    if kind == "success":
        for x, y, color in ((28,31,C["fix"]),(62,44,C["buddy"]),(224,30,C["aqua"]),(280,41,C["fix"]),(113,36,C["success"]),(202,16,C["buddy"])):
            d.rectangle((x, y, x+2, y+4), fill=color)
    if kind == "fail":
        d.ellipse((31, 50, 56, 77), fill="#596274")
        d.ellipse((260, 45, 285, 75), fill="#596274")
        d.rectangle((20, 105, 65, 111), fill="#4B4E52")
        img = Image.blend(img, Image.new("RGBA", img.size, (23,32,51,255)), 0.16)
    return scale(img, 4)


def make_screens() -> None:
    for kind, filename in (
        ("title", "pp_ui_screen_title_bg.png"),
        ("loading", "pp_ui_screen_loading_bg.png"),
        ("success", "pp_ui_screen_result_success_bg.png"),
        ("fail", "pp_ui_screen_result_fail_bg.png"),
    ):
        image = scene_background(kind)
        if kind == "loading":
            overlay = Image.new("RGBA", image.size, (23, 32, 51, 120))
            image.alpha_composite(overlay)
        save(image, f"ui/screens/{filename}", True)


def make_panels() -> None:
    panel_specs = {
        "base": (C["navy"], C["navy2"], C["cream"]),
        "command": ("#1C2941", C["navy2"], C["aqua"]),
        "alert": ("#382A3C", "#5A3D50", C["danger"]),
        "success": ("#203D3B", "#315E4F", C["success"]),
        "tooltip": (C["navy"], C["navy2"], C["metal"]),
        "input": (C["ink"], C["navy"], C["aqua"]),
    }
    for name, (fill, inner, accent) in panel_specs.items():
        size = 32 if name == "tooltip" else 48
        img = rgba((size, size))
        d = ImageDraw.Draw(img)
        d.rectangle((0, 0, size - 1, size - 1), fill=C["ink"])
        d.rectangle((3, 3, size - 4, size - 4), fill=accent)
        d.rectangle((6, 6, size - 7, size - 7), fill=inner)
        d.rectangle((9, 9, size - 10, size - 10), fill=fill)
        d.rectangle((3, 3, 9, 5), fill=C["cream"])
        d.rectangle((size - 10, size - 6, size - 4, size - 4), fill=C["ink"])
        save(img, f"ui/panels/pp_ui_{'input' if name == 'input' else 'panel_' + name}_9s.png", True)


def make_buttons() -> None:
    specs = {"primary": C["aqua"], "secondary": C["navy2"], "danger": C["danger"]}
    for name, base in specs.items():
        sheet = rgba((192, 192))
        draw = ImageDraw.Draw(sheet)
        states = [base, C["cream"] if name == "secondary" else C["success"], C[f"{name}_dark"] if f"{name}_dark" in C else C["navy"], C["smoke"]]
        if name == "primary": states[2] = C["aqua_dark"]
        if name == "danger": states[2] = "#A72D45"
        for index, fill in enumerate(states):
            y = index * 48
            draw.rectangle((2, y + 2, 189, y + 45), fill=C["ink"])
            draw.rectangle((6, y + 4, 185, y + 39), fill=fill)
            draw.rectangle((9, y + 7, 182, y + 10), fill="#FFFFFF" if index == 1 else C["cream"])
            draw.rectangle((9, y + 36, 182, y + 39), fill=C["navy"])
            draw.rectangle((6, y + 40, 185, y + 44), fill=C["ink"])
        save(sheet, f"ui/buttons/pp_ui_button_{name}_states.png", True)

    sheet = rgba((48, 192))
    draw = ImageDraw.Draw(sheet)
    for index, fill in enumerate((C["navy2"], C["aqua"], C["aqua_dark"], C["smoke"])):
        y = index * 48
        draw.rectangle((2, y + 2, 45, y + 45), fill=C["ink"])
        draw.rectangle((6, y + 6, 41, y + 39), fill=fill)
        draw.rectangle((21, y + 15, 25, y + 33), fill=C["cream"])
        draw.rectangle((14, y + 22, 32, y + 26), fill=C["cream"])
    save(sheet, "ui/buttons/pp_ui_button_icon_states.png", True)


def icon_canvas(name: str, size: int) -> Image.Image:
    img = rgba((size, size))
    d = ImageDraw.Draw(img)
    u = max(1, size // 24)
    center = size // 2
    if name == "timer":
        d.ellipse((4*u,4*u,size-4*u-1,size-4*u-1), fill=C["cream"], outline=C["ink"], width=2*u); d.line((center,7*u,center,center), fill=C["danger"], width=2*u); d.line((center,center,17*u,center), fill=C["danger"], width=2*u)
    elif name == "village_hp": pixel_heart(d, 5*u, 7*u, C["success"], 2*u)
    elif name in ("incident_count", "warning"):
        d.polygon([(center,2*u),(size-2*u,size-3*u),(2*u,size-3*u)], fill=C["warning"], outline=C["ink"]); d.rectangle((center-u,8*u,center+u,15*u), fill=C["ink"]); d.rectangle((center-u,18*u,center+u,20*u), fill=C["ink"])
    elif name == "rescued":
        d.ellipse((4*u,3*u,10*u,9*u), fill=C["buddy"], outline=C["ink"]); d.ellipse((14*u,3*u,20*u,9*u), fill=C["aqua"], outline=C["ink"]); d.rectangle((3*u,10*u,11*u,21*u), fill=C["buddy"], outline=C["ink"]); d.rectangle((13*u,10*u,21*u,21*u), fill=C["aqua"], outline=C["ink"])
    elif name == "command_count":
        d.rounded_rectangle((2*u,4*u,size-3*u,size-6*u), radius=2*u, fill=C["cream"], outline=C["ink"], width=2*u); d.polygon([(7*u,size-7*u),(5*u,size-2*u),(12*u,size-7*u)], fill=C["cream"], outline=C["ink"]); d.rectangle((6*u,9*u,size-7*u,11*u), fill=C["navy2"]); d.rectangle((6*u,14*u,size-10*u,16*u), fill=C["navy2"])
    elif name == "ai":
        d.rounded_rectangle((3*u,3*u,size-4*u,size-4*u), radius=3*u, fill=C["aqua"], outline=C["ink"], width=2*u); d.rectangle((8*u,9*u,11*u,12*u), fill=C["ink"]); d.rectangle((15*u,9*u,18*u,12*u), fill=C["ink"]); d.line((8*u,17*u,18*u,17*u), fill=C["ink"], width=2*u)
    elif name == "pause":
        d.rectangle((5*u,3*u,10*u,size-4*u), fill=C["cream"], outline=C["ink"]); d.rectangle((14*u,3*u,19*u,size-4*u), fill=C["cream"], outline=C["ink"])
    elif name.startswith("sound_"):
        d.polygon([(3*u,9*u),(8*u,9*u),(14*u,4*u),(14*u,20*u),(8*u,15*u),(3*u,15*u)], fill=C["cream"], outline=C["ink"])
        if name.endswith("on"):
            d.arc((10*u,5*u,22*u,19*u), -50, 50, fill=C["aqua"], width=2*u); d.arc((8*u,2*u,25*u,22*u), -50, 50, fill=C["aqua"], width=2*u)
        else:
            d.line((16*u,8*u,22*u,16*u), fill=C["danger"], width=3*u); d.line((22*u,8*u,16*u,16*u), fill=C["danger"], width=3*u)
    elif name == "fullscreen":
        for box in ((3,3,10,5),(3,3,5,10),(14,3,21,5),(19,3,21,10),(3,19,10,21),(3,14,5,21),(14,19,21,21),(19,14,21,21)): d.rectangle(tuple(v*u for v in box), fill=C["cream"])
    elif name in ("ready", "done"):
        d.ellipse((3*u,3*u,size-4*u,size-4*u), fill=C["success"], outline=C["ink"], width=2*u); d.line((7*u,13*u,11*u,17*u), fill=C["ink"], width=2*u); d.line((11*u,17*u,18*u,8*u), fill=C["ink"], width=2*u)
    elif name == "moving":
        d.polygon([(2*u,10*u),(14*u,10*u),(14*u,5*u),(22*u,12*u),(14*u,19*u),(14*u,14*u),(2*u,14*u)], fill=C["aqua"], outline=C["ink"])
    elif name == "working":
        d.line((5*u,19*u,18*u,6*u), fill=C["metal"], width=5*u); d.ellipse((14*u,2*u,22*u,10*u), fill=C["fix"], outline=C["ink"], width=2*u)
    elif name == "blocked":
        d.line((5*u,5*u,19*u,19*u), fill=C["danger"], width=4*u); d.line((19*u,5*u,5*u,19*u), fill=C["danger"], width=4*u)
    elif name.startswith("incident_"):
        subject = name.removeprefix("incident_")
        if subject == "fire":
            d.polygon([(center,1*u),(18*u,9*u),(16*u,10*u),(22*u,20*u),(center,23*u),(3*u,18*u),(8*u,9*u),(10*u,12*u)], fill=C["warning"], outline=C["ink"]); d.polygon([(center,9*u),(17*u,17*u),(center,21*u),(8*u,17*u)], fill=C["yellow_hot"])
        elif subject == "bridge":
            d.rectangle((2*u,8*u,22*u,16*u), fill=C["wood"], outline=C["ink"], width=2*u); d.line((11*u,6*u,8*u,18*u), fill=C["ink"], width=2*u); d.line((15*u,6*u,18*u,18*u), fill=C["ink"], width=2*u)
        elif subject == "cat":
            d.polygon([(4*u,8*u),(4*u,3*u),(9*u,7*u),(15*u,7*u),(20*u,3*u),(20*u,18*u),(16*u,22*u),(8*u,22*u),(4*u,18*u)], fill=C["cream"], outline=C["ink"]); d.rectangle((8*u,11*u,10*u,13*u), fill=C["ink"]); d.rectangle((15*u,11*u,17*u,13*u), fill=C["ink"])
        else:
            d.polygon([(13*u,1*u),(5*u,13*u),(11*u,13*u),(8*u,23*u),(20*u,9*u),(14*u,9*u)], fill=C["fix"], outline=C["ink"])
    elif name.startswith("action_"):
        action = name.removeprefix("action_")
        colors = {"extinguish": C["aqua"], "repair": C["fix"], "rescue": C["buddy"], "move": C["aqua"], "wait": C["cream"], "evacuate": C["success"]}
        d.ellipse((3*u,3*u,size-4*u,size-4*u), fill=colors[action], outline=C["ink"], width=2*u)
        if action == "extinguish": d.polygon([(center,4*u),(7*u,15*u),(center,21*u),(17*u,15*u)], fill=C["water_dark"])
        elif action == "repair": d.line((7*u,18*u,18*u,7*u), fill=C["ink"], width=4*u)
        elif action == "rescue": pixel_heart(d, 8*u, 8*u, C["cream"], u)
        elif action == "move": d.polygon([(5*u,10*u),(14*u,10*u),(14*u,5*u),(21*u,12*u),(14*u,19*u),(14*u,14*u),(5*u,14*u)], fill=C["ink"])
        elif action == "wait": d.ellipse((8*u,5*u,17*u,18*u), outline=C["ink"], width=2*u); d.line((12*u,7*u,12*u,13*u), fill=C["ink"], width=2*u)
        else: d.line((5*u,18*u,19*u,6*u), fill=C["ink"], width=3*u)
    elif name.startswith("quick_"):
        subject = {"quick_fire_first": "fire", "quick_rescue_first": "cat", "quick_nearest": "move", "quick_high_risk": "warning"}[name]
        if subject in ("fire", "cat"):
            target = f"incident_{subject}"
        elif subject == "move":
            target = "action_move"
        else:
            target = subject
        base = icon_canvas(target, size)
        return base
    return img


def make_icons() -> None:
    groups = {
        24: ["timer","village_hp","incident_count","rescued","command_count","ai","pause","sound_on","sound_off","fullscreen","ready","moving","working","blocked","done","warning","quick_fire_first","quick_rescue_first","quick_nearest","quick_high_risk"],
        32: ["incident_fire","incident_bridge","incident_cat","incident_generator","action_extinguish","action_repair","action_rescue","action_move","action_wait","action_evacuate"],
    }
    for size, names in groups.items():
        for name in names:
            save(icon_canvas(name, size), f"ui/icons/pp_ui_icon_{name}.png", True)


def make_portraits() -> None:
    for robot in ("aqua", "fix", "buddy"):
        for state in ("ready", "busy", "fail"):
            base = rgba((32, 32))
            d = ImageDraw.Draw(base)
            d.rectangle((0, 0, 31, 31), fill=C["navy"])
            d.rectangle((2, 2, 29, 29), fill="#405273")
            draw_robot(base, robot, state)
            save(scale(base, 2), f"ui/portraits/pp_ui_portrait_{robot}_{state}.png", True)


def make_grades_badges() -> None:
    grade_colors = {"s": C["fix"], "a": "#52E0C4", "b": C["aqua"], "c": C["warning"], "f": C["smoke"]}
    for grade, color in grade_colors.items():
        img = rgba((64, 64))
        d = ImageDraw.Draw(img)
        d.polygon([(32,1),(39,15),(57,7),(50,24),(63,32),(49,40),(57,57),(39,49),(32,63),(24,49),(7,57),(15,40),(1,32),(15,24),(7,7),(24,15)], fill=color, outline=C["ink"])
        d.ellipse((13, 13, 51, 51), fill=C["navy"], outline=C["cream"], width=2)
        hard_text(img, (32, 33), grade.upper(), 31, color)
        save(scale(img, 2), f"ui/pp_ui_grade_{grade}.png", True)
    for name, accent in (("mission_complete", C["success"]), ("mission_failed", C["danger"])):
        img = rgba((160, 40))
        d = ImageDraw.Draw(img)
        d.polygon([(0,7),(14,7),(20,0),(140,0),(146,7),(159,7),(153,20),(159,33),(146,33),(140,39),(20,39),(14,33),(0,33),(6,20)], fill=C["ink"])
        d.polygon([(5,10),(17,10),(23,4),(137,4),(143,10),(154,10),(149,20),(154,30),(143,30),(137,35),(23,35),(17,30),(5,30),(10,20)], fill=accent)
        d.rectangle((20,8,140,31), fill=C["navy"])
        save(scale(img, 2), f"ui/pp_ui_badge_{name}.png", True)


def make_spinner() -> None:
    sheet = rgba((256, 32))
    for frame in range(8):
        tile = rgba((32, 32))
        d = ImageDraw.Draw(tile)
        d.rectangle((6, 13, 26, 25), fill=C["navy"], outline=C["ink"], width=2)
        d.rectangle((10, 6, 22, 15), fill=C["smoke"], outline=C["ink"], width=2)
        lights = [(11,7),(16,7),(21,7)]
        for index, (x,y) in enumerate(lights): d.rectangle((x-2,y,x+1,y+4), fill=(C["aqua"],C["fix"],C["buddy"])[(index+frame)%3])
        sheet.alpha_composite(tile, (frame * 32, 0))
    save(sheet, "ui/pp_ui_loading_spinner.png", True)


def make_map_placeholder() -> None:
    img = rgba((640, 272), C["grass"])
    d = ImageDraw.Draw(img)
    # Tile-aligned paths, river, bridge and recognizable incident zones.
    for x in range(0, 640, 16):
        for y in range(0, 272, 16):
            if (x // 16 + y // 16) % 7 == 0: d.rectangle((x+3,y+4,x+5,y+6), fill="#6FB45F")
    d.rectangle((400,0,463,271), fill=C["water_dark"])
    for y in range(0,272,16): d.rectangle((407,y+5,456,y+7), fill=C["water"])
    d.rectangle((0,112,639,159), fill=C["dirt"])
    d.rectangle((128,0,175,271), fill=C["dirt"])
    d.rectangle((360,112,496,159), fill=C["wood"], outline=C["ink"], width=3)
    for x in range(366,492,16): d.rectangle((x,118,x+10,153), fill="#C77D4B", outline=C["ink"])
    # Four gameplay zones, using icon silhouettes rather than baked labels.
    building(d, 104, 20, 72, 62, "#E9A266", "#B95742", "bread")
    building(d, 260, 14, 68, 59, "#E1C197", "#B95742", "heart")
    building(d, 520, 18, 72, 62, "#B9CCD8", "#465A7A", "bolt")
    building(d, 90, 188, 92, 66, "#D8E2E8", "#34486B", "heart")
    d.ellipse((215,173,335,258), fill="#E3C17F", outline=C["wood"], width=3)
    for x,y in ((25,30),(195,30),(340,35),(595,105),(35,210),(345,210),(540,210),(612,230)):
        d.rectangle((x+7,y+17,x+11,y+30), fill=C["wood"]); d.ellipse((x,y,x+20,y+22), fill=C["grass_dark"], outline=C["ink"]); d.rectangle((x+5,y+5,x+14,y+12), fill=C["grass"])
    save(scale(img, 2), "ui/pp_placeholder_map.png", True)


def make_placeholders() -> None:
    make_map_placeholder()
    for robot in ("aqua", "fix", "buddy"):
        tile = rgba((32, 32)); draw_robot(tile, robot); save(scale(tile, 2), f"ui/pp_placeholder_robot_{robot}.png", True)
    for incident in ("fire", "bridge", "cat", "generator"):
        tile = icon_canvas(f"incident_{incident}", 32)
        save(scale(tile, 2), f"ui/pp_placeholder_incident_{incident}.png", True)


def install_style_board(reference: Path | None) -> None:
    preserved = SRC / "style/pp_style_board.png"
    if reference and reference.exists():
        image = Image.open(reference).convert("RGBA").resize((1920, 1080), NEAREST)
        save(image, "style/pp_style_board.png", True)
    elif preserved.exists():
        # The reviewed ImageGen board is source provenance, not a disposable
        # procedural artifact. Reuse it without overwriting it on regeneration.
        image = Image.open(preserved).convert("RGBA")
        save(image, "style/pp_style_board.png", False)
    else:
        image = scene_background("title").resize((1920, 1080), NEAREST)
        save(image, "style/pp_style_board.png", True)


def main() -> None:
    ensure_dirs()
    reference = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    make_logo()
    make_screens()
    make_panels()
    make_buttons()
    make_icons()
    make_portraits()
    make_grades_badges()
    make_spinner()
    make_placeholders()
    install_style_board(reference)
    print(f"Generated Phase 1 assets in {OUT}")


if __name__ == "__main__":
    main()
