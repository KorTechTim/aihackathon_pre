import assert from "node:assert/strict";
import test from "node:test";
import { NPC_DIALOGUES, NPC_DIALOGUE_IDS, buildNpcDialogueRequest, fallbackNpcDialogue, isNpcDialogueExcluded } from "./npc-dialogue";
import { createInitialGame } from "./rescue-engine";

test("네 NPC는 서로 다른 성격과 지도 위치를 가진다", () => {
  assert.equal(NPC_DIALOGUE_IDS.length, 4);
  assert.equal(new Set(NPC_DIALOGUE_IDS.map((id) => NPC_DIALOGUES[id].personality)).size, 4);
  assert.equal(new Set(NPC_DIALOGUE_IDS.map((id) => NPC_DIALOGUES[id].mapPosition.join(","))).size, 4);
});

test("NPC 대사 요청에는 성격, 현재 사실과 이전 대사 이력을 담는다", () => {
  const previous = "전력 설비 주변은 아직 위험하니 접근하지 마세요.";
  const request = buildNpcDialogueRequest(NPC_DIALOGUES.npc_minsu, createInitialGame(), { dialogueSequence: 2, excludedDialogues: [previous] });
  assert.equal(request.speaker, "주민");
  assert.equal(request.situation, "npc_minsu");
  assert.equal(request.facts.npcName, "민수");
  assert.equal(request.facts.wave, 1);
  assert.deepEqual(request.choiceIds, []);
  assert.equal(request.dialogueSequence, 2);
  assert.deepEqual(request.excludedDialogues, [previous]);
});

test("NPC별 로컬 대사도 이전 문장을 피해서 순서대로 선택한다", () => {
  const history: string[] = [];
  for (let sequence = 1; sequence <= 4; sequence += 1) {
    const dialogue = fallbackNpcDialogue("npc_duri", history, sequence);
    assert.equal(isNpcDialogueExcluded(dialogue, history), false);
    history.push(dialogue);
  }
  assert.equal(new Set(history).size, 4);
});
