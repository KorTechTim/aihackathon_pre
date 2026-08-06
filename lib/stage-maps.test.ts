import assert from "node:assert/strict";
import test from "node:test";
import { NPC_DIALOGUE_IDS } from "./npc-dialogue";
import { INCIDENT_IDS } from "./rescue-engine";
import { STAGE_MAPS, getStageMap } from "./stage-maps";

test("기본 작전의 세 웨이브는 서로 다른 지형으로 전환된다", () => {
  assert.equal(STAGE_MAPS.length, 9);
  assert.equal(getStageMap(0, 1).id, "day");
  assert.equal(getStageMap(0, 2).id, "harbor");
  assert.equal(getStageMap(0, 3).id, "highland");
});

test("재출동할 때 시작 맵이 이동하며 아홉 맵을 순환한다", () => {
  assert.equal(getStageMap(1, 1).id, "harbor");
  assert.equal(getStageMap(3, 1).id, "canals");
  assert.equal(getStageMap(4, 1).id, "railway");
  assert.equal(getStageMap(8, 1).id, "winter");
  assert.equal(getStageMap(9, 1).id, "day");
  assert.equal(getStageMap(Number.NaN, 1).id, "day");
});

test("모든 맵은 NPC 4명과 사고 10개의 전용 좌표를 제공한다", () => {
  for (const map of STAGE_MAPS) {
    assert.deepEqual(Object.keys(map.npcPositions).sort(), [...NPC_DIALOGUE_IDS].sort(), map.id);
    assert.deepEqual(Object.keys(map.incidentPositions).sort(), [...INCIDENT_IDS].sort(), map.id);
  }
});

test("신규 지형은 고유 배치와 로봇 이동 경로를 사용한다", () => {
  const uniqueMaps = STAGE_MAPS.filter((map) => map.layout !== "classic");
  assert.equal(uniqueMaps.length, 4);
  for (const map of uniqueMaps) {
    assert.notDeepEqual(map.npcPositions, STAGE_MAPS[0].npcPositions, map.id);
    assert.notDeepEqual(map.incidentPositions, STAGE_MAPS[0].incidentPositions, map.id);
    assert.equal(Object.keys(map.routes ?? {}).length, 4, map.id);

    const positions = INCIDENT_IDS.map((id) => map.incidentPositions[id]);
    for (let index = 0; index < positions.length; index += 1) {
      for (let other = index + 1; other < positions.length; other += 1) {
        const [x1, y1] = positions[index];
        const [x2, y2] = positions[other];
        assert.equal(Math.abs(x1 - x2) < 74 && Math.abs(y1 - y2) < 61, false, `${map.id}: incident ${index}/${other}`);
      }
    }
  }
});
