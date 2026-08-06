export const INCIDENT_IDS = ["fire", "bridge", "cat", "generator"] as const;
export const ROBOT_IDS = ["aqua", "fix", "buddy"] as const;
export type IncidentId = (typeof INCIDENT_IDS)[number];
export type RobotId = (typeof ROBOT_IDS)[number];
export type PlanSource = "openai" | "fallback";

export type RescuePlan = {
  summary: string;
  priority: IncidentId[];
  assignments: Array<{ robot: RobotId; incidents: IncidentId[]; reason: string }>;
};

export type PlanResult = {
  plan: RescuePlan;
  source: PlanSource;
  degradedReason?: "OPENAI_NOT_CONFIGURED" | "OPENAI_UNAVAILABLE" | "INVALID_OPENAI_RESPONSE";
};

const fixedIncidents: Record<RobotId, IncidentId[]> = { aqua: ["fire"], fix: ["bridge", "generator"], buddy: ["cat"] };
const fallbackReasons: Record<RobotId, string> = {
  aqua: "화재 진압과 냉각에 특화된 소방 로봇",
  fix: "시설 복구와 전력 수리에 특화된 정비 로봇",
  buddy: "생명 구조와 안전 운반에 특화된 구조 로봇",
};

export const FALLBACK_PLAN: RescuePlan = {
  summary: "안전한 기본 구조 작전을 준비했습니다.",
  priority: [...INCIDENT_IDS],
  assignments: ROBOT_IDS.map((robot) => ({ robot, incidents: [...fixedIncidents[robot]], reason: fallbackReasons[robot] })),
};

export const planJsonSchema = {
  type: "object",
  properties: {
    summary: { type: "string", minLength: 1, maxLength: 90 },
    priority: { type: "array", minItems: 4, maxItems: 4, items: { type: "string", enum: INCIDENT_IDS } },
    assignments: {
      type: "array", minItems: 3, maxItems: 3,
      items: {
        type: "object",
        properties: {
          robot: { type: "string", enum: ROBOT_IDS },
          incidents: { type: "array", minItems: 1, maxItems: 2, items: { type: "string", enum: INCIDENT_IDS } },
          reason: { type: "string", minLength: 1, maxLength: 55 },
        },
        required: ["robot", "incidents", "reason"], additionalProperties: false,
      },
    },
  },
  required: ["summary", "priority", "assignments"], additionalProperties: false,
} as const;

export function normalizePriority(input: unknown): IncidentId[] {
  const result: IncidentId[] = [];
  if (Array.isArray(input)) {
    for (const value of input) if (INCIDENT_IDS.includes(value as IncidentId) && !result.includes(value as IncidentId)) result.push(value as IncidentId);
  }
  for (const incident of INCIDENT_IDS) if (!result.includes(incident)) result.push(incident);
  return result.slice(0, 4);
}

export function normalizePlan(input: unknown): RescuePlan | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<RescuePlan>;
  if (typeof candidate.summary !== "string" || !candidate.summary.trim() || !Array.isArray(candidate.priority) || !Array.isArray(candidate.assignments)) return null;
  return {
    summary: candidate.summary.trim().slice(0, 90),
    priority: normalizePriority(candidate.priority),
    assignments: ROBOT_IDS.map((robot) => {
      const suggested = candidate.assignments?.find((assignment) => assignment?.robot === robot);
      return { robot, incidents: [...fixedIncidents[robot]], reason: typeof suggested?.reason === "string" && suggested.reason.trim() ? suggested.reason.trim().slice(0, 55) : fallbackReasons[robot] };
    }),
  };
}
