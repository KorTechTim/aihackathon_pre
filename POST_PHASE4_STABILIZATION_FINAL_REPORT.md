# PIXEL PANIC Post-Phase 4 안정화 최종 보고서

## 1. 기준과 작업 위치

- 기준 커밋: `4d697f4`
- 작업 브랜치: `codex/post-phase4-stabilization`
- 최종 커밋: 게시 시 `git rev-parse HEAD`로 기록

## 2. 수정한 핵심 버그

1. 임의 AI priority에서 phase 기반 추측으로 월드 사건 상태가 뒤집히던 문제
2. 시간 초과/포기 후 예약 성공 timeout이 결과를 덮을 수 있던 문제
3. phase 전환마다 게임 타이머 interval이 재시작되던 문제
4. 로봇이 각 단계마다 본부로 순간이동하고 충돌 데이터를 이동에 쓰지 않던 문제
5. HUD와 결과 화면의 보존율·해결 수·명령 수·등급이 고정값이던 문제
6. 공개 AI 경로에 rate limit/cache/CORS/request ID가 없던 문제
7. 새 환경에서 `.venv`, Pillow, Chromium을 재현할 수 없던 문제
8. API mock과 첫 사건까지만 확인하던 브라우저 테스트 범위

## 3. 게임 상태 모델

`completedIncidents`가 유일한 사건 완료 기준이다. UI와 Phaser는 `deriveWorldSnapshot`을 공유하며, `complete`는 `canComplete`가 true일 때만 허용한다. 모든 비동기 작업은 request/run ID와 AbortController로 무효화할 수 있고 결과 확정은 `finishGame` 한 경로로 처리한다.

## 4. 목표 OCI 구조

```text
브라우저 → Vercel → OCI API Gateway 자동 HTTPS 주소
                    → private VCN의 pixel-panic-api-prod-01:8080
                    → OpenAI API
```

API Gateway deployment path prefix는 `/`이고 backend route는 `/health`, `/v1/plan`이므로 `/v1/v1/plan` 중복이 없다.

## 5. 환경변수

### Vercel

- `NEXT_PUBLIC_API_BASE_URL`: OCI Gateway 주소
- `NEXT_PUBLIC_ENABLE_TEST_DEBUG=0`

### OCI backend

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `ALLOWED_ORIGINS`
- `TRUST_PROXY_HOPS`
- `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_BURST`
- `PLAN_CACHE_TTL_MS`, `PLAN_CACHE_MAX`

## 6. 테스트 결과

- 에셋 Phase 1/2/3·4 검증 통과
- 프런트/backend TypeScript 통과
- 상태 단위 테스트 6개 통과, 24개 priority 순열 포함
- backend 테스트 12개 통과
- Next production build 통과
- full-flow, fallback, 대표 priority 4종, 종료 경합 Playwright 통과
- 깨끗한 복사본 bootstrap 7.62초, 전체 CI 55.98초
- 로컬 backend TCP health와 keyless fallback 통과

## 7. 장애 결과

| 상황 | 결과 |
|---|---|
| 키 없음 | backend 200 fallback, 게임 LOCAL 전체 성공 |
| 잘못된 structured output | backend fallback 테스트 통과 |
| OpenAI 예외/timeout | backend fallback 테스트 통과 |
| 프런트 API 503 | LOCAL 전체 성공 |
| rate limit 429 | 프런트 LOCAL 전환 캡처 확인 |
| 시간 초과 | 실패 결과 유지, 예약 성공 차단 |
| 작전 포기 | 실패 결과 유지, 예약 성공 차단 |
| 실제 OCI 중지/5xx | 자격증명·배포 부재로 미실시 |

## 8. 비주얼 회귀

- 기존 `01`~`12` 기준 이미지는 변경하지 않음
- 추가 검수: `13_priority_cat_first`, `14_priority_generator_first`, `15_local_fallback`, `16_rate_limited`, `17_timeout_fail`
- 다섯 장 모두 텍스트 잘림, 패널 이탈, 아트 방향 변경 없음
- generator-first에서 FIX가 본부가 아닌 충돌 경로를 따라 이동하는 장면 확인

## 9. 알려진 문제와 릴리스 판정

로컬 안정화 후보는 통과했지만 **OCI production 릴리스는 아직 승인하지 않는다.** 다음 외부 항목이 남아 있다.

- OCI VM/NSG/API Gateway 미배포
- Docker 이미지 실제 build/health 미검증
- Ubuntu 재부팅 자동 복구 미검증
- Vercel `NEXT_PUBLIC_API_BASE_URL` 미등록
- Vercel에 남은 OpenAI 키 미제거
- GitHub Actions 원격 실행 미확인
- OCI/Vercel 실제 전체 흐름과 p95 성능 미측정

## 10. 롤백

- 코드: `4d697f4`로 복귀
- Vercel: 직전 known-good deployment를 promote
- OCI: `/opt/pixel-panic`에서 직전 승인 커밋 checkout 후 `docker compose --env-file .env.production up -d --build`
- 장애 중에는 프런트가 API 실패를 LOCAL fallback으로 처리

## 11. 제출 전 체크리스트

- [x] 24개 priority 순열 상태 모델 검증
- [x] 시간 초과·포기·성공 경합 차단
- [x] HUD와 결과 통계 일치
- [x] rate limit·cache·CORS·secret-safe logging 로컬 통과
- [x] 깨끗한 소스 복사본 전체 검증
- [x] 기존 12개 아트 기준 보존 및 추가 5개 검수
- [ ] OCI VM/Gateway 배포와 재부팅 검증
- [ ] Vercel을 OCI Gateway로 전환하고 Vercel OpenAI 키 제거
- [ ] GitHub Actions green 확인
- [ ] 실제 OCI/Vercel 장애 훈련과 성능 확인
