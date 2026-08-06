#!/usr/bin/env python3
"""Verify required Phase 1 image dimensions and alpha properties."""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "frontend/public/assets/pixel-panic"

EXPECTED: dict[str, tuple[int, int]] = {
    "brand/pp_brand_logo_horizontal.png": (512, 128),
    "brand/pp_brand_logo_mark.png": (128, 128),
    "ui/screens/pp_ui_screen_title_bg.png": (1280, 720),
    "ui/screens/pp_ui_screen_loading_bg.png": (1280, 720),
    "ui/screens/pp_ui_screen_result_success_bg.png": (1280, 720),
    "ui/screens/pp_ui_screen_result_fail_bg.png": (1280, 720),
    "ui/pp_ui_loading_spinner.png": (256, 32),
    "ui/panels/pp_ui_panel_base_9s.png": (48, 48),
    "ui/panels/pp_ui_panel_command_9s.png": (48, 48),
    "ui/panels/pp_ui_panel_alert_9s.png": (48, 48),
    "ui/panels/pp_ui_panel_success_9s.png": (48, 48),
    "ui/panels/pp_ui_panel_tooltip_9s.png": (32, 32),
    "ui/panels/pp_ui_input_9s.png": (48, 48),
    "ui/buttons/pp_ui_button_primary_states.png": (192, 192),
    "ui/buttons/pp_ui_button_secondary_states.png": (192, 192),
    "ui/buttons/pp_ui_button_danger_states.png": (192, 192),
    "ui/buttons/pp_ui_button_icon_states.png": (48, 192),
    "ui/pp_ui_badge_mission_complete.png": (320, 80),
    "ui/pp_ui_badge_mission_failed.png": (320, 80),
}

for name in ("timer", "village_hp", "incident_count", "rescued", "command_count", "ai", "pause", "sound_on", "sound_off", "fullscreen", "ready", "moving", "working", "blocked", "done", "warning", "quick_fire_first", "quick_rescue_first", "quick_nearest", "quick_high_risk"):
    EXPECTED[f"ui/icons/pp_ui_icon_{name}.png"] = (24, 24)
for name in ("incident_fire", "incident_bridge", "incident_cat", "incident_generator", "action_extinguish", "action_repair", "action_rescue", "action_move", "action_wait", "action_evacuate"):
    EXPECTED[f"ui/icons/pp_ui_icon_{name}.png"] = (32, 32)
for robot in ("aqua", "fix", "buddy"):
    for state in ("ready", "busy", "fail"):
        EXPECTED[f"ui/portraits/pp_ui_portrait_{robot}_{state}.png"] = (64, 64)
for grade in ("s", "a", "b", "c", "f"):
    EXPECTED[f"ui/pp_ui_grade_{grade}.png"] = (128, 128)

OPAQUE = {
    "ui/screens/pp_ui_screen_title_bg.png",
    "ui/screens/pp_ui_screen_loading_bg.png",
    "ui/screens/pp_ui_screen_result_success_bg.png",
    "ui/screens/pp_ui_screen_result_fail_bg.png",
}


def main() -> None:
    failures: list[str] = []
    total_bytes = 0
    for relative, expected_size in EXPECTED.items():
        path = ASSETS / relative
        if not path.exists():
            failures.append(f"MISSING {relative}")
            continue
        total_bytes += path.stat().st_size
        try:
            with Image.open(path) as image:
                if image.size != expected_size:
                    failures.append(f"SIZE {relative}: {image.size} != {expected_size}")
                if image.mode != "RGBA":
                    failures.append(f"MODE {relative}: {image.mode} != RGBA")
                if relative in OPAQUE and image.getchannel("A").getextrema() != (255, 255):
                    failures.append(f"ALPHA {relative}: background must be fully opaque")
                if image.width > 4096 or image.height > 4096:
                    failures.append(f"TEXTURE {relative}: exceeds 4096px")
                if "button_" in relative and "_states.png" in relative:
                    frame_height = 48
                    frames = [image.crop((0, index * frame_height, image.width, (index + 1) * frame_height)).tobytes() for index in range(4)]
                    if len(set(frames)) != 4:
                        failures.append(f"STATES {relative}: four visual states must be distinct")
        except Exception as exc:
            failures.append(f"READ {relative}: {exc}")

    for document in (ROOT / "assets-src/pixel-panic/style/PALETTE.md", ROOT / "assets-src/pixel-panic/style/STYLE_RULES.md"):
        if not document.exists():
            failures.append(f"MISSING {document.relative_to(ROOT)}")

    if failures:
        print("Phase 1 asset verification FAILED")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)

    print("Phase 1 asset verification PASSED")
    print(f"- files: {len(EXPECTED)}")
    print(f"- total bytes: {total_bytes}")
    print("- dimensions: exact")
    print("- color mode: RGBA")
    print("- opaque screens: passed")


if __name__ == "__main__":
    main()
