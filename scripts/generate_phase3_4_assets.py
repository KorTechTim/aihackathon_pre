#!/usr/bin/env python3
"""Build the final PIXEL PANIC character, FX and screen assets.

The large reference boards were generated once, reviewed by a human, and kept in
assets-src.  This script deterministically turns those masters into the exact
runtime sheets required by the Phase 3/4 work order.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets-src/pixel-panic"
OUT = ROOT / "frontend/public/assets/pixel-panic"
NEAREST = Image.Resampling.NEAREST
LANCZOS = Image.Resampling.LANCZOS

COLORS = {
    "ink": "#172033",
    "navy": "#24314D",
    "cream": "#FFF4D6",
    "aqua": "#39BFF2",
    "fix": "#FFD34E",
    "buddy": "#FF6577",
    "danger": "#F04455",
    "success": "#70D98B",
}


def rgba(size: tuple[int, int], fill=(0, 0, 0, 0)) -> Image.Image:
    return Image.new("RGBA", size, fill)


def hard_alpha(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    alpha = image.getchannel("A").point(lambda value: 255 if value >= 96 else 0)
    image.putalpha(alpha)
    return image


def save_png(image: Image.Image, relative: str, source_copy: bool = True) -> None:
    image = image.convert("RGBA")
    target = OUT / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "PNG", optimize=True)
    if source_copy:
        source_target = SRC / relative
        source_target.parent.mkdir(parents=True, exist_ok=True)
        image.save(source_target, "PNG", optimize=True)


def extract_cell(board: Image.Image, col: int, row: int, cols: int, rows: int) -> Image.Image:
    x0 = round(col * board.width / cols)
    x1 = round((col + 1) * board.width / cols)
    y0 = round(row * board.height / rows)
    y1 = round((row + 1) * board.height / rows)
    cell = board.crop((x0, y0, x1, y1)).convert("RGBA")
    bbox = cell.getchannel("A").getbbox()
    if not bbox:
        return cell
    pad = 2
    return cell.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(cell.width, bbox[2] + pad), min(cell.height, bbox[3] + pad)))


def fit_sprite(sprite: Image.Image, size: tuple[int, int], padding: int = 1, x_offset: int = 0, y_offset: int = 0, flip: bool = False) -> Image.Image:
    sprite = hard_alpha(ImageOps.mirror(sprite) if flip else sprite)
    max_w, max_h = size[0] - padding * 2, size[1] - padding * 2
    ratio = min(max_w / sprite.width, max_h / sprite.height)
    # Downsample smoothly, then harden alpha. The source board already contains
    # deliberately stepped pixels, so this keeps expressions readable at 32px.
    resized = sprite.resize((max(1, round(sprite.width * ratio)), max(1, round(sprite.height * ratio))), LANCZOS)
    resized = ImageEnhance.Sharpness(resized).enhance(1.8)
    resized = hard_alpha(resized)
    canvas = rgba(size)
    x = (size[0] - resized.width) // 2 + x_offset
    y = size[1] - padding - resized.height + y_offset
    canvas.alpha_composite(resized, (x, y))
    return canvas


def sheet_from_frames(frame_size: tuple[int, int], rows: list[list[Image.Image]]) -> Image.Image:
    cols = max(len(row) for row in rows)
    sheet = rgba((frame_size[0] * cols, frame_size[1] * len(rows)))
    for row_index, row in enumerate(rows):
        for col_index, frame in enumerate(row):
            sheet.alpha_composite(frame, (col_index * frame_size[0], row_index * frame_size[1]))
    return sheet


def animated_frames(sprite: Image.Image, count: int, size: tuple[int, int], mode: str = "idle") -> list[Image.Image]:
    frames: list[Image.Image] = []
    for index in range(count):
        if mode == "walk":
            y_offsets = (0, -1, 0, 1, 0, -1)
            x_offsets = (0, -1, 0, 1, 0, 1)
        elif mode in {"action", "panic", "cheer", "hop"}:
            y_offsets = (1, 0, -1, -2, -1, 0, 1, 0)
            x_offsets = (0, -1, 0, 1, 1, 0, -1, 0)
        else:
            y_offsets = (0, 0, -1, 0, 0, 0)
            x_offsets = (0, 0, 0, 0, 0, 0)
        frames.append(fit_sprite(sprite, size, x_offset=x_offsets[index % len(x_offsets)], y_offset=y_offsets[index % len(y_offsets)], flip=False))
    return frames


def make_robot_assets() -> None:
    board = Image.open(SRC / "characters/reference/pp_phase3_robot_board_alpha.png").convert("RGBA")
    robots = ("aqua", "fix", "buddy")
    action_names = {"aqua": "extinguish", "fix": "repair", "buddy": "rescue"}
    direction_cols = (0, 1, 2, 3)  # down, left, right, up

    for row, robot in enumerate(robots):
        direction_sources = [extract_cell(board, col, row, 6, 3) for col in direction_cols]
        action_source = extract_cell(board, 4, row, 6, 3)
        celebration_source = extract_cell(board, 5, row, 6, 3)

        idle_rows = [animated_frames(source, 4, (32, 32), "idle") for source in direction_sources]
        walk_rows = [animated_frames(source, 6, (32, 32), "walk") for source in direction_sources]
        action_rows: list[list[Image.Image]] = []
        for direction, source in enumerate(direction_sources):
            role_source = action_source if direction == 0 else source
            frames = animated_frames(role_source, 8, (32, 32), "action")
            action_rows.append(frames)

        save_png(sheet_from_frames((32, 32), idle_rows), f"characters/robots/pp_char_robot_{robot}_idle.png")
        save_png(sheet_from_frames((32, 32), walk_rows), f"characters/robots/pp_char_robot_{robot}_walk.png")
        save_png(sheet_from_frames((32, 32), action_rows), f"characters/robots/pp_char_robot_{robot}_{action_names[robot]}.png")
        save_png(sheet_from_frames((32, 32), [animated_frames(celebration_source, 6, (32, 32), "cheer")]), f"characters/robots/pp_char_robot_{robot}_celebrate.png")
        fail_frames = animated_frames(direction_sources[0], 4, (32, 32), "idle")
        for index, frame in enumerate(fail_frames):
            fail_frames[index] = ImageEnhance.Brightness(frame).enhance(0.62 + index * 0.03)
        save_png(sheet_from_frames((32, 32), [fail_frames]), f"characters/robots/pp_char_robot_{robot}_fail.png")

        if robot == "buddy":
            carry_rows = [animated_frames(action_source if direction == 0 else source, 6, (32, 32), "walk") for direction, source in enumerate(direction_sources)]
            save_png(sheet_from_frames((32, 32), carry_rows), "characters/robots/pp_char_robot_buddy_carry_walk.png")

        # Final UI portraits replace the Phase 1 programmer-art portraits.
        portrait_sources = {"ready": direction_sources[0], "busy": action_source, "fail": direction_sources[0]}
        for state, source in portrait_sources.items():
            portrait = fit_sprite(source, (64, 64), padding=2, y_offset=0)
            if state == "fail":
                portrait = ImageEnhance.Brightness(portrait).enhance(0.62)
            save_png(portrait, f"ui/portraits/pp_ui_portrait_{robot}_{state}.png")


def make_common_character_assets() -> None:
    shadow = rgba((24, 10))
    draw = ImageDraw.Draw(shadow)
    draw.ellipse((2, 2, 21, 8), fill=(23, 32, 51, 88))
    save_png(shadow, "characters/common/pp_char_shadow_small.png")
    for robot, color in (("aqua", COLORS["aqua"]), ("fix", COLORS["fix"]), ("buddy", COLORS["buddy"])):
        ring = rgba((32, 16))
        draw = ImageDraw.Draw(ring)
        draw.ellipse((2, 4, 29, 13), outline=COLORS["ink"], width=3)
        draw.ellipse((3, 3, 28, 12), outline=color, width=2)
        save_png(ring, f"characters/common/pp_char_selection_ring_{robot}.png")
    bubble = rgba((32, 40))
    draw = ImageDraw.Draw(bubble)
    draw.rounded_rectangle((2, 2, 29, 30), radius=7, fill=COLORS["cream"], outline=COLORS["ink"], width=3)
    draw.polygon(((12, 29), (20, 29), (16, 37)), fill=COLORS["cream"], outline=COLORS["ink"])
    save_png(bubble, "characters/common/pp_char_status_bubble.png")


def make_npc_and_cat_assets() -> None:
    board = Image.open(SRC / "characters/reference/pp_phase3_npc_cat_board_alpha.png").convert("RGBA")
    for col, npc in enumerate(("a", "b", "c", "d")):
        calm = extract_cell(board, col, 0, 5, 2)
        expressive = extract_cell(board, col, 1, 5, 2)
        idle_rows = [animated_frames(calm, 4, (32, 32), "idle") for _ in range(4)]
        evac_rows = [animated_frames(calm, 6, (32, 32), "walk") for _ in range(4)]
        save_png(sheet_from_frames((32, 32), idle_rows), f"characters/npcs/pp_char_npc_{npc}_idle.png")
        save_png(sheet_from_frames((32, 32), [animated_frames(expressive, 6, (32, 32), "panic")]), f"characters/npcs/pp_char_npc_{npc}_panic.png")
        save_png(sheet_from_frames((32, 32), evac_rows), f"characters/npcs/pp_char_npc_{npc}_evacuate_walk.png")
        save_png(sheet_from_frames((32, 32), [animated_frames(expressive, 6, (32, 32), "cheer")]), f"characters/npcs/pp_char_npc_{npc}_cheer.png")

    cat_idle = extract_cell(board, 4, 0, 5, 2)
    cat_action = extract_cell(board, 4, 1, 5, 2)
    cat_specs = (
        ("idle", cat_idle, 4, "idle"),
        ("meow", cat_action, 4, "panic"),
        ("hop", cat_action, 6, "hop"),
        ("rescued", cat_idle, 4, "cheer"),
    )
    for name, source, count, mode in cat_specs:
        save_png(sheet_from_frames((24, 24), [animated_frames(source, count, (24, 24), mode)]), f"characters/cat/pp_char_cat_{name}.png")
    save_png(fit_sprite(cat_idle, (24, 24), padding=1), "characters/cat/pp_char_cat_carry_socket.png")


def effect_frames(source: Image.Image, frame_size: tuple[int, int], count: int, style: str = "pulse") -> list[Image.Image]:
    fitted = fit_sprite(source, frame_size, padding=0)
    frames: list[Image.Image] = []
    for index in range(count):
        phase = index / max(1, count - 1)
        if style == "once":
            scale = 0.52 + 0.70 * phase
            opacity = 255 if phase < 0.76 else round(255 * (1 - phase) / 0.24)
        elif style == "stream":
            scale = 0.88 + (index % 3) * 0.06
            opacity = 255
        else:
            scale = 0.90 + (index % 4) * 0.035
            opacity = 230 + (index % 2) * 25
        width = max(1, round(frame_size[0] * scale))
        height = max(1, round(frame_size[1] * scale))
        resized = fitted.resize((width, height), NEAREST)
        if index % 2 and style != "stream":
            resized = ImageOps.mirror(resized)
        alpha = resized.getchannel("A").point(lambda value: round(value * opacity / 255))
        resized.putalpha(alpha)
        canvas = rgba(frame_size)
        x = (frame_size[0] - width) // 2
        y = frame_size[1] - height
        canvas.alpha_composite(resized, (x, y))
        frames.append(canvas)
    return frames


def make_fx_assets() -> None:
    board = Image.open(SRC / "fx/reference/pp_phase3_vfx_board_alpha.png").convert("RGBA")
    cell = lambda col, row: extract_cell(board, col, row, 4, 4)
    specs = [
        ("fire_small_loop", cell(0, 0), (24, 32), 6, "pulse"),
        ("fire_medium_loop", cell(1, 0), (32, 48), 8, "pulse"),
        ("fire_large_loop", cell(2, 0), (48, 64), 8, "pulse"),
        ("smoke_small_loop", cell(3, 0), (32, 48), 6, "pulse"),
        ("smoke_large_loop", cell(3, 0), (48, 64), 8, "pulse"),
        ("ember_particle", cell(0, 0), (8, 8), 4, "once"),
        ("water_jet_loop", cell(0, 1), (64, 24), 6, "stream"),
        ("water_splash", cell(1, 1), (48, 48), 8, "once"),
        ("steam_burst", cell(2, 1), (48, 48), 8, "once"),
        ("puddle_fade", cell(3, 1), (32, 16), 6, "once"),
        ("repair_spark", cell(0, 2), (32, 32), 6, "pulse"),
        ("hammer_impact", cell(1, 2), (32, 32), 5, "once"),
        ("dust_puff", cell(2, 2), (32, 32), 6, "once"),
        ("bolt_pop", cell(3, 2), (16, 16), 4, "once"),
        ("rescue_heart", cell(0, 3), (24, 24), 6, "once"),
        ("rescue_reach", cell(1, 3), (48, 32), 6, "once"),
        ("safe_landing", cell(1, 3), (32, 32), 6, "once"),
        ("electric_arc", cell(2, 3), (48, 48), 6, "pulse"),
        ("light_flicker", cell(2, 3), (32, 32), 4, "pulse"),
        ("power_restore_burst", cell(2, 3), (64, 64), 8, "once"),
        ("alert_ping", cell(0, 3), (64, 64), 6, "once"),
        ("task_assign", cell(1, 3), (64, 64), 8, "once"),
        ("task_complete", cell(0, 3), (64, 64), 8, "once"),
        ("confetti", cell(3, 3), (96, 96), 10, "once"),
        ("star_burst", cell(3, 3), (64, 64), 8, "once"),
    ]
    for name, source, frame_size, count, style in specs:
        save_png(sheet_from_frames(frame_size, [effect_frames(source, frame_size, count, style)]), f"fx/pp_fx_{name}.png")

    vignette = rgba((1280, 720))
    draw = ImageDraw.Draw(vignette)
    for index in range(28):
        alpha = max(0, 92 - index * 3)
        draw.rectangle((index * 4, index * 4, 1279 - index * 4, 719 - index * 4), outline=(240, 68, 85, alpha), width=4)
    save_png(vignette, "fx/pp_fx_danger_vignette.png")

    # The work order's horizontal 10,240px strip exceeds Phase 4's 2,048px
    # texture cap. Stack the same eight 1280×112 frames vertically instead.
    scanline = rgba((1280, 112 * 8))
    for frame in range(8):
        tile = rgba((1280, 112))
        draw = ImageDraw.Draw(tile)
        y = 8 + frame * 13
        draw.rectangle((0, y, 1279, min(111, y + 5)), fill=(57, 191, 242, 76))
        draw.rectangle((0, min(111, y + 2), 1279, min(111, y + 3)), fill=(255, 244, 214, 126))
        for x in range((frame * 41) % 128, 1280, 128):
            draw.rectangle((x, 0, min(1279, x + 1), 111), fill=(57, 191, 242, 22))
        scanline.alpha_composite(tile, (0, frame * 112))
    save_png(scanline, "fx/pp_fx_ai_scanline.png")


def crop_16_9(image: Image.Image) -> Image.Image:
    target_ratio = 16 / 9
    if image.width / image.height > target_ratio:
        width = round(image.height * target_ratio)
        left = (image.width - width) // 2
        return image.crop((left, 0, left + width, image.height))
    height = round(image.width / target_ratio)
    top = (image.height - height) // 2
    return image.crop((0, top, image.width, top + height))


def make_final_screens() -> None:
    screen_specs = {
        "title": "pp_phase4_title_master.png",
        "result_success": "pp_phase4_success_master.png",
        "result_fail": "pp_phase4_fail_master.png",
    }
    for name, filename in screen_specs.items():
        image = Image.open(SRC / "ui/reference" / filename).convert("RGB")
        image = crop_16_9(image).resize((1280, 720), LANCZOS)
        webp_path = OUT / f"ui/screens/pp_ui_screen_{name}_final.webp"
        webp_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(webp_path, "WEBP", quality=82, method=6)


def optimize_world_and_remove_legacy_runtime_files() -> None:
    source_map = SRC / "world/maps/pp_stage_01_preview.png"
    if not source_map.exists():
        source_map = OUT / "world/maps/pp_stage_01_preview.png"
    map_image = Image.open(source_map).convert("RGB")
    map_image.save(OUT / "world/maps/pp_stage_01_preview.webp", "WEBP", quality=80, method=6)

    # Phase 4 ships only runtime-ready graphics. The originals remain preserved
    # in assets-src for audit and regeneration.
    legacy = [
        OUT / "style/pp_style_board.png",
        OUT / "world/maps/pp_stage_01_preview.png",
        OUT / "ui/pp_placeholder_map.png",
        *[OUT / f"ui/pp_placeholder_robot_{name}.png" for name in ("aqua", "fix", "buddy")],
        *[OUT / f"ui/pp_placeholder_incident_{name}.png" for name in ("fire", "bridge", "cat", "generator")],
        *[OUT / f"ui/screens/pp_ui_screen_{name}_final.png" for name in ("title", "result_success", "result_fail")],
    ]
    for path in legacy:
        path.unlink(missing_ok=True)


def write_animation_manifest() -> None:
    animations: list[dict[str, object]] = []
    for robot in ("aqua", "fix", "buddy"):
        role_action = {"aqua": "extinguish", "fix": "repair", "buddy": "rescue"}[robot]
        for state, frames, rows, fps, repeat in (
            ("idle", 4, 4, 4, -1), ("walk", 6, 4, 8, -1), (role_action, 8, 4, 10, 0),
            ("celebrate", 6, 1, 8, 1), ("fail", 4, 1, 4, -1),
        ):
            events: list[dict[str, object]] = []
            if robot == "aqua" and state == "extinguish": events = [{"frame": 2, "event": "water-start"}, {"frame": 7, "event": "water-end"}]
            if robot == "fix" and state == "repair": events = [{"frame": 3, "event": "impact"}, {"frame": 6, "event": "impact"}]
            if robot == "buddy" and state == "rescue": events = [{"frame": 4, "event": "carry-socket"}]
            animations.append({
                "key": f"pp_char_robot_{robot}_{state}", "asset": f"characters/robots/pp_char_robot_{robot}_{state}.png",
                "frameWidth": 32, "frameHeight": 32, "framesPerRow": frames, "rows": rows,
                "directions": ["down", "left", "right", "up"][:rows], "fps": fps, "repeat": repeat,
                "origin": [0.5, 0.875], "events": events,
            })
        if robot == "buddy":
            animations.append({"key": "pp_char_robot_buddy_carry_walk", "asset": "characters/robots/pp_char_robot_buddy_carry_walk.png", "frameWidth": 32, "frameHeight": 32, "framesPerRow": 6, "rows": 4, "directions": ["down", "left", "right", "up"], "fps": 8, "repeat": -1, "origin": [0.5, 0.875], "events": []})

    for npc in ("a", "b", "c", "d"):
        for state, frames, rows, fps, repeat in (("idle", 4, 4, 4, -1), ("panic", 6, 1, 8, -1), ("evacuate_walk", 6, 4, 8, -1), ("cheer", 6, 1, 8, 1)):
            animations.append({"key": f"pp_char_npc_{npc}_{state}", "asset": f"characters/npcs/pp_char_npc_{npc}_{state}.png", "frameWidth": 32, "frameHeight": 32, "framesPerRow": frames, "rows": rows, "directions": ["down", "left", "right", "up"][:rows], "fps": fps, "repeat": repeat, "origin": [0.5, 0.875], "events": []})
    for state, frames, fps, repeat in (("idle", 4, 4, -1), ("meow", 4, 6, -1), ("hop", 6, 10, 0), ("rescued", 4, 6, -1)):
        events = [{"frame": 3, "event": "apex"}, {"frame": 5, "event": "land"}] if state == "hop" else []
        animations.append({"key": f"pp_char_cat_{state}", "asset": f"characters/cat/pp_char_cat_{state}.png", "frameWidth": 24, "frameHeight": 24, "framesPerRow": frames, "rows": 1, "fps": fps, "repeat": repeat, "origin": [0.5, 0.9], "events": events})

    (OUT / "manifests").mkdir(parents=True, exist_ok=True)
    (OUT / "manifests/animation-manifest.json").write_text(json.dumps({"version": 1, "animations": animations}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    make_robot_assets()
    make_common_character_assets()
    make_npc_and_cat_assets()
    make_fx_assets()
    make_final_screens()
    optimize_world_and_remove_legacy_runtime_files()
    write_animation_manifest()
    print("Phase 3/4 runtime assets generated")


if __name__ == "__main__":
    main()
