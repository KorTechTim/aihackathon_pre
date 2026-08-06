import assert from "node:assert/strict";
import test from "node:test";
import type OpenAI from "openai";
import type { AppConfig } from "../src/config.js";
import { createOpenAIDialogueWriter } from "../src/services/openai-dialogue.js";

const config: AppConfig = {
  host: "127.0.0.1", port: 8080, nodeEnv: "test", openaiApiKey: "test-only-key", openaiModel: "test-model", openaiTimeoutMs: 100,
  backendSharedToken: "test-only-backend-token-32-bytes-minimum", trustProxyHops: false,
  rateLimitMax: 10, rateLimitWindowMs: 60_000, rateLimitBurst: 3, planCacheTtlMs: 60_000, planCacheMax: 100,
};

test("NPC 요청은 캐릭터 특성과 현재 게임 사실을 생성형 AI 프롬프트에 전달한다", async () => {
  let captured: Record<string, unknown> = {};
  const client = { responses: { create: async (input: Record<string, unknown>) => {
    captured = input;
    return { output_text: JSON.stringify({ dialogue: "강물 흐름이 빨라졌지만 북쪽 길은 아직 안전해요!" }) };
  } } } as unknown as OpenAI;
  const writer = createOpenAIDialogueWriter(config, client);
  const result = await writer.write({
    speaker: "주민",
    personality: "observant_keeper_optimistic",
    situation: "npc_duri",
    facts: { npcName: "두리", npcRole: "공원 관리인", characterTraits: "지형 변화를 빠르게 발견함", wave: 2, villagePreservation: 82 },
    choiceIds: [],
    language: "ko",
  });

  assert.equal(result.source, "openai");
  assert.match(String(captured.instructions), /주민 캐릭터 대사 작가/);
  assert.match(String(captured.input), /characterTraits/);
  assert.match(String(captured.input), /공원 관리인/);
  assert.equal(captured.store, false);
});

test("NPC AI 응답이 잘못되면 해당 캐릭터의 로컬 대사로 폴백한다", async () => {
  const client = { responses: { create: async () => ({ output_text: "not-json" }) } } as unknown as OpenAI;
  const writer = createOpenAIDialogueWriter(config, client);
  const result = await writer.write({ speaker: "주민", personality: "warm", situation: "npc_boram", facts: {}, choiceIds: [], language: "ko" });
  assert.equal(result.source, "fallback");
  assert.equal(result.degradedReason, "INVALID_OPENAI_RESPONSE");
  assert.match(result.dialogue, /이웃/);
});
