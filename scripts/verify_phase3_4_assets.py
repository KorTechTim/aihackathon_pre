#!/usr/bin/env python3
"""Verify final sheets, manifest registration, budgets and runtime integration."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "frontend/public/assets/pixel-panic"


def expected() -> dict[str, tuple[int, int]]:
    result: dict[str, tuple[int, int]] = {}
    for robot in ("aqua", "fix", "buddy"):
        action = {"aqua": "extinguish", "fix": "repair", "buddy": "rescue"}[robot]
        result[f"characters/robots/pp_char_robot_{robot}_idle.png"] = (128, 128)
        result[f"characters/robots/pp_char_robot_{robot}_walk.png"] = (192, 128)
        result[f"characters/robots/pp_char_robot_{robot}_{action}.png"] = (256, 128)
        result[f"characters/robots/pp_char_robot_{robot}_celebrate.png"] = (192, 32)
        result[f"characters/robots/pp_char_robot_{robot}_fail.png"] = (128, 32)
    result["characters/robots/pp_char_robot_buddy_carry_walk.png"] = (192, 128)
    result.update({
        "characters/common/pp_char_shadow_small.png": (24, 10),
        "characters/common/pp_char_selection_ring_aqua.png": (32, 16),
        "characters/common/pp_char_selection_ring_fix.png": (32, 16),
        "characters/common/pp_char_selection_ring_buddy.png": (32, 16),
        "characters/common/pp_char_status_bubble.png": (32, 40),
    })
    for npc in ("a", "b", "c", "d"):
        result[f"characters/npcs/pp_char_npc_{npc}_idle.png"] = (128, 128)
        result[f"characters/npcs/pp_char_npc_{npc}_panic.png"] = (192, 32)
        result[f"characters/npcs/pp_char_npc_{npc}_evacuate_walk.png"] = (192, 128)
        result[f"characters/npcs/pp_char_npc_{npc}_cheer.png"] = (192, 32)
    result.update({
        "characters/cat/pp_char_cat_idle.png": (96, 24), "characters/cat/pp_char_cat_meow.png": (96, 24),
        "characters/cat/pp_char_cat_hop.png": (144, 24), "characters/cat/pp_char_cat_rescued.png": (96, 24),
        "characters/cat/pp_char_cat_carry_socket.png": (24, 24),
    })
    fx = {
        "fire_small_loop": (144, 32), "fire_medium_loop": (256, 48), "fire_large_loop": (384, 64),
        "smoke_small_loop": (192, 48), "smoke_large_loop": (384, 64), "ember_particle": (32, 8),
        "water_jet_loop": (384, 24), "water_splash": (384, 48), "steam_burst": (384, 48), "puddle_fade": (192, 16),
        "repair_spark": (192, 32), "hammer_impact": (160, 32), "dust_puff": (192, 32), "bolt_pop": (64, 16),
        "rescue_heart": (144, 24), "rescue_reach": (288, 32), "safe_landing": (192, 32),
        "electric_arc": (288, 48), "light_flicker": (128, 32), "power_restore_burst": (512, 64),
        "alert_ping": (384, 64), "task_assign": (512, 64), "task_complete": (512, 64), "confetti": (960, 96),
        "star_burst": (512, 64), "danger_vignette": (1280, 720), "ai_scanline": (1280, 896),
    }
    result.update({f"fx/pp_fx_{name}.png": size for name, size in fx.items()})
    return result


def main() -> None:
    failures: list[str] = []
    for relative, size in expected().items():
        path = ASSETS / relative
        if not path.exists(): failures.append(f"MISSING {relative}"); continue
        with Image.open(path) as image:
            if image.size != size: failures.append(f"SIZE {relative}: {image.size} != {size}")
            if image.mode != "RGBA": failures.append(f"MODE {relative}: {image.mode} != RGBA")
            if image.width > 2048 or image.height > 2048: failures.append(f"TEXTURE {relative}: exceeds 2048px")
            if path.stat().st_size > 2_000_000: failures.append(f"SHEET BUDGET {relative}: {path.stat().st_size}")

    legacy = sorted(path.relative_to(ASSETS).as_posix() for path in ASSETS.rglob("*placeholder*") if path.is_file())
    if legacy: failures.append(f"PLACEHOLDERS remain: {legacy}")

    manifest_path = ASSETS / "manifests/asset-manifest.json"
    if not manifest_path.exists(): failures.append("MISSING manifests/asset-manifest.json")
    else:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        registered = {item["url"] for item in manifest.get("assets", [])}
        graphics = {path.relative_to(ASSETS).as_posix() for path in ASSETS.rglob("*") if path.is_file() and path.suffix.lower() in {".png", ".webp"}}
        if registered != graphics:
            failures.append(f"MANIFEST mismatch missing={sorted(graphics - registered)} extra={sorted(registered - graphics)}")
        totals = manifest.get("totals", {})
        if totals.get("P0", 99_000_000) > 2_500_000: failures.append(f"P0 BUDGET {totals.get('P0')}")
        if totals.get("P1", 99_000_000) > 8_000_000: failures.append(f"P1 BUDGET {totals.get('P1')}")
        if len(manifest.get("animations", [])) < 36: failures.append("ANIMATIONS manifest is incomplete")

    for screen in ("title", "result_success", "result_fail"):
        path = ASSETS / f"ui/screens/pp_ui_screen_{screen}_final.webp"
        if not path.exists(): failures.append(f"MISSING {path.relative_to(ASSETS)}"); continue
        with Image.open(path) as image:
            if image.size != (1280, 720): failures.append(f"SCREEN SIZE {screen}: {image.size}")
        if path.stat().st_size > 1_200_000: failures.append(f"SCREEN BUDGET {screen}: {path.stat().st_size}")

    game = (ROOT / "components/GameCanvas.tsx").read_text(encoding="utf-8")
    page = (ROOT / "app/page.tsx").read_text(encoding="utf-8")
    for required in ("${robot}-action", "cat-hop", "fire-loop", "restore-once", "confetti-once"):
        if required not in game: failures.append(f"RUNTIME animation missing: {required}")
    for required in (
        "pp_ui_screen_title_final.webp",
        "loading-track",
        "다시 시도",
        "incident-row",
        "robot-card",
        "action-buttons",
        'fetch("/api/dialogue"',
    ):
        if required not in page: failures.append(f"UI integration missing: {required}")
    if "pp_placeholder" in game or "pp_placeholder" in page: failures.append("PLACEHOLDER reference remains in runtime")
    if not (ROOT / "assets-src/pixel-panic/ui/reference/PHASE_3_4_IMAGEGEN_PROMPTS.md").exists(): failures.append("MISSING prompt provenance")

    if failures:
        print("Phase 3/4 verification FAILED")
        for failure in failures: print(f"- {failure}")
        raise SystemExit(1)
    print("Phase 3/4 asset verification PASSED")
    print(f"- exact character/FX sheets: {len(expected())}")
    print("- manifest: every runtime PNG/WebP registered")
    print("- budgets: texture, P0, P1 and final backgrounds passed")
    print("- placeholders: none")


if __name__ == "__main__":
    main()
