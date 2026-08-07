import assert from "node:assert/strict";
import test from "node:test";
import type { AppConfig } from "../src/config.js";
import { buildServer } from "../src/server.js";
import type { NewsWriter } from "../src/services/openai-news.js";
import type { NewsInput } from "../src/schemas/news.js";

const token = "test-only-backend-token-32-bytes-minimum";
const config: AppConfig = {
  host: "127.0.0.1", port: 8080, nodeEnv: "test", openaiApiKey: undefined, openaiModel: "test-model", openaiTimeoutMs: 100,
  backendSharedToken: token, trustProxyHops: false,
  rateLimitMax: 10, rateLimitWindowMs: 60_000, rateLimitBurst: 3, planCacheTtlMs: 60_000, planCacheMax: 100,
};
const payload: NewsInput = {
  edition: "final", completedWave: null,
  status: "success", finishReason: "completed", grade: "S", score: 2300, villagePreservation: 94, rescuedResidents: 9,
  resolvedIncidents: ["전기 합선", "빵집 화재", "가스 폭발 위험", "발전소 침수", "하천 범람", "다리 파손", "서쪽 주민 고립", "민가 확산 화재", "옥상 고양이 고립", "동쪽 주민 고립", "광장 폭탄 위협"],
  unresolvedIncidents: [], comboLabels: ["POWER CUT → SPLASH"], maxCombo: 1, remainingSeconds: 24, catRescued: true,
  preventedSpreads: 2, actionCount: 13, intervieweeId: "npc_hana", intervieweeName: "하나", intervieweeRole: "구조 자원봉사자",
  intervieweeTraits: "침착하고 다정하며 주민이 따라 하기 쉬운 안전 행동을 말함", language: "ko",
};
const generated = {
  headline: "세 구조 로봇 협동으로 마을 위기 넘겨",
  article: "구조대는 열 건의 사고를 해결하고 주민 아홉 명의 대피를 도왔다. 마을 보존율은 94%로 집계됐다.",
  interviewQuote: "주민들이 안내를 잘 따라줘서 모두 함께 안전한 곳으로 이동할 수 있었어요.",
  source: "openai" as const,
};
const stagePayload: NewsInput = {
  ...payload,
  edition: "stage",
  completedWave: 1,
  resolvedIncidents: payload.resolvedIncidents.slice(0, 3),
  unresolvedIncidents: payload.resolvedIncidents.slice(3),
  intervieweeId: "npc_boram",
  intervieweeName: "보람",
  intervieweeRole: "빵집 이웃 주민",
  intervieweeTraits: "씩씩하고 이웃을 먼저 걱정하며 짧고 힘 있게 말함",
};

async function withServer(writer: NewsWriter, run: (app: Awaited<ReturnType<typeof buildServer>>) => Promise<void>) {
  const app = await buildServer({ config, newsWriter: writer, logger: false });
  try { await run(app); } finally { await app.close(); }
}

test("인증된 /api/news 요청은 AI 뉴스와 주민 인터뷰를 반환한다", async () => {
  await withServer({ write: async () => generated }, async (app) => {
    const response = await app.inject({ method: "POST", url: "/api/news", headers: { authorization: `Bearer ${token}` }, payload });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().source, "openai");
    assert.equal(response.json().headline, generated.headline);
    const stageResponse = await app.inject({ method: "POST", url: "/api/news", headers: { authorization: `Bearer ${token}` }, payload: stagePayload });
    assert.equal(stageResponse.statusCode, 200);
  });
});

test("뉴스 API는 인증, 인터뷰 대상과 사고 기록을 검증한다", async () => {
  let calls = 0;
  await withServer({ write: async () => { calls += 1; return generated; } }, async (app) => {
    const unauthorized = await app.inject({ method: "POST", url: "/api/news", payload });
    assert.equal(unauthorized.statusCode, 401);
    const invalidNpc = await app.inject({ method: "POST", url: "/api/news", headers: { authorization: `Bearer ${token}` }, payload: { ...payload, intervieweeName: "다른 주민" } });
    assert.equal(invalidNpc.statusCode, 400);
    const invalidIncidents = await app.inject({ method: "POST", url: "/api/news", headers: { authorization: `Bearer ${token}` }, payload: { ...payload, resolvedIncidents: payload.resolvedIncidents.slice(1) } });
    assert.equal(invalidIncidents.statusCode, 400);
    const invalidEdition = await app.inject({ method: "POST", url: "/api/news", headers: { authorization: `Bearer ${token}` }, payload: { ...payload, edition: "stage", completedWave: null } });
    assert.equal(invalidEdition.statusCode, 400);
    assert.equal(calls, 0);
  });
});
