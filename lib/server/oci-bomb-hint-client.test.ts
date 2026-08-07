import assert from "node:assert/strict";
import test from "node:test";
import { fallbackBombHint } from "../bomb-defusal";
import { handleBombHintProxyRequest } from "./oci-bomb-hint-client";

const config = { backendUrl: "http://192.0.2.10:8080", backendToken: "test-only-shared-token-32-bytes-minimum", timeoutMs: 50 };
const body = { correctWire: "blue" as const, attempt: 2, dangerLevel: 3 as const, language: "ko" as const };

function request(payload: unknown = body) {
  return new Request("https://pixel-panic.example/api/bomb-hint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}

test("정상 OCI 본부 AI 무전 힌트를 검증해 전달한다", async () => {
  const generated = { hint: "맑은 하늘빛 주파수가 오늘의 안전 신호예요!", source: "openai" as const };
  const response = await handleBombHintProxyRequest(request(), { config, createRequestId: () => "bomb-ok", fetchImpl: async () => Response.json(generated) });
  assert.deepEqual(await response.json(), { ...generated, requestId: "bomb-ok" });
});

test("OCI 설정 누락과 잘못된 응답은 정답에 맞는 로컬 무전으로 폴백한다", async () => {
  const missing = await handleBombHintProxyRequest(request(), { config: { timeoutMs: 50 }, createRequestId: () => "bomb-missing" });
  assert.deepEqual(await missing.json(), { ...fallbackBombHint("blue", 2, "OCI_NOT_CONFIGURED"), requestId: "bomb-missing" });
  const invalid = await handleBombHintProxyRequest(request(), { config, fetchImpl: async () => Response.json({ hint: "짧음", source: "openai" }) });
  assert.equal((await invalid.json()).source, "fallback");
});

test("조작된 전선 색은 OCI 호출 전에 거부한다", async () => {
  let calls = 0;
  const response = await handleBombHintProxyRequest(request({ ...body, correctWire: "green" }), {
    config,
    fetchImpl: async () => { calls += 1; return Response.json({}); },
  });
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});
