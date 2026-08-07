import assert from "node:assert/strict";
import test from "node:test";
import { buildResultNewsRequest, buildStageNewsRequest, fallbackResultNews, normalizeResultNews } from "./result-news";
import { INCIDENT_IDS, createInitialGame } from "./rescue-engine";

test("결과 뉴스 요청은 실제 게임 기록과 허용된 인터뷰 대상만 담는다", () => {
  const game = createInitialGame();
  game.status = "success";
  game.finishReason = "completed";
  game.rescuedResidents = 9;
  game.villagePreservation = 92;
  INCIDENT_IDS.forEach((id) => { game.incidents[id].status = "resolved"; });
  const request = buildResultNewsRequest(game);
  assert.equal(request.status, "success");
  assert.equal(request.edition, "final");
  assert.equal(request.completedWave, null);
  assert.equal(request.resolvedIncidents.length, 11);
  assert.equal(request.unresolvedIncidents.length, 0);
  assert.equal(request.intervieweeId, "npc_hana");
  assert.equal(request.language, "ko");
});

test("웨이브 완료 뉴스는 다음 스테이지용 중간 속보로 생성된다", () => {
  const game = createInitialGame();
  game.incidents.electrical_short.status = "resolved";
  game.incidents.bakery_fire.status = "resolved";
  game.incidents.gas_risk.status = "resolved";
  const request = buildStageNewsRequest(game, 1);
  const news = fallbackResultNews(request);
  assert.equal(request.edition, "stage");
  assert.equal(request.completedWave, 1);
  assert.equal(request.status, "success");
  assert.match(news.headline, /화재 기초/);
  assert.match(news.article, /다음 재난 지역/);
});

test("AI 뉴스는 제목, 기사와 주민 인터뷰를 모두 검증한다", () => {
  const valid = {
    headline: "구조 로봇 협동으로 마을 위기 넘겨",
    article: "세 구조 로봇이 전력과 화재 현장을 차례로 안정시키며 주민들의 안전한 대피를 도왔다.",
    interviewQuote: "구조대가 끝까지 곁을 지켜줘서 안심할 수 있었어요.",
  };
  assert.deepEqual(normalizeResultNews(valid), valid);
  assert.equal(normalizeResultNews({ ...valid, article: "**과장 기사**" }), null);
});

test("AI 장애 시에도 실제 수치를 사용한 로컬 뉴스가 제공된다", () => {
  const input = buildResultNewsRequest(createInitialGame());
  const result = fallbackResultNews(input, "OCI_NOT_CONFIGURED");
  assert.equal(result.source, "fallback");
  assert.equal(result.degradedReason, "OCI_NOT_CONFIGURED");
  assert.match(result.article, /주민 0명/);
});
