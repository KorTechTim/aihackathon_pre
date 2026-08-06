import assert from "node:assert/strict";
import test from "node:test";
import { NPC_DIALOGUES, NPC_DIALOGUE_IDS, buildNpcDialogueRequest } from "./npc-dialogue";
import { createInitialGame } from "./rescue-engine";

test("네 NPC는 서로 다른 성격과 지도 위치를 가진다", () => {
  assert.equal(NPC_DIALOGUE_IDS.length, 4);
  assert.equal(new Set(NPC_DIALOGUE_IDS.map((id) => NPC_DIALOGUES[id].personality)).size, 4);
  assert.equal(new Set(NPC_DIALOGUE_IDS.map((id) => NPC_DIALOGUES[id].mapPosition.join(","))).size, 4);
});

test("NPC 대사 요청에는 성격과 현재 게임 사실만 포함하고 선택지는 만들지 않는다", () => {
  const request = buildNpcDialogueRequest(NPC_DIALOGUES.npc_minsu, createInitialGame());
  assert.equal(request.speaker, "주민");
  assert.equal(request.situation, "npc_minsu");
  assert.equal(request.facts.npcName, "민수");
  assert.equal(request.facts.wave, 1);
  assert.deepEqual(request.choiceIds, []);
});
