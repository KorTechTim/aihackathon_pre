import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIONS,
  COMBOS,
  INCIDENTS,
  INCIDENT_IDS,
  advanceGame,
  createInitialGame,
  failCatRescueMinigame,
  getGrade,
  getIncidentProgress,
  resolveActionWithSafetyQuiz,
  resolveCatRescueMinigame,
  startAction,
  type ActionId,
  type IncidentId,
  type RescueGameState,
} from "./rescue-engine";

function skipBriefing(state: RescueGameState): RescueGameState {
  return advanceGame(state, 2_000, 2);
}

function complete(state: RescueGameState, incidentId: IncidentId, actionId: ActionId): RescueGameState {
  const started = startAction(state, incidentId, actionId);
  assert.equal(started.ok, true, started.error ?? "action should start");
  const resolved = resolveActionWithSafetyQuiz(started.state, ACTIONS[actionId].robotId, incidentId, actionId);
  assert.equal(resolved.ok, true, resolved.error ?? "quiz should resolve action");
  return resolved.state;
}

test("초기 상태는 고정 시드와 3분 30초 타이머를 사용한다", () => {
  const first = createInitialGame();
  const second = createInitialGame();
  assert.deepEqual(first, second);
  assert.equal(first.remainingMs, 210_000);
  assert.equal(first.incidents.electrical_short.status, "active");
  assert.equal(first.incidents.bakery_fire.status, "warning");
});

test("사고 핀 좌표는 실제 마을 시설 위치에 고정된다", () => {
  assert.deepEqual(INCIDENTS.electrical_short.mapPosition, [1144, 166]);
  assert.deepEqual(INCIDENTS.bakery_fire.mapPosition, [300, 252]);
  assert.deepEqual(INCIDENTS.gas_risk.mapPosition, [1210, 330]);
  assert.deepEqual(INCIDENTS.cat_trapped.mapPosition, [496, 176]);
  assert.deepEqual(INCIDENTS.power_flood.mapPosition, [1010, 240]);
  assert.deepEqual(INCIDENTS.bridge_damage.mapPosition, [850, 350]);
});

test("동시에 표시되는 사고 카드의 시설 앵커는 서로 겹치지 않는다", () => {
  for (let index = 0; index < INCIDENT_IDS.length; index += 1) {
    for (let other = index + 1; other < INCIDENT_IDS.length; other += 1) {
      const first = INCIDENTS[INCIDENT_IDS[index]].mapPosition;
      const second = INCIDENTS[INCIDENT_IDS[other]].mapPosition;
      const cardsOverlap = Math.abs(first[0] - second[0]) < 74 && Math.abs(first[1] - second[1]) < 61;
      assert.equal(cardsOverlap, false, `${INCIDENT_IDS[index]} and ${INCIDENT_IDS[other]} overlap`);
    }
  }
});

test("선행 전력 차단은 합선 확산과 후속 화재 활성화를 막는다", () => {
  let state = skipBriefing(createInitialGame());
  state = complete(state, "electrical_short", "cut_power");
  state = advanceGame(state, 2_000, 4);
  state = advanceGame(state, 2_000, 4);
  state = advanceGame(state, 2_000, 4);
  assert.equal(state.incidents.electrical_short.status, "resolved");
  assert.equal(state.incidents.electrical_short.spreadCount, 0);
  assert.equal(state.incidents.bakery_fire.status, "warning");
});

test("사고를 방치하면 고정 타이머 뒤 후속 사고가 활성화되고 보존율이 감소한다", () => {
  let state = skipBriefing(createInitialGame());
  for (let index = 0; index < 5; index += 1) state = advanceGame(state, 2_000, 2);
  assert.equal(state.incidents.electrical_short.spreadCount, 1);
  assert.equal(state.incidents.bakery_fire.status, "active");
  assert.equal(state.villagePreservation < 100, true);
});

test("올바른 FIX → AQUA 순서만 전력 차단 화재 콤보로 판정한다", () => {
  let correct = skipBriefing(createInitialGame());
  correct = complete(correct, "electrical_short", "cut_power");
  correct = complete(correct, "bakery_fire", "evacuate");
  correct = complete(correct, "gas_risk", "shut_gas");
  correct = complete(correct, "bakery_fire", "extinguish");
  assert.equal(correct.foundCombos.includes("power_cut_fire"), true);
  assert.equal(correct.foundCombos.includes("evacuate_gas_fire"), true);

  let wrong = skipBriefing(createInitialGame());
  wrong = complete(wrong, "bakery_fire", "extinguish");
  wrong = complete(wrong, "electrical_short", "cut_power");
  assert.equal(wrong.foundCombos.includes("power_cut_fire"), false);
});

test("정의된 콤보는 정확히 5개이며 중복 획득되지 않는다", () => {
  assert.equal(COMBOS.length, 5);
  assert.equal(new Set(COMBOS.map((combo) => combo.id)).size, 5);
});

test("선택 사고의 해결 진행률은 로봇 작업 상태에서 결정론적으로 계산된다", () => {
  let state = skipBriefing(createInitialGame());
  assert.equal(getIncidentProgress(state, "electrical_short"), 0);
  state = startAction(state, "electrical_short", "cut_power").state;
  state = advanceGame(state, 2_000);
  assert.equal(getIncidentProgress(state, "electrical_short"), 33);
  state = advanceGame(state, 2_000);
  state = advanceGame(state, 2_000);
  assert.equal(getIncidentProgress(state, "electrical_short"), 100);
  assert.equal(state.incidents.electrical_short.status, "active", "정답 전에는 자동 해결되지 않는다");
  state = resolveActionWithSafetyQuiz(state, "fix", "electrical_short", "cut_power").state;
  assert.equal(state.incidents.electrical_short.status, "resolved");
});

test("등급은 보존율·구조·콤보 조건으로 결정된다", () => {
  const state = createInitialGame();
  assert.equal(getGrade({ ...state, villagePreservation: 94, rescuedResidents: 9, foundCombos: ["power_cut_fire", "parts_repair", "clear_firebreak"] }), "S");
  assert.equal(getGrade({ ...state, villagePreservation: 80 }), "A");
  assert.equal(getGrade({ ...state, villagePreservation: 60 }), "B");
  assert.equal(getGrade({ ...state, villagePreservation: 20 }), "C");
  assert.equal(getGrade({ ...state, villagePreservation: 0 }), "C");
  assert.equal(INCIDENT_IDS.length >= 8, true);
});

test("고양이 미니게임 성공은 사고를 해결하고 실패는 재도전을 허용한다", () => {
  const ready = skipBriefing(createInitialGame());
  ready.wave = 3;
  ready.incidents.cat_trapped.status = "active";

  const successfulStart = startAction(ready, "cat_trapped", "rescue_cat");
  assert.equal(successfulStart.ok, true);
  const success = resolveCatRescueMinigame(successfulStart.state);
  assert.equal(success.ok, true);
  assert.equal(success.state.catRescued, true);
  assert.equal(success.state.incidents.cat_trapped.status, "resolved");
  assert.equal(success.state.robots.buddy.status, "idle");

  const failedStart = startAction(ready, "cat_trapped", "rescue_cat");
  assert.equal(failedStart.ok, true);
  const failure = failCatRescueMinigame(failedStart.state);
  assert.equal(failure.ok, true);
  assert.equal(failure.state.catRescued, false);
  assert.equal(failure.state.incidents.cat_trapped.status, "active");
  assert.equal(failure.state.incidents.cat_trapped.completedActions.includes("rescue_cat"), false);
  assert.equal(failure.state.robots.buddy.status, "idle");
  assert.equal(startAction(failure.state, "cat_trapped", "rescue_cat").ok, true);
});
