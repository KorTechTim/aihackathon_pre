# Phase 3 테스트 재현성 강화 보고서

## 환경 고정

- root와 backend의 모든 `latest`/범위 의존성을 lockfile의 검증 버전으로 고정
- Node.js 범위 `>=20 <23`
- `requirements-dev.txt`: `Pillow==12.3.0`
- `scripts/bootstrap_dev.sh`: root/backend `npm ci`, `.venv`, pip, Pillow, Chromium 설치
- `.venv`, backend dist/node_modules, tsbuildinfo, OCI production env를 Git에서 제외

## 명령 구성

- `npm run setup`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:backend`
- `npm run build:test`
- `npm run qa:smoke`
- `npm run qa:full`
- `npm run qa:oci-api`
- `npm run ci`

## 회귀 테스트

- 빠른 Phase 3/4 smoke
- 타이틀부터 성공 결과와 재시작까지 full-flow
- API 503 local fallback full-flow
- 기본/구조 우선/위험 우선/역순의 UI/Phaser 정합성
- 시간 초과/포기와 성공 timeout 경합
- backend health/plan/rate/cache/CORS/logging
- OCI Gateway health/validation 및 opt-in live plan script

## 깨끗한 복사본 재현 결과

기존 `node_modules`, `.venv`, `.next`, `.env.local`을 포함하지 않은 임시 소스 복사본에서 실행했다.

| 명령 | 결과 | 소요 시간 |
|---|---|---:|
| `./scripts/bootstrap_dev.sh` | 통과 | 7.62초 |
| `npm run ci` | 통과 | 55.98초 |

`npm run ci` 안에서 에셋 Phase 1/2/3·4, TypeScript, 상태 단위 테스트 6개, backend 테스트 12개, production build, 전체 Playwright 회귀가 모두 통과했다. OpenAI 키 없이 실행했다.

## GitHub Actions

Ubuntu 22.04, Node 20.19.5, Python 3.12, Chromium 환경의 `.github/workflows/ci.yml`을 추가했다. 실제 GitHub 실행 결과는 브랜치를 push한 뒤 확인해야 한다.
