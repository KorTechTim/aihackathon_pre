import assert from "node:assert/strict";
import test from "node:test";
import type { AppConfig } from "../src/config.js";
import { buildServer } from "../src/server.js";
import type { BombHintWriter } from "../src/services/openai-bomb-hint.js";

const token = "test-only-backend-token-32-bytes-minimum";
const config: AppConfig = {
  host: "127.0.0.1", port: 8080, nodeEnv: "test", openaiApiKey: undefined, openaiModel: "test-model", openaiTimeoutMs: 100,
  backendSharedToken: token, trustProxyHops: false,
  rateLimitMax: 10, rateLimitWindowMs: 60_000, rateLimitBurst: 3, planCacheTtlMs: 60_000, planCacheMax: 100,
};
const payload = { correctWire: "red" as const, attempt: 1, dangerLevel: 2 as const, language: "ko" as const };
const generated = { hint: "노을빛 구조 신호가 안정 회로를 가리키고 있어요!", source: "openai" as const };

async function withServer(writer: BombHintWriter, run: (app: Awaited<ReturnType<typeof buildServer>>) => Promise<void>) {
  const app = await buildServer({ config, bombHintWriter: writer, logger: false });
  try { await run(app); } finally { await app.close(); }
}

test("인증된 /api/bomb-hint 요청은 본부 AI 무전 힌트를 반환한다", async () => {
  await withServer({ write: async () => generated }, async (app) => {
    const response = await app.inject({ method: "POST", url: "/api/bomb-hint", headers: { authorization: `Bearer ${token}` }, payload });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().source, "openai");
    assert.equal(response.json().hint, generated.hint);
  });
});

test("폭탄 힌트 API는 인증과 허용된 전선 색을 검증한다", async () => {
  let calls = 0;
  await withServer({ write: async () => { calls += 1; return generated; } }, async (app) => {
    const unauthorized = await app.inject({ method: "POST", url: "/api/bomb-hint", payload });
    assert.equal(unauthorized.statusCode, 401);
    const invalid = await app.inject({ method: "POST", url: "/api/bomb-hint", headers: { authorization: `Bearer ${token}` }, payload: { ...payload, correctWire: "green" } });
    assert.equal(invalid.statusCode, 400);
    assert.equal(calls, 0);
  });
});
