# PIXEL PANIC — AI 구조대
## 그래픽 에셋 4-Phase 제작 작업 지시서

> 문서 목적: 이 문서의 Phase 1~4를 각각 별도 Codex 작업에 복사해 넣으면, 다른 대화 맥락이 없어도 그래픽 제작과 게임 통합을 순서대로 수행할 수 있게 한다.

---

## 0. 프로젝트 고정 정보

### 게임 한 줄 설명

플레이어가 자연어로 `AQUA`, `FIX`, `BUDDY` 세 구조 로봇에게 지시하고, 90초 안에 도트 마을의 동시다발 사고를 해결하는 캐주얼 구조 퍼즐 게임.

### 기술 전제

- 프런트엔드: Vercel에 배포되는 React 또는 Next.js + Phaser 3 + TypeScript
- 백엔드: Oracle Cloud
- 선택 기능: GPT-5.6 API를 이용한 자연어 명령 구조화
- 그래픽은 프런트엔드 정적 에셋으로 제공한다.
- LLM은 그래픽 상태를 결정하지 않는다. 게임 엔진이 상태를 관리하고 상태에 맞는 에셋과 애니메이션을 재생한다.

### MVP 사건 4종

1. 빵집 화재 — `AQUA`가 진압
2. 파손된 다리 — `FIX`가 수리
3. 옥상에 고립된 고양이 — `BUDDY`가 구조
4. 고장 난 발전기 — `FIX`가 수리하거나 팀 협동으로 복구

### 핵심 화면

1. 타이틀/게임 시작
2. 90초 플레이 화면
3. AI 명령 분석 및 작전 미리보기
4. 작전 실행 중 화면
5. 성공/실패 결과 화면

### 기준 UI 레이아웃

- 기준 캔버스: `1280×720`, 16:9
- 상단 HUD: `x 0, y 0, w 1280, h 64`
- 게임 맵: `x 0, y 64, w 1280, h 544`
- 하단 명령 도크: `x 0, y 608, w 1280, h 112`
- 좌측 로봇 상태 카드: 맵 위 `x 16, y 80, w 208, h 240`
- 우측 사건/작전 패널: 맵 위 `x 1016, y 80, w 248, h 360`
- 중앙 맵의 중요한 사건은 좌우 패널에 완전히 가리지 않게 배치한다.
- 모바일은 가로 화면 우선이다. `844×390`까지 동일한 비율로 축소한다.
- 세로 화면에서는 별도 게임 UI를 억지로 재배치하지 말고 `기기를 가로로 돌려주세요` 오버레이를 표시한다.

### UI에서 반드시 보여야 하는 정보

- `PIXEL PANIC — AI 구조대` 로고
- 90초 타이머
- 마을 보존율 또는 마을 HP
- 해결한 사건 수 `0/4`
- 구조 로봇 3대의 상태
- 활성 사건 목록과 위험도
- 자연어 명령 입력창
- 추천 명령 4개
- AI 분석 중 상태
- `작전 실행` 버튼
- 작전 미리보기: `AQUA → 빵집`, `FIX → 다리`, `BUDDY → 고양이`
- 성공/실패와 최종 등급 `S/A/B/C/F`

---

## 1. 네 Phase의 실행 순서

| Phase | 목표 | 핵심 산출물 | 다음 Phase 시작 조건 |
|---|---|---|---|
| 1 | 비주얼 규격과 UI 고정 | 스타일 보드, 팔레트, 로고, 패널, 버튼, 아이콘, 화면 프레임 | 1280×720 UI 목업이 임시 이미지 없이 완성됨 |
| 2 | 한 화면짜리 마을과 사건 제작 | 타일셋, 건물, 소품, 사건 상태별 오브젝트 | 4개 사건을 맵에서 즉시 식별 가능 |
| 3 | 캐릭터와 움직임 제작 | 로봇, 주민, 고양이, 행동 애니메이션, VFX | 실제 게임에서 이동·행동·성공·실패 재생 가능 |
| 4 | 통합과 최종 품질 보증 | 아틀라스/매니페스트, 반응형 검수, 최적화, 최종 QA | 아래 최종 인수 기준 전부 통과 |

### Phase 운영 원칙

- Phase 하나를 Codex 작업 하나로 실행한다.
- 각 Phase가 끝날 때 반드시 결과 파일 목록과 검수 결과를 Markdown으로 남긴다.
- 완료 기준을 통과하지 못한 상태에서 다음 Phase로 넘어가지 않는다.
- 먼저 P0를 완성하고 시간이 남을 때만 P1, P2를 제작한다.
- 기존 저장소가 있으면 구조와 프레임워크를 먼저 확인하고, 사용자가 만든 코드를 덮어쓰지 않는다.
- 이미지 제작용 원본 파일과 게임용 내보내기 파일을 분리한다.
- 한글 문구는 로고를 제외하면 이미지에 굽지 않는다. HTML/Canvas 텍스트로 렌더링한다.

### 우선순위 정의

- `P0`: 플레이와 제출 영상에 반드시 필요. 누락 시 Phase 미완료.
- `P1`: 심사 품질을 크게 높이는 폴리싱. P0 안정화 후 제작.
- `P2`: 시간이 남을 때만 제작하는 확장 요소.

---

## 2. 전 Phase 공통 아트 디렉션

### 시각 키워드

- 캐주얼하고 따뜻한 재난 구조물
- 밝고 예쁜 현대 도트 그래픽
- 어린이도 바로 이해하는 실루엣
- 긴박하지만 무섭거나 잔혹하지 않은 사건
- 둥근 모서리, 큰 눈, 작은 몸, 과장된 도구
- 화재와 고장은 위험하게 보이되 캐릭터 피해 묘사는 코믹하게 처리
- 작은 화면에서도 로봇 색과 역할이 한눈에 구분되어야 함

### 금지 방향

- 포토리얼, 3D 렌더, 벡터 일러스트처럼 보이는 매끈한 외곽선
- 얇고 복잡한 선, 과도한 노이즈, 미세한 텍스처
- 어둡고 공포스러운 재난 묘사
- 기존 유명 게임, 캐릭터, 로고의 화풍이나 디자인 복제
- 색만 다른 동일 실루엣의 로봇 3종
- 에셋마다 광원 방향, 외곽선 굵기, 픽셀 크기가 달라지는 현상
- 픽셀 가장자리의 안티앨리어싱, 흐림, JPEG 노이즈
- 생성형 이미지의 가짜 글자나 UI 텍스트

### 기준 픽셀 규칙

- 월드 타일 원본 단위: `16×16 px`
- 월드 런타임 배율: `2×`; 화면에서는 타일 하나가 `32×32 px`
- 캐릭터 기본 프레임: `32×32 px`; 런타임 `2×`
- UI는 파일 크기 기준 `2× 픽셀 룩`으로 제작한다. 화면의 한 도트 블록은 보통 `2×2 화면 픽셀`이다.
- 픽셀 아트의 대각선은 일정한 계단 간격을 유지한다.
- 기본 외곽선은 1 source-pixel. 완전한 검정 대신 어두운 남색 또는 대상의 어두운 고유색을 사용한다.
- 기본 광원은 좌상단. 하이라이트는 좌상단, 그림자는 우하단에 둔다.
- 캐릭터 발 위치는 모든 프레임에서 동일해야 한다.

### 권장 핵심 팔레트

에셋은 아래 팔레트를 중심으로 제작하되, 한 에셋에서 12~16색을 넘기지 않는 것을 권장한다.

| 역할 | HEX |
|---|---|
| 최심부 외곽선 | `#172033` |
| UI 짙은 남색 | `#24314D` |
| UI 중간 남색 | `#34486B` |
| 크림색 텍스트 | `#FFF4D6` |
| AQUA 주색 | `#39BFF2` |
| AQUA 그림자 | `#1975C5` |
| FIX 주색 | `#FFD34E` |
| FIX 그림자 | `#D98C2B` |
| BUDDY 주색 | `#FF6577` |
| BUDDY 그림자 | `#C93F5B` |
| 성공 초록 | `#70D98B` |
| 경고 주황 | `#F58B3D` |
| 위험 빨강 | `#F04455` |
| 잔디 밝음 | `#80C96B` |
| 잔디 어두움 | `#3F8F5B` |
| 물 밝음 | `#54C7EC` |
| 물 어두움 | `#287DB2` |
| 흙길 밝음 | `#D7AA68` |
| 나무/목재 | `#9B603F` |
| 금속 밝음 | `#A9C4D4` |
| 연기 | `#667085` |

### 투명도와 내보내기

- 캐릭터, UI 아이콘, 건물, 소품, 효과: 배경이 완전히 투명한 `PNG-8` 또는 `PNG-32 RGBA`.
- 투명 PNG는 straight alpha를 사용한다.
- 코어 픽셀 가장자리는 알파 `0` 또는 `255`를 사용한다. 연기, 빛, 그림자 같은 효과에만 제한적으로 중간 알파를 사용한다.
- 흰색 또는 검정색 매트가 남아 테두리 halo가 생기면 불합격.
- 정적 전체 화면 배경은 무손실 원본 PNG와 배포용 WebP를 함께 제공할 수 있다.
- JPEG 사용 금지.
- SVG는 로고나 단순 벡터가 실제로 필요한 경우에만 보조 형식으로 사용한다. 게임 내 픽셀 에셋의 최종 형식은 PNG이다.
- 소스는 `.aseprite` 권장. 불가능하면 `.psd`, `.kra` 또는 계층 구조를 유지하는 편집 가능 포맷을 제공한다.

### Phaser 렌더링 기준

```ts
const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  pixelArt: true,
  roundPixels: true,
  antialias: false,
};
```

CSS 이미지에도 다음 원칙을 적용한다.

```css
.pixel-art {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
```

---

## 3. 공통 폴더 구조와 파일명

기존 저장소 구조가 다르면 경로만 맞추되, 분류와 파일명 규칙은 유지한다.

```text
assets-src/
└── pixel-panic/
    ├── style/
    ├── brand/
    ├── ui/
    ├── world/
    ├── characters/
    └── fx/

frontend/
└── public/
    └── assets/
        └── pixel-panic/
            ├── brand/
            ├── ui/
            │   ├── panels/
            │   ├── buttons/
            │   ├── icons/
            │   ├── portraits/
            │   └── screens/
            ├── world/
            │   ├── tilesets/
            │   ├── buildings/
            │   ├── props/
            │   └── incidents/
            ├── characters/
            │   ├── robots/
            │   ├── npcs/
            │   └── animals/
            ├── fx/
            └── manifests/
```

### 파일명 규칙

```text
pp_<category>_<subject>_<state>_<direction>_<variant>.<ext>
```

예:

```text
pp_char_robot_aqua_walk.png
pp_char_robot_fix_repair.png
pp_char_robot_buddy_rescue.png
pp_world_bakery_damaged.png
pp_fx_fire_medium_loop.png
pp_ui_icon_incident_bridge.png
```

규칙:

- 영문 소문자와 숫자, 밑줄만 사용한다.
- 공백, 한글 파일명, 괄호, `final`, `new`, `수정본` 금지.
- 방향은 스프라이트 시트 행으로 관리하고, 개별 파일명이 필요하면 `down`, `left`, `right`, `up`을 사용한다.
- 변형은 `v01`, `v02`로 표기한다.
- 버전은 Git으로 관리하며 파일명에 날짜나 `final2`를 넣지 않는다.
- 모든 에셋 키는 파일명에서 확장자를 뺀 값과 동일하게 한다.

---

# PHASE 1 — 비주얼 기준·UI 키트·화면 골격

## 1-1. 목표

게임 코드를 먼저 붙일 수 있도록 스타일을 고정하고, 임시 회색 박스 없이 타이틀·플레이·결과 UI를 완성한다. 이 Phase에서는 맵과 캐릭터를 최종 제작하지 않고 명확한 실루엣의 플레이스홀더만 사용한다.

## 1-2. P0 산출물

### A. 비주얼 기준 문서

| 파일 | 규격 | 내용 |
|---|---:|---|
| `pp_style_board.png` | 1920×1080 | 로봇 3종 실루엣, 마을 색, UI, 화재/물/수리 효과의 기준 보드 |
| `PALETTE.md` | 문서 | HEX 팔레트, 사용 규칙, 역할별 색상 |
| `STYLE_RULES.md` | 문서 | 픽셀 단위, 외곽선, 광원, 금지 사례 |

스타일 보드 승인 기준:

- AQUA/ FIX/ BUDDY를 흑백 실루엣만 봐도 구분할 수 있다.
- 로봇과 배경의 명도가 분리된다.
- UI가 맵보다 한 단계 어두워 정보가 읽힌다.
- 화재 빨강, FIX 노랑, BUDDY 빨강이 혼동되지 않도록 화재에는 주황·노랑 중심과 흰색 코어를 사용한다.

### B. 브랜드와 화면 배경

| 우선 | Asset ID | 파일 크기 | 투명 | 요구사항 |
|---|---|---:|:---:|---|
| P0 | `pp_brand_logo_horizontal` | 512×128 | O | `PIXEL PANIC` 영문 중심, 하단 `AI 구조대` 보조 표기 |
| P0 | `pp_brand_logo_mark` | 128×128 | O | 경광등+픽셀 하트 또는 세 로봇을 상징하는 단순 마크 |
| P0 | `pp_ui_screen_title_bg` | 1280×720 | X | 맑은 마을과 구조 본부, 중앙 로고 공간 확보 |
| P0 | `pp_ui_screen_loading_bg` | 1280×720 | X | 타이틀 배경 단순화 버전 |
| P0 | `pp_ui_loading_spinner` | 32×32 × 8프레임 | O | 8fps loop, 경광등 회전 형태 |
| P0 | `pp_ui_screen_result_success_bg` | 1280×720 | X | 복구된 마을, 색종이, 중앙 결과 카드 여백 |
| P0 | `pp_ui_screen_result_fail_bg` | 1280×720 | X | 그을렸지만 귀여운 마을, 공포·부상 묘사 금지 |

로고 외의 문구는 배경에 포함하지 않는다.

### C. 9-slice UI 패널

| Asset ID | 파일 크기 | 슬라이스 경계 | 용도 |
|---|---:|---:|---|
| `pp_ui_panel_base_9s` | 48×48 | 상하좌우 16px | 일반 HUD, 로봇 카드 |
| `pp_ui_panel_command_9s` | 48×48 | 16px | 하단 명령 도크 |
| `pp_ui_panel_alert_9s` | 48×48 | 16px | 사건/경고 카드 |
| `pp_ui_panel_success_9s` | 48×48 | 16px | 해결 완료 카드 |
| `pp_ui_panel_tooltip_9s` | 32×32 | 10px | 도움말과 말풍선 |
| `pp_ui_input_9s` | 48×48 | 16px | 자연어 입력창 |

요구사항:

- 모서리와 테두리는 고정되고 중앙만 늘어나야 한다.
- 최소 크기까지 줄였을 때 모서리가 겹치지 않아야 한다.
- 패널 중심은 텍스트가 읽히도록 저채도 짙은 남색을 사용한다.

### D. 버튼 상태 시트

각 시트는 프레임 `192×48`, 세로 4프레임, 전체 `192×192`이다. 행 순서는 `normal`, `hover/focus`, `pressed`, `disabled`.

| Asset ID | 역할 |
|---|---|
| `pp_ui_button_primary_states` | 작전 실행, 다시 하기 |
| `pp_ui_button_secondary_states` | 추천 명령, 취소, 뒤로 |
| `pp_ui_button_danger_states` | 위험 확인, 포기 |
| `pp_ui_button_icon_states` | 음소거, 전체화면, 일시정지; 프레임 48×48, 전체 48×192 |

텍스트는 버튼 이미지에 넣지 않는다.

### E. HUD 및 기능 아이콘

모든 P0 HUD 아이콘은 `24×24`, 사건/행동 아이콘은 `32×32`, 배경 투명 PNG로 제작한다.

| 그룹 | Asset ID 목록 |
|---|---|
| HUD 24px | `pp_ui_icon_timer`, `pp_ui_icon_village_hp`, `pp_ui_icon_incident_count`, `pp_ui_icon_rescued`, `pp_ui_icon_command_count`, `pp_ui_icon_ai`, `pp_ui_icon_pause`, `pp_ui_icon_sound_on`, `pp_ui_icon_sound_off`, `pp_ui_icon_fullscreen` |
| 로봇 상태 24px | `pp_ui_icon_ready`, `pp_ui_icon_moving`, `pp_ui_icon_working`, `pp_ui_icon_blocked`, `pp_ui_icon_done`, `pp_ui_icon_warning` |
| 사건 32px | `pp_ui_icon_incident_fire`, `pp_ui_icon_incident_bridge`, `pp_ui_icon_incident_cat`, `pp_ui_icon_incident_generator` |
| 행동 32px | `pp_ui_icon_action_extinguish`, `pp_ui_icon_action_repair`, `pp_ui_icon_action_rescue`, `pp_ui_icon_action_move`, `pp_ui_icon_action_wait`, `pp_ui_icon_action_evacuate` |
| 추천 명령 24px | `pp_ui_icon_quick_fire_first`, `pp_ui_icon_quick_rescue_first`, `pp_ui_icon_quick_nearest`, `pp_ui_icon_quick_high_risk` |

아이콘은 색만으로 구분하지 않는다. 각각 불꽃, 끊어진 판자, 고양이 얼굴, 번개 등 다른 형태를 가진다.

### F. 로봇 UI 초상화

| Asset ID | 크기 | 표정 |
|---|---:|---|
| `pp_ui_portrait_aqua_ready` | 64×64 | 자신감 있는 미소 |
| `pp_ui_portrait_aqua_busy` | 64×64 | 집중 |
| `pp_ui_portrait_aqua_fail` | 64×64 | 그을리고 풀이 죽음 |
| `pp_ui_portrait_fix_ready` | 64×64 | 활기찬 미소 |
| `pp_ui_portrait_fix_busy` | 64×64 | 고글/집중 |
| `pp_ui_portrait_fix_fail` | 64×64 | 공구가 처지고 당황 |
| `pp_ui_portrait_buddy_ready` | 64×64 | 친절한 미소 |
| `pp_ui_portrait_buddy_busy` | 64×64 | 구조 집중 |
| `pp_ui_portrait_buddy_fail` | 64×64 | 걱정스러운 표정 |

### G. 결과 등급과 배지

| Asset ID | 크기 | 비고 |
|---|---:|---|
| `pp_ui_grade_s` | 128×128 | 금색+무지개 반짝임 |
| `pp_ui_grade_a` | 128×128 | 청록색 |
| `pp_ui_grade_b` | 128×128 | 파란색 |
| `pp_ui_grade_c` | 128×128 | 주황색 |
| `pp_ui_grade_f` | 128×128 | 회색/빨강, 모욕적 표현 금지 |
| `pp_ui_badge_mission_complete` | 320×80 | 텍스트 없는 프레임; 텍스트는 코드 처리 |
| `pp_ui_badge_mission_failed` | 320×80 | 텍스트 없는 프레임 |

### H. 플레이스홀더

Phase 2와 3이 끝날 때 교체할 임시 에셋이다.

| Asset ID | 크기 |
|---|---:|
| `pp_placeholder_map` | 1280×544 |
| `pp_placeholder_robot_aqua` | 64×64 |
| `pp_placeholder_robot_fix` | 64×64 |
| `pp_placeholder_robot_buddy` | 64×64 |
| `pp_placeholder_incident_fire` | 64×64 |
| `pp_placeholder_incident_bridge` | 64×64 |
| `pp_placeholder_incident_cat` | 64×64 |
| `pp_placeholder_incident_generator` | 64×64 |

플레이스홀더도 색과 이름이 분명해야 하며, 최종 빌드 검사에서 남아 있으면 실패로 처리한다.

## 1-3. Phase 1 구현 화면

아래 세 화면을 실제 프런트엔드에서 볼 수 있어야 한다.

1. 타이틀: 로고, `게임 시작`, `플레이 방법`, 음소거 버튼
2. 플레이: 상단 HUD, 좌측 로봇 카드, 우측 사건 카드, 하단 명령 입력과 추천 명령, 작전 실행 버튼
3. 결과: 성공/실패 배경, 등급, 구조 수, 사건 해결 수, 마을 보존율, 사용 명령 수, 다시 하기

### 텍스트 처리

- 로고 이외의 한글은 웹폰트 또는 시스템 폰트로 렌더링한다.
- 후보 폰트는 실제 라이선스를 확인하고 저장소에 `LICENSE`를 포함한다.
- 본문은 작은 픽셀 폰트보다 가독성을 우선한다.
- 1280×720 기준 본문 최소 18px, 주요 버튼 최소 20px, 타이머 32px 이상.
- 색 대비에 더해 아이콘과 라벨을 함께 사용한다.

## 1-4. Phase 1 완료 기준

- [ ] 모든 P0 파일이 정확한 크기와 이름으로 존재한다.
- [ ] 타이틀·플레이·성공·실패 화면이 1280×720에서 깨지지 않는다.
- [ ] 1024×576과 844×390 가로 화면에서도 UI가 잘리지 않는다.
- [ ] 모든 버튼의 normal/hover/pressed/disabled 상태가 눈에 보인다.
- [ ] 키보드 포커스 상태가 hover와 동등하게 표시된다.
- [ ] 한글이 이미지에 굽혀 있지 않다.
- [ ] AQUA·FIX·BUDDY의 역할색과 초상화가 즉시 구분된다.
- [ ] 플레이스홀더 목록과 교체 예정 위치가 문서화되어 있다.

## 1-5. Codex에 복사할 Phase 1 실행 프롬프트

```text
당신은 브라우저 게임 PIXEL PANIC — AI 구조대의 UI 아트 리드이자 프런트엔드 통합 담당자다.

이 저장소를 먼저 검사하고 기존 사용자 파일을 보존하라. 1280×720 기준의 캐주얼하고 세련된 픽셀 아트 UI를 제작/통합한다. 게임은 Vercel의 React 또는 Next.js + Phaser 3 환경을 사용한다.

이 문서의 '전 Phase 공통 아트 디렉션', '공통 폴더 구조와 파일명', 'PHASE 1'을 전부 따른다. 스타일 보드, 팔레트 문서, 로고, 타이틀/로딩/성공/실패 배경, 9-slice 패널, 상태별 버튼 시트, HUD·사건·행동·추천 명령 아이콘, 로봇 초상화, 결과 등급, 임시 맵·캐릭터·사건 플레이스홀더를 정확한 이름과 크기로 만든다.

이미지 생성 도구를 사용할 수 있으면 먼저 스타일 보드와 로봇 초상화를 만들어 일관성을 고정하고, 이후 결과를 픽셀 그리드에 맞게 정리한다. 자동 생성된 가짜 글자는 전부 제거한다. UI의 한글은 이미지에 넣지 말고 코드로 렌더링한다.

실제 프런트엔드에서 타이틀, 플레이, 성공, 실패 화면을 확인할 수 있게 한다. 1280×720, 1024×576, 844×390 가로 화면을 검수한다. 완료 후 생성/수정 파일 목록, 이미지 규격 검사 결과, 남은 플레이스홀더 목록, 다음 Phase 주의점을 PHASE_1_REPORT.md에 기록한다. 완료 기준을 하나라도 통과하지 못하면 완료라고 보고하지 말고 수정한다.
```

---

# PHASE 2 — 마을 맵·건물·사건 오브젝트

## 2-1. 목표

카메라를 크게 움직이지 않아도 4개 사건과 세 로봇의 이동 경로가 보이는 한 화면짜리 마을을 제작한다. 예쁜 배경보다 플레이 판독성이 우선이다.

## 2-2. 맵 기술 규격

- 타일 원본: `16×16 px`
- 런타임 타일 크기: `32×32 px` (`2×` 확대)
- 보이는 맵: `40×17 tiles`
- 원본 논리 크기: `640×272 px`
- 런타임 표시 영역: `1280×544 px`
- 좌표 원점: 맵 좌상단 `(0,0)`
- 통행 가능 길 최소 폭: 2 tiles, 권장 3 tiles
- 로봇이 통과할 수 없는 장식은 충돌 레이어에 반드시 표시
- 배경, 충돌, 전경, 사건, 스폰 포인트를 별도 레이어로 분리

권장 Tiled 레이어:

```text
ground
ground_detail
water
path
buildings_back
collision
props_back
incidents
actors
props_front
fx_front
markers_debug
```

`markers_debug`는 개발 모드에서만 보이고 배포 빌드에서는 숨긴다.

## 2-3. 맵 배치 고정안

타일 좌표 기준:

| 구역 | 좌표 범위 | 내용 |
|---|---|---|
| 빵집 | x 2~9, y 1~6 | 화재 사건, 주변 대피 공간 |
| 고양이 집 | x 12~18, y 1~6 | 옥상 고양이 사건 |
| 발전소 | x 32~38, y 1~6 | 발전기 고장 사건 |
| 세로 강 | x 25~28, y 0~16 | 물 영역 |
| 다리 | x 22~31, y 7~9 | 파손 교량 사건, 강 횡단 |
| 구조 본부 | x 2~9, y 11~16 | 로봇 3대 출발점 |
| 중앙 광장 | x 11~21, y 9~15 | 주민 대피와 축하 장면 |
| 안전 구역 | x 31~38, y 11~16 | 주민 대피 완료 지점 |

로봇 스폰 권장값:

- AQUA: `(5, 13)`
- FIX: `(6, 13)`
- BUDDY: `(7, 13)`

사건 중심 좌표:

- 빵집 화재: `(6, 4)`
- 고양이: `(15, 3)`
- 발전기: `(35, 4)`
- 다리: `(26, 8)`

우측 사건 패널에 가리지 않도록 발전기 핵심 애니메이션은 x 34~35에 배치한다.

## 2-4. P0 타일셋

### A. 지형 코어 시트

`pp_world_tileset_terrain_core.png`, 전체 `256×256`, `16×16` 셀.

| 셀 범위 | 내용 |
|---|---|
| 0~7 | 잔디 기본 1종 + 변화 7종 |
| 8~15 | 꽃, 잔돌, 잎 등 통행 가능한 잔디 장식 |
| 16~23 | 흙길 직선·교차·끝·중앙 |
| 24~31 | 돌길 직선·교차·끝·중앙 |
| 32~47 | 잔디↔흙길 경계와 모서리 |
| 48~63 | 얕은 물/깊은 물 기본과 물결 변화 |
| 64~79 | 강둑 상·하·좌·우 및 안/밖 모서리 |
| 80~95 | 광장 바닥, 가장자리, 균열, 배수구 |
| 96~111 | 진흙, 그을음, 젖은 바닥, 사건 후 흔적 |
| 112~127 | 울타리 바닥, 표지판 바닥, 개발용 표시 |
| 128~255 | P1 확장용 예약. P0에서 임의로 채우지 않아도 됨 |

추가 애니메이션 타일:

| Asset ID | 규격 | 애니메이션 |
|---|---:|---|
| `pp_world_tile_water_loop` | 64×16 | 16×16 4프레임, 4fps loop |
| `pp_world_tile_flower_sway` | 64×16 | 16×16 4프레임, 3fps loop |

타일 수락 기준:

- 같은 타일을 가로/세로로 10개 반복해도 이음선이 없다.
- 길 모서리가 끊겨 보이지 않는다.
- 물 애니메이션 첫 프레임과 마지막 프레임이 자연스럽게 연결된다.
- 장식 타일이 충돌 타일처럼 보이지 않는다.

### B. 건물

건물은 투명 PNG이며 원본 크기 기준이다. 런타임에서 `2×` 확대한다.

| 우선 | Asset ID | 원본 크기 | 상태/설명 |
|---|---|---:|---|
| P0 | `pp_world_building_bakery_base` | 96×80 | 간판에 글자 대신 빵 아이콘 |
| P0 | `pp_world_building_bakery_damaged` | 96×80 | 그을음과 깨진 차양; 불꽃은 별도 FX |
| P0 | `pp_world_building_cat_house_base` | 80×72 | 고양이가 올라갈 넓은 지붕 |
| P0 | `pp_world_building_cat_house_roof_fg` | 80×32 | 전경 분리 레이어 |
| P0 | `pp_world_building_power_station_base` | 80×72 | 발전기 건물, 번개 심볼 |
| P0 | `pp_world_building_power_station_restored` | 80×72 | 불이 켜진 복구 상태 |
| P0 | `pp_world_building_rescue_hq` | 112×80 | 세 색 경광등, 출발 지점 |
| P0 | `pp_world_building_house_a` | 64×64 | 배경 주택 |
| P0 | `pp_world_building_house_b` | 64×64 | 색·지붕 형태 차이 |
| P1 | `pp_world_building_shop` | 80×64 | 마을 풍성함용 |

### C. 교량

모든 교량 이미지는 `160×48`, 투명 PNG, 동일한 원점과 바깥 여백을 사용한다.

| Asset ID | 상태 |
|---|---|
| `pp_world_bridge_intact` | 평상시 또는 튜토리얼 참고 상태 |
| `pp_world_bridge_broken` | 중앙 판자 2~3개 파손, 통행 불가가 명확함 |
| `pp_world_bridge_repairing` | 임시 판자와 공구 표시 |
| `pp_world_bridge_repaired` | 새 판자가 추가된 완성 상태 |

### D. 발전기 사건 오브젝트

| Asset ID | 규격 | 프레임 |
|---|---:|---:|
| `pp_world_generator_off` | 48×48 | 1 |
| `pp_world_generator_sparking` | 192×48 | 48×48 4프레임, 6fps loop |
| `pp_world_generator_repairing` | 288×48 | 48×48 6프레임, 10fps loop |
| `pp_world_generator_on` | 192×48 | 48×48 4프레임, 4fps loop |

### E. 월드 소품

| Asset ID | 원본 크기 | 수량/변형 |
|---|---:|---:|
| `pp_world_prop_tree` | 32×48 | 4종 |
| `pp_world_prop_bush` | 24×24 | 4종 |
| `pp_world_prop_flower_patch` | 16×16 | 4종 |
| `pp_world_prop_fence` | 16×16 tiles | 직선/모서리/문 10종 |
| `pp_world_prop_streetlamp` | 16×32 | 꺼짐/켜짐 2종 |
| `pp_world_prop_bench` | 32×16 | 2방향 |
| `pp_world_prop_sign_incident` | 24×32 | 경고 삼각형 |
| `pp_world_prop_hydrant` | 16×24 | AQUA 보조 연출 |
| `pp_world_prop_crate` | 16×16 | FIX 자재 |
| `pp_world_prop_barrier` | 32×16 | 2종 |
| `pp_world_prop_roof_ladder` | 16×48 | BUDDY 구조 연출 |
| `pp_world_prop_evacuate_flag` | 24×32 | 안전 구역 표시 |

### F. 사건 표시 오버레이

| Asset ID | 규격 | 프레임/용도 |
|---|---:|---|
| `pp_world_incident_marker_fire` | 32×48 | 불꽃 배지+아래 포인터 |
| `pp_world_incident_marker_bridge` | 32×48 | 파손 배지+포인터 |
| `pp_world_incident_marker_cat` | 32×48 | 고양이 배지+포인터 |
| `pp_world_incident_marker_generator` | 32×48 | 번개 배지+포인터 |
| `pp_world_incident_marker_pulse` | 192×32 | 32×32 6프레임, 8fps loop |
| `pp_world_target_ring` | 192×32 | 32×32 6프레임, 8fps loop |
| `pp_world_path_arrow` | 128×16 | 16×16 8프레임, 10fps loop |

사건 마커는 클릭 가능 상태에서만 보이고, 해결되면 체크 아이콘으로 바뀐다.

## 2-5. 사건의 상태 표현

모든 사건은 아래 상태를 가져야 한다.

| 상태 | 시각 표현 |
|---|---|
| `warning` | 사건 마커 pulse, 약한 흔들림/섬광 |
| `active` | 화재·스파크·고양이 도움 표시 등 명확한 루프 |
| `assigned` | 담당 로봇 색의 얇은 링과 이동 화살표 |
| `resolving` | 행동 애니메이션과 진행 바 |
| `resolved` | 초록 체크, 환경이 복구 상태로 교체 |
| `failed` | 진한 그을음/고장, 과도한 공포 묘사 금지 |

화재, 연기, 스파크 등 실제 FX는 Phase 3에서 제작한다. Phase 2에서는 배치점과 크기만 더미로 정의한다.

## 2-6. Tiled/맵 데이터 납품

- `pp_stage_01.tmx` 또는 프로젝트 표준 JSON tilemap
- `pp_stage_01_collision.json`
- `pp_stage_01_spawn_points.json`
- `pp_stage_01_preview.png` 1280×544
- 레이어와 오브젝트 이름은 영문 소문자 snake_case
- 사건 오브젝트 속성에 `incident_id`, `target_type`, `state`, `interaction_radius` 포함
- 모든 월드 오브젝트의 origin은 아래 중앙을 기본으로 하며 예외를 manifest에 기록

## 2-7. Phase 2 완료 기준

- [ ] 40×17 전체 맵이 한 화면에 들어온다.
- [ ] 4개 사건을 설명 없이도 찾을 수 있다.
- [ ] 로봇 출발점에서 모든 사건까지 폭 2 tiles 이상의 경로가 있다.
- [ ] 파손된 다리를 통과하지 않아도 각 로봇의 초기 사건 접근 경로가 존재하거나, 의도된 의존 관계가 데이터로 명시되어 있다.
- [ ] 타일 이음선, 잘린 오브젝트, 잘못된 원점이 없다.
- [ ] 좌우 UI 패널이 사건의 핵심 표현을 가리지 않는다.
- [ ] 충돌 레이어와 보이는 장애물이 일치한다.
- [ ] Phase 1의 모든 월드 플레이스홀더가 실제 에셋으로 교체되었다.
- [ ] 1280×544 미리보기와 맵 데이터가 함께 제공된다.

## 2-8. Codex에 복사할 Phase 2 실행 프롬프트

```text
당신은 PIXEL PANIC — AI 구조대의 픽셀 아트 환경 디자이너이자 Phaser 타일맵 통합 담당자다.

저장소와 PHASE_1_REPORT.md를 먼저 읽고, 사용자의 기존 작업을 보존한다. 이 문서의 공통 규격과 PHASE 2를 전부 따라 16×16 source tile, 런타임 2× 기준의 40×17 타일 마을을 제작한다.

빵집 화재, 옥상 고양이, 발전기 고장, 파손 다리가 한 화면에서 즉시 식별되어야 한다. 지정된 타일 좌표, 건물·다리·발전기·소품·사건 마커의 파일명과 크기를 지킨다. 타일셋은 반복 이음선이 없어야 하고, Tiled 또는 현재 프로젝트의 tilemap 형식으로 ground/collision/foreground/incidents/spawn 레이어를 분리한다.

이미지 생성 도구는 건물 콘셉트와 스타일 일관성 확보에 사용할 수 있지만, 최종 타일은 정확한 16px 그리드로 다시 정리한다. 자동 생성된 글자와 안티앨리어싱을 제거한다. 4개 사건의 배치점, 효과 위치, 로봇 상호작용 위치를 데이터로 남긴다.

실제 Phaser 장면에 맵을 로드하고 1280×720 UI 안에서 확인한다. 충돌과 경로를 자동/수동 테스트한다. 완료 후 파일 목록, 타일 인덱스, 스폰 좌표, 사건 좌표, 충돌 검사, 남은 Phase 3 효과 슬롯을 PHASE_2_REPORT.md에 기록한다. 완료 기준을 통과하지 못하면 수정 후 다시 검수한다.
```

---

# PHASE 3 — 로봇·주민·고양이·애니메이션·VFX

## 3-1. 목표

세 로봇의 역할을 움직임만으로 이해할 수 있게 만들고, 사건이 발생·해결되는 과정을 짧고 만족스럽게 표현한다.

## 3-2. 공통 스프라이트 시트 규칙

- 캐릭터 frame: `32×32 px`, 배경 투명.
- 방향 행 순서: `down`, `left`, `right`, `up`.
- 프레임은 좌→우.
- 4방향 시트의 높이는 `128 px`.
- 기본 발 pivot: `(16, 28)`.
- 프레임마다 발 pivot의 차이는 1px 이내.
- 몸 밖으로 길게 나가는 물줄기, 불꽃, 스파크는 캐릭터 시트에 넣지 않고 별도 FX로 제작.
- 좌우 반전으로 대체 가능한 경우에도 장비 비대칭이 깨지는지 확인한다.
- 고유 방향 시트가 있으면 manifest에 행과 프레임 수를 기록한다.

### 공통 애니메이션 타이밍

| 상태 | 프레임 | FPS | 반복 |
|---|---:|---:|:---:|
| idle | 방향당 4 | 6 | O |
| walk/run | 방향당 6 | 10 | O |
| unique action | 방향당 8 | 12 | 상황별 |
| celebrate | 6 | 8 | O 또는 2회 |
| fail | 4 | 6 | O |
| stunned | 4 | 8 | O, P1 |

## 3-3. 로봇 디자인 고정

### AQUA

- 역할: 소방·냉각
- 주색: 청록/파랑
- 실루엣: 둥근 물탱크 등짐, 짧고 넓은 물대포 팔
- 표정: 침착하고 믿음직함
- 이동 시 탱크 안의 물이 1px 정도 출렁이는 연출

### FIX

- 역할: 수리·건설
- 주색: 노랑/주황
- 실루엣: 사각 헬멧, 한쪽 팔의 큰 렌치/망치, 작은 공구 가방
- 표정: 빠르고 활기참
- 수리 시 고글이 내려오거나 눈이 집중 형태로 바뀜

### BUDDY

- 역할: 구조·운반
- 주색: 코랄 빨강/분홍
- 실루엣: 둥근 가슴의 하트 표시, 길게 뻗는 구조 팔, 작은 경광등
- 표정: 친절하고 용감함
- 구조 대상에게 몸을 낮추고 손을 내미는 동작

세 로봇은 색을 제거해도 등짐, 헬멧/공구, 구조 팔의 형태로 구분되어야 한다.

## 3-4. P0 로봇 에셋

### A. AQUA

| Asset ID | 시트 크기 | 구성 |
|---|---:|---|
| `pp_char_robot_aqua_idle` | 128×128 | 32×32, 4방향×4 |
| `pp_char_robot_aqua_walk` | 192×128 | 32×32, 4방향×6 |
| `pp_char_robot_aqua_extinguish` | 256×128 | 32×32, 4방향×8 |
| `pp_char_robot_aqua_celebrate` | 192×32 | 정면 6 |
| `pp_char_robot_aqua_fail` | 128×32 | 정면 4 |

### B. FIX

| Asset ID | 시트 크기 | 구성 |
|---|---:|---|
| `pp_char_robot_fix_idle` | 128×128 | 32×32, 4방향×4 |
| `pp_char_robot_fix_walk` | 192×128 | 32×32, 4방향×6 |
| `pp_char_robot_fix_repair` | 256×128 | 32×32, 4방향×8 |
| `pp_char_robot_fix_celebrate` | 192×32 | 정면 6 |
| `pp_char_robot_fix_fail` | 128×32 | 정면 4 |

### C. BUDDY

| Asset ID | 시트 크기 | 구성 |
|---|---:|---|
| `pp_char_robot_buddy_idle` | 128×128 | 32×32, 4방향×4 |
| `pp_char_robot_buddy_walk` | 192×128 | 32×32, 4방향×6 |
| `pp_char_robot_buddy_rescue` | 256×128 | 32×32, 4방향×8 |
| `pp_char_robot_buddy_carry_walk` | 192×128 | 32×32, 4방향×6; 구조 대상은 별도 socket |
| `pp_char_robot_buddy_celebrate` | 192×32 | 정면 6 |
| `pp_char_robot_buddy_fail` | 128×32 | 정면 4 |

### D. 공통 월드 표시

| Asset ID | 규격 | 설명 |
|---|---:|---|
| `pp_char_shadow_small` | 24×10 | 40% 이하 알파의 타원 |
| `pp_char_selection_ring_aqua` | 32×16 | 파랑 |
| `pp_char_selection_ring_fix` | 32×16 | 노랑 |
| `pp_char_selection_ring_buddy` | 32×16 | 코랄 |
| `pp_char_status_bubble` | 32×40 | 아이콘을 얹는 말풍선 프레임 |

## 3-5. 주민과 동물

P0 주민은 4종이며 피부색, 머리 모양, 체형, 옷이 달라야 한다. 특정 문화권의 고정관념을 과장하지 않는다.

각 주민 `a~d`:

| 상태 | 시트 크기 | 구성 |
|---|---:|---|
| idle | 128×128 | 4방향×4 |
| panic | 192×32 | 정면 6 |
| evacuate_walk | 192×128 | 4방향×6 |
| cheer | 192×32 | 정면 6 |

파일 예:

```text
pp_char_npc_a_idle.png
pp_char_npc_a_panic.png
pp_char_npc_a_evacuate_walk.png
pp_char_npc_a_cheer.png
```

### 고양이

고양이 frame은 `24×24`.

| Asset ID | 시트 크기 | 구성 |
|---|---:|---|
| `pp_char_cat_idle` | 96×24 | 4프레임, 4fps loop |
| `pp_char_cat_meow` | 96×24 | 4프레임, 6fps loop |
| `pp_char_cat_hop` | 144×24 | 6프레임, 10fps |
| `pp_char_cat_rescued` | 96×24 | 4프레임 |
| `pp_char_cat_carry_socket` | 24×24 | BUDDY에 들린 상태 |

## 3-6. P0 행동·환경 효과

효과는 캐릭터/월드와 분리하여 위치와 회전을 코드에서 제어한다.

### A. 화재와 연기

| Asset ID | 프레임 크기 | 프레임 수 | 시트 크기 | FPS |
|---|---:|---:|---:|---:|
| `pp_fx_fire_small_loop` | 24×32 | 6 | 144×32 | 10 |
| `pp_fx_fire_medium_loop` | 32×48 | 8 | 256×48 | 12 |
| `pp_fx_fire_large_loop` | 48×64 | 8 | 384×64 | 12 |
| `pp_fx_smoke_small_loop` | 32×48 | 6 | 192×48 | 6 |
| `pp_fx_smoke_large_loop` | 48×64 | 8 | 384×64 | 6 |
| `pp_fx_ember_particle` | 8×8 | 4 | 32×8 | 12 |

화재는 크기 3종의 루프 시작 프레임을 무작위로 섞어 반복감을 줄인다.

### B. AQUA 효과

| Asset ID | 프레임 크기 | 프레임 수 | 용도 |
|---|---:|---:|---|
| `pp_fx_water_jet_loop` | 64×24 | 6 | 방향에 맞춰 회전/반전 가능 |
| `pp_fx_water_splash` | 48×48 | 8 | 불과 충돌 지점, 12fps once |
| `pp_fx_steam_burst` | 48×48 | 8 | 불이 줄어드는 순간, 10fps once |
| `pp_fx_puddle_fade` | 32×16 | 6 | 해결 후 1초간 fade |

### C. FIX 효과

| Asset ID | 프레임 크기 | 프레임 수 | 용도 |
|---|---:|---:|---|
| `pp_fx_repair_spark` | 32×32 | 6 | 12fps loop |
| `pp_fx_hammer_impact` | 32×32 | 5 | 타격 순간 once |
| `pp_fx_dust_puff` | 32×32 | 6 | 교량 판자 설치 |
| `pp_fx_bolt_pop` | 16×16 | 4 | 공구 느낌의 작은 파티클 |

### D. BUDDY 효과

| Asset ID | 프레임 크기 | 프레임 수 | 용도 |
|---|---:|---:|---|
| `pp_fx_rescue_heart` | 24×24 | 6 | 구조 성공 once |
| `pp_fx_rescue_reach` | 48×32 | 6 | 손을 내미는 강조선 |
| `pp_fx_safe_landing` | 32×32 | 6 | 고양이 착지 |

### E. 발전기와 전기

| Asset ID | 프레임 크기 | 프레임 수 | 용도 |
|---|---:|---:|---|
| `pp_fx_electric_arc` | 48×48 | 6 | 10fps 불규칙 loop |
| `pp_fx_light_flicker` | 32×32 | 4 | 건물 창문/가로등 |
| `pp_fx_power_restore_burst` | 64×64 | 8 | 복구 완료 once |

### F. 공통 게임 피드백

| Asset ID | 프레임 크기 | 프레임 수 | 용도 |
|---|---:|---:|---|
| `pp_fx_alert_ping` | 64×64 | 6 | 사건 발생 |
| `pp_fx_task_assign` | 64×64 | 8 | AI가 로봇에 임무 배정 |
| `pp_fx_task_complete` | 64×64 | 8 | 해결 체크 burst |
| `pp_fx_confetti` | 96×96 | 10 | 미션 성공 |
| `pp_fx_star_burst` | 64×64 | 8 | 점수/등급 |
| `pp_fx_danger_vignette` | 1280×720 | 1 | 가장자리만 투명 빨강, 중앙 완전 투명 |
| `pp_fx_ai_scanline` | 1280×112 | 8 | 하단 명령 도크 분석 중 |

## 3-7. 애니메이션 이벤트 연결

프레임 이벤트를 코드 또는 manifest에 기록한다.

| 애니메이션 | 이벤트 프레임 |
|---|---|
| AQUA extinguish | frame 2에 물줄기 시작, frame 7에 종료 |
| FIX repair | frame 3과 6에 충격/스파크 |
| BUDDY rescue | frame 4에 대상 socket 연결 |
| BUDDY carry walk | 전 프레임에 carry socket 유지 |
| cat hop | frame 3에 최고점, frame 5에 착지 FX |
| generator restored | 첫 프레임에 power restore burst |

## 3-8. 생성형 이미지 사용 규칙

정확한 스프라이트 시트는 이미지 생성 도구가 자주 틀리므로 다음 순서를 따른다.

1. 한 캐릭터의 정면 컨셉과 4방향 턴어라운드를 만든다.
2. 가장 좋은 하나를 기준 이미지로 고정한다.
3. 동작 키포즈를 생성한다.
4. 32×32 그리드에 사람이 읽을 수 있는 실루엣으로 재구성한다.
5. 중간 프레임을 만든다.
6. 프레임별 pivot, 팔 길이, 장비 크기, 색 수를 검사한다.
7. 실제 Phaser에서 2×로 재생해 떨림을 확인한다.

자동 생성된 시트를 그대로 납품하지 않는다.

## 3-9. Phase 3 완료 기준

- [ ] 로봇 3대의 idle, walk, 고유 행동, celebrate, fail이 실제 게임에서 재생된다.
- [ ] 방향 행과 프레임 수가 문서와 일치한다.
- [ ] 걷기 중 발 위치 떨림이 1px 이하이다.
- [ ] 로봇의 고유 행동과 외부 FX가 정확한 프레임에 맞는다.
- [ ] 주민 4종과 고양이 애니메이션이 재생된다.
- [ ] 불→물 분사→증기→진압 완료가 자연스럽게 이어진다.
- [ ] 파손 다리→FIX 수리→복구 다리 전환이 자연스럽다.
- [ ] 고양이 구조 후 BUDDY carry socket이 어긋나지 않는다.
- [ ] 발전기 고장→수리→전력 복구의 상태 변화가 분명하다.
- [ ] 성공과 실패 연출이 각각 존재한다.
- [ ] 모든 스프라이트 배경이 투명하고 halo가 없다.
- [ ] Phase 1의 캐릭터 플레이스홀더가 전부 제거되었다.

## 3-10. Codex에 복사할 Phase 3 실행 프롬프트

```text
당신은 PIXEL PANIC — AI 구조대의 캐릭터 픽셀 아티스트, 애니메이터, Phaser VFX 통합 담당자다.

저장소, PHASE_1_REPORT.md, PHASE_2_REPORT.md를 먼저 읽고 기존 파일을 보존한다. 공통 아트 규격과 PHASE 3을 전부 따른다.

AQUA, FIX, BUDDY는 모두 32×32 source frame, 런타임 2×다. 방향 행은 down/left/right/up이다. 각 로봇의 idle, walk, 고유 행동, celebrate, fail과 BUDDY carry_walk을 정확한 시트 크기로 만든다. 주민 4종, 24×24 고양이, 화재·연기·물·증기·수리·전기·구조·성공·실패 효과를 지정된 파일명, 크기, 프레임 수, FPS로 제작한다.

이미지 생성 도구를 사용할 경우 먼저 캐릭터 기준 이미지와 4방향 턴어라운드를 고정한다. 자동 생성된 스프라이트 시트를 그대로 사용하지 말고 32px 그리드, 픽셀 수, pivot, 실루엣, 프레임 연속성을 수작업 또는 코드 보조로 정리한다. 유명 게임 캐릭터와 유사한 디자인은 사용하지 않는다.

실제 Phaser에서 2× nearest-neighbor로 모든 애니메이션을 재생하고, 프레임 이벤트에 맞춰 물줄기·스파크·socket·효과를 연결한다. 4개 사건을 처음부터 끝까지 각각 한 번 자동 재생하는 animation showcase 장면을 만든다. 완료 후 모든 시트의 frame size/count/FPS/origin/event를 PHASE_3_REPORT.md에 기록하고, 자동 검사와 육안 검사 결과를 포함한다. 완료 기준을 모두 통과할 때까지 수정한다.
```

---

# PHASE 4 — 통합·최적화·반응형·최종 QA

## 4-1. 목표

에셋을 실제 배포 빌드에 안정적으로 연결하고, 누락·경로 오류·깨진 투명도·과도한 용량·반응형 잘림을 제거한다. 새 콘텐츠를 추가하는 Phase가 아니라 완성도를 확보하는 Phase다.

## 4-2. 에셋 매니페스트

`frontend/public/assets/pixel-panic/manifests/asset-manifest.json`을 만든다.

예:

```json
{
  "version": 1,
  "basePath": "/assets/pixel-panic",
  "assets": [
    {
      "key": "pp_char_robot_aqua_walk",
      "type": "spritesheet",
      "url": "characters/robots/pp_char_robot_aqua_walk.png",
      "frameWidth": 32,
      "frameHeight": 32,
      "frames": 24,
      "origin": [0.5, 0.875]
    }
  ],
  "animations": [
    {
      "key": "aqua_walk_down",
      "asset": "pp_char_robot_aqua_walk",
      "start": 0,
      "end": 5,
      "frameRate": 10,
      "repeat": -1
    }
  ]
}
```

모든 PNG/WebP는 manifest에 등록되어야 한다. 저장소에 있으나 manifest 또는 UI 코드에서 전혀 참조되지 않는 파일은 `unused` 목록으로 보고하고 제거 여부를 판단한다.

## 4-3. 아틀라스 정책

- 개발 중에는 개별 PNG를 유지해 디버깅하기 쉽게 한다.
- 배포 시 작은 UI 아이콘과 소형 FX는 아틀라스로 합칠 수 있다.
- 아틀라스 최대 크기: `2048×2048`.
- 픽셀 번짐 방지를 위해 2px padding/extrude를 사용한다.
- 고정 셀 스프라이트 시트는 trim하지 않는다.
- origin과 socket이 필요한 캐릭터 프레임은 자동 trim 금지.
- 정적 배경은 별도 WebP로 유지한다.

권장 아틀라스:

```text
pp_atlas_ui.png + pp_atlas_ui.json
pp_atlas_world_props.png + pp_atlas_world_props.json
pp_atlas_fx_small.png + pp_atlas_fx_small.json
```

## 4-4. 로딩과 실패 처리

- 시작 화면에 필요한 최소 에셋만 먼저 불러온다.
- 플레이 시작 전에 P0 월드·캐릭터·FX를 preload한다.
- 로딩 진행률을 표시한다.
- 에셋 하나가 실패하면 콘솔에 정확한 key와 URL을 출력한다.
- 필수 에셋 실패 시 빈 화면 대신 오류 카드와 재시도 버튼을 표시한다.
- 웹 경로 대소문자 차이로 Vercel에서만 실패하지 않도록 실제 파일명과 URL을 검사한다.

## 4-5. 성능 예산

| 항목 | 목표 | 최대 허용 |
|---|---:|---:|
| 첫 화면 그래픽 전송량 | 1.5MB 이하 | 2.5MB |
| 플레이 시작까지 추가 그래픽 | 5MB 이하 | 8MB |
| 전체 P0 그래픽 | 8MB 이하 | 12MB |
| 개별 정적 배경 WebP | 500KB 이하 | 1.2MB |
| 개별 PNG/시트 | 512KB 이하 권장 | 2MB |
| 텍스처 한 변 | 2048px 이하 | 4096px 금지 |

PNG 최적화는 원본 소스를 보존한 뒤 배포 복사본에만 적용한다. 픽셀 색이나 알파가 바뀌는 손실 압축은 사용하지 않는다.

## 4-6. 반응형 검수 해상도

| 환경 | 해상도 | 검수 항목 |
|---|---:|---|
| 데스크톱 기준 | 1280×720 | 기준 레이아웃, 모든 기능 |
| 작은 노트북 | 1024×576 | 텍스트, 패널 겹침 |
| 큰 데스크톱 | 1920×1080 | nearest-neighbor 배율, 흐림 없음 |
| 모바일 가로 | 844×390 | 입력창과 작전 실행 버튼 접근성 |
| 모바일 가로 소형 | 740×360 | 최소 터치 영역 44 CSS px |
| 모바일 세로 | 390×844 | 회전 안내 오버레이 |

안전 영역:

- 전체 화면 가장자리에서 최소 16px.
- 모바일 노치/safe-area inset 적용.
- 중요한 버튼은 우측 하단 브라우저 UI에 가리지 않게 한다.

## 4-7. 시각 회귀 캡처

아래 상태를 1280×720 PNG로 자동 캡처한다.

```text
01_title.png
02_play_initial.png
03_ai_analyzing.png
04_plan_preview.png
05_fire_resolving.png
06_bridge_resolving.png
07_cat_resolving.png
08_generator_resolving.png
09_result_success_s.png
10_result_fail.png
11_mobile_landscape.png
12_mobile_portrait_rotate.png
```

기준 캡처에는 개발용 충돌/좌표 표시가 없어야 한다.

## 4-8. 그래픽 인수 검사

### 파일 자동 검사

- [ ] manifest의 모든 URL이 HTTP 200 또는 로컬 빌드에서 정상 로드된다.
- [ ] 파일 크기, PNG 폭/높이, RGBA 여부가 지시서와 일치한다.
- [ ] spritesheet 폭과 높이가 frame 크기로 나누어떨어진다.
- [ ] 프레임 수가 manifest와 일치한다.
- [ ] 중복 key와 대소문자 충돌이 없다.
- [ ] JPEG, 임시 파일, `.DS_Store`, `final2`, `copy` 파일이 배포 폴더에 없다.
- [ ] 플레이스홀더 파일이나 플레이스홀더 참조가 없다.
- [ ] 이미지 내부에 의도하지 않은 가짜 글자가 없다.

### 육안 검사

- [ ] 모든 에셋의 픽셀 크기, 외곽선, 광원 방향이 일관된다.
- [ ] AQUA/ FIX/ BUDDY가 색과 실루엣 모두로 구분된다.
- [ ] 사건 4종이 UI 아이콘과 월드 표현에서 같은 시각 언어를 사용한다.
- [ ] 화재가 FIX/BUDDY 색과 혼동되지 않는다.
- [ ] 텍스트와 배경 대비가 충분하며 작은 화면에서도 읽힌다.
- [ ] 애니메이션에 잘림, 떨림, 흰 halo, 순간적인 크기 변화가 없다.
- [ ] 패널이 사건과 캐릭터를 치명적으로 가리지 않는다.
- [ ] 성공 화면은 보상이 느껴지고 실패 화면도 다시 도전하고 싶게 보인다.

### 게임 흐름 검사

- [ ] 첫 실행 후 10초 안에 사고와 입력 방법을 이해할 수 있다.
- [ ] 추천 명령을 클릭하면 입력창과 작전 미리보기가 시각적으로 연결된다.
- [ ] AI 분석 중 로딩 상태가 명확하다.
- [ ] 작전 배정 시 로봇 카드, 이동 화살표, 월드 마커가 같은 색으로 연결된다.
- [ ] 사건 해결 시 월드 상태, 사건 카드, 점수/HUD가 동시에 갱신된다.
- [ ] 4개 사건과 성공/실패 결과를 한 세션에서 확인할 수 있다.
- [ ] GPT-5.6 API가 실패해도 준비된 명령으로 동일한 그래픽 흐름을 끝까지 재생할 수 있다.

## 4-9. 저작권·출처 기록

`ASSET_PROVENANCE.csv`를 만든다.

필수 열:

```text
asset_id,creator,tool,model,created_at,prompt_or_source,reference_files,manual_edits,license,approved_by
```

- 생성형 이미지 도구를 사용한 에셋도 프롬프트와 편집 내용을 기록한다.
- 외부 폰트, 아이콘, 브러시, 팔레트를 사용했다면 정확한 출처와 라이선스를 기록한다.
- 라이선스가 불명확한 에셋은 사용하지 않는다.
- 회사 내부 이미지, 고객 데이터, 기존 상용 게임 에셋을 사용하지 않는다.

## 4-10. 최종 납품물

```text
PIXEL_PANIC_GRAPHICS_4_PHASE_WORK_ORDER_KO.md
PHASE_1_REPORT.md
PHASE_2_REPORT.md
PHASE_3_REPORT.md
PHASE_4_FINAL_REPORT.md
ASSET_PROVENANCE.csv
assets-src/pixel-panic/**
frontend/public/assets/pixel-panic/**
frontend/public/assets/pixel-panic/manifests/asset-manifest.json
visual-regression/01_title.png ... 12_mobile_portrait_rotate.png
```

`PHASE_4_FINAL_REPORT.md`에는 다음을 기록한다.

1. 최종 에셋 수와 전체 용량
2. P0/P1/P2 완료 현황
3. 해상도별 검수 결과
4. 브라우저별 검수 결과
5. 알려진 그래픽 문제와 우회 방법
6. 코드에서 사용하는 manifest 경로
7. 저작권/라이선스 확인 결과
8. 플레이 영상 녹화에 사용할 추천 장면 순서

## 4-11. Codex에 복사할 Phase 4 실행 프롬프트

```text
당신은 PIXEL PANIC — AI 구조대의 최종 통합 담당자이자 그래픽 QA 리드다.

저장소와 PHASE_1_REPORT.md, PHASE_2_REPORT.md, PHASE_3_REPORT.md를 먼저 읽는다. 새 디자인을 무작정 추가하지 말고, 이 문서의 PHASE 4에 따라 기존 P0 에셋을 실제 배포 빌드에 완전하게 연결하고 검수한다.

모든 그래픽을 asset-manifest.json에 등록하고, frame size/count/FPS/origin/event가 실제 파일과 일치하는지 자동 검사한다. 작은 UI와 FX는 필요 시 2048×2048 이하 아틀라스로 묶되 2px padding/extrude를 사용하고 캐릭터 시트는 trim하지 않는다. 시작 화면, preload, 로딩 실패/재시도 상태를 구현한다.

1280×720, 1024×576, 1920×1080, 844×390, 740×360, 390×844에서 검사한다. 12개의 지정된 시각 회귀 캡처를 만든다. 플레이스홀더, 깨진 URL, 잘못된 대소문자, 임시 파일, 가짜 글자, 안티앨리어싱, halo, 잘린 프레임, origin 떨림, UI 겹침을 모두 제거한다. 전체 P0 그래픽 전송량은 8MB 목표, 12MB 최대다.

GPT-5.6 API를 끈 상태에서도 준비된 명령으로 타이틀→AI 분석→작전 실행→4개 사건 해결→성공/실패 결과까지 그래픽 흐름을 끝까지 확인한다. ASSET_PROVENANCE.csv와 PHASE_4_FINAL_REPORT.md를 작성한다. 자동 검사, 육안 검사, 반응형 검사, 게임 흐름 검사 중 하나라도 실패하면 완료라고 보고하지 말고 수정한 후 다시 실행한다.
```

---

## 4. 이미지 생성 프롬프트 예시

아래 프롬프트는 콘셉트 생성용이다. 정확한 픽셀 크기와 시트는 후처리로 맞춘다.

### 공통 스타일 접두문

```text
Casual polished pixel art for an original browser rescue puzzle game, warm cheerful small town, limited cohesive palette, readable silhouettes at tiny scale, one-pixel dark navy outlines, top-left lighting, clean hand-placed pixels, no anti-aliasing, no gradients, no text, no logo, transparent background where requested, original character design, orthographic game asset view.
```

### 공통 네거티브 조건

```text
No photorealism, no 3D render, no vector-smooth edges, no blurred pixels, no painterly texture, no fake letters, no watermark, no copyrighted character resemblance, no gore, no horror, no overly dark scene, no inconsistent pixel sizes, no cropped parts.
```

### 로봇 3종 스타일 보드

```text
Create a cohesive character lineup for three original cute rescue robots in polished pixel art. AQUA is blue and cyan with a round water tank backpack and a short wide water cannon arm; FIX is yellow and orange with a square safety helmet, oversized wrench arm and tool bag; BUDDY is coral red and pink with a heart chest light, extendable rescue arms and a tiny beacon. Short bodies, big expressive face displays, clearly different black silhouettes, same scale and top-left lighting. Show front, side, and back turnarounds plus one role action pose for each. Plain neutral background, no words or labels.
```

### 마을 타일/건물 스타일 보드

```text
Design an original bright pixel-art rescue town asset board for a 16x16 tile grid. Include seamless grass, dirt paths, stone plaza, blue river and banks, a cute bakery with a bread-symbol sign, a small rooftop house for a stranded cat, a compact power station with a lightning symbol, a colorful rescue headquarters, a wooden bridge, trees, fences, benches, hydrant and safety barriers. Orthographic three-quarter top-down view, consistent scale, readable gameplay shapes, warm daylight, no text.
```

### 화재 효과 키포즈

```text
Pixel-art fire animation key poses for a cute browser rescue game: small, medium and large orange-yellow fires with a pale hot core, dark smoke separated into its own layer, readable 1-pixel navy outline only where needed, transparent background. Provide six to eight clearly distinct loop poses, consistent base position, no building, no text, no anti-aliasing.
```

### UI 키트

```text
Original polished pixel-art HUD kit for a cheerful rescue command game, dark navy panels with cream highlights, cyan/yellow/coral role accents, rounded 2-pixel corners, chunky readable buttons, 9-slice-compatible panel borders, icons for timer, village health, fire, broken bridge, cat rescue, generator, AI analysis, movement, repair and success. Transparent background, icons only, no letters, no words, no mock text.
```

### 결과 화면 배경

```text
16:9 pixel-art victory background for a cute town rescue game, restored sunny village plaza, three small original rescue robots celebrating with happy residents and a rescued cat, confetti and sparkling lights, clear empty center area for a result card, warm polished palette, no text, no logo, no copyrighted characters.
```

---

## 5. P1과 P2 확장 목록

P0가 모두 통과한 뒤에만 진행한다.

### P1 — 제출 영상 폴리싱

- 타이틀 배경의 경광등·구름·나뭇잎 미세 애니메이션
- 로봇 선택 시 2프레임 초상화 blink
- 사고 발생 화면 흔들림용 픽셀 테두리
- 주민 2종 추가
- 새/강아지 환경 동물
- 바람으로 화재가 번지는 FX
- 명령 토큰이 AI 패널에서 로봇 카드로 날아가는 효과
- 등급 S 전용 로봇 합동 포즈
- 튜토리얼용 손가락/키보드/터치 아이콘
- OG 공유 이미지 `1200×630`
- 파비콘 `16×16`, `32×32`, `180×180`, `512×512`

### P2 — 본선 확장 대비

- 홍수 사건과 물에 잠긴 타일
- 쓰러진 나무 사건
- 야간 팔레트와 가로등
- 우천 날씨 오버레이
- 맵 장식 건물 3종
- 로봇 stunned/low_battery 애니메이션
- 주민 휠체어/보행 보조 등 접근성을 고려한 다양한 실루엣
- 두 번째 마을 테마

---

## 6. 최종 Definition of Done

그래픽 작업은 다음 조건을 모두 만족할 때만 완료다.

1. P0 에셋이 문서의 파일명, 크기, 프레임 수, 투명도 규격과 일치한다.
2. 1280×720 기준 타이틀부터 결과까지 임시 이미지 없이 플레이 가능하다.
3. 3대 로봇과 4개 사건이 3초 안에 구분된다.
4. 자연어 명령→AI 분석→작전 미리보기→로봇 이동→사건 해결의 시각 연결이 명확하다.
5. API 실패 시에도 동일한 그래픽 흐름을 준비된 명령으로 시연할 수 있다.
6. 데스크톱과 모바일 가로에서 중요한 UI가 잘리지 않는다.
7. 자동 규격 검사, 시각 회귀 캡처, 실제 플레이 검사가 모두 통과한다.
8. 전체 P0 그래픽 전송량이 12MB를 넘지 않는다.
9. 출처와 생성 과정을 `ASSET_PROVENANCE.csv`에 기록했다.
10. 유명 게임/캐릭터의 디자인을 복제하지 않았고 모든 외부 리소스의 라이선스가 확인되었다.

---

## 7. 가장 빠른 실제 실행 방법

1. 새 Codex 작업을 열고 Phase 1 프롬프트를 붙여 넣는다.
2. `PHASE_1_REPORT.md`와 실제 화면을 확인한다.
3. 같은 방식으로 Phase 2를 새 작업에서 실행한다.
4. Phase 2의 맵과 사건 좌표가 확정된 후 Phase 3를 실행한다.
5. 캐릭터와 FX가 실제 게임에서 재생되는 것을 확인한 후 Phase 4를 실행한다.
6. Phase 4에서 실패한 항목만 해당 Phase 작업으로 되돌려 수정한다.

짧은 일정에서는 P1/P2보다 P0의 일관성, 애니메이션 타이밍, UI 판독성, 로딩 안정성을 우선한다.
