import { NPC_DIALOGUES, type NpcDialogueId } from "./npc-dialogue";
import { COMBOS, INCIDENTS, INCIDENT_IDS, getGrade, getResolvedCount, type RescueGameState } from "./rescue-engine";

export type ResultNewsRequest = {
  status: "success" | "failure";
  finishReason: "completed" | "timeout" | "village_lost" | "abandoned";
  grade: "S" | "A" | "B" | "C";
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
  intervieweeId: NpcDialogueId;
  intervieweeName: string;
  intervieweeRole: string;
  intervieweeTraits: string;
  language: "ko";
};

export type ResultNewsContent = {
  headline: string;
  article: string;
  interviewQuote: string;
};

export type ResultNewsResponse = ResultNewsContent & {
  source: "openai" | "fallback";
  degradedReason?: string;
  requestId?: string;
};

function chooseInterviewee(game: RescueGameState): NpcDialogueId {
  if (game.status === "success") return game.rescuedResidents >= 7 ? "npc_hana" : "npc_boram";
  if (game.finishReason === "timeout") return "npc_duri";
  if (game.finishReason === "village_lost") return "npc_hana";
  return "npc_minsu";
}
export function buildResultNewsRequest(game: RescueGameState): ResultNewsRequest {
  const intervieweeId = chooseInterviewee(game);
  const interviewee = NPC_DIALOGUES[intervieweeId];
  const resolvedIncidents = INCIDENT_IDS.filter((id) => ["resolved", "contained"].includes(game.incidents[id].status));
  return {
    status: game.status === "success" ? "success" : "failure",
    finishReason: game.finishReason ?? (game.status === "success" ? "completed" : "abandoned"),
    grade: getGrade(game),
    score: Math.max(-5_000, Math.min(100_000, Math.trunc(game.score))),
    villagePreservation: Math.max(0, Math.min(100, Math.trunc(game.villagePreservation))),
    rescuedResidents: Math.max(0, Math.min(50, Math.trunc(game.rescuedResidents))),
    resolvedIncidents: resolvedIncidents.map((id) => INCIDENTS[id].label),
    unresolvedIncidents: INCIDENT_IDS.filter((id) => !resolvedIncidents.includes(id)).map((id) => INCIDENTS[id].label),
    comboLabels: game.foundCombos.map((id) => COMBOS.find((combo) => combo.id === id)?.label).filter((label): label is string => Boolean(label)),
    maxCombo: Math.max(0, Math.min(10, Math.trunc(game.maxCombo))),
    remainingSeconds: Math.max(0, Math.min(210, Math.ceil(game.remainingMs / 1_000))),
    catRescued: game.catRescued,
    preventedSpreads: Math.max(0, Math.min(20, Math.trunc(game.preventedSpreads))),
    actionCount: Math.max(0, Math.min(40, game.actionHistory.length)),
    intervieweeId,
    intervieweeName: interviewee.name,
    intervieweeRole: interviewee.role,
    intervieweeTraits: interviewee.characterTraits,
    language: "ko",
  };
}

function cleanText(value: unknown, minimum: number, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length >= minimum && normalized.length <= maximum && !/[`*_#\[\]<>]/.test(normalized) ? normalized : null;
}

export function normalizeResultNews(value: unknown): ResultNewsContent | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<ResultNewsContent>;
  const headline = cleanText(input.headline, 8, 70);
  const article = cleanText(input.article, 30, 320);
  const interviewQuote = cleanText(input.interviewQuote, 10, 160);
  return headline && article && interviewQuote ? { headline, article, interviewQuote } : null;
}

export function fallbackResultNews(input: ResultNewsRequest, degradedReason?: string): ResultNewsResponse {
  const success = input.status === "success";
  const headline = success
    ? `구조 로봇 협동으로 마을 사고 ${input.resolvedIncidents.length}건 해결`
    : input.finishReason === "timeout" ? "구조 시간 종료, 마을 복구 작전 계속" : "긴급 구조 작전 종료, 남은 현장 점검 착수";
  const article = success
    ? `구조대는 주민 ${input.rescuedResidents}명을 안전하게 대피시키고 마을 보존율 ${input.villagePreservation}%를 지켰다. ${input.comboLabels.length > 0 ? `현장에서는 ${input.comboLabels.length}개의 협동 작전도 확인됐다.` : "각 로봇은 현장 상황에 맞춰 구조 임무를 수행했다."}`
    : `이번 작전에서는 사고 ${input.resolvedIncidents.length}건을 해결하고 주민 ${input.rescuedResidents}명을 구조했다. 마을 보존율은 ${input.villagePreservation}%로 집계됐으며 구조대는 남은 위험 지역의 후속 점검을 준비하고 있다.`;
  const interviewQuote = success
    ? `구조대가 끝까지 주민들을 살펴줘서 든든했어요. 안전해진 길을 이웃들에게도 알려줄게요.`
    : `아직 확인할 곳이 남아 있지만 모두 침착하게 움직였어요. 다음 작전에서는 더 안전하게 주민들을 안내하겠습니다.`;
  return { headline, article, interviewQuote, source: "fallback", ...(degradedReason ? { degradedReason } : {}) };
}

export function getResultNewsInterviewee(input: ResultNewsRequest) {
  return NPC_DIALOGUES[input.intervieweeId];
}
