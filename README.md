# PIXEL PANIC — AI 구조대

자연어로 `AQUA`, `FIX`, `BUDDY` 세 구조 로봇을 지휘해 90초 안에 도트 마을의 네 사고를 해결하는 NHN AI 해커톤 예선용 구조 퍼즐 게임입니다.

[PIXEL PANIC 공개 데모](https://pixel-panic-ai-rescue.vercel.app) · 데스크톱 또는 모바일 가로 화면 권장

![PIXEL PANIC 최종 타이틀](visual-regression/phase4/01_title.png)

## 아키텍처

```text
브라우저 → Vercel Next.js same-origin /api/plan
        → OCI Ubuntu 22.04 VM 공인 IP:8080 /v1/plan
        → OpenAI Responses API
```

- 브라우저는 OCI 주소나 인증 토큰을 알지 못합니다.
- Vercel Route는 서버 전용 공유 Bearer 토큰으로 OCI를 호출합니다.
- OpenAI API 키는 OCI VM의 저장소 밖 환경파일에만 둡니다.
- OCI/OpenAI/네트워크/429/5xx 장애 시 Vercel Route가 동일 schema의 `LOCAL` fallback을 반환합니다.
- OCI API는 인증 후 전달된 client IP 기준으로 분당 60회, 동시 burst 6회 제한하며 성공 계획을 60초/100개 캐시합니다.

프런트엔드는 Next.js 16.3, React 19.2, TypeScript, Phaser를 사용하고 백엔드는 Node.js 20, Fastify, OpenAI Node SDK, Docker로 구성됩니다.

## 최초 1회 설치

지원 범위는 Node.js `>=20 <23`, Python `>=3.10`이며 Python 3.12를 권장합니다. Pillow 12.3은 Python 3.9에서 설치되지 않으므로 부트스트랩이 패키지 설치 전에 버전을 검사합니다.

```bash
git clone https://github.com/KorTechTim/aihackathon_pre.git
cd aihackathon_pre
./scripts/bootstrap_dev.sh
```

스크립트는 프런트엔드와 backend 의존성, 프로젝트 전용 `.venv`, Pillow, Playwright Chromium을 반복 실행 가능한 방식으로 준비합니다.

## 개발 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. Vercel 프록시용 서버 환경변수가 없으면 `/api/plan`이 OpenAI를 직접 호출하지 않고 즉시 fallback 계획을 반환합니다.

OCI backend만 개발할 때는 저장소 밖 개발용 환경파일에 테스트 공유 토큰을 설정한 뒤 실행합니다.

```bash
npm --prefix backend run dev
```

## 환경변수

`.env.example`과 `infra/oci/env.production.example`에는 변수 이름과 placeholder만 있습니다. 실제 비밀 파일은 Git에 넣지 않습니다.

| 변수 | 위치 | 설명 |
|---|---|---|
| `OCI_BACKEND_URL` | Vercel server | `http://OCI_PUBLIC_IP:8080` |
| `OCI_BACKEND_TOKEN` | Vercel server | OCI 공유 토큰과 같은 서버 전용 값 |
| `OCI_BACKEND_TIMEOUT_MS` | Vercel server | 기본 6500ms |
| `OPENAI_API_KEY` | OCI backend | OpenAI 서버 전용 키 |
| `OPENAI_MODEL` | OCI backend | 기본 `gpt-5.6-luna` |
| `BACKEND_SHARED_TOKEN` | OCI backend | 최소 32바이트 공유 토큰 |
| `TRUST_PROXY_HOPS` | OCI backend | Vercel 전달 IP 한 홉 신뢰 |

운영 Vercel에는 OpenAI 키를 두지 않습니다. `NEXT_PUBLIC_ENABLE_TEST_DEBUG`는 QA 빌드에서만 `1`이며 비밀값이 아닙니다.

## 검증 명령

```bash
npm run policy:verify   # 경로·비밀정보·버전 정책
npm run assets:verify   # 그래픽 규격·예산·매니페스트
npm run typecheck      # 프런트와 backend TypeScript
npm run test:unit      # 상태 모델과 Vercel 프록시
npm run test:backend   # 인증/health/plan/fallback/rate/cache/logging
npm run build:test     # QA debug snapshot을 포함한 production build
npm run qa:full        # 전체 플레이/fallback/순서/종료 경합
npm run ci             # 로컬 검증 전체
npm run ci:docker      # backend 이미지 build와 컨테이너 인증/health
```

브라우저 QA는 항상 same-origin `/api/plan`을 mock하며 실제 OpenAI 유료 요청을 실행하지 않습니다. 실제 VM 점검용 `qa:oci-api`도 인증 정보가 보안 환경변수로 이미 주입된 관리 환경에서만 실행합니다.

VM, Docker, NSG/Security List, systemd, Vercel 연결 절차는 [OCI 배포 문서](infra/oci/README.md)에 있습니다.

## 에셋 생성

완료된 그래픽을 재생성할 필요는 없습니다. 소스 수정 후에만 아래 명령을 사용합니다.

```bash
npm run assets:generate
npm run assets:verify
```

## 주요 문서

- [그래픽 작업 지시서](PIXEL_PANIC_GRAPHICS_4_PHASE_WORK_ORDER_KO.md)
- [Phase 3 결과](PHASE_3_REPORT.md) / [Phase 4 최종 결과](PHASE_4_FINAL_REPORT.md)
- [통합 에셋 매니페스트](frontend/public/assets/pixel-panic/manifests/asset-manifest.json)
- [OCI 배포 문서](infra/oci/README.md)
- [배포 전 수정 결과](PRE_OCI_DEPLOYMENT_FIX_REPORT.md)

본 저장소의 캐릭터, UI, 배경, 효과와 로고는 이 프로젝트를 위해 제작한 오리지널 에셋입니다.
