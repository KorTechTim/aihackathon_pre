import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig, type AppConfig } from "../src/config.js";
import { buildServer } from "../src/server.js";
import { FALLBACK_PLAN, type PlanResult } from "../src/schemas/rescue-plan.js";
import type { RescuePlanner } from "../src/services/openai-planner.js";

const sharedToken = "test-only-backend-token-32-bytes-minimum";
const authHeaders = { authorization: `Bearer ${sharedToken}` };
const config: AppConfig = {
  host: "127.0.0.1", port: 8080, nodeEnv: "test", openaiApiKey: undefined, openaiModel: "test-model", openaiTimeoutMs: 100,
  backendSharedToken: sharedToken, trustProxyHops: false,
  rateLimitMax: 10, rateLimitWindowMs: 60_000, rateLimitBurst: 3, planCacheTtlMs: 60_000, planCacheMax: 100,
};

const openaiResult: PlanResult = {
  source: "openai",
  plan: {
    summary: "고양이를 먼저 구조합니다.", priority: ["cat", "fire", "bridge", "generator"],
    assignments: [
      { robot: "aqua", incidents: ["fire"], reason: "화재 담당" },
      { robot: "fix", incidents: ["bridge", "generator"], reason: "시설 담당" },
      { robot: "buddy", incidents: ["cat"], reason: "구조 담당" },
    ],
  },
};

async function withServer(planner: RescuePlanner, run: (app: Awaited<ReturnType<typeof buildServer>>) => Promise<void>, overrides: Partial<AppConfig> = {}) {
  const app = await buildServer({ config: { ...config, ...overrides }, planner, logger: false });
  try { await run(app); } finally { await app.close(); }
}

test("production은 32바이트 미만 공유 토큰으로 시작하지 않는다", () => {
  assert.throws(() => loadConfig({ NODE_ENV: "production", BACKEND_SHARED_TOKEN: "" }), /at least 32 bytes/);
  assert.throws(() => loadConfig({ NODE_ENV: "production", BACKEND_SHARED_TOKEN: "too-short" }), /at least 32 bytes/);
  assert.equal(loadConfig({ NODE_ENV: "production", BACKEND_SHARED_TOKEN: sharedToken }).backendSharedToken, sharedToken);
});

test("GET /health는 인증이나 비밀값 없이 상태를 반환한다", async () => {
  await withServer({ plan: async () => openaiResult }, async (app) => {
    const response = await app.inject({ method: "GET", url: "/health" });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.deepEqual({ status: body.status, service: body.service, version: body.version, openaiConfigured: body.openaiConfigured }, { status: "ok", service: "pixel-panic-api", version: "0.2.0", openaiConfigured: false });
    assert.match(body.timestamp, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(String(response.headers["x-request-id"] ?? "").length > 10, true);
    assert.equal(JSON.stringify(body).includes(sharedToken), false);
  });
});

test("토큰이 없는 /v1/plan 요청은 planner 호출 전에 401이다", async () => {
  let calls = 0;
  await withServer({ plan: async () => { calls += 1; return openaiResult; } }, async (app) => {
    const response = await app.inject({ method: "POST", url: "/v1/plan", payload: { command: "고양이를 먼저 구조해줘" } });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().code, "UNAUTHORIZED");
    assert.equal(calls, 0);
  });
});

test("잘못된 토큰은 rate limit과 planner 호출 전에 401이다", async () => {
  let calls = 0;
  await withServer({ plan: async () => { calls += 1; return openaiResult; } }, async (app) => {
    for (let index = 0; index < 12; index += 1) {
      const response = await app.inject({ method: "POST", url: "/v1/plan", headers: { authorization: "Bearer invalid-token-value-that-is-long-enough" }, payload: { command: "화재를 먼저 해결해줘" } });
      assert.equal(response.statusCode, 401);
      assert.equal(JSON.stringify(response.json()).includes("invalid-token"), false);
    }
    const authorized = await app.inject({ method: "POST", url: "/v1/plan", headers: authHeaders, payload: { command: "화재를 먼저 해결해줘" } });
    assert.equal(authorized.statusCode, 200);
    assert.equal(calls, 1);
  }, { rateLimitMax: 1 });
});

test("올바른 토큰은 정상 계획 계약과 요청 ID를 반환한다", async () => {
  await withServer({ plan: async () => openaiResult }, async (app) => {
    const response = await app.inject({ method: "POST", url: "/v1/plan", headers: authHeaders, payload: { command: "고양이를 먼저 구조해줘" } });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.source, "openai");
    assert.deepEqual(body.plan.priority, ["cat", "fire", "bridge", "generator"]);
    assert.equal(typeof body.requestId, "string");
  });
});

test("OpenAI 장애 시 같은 schema의 fallback을 200으로 반환한다", async () => {
  await withServer({ plan: async () => ({ plan: FALLBACK_PLAN, source: "fallback", degradedReason: "OPENAI_UNAVAILABLE" }) }, async (app) => {
    const response = await app.inject({ method: "POST", url: "/v1/plan", headers: authHeaders, payload: { command: "화재부터 해결해줘" } });
    const body = response.json();
    assert.equal(response.statusCode, 200);
    assert.equal(body.source, "fallback");
    assert.equal(body.degradedReason, "OPENAI_UNAVAILABLE");
    assert.equal(body.plan.assignments.length, 3);
  });
});

test("invalid JSON과 command 길이를 400으로 거부한다", async () => {
  await withServer({ plan: async () => openaiResult }, async (app) => {
    const invalidJson = await app.inject({ method: "POST", url: "/v1/plan", headers: { ...authHeaders, "content-type": "application/json" }, payload: "{" });
    assert.equal(invalidJson.statusCode, 400); assert.equal(invalidJson.json().code, "INVALID_JSON");
    for (const command of ["가", "가".repeat(501)]) {
      const response = await app.inject({ method: "POST", url: "/v1/plan", headers: authHeaders, payload: { command } });
      assert.equal(response.statusCode, 400); assert.equal(response.json().code, "INVALID_COMMAND");
    }
  });
});

test("11번째 인증 요청은 429와 Retry-After를 반환한다", async () => {
  await withServer({ plan: async () => openaiResult }, async (app) => {
    for (let index = 0; index < 10; index += 1) {
      const response = await app.inject({ method: "POST", url: "/v1/plan", headers: authHeaders, payload: { command: `요청 ${index}번을 처리해줘` } });
      assert.equal(response.statusCode, 200);
    }
    const limited = await app.inject({ method: "POST", url: "/v1/plan", headers: authHeaders, payload: { command: "열한 번째 요청을 처리해줘" } });
    assert.equal(limited.statusCode, 429); assert.equal(limited.json().code, "RATE_LIMITED");
    assert.equal(Number(limited.headers["retry-after"]) >= 1, true);
  });
});

test("동시 burst 3회를 넘는 네 번째 인증 요청을 거부한다", async () => {
  const pending: Array<() => void> = [];
  const slowPlanner: RescuePlanner = { plan: () => new Promise((resolve) => pending.push(() => resolve(openaiResult))) };
  await withServer(slowPlanner, async (app) => {
    const firstThree = [0, 1, 2].map((index) => app.inject({ method: "POST", url: "/v1/plan", headers: authHeaders, payload: { command: `동시 요청 ${index} 처리` } }));
    while (pending.length < 3) await new Promise((resolve) => setImmediate(resolve));
    const fourth = await app.inject({ method: "POST", url: "/v1/plan", headers: authHeaders, payload: { command: "네 번째 동시 요청 처리" } });
    assert.equal(fourth.statusCode, 429);
    pending.forEach((release) => release());
    assert.deepEqual((await Promise.all(firstThree)).map((response) => response.statusCode), [200, 200, 200]);
  });
});

test("동일 command 캐시는 OpenAI planner를 한 번만 호출한다", async () => {
  let calls = 0;
  await withServer({ plan: async () => { calls += 1; return openaiResult; } }, async (app) => {
    for (let index = 0; index < 2; index += 1) {
      const response = await app.inject({ method: "POST", url: "/v1/plan", headers: authHeaders, payload: { command: "  고양이를   먼저 구조해줘  " } });
      assert.equal(response.statusCode, 200);
    }
    assert.equal(calls, 1);
  });
});

test("인증된 전달 IP별로 rate limit을 분리한다", async () => {
  await withServer({ plan: async () => openaiResult }, async (app) => {
    for (const ip of ["203.0.113.10", "198.51.100.20"]) {
      const response = await app.inject({ method: "POST", url: "/v1/plan", headers: { ...authHeaders, "x-forwarded-for": ip }, payload: { command: `IP ${ip} 요청 처리` } });
      assert.equal(response.statusCode, 200);
    }
    const limited = await app.inject({ method: "POST", url: "/v1/plan", headers: { ...authHeaders, "x-forwarded-for": "203.0.113.10" }, payload: { command: "같은 IP 두 번째 요청 처리" } });
    assert.equal(limited.statusCode, 429);
  }, { trustProxyHops: 1, rateLimitMax: 1 });
});

test("OCI 백엔드는 브라우저 CORS 응답에 의존하지 않는다", async () => {
  await withServer({ plan: async () => openaiResult }, async (app) => {
    const response = await app.inject({ method: "POST", url: "/v1/plan", headers: { ...authHeaders, origin: "https://unrelated.example" }, payload: { command: "고양이를 구조해줘" } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["access-control-allow-origin"], undefined);
    const preflight = await app.inject({ method: "OPTIONS", url: "/v1/plan", headers: { origin: "https://unrelated.example", "access-control-request-method": "POST" } });
    assert.equal(preflight.statusCode, 404);
  });
});

test("감사 로그에는 command 원문이나 키와 토큰이 포함되지 않는다", async () => {
  const records: unknown[] = [];
  const secretCommand = "절대 로그에 남기지 말아줘-비밀명령";
  const app = await buildServer({ config, planner: { plan: async () => openaiResult }, audit: (record) => records.push(record), logger: false });
  try { await app.inject({ method: "POST", url: "/v1/plan", headers: authHeaders, payload: { command: secretCommand } }); } finally { await app.close(); }
  const serialized = JSON.stringify(records);
  assert.equal(serialized.includes(secretCommand), false);
  assert.equal(serialized.includes("OPENAI_API_KEY"), false);
  assert.equal(serialized.includes(sharedToken), false);
  assert.equal(records.length, 1);
});
