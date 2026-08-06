export const EVENT_DIALOGUE_SITUATIONS = ["hydrant_broken", "high_water_bridge", "bakery_gas_info", "buddy_priority"] as const;
export const NPC_DIALOGUE_SITUATIONS = ["npc_boram", "npc_minsu", "npc_hana", "npc_duri"] as const;
export const DIALOGUE_SITUATIONS = [...EVENT_DIALOGUE_SITUATIONS, ...NPC_DIALOGUE_SITUATIONS] as const;
export type DialogueSituation = (typeof DIALOGUE_SITUATIONS)[number];

export type DialogueInput = {
  speaker: "AQUA" | "FIX" | "BUDDY" | "주민";
  personality: string;
  situation: DialogueSituation;
  facts: Record<string, string | number | boolean>;
  choiceIds: string[];
  language: "ko";
};

export type DialogueResult = {
  dialogue: string;
  source: "openai" | "fallback";
  degradedReason?: "OPENAI_NOT_CONFIGURED" | "OPENAI_UNAVAILABLE" | "INVALID_OPENAI_RESPONSE";
};

export const FALLBACK_DIALOGUE: Record<DialogueSituation, string> = {
  hydrant_broken: "소화전 수압이 부족해요. 남은 물로 진압하거나 주변 민가부터 보호할 수 있어요.",
  high_water_bridge: "수위가 아직 높습니다. 지금 설치하면 빠르지만 안전 여유가 적어요. 어떤 방식으로 진행할까요?",
  bakery_gas_info: "오븐 옆에 예비 가스통이 있어요! FIX가 위치를 알면 안전하게 차단할 수 있어요.",
  buddy_priority: "발전소 부품과 고립 주민 신호가 동시에 잡혔어요. 먼저 맡을 임무를 정해주세요!",
  npc_boram: "구조대가 왔으니 마음이 놓여요. 저는 이웃들에게 안전한 길을 알려줄게요!",
  npc_minsu: "전력선과 배수 장치를 계속 확인 중입니다. 번쩍이는 설비에는 가까이 가지 마세요.",
  npc_hana: "천천히 숨을 고르고 구조대 안내를 따라주세요. 제가 뒤처진 주민을 살펴볼게요.",
  npc_duri: "강물과 다리 상태를 계속 보고 있어요. 안전한 길이 열리면 바로 모두에게 알릴게요!",
};

export function isNpcDialogueSituation(situation: DialogueSituation): boolean {
  return NPC_DIALOGUE_SITUATIONS.includes(situation as (typeof NPC_DIALOGUE_SITUATIONS)[number]);
}

export const dialogueJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["dialogue"],
  properties: { dialogue: { type: "string", minLength: 1, maxLength: 160 } },
} as const;

export function normalizeDialogue(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const dialogue = (value as { dialogue?: unknown }).dialogue;
  if (typeof dialogue !== "string") return null;
  const normalized = dialogue.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 160 || /[`*_#\[\]<>]/.test(normalized)) return null;
  return normalized;
}

export function fallbackDialogue(situation: DialogueSituation, degradedReason: NonNullable<DialogueResult["degradedReason"]>): DialogueResult {
  return { dialogue: FALLBACK_DIALOGUE[situation], source: "fallback", degradedReason };
}
