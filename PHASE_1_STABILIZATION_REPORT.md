# Phase 1 안정화 결과 보고서

기준 커밋: `4d697f4`
작업 브랜치: `codex/post-phase4-stabilization`

## 결과

게임 상태 정합성 P0와 종료 경합 P0를 구현하고 로컬 자동 테스트를 통과했다. 그래픽 에셋과 기존 12개 비주얼 기준 이미지는 수정하지 않았다.

## 상태 모델

`lib/game-state.ts`가 사건 ID, priority 정규화, 월드 스냅샷, 완료 가능 여부와 실제 게임 통계를 담당한다.

- `normalizePriority`: 허용 사건만 유지, 중복 제거, 누락 사건을 기본 순서 뒤에 추가
- `deriveWorldSnapshot`: `completedIncidents`의 `Set.has()` 의미만으로 화재·다리·고양이·발전기 상태 계산
- `canComplete`: 네 사건이 모두 완료된 경우만 true
- `calculateGameStats`: 남은 시간, 명령 수, 완료 사건, 종료 사유로 보존율·구조 수·등급 계산
- `isOperationCallbackAllowed`: run ID가 바뀌거나 결과가 확정된 예약 콜백 차단

React 사건 패널, HUD, 결과 화면과 Phaser 월드는 동일한 `completedIncidents`를 사용한다. `GameCanvas`는 phase 이름으로 해결 개수를 추측하지 않는다.

## 핵심 수정

- `GameCanvas`에 `completedIncidents` 전달
- 완료 사건별 불/연기, 다리, 고양이, 발전기, 마커 상태 동기화
- 로봇 이동 중 기존 위치를 유지하고 다음 사건으로 이어서 이동
- 680셀 충돌 JSON을 사용하는 BFS 경로와 꺾임 waypoint 적용
- 시간 초과·포기·성공·런타임 오류를 `finishGame`으로 단일화
- `AbortController`, 분석 request ID, operation run ID, timeout 정리 적용
- phase 전환에도 타이머 interval이 재시작되지 않도록 현재 phase를 ref로 분리
- HUD와 결과 화면이 동일한 `GameStats`를 사용
- S/A/B/C/F 실제 등급 에셋 연결

## 자동 검증

- 순수 상태 단위 테스트 6개 통과
- 24개 모든 priority 순열의 완전성과 중복 없음 확인
- 중복·누락·알 수 없는 사건 ID 정규화 확인
- 대표 네 순서에서 UI와 Phaser의 완료 목록 일치 확인
- full-flow에서 사건 4개, 성공 4/4, 재시작 초기화 확인
- API 503에서 LOCAL fallback 전체 성공 확인
- 시간 초과와 포기 뒤 성공 예약 콜백이 결과를 덮어쓰지 않음을 확인

## 남은 위험

- 경로 탐색은 정적 충돌 셀을 사용하며 동적 NPC 간 충돌 회피는 범위 밖이다.
- 빠른 QA 모드는 테스트 빌드에서만 활성화되고 실제 게임은 원래 2.6초 단계 간격을 유지한다.
