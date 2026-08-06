import { INCIDENTS, WAVE_LABELS, formatGameTime, getResolvedCount, type RescueGameState } from "./rescue-engine";

export const NPC_DIALOGUE_IDS = ["npc_boram", "npc_minsu", "npc_hana", "npc_duri"] as const;
export const MAX_EXCLUDED_NPC_DIALOGUES = 24;
export const MAX_NPC_DIALOGUE_SEQUENCE = 10_000;
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

const NPC_FALLBACK_DIALOGUES: Record<NpcDialogueId, readonly string[]> = {
  npc_boram: [
    NPC_DIALOGUES.npc_boram.fallbackDialogue,
    "저쪽 골목은 제가 살펴봤어요. 이웃들이 당황하지 않도록 안전한 방향부터 알려줄게요!",
    "빵집 주변은 제가 잘 알아요. 구조대가 지나갈 길을 비우고 주민들을 차분히 안내할게요!",
    "걱정만 하고 있을 순 없죠. 도움이 필요한 이웃부터 찾아 구조대에 바로 알려드릴게요!",
  ],
  npc_minsu: [
    NPC_DIALOGUES.npc_minsu.fallbackDialogue,
    "젖은 배전함은 겉보기보다 위험합니다. 전원이 완전히 차단됐다는 확인 전에는 손대지 마세요.",
    "설비 소리가 평소와 다릅니다. 진동과 타는 냄새가 나는 구역은 제가 표시해두겠습니다.",
    "배수로와 전력선이 만나는 곳부터 점검해야 합니다. 안전거리 밖에서 상태를 계속 확인하겠습니다.",
  ],
  npc_hana: [
    NPC_DIALOGUES.npc_hana.fallbackDialogue,
    "서두르지 않아도 괜찮아요. 어린이와 어르신이 먼저 이동하도록 제가 곁에서 도울게요.",
    "대피한 분들의 인원을 다시 확인하고 있어요. 가족과 떨어진 주민이 없는지 살펴보겠습니다.",
    "안전한 곳에 도착할 때까지 안내 표지를 따라주세요. 제가 맨 뒤에서 모두를 확인할게요.",
  ],
  npc_duri: [
    NPC_DIALOGUES.npc_duri.fallbackDialogue,
    "물살과 바람 방향이 조금 바뀌었어요. 공원 안쪽 높은 길을 계속 확인해 알려드릴게요!",
    "다리 아래 수위 표지가 빠르게 올라가고 있습니다. 낮은 산책로는 당분간 피해주세요.",
    "나무와 울타리 상태를 살펴보니 북쪽 길이 가장 안정적이에요. 변화가 생기면 바로 알리겠습니다!",
  ],
};

export function npcDialogueKey(dialogue: string): string {
  return dialogue.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}]+/gu, "");
}

export function isNpcDialogueExcluded(dialogue: string, excludedDialogues: readonly string[]): boolean {
  const key = npcDialogueKey(dialogue);
  return key.length > 0 && excludedDialogues.some((excluded) => npcDialogueKey(excluded) === key);
}

export function fallbackNpcDialogue(npcId: NpcDialogueId, excludedDialogues: readonly string[] = [], dialogueSequence = 1): string {
  const candidates = NPC_FALLBACK_DIALOGUES[npcId];
  const unused = candidates.find((dialogue) => !isNpcDialogueExcluded(dialogue, excludedDialogues));
  if (unused) return unused;
  return `${Math.max(1, Math.trunc(dialogueSequence))}번째 현장 보고: ${candidates[0]}`.slice(0, 120);
}

export function buildNpcDialogueRequest(
  npc: NpcDialogueDefinition,
  state: RescueGameState,
  options: { dialogueSequence?: number; excludedDialogues?: readonly string[] } = {},
) {
  const dialogueSequence = Math.max(1, Math.trunc(options.dialogueSequence ?? 1));
  const excludedDialogues = (options.excludedDialogues ?? [])
    .map((dialogue) => dialogue.replace(/\s+/g, " ").trim())
    .filter((dialogue) => dialogue.length >= 2 && dialogue.length <= 160)
    .slice(-MAX_EXCLUDED_NPC_DIALOGUES);
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
    dialogueSequence,
    excludedDialogues,
    language: "ko" as const,
  };
}
