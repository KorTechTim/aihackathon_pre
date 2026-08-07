import assert from "node:assert/strict";
import test from "node:test";
import type OpenAI from "openai";
import type { AppConfig } from "../src/config.js";
import { createOpenAIQuizWriter } from "../src/services/openai-quiz.js";

const config: AppConfig = {
  host: "127.0.0.1", port: 8080, nodeEnv: "test", openaiApiKey: "test-only-key", openaiModel: "test-model", openaiTimeoutMs: 100,
  backendSharedToken: "test-only-backend-token-32-bytes-minimum", trustProxyHops: false,
  rateLimitMax: 10, rateLimitWindowMs: 60_000, rateLimitBurst: 3, planCacheTtlMs: 60_000, planCacheMax: 100,
};
const input = {
  incidentId: "electrical_short", incidentLabel: "전기 합선", incidentType: "electrical",
  actionId: "cut_power", actionLabel: "전력 차단", robotId: "fix", wave: 1, severity: 2,
  quizSequence: 8, difficulty: "hard", questionFocus: "priority", variationSeed: 7731,
  excludedQuestions: ["물이 찬 전기실에서 가장 먼저 해야 할 행동은 무엇일까요?"], language: "ko",
} as const;

test("상황과 선택 행동을 구조화 출력 프롬프트에 전달한다", async () => {
  let captured: Record<string, unknown> = {};
  const output = {
    question: "합선된 전선 주변에서 가장 먼저 해야 할 일은 무엇일까요?",
    options: [{ id: "a", label: "물을 뿌린다" }, { id: "b", label: "접근을 막고 전원을 차단한다" }, { id: "c", label: "전선을 만진다" }],
    correctOptionId: "b", explanation: "감전 위험이 있으므로 먼저 접근을 막고 전원을 차단해야 합니다.",
  };
  const client = { responses: { create: async (request: Record<string, unknown>) => { captured = request; return { output_text: JSON.stringify(output) }; } } } as unknown as OpenAI;
  const result = await createOpenAIQuizWriter(config, client).write(input);
  assert.equal(result.source, "openai");
  assert.equal(result.correctOptionId, "b");
  assert.match(String(captured.instructions), /안전 상식 퀴즈/);
  assert.match(String(captured.instructions), /고급/);
  assert.match(String(captured.instructions), /절대 다시 내지 마세요/);
  assert.match(String(captured.instructions), /동시에 두 위험/);
  assert.match(String(captured.input), /electrical_short/);
  assert.match(String(captured.input), /excludedQuestions/);
  assert.equal(captured.store, false);
  assert.equal((captured.text as { format: { type: string } }).format.type, "json_schema");
});

test("AI가 이전 질문을 반복하면 응답을 채택하지 않는다", async () => {
  const repeated = {
    question: input.excludedQuestions[0],
    options: [{ id: "a", label: "전원을 차단한다" }, { id: "b", label: "물을 만진다" }, { id: "c", label: "맨손으로 확인한다" }],
    correctOptionId: "a", explanation: "감전 위험이 있으므로 전원을 먼저 차단해야 합니다.",
  };
  let calls = 0;
  const client = { responses: { create: async () => { calls += 1; return { output_text: JSON.stringify(repeated) }; } } } as unknown as OpenAI;
  const result = await createOpenAIQuizWriter(config, client).write(input);
  assert.equal(calls, 2);
  assert.equal(result.source, "fallback");
  assert.equal(result.degradedReason, "INVALID_OPENAI_RESPONSE");
});

test("첫 질문이 중복이면 두 번째 생성에서 완전히 새로운 문제를 채택한다", async () => {
  const repeated = {
    question: input.excludedQuestions[0],
    options: [{ id: "a", label: "전원을 차단한다" }, { id: "b", label: "물을 만진다" }, { id: "c", label: "맨손으로 확인한다" }],
    correctOptionId: "a", explanation: "감전 위험이 있으므로 전원을 먼저 차단해야 합니다.",
  };
  const fresh = {
    question: "합선 진압 중 연기와 군중이 동시에 늘면 무엇을 우선해야 할까요?",
    options: [{ id: "a", label: "작업을 계속한다" }, { id: "b", label: "안전거리 확보와 주민 통제를 먼저 한다" }, { id: "c", label: "주민에게 전선을 확인시킨다" }],
    correctOptionId: "b", explanation: "새 위험이 동시에 나타나면 주민 통제와 안전거리 확보 후 상황을 다시 평가해야 합니다.",
  };
  let calls = 0;
  const client = { responses: { create: async () => ({ output_text: JSON.stringify(calls++ === 0 ? repeated : fresh) }) } } as unknown as OpenAI;
  const result = await createOpenAIQuizWriter(config, client).write(input);
  assert.equal(calls, 2);
  assert.equal(result.source, "openai");
  assert.equal(result.question, fresh.question);
});

test("AI 응답이 잘못되면 상황별 로컬 퀴즈로 폴백한다", async () => {
  const client = { responses: { create: async () => ({ output_text: JSON.stringify({ question: "짧음" }) }) } } as unknown as OpenAI;
  const result = await createOpenAIQuizWriter(config, client).write(input);
  assert.equal(result.source, "fallback");
  assert.equal(result.degradedReason, "INVALID_OPENAI_RESPONSE");
  assert.equal(result.correctOptionId, "b");
});
