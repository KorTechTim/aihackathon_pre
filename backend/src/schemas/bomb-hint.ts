export const BOMB_WIRES = ["red", "blue"] as const;
export type BombWire = (typeof BOMB_WIRES)[number];

export type BombHintInput = {
  correctWire: BombWire;
  attempt: number;
  dangerLevel: 1 | 2 | 3;
  language: "ko";
};

export type BombHintResult = {
  hint: string;
  source: "openai" | "fallback";
  degradedReason?: "OPENAI_NOT_CONFIGURED" | "OPENAI_UNAVAILABLE" | "INVALID_OPENAI_RESPONSE";
};

const FALLBACK_HINTS: Record<BombWire, readonly string[]> = {
  red: [
    "본부 AI 루나입니다. 소방차의 경광등처럼 뜨거운 색 신호가 오늘의 안전 회로예요!",
    "장미 한 송이가 구조 암호를 보냈어요. 바다보다 노을을 닮은 선에 답이 있습니다.",
    "FIX, 오늘은 토마토 신호가 씩 웃고 있어요. 차가운 파도 쪽은 건드리지 마세요!",
  ],
  blue: [
    "본부 AI 루나입니다. AQUA의 물빛처럼 차가운 색 신호가 안정 주파수에 맞아요!",
    "맑은 하늘이 구조 암호를 보냈어요. 노을보다 바다를 닮은 선에 답이 있습니다.",
    "FIX, 오늘은 파란 고래 신호가 윙크했어요. 뜨거운 경광등 쪽은 피하세요!",
  ],
};

export function fallbackBombHint(input: BombHintInput, degradedReason: NonNullable<BombHintResult["degradedReason"]>): BombHintResult {
  const hints = FALLBACK_HINTS[input.correctWire];
  return { hint: hints[(input.attempt - 1) % hints.length], source: "fallback", degradedReason };
}

export function normalizeBombHint(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const hint = (value as { hint?: unknown }).hint;
  if (typeof hint !== "string") return null;
  const normalized = hint.replace(/\s+/g, " ").trim();
  return normalized.length >= 10 && normalized.length <= 140 && !/[`*_#\[\]<>]/.test(normalized) ? normalized : null;
}

export const bombHintJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["hint"],
  properties: { hint: { type: "string", minLength: 10, maxLength: 140 } },
} as const;
