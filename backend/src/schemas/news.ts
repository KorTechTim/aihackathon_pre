export const NEWS_FINISH_REASONS = ["completed", "timeout", "village_lost", "abandoned"] as const;
export const NEWS_GRADES = ["S", "A", "B", "C"] as const;
export const NEWS_INCIDENT_LABELS = ["전기 합선", "빵집 화재", "가스 폭발 위험", "발전소 침수", "하천 범람", "다리 파손", "서쪽 주민 고립", "민가 확산 화재", "옥상 고양이 고립", "동쪽 주민 고립"] as const;
export const NEWS_COMBO_LABELS = ["POWER CUT → SPLASH", "SAFE EVAC TRINITY", "PARTS EXPRESS", "RESCUE ROUTE OPEN", "FIREBREAK WALL"] as const;
export const NEWS_INTERVIEWEES = {
  npc_boram: { name: "보람", role: "빵집 이웃 주민", traits: "씩씩하고 이웃을 먼저 걱정하며 짧고 힘 있게 말함" },
  npc_minsu: { name: "민수", role: "마을 설비 정비사", traits: "기계에 밝고 꼼꼼하며 위험 요소를 구체적으로 짚어 말함" },
  npc_hana: { name: "하나", role: "구조 자원봉사자", traits: "침착하고 다정하며 주민이 따라 하기 쉬운 안전 행동을 말함" },
  npc_duri: { name: "두리", role: "공원 관리인", traits: "마을 지형을 잘 알고 작은 변화를 빠르게 발견하며 희망적으로 말함" },
} as const;
export const NEWS_INTERVIEWEE_IDS = Object.keys(NEWS_INTERVIEWEES) as Array<keyof typeof NEWS_INTERVIEWEES>;

export type NewsInput = {
  status: "success" | "failure";
  finishReason: (typeof NEWS_FINISH_REASONS)[number];
  grade: (typeof NEWS_GRADES)[number];
  score: number;
  villagePreservation: number;
  rescuedResidents: number;
  resolvedIncidents: string[];
  unresolvedIncidents: string[];
  comboLabels: string[];
  maxCombo: number;
  remainingSeconds: number;
  catRescued: boolean;
  preventedSpreads: number;
  actionCount: number;
  intervieweeId: (typeof NEWS_INTERVIEWEE_IDS)[number];
  intervieweeName: string;
  intervieweeRole: string;
  intervieweeTraits: string;
  language: "ko";
};

export type NewsContent = { headline: string; article: string; interviewQuote: string };
export type NewsResult = NewsContent & {
  source: "openai" | "fallback";
  degradedReason?: "OPENAI_NOT_CONFIGURED" | "OPENAI_UNAVAILABLE" | "INVALID_OPENAI_RESPONSE";
};

export const newsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "article", "interviewQuote"],
  properties: {
    headline: { type: "string", minLength: 8, maxLength: 70 },
    article: { type: "string", minLength: 30, maxLength: 320 },
    interviewQuote: { type: "string", minLength: 10, maxLength: 160 },
  },
} as const;

function cleanText(value: unknown, minimum: number, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length >= minimum && normalized.length <= maximum && !/[`*_#\[\]<>]/.test(normalized) ? normalized : null;
}
export function normalizeNews(value: unknown): NewsContent | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<NewsContent>;
  const headline = cleanText(input.headline, 8, 70);
  const article = cleanText(input.article, 30, 320);
  const interviewQuote = cleanText(input.interviewQuote, 10, 160);
  return headline && article && interviewQuote ? { headline, article, interviewQuote } : null;
}

export function isNewsIntervieweeValid(input: NewsInput): boolean {
  const interviewee = NEWS_INTERVIEWEES[input.intervieweeId];
  return Boolean(interviewee)
    && input.intervieweeName === interviewee.name
    && input.intervieweeRole === interviewee.role
    && input.intervieweeTraits === interviewee.traits;
}

export function fallbackNews(input: NewsInput, degradedReason: NonNullable<NewsResult["degradedReason"]>): NewsResult {
  const success = input.status === "success";
  return {
    headline: success ? `구조 로봇 협동으로 마을 사고 ${input.resolvedIncidents.length}건 해결` : "긴급 구조 작전 종료, 남은 현장 점검 착수",
    article: success
      ? `구조대는 주민 ${input.rescuedResidents}명을 안전하게 대피시키고 마을 보존율 ${input.villagePreservation}%를 지켰다. 현장 기록에는 ${input.comboLabels.length}개의 협동 작전이 남았다.`
      : `이번 작전에서는 사고 ${input.resolvedIncidents.length}건을 해결하고 주민 ${input.rescuedResidents}명을 구조했다. 마을 보존율은 ${input.villagePreservation}%로 집계됐다.`,
    interviewQuote: success ? "구조대가 끝까지 주민들을 살펴줘서 든든했어요. 안전해진 길을 이웃들에게도 알려줄게요." : "아직 확인할 곳이 남아 있지만 모두 침착하게 움직였어요. 다음에는 더 안전하게 주민들을 안내하겠습니다.",
    source: "fallback",
    degradedReason,
  };
}
