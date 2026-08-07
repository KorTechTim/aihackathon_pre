import assert from "node:assert/strict";
import test from "node:test";
import { BOMB_WIRES, buildBombHintRequest, fallbackBombHint, normalizeBombHint, pickBombWire } from "./bomb-defusal";

test("폭탄 전선 정답은 시드와 시도 횟수로 결정된다", () => {
  assert.equal(pickBombWire(20260807, 1), pickBombWire(20260807, 1));
  assert.equal(BOMB_WIRES.includes(pickBombWire(20260807, 2)), true);
  assert.notEqual(pickBombWire(20260807, 1), pickBombWire(20260807, 2));
});

test("로컬 무전 힌트는 정답 색을 재미있는 비유로 구분한다", () => {
  assert.match(fallbackBombHint("red", 1).hint, /소방차|뜨거운|노을|토마토/);
  assert.match(fallbackBombHint("blue", 1).hint, /AQUA|물빛|하늘|고래/);
  assert.equal(fallbackBombHint("red", 1, "OCI_TIMEOUT").degradedReason, "OCI_TIMEOUT");
});

test("생성형 힌트와 요청 범위를 검증한다", () => {
  assert.deepEqual(normalizeBombHint({ hint: "  바다를 닮은 차가운 신호가 안정 주파수예요!  " }), { hint: "바다를 닮은 차가운 신호가 안정 주파수예요!" });
  assert.equal(normalizeBombHint({ hint: "**파랑**" }), null);
  assert.deepEqual(buildBombHintRequest("blue", 120, 9), { correctWire: "blue", attempt: 99, dangerLevel: 3, language: "ko" });
});
