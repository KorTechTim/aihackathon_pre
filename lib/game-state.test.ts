import assert from "node:assert/strict";
import test from "node:test";
import {
  INCIDENT_IDS,
  calculateGameStats,
  canComplete,
  deriveWorldSnapshot,
  isOperationCallbackAllowed,
  normalizePriority,
} from "./game-state";

function permutations<T>(values: readonly T[]): T[][] {
  if (values.length === 0) return [[]];
  return values.flatMap((value, index) => permutations([...values.slice(0, index), ...values.slice(index + 1)]).map((rest) => [value, ...rest]));
}

test("대표 priority 순서를 그대로 보존한다", () => {
  const priorities = [
    ["fire", "bridge", "cat", "generator"],
    ["cat", "fire", "bridge", "generator"],
    ["fire", "generator", "bridge", "cat"],
    ["generator", "cat", "bridge", "fire"],
  ];
  for (const priority of priorities) assert.deepEqual(normalizePriority(priority), priority);
});

test("중복·누락·알 수 없는 ID를 제거하고 네 사건을 복원한다", () => {
  assert.deepEqual(normalizePriority(["cat", "cat", "unknown", "fire"]), ["cat", "fire", "bridge", "generator"]);
  assert.deepEqual(normalizePriority(null), [...INCIDENT_IDS]);
});

test("24개 모든 순열에서 사건이 정확히 한 번씩 완료된다", () => {
  const all = permutations(INCIDENT_IDS);
  assert.equal(all.length, 24);
  for (const priority of all) {
    const completed: string[] = [];
    for (const incident of normalizePriority(priority)) completed.push(incident);
    assert.equal(new Set(completed).size, 4);
    assert.deepEqual(new Set(completed), new Set(INCIDENT_IDS));
    assert.equal(canComplete(completed as typeof INCIDENT_IDS[number][]), true);
  }
});

test("월드 스냅샷은 완료 목록만 사용하며 이전 사건을 되돌리지 않는다", () => {
  assert.deepEqual(deriveWorldSnapshot(["cat"]), {
    fireResolved: false,
    bridgeResolved: false,
    catResolved: true,
    generatorResolved: false,
    resolvedCount: 1,
  });
  assert.equal(deriveWorldSnapshot(["cat", "fire"]).catResolved, true);
});

test("종료되거나 run id가 바뀐 예약 콜백은 거부한다", () => {
  assert.equal(isOperationCallbackAllowed(4, 4, false), true);
  assert.equal(isOperationCallbackAllowed(4, 5, false), false);
  assert.equal(isOperationCallbackAllowed(4, 4, true), false);
});

test("실제 상태로 보존율과 등급을 계산한다", () => {
  const success = calculateGameStats({ secondsRemaining: 60, commandsUsed: 1, completedIncidents: INCIDENT_IDS, usedFallback: false, finishReason: "completed" });
  assert.equal(success.villagePreservation, 100);
  assert.equal(success.grade, "S");
  assert.equal(success.rescuedCount, 5);

  const timeout = calculateGameStats({ secondsRemaining: 0, commandsUsed: 4, completedIncidents: ["fire", "bridge", "cat"], usedFallback: true, finishReason: "timeout" });
  assert.equal(timeout.villagePreservation, 49);
  assert.equal(timeout.grade, "B");
});
