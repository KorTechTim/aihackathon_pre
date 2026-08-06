import assert from "node:assert/strict";
import test from "node:test";
import { buildServer } from "../src/server.js";
import type { AppConfig } from "../src/config.js";
import type { DialogueWriter } from "../src/services/openai-dialogue.js";

const token = "test-only-backend-token-32-bytes-minimum";
const config: AppConfig = {
  host: "127.0.0.1", port: 8080, nodeEnv: "test", openaiApiKey: undefined, openaiModel: "gpt-5.6-luna", openaiTimeoutMs: 100,
  backendSharedToken: token, trustProxyHops: false,
  rateLimitMax: 10, rateLimitWindowMs: 60_000, rateLimitBurst: 3, planCacheTtlMs: 60_000, planCacheMax: 100,
};
const payload = {
  speaker: "AQUA",
  personality: "calm_and_helpful",
  situation: "hydrant_broken",
  facts: { spreadSeconds: 12 },
  choiceIds: ["use_reserve_water", "protect_nearby_house"],
  language: "ko",
};
const npcPayload = {
  speaker: "주민",
  personality: "observant_keeper_optimistic",
  situation: "npc_duri",
  facts: { npcName: "두리", npcRole: "공원 관리인", characterTraits: "지형 변화를 빠르게 발견함", wave: 2 },
  choiceIds: [],
  language: "ko",
};

async function withServer(writer: DialogueWriter, run: (app: Awaited<ReturnType<typeof buildServer>>) => Promise<void>) {
  const app = await buildServer({ config, dialogueWriter: writer, logger: false });
  try { await run(app); } finally { await app.close(); }
}

test("인증된 /api/dialogue 요청은 검증된 대사만 반환한다", async () => {
  await withServer({ write: async () => ({ dialogue: "수압은 낮지만 주변부터 안전하게 보호할게요.", source: "openai" }) }, async (app) => {
    const response = await app.inject({ method: "POST", url: "/api/dialogue", headers: { authorization: `Bearer ${token}` }, payload });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().dialogue, "수압은 낮지만 주변부터 안전하게 보호할게요.");
    assert.equal(response.json().source, "openai");
  });
});

test("NPC 대화는 선택지 없이 생성형 AI 서비스에 전달된다", async () => {
  let receivedSituation = "";
  await withServer({ write: async (request) => {
    receivedSituation = request.situation;
    return { dialogue: "강물은 아직 빠르지만 북쪽 산책로는 안전해 보여요!", source: "openai" };
  } }, async (app) => {
    const response = await app.inject({ method: "POST", url: "/api/dialogue", headers: { authorization: `Bearer ${token}` }, payload: npcPayload });
    assert.equal(response.statusCode, 200);
    assert.equal(receivedSituation, "npc_duri");
    assert.equal(response.json().source, "openai");
  });
});

test("대화 API도 인증과 본문 schema를 먼저 검증한다", async () => {
  let calls = 0;
  await withServer({ write: async () => { calls += 1; return { dialogue: "fallback", source: "fallback" }; } }, async (app) => {
    const unauthorized = await app.inject({ method: "POST", url: "/api/dialogue", payload });
    assert.equal(unauthorized.statusCode, 401);
    const invalid = await app.inject({ method: "POST", url: "/api/dialogue", headers: { authorization: `Bearer ${token}` }, payload: { ...payload, choiceIds: [] } });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.json().code, "INVALID_DIALOGUE_REQUEST");
    assert.equal(calls, 0);
  });
});
