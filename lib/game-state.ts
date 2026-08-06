export const INCIDENT_IDS = ["fire", "bridge", "cat", "generator"] as const;
export const ROBOT_IDS = ["aqua", "fix", "buddy"] as const;

export type IncidentId = (typeof INCIDENT_IDS)[number];
export type RobotId = (typeof ROBOT_IDS)[number];
export type FinishReason = "completed" | "timeout" | "abandoned" | "runtime_error";
export type Grade = "S" | "A" | "B" | "C" | "F";

export type RescueAssignment = {
  robot: RobotId;
  incidents: IncidentId[];
  reason: string;
};

export type RescuePlan = {
  summary: string;
  priority: IncidentId[];
  assignments: RescueAssignment[];
};

export type WorldSnapshot = {
  fireResolved: boolean;
  bridgeResolved: boolean;
  catResolved: boolean;
  generatorResolved: boolean;
  resolvedCount: number;
};

export type GameStats = {
  secondsRemaining: number;
  commandsUsed: number;
  completedIncidents: IncidentId[];
  rescuedCount: number;
  usedFallback: boolean;
  villagePreservation: number;
  grade: Grade;
};

const FIXED_INCIDENTS: Record<RobotId, IncidentId[]> = {
  aqua: ["fire"],
  fix: ["bridge", "generator"],
  buddy: ["cat"],
};

const FALLBACK_REASONS: Record<RobotId, string> = {
  aqua: "화재 진압과 냉각에 특화",
  fix: "시설과 전력 복구에 특화",
  buddy: "생명 구조와 안전 운반에 특화",
};

export const FALLBACK_PLAN: RescuePlan = {
  summary: "세 로봇의 전문 역할에 맞춰 안전한 기본 구조 작전을 준비했습니다.",
  priority: [...INCIDENT_IDS],
  assignments: ROBOT_IDS.map((robot) => ({
    robot,
    incidents: [...FIXED_INCIDENTS[robot]],
    reason: FALLBACK_REASONS[robot],
  })),
};

export function isIncidentId(value: unknown): value is IncidentId {
  return typeof value === "string" && INCIDENT_IDS.includes(value as IncidentId);
}

export function normalizePriority(input: unknown): IncidentId[] {
  const normalized: IncidentId[] = [];
  if (Array.isArray(input)) {
    for (const value of input) {
      if (isIncidentId(value) && !normalized.includes(value)) normalized.push(value);
    }
  }
  for (const incident of INCIDENT_IDS) {
    if (!normalized.includes(incident)) normalized.push(incident);
  }
  return normalized.slice(0, INCIDENT_IDS.length);
}

export function normalizeRescuePlan(input: unknown): RescuePlan | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<RescuePlan>;
  if (typeof candidate.summary !== "string" || !candidate.summary.trim()) return null;
  if (!Array.isArray(candidate.priority) || !Array.isArray(candidate.assignments)) return null;

  return {
    summary: candidate.summary.trim().slice(0, 90),
    priority: normalizePriority(candidate.priority),
    assignments: ROBOT_IDS.map((robot) => {
      const suggested = candidate.assignments?.find((assignment) => assignment?.robot === robot);
      return {
        robot,
        incidents: [...FIXED_INCIDENTS[robot]],
        reason: typeof suggested?.reason === "string" && suggested.reason.trim()
          ? suggested.reason.trim().slice(0, 55)
          : FALLBACK_REASONS[robot],
      };
    }),
  };
}

export function deriveWorldSnapshot(completed: Iterable<IncidentId>): WorldSnapshot {
  const completedSet = new Set(Array.from(completed).filter(isIncidentId));
  return {
    fireResolved: completedSet.has("fire"),
    bridgeResolved: completedSet.has("bridge"),
    catResolved: completedSet.has("cat"),
    generatorResolved: completedSet.has("generator"),
    resolvedCount: INCIDENT_IDS.reduce((count, incident) => count + Number(completedSet.has(incident)), 0),
  };
}

export function canComplete(completed: Iterable<IncidentId>): boolean {
  return deriveWorldSnapshot(completed).resolvedCount === INCIDENT_IDS.length;
}

export function isOperationCallbackAllowed(scheduledRunId: number, currentRunId: number, finished: boolean): boolean {
  return !finished && scheduledRunId === currentRunId;
}

export function calculateGameStats(input: {
  secondsRemaining: number;
  commandsUsed: number;
  completedIncidents: Iterable<IncidentId>;
  usedFallback: boolean;
  finishReason?: FinishReason | null;
}): GameStats {
  const rawCompleted = Array.from(input.completedIncidents).filter(isIncidentId);
  const completedSet = new Set(rawCompleted);
  const completedIncidents = normalizePriority(rawCompleted).filter((incident) => completedSet.has(incident));
  const resolvedCount = completedIncidents.length;
  const unresolvedCount = INCIDENT_IDS.length - resolvedCount;
  const commandPenalty = Math.max(0, input.commandsUsed - 3) * 2;
  let villagePreservation = Math.max(0, 100 - unresolvedCount * 18 - commandPenalty);
  if (input.finishReason === "timeout") villagePreservation = Math.min(villagePreservation, 49);

  let grade: Grade;
  if (input.finishReason === "abandoned" || input.finishReason === "runtime_error" || resolvedCount <= 1) grade = "F";
  else if (resolvedCount === 2) grade = "C";
  else if (resolvedCount === 3) grade = "B";
  else if (input.secondsRemaining >= 45 && input.commandsUsed <= 2) grade = "S";
  else grade = "A";

  return {
    secondsRemaining: Math.max(0, Math.min(90, Math.floor(input.secondsRemaining))),
    commandsUsed: Math.max(0, Math.floor(input.commandsUsed)),
    completedIncidents,
    rescuedCount: resolvedCount + Number(completedIncidents.includes("cat")),
    usedFallback: input.usedFallback,
    villagePreservation,
    grade,
  };
}
