# PIXEL PANIC Phase 3·4 ImageGen 기록

- 생성일: 2026-08-06
- 도구: OpenAI ImageGen (`image_gen`)
- 편집 방식: 새 이미지 생성 후 크로마키 제거, 규격 시트는 `scripts/generate_phase3_4_assets.py`로 결정론적 조립
- 공통 방향: 독창적인 고품질 픽셀아트, 굵고 깨끗한 실루엣, 좌상단 조명, 텍스트·로고·저작권 캐릭터 없음

## 로봇 원화 보드

Create an exact 3-row by 6-column sprite reference board on a perfectly flat solid #FF00FF chroma background. Row 1 AQUA: a cute blue/cyan rescue robot with round water tank backpack and short wide water cannon arm. Row 2 FIX: a cute yellow/orange repair robot with square safety helmet, oversized wrench arm and tool bag. Row 3 BUDDY: a cute coral red/pink rescue robot with heart chest light, extendable rescue arms and tiny beacon. Columns: front idle, left profile walk, right profile walk, back view, signature role action, joyful celebration. Same scale, generous cell spacing, no overlaps, no shadows, no labels, no text. Polished 16-bit pixel art, crisp stepped edges, strong distinct silhouettes, expressive cyan face displays, top-left lighting.

## 주민·고양이 원화 보드

Create an exact 2-row by 5-column character reference board on perfectly flat solid #FF00FF chroma. Columns 1–4 are four diverse friendly village residents with clearly different silhouettes, outfits, ages and colors; column 5 is a tiny orange-and-white cat. Top row: calm front idle poses. Bottom row: residents in readable panic/cheer action poses and the cat in a playful hop/meow pose. Same scale within each species, generous spacing, no overlap, no shadows, no labels, no text. Premium cohesive 16-bit pixel art matching a cute rescue-town game, crisp edges and expressive faces.

## VFX 원화 보드

Create an exact 4 by 4 VFX reference grid on a perfectly flat solid #FF00FF chroma background, with generous spacing and no overlap. Row 1: small fire, medium fire, large fire, soft grey smoke. Row 2: horizontal cyan water jet, water splash, white-blue steam burst, blue puddle. Row 3: golden repair sparks, hammer impact, tan dust puff, spinning metal bolt. Row 4: pink rescue hearts, reaching speed lines / safe landing burst, electric arc / power restore burst, colorful confetti and star sparkle. No labels, no text, no frame borders, no shadows. Crisp polished 16-bit pixel art effects, strong silhouettes, transparent-ready isolated elements.

## 타이틀 배경

Create a premium 16:9 pixel-art title scene for an original cute AI rescue game. AQUA, a blue water rescue robot with cannon and tank; FIX, a yellow repair robot with wrench and helmet; and BUDDY, a coral rescue robot with heart chest light and extendable arms stand heroically in the foreground. Behind them is a richly detailed sunny rescue village with headquarters, bakery, cat house, bridge, river and power station. Keep a broad clean deep-blue sky area in the upper center for code-rendered title UI. No text, no logo, no interface, no copyrighted characters. Polished 16-bit game key art, cohesive palette, dramatic warm sunlight, readable silhouettes.

## 성공 배경

16:9 polished pixel-art victory background for an original cute town rescue game. Restored sunny village plaza with repaired bakery, bridge and power station. Exactly three distinct rescue robots celebrate: one blue AQUA water robot, one yellow FIX wrench robot, one coral BUDDY heart rescue robot. Four happy diverse residents and one rescued orange cat celebrate around them. Confetti, sparkling fountain and warm sunset light. Leave the upper area visually calm enough for a compact result panel. No text, no logo, no UI, no duplicated robots, no copyrighted characters.

첫 생성본에 AQUA가 중복되어 정밀 편집으로 왼쪽 중복 로봇을 BUDDY로 교체한 최종본만 사용했다.

## 실패 배경

Create a premium 16:9 pixel-art mission setback background for a family-friendly rescue game. The same detailed village at rainy blue dusk, damaged bakery, broken bridge and dark power station with tasteful warning lights. AQUA, FIX and BUDDY stand together tired but hopeful near rescue headquarters with the safe cat. Emotional but encouraging, not tragic, clear space on the right for a result panel. No text, no logo, no UI, no copyrighted characters. Polished 16-bit game art, cinematic rain and warm lamps.

## AI 마을 뉴스 종이 질감

- 생성일: 2026-08-07
- 최종 에셋: `public/assets/pixel-panic/ui/textures/pp_ui_newsprint_texture.png`
- 후처리: 생성본을 팝업 비율과 같은 900×520으로 축소

Create a clean landscape sheet of vintage newspaper paper texture for an emergency rescue village newspaper UI. Richly detailed handmade newsprint paper with subtle pixel-art sensibility, tactile paper fibers, faint halftone dots, restrained fold lines, tiny registration imperfections, gently worn edges, and a calm readable center. Warm ivory and parchment with very subtle desaturated navy-blue and muted cyan ink ghosting near the edges. Flat front-facing rectangular surface with even archival lighting. Absolutely no letters, words, numbers, symbols, logos, mastheads, pictures, illustrations, UI controls, borders, frames, watermarks, shadows outside the paper, or transparent areas. No readable text of any kind.

## 옥상 고양이 구조 미니게임 배경

- 생성일: 2026-08-07
- 최종 에셋: `public/assets/pixel-panic/ui/minigames/pp_ui_cat_rescue_roof.png`
- 후처리: 생성본을 팝업 배경 비율에 맞춰 900×520으로 축소

Draw a richly detailed village house roof rescue scene for a popup minigame, with a broad red-orange tiled roof spanning the upper half and an open stone courtyard below where a rescue robot can move left and right. Friendly European-inspired rescue village, sunny late afternoon, chimney, attic window, distant trees and blue sky. Premium cohesive 16-bit pixel art with crisp stepped edges, warm terracotta, cream stone, navy shadows and cyan accents. Straight-on side view with a clear vertical falling lane and calm lower courtyard. Background only: no characters, animals, robots, text, signs, UI, buttons, logos, watermarks, borders or frames.

### 건물 벽체 보강 편집

- 수정일: 2026-08-07
- 수정 목적: 지붕 아래가 뚫려 보이던 초안을 완전한 2층 주택 외벽으로 교체

Edit the supplied pixel-art scene so the building has a complete body below the roof. Replace the open village view under the eaves with the full front facade of a cozy two-story rescue-town house extending continuously from the roof to the ground. Preserve the exact polished 16-bit pixel-art style, pixel scale, warm daylight, color palette, camera angle, roof tiles, chimney, dormer, gutters, and overall framing. Build a believable cream-plaster and warm-brown timber facade with corner supports, a centered front door, balanced windows, stone foundation, and subtle flower boxes. Keep a wide clear rooftop for the cat, a calm central vertical falling lane in front of the facade, and only the bottom 18–22% as a flat stone walkway for the robot. Do not leave any archway, opening, distant landscape, sky, or see-through void beneath the roof. No characters, cat, robot, text, UI, logo, or watermark.

### BUDDY 쿠션 캐치 포즈

- 최종 에셋: `public/assets/pixel-panic/ui/minigames/pp_ui_buddy_pillow_catch.png`
- 후처리: 초록 크로마키 제거 후 투명 RGBA 240×240으로 축소

Create one front-facing full-body BUDDY rescue robot in a catching pose: a cute coral-red and pink compact robot with a cyan digital face, heart-shaped chest light, tiny emergency beacon, sturdy short legs, and two long articulated arms spread wide and raised. Its open hands support a large fluffy rectangular rescue pillow directly above its head, ready to catch a falling cat. Polished premium 16-bit pixel art with crisp stepped edges and a chunky readable silhouette. Cream pillow with pale pink stitched stripes and thick soft corners. Exactly one centered character on a perfectly flat solid #00FF00 chroma-key background. No cat, other character, ground, shadow, text, logo, border or watermark.

## 본부 AI 무전 폭탄 해체 미니게임

- 생성일: 2026-08-07
- 생성 도구: OpenAI ImageGen 기본 내장 모드

### 본부 AI 루나 아바타

- 최종 에셋: `public/assets/pixel-panic/ui/portraits/pp_ui_portrait_hq_ai.png`
- 후처리: 256×256으로 축소

Create a friendly feminine artificial-intelligence dispatcher avatar who speaks to rescue robots from headquarters. An adult-coded synthetic female AI face and upper shoulders, confident and warm expression, short silver-blue holographic hair, cyan eyes, compact communications headset with microphone, subtle circuit-light details at the temples. Clearly an AI avatar rather than a real person. Premium cohesive 16-bit pixel art with crisp stepped pixels and a chunky readable silhouette. Centered front-facing bust inside a square dark navy command-center portrait panel with generous safe padding. Cool cyan holographic rim light, deep navy, cyan, pale silver and tiny coral alert accents. Exactly one avatar, no body below shoulders, no text, letters, numbers, logo, UI buttons, watermark, weapons, or photorealism.

### 폭탄 해체 장치 배경

- 최종 에셋: `public/assets/pixel-panic/ui/minigames/pp_ui_bomb_defusal_case.png`
- 후처리: 팝업 배경 규격 900×520으로 축소

Create a dramatic but family-friendly fictional bomb-defusal device mounted inside an open dark navy emergency equipment case. Close straight-on view on a rescue workbench, with a chunky rectangular fictional timer module, harmless-looking circuit blocks, and two clearly separated empty cable sockets in the lower left and lower right where interactive red and blue wires will be overlaid later. Do not draw any colored wires between them. Premium cohesive 16-bit pixel-art game background with centered symmetrical composition, cyan instrument glow and restrained coral warning lights. Fictional non-instructional game prop only; no realistic explosive materials or real construction details; no characters, hands, tools, text, letters, numbers, countdown digits, logos, watermarks, UI buttons, or border outside the case.

### 폭탄 재난 아이콘

- 최종 에셋: `public/assets/pixel-panic/ui/icons/pp_ui_icon_incident_bomb.png`
- 후처리: 초록 크로마키 제거 후 투명 RGBA 64×64로 축소

Create one compact fictional bomb-alert icon: a chunky dark navy circular device with a tiny amber warning light and two short clearly visible wires, one red and one blue, curling upward. Premium 16-bit pixel art with crisp stepped edges, thick dark outline and a simple readable silhouette at 48×48 pixels. Exactly one centered icon with generous padding on a perfectly flat solid #00FF00 chroma-key background. Do not use green in the subject. No text, letters, numbers, skull, realistic explosive material, logo, border, watermark, gradient or texture in the background.
