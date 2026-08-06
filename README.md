# PIXEL PANIC — AI 구조대

자연어로 `AQUA`, `FIX`, `BUDDY` 세 구조 로봇을 지휘해 90초 안에 도트 마을의 네 가지 사고를 해결하는 캐주얼 구조 퍼즐 게임입니다. NHN AI 해커톤 예선 심사용으로 제작했습니다.

## 공개 데모

[PIXEL PANIC 웹 데모 실행](https://pixel-panic-ai-rescue.vercel.app)

데스크톱 또는 모바일 가로 화면을 권장합니다. 모바일 세로 화면에서는 회전 안내를 제공합니다.

![PIXEL PANIC 최종 타이틀](visual-regression/phase4/01_title.png)

## 구현 완료 범위

그래픽 작업 지시서의 **Phase 1–4 전체 범위**를 구현했습니다.

- 고품질 최종 타이틀, 로딩 진행률·실패 재시도, 성공 S등급·실패 결과 화면
- 자연어 명령 입력, 추천 명령 4종, AI 분석 상태와 로봇별 작전 미리보기
- `화재 진압 → 다리 수리 → 고양이 구조 → 발전기 복구 → 축하` 실제 플레이 시퀀스
- AQUA·FIX·BUDDY 32×32, 4방향 idle/walk/고유 행동/celebrate/fail 스프라이트
- 주민 4종과 고양이 idle/panic/evacuate/cheer/hop/rescued 애니메이션
- 화재·연기·물·증기·수리·전기·구조·완료 효과 26종
- 40×17 픽셀 마을, 4개 사건, 12개 레이어와 680셀 충돌 데이터
- 176개 런타임 PNG/WebP를 등록한 통합 에셋 매니페스트와 36개 애니메이션 메타데이터
- 2048px 텍스처 제한, 로딩 예산, 필수 파일·크기·알파·경로 자동 검증
- 1280×720, 1024×576, 1920×1080, 모바일 가로·세로 반응형 대응
- Playwright 스모크 테스트와 Phase 4 필수 장면 12종 회귀 캡처

## 실행 방법

Node.js 20.9 이상이 필요합니다.

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 생성·검수 명령

```bash
npm run assets:generate
npm run assets:verify
npm run build
BASE_URL=http://127.0.0.1:3000 npm run qa:phase34
```

`qa:phase34`는 실제 타이틀→플레이→분석→미리보기→실행 흐름과 매니페스트, 모바일 회전 안내를 검사하고 `visual-regression/phase4`에 12개 장면을 저장합니다.

## 주요 문서

- [그래픽 4-Phase 작업 지시서](PIXEL_PANIC_GRAPHICS_4_PHASE_WORK_ORDER_KO.md)
- [Phase 1 결과 보고서](PHASE_1_REPORT.md)
- [Phase 2 결과 보고서](PHASE_2_REPORT.md)
- [Phase 3 결과 보고서](PHASE_3_REPORT.md)
- [Phase 4 최종 보고서](PHASE_4_FINAL_REPORT.md)
- [Phase 3·4 이미지 생성 프롬프트](assets-src/pixel-panic/ui/reference/PHASE_3_4_IMAGEGEN_PROMPTS.md)
- [통합 에셋 매니페스트](frontend/public/assets/pixel-panic/manifests/asset-manifest.json)
- [에셋 출처 기록](ASSET_PROVENANCE.csv)

## 기술 구성

- Next.js 16 + React 19 + TypeScript
- Phaser 3 (`pixelArt`, `roundPixels`, `antialias: false`)
- Pillow 기반 결정론적 스프라이트시트 생성과 WebP 최적화
- Playwright 기반 상호작용·반응형·비주얼 회귀 검수

본 저장소의 캐릭터, UI, 배경, 효과와 로고는 이 프로젝트를 위해 새로 제작한 오리지널 에셋입니다.
