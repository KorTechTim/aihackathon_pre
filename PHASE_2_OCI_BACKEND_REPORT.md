# Phase 2 OCI 백엔드 결과 보고서 — 폐기된 설계 기록

기준 커밋: `4d697f4`
작업 브랜치: `codex/post-phase4-stabilization`

> 이 보고서에 처음 기록됐던 브라우저 직접 OCI 호출 구조는 폐기됐다. 현재 운영 기준은 `PRE_OCI_DEPLOYMENT_FIX_REPORT.md`와 `infra/oci/README.md`다.

## 보존된 구현

- Node.js 20 + TypeScript + Fastify 백엔드
- OpenAI timeout, strict structured output, fallback 계획
- IP rate limit, 동시 burst 제한, 성공 계획 cache
- request ID와 command 원문을 제외한 안전한 감사 로그
- non-root, read-only Docker 이미지와 healthcheck
- Ubuntu 22.04 Compose/systemd 자동 기동 구성

## 교체된 보안 경계

```text
브라우저 → Vercel same-origin /api/plan
        → 공유 Bearer 토큰 → OCI VM 공인 IP:8080 /v1/plan
        → OpenAI
```

- 브라우저는 OCI 주소와 토큰을 받지 않는다.
- Vercel Route는 OpenAI를 직접 호출하지 않는다.
- OCI `/health`만 공개하고 `/v1/plan`은 공유 토큰을 요구한다.
- OpenAI 키는 OCI의 `/etc/pixel-panic/backend.env`에만 저장한다.
- OCI 장애는 Vercel Route가 HTTP 200 `LOCAL` fallback으로 변환한다.

## 외부 미완료 항목

- `pixel-panic-api-prod-01` 생성/접속 및 Docker 배포
- NSG/Security List TCP 22/8080 규칙 검증
- Vercel 서버 전용 OCI URL과 토큰 등록
- Vercel에 남은 OpenAI 환경변수 제거
- Ubuntu 재부팅 자동 복구와 실제 end-to-end 검증
