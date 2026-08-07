import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSafetyQuizRequest,
  fallbackSafetyQuiz,
  FALLBACK_SAFETY_QUIZZES,
  SAFETY_QUIZ_FOCUSES,
  getSafetyQuizDifficulty,
  getSafetyQuizFocus,
  isSafetyQuizQuestionExcluded,
  normalizeSafetyQuiz,
} from "./safety-quiz";
import { createInitialGame, INCIDENTS, INCIDENT_IDS } from "./rescue-engine";

test("모든 긴급 상황은 정답 하나를 가진 로컬 안전 퀴즈를 제공한다", () => {
  assert.equal(Object.keys(FALLBACK_SAFETY_QUIZZES).length, INCIDENT_IDS.length);
  Object.values(FALLBACK_SAFETY_QUIZZES).forEach((quiz) => {
    assert.deepEqual(quiz.options.map((option) => option.id), ["a", "b", "c"]);
    assert.equal(quiz.options.some((option) => option.id === quiz.correctOptionId), true);
    assert.ok(quiz.explanation.length >= 10);
  });
});

test("퀴즈 요청에는 진행 순서와 이전 질문에 따른 난이도를 함께 담는다", () => {
  const previous = "이미 출제된 충분히 긴 안전 확인 질문입니다.";
  const request = buildSafetyQuizRequest(createInitialGame(), "electrical_short", "cut_power", { quizSequence: 4, variationSeed: 123, excludedQuestions: [previous] });
  assert.deepEqual(request, {
    incidentId: "electrical_short", incidentLabel: "전기 합선", incidentType: "electrical",
    actionId: "cut_power", actionLabel: "전력 차단", robotId: "fix", wave: 1, severity: 2,
    quizSequence: 4, difficulty: "medium", questionFocus: "safe_sequence", variationSeed: 123, excludedQuestions: [previous], language: "ko",
  });
});

test("문제 순서와 웨이브가 오를수록 난이도가 낮아지지 않는다", () => {
  assert.equal(getSafetyQuizDifficulty(1, 1), "easy");
  assert.equal(getSafetyQuizDifficulty(1, 4), "medium");
  assert.equal(getSafetyQuizDifficulty(1, 8), "hard");
  assert.equal(getSafetyQuizDifficulty(2, 1), "medium");
  assert.equal(getSafetyQuizDifficulty(3, 1), "hard");
});

test("연속 퀴즈는 여덟 가지 출제 관점을 중복 없이 순환한다", () => {
  const focuses = Array.from({ length: SAFETY_QUIZ_FOCUSES.length }, (_, index) => getSafetyQuizFocus(index + 1));
  assert.deepEqual(focuses, SAFETY_QUIZ_FOCUSES);
  assert.equal(getSafetyQuizFocus(SAFETY_QUIZ_FOCUSES.length + 1), "first_response");
});

test("공백과 문장 부호만 다른 중복 질문을 거부하고 다른 폴백을 고른다", () => {
  const first = fallbackSafetyQuiz("electrical_short", { actionId: "cut_power", quizSequence: 1 });
  assert.equal(isSafetyQuizQuestionExcluded(` ${first.question.replace(/\?/g, " ? ")} `, [first.question]), true);
  const second = fallbackSafetyQuiz("electrical_short", { actionId: "cut_power", quizSequence: 2, excludedQuestions: [first.question] });
  assert.notEqual(second.question, first.question);
});

test("일부 표현만 바꾼 유사 질문도 재출제로 판단한다", () => {
  const previous = "합선된 전선 주변에서 가장 먼저 해야 할 안전 행동은 무엇일까요?";
  const paraphrased = "합선된 전선 주변에서 현재 가장 먼저 해야 할 안전 행동은 무엇인가요?";
  assert.equal(isSafetyQuizQuestionExcluded(paraphrased, [previous]), true);
});

test("한 작전에서 가능한 모든 행동의 로컬 문제도 전부 서로 다르다", () => {
  const history: string[] = [];
  INCIDENT_IDS.forEach((incidentId) => {
    INCIDENTS[incidentId].allowedActions.forEach((actionId) => {
      const next = fallbackSafetyQuiz(incidentId, { actionId, excludedQuestions: history, quizSequence: history.length + 1 });
      assert.equal(isSafetyQuizQuestionExcluded(next.question, history), false, `${incidentId}/${actionId}`);
      history.push(next.question);
    });
  });
  const actionCount = INCIDENT_IDS.reduce((sum, incidentId) => sum + INCIDENTS[incidentId].allowedActions.length, 0);
  assert.equal(history.length, actionCount);
  assert.equal(new Set(history).size, actionCount);
});

test("중복 보기 ID와 마크다운이 포함된 AI 응답은 거부한다", () => {
  const base = FALLBACK_SAFETY_QUIZZES.electrical_short;
  assert.equal(normalizeSafetyQuiz({ ...base, question: "**위험한 문제**" }), null);
  assert.equal(normalizeSafetyQuiz({ ...base, options: [{ id: "a", label: "보기 1" }, { id: "a", label: "보기 2" }, { id: "c", label: "보기 3" }] }), null);
  assert.deepEqual(normalizeSafetyQuiz(base), base);
});
