import assert from "node:assert/strict";
import test from "node:test";
import { FALLBACK_PLAN } from "../game-state";
import {
  extractVercelClientIp,
  handlePlanProxyRequest,
  loadOciProxyConfig,
  type OciProxyConfig,
  type OciProxyLogRecord,
} from "./oci-plan-client";

const token = "test-only-shared-token-32-bytes-minimum";
const config: OciProxyConfig = { backendUrl: "http://192.0.2.10:8080", backendToken: token, timeoutMs: 50 };
const validUpstream = {
  plan: { ...FALLBACK_PLAN, priority: ["cat", "fire", "bridge", "generator"] },
  source: "openai",
};

function request(command: unknown = "고양이를 먼저 구조해줘", headers: HeadersInit = {}) {
  return new Request("https://pixel-panic.example/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ command }),
  });
}

test("OCI URL과 토큰 설정을 정규화하고 위험한 URL을 거부한다", () => {
  assert.deepEqual(loadOciProxyConfig({ OCI_BACKEND_URL: "http://192.0.2.10:8080/", OCI_BACKEND_TOKEN: token, OCI_BACKEND_TIMEOUT_MS: "50" }), config);
  for (const url of ["ftp://192.0.2.10", "http://user:pass@192.0.2.10", "http://192.0.2.10?q=1", "http://192.0.2.10#x"]) {
    assert.throws(() => loadOciProxyConfig({ OCI_BACKEND_URL: url, OCI_BACKEND_TOKEN: token }));
  }
  assert.throws(() => loadOciProxyConfig({ OCI_BACKEND_URL: "http://192.0.2.10", OCI_BACKEND_TOKEN: "too-short" }));
});

test("정상 OCI 응답을 검증하고 필요한 헤더만 명시적으로 전달한다", async () => {
  let sentHeaders: Record<string, string> = {};
  const records: OciProxyLogRecord[] = [];
  const response = await handlePlanProxyRequest(request(undefined, { "x-vercel-forwarded-for": "203.0.113.7" }), {
    config,
    createRequestId: () => "proxy-request-1",
    logger: (record) => records.push(record),
    fetchImpl: async (_input, init) => {
      sentHeaders = init?.headers as Record<string, string>;
      return Response.json(validUpstream);
    },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.source, "openai");
  assert.deepEqual(body.plan.priority, ["cat", "fire", "bridge", "generator"]);
  assert.deepEqual(Object.keys(sentHeaders).sort(), ["Authorization", "Content-Type", "X-Forwarded-For", "X-Request-Id"].sort());
  assert.equal(sentHeaders.Authorization, `Bearer ${token}`);
  assert.equal(sentHeaders["X-Forwarded-For"], "203.0.113.7");
  assert.equal(JSON.stringify({ body, records }).includes(token), false);
  assert.equal(JSON.stringify(records).includes("고양이를 먼저 구조해줘"), false);
});

test("설정 누락은 OCI 호출 없이 LOCAL fallback을 반환한다", async () => {
  let calls = 0;
  const response = await handlePlanProxyRequest(request(), {
    config: { timeoutMs: 50 },
    createRequestId: () => "not-configured",
    logger: () => undefined,
    fetchImpl: async () => { calls += 1; return Response.json(validUpstream); },
  });
  assert.equal(calls, 0);
  assert.deepEqual(await response.json(), { plan: FALLBACK_PLAN, source: "fallback", degradedReason: "OCI_NOT_CONFIGURED", requestId: "not-configured" });
});

test("OCI timeout은 200 LOCAL fallback으로 끝난다", async () => {
  const response = await handlePlanProxyRequest(request(), {
    config: { ...config, timeoutMs: 5 },
    createRequestId: () => "timeout",
    logger: () => undefined,
    fetchImpl: async (_input, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).degradedReason, "OCI_TIMEOUT");
});

test("OCI 429와 5xx는 각각 안전한 fallback으로 변환된다", async () => {
  for (const [status, reason] of [[429, "OCI_RATE_LIMITED"], [503, "OCI_UNAVAILABLE"]] as const) {
    const response = await handlePlanProxyRequest(request(), {
      config,
      createRequestId: () => `status-${status}`,
      logger: () => undefined,
      fetchImpl: async () => new Response("upstream failure", { status }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).degradedReason, reason);
  }
});

test("잘못된 OCI JSON과 schema는 fallback으로 변환된다", async () => {
  for (const upstream of [new Response("not-json"), Response.json({ plan: null, source: "openai" })]) {
    const response = await handlePlanProxyRequest(request(), {
      config,
      createRequestId: () => "invalid-upstream",
      logger: () => undefined,
      fetchImpl: async () => upstream,
    });
    assert.equal((await response.json()).degradedReason, "OCI_INVALID_RESPONSE");
  }
});

test("잘못된 command는 OCI를 호출하지 않고 400을 반환한다", async () => {
  let calls = 0;
  for (const command of ["가", "가".repeat(501), 123]) {
    const response = await handlePlanProxyRequest(request(command), {
      config,
      logger: () => undefined,
      fetchImpl: async () => { calls += 1; return Response.json(validUpstream); },
    });
    assert.equal(response.status, 400);
  }
  assert.equal(calls, 0);
});

test("Vercel이 확인한 IP만 단일 값으로 정규화한다", () => {
  assert.equal(extractVercelClientIp(new Headers({ "x-vercel-forwarded-for": "203.0.113.8", "x-forwarded-for": "198.51.100.4" })), "203.0.113.8");
  assert.equal(extractVercelClientIp(new Headers({ "x-vercel-forwarded-for": "not-an-ip" })), "0.0.0.0");
});
