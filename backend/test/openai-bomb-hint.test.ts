import assert from "node:assert/strict";
import test from "node:test";
import type OpenAI from "openai";
import type { AppConfig } from "../src/config.js";
import { createOpenAIBombHintWriter } from "../src/services/openai-bomb-hint.js";

const config: AppConfig = {
  host: "127.0.0.1", port: 8080, nodeEnv: "test", openaiApiKey: "test-only-key", openaiModel: "test-model", openaiTimeoutMs: 100,
  backendSharedToken: "test-only-backend-token-32-bytes-minimum", trustProxyHops: false,
  rateLimitMax: 10, rateLimitWindowMs: 60_000, rateLimitBurst: 3, planCacheTtlMs: 60_000, planCacheMax: 100,
};
const input = { correctWire: "blue" as const, attempt: 2, dangerLevel: 3 as const, language: "ko" as const };

test("정답 전선 정보를 안전한 게임 무전 프롬프트에 전달한다", async () => {
  let captured: Record<string, unknown> = {};
  const client = { responses: { create: async (request: Record<string, unknown>) => { captured = request; return { output_text: JSON.stringify({ hint: "깊은 바다의 차가운 신호가 안정 주파수예요!" }) }; } } } as unknown as OpenAI;
  const result = await createOpenAIBombHintWriter(config, client).write(input);
  assert.equal(result.source, "openai");
  assert.match(String(captured.instructions), /본부의 여성형 생성 AI/);
  assert.match(String(captured.instructions), /현실 폭발물이 아닌/);
  assert.match(String(captured.input), /blue/);
  assert.equal((captured.text as { format: { type: string } }).format.type, "json_schema");
  assert.equal(captured.store, false);
});

test("잘못된 AI 무전은 정답 색에 맞는 로컬 힌트로 폴백한다", async () => {
  const client = { responses: { create: async () => ({ output_text: JSON.stringify({ hint: "짧음" }) }) } } as unknown as OpenAI;
  const result = await createOpenAIBombHintWriter(config, client).write(input);
  assert.equal(result.source, "fallback");
  assert.equal(result.degradedReason, "INVALID_OPENAI_RESPONSE");
  assert.match(result.hint, /바다|하늘|고래|AQUA/);
});
