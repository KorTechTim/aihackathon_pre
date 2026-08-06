# PIXEL PANIC — Phase 2 결과 보고서

작성일: 2026-08-06

범위: 마을 맵·건물·사건 오브젝트·맵 데이터

상태: **Phase 2 P0 완료 / Phase 1 UI 시각 재작업은 별도 미완료**

## 1. 구현 결과

16×16 source tile, 런타임 2× 기준의 40×17 고정 화면 마을을 제작했다. 런타임 월드 영역은 `1280×544`이며 상단 HUD 아래 `y=64`부터 표시한다. 빵집 화재, 옥상 고양이, 파손 다리, 발전기 고장 마커가 한 화면에 보이고, 좌우 UI 패널과 겹치는 사건은 별도의 표시 좌표를 데이터에 기록했다.

현재 Phaser 장면은 시각 품질을 보존하기 위해 고해상도 픽셀 아트 마스터에서 만든 평탄화 미리보기를 배경으로 사용한다. 동시에 `pp_stage_01.json`, 충돌 JSON, 스폰·사건 JSON을 직접 로드하고 데이터에서 로봇 출발점, 사건 마커와 상호작용 목적지를 구성한다. 건물·교량·발전기·소품의 정확한 규격별 PNG는 이후 사건 상태 교체와 애니메이션에 사용할 수 있도록 별도로 제공한다.

중요: Phase 1 UI는 기능 골격과 규격 검사는 통과했지만, 사용자가 지적한 것처럼 스타일 보드 수준의 시각 완성도에는 도달하지 못했다. 이 보고서의 Phase 2 완료 판정은 월드 그래픽과 맵 데이터 범위에 한정한다.

## 2. 납품 파일

### 원본·생성 파이프라인

- `assets-src/pixel-panic/world/reference/pp_stage_01_master.png`
- `assets-src/pixel-panic/world/reference/pp_buildings_board_{chroma,alpha}.png`
- `assets-src/pixel-panic/world/reference/pp_props_board_{chroma,alpha}.png`
- `assets-src/pixel-panic/world/reference/PHASE_2_IMAGEGEN_PROMPTS.md`
- `scripts/generate_phase2_assets.py`
- `scripts/verify_phase2_assets.py`

### 런타임 월드

- `frontend/public/assets/pixel-panic/world/maps/pp_stage_01_preview.png`
- `frontend/public/assets/pixel-panic/world/maps/pp_stage_01.json`
- `frontend/public/assets/pixel-panic/world/maps/pp_stage_01_collision.json`
- `frontend/public/assets/pixel-panic/world/maps/pp_stage_01_spawn_points.json`
- `frontend/public/assets/pixel-panic/world/tilesets/**`
- `frontend/public/assets/pixel-panic/world/buildings/**`
- `frontend/public/assets/pixel-panic/world/props/**`
- `frontend/public/assets/pixel-panic/world/incidents/**`

검사 대상 Phase 2 그래픽은 총 41개, 1,810,848 bytes다. 모든 런타임 PNG는 RGBA이며 작업 지시서의 크기·프레임 수를 따른다.

## 3. 타일 인덱스와 레이어

지형 코어 시트는 `256×256`, 셀은 `16×16`, 총 256칸이다.

| 인덱스 | 용도 |
|---:|---|
| 0~7 | 기본 잔디와 변화 |
| 8~15 | 통행 가능한 잔디 장식 |
| 16~23 | 흙길 |
| 24~31 | 돌길 |
| 32~47 | 잔디·흙길 경계 |
| 48~63 | 얕은 물·깊은 물 |
| 64~79 | 강둑과 모서리 |
| 80~95 | 광장 바닥과 가장자리 |
| 96~111 | 진흙·그을음·젖은 바닥 흔적 |
| 112~127 | 울타리·표지판·개발 표시 바닥 |
| 128~255 | P1 확장 예약 |

맵 데이터는 지시서와 같은 12개 순서 레이어를 갖는다: `ground`, `ground_detail`, `water`, `path`, `buildings_back`, `collision`, `props_back`, `incidents`, `actors`, `props_front`, `fx_front`, `markers_debug`. `collision`과 `markers_debug`는 기본 비표시다.

## 4. 좌표 데이터

| 대상 | 중심 타일 | 상호작용 타일 | 비고 |
|---|---:|---:|---|
| 빵집 화재 | `(6, 4)` | `(10, 5)` | 좌측 패널 바깥 마커 좌표 별도 지정 |
| 옥상 고양이 | `(15, 3)` | `(19, 5)` | 지붕 구조용 사다리 슬롯 확보 |
| 파손 다리 | `(26, 8)` | `(24, 8)` | 서쪽에서 먼저 접근 |
| 발전기 | `(35, 4)` | `(31, 5)` | `bridge_repaired` 의존성 |

로봇 스폰은 AQUA `(5,13)`, FIX `(6,13)`, BUDDY `(7,13)`이다. 맵 내부 픽셀 좌표에 런타임 HUD 오프셋 `+64px`를 더해 Phaser 좌표를 계산한다.

## 5. 충돌·경로 검사

- 논리 셀 680개와 충돌 데이터 길이 일치
- 세로 강과 건물·대형 장식 총 201칸 차단
- 세 로봇 모두 빵집, 고양이 집, 다리 상호작용점까지 경로 존재
- 다리 수리 전에는 세 로봇 모두 발전기 상호작용점에 도달할 수 없음
- 발전기 사건에 `requires: bridge_repaired`를 명시해 의도된 의존 관계를 고정
- 기본 잔디 타일의 상·하·좌·우 반복 이음선 자동 검사 통과
- Phase 1 월드·사건 플레이스홀더 참조 제거 확인

경로 검사는 4방향 BFS로 수행하며 `npm run assets:verify:phase2`로 재실행할 수 있다.

## 6. Phase 3 효과 슬롯

| 효과 | 타일 좌표 |
|---|---|
| 화재·연기 | `(6,3)`, `(7,4)` |
| 고양이 도움 표시 | `(15,2)` |
| 발전기 스파크 | `(35,4)` |
| 다리 수리 먼지 | `(26,8)` |

실제 화재·연기·스파크·고양이·로봇 애니메이션은 Phase 3 범위다. 현재 로봇 3종은 Phase 1 플레이스홀더를 계속 사용하며 Phase 3에서 교체해야 한다.

## 7. 자동·시각 검수

| 항목 | 결과 |
|---|---|
| Phase 2 에셋 크기·모드·알파 | PASS |
| 맵 40×17, 12개 레이어 | PASS |
| 충돌·BFS 경로·발전기 의존성 | PASS |
| Phaser JSON 직접 로드 | PASS |
| Phase 2 런타임 URL과 콘솔 오류 | PASS |
| Next.js 프로덕션 빌드 | PASS |
| 1280×720 초기·미리보기·실행 화면 | PASS |
| 1024×576, 844×390 반응형 캡처 | PASS |

시각 회귀 이미지는 `visual-regression/phase2/`에 5장 저장했다.

## 8. 완료 기준

- [x] 40×17 전체 맵이 한 화면에 들어온다.
- [x] 네 사건을 마커와 환경 실루엣으로 즉시 찾을 수 있다.
- [x] 세 로봇의 초기 사건 접근 경로와 발전기 의존 관계가 검증됐다.
- [x] 타일 이음선과 PNG 규격 자동 검사를 통과했다.
- [x] 좌우 UI 패널이 사건 마커를 완전히 가리지 않는다.
- [x] 충돌 데이터와 논리 장애물 배치가 일치한다.
- [x] Phase 1 월드·사건 플레이스홀더 참조를 실제 Phase 2 에셋으로 교체했다.
- [x] `1280×544` 미리보기와 맵·충돌·스폰 데이터가 함께 제공된다.
- [ ] Phase 1 UI를 스타일 보드 수준으로 재디자인한다. 이 항목은 Phase 2 범위 밖의 공개 미완료 항목이다.
