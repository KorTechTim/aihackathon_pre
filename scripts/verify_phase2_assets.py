#!/usr/bin/env python3
"""Validate Phase 2 world assets, map topology, collision and reachability."""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WORLD = ROOT / "frontend/public/assets/pixel-panic/world"

EXPECTED: dict[str, tuple[int, int]] = {
    "maps/pp_stage_01_preview.webp": (1280, 544),
    "maps/pp_stage_02_rain.webp": (1280, 544),
    "maps/pp_stage_03_night.webp": (1280, 544),
    "maps/pp_stage_04_autumn.webp": (1280, 544),
    "maps/pp_stage_05_winter.webp": (1280, 544),
    "maps/pp_stage_06_harbor.webp": (1280, 544),
    "maps/pp_stage_07_highland.webp": (1280, 544),
    "maps/pp_stage_08_canals.webp": (1280, 544),
    "maps/pp_stage_09_railway.webp": (1280, 544),
    "tilesets/pp_world_tileset_terrain_core.png": (256, 256),
    "tilesets/pp_world_tile_water_loop.png": (64, 16),
    "tilesets/pp_world_tile_flower_sway.png": (64, 16),
    "buildings/pp_world_building_bakery_base.png": (96, 80),
    "buildings/pp_world_building_bakery_damaged.png": (96, 80),
    "buildings/pp_world_building_cat_house_base.png": (80, 72),
    "buildings/pp_world_building_cat_house_roof_fg.png": (80, 32),
    "buildings/pp_world_building_power_station_base.png": (80, 72),
    "buildings/pp_world_building_power_station_restored.png": (80, 72),
    "buildings/pp_world_building_rescue_hq.png": (112, 80),
    "buildings/pp_world_building_house_a.png": (64, 64),
    "buildings/pp_world_building_house_b.png": (64, 64),
    "buildings/pp_world_building_shop.png": (80, 64),
    "incidents/pp_world_bridge_intact.png": (160, 48),
    "incidents/pp_world_bridge_broken.png": (160, 48),
    "incidents/pp_world_bridge_repairing.png": (160, 48),
    "incidents/pp_world_bridge_repaired.png": (160, 48),
    "incidents/pp_world_generator_off.png": (48, 48),
    "incidents/pp_world_generator_sparking.png": (192, 48),
    "incidents/pp_world_generator_repairing.png": (288, 48),
    "incidents/pp_world_generator_on.png": (192, 48),
    "props/pp_world_prop_tree.png": (128, 48),
    "props/pp_world_prop_bush.png": (96, 24),
    "props/pp_world_prop_flower_patch.png": (64, 16),
    "props/pp_world_prop_fence.png": (160, 16),
    "props/pp_world_prop_streetlamp.png": (32, 32),
    "props/pp_world_prop_bench.png": (64, 16),
    "props/pp_world_prop_sign_incident.png": (24, 32),
    "props/pp_world_prop_hydrant.png": (16, 24),
    "props/pp_world_prop_crate.png": (16, 16),
    "props/pp_world_prop_barrier.png": (64, 16),
    "props/pp_world_prop_roof_ladder.png": (16, 48),
    "props/pp_world_prop_evacuate_flag.png": (24, 32),
    "incidents/pp_world_incident_marker_fire.png": (32, 48),
    "incidents/pp_world_incident_marker_bridge.png": (32, 48),
    "incidents/pp_world_incident_marker_cat.png": (32, 48),
    "incidents/pp_world_incident_marker_generator.png": (32, 48),
    "incidents/pp_world_incident_marker_pulse.png": (192, 32),
    "incidents/pp_world_target_ring.png": (192, 32),
    "incidents/pp_world_path_arrow.png": (128, 16),
}

TRANSPARENT = {name for name in EXPECTED if not name.startswith("maps/") and "tileset_terrain_core" not in name and "tile_water" not in name and "tile_flower" not in name}
REQUIRED_LAYERS = ["ground", "ground_detail", "water", "path", "buildings_back", "collision", "props_back", "incidents", "actors", "props_front", "fx_front", "markers_debug"]


def reachable(blocked: list[int], width: int, height: int, start: tuple[int, int], goal: tuple[int, int]) -> bool:
    queue = deque([start])
    seen = {start}
    while queue:
        x, y = queue.popleft()
        if (x, y) == goal: return True
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height and not blocked[ny * width + nx] and (nx, ny) not in seen:
                seen.add((nx, ny)); queue.append((nx, ny))
    return False


def main() -> None:
    failures: list[str] = []
    total_bytes = 0
    for relative, expected_size in EXPECTED.items():
        path = WORLD / relative
        if not path.exists():
            failures.append(f"MISSING {relative}"); continue
        total_bytes += path.stat().st_size
        with Image.open(path) as image:
            if image.size != expected_size: failures.append(f"SIZE {relative}: {image.size} != {expected_size}")
            expected_mode = "RGB" if relative.endswith(".webp") else "RGBA"
            if image.mode != expected_mode: failures.append(f"MODE {relative}: {image.mode} != {expected_mode}")
            if relative.startswith("maps/") and image.mode == "RGBA" and image.getchannel("A").getextrema() != (255, 255): failures.append(f"ALPHA {relative}: preview must be opaque")
            if relative in TRANSPARENT:
                corners = [image.getpixel((0, 0))[3], image.getpixel((image.width - 1, 0))[3], image.getpixel((0, image.height - 1))[3], image.getpixel((image.width - 1, image.height - 1))[3]]
                if any(corners): failures.append(f"ALPHA {relative}: transparent padding required")

    data_paths = ["maps/pp_stage_01.json", "maps/pp_stage_01_collision.json", "maps/pp_stage_01_spawn_points.json"]
    for relative in data_paths:
        if not (WORLD / relative).exists(): failures.append(f"MISSING {relative}")
    if failures:
        report_failures(failures)

    tilemap = json.loads((WORLD / data_paths[0]).read_text(encoding="utf-8"))
    collision = json.loads((WORLD / data_paths[1]).read_text(encoding="utf-8"))
    spawns = json.loads((WORLD / data_paths[2]).read_text(encoding="utf-8"))
    if (tilemap.get("width"), tilemap.get("height"), tilemap.get("tilewidth"), tilemap.get("tileheight")) != (40, 17, 16, 16): failures.append("MAP logical size must be 40x17 at 16px")
    layer_names = [layer.get("name") for layer in tilemap.get("layers", [])]
    if layer_names != REQUIRED_LAYERS: failures.append(f"LAYERS {layer_names} != {REQUIRED_LAYERS}")
    for layer in tilemap.get("layers", []):
        if layer.get("type") == "tilelayer" and len(layer.get("data", [])) != 680: failures.append(f"LAYER DATA {layer.get('name')} != 680 cells")
    incidents = spawns.get("incidents", [])
    if {item.get("properties", {}).get("incident_id") for item in incidents} != {"fire", "bridge", "cat", "generator"}: failures.append("INCIDENT IDs incomplete")
    for item in incidents:
        props = item.get("properties", {})
        for key in ("incident_id", "target_type", "state", "interaction_radius", "interaction_tile", "marker_pixel"):
            if key not in props: failures.append(f"INCIDENT {item.get('name')} missing {key}")

    blocked = collision.get("blocked", [])
    actors = spawns.get("actors", [])
    targets = {item["properties"]["incident_id"]: tuple(item["properties"]["interaction_tile"]) for item in incidents}
    for actor in actors:
        start = tuple(actor["tile"])
        for incident_id in ("fire", "cat", "bridge"):
            if not reachable(blocked, 40, 17, start, targets[incident_id]): failures.append(f"PATH {actor['id']} cannot reach {incident_id}")
        if reachable(blocked, 40, 17, start, targets["generator"]): failures.append(f"DEPENDENCY {actor['id']} reaches generator before bridge repair")

    game_code = (ROOT / "components/GameCanvas.tsx").read_text(encoding="utf-8")
    for legacy in ("pp_placeholder_map", "pp_placeholder_incident_fire", "pp_placeholder_incident_bridge", "pp_placeholder_incident_cat", "pp_placeholder_incident_generator"):
        if legacy in game_code: failures.append(f"PLACEHOLDER reference remains: {legacy}")
    for current in ("STAGE_MAPS", "pp_stage_01_spawn_points", "pp_stage_01_collision", "pp_world_incident_marker_"):
        if current not in game_code: failures.append(f"INTEGRATION reference missing: {current}")

    # Seam test for the repeatable base grass tile.
    with Image.open(WORLD / "tilesets/pp_world_tileset_terrain_core.png") as sheet:
        base = sheet.crop((0, 0, 16, 16))
        if list(base.crop((0, 0, 1, 16)).get_flattened_data()) != list(base.crop((15, 0, 16, 16)).get_flattened_data()): failures.append("SEAM grass tile left/right edges differ")
        if list(base.crop((0, 0, 16, 1)).get_flattened_data()) != list(base.crop((0, 15, 16, 16)).get_flattened_data()): failures.append("SEAM grass tile top/bottom edges differ")

    if failures: report_failures(failures)
    print("Phase 2 asset and map verification PASSED")
    print(f"- graphics: {len(EXPECTED)} files / {total_bytes} bytes")
    print("- map: 40x17 / 12 ordered layers")
    print("- collision: matches 680 logical cells")
    print("- routes: fire, cat and bridge reachable; generator dependency enforced")
    print("- world placeholders: removed from Phaser references")


def report_failures(failures: list[str]) -> None:
    print("Phase 2 verification FAILED")
    for failure in failures: print(f"- {failure}")
    raise SystemExit(1)


if __name__ == "__main__":
    main()
