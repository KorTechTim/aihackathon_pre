# PIXEL PANIC — Phase 2 이미지 생성 프롬프트

작성일: 2026-08-06

도구: OpenAI 내장 이미지 생성

모델: `gpt-image-2`

용도: Phase 2 월드 마스터와 분리형 환경 오브젝트의 원본 제작

모든 이미지는 이 프로젝트를 위해 새로 생성한 오리지널 결과물이다. 생성 결과는 그대로 런타임 규격으로 사용하지 않고 `scripts/generate_phase2_assets.py`에서 nearest-neighbor 리사이즈, 픽셀 그리드 정렬, 알파 정리와 정확한 파일 크기 변환을 거쳤다.

## 1. 40×17 마을 마스터

참조: Phase 1의 `pp_style_board.png`와 사용자가 승인한 고품질 픽셀 아트 방향

```text
Create an original, highly polished pixel-art rescue town map for PIXEL PANIC, matching the supplied art-direction reference: warm, cheerful, richly detailed, chunky readable silhouettes, dark navy outlines, bright cyan/yellow/coral accents, cream highlights, consistent upper-left daylight, crisp nearest-neighbor pixel edges.

The image must be a single flat rectangular orthographic three-quarter top-down game map with an exact 40:17 composition and no surrounding asset-board UI. Preserve these fixed gameplay zones: bakery in the upper-left with a bread-symbol sign and damaged/fire-ready roof; a small house with a broad roof for a stranded cat in the upper-middle; a vertical river occupying the x=25–28 region from top to bottom; a wooden bridge crossing the river around x=22–31, y=7–9, visibly broken in the middle; a compact lightning-symbol power station in the upper-right; a colorful three-role rescue headquarters in the lower-left; a welcoming stone evacuation plaza in the lower-center; and a fenced safe garden in the lower-right. Connect the areas with broad two-to-three-tile-equivalent paths and leave readable interaction space around every incident.

No characters, no robots, no incident marker overlays, no HUD, no panels, no labels, no letters, no fake text, no logo, no perspective camera crop, no blur, no painterly anti-aliasing. The result must read as a complete playable fixed-screen town, not a concept-art island.
```

생성 원본: `pp_stage_01_master.png`

런타임 변환본: `../maps/pp_stage_01_preview.png` (`1280×544`)

## 2. 건물 상태 보드

```text
Create an original 3×3 sprite asset board of polished pixel-art rescue-town buildings, matching the supplied PIXEL PANIC reference style exactly: crisp dark navy outlines, warm cream highlights, bright but controlled cyan/yellow/coral accents, upper-left daylight, readable gameplay silhouettes, consistent orthographic three-quarter top-down angle and consistent scale.

Place one isolated building in each equally sized cell on a perfectly flat saturated chroma-magenta background with generous separation and no shadows crossing cell boundaries. Row 1: cheerful bakery with bread-symbol sign; the same bakery damaged with soot and a broken awning but no flames; small house with a large accessible roof for a cat rescue. Row 2: compact lightning-symbol power station switched off; the same station restored and lit; colorful rescue headquarters with three role-colored lights. Row 3: background house A; visibly different background house B; small neighborhood shop.

No characters, no robots, no text, no letters, no labels, no UI, no grid lines, no captions, no fake writing, no transparency checkerboard, no cropped sprites, no anti-aliased painting.
```

생성 원본: `pp_buildings_board_chroma.png`

알파 정리본: `pp_buildings_board_alpha.png`

## 3. 교량·소품 보드

```text
Create an original 4×4 sprite asset board of polished pixel-art rescue-town environment props, matching the supplied PIXEL PANIC reference style: crisp dark navy outlines, bright readable colors, warm upper-left daylight, consistent orthographic three-quarter top-down view, consistent scale, game-ready silhouettes.

Use a perfectly flat saturated chroma-magenta background. Keep every sprite isolated within its equal cell with generous transparent-ready padding. Row 1: the same wooden bridge in four perfectly aligned states — intact, broken with two or three central planks missing, repairing with temporary boards and tools, repaired with fresh replacement boards. Row 2: four tree variants grouped as one sprite set, four bush variants, four flower-patch variants, ten fence pieces including straight/corner/gate. Row 3: streetlamp off/on, bench in two directions, triangular incident warning sign, fire hydrant. Row 4: repair crate, two safety barriers, roof ladder, evacuation flag.

No people, no robots, no text, no letters, no labels, no UI, no grid lines, no captions, no fake writing, no cropped objects, no shadows crossing cells, no anti-aliased painting.
```

생성 원본: `pp_props_board_chroma.png`

알파 정리본: `pp_props_board_alpha.png`

## 후처리 원칙

- 생성 마스터는 40:17 비율로 중앙 크롭한 뒤 nearest-neighbor로 `1280×544`에 맞췄다.
- 크로마 보드는 배경색을 제거하고 하드 알파로 정리했다.
- 분리 에셋은 작업 지시서의 원본 픽셀 크기와 프레임 수에 맞췄다.
- 자동 생성 글자나 가짜 간판 문구는 사용하지 않았고 심볼만 유지했다.
- 정확한 결과 재생성 명령은 `npm run assets:generate:phase2`다.
