import type { ActionId, IncidentId, RescueGameState, RobotId } from "./rescue-engine";

export const DIALOGUE_EVENT_IDS = ["hydrant_broken", "high_water_bridge", "bakery_gas_info", "buddy_priority"] as const;
export type DialogueEventId = (typeof DIALOGUE_EVENT_IDS)[number];

export type DialogueChoice = { id: string; label: string };
export type DialogueEventDefinition = {
  id: DialogueEventId;
  speaker: "AQUA" | "FIX" | "BUDDY" | "주민";
  personality: string;
  title: string;
  fallbackDialogue: string;
  choices: DialogueChoice[];
};

export const DIALOGUE_EVENTS: Record<DialogueEventId, DialogueEventDefinition> = {
  hydrant_broken: {
    id: "hydrant_broken",
    speaker: "AQUA",
    personality: "calm_and_helpful",
    title: "소화전 수압 이상",
    fallbackDialogue: "소화전 수압이 부족해요. 남은 물로 진압하거나 주변 민가부터 보호할 수 있어요.",
    choices: [
      { id: "use_reserve_water", label: "비상 물탱크로 바로 진압" },
      { id: "protect_nearby_house", label: "민가 방화부터 진행" },
      { id: "wait_for_fix", label: "FIX 점검을 잠시 기다리기" },
    ],
  },
  high_water_bridge: {
    id: "high_water_bridge",
    speaker: "FIX",
    personality: "careful_and_practical",
    title: "높은 수위의 다리",
    fallbackDialogue: "수위가 아직 높습니다. 지금 설치하면 빠르지만 안전 여유가 적어요. 어떤 방식으로 진행할까요?",
    choices: [
      { id: "wait_for_drain", label: "AQUA의 배수를 먼저 확인" },
      { id: "reinforce_first", label: "교각부터 보강하고 설치" },
      { id: "rapid_bridge", label: "즉시 임시 다리 설치" },
    ],
  },
  bakery_gas_info: {
    id: "bakery_gas_info",
    speaker: "주민",
    personality: "urgent_but_clear",
    title: "빵집 주민의 제보",
    fallbackDialogue: "오븐 옆에 예비 가스통이 있어요! 대피 경로와 떨어진 쪽이라 FIX가 위치를 알면 차단할 수 있어요.",
    choices: [
      { id: "mark_gas_tank", label: "가스통 위치를 FIX에 공유" },
      { id: "evacuate_backdoor", label: "주민을 뒷문으로 대피" },
    ],
  },
  buddy_priority: {
    id: "buddy_priority",
    speaker: "BUDDY",
    personality: "warm_and_decisive",
    title: "BUDDY의 우선순위",
    fallbackDialogue: "발전소 부품과 고립 주민 신호가 동시에 잡혔어요. 먼저 맡을 임무를 정해주세요!",
    choices: [
      { id: "parts_first", label: "부품을 먼저 운반" },
      { id: "residents_first", label: "주민 위치부터 확인" },
    ],
  },
};

export function dialogueForAction(state: RescueGameState, incidentId: IncidentId, actionId: ActionId, robotId: RobotId): DialogueEventDefinition | null {
  let eventId: DialogueEventId | null = null;
  if (incidentId === "bakery_fire" && actionId === "extinguish" && robotId === "aqua") eventId = "hydrant_broken";
  if (incidentId === "bridge_damage" && actionId === "build_bridge" && robotId === "fix") eventId = "high_water_bridge";
  if (incidentId === "bakery_fire" && actionId === "evacuate" && robotId === "buddy") eventId = "bakery_gas_info";
  if (state.wave >= 2 && actionId === "carry_parts" && robotId === "buddy") eventId = "buddy_priority";
  return eventId && !state.seenDialogues.includes(eventId) ? DIALOGUE_EVENTS[eventId] : null;
}

export function buildDialogueRequest(event: DialogueEventDefinition, state: RescueGameState) {
  return {
    speaker: event.speaker,
    personality: event.personality,
    situation: event.id,
    facts: {
      villagePreservation: state.villagePreservation,
      spreadSeconds: Math.ceil((state.selectedIncidentId ? state.incidents[state.selectedIncidentId].remainingSpreadMs : 0) / 1_000),
      wave: state.wave,
    },
    choiceIds: event.choices.map((choice) => choice.id),
    language: "ko",
  };
}
