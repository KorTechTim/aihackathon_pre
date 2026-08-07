import {
  ACTIONS,
  INCIDENTS,
  type ActionId,
  type IncidentId,
  type RescueGameState,
} from "./rescue-engine";

export const SAFETY_QUIZ_OPTION_IDS = ["a", "b", "c"] as const;
export type SafetyQuizOptionId = (typeof SAFETY_QUIZ_OPTION_IDS)[number];
export const SAFETY_QUIZ_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type SafetyQuizDifficulty = (typeof SAFETY_QUIZ_DIFFICULTIES)[number];
export const MAX_EXCLUDED_QUIZ_QUESTIONS = 24;

export type SafetyQuizOption = {
  id: SafetyQuizOptionId;
  label: string;
};

export type SafetyQuizContent = {
  question: string;
  options: [SafetyQuizOption, SafetyQuizOption, SafetyQuizOption];
  correctOptionId: SafetyQuizOptionId;
  explanation: string;
};

export type SafetyQuizRequest = {
  incidentId: IncidentId;
  incidentLabel: string;
  incidentType: string;
  actionId: ActionId;
  actionLabel: string;
  robotId: "aqua" | "fix" | "buddy";
  wave: 1 | 2 | 3;
  severity: number;
  quizSequence: number;
  difficulty: SafetyQuizDifficulty;
  excludedQuestions: string[];
  language: "ko";
};

export type SafetyQuizResponse = SafetyQuizContent & {
  source: "openai" | "fallback";
  degradedReason?: string;
  requestId?: string;
};

const quiz = (
  question: string,
  options: [string, string, string],
  correctOptionId: SafetyQuizOptionId,
  explanation: string,
): SafetyQuizContent => ({
  question,
  options: SAFETY_QUIZ_OPTION_IDS.map((id, index) => ({ id, label: options[index] })) as SafetyQuizContent["options"],
  correctOptionId,
  explanation,
});

export const FALLBACK_SAFETY_QUIZZES: Record<IncidentId, SafetyQuizContent> = {
  electrical_short: quiz(
    "끊어지거나 합선된 전선 주변에서 가장 먼저 해야 할 행동은 무엇일까요?",
    ["젖은 손으로 전선을 옮긴다", "접근을 막고 전원 차단을 요청한다", "불꽃이 사라질 때까지 가까이서 지켜본다"],
    "b",
    "감전 위험이 있으므로 먼저 거리를 확보하고 전원을 차단해야 합니다.",
  ),
  bakery_fire: quiz(
    "전기 설비나 기름에서 시작된 불을 발견했을 때 안전한 대응은 무엇일까요?",
    ["무조건 물부터 붓는다", "창문을 모두 닫고 숨는다", "전원·가스를 차단하고 알맞은 소화기를 사용한다"],
    "c",
    "전기·기름 화재에 물을 쓰면 감전이나 불길 확산 위험이 있어 적합한 소화 방법이 필요합니다.",
  ),
  gas_risk: quiz(
    "실내에서 가스 냄새가 강하게 날 때 가장 알맞은 행동은 무엇일까요?",
    ["전등 스위치를 켜서 확인한다", "불꽃으로 새는 곳을 찾는다", "스위치를 건드리지 않고 밸브를 잠근 뒤 환기한다"],
    "c",
    "작은 전기 불꽃도 폭발을 일으킬 수 있으므로 스위치를 조작하지 말고 가스를 차단해 환기해야 합니다.",
  ),
  power_flood: quiz(
    "물이 찬 장소에 전기 설비가 있을 때 가장 안전한 행동은 무엇일까요?",
    ["물속 설비를 손으로 먼저 확인한다", "전원을 차단하기 전까지 물과 설비에 접근하지 않는다", "맨발로 들어가 플러그를 뽑는다"],
    "b",
    "침수된 전기 설비에는 감전 위험이 있으므로 안전하게 전원이 차단되기 전에는 접근하면 안 됩니다.",
  ),
  river_overflow: quiz(
    "하천이 범람해 물살이 빠르게 흐를 때 올바른 대피 방법은 무엇일까요?",
    ["물길을 가로질러 지름길로 간다", "차량 안에서 수위가 내려가길 기다린다", "물가에서 멀어져 높은 곳으로 이동한다"],
    "c",
    "빠른 물살은 얕아 보여도 사람과 차량을 휩쓸 수 있어 높은 곳으로 대피해야 합니다.",
  ),
  bridge_damage: quiz(
    "난간과 바닥이 파손된 다리를 발견했을 때 우선해야 할 조치는 무엇일까요?",
    ["사람의 진입을 막고 안전 점검을 요청한다", "한 명씩 빨리 건너게 한다", "파손 부위를 밟아 강도를 시험한다"],
    "a",
    "추가 붕괴를 막으려면 통행을 통제하고 전문가가 구조 안전성을 확인해야 합니다.",
  ),
  resident_isolation: quiz(
    "재난으로 주민이 고립됐을 때 구조 전 가장 중요한 정보는 무엇일까요?",
    ["주민의 수와 위치, 부상 여부와 안전한 접근로", "주민이 좋아하는 음식", "가장 가까운 관광지 위치"],
    "a",
    "인원·정확한 위치·건강 상태·접근로를 알아야 구조 우선순위와 안전한 경로를 정할 수 있습니다.",
  ),
  house_fire: quiz(
    "화재 연기가 찬 건물에서 대피할 때 올바른 자세는 무엇일까요?",
    ["서서 뛰며 크게 숨을 쉰다", "몸을 낮추고 젖은 천으로 코와 입을 가린다", "엘리베이터를 이용한다"],
    "b",
    "연기는 위로 모이므로 몸을 낮추고 호흡기를 보호하며 계단으로 대피해야 합니다.",
  ),
  cat_trapped: quiz(
    "높고 불안정한 지붕에 동물이 고립됐을 때 안전한 방법은 무엇일까요?",
    ["보호 장비 없이 바로 지붕에 오른다", "동물이 뛰어내리도록 큰 소리를 낸다", "주변을 통제하고 안전 장비를 갖춘 구조를 요청한다"],
    "c",
    "사람과 동물 모두의 추락 위험을 줄이려면 현장을 통제하고 적절한 구조 장비를 사용해야 합니다.",
  ),
  east_residents: quiz(
    "여러 주민을 한꺼번에 대피시킬 때 가장 알맞은 방법은 무엇일까요?",
    ["각자 빠른 길로 흩어져 이동한다", "안내에 따라 이동하고 어린이·노약자를 함께 돕는다", "짐을 모두 챙긴 뒤 마지막에 출발한다"],
    "b",
    "질서 있게 안내를 따르고 도움이 필요한 주민을 함께 살피면 추가 사고를 줄일 수 있습니다.",
  ),
  suspicious_bomb: quiz(
    "수상한 장치를 발견했을 때 일반 주민이 가장 먼저 해야 할 행동은 무엇일까요?",
    ["가까이 가서 선을 확인한다", "주변 접근을 막고 안전거리를 둔 뒤 신고한다", "장치를 다른 곳으로 옮긴다"],
    "b",
    "수상한 장치는 만지거나 옮기지 말고 안전거리를 확보한 뒤 전문 인력에게 알려야 합니다.",
  ),
};

const ALTERNATE_FALLBACK_SAFETY_QUIZZES: Record<IncidentId, SafetyQuizContent> = {
  electrical_short: quiz(
    "전기가 흐를 수 있는 고장 전선 근처에서 안전거리를 두어야 하는 이유는 무엇일까요?",
    ["전선 색이 변할 수 있어서", "눈에 보이지 않는 전류로 감전될 수 있어서", "휴대전화 신호가 약해져서"],
    "b",
    "고장 전선은 겉으로 꺼져 보여도 전류가 흐를 수 있으므로 전원 차단 전에는 접근하지 않아야 합니다.",
  ),
  bakery_fire: quiz(
    "빵집 화재에서 소화기를 사용할 때 가장 먼저 확보해야 할 것은 무엇일까요?",
    ["등 뒤의 안전한 대피로", "불길 바로 옆의 사진 촬영 위치", "닫힌 창고 안쪽 공간"],
    "a",
    "불이 커질 경우 즉시 물러날 수 있도록 소화 전에 등 뒤의 안전한 대피로를 확보해야 합니다.",
  ),
  gas_risk: quiz(
    "가스 누출이 의심되는 공간에서 휴대전화 사용을 밖으로 나간 뒤 해야 하는 이유는 무엇일까요?",
    ["배터리를 아끼기 위해서", "작은 전기 불꽃이 점화를 일으킬 수 있어서", "통화 소리가 밸브를 열 수 있어서"],
    "b",
    "가스가 찬 공간에서는 전기기기의 작은 불꽃도 점화원이 될 수 있어 안전한 곳으로 이동한 뒤 사용해야 합니다.",
  ),
  power_flood: quiz(
    "침수된 전기 시설의 복구를 시작하기 전 확인 순서로 알맞은 것은 무엇일까요?",
    ["전원 차단 확인 후 물이 없는 안전 구역에서 점검", "물속에서 먼저 작동 시험", "젖은 장갑으로 차단기 조작"],
    "a",
    "전원이 확실히 차단됐는지 확인하고 물과 분리된 안전 구역에서 설비 상태를 점검해야 합니다.",
  ),
  river_overflow: quiz(
    "범람한 도로의 물 깊이를 알 수 없을 때 차량으로 통과하면 안 되는 이유는 무엇일까요?",
    ["차량 색이 흐려져서", "도로 유실과 급류 세기를 눈으로 판단하기 어려워서", "내비게이션이 느려져서"],
    "b",
    "범람수 아래의 도로 파손과 물살은 보이지 않으므로 차량도 쉽게 떠밀리거나 고립될 수 있습니다.",
  ),
  bridge_damage: quiz(
    "손상된 다리의 임시 통로를 열기 전에 반드시 확인해야 할 것은 무엇일까요?",
    ["통행 인원과 하중을 견디는지 안전 점검", "다리 주변의 관광 안내판", "가장 빠르게 달릴 수 있는 폭"],
    "a",
    "임시 통로도 예상 인원과 하중을 견딜 수 있는지 확인하고 통행을 통제해야 추가 붕괴를 막을 수 있습니다.",
  ),
  resident_isolation: quiz(
    "고립 주민 구조 순서를 정할 때 가장 먼저 보호해야 할 사람은 누구일까요?",
    ["짐이 가장 많은 사람", "즉시 치료가 필요하거나 스스로 이동하기 어려운 사람", "가장 큰 목소리로 부르는 사람"],
    "b",
    "부상자와 어린이·노약자처럼 위험이 크고 자력 대피가 어려운 사람을 우선해 구조해야 합니다.",
  ),
  house_fire: quiz(
    "민가 화재가 진압된 직후 주민이 바로 다시 들어가면 안 되는 이유는 무엇일까요?",
    ["소방 장비가 무거워 보여서", "재발화와 유독가스, 구조 붕괴 위험이 남아 있어서", "집 안이 어두울 수 있어서"],
    "b",
    "불꽃이 사라진 뒤에도 숨은 불씨와 유독가스, 약해진 구조물이 남을 수 있어 안전 확인이 필요합니다.",
  ),
  cat_trapped: quiz(
    "겁먹은 동물을 높은 곳에서 구조할 때 갑자기 쫓으면 안 되는 이유는 무엇일까요?",
    ["동물이 더 높은 곳이나 가장자리로 뛰어 추락할 수 있어서", "동물의 털 색이 바뀔 수 있어서", "구조 장비가 가벼워져서"],
    "a",
    "겁먹은 동물의 도주 방향을 예측하기 어려우므로 주변을 통제하고 천천히 접근해야 합니다.",
  ),
  east_residents: quiz(
    "여러 주민을 대피시킨 뒤 마지막으로 해야 할 확인은 무엇일까요?",
    ["각자 가져온 짐의 개수", "출발 인원과 도착 인원을 대조해 누락자를 찾는 일", "가장 먼저 도착한 사람의 이름"],
    "b",
    "대피 전후 인원을 대조해야 현장에 남거나 이동 중 이탈한 주민을 빠르게 확인할 수 있습니다.",
  ),
  suspicious_bomb: quiz(
    "수상한 장치 주변 통제선이 필요한 가장 중요한 이유는 무엇일까요?",
    ["구경하는 사람의 접근과 추가 위험을 막기 위해서", "장치 사진을 더 잘 찍기 위해서", "주변 차량을 빨리 통과시키기 위해서"],
    "a",
    "전문 인력이 확인하기 전까지 주변 접근을 통제해야 주민과 구조대의 추가 위험을 줄일 수 있습니다.",
  ),
};

const FALLBACK_SAFETY_QUIZZES_BY_ACTION: Partial<Record<IncidentId, Partial<Record<ActionId, SafetyQuizContent>>>> = {
  electrical_short: { cut_power: FALLBACK_SAFETY_QUIZZES.electrical_short },
  bakery_fire: {
    evacuate: quiz(
      "빵집 안에 연기가 차기 시작했다면 손님을 어느 방향으로 안내해야 할까요?",
      ["연기가 적고 불길과 반대인 비상구", "짐을 챙길 수 있는 창고", "엘리베이터가 있는 안쪽 통로"],
      "a",
      "불길과 연기를 피해 가장 가까운 안전한 비상구로 질서 있게 대피해야 합니다.",
    ),
    extinguish: FALLBACK_SAFETY_QUIZZES.bakery_fire,
    clear_debris: quiz(
      "화재 현장의 대피로에 상자와 잔해가 쌓였다면 먼저 어떻게 해야 할까요?",
      ["사람들이 잔해를 뛰어넘게 한다", "불길에서 먼 안전 구역부터 통로를 확보한다", "출입문을 잠가 이동을 막는다"],
      "b",
      "구조대의 진입과 주민 대피가 겹치지 않도록 안전 구역에서부터 통로를 확보해야 합니다.",
    ),
    firebreak: quiz(
      "불길이 옆 건물로 번질 위험이 있을 때 확산을 늦추는 방법은 무엇일까요?",
      ["가연물을 불길 가까이 모은다", "모든 창문을 열어 바람을 만든다", "주변 가연물을 치우고 안전거리를 만든다"],
      "c",
      "불길 주변의 연료가 될 물건을 제거해 안전거리를 만들면 화재 확산을 늦출 수 있습니다.",
    ),
  },
  gas_risk: { shut_gas: FALLBACK_SAFETY_QUIZZES.gas_risk },
  power_flood: {
    carry_parts: quiz(
      "침수된 발전소로 교체 부품을 옮길 때 확인할 조건을 고르세요.",
      ["전원 차단과 마른 운반 경로가 모두 확인됐다", "물이 얕아 보여 맨손으로 운반한다", "가장 짧은 물길을 따라 이동한다"],
      "a",
      "전기 설비 침수 현장에서는 전원 차단과 감전 위험이 없는 운반 경로를 함께 확인해야 합니다.",
    ),
    repair_power: FALLBACK_SAFETY_QUIZZES.power_flood,
  },
  river_overflow: { lower_water: FALLBACK_SAFETY_QUIZZES.river_overflow },
  bridge_damage: { build_bridge: FALLBACK_SAFETY_QUIZZES.bridge_damage },
  resident_isolation: { rescue_residents: FALLBACK_SAFETY_QUIZZES.resident_isolation },
  house_fire: {
    clear_debris: quiz(
      "불탄 민가의 잔해를 치우기 전에 함께 확인해야 할 사항은 무엇일까요?",
      ["외벽 색상과 집값", "불씨 재발화와 구조물 붕괴 위험", "가구를 옮길 순서만 확인"],
      "b",
      "화재 잔해에는 숨은 불씨와 약해진 구조물이 함께 있어 두 위험을 먼저 통제해야 합니다.",
    ),
    firebreak: quiz(
      "강풍 속 민가 화재가 번질 때 방화선을 만들 위치로 가장 적절한 곳은 어디일까요?",
      ["바람이 향하는 쪽의 가연물과 다음 건물 사이", "주민 대피로 한가운데", "가스통을 모아 둔 장소 주변"],
      "a",
      "풍향을 고려해 불길 진행 방향의 가연물을 제거하되 대피로와 위험물 주변은 피해야 합니다.",
    ),
    extinguish: FALLBACK_SAFETY_QUIZZES.house_fire,
  },
  cat_trapped: { rescue_cat: FALLBACK_SAFETY_QUIZZES.cat_trapped },
  east_residents: { rescue_residents: FALLBACK_SAFETY_QUIZZES.east_residents },
  suspicious_bomb: { defuse_bomb: FALLBACK_SAFETY_QUIZZES.suspicious_bomb },
};

function cleanText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized && normalized.length <= maximum && !/[`*_#\[\]<>]/.test(normalized) ? normalized : null;
}

export function normalizeSafetyQuiz(value: unknown): SafetyQuizContent | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SafetyQuizContent>;
  const question = cleanText(candidate.question, 120);
  const explanation = cleanText(candidate.explanation, 180);
  if (!question || !explanation || !Array.isArray(candidate.options) || candidate.options.length !== 3) return null;
  if (!SAFETY_QUIZ_OPTION_IDS.includes(candidate.correctOptionId as SafetyQuizOptionId)) return null;
  const options = candidate.options.map((option) => {
    if (!option || typeof option !== "object") return null;
    const id = (option as Partial<SafetyQuizOption>).id;
    const label = cleanText((option as Partial<SafetyQuizOption>).label, 80);
    return SAFETY_QUIZ_OPTION_IDS.includes(id as SafetyQuizOptionId) && label ? { id: id as SafetyQuizOptionId, label } : null;
  });
  if (options.some((option) => !option)) return null;
  const optionIds = options.map((option) => option!.id);
  if (new Set(optionIds).size !== 3 || !SAFETY_QUIZ_OPTION_IDS.every((id) => optionIds.includes(id))) return null;
  return { question, explanation, options: options as SafetyQuizContent["options"], correctOptionId: candidate.correctOptionId as SafetyQuizOptionId };
}

export function safetyQuizQuestionKey(question: string): string {
  return question.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}]+/gu, "");
}

export function isSafetyQuizQuestionExcluded(question: string, excludedQuestions: readonly string[]): boolean {
  const key = safetyQuizQuestionKey(question);
  return key.length > 0 && excludedQuestions.some((excluded) => safetyQuizQuestionKey(excluded) === key);
}

export function getSafetyQuizDifficulty(wave: 1 | 2 | 3, quizSequence: number): SafetyQuizDifficulty {
  const sequenceLevel = quizSequence >= 8 ? 3 : quizSequence >= 4 ? 2 : 1;
  const level = Math.max(wave, sequenceLevel);
  return level === 3 ? "hard" : level === 2 ? "medium" : "easy";
}

type SafetyQuizRequestOptions = {
  quizSequence?: number;
  excludedQuestions?: readonly string[];
};

export function buildSafetyQuizRequest(
  game: RescueGameState,
  incidentId: IncidentId,
  actionId: ActionId,
  options: SafetyQuizRequestOptions = {},
): SafetyQuizRequest {
  const incident = INCIDENTS[incidentId];
  const action = ACTIONS[actionId];
  const quizSequence = Math.max(1, Math.trunc(options.quizSequence ?? 1));
  const excludedQuestions = (options.excludedQuestions ?? [])
    .map((question) => question.replace(/\s+/g, " ").trim())
    .filter((question) => question.length >= 10 && question.length <= 120)
    .slice(-MAX_EXCLUDED_QUIZ_QUESTIONS);
  return {
    incidentId,
    incidentLabel: incident.label,
    incidentType: incident.type,
    actionId,
    actionLabel: action.label,
    robotId: action.robotId,
    wave: game.wave,
    severity: game.incidents[incidentId].severity,
    quizSequence,
    difficulty: getSafetyQuizDifficulty(game.wave, quizSequence),
    excludedQuestions,
    language: "ko",
  };
}

type FallbackSafetyQuizOptions = {
  actionId?: ActionId;
  excludedQuestions?: readonly string[];
  degradedReason?: string;
  quizSequence?: number;
};

export function fallbackSafetyQuiz(incidentId: IncidentId, options: FallbackSafetyQuizOptions = {}): SafetyQuizResponse {
  const preferred = options.actionId ? FALLBACK_SAFETY_QUIZZES_BY_ACTION[incidentId]?.[options.actionId] : undefined;
  const candidates = [preferred, FALLBACK_SAFETY_QUIZZES[incidentId], ALTERNATE_FALLBACK_SAFETY_QUIZZES[incidentId]]
    .filter((candidate, index, all): candidate is SafetyQuizContent => Boolean(candidate) && all.indexOf(candidate) === index);
  const unused = candidates.find((candidate) => !isSafetyQuizQuestionExcluded(candidate.question, options.excludedQuestions ?? []));
  const selected = unused ?? {
    ...candidates[0],
    question: `${Math.max(1, Math.trunc(options.quizSequence ?? 1))}단계 ${ACTIONS[options.actionId ?? INCIDENTS[incidentId].allowedActions[0]].label} 안전 확인: ${candidates[0].question}`.slice(0, 120),
  };
  return { ...selected, source: "fallback", ...(options.degradedReason ? { degradedReason: options.degradedReason } : {}) };
}
