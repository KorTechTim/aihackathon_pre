# PIXEL PANIC — Phase 1 결과 보고서

작성일: 2026-08-06  
범위: 비주얼 기준·UI 키트·화면 골격  
상태: **기능·규격 P0 완료 / 시각 품질 재작업 필요**

> 2026-08-06 재평가: 화면 골격, 상태 전환, 규격과 자동 검사는 통과했지만 실제 UI 그래픽은 승인된 스타일 보드의 완성도에 미달한다. Phase 1을 시각적으로 완성된 상태로 간주하지 않으며 별도 재디자인이 필요하다.

## 1. 구현 결과

Next.js + React + Phaser 3 기반의 1280×720 게임 셸을 구축했다. 아래 네 화면은 실제 프런트엔드에서 전환되며, 한글 UI 문구는 로고를 제외하고 모두 코드로 렌더링한다.

1. 로딩 및 타이틀 화면
2. 90초 플레이 화면
3. 성공 결과 화면
4. 실패 결과 화면

플레이 화면에는 상단 HUD, 로봇 상태 패널, 사건 패널, 추천 명령 4종, 자연어 입력창, AI 분석 상태, 작전 미리보기와 작전 실행 버튼이 포함되어 있다. 추천 명령을 선택한 뒤 명령을 분석하면 `AQUA → 빵집`, `FIX → 다리`, `BUDDY → 고양이`가 표시되고, Phaser 장면에서 같은 역할색의 배정선과 출동 연출이 재생된다.

## 2. 생성·수정 파일 목록

### 문서와 원본

- `PIXEL_PANIC_GRAPHICS_4_PHASE_WORK_ORDER_KO.md`
- `README.md`
- `ASSET_PROVENANCE.csv`
- `assets-src/pixel-panic/style/pp_style_board.png`
- `assets-src/pixel-panic/style/STYLE_BOARD_PROMPT.md`
- `assets-src/pixel-panic/style/PALETTE.md`
- `assets-src/pixel-panic/style/STYLE_RULES.md`
- `assets-src/pixel-panic/brand/**`
- `assets-src/pixel-panic/ui/**`
- `scripts/generate_phase1_assets.py`
- `scripts/verify_phase1_assets.py`

### 게임용 그래픽

`frontend/public/assets/pixel-panic/` 아래에 총 72개 PNG를 생성했다.

| 구분 | 수량 | 주요 파일 |
|---|---:|---|
| 스타일 보드 | 1 | `style/pp_style_board.png` |
| 브랜드 | 2 | `brand/pp_brand_logo_horizontal.png`, `pp_brand_logo_mark.png` |
| 화면 배경 | 4 | title, loading, result success, result fail |
| 로딩 스피너 | 1 | `ui/pp_ui_loading_spinner.png` |
| 9-slice 패널 | 6 | base, command, alert, success, tooltip, input |
| 버튼 상태 시트 | 4 | primary, secondary, danger, icon |
| HUD·상태·사건·행동·추천 아이콘 | 30 | `ui/icons/pp_ui_icon_*.png` |
| 로봇 초상화 | 9 | AQUA/FIX/BUDDY × ready/busy/fail |
| 결과 등급 | 5 | S/A/B/C/F |
| 결과 배지 | 2 | mission complete/failed |
| Phase 2·3 플레이스홀더 | 8 | map, 로봇 3, 사건 4 |

### 프런트엔드

- `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- `components/StageViewport.tsx`
- `components/PixelButton.tsx`
- `components/RobotCard.tsx`
- `components/GameCanvas.tsx`
- `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`
- `public` → `frontend/public` 공개 폴더 심볼릭 링크

### QA 산출물

- `scripts/capture_phase1.mjs`
- `scripts/smoke_phase1.mjs`
- `visual-regression/phase1/1280x720_{title,play,success,fail}.png`
- `visual-regression/phase1/1024x576_{title,play,success,fail}.png`
- `visual-regression/phase1/844x390_{title,play,success,fail}.png`

## 3. 이미지 규격 검사

자동 검사 결과: **PASS**

- 검사 대상: 72개 P0 PNG
- 전체 용량: 2,535,556 bytes (약 2.42 MiB)
- 지정 폭·높이: 전부 일치
- 색상 모드: 전부 RGBA
- 타이틀·로딩·성공·실패·맵 배경: 완전 불투명
- 네 버튼 시트의 normal/hover/focus/pressed/disabled용 4개 프레임: 모두 시각적으로 구분
- 4096px 초과 텍스처: 없음
- JPEG: 없음

검사 명령: `npm run assets:verify`

## 4. 화면·상호작용 검수

| 항목 | 결과 | 비고 |
|---|---|---|
| 1280×720 | PASS | 기준 레이아웃, 네 화면 정상 |
| 1024×576 | PASS | 16:9 동일 축소, 잘림 없음 |
| 844×390 | PASS | 높이 기준 동일 비율 축소, 핵심 입력·실행 버튼 접근 가능 |
| 390×844 세로 | PASS | `기기를 가로로 돌려주세요` 오버레이 표시 |
| 키보드 포커스 | PASS | hover와 동등한 버튼 프레임 + 4px 크림색 포커스 링 |
| 추천 명령 | PASS | 클릭 시 자연어 입력창 갱신 |
| AI 분석 | PASS | 분석 상태·버튼 disabled·상태 문구 확인 |
| 작전 미리보기 | PASS | 로봇별 대상 및 월드 역할색 배정선 표시 |
| 작전 실행 | PASS | Phaser tween 출동 후 성공 화면 전환 |
| Phaser 직접 로드 에셋 | PASS | 맵·로봇 3·사건 4 URL HTTP 200 |
| 실패 화면 | PASS | 타이머 만료, 일시정지 메뉴의 작전 포기로 진입 가능 |
| 프로덕션 빌드 | PASS | 정적 루트 생성, TypeScript 검사 통과 |

상호작용 검사 명령: `npm run qa:smoke`  
화면 캡처 명령: `npm run qa:screenshots`

## 5. 남은 플레이스홀더와 교체 위치

Phase 1 작성 당시 월드와 실제 캐릭터 애니메이션은 명시적 플레이스홀더였다. 월드와 사건 마커는 Phase 2에서 교체됐고, 로봇 플레이스홀더는 Phase 3에서 교체한다.

| 플레이스홀더 | 현재 사용 위치 | 교체 Phase |
|---|---|---|
| `pp_placeholder_map` | Phase 2의 `pp_stage_01_preview`로 교체 완료 | 완료 |
| `pp_placeholder_robot_aqua` | 구조 본부 `(340, 530)` | Phase 3 AQUA 스프라이트 |
| `pp_placeholder_robot_fix` | 구조 본부 `(404, 530)` | Phase 3 FIX 스프라이트 |
| `pp_placeholder_robot_buddy` | 구조 본부 `(468, 530)` | Phase 3 BUDDY 스프라이트 |
| `pp_placeholder_incident_fire` | Phase 2 마커로 교체 완료 | Phase 3 화재 FX 남음 |
| `pp_placeholder_incident_bridge` | Phase 2 마커·교량 상태 에셋으로 교체 완료 | 완료 |
| `pp_placeholder_incident_cat` | Phase 2 마커·지붕 에셋으로 교체 완료 | Phase 3 고양이 남음 |
| `pp_placeholder_incident_generator` | Phase 2 마커·발전기 상태 에셋으로 교체 완료 | Phase 3 전기 FX 남음 |

플레이스홀더는 지금 단계에서 의도적으로 존재하며, Phase 2와 Phase 3 완료 검사에서 모두 제거해야 한다.

## 6. Phase 2 주의점

1. 현재 UI 패널의 가시 영역을 유지한다. 핵심 사건 연출은 좌측 `x < 224`, 우측 `x > 1016`에 완전히 가려지지 않아야 한다.
2. Phaser 월드 좌표는 전체 캔버스 기준이고 맵 원점은 `(0, 64)`다. Phase 2 타일맵의 `(0, 0)`에 HUD 오프셋 64px를 더해 표시한다.
3. 현재 역할색 배정선과 사건 카드 색은 Phase 2 사건 마커 및 target ring에 그대로 연결한다.
4. 40×17 타일맵이 완성되면 `pp_placeholder_map`과 사건 4종 플레이스홀더 참조를 먼저 교체한다.
5. 이미지 생성 스타일 보드는 콘셉트 기준으로만 사용한다. 최종 타일은 16px 그리드, 1 source-pixel 외곽선과 좌상단 광원을 다시 검수한다.

## 7. Phase 1 완료 기준 체크

- [x] 모든 P0 파일이 정확한 크기와 이름으로 존재한다.
- [x] 타이틀·플레이·성공·실패 화면이 1280×720에서 깨지지 않는다.
- [x] 1024×576과 844×390 가로 화면에서도 UI가 잘리지 않는다.
- [x] 모든 버튼의 normal/hover/pressed/disabled 상태가 구분된다.
- [x] 키보드 포커스 상태가 hover와 동등하게 표시된다.
- [x] 로고 외의 한글이 이미지에 굽혀 있지 않다.
- [x] AQUA·FIX·BUDDY의 역할색·실루엣·초상화가 즉시 구분된다.
- [x] 플레이스홀더 목록과 교체 예정 위치가 문서화되어 있다.
