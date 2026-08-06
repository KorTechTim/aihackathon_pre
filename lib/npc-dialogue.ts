import { INCIDENTS, WAVE_LABELS, formatGameTime, getResolvedCount, type RescueGameState } from "./rescue-engine";

export const NPC_DIALOGUE_IDS = ["npc_boram", "npc_minsu", "npc_hana", "npc_duri"] as const;
export type NpcDialogueId = (typeof NPC_DIALOGUE_IDS)[number];
export type NpcSpriteId = "a" | "b" | "c" | "d";

export type NpcDialogueDefinition = {
  id: NpcDialogueId;
  spriteId: NpcSpriteId;
  name: string;
  role: string;
  personality: string;
  characterTraits: string;
  fallbackDialogue: string;
  mapPosition: readonly [number, number];
};

export const NPC_DIALOGUES: Record<NpcDialogueId, NpcDialogueDefinition> = {
  npc_boram: {
    id: "npc_boram",
    spriteId: "a",
    name: "보람",
    role: "빵집 이웃 주민",
    personality: "brave_neighbor_warm_direct",
    characterTraits: "씩씩하고 이웃을 먼저 걱정하며 짧고 힘 있게 말함",
    fallbackDialogue: "구조대가 왔으니 마음이 놓여요. 저는 이웃들에게 안전한 길을 알려줄게요!",
    mapPosition: [400, 360],
  },
  npc_minsu: {
    id: "npc_minsu",
    spriteId: "b",
    name: "민수",
    role: "마을 설비 정비사",
    personality: "careful_mechanic_fact_focused",
    characterTraits: "기계에 밝고 꼼꼼하며 위험 요소를 구체적으로 짚어 말함",
    fallbackDialogue: "전력선과 배수 장치를 계속 확인 중입니다. 번쩍이는 설비에는 가까이 가지 마세요.",
    mapPosition: [546, 250],
  },
  npc_hana: {
    id: "npc_hana",
    spriteId: "c",
    name: "하나",
    role: "구조 자원봉사자",
    personality: "calm_volunteer_reassuring",
    characterTraits: "침착하고 다정하며 주민이 따라 하기 쉬운 안전 행동을 말함",
    fallbackDialogue: "천천히 숨을 고르고 구조대 안내를 따라주세요. 제가 뒤처진 주민을 살펴볼게요.",
    mapPosition: [720, 450],
  },
  npc_duri: {
    id: "npc_duri",
    spriteId: "d",
    name: "두리",
    role: "공원 관리인",
    personality: "observant_keeper_optimistic",
    characterTraits: "마을 지형을 잘 알고 작은 변화를 빠르게 발견하며 희망적으로 말함",
    fallbackDialogue: "강물과 다리 상태를 계속 보고 있어요. 안전한 길이 열리면 바로 모두에게 알릴게요!",
    mapPosition: [930, 430],
  },
};

export function buildNpcDialogueRequest(npc: NpcDialogueDefinition, state: RescueGameState) {
  return {
    speaker: "주민" as const,
    personality: npc.personality,
    situation: npc.id,
    facts: {
      npcName: npc.name,
      npcRole: npc.role,
      characterTraits: npc.characterTraits,
      wave: state.wave,
      waveName: WAVE_LABELS[state.wave - 1],
      villagePreservation: state.villagePreservation,
      remainingTime: formatGameTime(state.remainingMs),
      resolvedIncidents: getResolvedCount(state),
      selectedIncident: state.selectedIncidentId ? INCIDENTS[state.selectedIncidentId].label : "없음",
    },
    choiceIds: [] as string[],
    language: "ko" as const,
  };
}
