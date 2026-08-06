import assert from "node:assert/strict";
import test from "node:test";
import type { AppConfig } from "../src/config.js";
import { buildServer } from "../src/server.js";
import type { QuizWriter } from "../src/services/openai-quiz.js";

const token = "test-only-backend-token-32-bytes-minimum";
const config: AppConfig = {
  host: "127.0.0.1", port: 8080, nodeEnv: "test", openaiApiKey: undefined, openaiModel: "test-model", openaiTimeoutMs: 100,
  backendSharedToken: token, trustProxyHops: false,
  rateLimitMax: 10, rateLimitWindowMs: 60_000, rateLimitBurst: 3, planCacheTtlMs: 60_000, planCacheMax: 100,
};
const payload = {
  incidentId: "electrical_short", incidentLabel: "전기 합선", incidentType: "electrical",
  actionId: "cut_power", actionLabel: "전력 차단", robotId: "fix", wave: 1, severity: 2, language: "ko",
};
const generated = {
  question: "합선된 전선 주변에서 가장 먼저 해야 할 일은 무엇일까요?",
  options: [{ id: "a", label: "물을 뿌린다" }, { id: "b", label: "접근을 막고 전원을 차단한다" }, { id: "c", label: "전선을 만진다" }] as [{ id: "a"; label: string }, { id: "b"; label: string }, { id: "c"; label: string }],
  correctOptionId: "b" as const,
  explanation: "감전 위험이 있으므로 먼저 접근을 막고 전원을 차단해야 합니다.",
  source: "openai" as const,
};

async function withServer(writer: QuizWriter, run: (app: Awaited<ReturnType<typeof buildServer>>) => Promise<void>) {
  const app = await buildServer({ config, quizWriter: writer, logger: false });
  try { await run(app); } finally { await app.close(); }
}

test("인증된 /api/quiz 요청은 검증된 안전 문제를 반환한다", async () => {
  let incident = "";
  await withServer({ write: async (input) => { incident = input.incidentId; return generated; } }, async (app) => {
    const response = await app.inject({ method: "POST", url: "/api/quiz", headers: { authorization: `Bearer ${token}` }, payload });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().source, "openai");
    assert.equal(response.json().correctOptionId, "b");
    assert.equal(incident, "electrical_short");
  });
});

test("퀴즈 API는 인증과 본문 schema를 먼저 검증한다", async () => {
  let calls = 0;
  await withServer({ write: async () => { calls += 1; return generated; } }, async (app) => {
    const unauthorized = await app.inject({ method: "POST", url: "/api/quiz", payload });
    assert.equal(unauthorized.statusCode, 401);
    const invalid = await app.inject({ method: "POST", url: "/api/quiz", headers: { authorization: `Bearer ${token}` }, payload: { ...payload, severity: 9 } });
    assert.equal(invalid.statusCode, 400);
    assert.equal(calls, 0);
  });
});
