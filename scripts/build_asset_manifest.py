#!/usr/bin/env python3
"""Register every deployable PIXEL PANIC graphic in one runtime manifest."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "frontend/public/assets/pixel-panic"


def priority(relative: str) -> str:
    p0 = (
        "brand/", "ui/icons/", "ui/panels/", "ui/buttons/", "ui/portraits/",
        "ui/pp_ui_loading", "ui/screens/pp_ui_screen_title_final.webp",
        "world/maps/pp_stage_01_preview.webp", "characters/robots/",
    )
    if relative.startswith(p0) or relative in {"ui/screens/pp_ui_screen_result_success_final.webp", "ui/screens/pp_ui_screen_result_fail_final.webp"}:
        return "P0"
    if relative.startswith(("characters/", "fx/", "world/")):
        return "P1"
    return "P2"


def kind(relative: str) -> str:
    if relative.endswith(".webp") or "/screens/" in relative or "/maps/" in relative:
        return "image"
    if relative.startswith(("characters/", "fx/")) or "_states." in relative or "_loop." in relative:
        return "spritesheet"
    return "image"


def main() -> None:
    graphics = sorted(path for path in ASSETS.rglob("*") if path.is_file() and path.suffix.lower() in {".png", ".webp"})
    entries: list[dict[str, object]] = []
    for path in graphics:
        relative = path.relative_to(ASSETS).as_posix()
        with Image.open(path) as image:
            entries.append({
                "key": path.stem,
                "type": kind(relative),
                "url": relative,
                "format": path.suffix.lower().removeprefix("."),
                "width": image.width,
                "height": image.height,
                "bytes": path.stat().st_size,
                "priority": priority(relative),
            })

    animation_path = ASSETS / "manifests/animation-manifest.json"
    animations = json.loads(animation_path.read_text(encoding="utf-8"))["animations"]
    totals = {level: sum(int(item["bytes"]) for item in entries if item["priority"] == level) for level in ("P0", "P1", "P2")}
    manifest = {
        "name": "PIXEL PANIC final runtime assets",
        "version": 4,
        "basePath": "/assets/pixel-panic/",
        "textureLimit": 2048,
        "budgets": {
            "firstScreenTargetBytes": 1_500_000,
            "firstScreenMaximumBytes": 2_500_000,
            "playAdditionalTargetBytes": 5_000_000,
            "playAdditionalMaximumBytes": 8_000_000,
            "allP0TargetBytes": 8_000_000,
            "allP0MaximumBytes": 12_000_000,
            "staticBackgroundMaximumBytes": 1_200_000,
            "spritesheetMaximumBytes": 2_000_000,
        },
        "totals": totals,
        "assets": entries,
        "animations": animations,
    }
    target = ASSETS / "manifests/asset-manifest.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Asset manifest: {len(entries)} graphics / P0 {totals['P0']} bytes / P1 {totals['P1']} bytes")


if __name__ == "__main__":
    main()
