import assert from "node:assert/strict";
import test from "node:test";
import type OpenAI from "openai";
import type { AppConfig } from "../src/config.js";
import { createOpenAINewsWriter } from "../src/services/openai-news.js";
import type { NewsInput } from "../src/schemas/news.js";

const config: AppConfig = {
  host: "127.0.0.1", port: 8080, nodeEnv: "test", openaiApiKey: "test-only-key", openaiModel: "test-model", openaiTimeoutMs: 100,
  backendSharedToken: "test-only-backend-token-32-bytes-minimum", trustProxyHops: false,
  rateLimitMax: 10, rateLimitWindowMs: 60_000, rateLimitBurst: 3, planCacheTtlMs: 60_000, planCacheMax: 100,
};
const input: NewsInput = {
  status: "success", finishReason: "completed", grade: "S", score: 2300, villagePreservation: 94, rescuedResidents: 9,
  resolvedIncidents: ["전기 합선", "빵집 화재", "가스 폭발 위험", "발전소 침수", "하천 범람", "다리 파손", "서쪽 주민 고립", "민가 확산 화재", "옥상 고양이 고립", "동쪽 주민 고립", "광장 폭탄 위협"],
  unresolvedIncidents: [], comboLabels: ["POWER CUT → SPLASH"], maxCombo: 1, remainingSeconds: 24, catRescued: true,
  preventedSpreads: 2, actionCount: 13, intervieweeId: "npc_hana", intervieweeName: "하나", intervieweeRole: "구조 자원봉사자",
  intervieweeTraits: "침착하고 다정하며 주민이 따라 하기 쉬운 안전 행동을 말함", language: "ko",
};

test("게임 기록을 구조화 뉴스 프롬프트에 전달한다", async () => {
  let captured: Record<string, unknown> = {};
  const output = {
    headline: "세 구조 로봇 협동으로 마을 위기 넘겨",
    article: "구조대는 열 건의 사고를 해결하고 주민 아홉 명의 대피를 도왔다. 마을 보존율은 94%로 집계됐다.",
    interviewQuote: "주민들이 안내를 잘 따라줘서 모두 함께 안전한 곳으로 이동할 수 있었어요.",
  };
  const client = { responses: { create: async (request: Record<string, unknown>) => { captured = request; return { output_text: JSON.stringify(output) }; } } } as unknown as OpenAI;
  const result = await createOpenAINewsWriter(config, client).write(input);
  assert.equal(result.source, "openai");
  assert.match(String(captured.instructions), /마을 신문 기자/);
  assert.match(String(captured.input), /구조 자원봉사자/);
  assert.equal((captured.text as { format: { type: string } }).format.type, "json_schema");
  assert.equal(captured.store, false);
});
test("잘못된 AI 뉴스는 실제 기록 기반 기사로 폴백한다", async () => {
  const client = { responses: { create: async () => ({ output_text: JSON.stringify({ headline: "짧음" }) }) } } as unknown as OpenAI;
  const result = await createOpenAINewsWriter(config, client).write(input);
  assert.equal(result.source, "fallback");
  assert.equal(result.degradedReason, "INVALID_OPENAI_RESPONSE");
  assert.match(result.article, /주민 9명/);
});
