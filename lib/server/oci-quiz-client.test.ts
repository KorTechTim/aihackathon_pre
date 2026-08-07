import assert from "node:assert/strict";
import test from "node:test";
import { FALLBACK_SAFETY_QUIZZES } from "../safety-quiz";
import { handleQuizProxyRequest } from "./oci-quiz-client";

const config = { backendUrl: "http://192.0.2.10:8080", backendToken: "test-only-shared-token-32-bytes-minimum", timeoutMs: 50 };
const body = {
  incidentId: "electrical_short",
  incidentLabel: "전기 합선",
  incidentType: "electrical",
  actionId: "cut_power",
  actionLabel: "전력 차단",
  robotId: "fix",
  wave: 1,
  severity: 2,
  quizSequence: 1,
  difficulty: "easy",
  questionFocus: "first_response",
  variationSeed: 7731,
  excludedQuestions: [],
  language: "ko",
} as const;

function request(payload: unknown = body) {
  return new Request("https://pixel-panic.example/api/quiz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}

test("정상 OCI 안전 퀴즈를 검증해 전달한다", async () => {
  const generated = {
    question: "전기 합선 현장에서 가장 먼저 해야 할 일은?",
    options: [{ id: "a", label: "물을 뿌린다" }, { id: "b", label: "전원을 차단한다" }, { id: "c", label: "전선을 만진다" }],
    correctOptionId: "b",
    explanation: "감전을 막기 위해 먼저 전원을 안전하게 차단해야 합니다.",
    source: "openai",
  };
  const response = await handleQuizProxyRequest(request(), { config, createRequestId: () => "quiz-ok", fetchImpl: async () => Response.json(generated) });
  assert.deepEqual(await response.json(), { ...generated, requestId: "quiz-ok" });
});

test("OCI 설정 누락과 잘못된 응답은 상황별 문제로 폴백한다", async () => {
  const missing = await handleQuizProxyRequest(request(), { config: { timeoutMs: 50 }, createRequestId: () => "missing" });
  assert.deepEqual(await missing.json(), { ...FALLBACK_SAFETY_QUIZZES.electrical_short, source: "fallback", degradedReason: "OCI_NOT_CONFIGURED", requestId: "missing" });
  const invalid = await handleQuizProxyRequest(request(), { config, fetchImpl: async () => Response.json({ question: "**위험**", source: "openai" }) });
  assert.equal((await invalid.json()).source, "fallback");
});

test("잘못된 요청은 OCI 호출 전 400으로 거부한다", async () => {
  let calls = 0;
  const response = await handleQuizProxyRequest(request({ ...body, severity: 9 }), { config, fetchImpl: async () => { calls += 1; return Response.json({}); } });
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});

test("OCI가 이전 문제를 다시 보내면 중복을 폐기하고 새 폴백을 반환한다", async () => {
  const previous = FALLBACK_SAFETY_QUIZZES.electrical_short.question;
  const response = await handleQuizProxyRequest(request({ ...body, quizSequence: 2, excludedQuestions: [previous] }), {
    config,
    createRequestId: () => "quiz-duplicate",
    fetchImpl: async () => Response.json({ ...FALLBACK_SAFETY_QUIZZES.electrical_short, source: "openai" }),
  });
  const result = await response.json() as { question: string; source: string; degradedReason: string };
  assert.notEqual(result.question, previous);
  assert.equal(result.source, "fallback");
  assert.equal(result.degradedReason, "OCI_INVALID_RESPONSE");
});
