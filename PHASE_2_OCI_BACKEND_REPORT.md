# Phase 2 OCI 백엔드 결과 보고서

기준 커밋: `4d697f4`
작업 브랜치: `codex/post-phase4-stabilization`

## 구현 상태

OCI에 올릴 애플리케이션, 보호 기능, Docker/systemd/API Gateway 예시와 배포 문서를 구현했다. 현재 작업 환경에는 OCI CLI, `~/.oci` 설정, VM 접속 정보가 없으므로 실제 OCI 리소스 생성과 Vercel 전환은 수행하지 않았다.

## API 계약

### `GET /health`

서비스명, 버전, 키 설정 여부와 timestamp를 반환한다. 키 값이나 일부 문자열은 반환하지 않는다.

### `POST /v1/plan`

- command 2~500자
- OpenAI 성공: `source=openai`
- 키 없음, timeout, API 오류, 잘못된 structured output: HTTP 200과 동일 plan schema의 `source=fallback`
- 모든 응답에 `requestId` 및 `X-Request-Id`
- invalid JSON/command는 400, rate limit은 429와 `Retry-After`

## 보호 기능

- OpenAI timeout 최대 6초, `maxRetries: 0`, `store: false`
- strict JSON Schema와 서버측 priority/assignment 재정규화
- IP당 60초 10회, 동시 burst 3회
- 성공 계획 60초, 최대 100개 LRU 성격의 인메모리 캐시
- fallback은 캐시하지 않음
- `ALLOWED_ORIGINS` allowlist, production `*` 거부
- Fastify의 신뢰된 proxy hop 설정을 통해 임의 X-Forwarded-For 기본 불신
- 로그에는 command 길이, request ID, 소요 시간, source, 상태, cache hit만 기록

## 배포 산출물

- `backend/`: Node.js 20 + TypeScript + Fastify 서비스와 테스트
- `backend/Dockerfile`: multi-stage, non-root, healthcheck, production dependencies
- `infra/oci/docker-compose.yml`: private bind, 자동 재시작, healthcheck, 로그 제한, read-only filesystem
- `infra/oci/pixel-panic-api.service.example`: systemd 자동 기동
- `infra/oci/api-gateway-deployment.example.json`: `/health`, `/v1/plan`, CORS, execution log 예시
- `infra/oci/README.md`: Ubuntu 22.04 준비, 배포, 검증, 업데이트와 롤백

## 프런트 연결

`NEXT_PUBLIC_API_BASE_URL`이 있으면 `${API_BASE}/v1/plan`, 없으면 개발 호환용 `/api/plan`을 사용한다. 프런트에도 7.5초 AbortController timeout과 schema/source 검증을 적용했다.

Vercel Production 전환 시 필요한 순서:

1. OCI VM과 API Gateway 배포
2. `NEXT_PUBLIC_API_BASE_URL=https://<generated-gateway-hostname>` 등록
3. Vercel 재배포와 OCI execution log의 request ID 확인
4. Vercel `OPENAI_API_KEY` 제거
5. 채팅에 노출됐던 기존 키 폐기·교체

## 테스트 결과

- backend TypeScript/build 통과
- OpenAI planner와 HTTP 통합 테스트 12개 통과
- health, success/fallback, timeout/error, invalid JSON/length, 11번째 요청, burst 4번째 요청, cache, CORS, secret-safe audit 검증
- 실제 로컬 TCP 서버에서 `/health` 200, 키 없는 `/v1/plan` 200 fallback, CORS와 request ID 확인
- Docker 런타임은 현재 Mac에 Docker CLI가 없어 이미지 build를 실행하지 못함

## 외부 미완료 항목

- `pixel-panic-api-prod-01` 생성/접속 및 Ubuntu 재부팅 검증
- `pixel-panic-api-nsg` 실제 규칙 검증
- `pixel-panic-api-gateway-prod` 배포와 자동 생성 HTTPS 주소 확인
- Vercel `NEXT_PUBLIC_API_BASE_URL` 등록과 OpenAI 키 제거
- OCI p95/동시 사용자 성능 측정
