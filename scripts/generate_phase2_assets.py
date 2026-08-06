#!/usr/bin/env python3
"""Build exact Phase 2 world assets from approved image-generation source boards."""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets-src/pixel-panic/world"
OUT = ROOT / "frontend/public/assets/pixel-panic/world"
REF = SRC / "reference"
NEAREST = Image.Resampling.NEAREST

C = {
    "ink": "#172033", "navy": "#24314D", "cream": "#FFF4D6", "aqua": "#39BFF2",
    "aqua_dark": "#1975C5", "fix": "#FFD34E", "fix_dark": "#D98C2B", "buddy": "#FF6577",
    "buddy_dark": "#C93F5B", "success": "#70D98B", "warning": "#F58B3D", "danger": "#F04455",
    "grass": "#80C96B", "grass_dark": "#3F8F5B", "water": "#54C7EC", "water_dark": "#287DB2",
    "dirt": "#D7AA68", "wood": "#9B603F", "metal": "#A9C4D4", "smoke": "#667085",
}


def rgba(size: tuple[int, int], fill=(0, 0, 0, 0)) -> Image.Image:
    return Image.new("RGBA", size, fill)


def hard_alpha(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    alpha = image.getchannel("A").point(lambda value: 255 if value >= 112 else 0)
    image.putalpha(alpha)
    return image


def save_both(image: Image.Image, relative: str) -> None:
    image = image.convert("RGBA")
    for base in (SRC, OUT):
        target = base / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target, "PNG", optimize=base == OUT)


def save_json_both(payload: object, relative: str) -> None:
    for base in (SRC, OUT):
        target = base / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def extract_cell(board: Image.Image, col: int, row: int, cols: int, rows: int) -> Image.Image:
    x0 = round(col * board.width / cols)
    x1 = round((col + 1) * board.width / cols)
    y0 = round(row * board.height / rows)
    y1 = round((row + 1) * board.height / rows)
    cell = board.crop((x0, y0, x1, y1)).convert("RGBA")
    bbox = cell.getchannel("A").getbbox()
    return cell.crop(bbox) if bbox else cell


def fit_sprite(sprite: Image.Image, size: tuple[int, int], padding: int = 1, align: str = "bottom") -> Image.Image:
    sprite = hard_alpha(sprite)
    max_w = max(1, size[0] - padding * 2)
    max_h = max(1, size[1] - padding * 2)
    ratio = min(max_w / sprite.width, max_h / sprite.height)
    resized = sprite.resize((max(1, round(sprite.width * ratio)), max(1, round(sprite.height * ratio))), NEAREST)
    canvas = rgba(size)
    x = (size[0] - resized.width) // 2
    y = padding if align == "top" else (size[1] - resized.height if align == "bottom" else (size[1] - resized.height) // 2)
    canvas.alpha_composite(resized, (x, y))
    return hard_alpha(canvas)


def make_map_preview() -> None:
    master = Image.open(REF / "pp_stage_01_master.png").convert("RGBA")
    # The model produced a 1923×817 image for a 40:17 target. Crop to an exact 40:17 multiple.
    target_ratio = 40 / 17
    crop_w = min(master.width, round(master.height * target_ratio))
    crop_h = min(master.height, round(crop_w / target_ratio))
    crop_w -= crop_w % 40
    crop_h = round(crop_w * 17 / 40)
    left = (master.width - crop_w) // 2
    top = (master.height - crop_h) // 2
    preview = master.crop((left, top, left + crop_w, top + crop_h)).resize((1280, 544), NEAREST)
    save_both(preview, "maps/pp_stage_01_preview.png")


def make_buildings() -> None:
    board = Image.open(REF / "pp_buildings_board_alpha.png").convert("RGBA")
    specs = [
        (0, 0, "pp_world_building_bakery_base.png", (96, 80)),
        (1, 0, "pp_world_building_bakery_damaged.png", (96, 80)),
        (2, 0, "pp_world_building_cat_house_base.png", (80, 72)),
        (0, 1, "pp_world_building_power_station_base.png", (80, 72)),
        (1, 1, "pp_world_building_power_station_restored.png", (80, 72)),
        (2, 1, "pp_world_building_rescue_hq.png", (112, 80)),
        (0, 2, "pp_world_building_house_a.png", (64, 64)),
        (1, 2, "pp_world_building_house_b.png", (64, 64)),
        (2, 2, "pp_world_building_shop.png", (80, 64)),
    ]
    for col, row, name, size in specs:
        save_both(fit_sprite(extract_cell(board, col, row, 3, 3), size), f"buildings/{name}")

    cat = extract_cell(board, 2, 0, 3, 3)
    bbox = cat.getchannel("A").getbbox()
    if bbox:
        cat = cat.crop(bbox)
    roof = cat.crop((0, 0, cat.width, max(1, round(cat.height * 0.58))))
    save_both(fit_sprite(roof, (80, 32), align="top"), "buildings/pp_world_building_cat_house_roof_fg.png")


def make_props_and_bridges() -> None:
    board = Image.open(REF / "pp_props_board_alpha.png").convert("RGBA")
    bridge_names = ["intact", "broken", "repairing", "repaired"]
    for col, state in enumerate(bridge_names):
        sprite = extract_cell(board, col, 0, 4, 4)
        save_both(fit_sprite(sprite, (160, 48), padding=0), f"incidents/pp_world_bridge_{state}.png")

    prop_specs = [
        (0, 1, "pp_world_prop_tree.png", (128, 48)),
        (1, 1, "pp_world_prop_bush.png", (96, 24)),
        (2, 1, "pp_world_prop_flower_patch.png", (64, 16)),
        (3, 1, "pp_world_prop_fence.png", (160, 16)),
        (0, 2, "pp_world_prop_streetlamp.png", (32, 32)),
        (1, 2, "pp_world_prop_bench.png", (64, 16)),
        (2, 2, "pp_world_prop_sign_incident.png", (24, 32)),
        (3, 2, "pp_world_prop_hydrant.png", (16, 24)),
        (0, 3, "pp_world_prop_crate.png", (16, 16)),
        (1, 3, "pp_world_prop_barrier.png", (64, 16)),
        (2, 3, "pp_world_prop_roof_ladder.png", (16, 48)),
        (3, 3, "pp_world_prop_evacuate_flag.png", (24, 32)),
    ]
    for col, row, name, size in prop_specs:
        save_both(fit_sprite(extract_cell(board, col, row, 4, 4), size, padding=0), f"props/{name}")


def tile_base(fill: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = rgba((16, 16), fill)
    return image, ImageDraw.Draw(image)


def make_tileset() -> None:
    sheet = rgba((256, 256))
    for index in range(128):
        if index < 16:
            tile, draw = tile_base(C["grass"])
            if index:
                x = 3 + (index * 5) % 10; y = 3 + (index * 7) % 10
                color = C["grass_dark"] if index % 3 else C["cream"]
                draw.rectangle((x, y, x + 1, y + 1), fill=color)
                if index >= 8: draw.rectangle((12 - index % 4, 4 + index % 6, 13 - index % 4, 5 + index % 6), fill=C["fix"] if index % 2 else C["buddy"])
        elif index < 24:
            tile, draw = tile_base(C["dirt"])
            draw.rectangle((0, 0, 15, 1), fill="#E6C083"); draw.rectangle((0, 14, 15, 15), fill="#B9824E")
            draw.point((3 + index % 6, 6), fill=C["wood"]); draw.point((11, 10 + index % 3), fill="#E8C98F")
        elif index < 32:
            tile, draw = tile_base("#B8AE94")
            draw.line((0, 7, 15, 7), fill="#827A6C"); draw.line((7, 0, 7, 15), fill="#8D8576")
            draw.line((0, 8, 15, 8), fill="#D3CAB0"); draw.line((8, 0, 8, 15), fill="#D3CAB0")
        elif index < 48:
            tile, draw = tile_base(C["grass"])
            side = (index - 32) % 4
            if side == 0: draw.rectangle((0, 0, 15, 7), fill=C["dirt"])
            elif side == 1: draw.rectangle((8, 0, 15, 15), fill=C["dirt"])
            elif side == 2: draw.rectangle((0, 8, 15, 15), fill=C["dirt"])
            else: draw.rectangle((0, 0, 7, 15), fill=C["dirt"])
        elif index < 64:
            tile, draw = tile_base(C["water_dark"] if index % 2 else C["water"])
            y = 3 + (index * 3) % 10
            draw.line((0, y, 5, y), fill="#9AE8F7"); draw.line((10, (y + 6) % 16, 15, (y + 6) % 16), fill=C["aqua_dark"])
        elif index < 80:
            tile, draw = tile_base(C["water"])
            side = (index - 64) % 4
            if side == 0: draw.rectangle((0, 0, 15, 5), fill=C["grass_dark"]); draw.line((0, 5, 15, 5), fill=C["wood"])
            elif side == 1: draw.rectangle((10, 0, 15, 15), fill=C["grass_dark"]); draw.line((10, 0, 10, 15), fill=C["wood"])
            elif side == 2: draw.rectangle((0, 10, 15, 15), fill=C["grass_dark"]); draw.line((0, 10, 15, 10), fill=C["wood"])
            else: draw.rectangle((0, 0, 5, 15), fill=C["grass_dark"]); draw.line((5, 0, 5, 15), fill=C["wood"])
        elif index < 96:
            tile, draw = tile_base("#C9B890")
            draw.rectangle((0, 0, 15, 1), fill="#E5D5AE"); draw.line((7, 2, 7, 15), fill="#978C76"); draw.line((0, 8, 15, 8), fill="#978C76")
        elif index < 112:
            fills = ("#826445", "#444955", "#4C7A64", "#6E5A49")
            tile, draw = tile_base(fills[(index - 96) % len(fills)])
            draw.rectangle((3, 4, 6, 6), fill=C["ink"]); draw.rectangle((11, 10, 13, 12), fill=C["smoke"])
        else:
            tile, draw = tile_base("#553A68" if index % 2 else C["ink"])
            draw.rectangle((2, 2, 13, 13), outline=C["danger"] if index % 2 else C["fix"], width=1)
        sheet.alpha_composite(tile, ((index % 16) * 16, (index // 16) * 16))
    save_both(sheet, "tilesets/pp_world_tileset_terrain_core.png")

    water = rgba((64, 16))
    flowers = rgba((64, 16))
    for frame in range(4):
        tile, draw = tile_base(C["water"])
        draw.line(((frame * 3) % 12, 5, (frame * 3) % 12 + 4, 5), fill="#A2EBF8")
        draw.line(((frame * 5 + 7) % 12, 11, (frame * 5 + 7) % 12 + 3, 11), fill=C["water_dark"])
        water.alpha_composite(tile, (frame * 16, 0))

        flower, draw = tile_base(C["grass"])
        stem_x = 7 + (1 if frame == 1 else -1 if frame == 3 else 0)
        draw.line((8, 14, stem_x, 7), fill=C["grass_dark"])
        draw.rectangle((stem_x - 2, 4, stem_x + 2, 8), fill=C["buddy"])
        draw.point((stem_x, 6), fill=C["fix"])
        flowers.alpha_composite(flower, (frame * 16, 0))
    save_both(water, "tilesets/pp_world_tile_water_loop.png")
    save_both(flowers, "tilesets/pp_world_tile_flower_sway.png")


def draw_generator(state: str, frame: int = 0) -> Image.Image:
    image = rgba((48, 48))
    draw = ImageDraw.Draw(image)
    draw.ellipse((7, 34, 41, 43), fill=(23, 32, 51, 90))
    draw.rectangle((7, 12, 41, 38), fill=C["ink"])
    draw.rectangle((10, 9, 38, 35), fill="#566C7D")
    draw.rectangle((13, 13, 35, 30), fill=C["navy"])
    draw.rectangle((16, 16, 32, 27), fill=C["aqua_dark"] if state == "on" else "#353D49")
    draw.rectangle((11, 33, 17, 39), fill=C["metal"]); draw.rectangle((31, 33, 37, 39), fill=C["metal"])
    draw.rectangle((5, 19, 10, 28), fill=C["fix_dark"]); draw.rectangle((38, 19, 43, 28), fill=C["fix_dark"])
    if state == "on":
        draw.rectangle((18, 18, 30, 25), fill=C["aqua"] if frame % 2 == 0 else C["cream"])
        draw.rectangle((13, 10, 17, 13), fill=C["success"]); draw.rectangle((31, 10, 35, 13), fill=C["success"])
    if state in ("sparking", "repairing"):
        color = C["fix"] if frame % 2 == 0 else C["cream"]
        x = 30 + (frame * 3) % 10; y = 6 + (frame * 5) % 14
        draw.line((x, y, x - 4, y + 5, x, y + 5, x - 3, y + 11), fill=color, width=2)
    if state == "repairing":
        draw.line((8 + frame * 2, 8, 20 + frame, 26), fill=C["metal"], width=3)
    return hard_alpha(image)


def make_generators() -> None:
    save_both(draw_generator("off"), "incidents/pp_world_generator_off.png")
    for state, frames in (("sparking", 4), ("repairing", 6), ("on", 4)):
        sheet = rgba((48 * frames, 48))
        for frame in range(frames): sheet.alpha_composite(draw_generator(state, frame), (48 * frame, 0))
        save_both(sheet, f"incidents/pp_world_generator_{state}.png")


def make_incident_markers() -> None:
    ui_icons = ROOT / "frontend/public/assets/pixel-panic/ui/icons"
    for incident in ("fire", "bridge", "cat", "generator"):
        marker = rgba((32, 48))
        draw = ImageDraw.Draw(marker)
        draw.ellipse((1, 1, 30, 30), fill=C["cream"], outline=C["ink"], width=2)
        draw.ellipse((4, 4, 27, 27), fill=C["navy"])
        icon = Image.open(ui_icons / f"pp_ui_icon_incident_{incident}.png").convert("RGBA").resize((22, 22), NEAREST)
        marker.alpha_composite(icon, (5, 5))
        draw.polygon([(11, 29), (21, 29), (16, 43)], fill=C["danger"], outline=C["ink"])
        draw.rectangle((13, 43, 19, 46), fill=C["ink"])
        save_both(marker, f"incidents/pp_world_incident_marker_{incident}.png")

    pulse = rgba((192, 32)); ring = rgba((192, 32))
    for frame in range(6):
        tile = rgba((32, 32)); draw = ImageDraw.Draw(tile)
        inset = max(1, 7 - frame)
        draw.ellipse((inset, inset, 31 - inset, 31 - inset), outline=C["danger"], width=2)
        pulse.alpha_composite(tile, (frame * 32, 0))
        tile2 = rgba((32, 32)); draw2 = ImageDraw.Draw(tile2)
        draw2.ellipse((3 + frame % 3, 9 + frame % 2, 28 - frame % 3, 24 - frame % 2), outline=C["aqua"], width=2)
        ring.alpha_composite(tile2, (frame * 32, 0))
    save_both(pulse, "incidents/pp_world_incident_marker_pulse.png")
    save_both(ring, "incidents/pp_world_target_ring.png")

    arrows = rgba((128, 16))
    for frame in range(8):
        tile = rgba((16, 16)); draw = ImageDraw.Draw(tile)
        offset = frame % 4
        draw.polygon([(2 + offset, 6), (9 + offset, 6), (9 + offset, 3), (14, 8), (9 + offset, 13), (9 + offset, 10), (2 + offset, 10)], fill=C["aqua"], outline=C["ink"])
        arrows.alpha_composite(tile, (frame * 16, 0))
    save_both(arrows, "incidents/pp_world_path_arrow.png")


def build_map_data() -> None:
    width, height = 40, 17
    cells = width * height
    ground = [1] * cells
    detail = [0] * cells
    water = [0] * cells
    path = [0] * cells
    collision = [0] * cells

    def put(layer: list[int], x: int, y: int, value: int) -> None:
        if 0 <= x < width and 0 <= y < height: layer[y * width + x] = value

    # Three-tile horizontal and vertical roads; water remains a separate collision layer.
    for y in range(7, 10):
        for x in range(width): put(path, x, y, 17)
    for x in range(9, 12):
        for y in range(height): put(path, x, y, 17)
    for x in range(19, 22):
        for y in range(7, height): put(path, x, y, 25)
    for x in range(31, 34):
        for y in range(height): put(path, x, y, 17)
    for y in range(17):
        for x in range(25, 29):
            put(water, x, y, 49 + (y + x) % 4)
            put(collision, x, y, 1)

    # Buildings and large collision props. Spawn apron in front of HQ remains walkable.
    for x0, x1, y0, y1 in ((2, 9, 1, 5), (12, 18, 1, 5), (32, 38, 1, 5), (2, 9, 11, 12)):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): put(collision, x, y, 1)
    for x, y in ((1,1),(20,2),(23,4),(1,15),(20,15),(37,15),(38,10)):
        put(collision, x, y, 1)

    incidents = [
        {"name":"bakery_fire", "x":6, "y":4, "properties":{"incident_id":"fire", "target_type":"building", "state":"active", "interaction_radius":3, "interaction_tile":[10,5], "marker_pixel":[300,144]}},
        {"name":"rooftop_cat", "x":15, "y":3, "properties":{"incident_id":"cat", "target_type":"animal", "state":"active", "interaction_radius":3, "interaction_tile":[19,5], "marker_pixel":[496,112]}},
        {"name":"generator_failure", "x":35, "y":4, "properties":{"incident_id":"generator", "target_type":"machine", "state":"active", "interaction_radius":3, "interaction_tile":[31,5], "marker_pixel":[992,144], "requires":"bridge_repaired"}},
        {"name":"broken_bridge", "x":26, "y":8, "properties":{"incident_id":"bridge", "target_type":"structure", "state":"active", "interaction_radius":3, "interaction_tile":[24,8], "marker_pixel":[848,272]}},
    ]
    spawns = [
        {"id":"aqua", "tile":[5,13], "pixel":[176,432]},
        {"id":"fix", "tile":[6,13], "pixel":[208,432]},
        {"id":"buddy", "tile":[7,13], "pixel":[240,432]},
    ]
    object_layers = {
        "buildings_back": [
            {"id":"bakery", "asset":"pp_world_building_bakery_damaged", "tile":[6,6], "origin":[0.5,1.0]},
            {"id":"cat_house", "asset":"pp_world_building_cat_house_base", "tile":[15,6], "origin":[0.5,1.0]},
            {"id":"power_station", "asset":"pp_world_building_power_station_base", "tile":[35,6], "origin":[0.5,1.0]},
            {"id":"rescue_hq", "asset":"pp_world_building_rescue_hq", "tile":[6,16], "origin":[0.5,1.0]},
        ],
        "props_back": [],
        "props_front": [],
        "fx_front": [],
    }

    layers = [
        {"name":"ground", "type":"tilelayer", "data":ground},
        {"name":"ground_detail", "type":"tilelayer", "data":detail},
        {"name":"water", "type":"tilelayer", "data":water},
        {"name":"path", "type":"tilelayer", "data":path},
        {"name":"buildings_back", "type":"objectgroup", "objects":object_layers["buildings_back"]},
        {"name":"collision", "type":"tilelayer", "data":collision, "visible":False},
        {"name":"props_back", "type":"objectgroup", "objects":[]},
        {"name":"incidents", "type":"objectgroup", "objects":incidents},
        {"name":"actors", "type":"objectgroup", "objects":spawns},
        {"name":"props_front", "type":"objectgroup", "objects":[]},
        {"name":"fx_front", "type":"objectgroup", "objects":[]},
        {"name":"markers_debug", "type":"objectgroup", "objects":[], "visible":False},
    ]
    tilemap = {
        "type":"map", "version":1, "orientation":"orthogonal", "renderorder":"right-down",
        "width":width, "height":height, "tilewidth":16, "tileheight":16, "runtimeScale":2,
        "tilesets":[{"firstgid":1, "source":"../tilesets/pp_world_tileset_terrain_core.png", "columns":16, "tilecount":256}],
        "layers":layers,
    }
    collision_payload = {
        "version":1, "width":width, "height":height, "tileSize":16, "runtimeTileSize":32,
        "blocked":collision,
        "dependencies":[{"incident_id":"generator", "requires":"bridge_repaired", "reason":"vertical river and broken bridge block the east bank"}],
    }
    spawn_payload = {
        "version":1, "mapOrigin":[0,0], "runtimeHudOffsetY":64, "actors":spawns,
        "incidents":incidents,
        "fx_slots":{
            "fire":[[6,3],[7,4]], "cat_help":[[15,2]], "generator_sparks":[[35,4]], "bridge_dust":[[26,8]]
        },
    }
    save_json_both(tilemap, "maps/pp_stage_01.json")
    save_json_both(collision_payload, "maps/pp_stage_01_collision.json")
    save_json_both(spawn_payload, "maps/pp_stage_01_spawn_points.json")


def main() -> None:
    required = [REF / "pp_stage_01_master.png", REF / "pp_buildings_board_alpha.png", REF / "pp_props_board_alpha.png"]
    missing = [str(path) for path in required if not path.exists()]
    if missing: raise SystemExit(f"Missing Phase 2 source images: {missing}")
    make_map_preview()
    make_buildings()
    make_props_and_bridges()
    make_tileset()
    make_generators()
    make_incident_markers()
    build_map_data()
    print(f"Generated Phase 2 world assets in {OUT}")


if __name__ == "__main__":
    main()
