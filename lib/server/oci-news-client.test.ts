import assert from "node:assert/strict";
import test from "node:test";
import { buildResultNewsRequest, buildStageNewsRequest, fallbackResultNews } from "../result-news";
import { INCIDENT_IDS, createInitialGame } from "../rescue-engine";
import { handleNewsProxyRequest } from "./oci-news-client";

const config = { backendUrl: "http://192.0.2.10:8080", backendToken: "test-only-shared-token-32-bytes-minimum", timeoutMs: 50 };
const game = createInitialGame();
game.status = "success";
game.finishReason = "completed";
game.rescuedResidents = 9;
game.villagePreservation = 94;
INCIDENT_IDS.forEach((id) => { game.incidents[id].status = "resolved"; });
const body = buildResultNewsRequest(game);

function request(payload: unknown = body) {
  return new Request("https://pixel-panic.example/api/news", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}

test("정상 OCI 뉴스와 주민 인터뷰를 검증해 전달한다", async () => {
  const generated = {
    headline: "세 구조 로봇의 협동, 마을을 지켰다",
    article: "구조대는 전력과 화재 현장을 차례로 안정시키고 주민 아홉 명을 안전하게 대피시켰다.",
    interviewQuote: "구조대가 끝까지 주민들을 살펴줘서 정말 든든했어요.",
    source: "openai",
  } as const;
  const response = await handleNewsProxyRequest(request(), { config, createRequestId: () => "news-ok", fetchImpl: async () => Response.json(generated) });
  assert.deepEqual(await response.json(), { ...generated, requestId: "news-ok" });
});
test("OCI 설정 누락과 잘못된 응답은 실제 기록 기반 뉴스로 폴백한다", async () => {
  const missing = await handleNewsProxyRequest(request(), { config: { timeoutMs: 50 }, createRequestId: () => "news-missing" });
  assert.deepEqual(await missing.json(), { ...fallbackResultNews(body, "OCI_NOT_CONFIGURED"), requestId: "news-missing" });
  const invalid = await handleNewsProxyRequest(request(), { config, fetchImpl: async () => Response.json({ headline: "짧음", source: "openai" }) });
  assert.equal((await invalid.json()).source, "fallback");
});

test("조작된 인터뷰 대상과 누락된 사고 목록은 OCI 호출 전에 거부한다", async () => {
  let calls = 0;
  const response = await handleNewsProxyRequest(request({ ...body, intervieweeName: "알 수 없는 주민" }), {
    config,
    fetchImpl: async () => { calls += 1; return Response.json({}); },
  });
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});

test("웨이브 완료 중간 뉴스 요청도 OCI 계약을 통과한다", async () => {
  const stageGame = createInitialGame();
  stageGame.incidents.electrical_short.status = "resolved";
  stageGame.incidents.bakery_fire.status = "resolved";
  stageGame.incidents.gas_risk.status = "resolved";
  const stageBody = buildStageNewsRequest(stageGame, 1);
  const response = await handleNewsProxyRequest(request(stageBody), { config: { timeoutMs: 50 }, createRequestId: () => "stage-news" });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.source, "fallback");
  assert.match(result.headline, /화재 기초/);
});
