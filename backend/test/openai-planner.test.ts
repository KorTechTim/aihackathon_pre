import assert from "node:assert/strict";
import test from "node:test";
import type OpenAI from "openai";
import type { AppConfig } from "../src/config.js";
import { createOpenAIPlanner } from "../src/services/openai-planner.js";

const config: AppConfig = {
  host: "127.0.0.1", port: 8080, nodeEnv: "test", openaiApiKey: "test-only-key", openaiModel: "test-model", openaiTimeoutMs: 100,
  backendSharedToken: "test-only-backend-token-32-bytes-minimum", trustProxyHops: false, rateLimitMax: 10, rateLimitWindowMs: 60_000, rateLimitBurst: 3,
  planCacheTtlMs: 60_000, planCacheMax: 100,
};

function clientReturning(outputText: string): OpenAI {
  return { responses: { create: async () => ({ output_text: outputText }) } } as unknown as OpenAI;
}

test("structured output 성공 결과를 서버 규칙으로 정규화한다", async () => {
  const planner = createOpenAIPlanner(config, clientReturning(JSON.stringify({
    summary: "구조 우선", priority: ["cat", "cat", "fire"],
    assignments: [
      { robot: "aqua", incidents: ["cat"], reason: "소방" },
      { robot: "fix", incidents: ["fire"], reason: "수리" },
      { robot: "buddy", incidents: ["bridge"], reason: "구조" },
    ],
  })));
  const result = await planner.plan("고양이 먼저");
  assert.equal(result.source, "openai");
  assert.deepEqual(result.plan.priority, ["cat", "fire", "bridge", "generator"]);
  assert.deepEqual(result.plan.assignments.map((item) => item.incidents), [["fire"], ["bridge", "generator"], ["cat"]]);
});

test("timeout/OpenAI 오류와 잘못된 JSON은 fallback으로 끝난다", async () => {
  const throwing = { responses: { create: async () => { throw new Error("timeout"); } } } as unknown as OpenAI;
  assert.equal((await createOpenAIPlanner(config, throwing).plan("명령")).source, "fallback");
  const malformed = await createOpenAIPlanner(config, clientReturning("not-json")).plan("명령");
  assert.equal(malformed.source, "fallback");
  assert.equal(malformed.degradedReason, "INVALID_OPENAI_RESPONSE");
});

test("키가 없으면 OpenAI를 호출하지 않고 fallback한다", async () => {
  const result = await createOpenAIPlanner({ ...config, openaiApiKey: undefined }).plan("명령");
  assert.equal(result.source, "fallback");
  assert.equal(result.degradedReason, "OPENAI_NOT_CONFIGURED");
});
