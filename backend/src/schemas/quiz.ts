export const QUIZ_INCIDENT_IDS = [
  "electrical_short", "bakery_fire", "gas_risk", "power_flood", "river_overflow",
  "bridge_damage", "resident_isolation", "house_fire", "cat_trapped", "east_residents",
  "suspicious_bomb",
] as const;
export const QUIZ_ACTION_IDS = [
  "cut_power", "evacuate", "shut_gas", "extinguish", "carry_parts", "repair_power",
  "lower_water", "build_bridge", "rescue_residents", "rescue_cat", "clear_debris", "firebreak",
  "defuse_bomb",
] as const;
export const QUIZ_ROBOT_IDS = ["aqua", "fix", "buddy"] as const;
export const QUIZ_OPTION_IDS = ["a", "b", "c"] as const;
export const QUIZ_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const QUIZ_FOCUSES = ["first_response", "hidden_hazard", "safe_sequence", "protective_setup", "evacuation", "communication", "post_check", "priority"] as const;
export const MAX_EXCLUDED_QUIZ_QUESTIONS = 48;
export const MAX_QUIZ_SEQUENCE = 10_000;

export type QuizIncidentId = (typeof QUIZ_INCIDENT_IDS)[number];
export type QuizActionId = (typeof QUIZ_ACTION_IDS)[number];
export type QuizOptionId = (typeof QUIZ_OPTION_IDS)[number];
export type QuizDifficulty = (typeof QUIZ_DIFFICULTIES)[number];
export type QuizFocus = (typeof QUIZ_FOCUSES)[number];

export type QuizInput = {
  incidentId: QuizIncidentId;
  incidentLabel: string;
  incidentType: string;
  actionId: QuizActionId;
  actionLabel: string;
  robotId: (typeof QUIZ_ROBOT_IDS)[number];
  wave: 1 | 2 | 3;
  severity: number;
  quizSequence: number;
  difficulty: QuizDifficulty;
  questionFocus: QuizFocus;
  variationSeed: number;
  excludedQuestions: string[];
  language: "ko";
};

export type QuizContent = {
  question: string;
  options: [{ id: QuizOptionId; label: string }, { id: QuizOptionId; label: string }, { id: QuizOptionId; label: string }];
  correctOptionId: QuizOptionId;
  explanation: string;
};

export type QuizResult = QuizContent & {
  source: "openai" | "fallback";
  degradedReason?: "OPENAI_NOT_CONFIGURED" | "OPENAI_UNAVAILABLE" | "INVALID_OPENAI_RESPONSE";
};

const fallback = (question: string, options: [string, string, string], correctOptionId: QuizOptionId, explanation: string): QuizContent => ({
  question,
  options: QUIZ_OPTION_IDS.map((id, index) => ({ id, label: options[index] })) as QuizContent["options"],
  correctOptionId,
  explanation,
});

export const FALLBACK_QUIZZES: Record<QuizIncidentId, QuizContent> = {
  electrical_short: fallback("끊어지거나 합선된 전선 주변에서 가장 먼저 해야 할 행동은 무엇일까요?", ["젖은 손으로 전선을 옮긴다", "접근을 막고 전원 차단을 요청한다", "불꽃이 사라질 때까지 가까이서 지켜본다"], "b", "감전 위험이 있으므로 먼저 거리를 확보하고 전원을 차단해야 합니다."),
  bakery_fire: fallback("전기 설비나 기름에서 시작된 불을 발견했을 때 안전한 대응은 무엇일까요?", ["무조건 물부터 붓는다", "창문을 모두 닫고 숨는다", "전원·가스를 차단하고 알맞은 소화기를 사용한다"], "c", "전기·기름 화재에 물을 쓰면 감전이나 불길 확산 위험이 있어 적합한 소화 방법이 필요합니다."),
  gas_risk: fallback("실내에서 가스 냄새가 강하게 날 때 가장 알맞은 행동은 무엇일까요?", ["전등 스위치를 켜서 확인한다", "불꽃으로 새는 곳을 찾는다", "스위치를 건드리지 않고 밸브를 잠근 뒤 환기한다"], "c", "작은 전기 불꽃도 폭발을 일으킬 수 있으므로 스위치를 조작하지 말고 가스를 차단해 환기해야 합니다."),
  power_flood: fallback("물이 찬 장소에 전기 설비가 있을 때 가장 안전한 행동은 무엇일까요?", ["물속 설비를 손으로 먼저 확인한다", "전원을 차단하기 전까지 물과 설비에 접근하지 않는다", "맨발로 들어가 플러그를 뽑는다"], "b", "침수된 전기 설비에는 감전 위험이 있으므로 안전하게 전원이 차단되기 전에는 접근하면 안 됩니다."),
  river_overflow: fallback("하천이 범람해 물살이 빠르게 흐를 때 올바른 대피 방법은 무엇일까요?", ["물길을 가로질러 지름길로 간다", "차량 안에서 수위가 내려가길 기다린다", "물가에서 멀어져 높은 곳으로 이동한다"], "c", "빠른 물살은 얕아 보여도 사람과 차량을 휩쓸 수 있어 높은 곳으로 대피해야 합니다."),
  bridge_damage: fallback("난간과 바닥이 파손된 다리를 발견했을 때 우선해야 할 조치는 무엇일까요?", ["사람의 진입을 막고 안전 점검을 요청한다", "한 명씩 빨리 건너게 한다", "파손 부위를 밟아 강도를 시험한다"], "a", "추가 붕괴를 막으려면 통행을 통제하고 전문가가 구조 안전성을 확인해야 합니다."),
  resident_isolation: fallback("재난으로 주민이 고립됐을 때 구조 전 가장 중요한 정보는 무엇일까요?", ["주민의 수와 위치, 부상 여부와 안전한 접근로", "주민이 좋아하는 음식", "가장 가까운 관광지 위치"], "a", "인원·정확한 위치·건강 상태·접근로를 알아야 구조 우선순위와 안전한 경로를 정할 수 있습니다."),
  house_fire: fallback("화재 연기가 찬 건물에서 대피할 때 올바른 자세는 무엇일까요?", ["서서 뛰며 크게 숨을 쉰다", "몸을 낮추고 젖은 천으로 코와 입을 가린다", "엘리베이터를 이용한다"], "b", "연기는 위로 모이므로 몸을 낮추고 호흡기를 보호하며 계단으로 대피해야 합니다."),
  cat_trapped: fallback("높고 불안정한 지붕에 동물이 고립됐을 때 안전한 방법은 무엇일까요?", ["보호 장비 없이 바로 지붕에 오른다", "동물이 뛰어내리도록 큰 소리를 낸다", "주변을 통제하고 안전 장비를 갖춘 구조를 요청한다"], "c", "사람과 동물 모두의 추락 위험을 줄이려면 현장을 통제하고 적절한 구조 장비를 사용해야 합니다."),
  east_residents: fallback("여러 주민을 한꺼번에 대피시킬 때 가장 알맞은 방법은 무엇일까요?", ["각자 빠른 길로 흩어져 이동한다", "안내에 따라 이동하고 어린이·노약자를 함께 돕는다", "짐을 모두 챙긴 뒤 마지막에 출발한다"], "b", "질서 있게 안내를 따르고 도움이 필요한 주민을 함께 살피면 추가 사고를 줄일 수 있습니다."),
  suspicious_bomb: fallback("수상한 장치를 발견했을 때 일반 주민이 가장 먼저 해야 할 행동은 무엇일까요?", ["가까이 가서 선을 확인한다", "주변 접근을 막고 안전거리를 둔 뒤 신고한다", "장치를 다른 곳으로 옮긴다"], "b", "수상한 장치는 만지거나 옮기지 말고 안전거리를 확보한 뒤 전문 인력에게 알려야 합니다."),
};

export const quizJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["question", "options", "correctOptionId", "explanation"],
  properties: {
    question: { type: "string", minLength: 10, maxLength: 120 },
    options: {
      type: "array", minItems: 3, maxItems: 3,
      items: {
        type: "object", additionalProperties: false, required: ["id", "label"],
        properties: { id: { type: "string", enum: [...QUIZ_OPTION_IDS] }, label: { type: "string", minLength: 2, maxLength: 80 } },
      },
    },
    correctOptionId: { type: "string", enum: [...QUIZ_OPTION_IDS] },
    explanation: { type: "string", minLength: 10, maxLength: 180 },
  },
} as const;

function cleanText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized && normalized.length <= maximum && !/[`*_#\[\]<>]/.test(normalized) ? normalized : null;
}

export function normalizeQuiz(value: unknown): QuizContent | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<QuizContent>;
  const question = cleanText(candidate.question, 120);
  const explanation = cleanText(candidate.explanation, 180);
  if (!question || !explanation || !Array.isArray(candidate.options) || candidate.options.length !== 3) return null;
  if (!QUIZ_OPTION_IDS.includes(candidate.correctOptionId as QuizOptionId)) return null;
  const options = candidate.options.map((item) => {
    if (!item || typeof item !== "object") return null;
    const id = (item as { id?: unknown }).id;
    const label = cleanText((item as { label?: unknown }).label, 80);
    return QUIZ_OPTION_IDS.includes(id as QuizOptionId) && label ? { id: id as QuizOptionId, label } : null;
  });
  if (options.some((item) => !item)) return null;
  const ids = options.map((item) => item!.id);
  if (new Set(ids).size !== 3 || !QUIZ_OPTION_IDS.every((id) => ids.includes(id))) return null;
  return { question, explanation, options: options as QuizContent["options"], correctOptionId: candidate.correctOptionId as QuizOptionId };
}

export function quizQuestionKey(question: string): string {
  return question.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}]+/gu, "");
}

function questionBigrams(question: string): Set<string> {
  const key = quizQuestionKey(question);
  const grams = new Set<string>();
  for (let index = 0; index < key.length - 1; index += 1) grams.add(key.slice(index, index + 2));
  return grams;
}

export function quizQuestionSimilarity(first: string, second: string): number {
  const firstKey = quizQuestionKey(first);
  const secondKey = quizQuestionKey(second);
  if (!firstKey || !secondKey) return 0;
  if (firstKey === secondKey) return 1;
  const firstGrams = questionBigrams(firstKey);
  const secondGrams = questionBigrams(secondKey);
  if (firstGrams.size === 0 || secondGrams.size === 0) return 0;
  let overlap = 0;
  firstGrams.forEach((gram) => { if (secondGrams.has(gram)) overlap += 1; });
  return overlap * 2 / (firstGrams.size + secondGrams.size);
}

export function isQuizQuestionExcluded(question: string, excludedQuestions: readonly string[]): boolean {
  const key = quizQuestionKey(question);
  return key.length > 0 && excludedQuestions.some((excluded) => {
    const excludedKey = quizQuestionKey(excluded);
    if (excludedKey === key) return true;
    const shorter = key.length <= excludedKey.length ? key : excludedKey;
    const longer = key.length > excludedKey.length ? key : excludedKey;
    return shorter.length >= 12 && longer.includes(shorter) || quizQuestionSimilarity(key, excludedKey) >= 0.68;
  });
}

export function fallbackQuiz(incidentId: QuizIncidentId, degradedReason: NonNullable<QuizResult["degradedReason"]>): QuizResult {
  return { ...FALLBACK_QUIZZES[incidentId], source: "fallback", degradedReason };
}
