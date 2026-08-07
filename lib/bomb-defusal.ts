export const BOMB_WIRES = ["red", "blue"] as const;
export type BombWire = (typeof BOMB_WIRES)[number];

export type BombHintRequest = {
  correctWire: BombWire;
  attempt: number;
  dangerLevel: 1 | 2 | 3;
  language: "ko";
};

export type BombHintResponse = {
  hint: string;
  source: "openai" | "fallback";
  degradedReason?: string;
  requestId?: string;
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

export function pickBombWire(seed: number, attempt: number): BombWire {
  const mixed = (Math.trunc(seed) ^ Math.imul(Math.max(1, Math.trunc(attempt)), 0x45d9f3b)) >>> 0;
  return BOMB_WIRES[mixed % BOMB_WIRES.length];
}

export function fallbackBombHint(correctWire: BombWire, attempt = 1, degradedReason?: string): BombHintResponse {
  const hints = FALLBACK_HINTS[correctWire];
  const hint = hints[(Math.max(1, Math.trunc(attempt)) - 1) % hints.length];
  return { hint, source: "fallback", ...(degradedReason ? { degradedReason } : {}) };
}

export function normalizeBombHint(value: unknown): { hint: string } | null {
  if (!value || typeof value !== "object") return null;
  const hint = (value as { hint?: unknown }).hint;
  if (typeof hint !== "string") return null;
  const normalized = hint.replace(/\s+/g, " ").trim();
  if (normalized.length < 10 || normalized.length > 140 || /[`*_#\[\]<>]/.test(normalized)) return null;
  return { hint: normalized };
}

export function buildBombHintRequest(correctWire: BombWire, attempt: number, dangerLevel: number): BombHintRequest {
  return {
    correctWire,
    attempt: Math.max(1, Math.min(99, Math.trunc(attempt))),
    dangerLevel: Math.max(1, Math.min(3, Math.trunc(dangerLevel))) as 1 | 2 | 3,
    language: "ko",
  };
}
