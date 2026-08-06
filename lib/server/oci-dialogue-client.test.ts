import assert from "node:assert/strict";
import test from "node:test";
import { DIALOGUE_EVENTS } from "../dialogue-events";
import { NPC_DIALOGUES } from "../npc-dialogue";
import { handleDialogueProxyRequest } from "./oci-dialogue-client";

const token = "test-only-shared-token-32-bytes-minimum";
const config = { backendUrl: "http://192.0.2.10:8080", backendToken: token, timeoutMs: 50 };
const body = {
  speaker: "AQUA",
  personality: "calm_and_helpful",
  situation: "hydrant_broken",
  facts: { spreadSeconds: 12 },
  choiceIds: ["use_reserve_water", "protect_nearby_house"],
  language: "ko",
} as const;
const npcBody = {
  speaker: "주민",
  personality: "observant_keeper_optimistic",
  situation: "npc_duri",
  facts: { npcName: "두리", npcRole: "공원 관리인", characterTraits: "지형 변화를 빠르게 발견함", wave: 2 },
  choiceIds: [],
  dialogueSequence: 1,
  excludedDialogues: [],
  language: "ko",
} as const;

function request(payload: unknown = body) {
  return new Request("https://pixel-panic.example/api/dialogue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}

test("정상 OCI 대사를 검증해 전달한다", async () => {
  const response = await handleDialogueProxyRequest(request(), {
    config,
    createRequestId: () => "dialogue-ok",
    fetchImpl: async () => Response.json({ dialogue: "수압은 낮지만 침착하게 주변부터 보호할게요.", source: "openai" }),
  });
  assert.deepEqual(await response.json(), { dialogue: "수압은 낮지만 침착하게 주변부터 보호할게요.", source: "openai", requestId: "dialogue-ok" });
});

test("OCI 설정 누락과 잘못된 응답은 정적 대사로 폴백한다", async () => {
  const missing = await handleDialogueProxyRequest(request(), { config: { timeoutMs: 50 }, createRequestId: () => "missing" });
  assert.deepEqual(await missing.json(), { dialogue: DIALOGUE_EVENTS.hydrant_broken.fallbackDialogue, source: "fallback", degradedReason: "OCI_NOT_CONFIGURED", requestId: "missing" });
  const invalid = await handleDialogueProxyRequest(request(), { config, fetchImpl: async () => Response.json({ dialogue: "**마크다운**", source: "openai" }) });
  assert.equal((await invalid.json()).source, "fallback");
});

test("NPC 대화는 선택지 없이 허용하고 캐릭터별 폴백을 사용한다", async () => {
  const response = await handleDialogueProxyRequest(request(npcBody), { config: { timeoutMs: 50 }, createRequestId: () => "npc-fallback" });
  assert.deepEqual(await response.json(), {
    dialogue: NPC_DIALOGUES.npc_duri.fallbackDialogue,
    source: "fallback",
    degradedReason: "OCI_NOT_CONFIGURED",
    requestId: "npc-fallback",
  });
});

test("OCI가 NPC의 이전 대사를 반복하면 새 로컬 대사로 교체한다", async () => {
  const previous = NPC_DIALOGUES.npc_duri.fallbackDialogue;
  const response = await handleDialogueProxyRequest(request({ ...npcBody, dialogueSequence: 2, excludedDialogues: [previous] }), {
    config,
    createRequestId: () => "npc-duplicate",
    fetchImpl: async () => Response.json({ dialogue: previous, source: "openai" }),
  });
  const result = await response.json() as { dialogue: string; source: string; degradedReason: string };
  assert.notEqual(result.dialogue, previous);
  assert.equal(result.source, "fallback");
  assert.equal(result.degradedReason, "OCI_INVALID_RESPONSE");
});

test("잘못된 요청은 OCI 호출 전 400으로 거부한다", async () => {
  let calls = 0;
  const response = await handleDialogueProxyRequest(request({ ...body, choiceIds: [] }), { config, fetchImpl: async () => { calls += 1; return Response.json({}); } });
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});
