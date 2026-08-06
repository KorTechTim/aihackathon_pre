import assert from "node:assert/strict";
import test from "node:test";
import { buildSafetyQuizRequest, FALLBACK_SAFETY_QUIZZES, normalizeSafetyQuiz } from "./safety-quiz";
import { createInitialGame } from "./rescue-engine";

test("모든 긴급 상황은 정답 하나를 가진 로컬 안전 퀴즈를 제공한다", () => {
  assert.equal(Object.keys(FALLBACK_SAFETY_QUIZZES).length, 10);
  Object.values(FALLBACK_SAFETY_QUIZZES).forEach((quiz) => {
    assert.deepEqual(quiz.options.map((option) => option.id), ["a", "b", "c"]);
    assert.equal(quiz.options.some((option) => option.id === quiz.correctOptionId), true);
    assert.ok(quiz.explanation.length >= 10);
  });
});

test("퀴즈 요청에는 현재 장애와 선택 행동 정보만 담는다", () => {
  const request = buildSafetyQuizRequest(createInitialGame(), "electrical_short", "cut_power");
  assert.deepEqual(request, {
    incidentId: "electrical_short", incidentLabel: "전기 합선", incidentType: "electrical",
    actionId: "cut_power", actionLabel: "전력 차단", robotId: "fix", wave: 1, severity: 2, language: "ko",
  });
});

test("중복 보기 ID와 마크다운이 포함된 AI 응답은 거부한다", () => {
  const base = FALLBACK_SAFETY_QUIZZES.electrical_short;
  assert.equal(normalizeSafetyQuiz({ ...base, question: "**위험한 문제**" }), null);
  assert.equal(normalizeSafetyQuiz({ ...base, options: [{ id: "a", label: "보기 1" }, { id: "a", label: "보기 2" }, { id: "c", label: "보기 3" }] }), null);
  assert.deepEqual(normalizeSafetyQuiz(base), base);
});
