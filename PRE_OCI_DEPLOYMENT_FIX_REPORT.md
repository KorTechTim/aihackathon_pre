# PIXEL PANIC OCI 배포 전 수정 결과

## 구현 결과

- 기준 브랜치: `codex/post-phase4-stabilization`
- 기준 커밋: `e992dc4199ccfa7b8c1fc013b0d498e9af2f66c0`
- 최종 커밋: 이 보고서를 포함한 `codex/post-phase4-stabilization` 후속 커밋
- PR URL: 요청 범위에 따라 생성하지 않음
- 목표 아키텍처: 저장소 구현과 로컬 TCP 통합 검증 완료

```text
브라우저 → Vercel same-origin /api/plan
        → 공유 Bearer 토큰 → OCI VM 공인 IP:8080 /v1/plan
        → OpenAI Responses API
```

브라우저 코드에는 OCI 주소와 토큰이 없으며 Vercel Route는 OpenAI SDK나 OpenAI 키를 사용하지 않는다. OCI 장애는 Vercel Route에서 동일 plan schema의 HTTP 200 `LOCAL` fallback으로 변환한다.

## 변경 파일

- `app/page.tsx`: 계획 요청을 same-origin `/api/plan`으로 고정
- `app/api/plan/route.ts`: OpenAI 직접 호출을 제거하고 OCI 프록시 진입점으로 교체
- `lib/server/oci-plan-client.ts`: URL 검증, 제한시간, Bearer 인증, 전달 IP 정규화, 응답 schema 검증, 안전한 fallback과 로그 구현
- `lib/server/oci-plan-client.test.ts`: 정상/timeout/429/5xx/invalid/config/input/header/secret 테스트
- `backend/src/middleware/backend-auth.ts`: timing-safe 공유 토큰 인증
- `backend/src/config.ts`, `backend/src/routes/plan.ts`, `backend/src/server.ts`: production 토큰 강제, 인증 선행, server-to-server 구조 적용
- `backend/test/server.test.ts`: health 공개, 무인증/오인증 401, 인증 요청, planner 차단, rate/cache/logging 검증
- `infra/oci/*`: VM 직접 배포, 저장소 밖 비밀 파일, 절대 systemd 경로, 공인 8080 포트 문서화
- `scripts/bootstrap_dev.sh`: Node `>=20 <23`, Python `>=3.10` 선행 검사
- `scripts/verify_repository_policy.mjs`: 공개 OCI 경로·폐기 구성·비밀값·버전 정책 자동 검사
- `scripts/test_backend_container.sh`, `.github/workflows/ci.yml`: Docker build/health/auth/fallback 통합 테스트 추가
- `README.md`: 현재 아키텍처와 환경변수·검증 절차로 갱신

Phase 1~4 그래픽 에셋과 기존 비주얼 회귀 이미지는 수정하지 않았다.

## 테스트 결과

- clean dependency install: `npm ci`, `npm --prefix backend ci` 통과
- bootstrap: 통과, Node 22.23.1 / Python 3.11 환경 확인
- repository policy: 전체 추적 경로 검사 통과
- typecheck: 프런트와 backend 통과
- unit: 14개 통과
- backend: 16개 통과
- assets: Phase 1, 2, 3/4 전체 통과
- build: Next production QA build와 backend build 통과
- browser QA: full-flow, OCI 장애 fallback, 대표 priority, timeout/abandon race, 반응형 통과
- TCP integration: OCI 직접 무인증 401, Vercel 프록시 200 fallback, 요청 ID 일치
- Docker build/health: 로컬 Docker 런타임 부재로 미실행, GitHub Actions 단계 구현 완료
- GitHub Actions: workflow가 `main` push와 PR에서만 실행되므로 PR 생성 전까지 대기
- Vercel Preview: 브랜치 push 후 외부 배포 상태 확인 대상이며 OCI URL은 아직 미확정
- 실제 OpenAI 유료 호출: 실행하지 않음

## 보안 확인

- OpenAI 키 저장 위치: OCI의 `/etc/pixel-panic/backend.env`만 허용
- OCI 공유 토큰 인증: `/health` 공개, `/v1/plan`은 32바이트 이상 Bearer 토큰 필수
- 인증 순서: request body 처리와 rate limit/cache/planner보다 먼저 실행
- 전달 IP: Vercel이 덮어쓰는 전달 헤더를 IP 형식으로 정규화한 후 인증된 OCI 요청에서만 사용
- 비밀값 Git 추적: 실제 키·토큰 패턴과 production 비밀 파일 0건
- 로그: request ID, command 길이, 소요 시간, upstream status, source만 기록하며 command/Authorization/키/토큰은 제외
- Vercel Route의 OpenAI 키·SDK 참조: 0건
- 브라우저의 OCI 설정 참조: 0건

## 남은 외부 작업

1. PR을 생성해 GitHub Actions와 Vercel Preview를 green으로 만든다.
2. 승인된 코드를 `main`에 병합하고 병합 커밋 SHA를 기록한다.
3. OCI VM `pixel-panic-api-prod-01`과 NSG/Security List TCP 22/8080 규칙을 준비한다.
4. `/etc/pixel-panic/backend.env`에 OCI 전용 OpenAI 키와 공유 토큰을 보안 방식으로 등록한다.
5. Docker build, healthcheck, 무인증 401, 인증 fallback을 실제 VM에서 확인한다.
6. Vercel Production에 서버 전용 OCI URL·토큰·timeout을 등록하고 Vercel의 OpenAI 환경변수를 제거한다.
7. 실제 OpenAI 호출을 한 번만 검증하고 장애 훈련과 Ubuntu 재부팅 자동 복구를 확인한다.

위 외부 조건이 끝나기 전에는 OCI production 배포 완료로 승인하지 않는다.
