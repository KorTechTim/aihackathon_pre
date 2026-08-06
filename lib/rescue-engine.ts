export const ROBOT_IDS = ["aqua", "fix", "buddy"] as const;
export const INCIDENT_IDS = [
  "electrical_short",
  "bakery_fire",
  "gas_risk",
  "power_flood",
  "river_overflow",
  "bridge_damage",
  "resident_isolation",
  "house_fire",
  "cat_trapped",
  "east_residents",
] as const;

export const ACTION_IDS = [
  "cut_power",
  "evacuate",
  "shut_gas",
  "extinguish",
  "carry_parts",
  "repair_power",
  "lower_water",
  "build_bridge",
  "rescue_residents",
  "rescue_cat",
  "clear_debris",
  "firebreak",
] as const;

export type RobotId = (typeof ROBOT_IDS)[number];
export type IncidentId = (typeof INCIDENT_IDS)[number];
export type ActionId = (typeof ACTION_IDS)[number];
export type IncidentStatus = "hidden" | "warning" | "active" | "contained" | "resolved" | "failed";
export type RobotStatus = "idle" | "moving" | "working" | "waiting" | "disabled";
export type GameStatus = "playing" | "success" | "failure";
export type Grade = "S" | "A" | "B" | "C";

export type ActionDefinition = {
  id: ActionId;
  label: string;
  robotId: RobotId;
  durationMs: number;
  description: string;
};

export type IncidentDefinition = {
  id: IncidentId;
  label: string;
  shortLabel: string;
  type: string;
  nodeId: string;
  wave: 1 | 2 | 3;
  initialSeverity: number;
  maxSeverity: number;
  spreadAfterMs: number;
  spreadsTo: IncidentId[];
  allowedActions: ActionId[];
  requiredProgress: number;
  scoreValue: number;
  mapPosition: readonly [number, number];
  icon: "fire" | "bridge" | "cat" | "generator";
};

export type IncidentRuntime = {
  id: IncidentId;
  status: IncidentStatus;
  severity: number;
  progress: number;
  remainingSpreadMs: number;
  completedActions: ActionId[];
  spreadCount: number;
};

export type PendingAction = {
  incidentId: IncidentId;
  actionId: ActionId;
  remainingMs: number;
  totalMs: number;
};

export type RobotRuntime = {
  id: RobotId;
  status: RobotStatus;
  currentNodeId: string;
  targetNodeId?: string;
  currentAction?: ActionId;
  remainingActionMs?: number;
  energy: number;
  pendingAction?: PendingAction;
};

export type ActionRecord = {
  robotId: RobotId;
  incidentId: IncidentId;
  actionId: ActionId;
  completedAtMs: number;
};

export type ComboDefinition = {
  id: "power_cut_fire" | "evacuate_gas_fire" | "parts_repair" | "drain_bridge_rescue" | "clear_firebreak";
  label: string;
  sequence: Array<{ robotId: RobotId; actionId: ActionId }>;
  maxGapMs: number;
  scoreBonus: number;
};

export type GameLog = { id: number; atMs: number; tone: "info" | "warning" | "success"; message: string };

export type RescueGameState = {
  seed: number;
  status: GameStatus;
  finishReason?: "completed" | "timeout" | "village_lost" | "abandoned";
  elapsedMs: number;
  remainingMs: number;
  wave: 1 | 2 | 3;
  briefingMs: number;
  incidents: Record<IncidentId, IncidentRuntime>;
  robots: Record<RobotId, RobotRuntime>;
  actionHistory: ActionRecord[];
  foundCombos: ComboDefinition["id"][];
  comboStreak: number;
  maxCombo: number;
  lastComboAtMs?: number;
  score: number;
  villagePreservation: number;
  rescuedResidents: number;
  catRescued: boolean;
  preventedSpreads: number;
  seenDialogues: string[];
  selectedIncidentId: IncidentId | null;
  selectedRobotId: RobotId | null;
  comboBanner: string | null;
  comboBannerMs: number;
  logs: GameLog[];
  nextLogId: number;
};

export const GAME_DURATION_MS = 210_000;
export const WAVE_START_MS = [0, 65_000, 135_000] as const;
export const WAVE_LABELS = ["화재 기초", "폭우와 침수", "복합 재난"] as const;

export const ACTIONS: Record<ActionId, ActionDefinition> = {
  cut_power: { id: "cut_power", label: "전력 차단", robotId: "fix", durationMs: 6_000, description: "합선 전원을 차단해 화재 확산을 막습니다." },
  evacuate: { id: "evacuate", label: "주민 대피", robotId: "buddy", durationMs: 7_000, description: "위험 구역의 주민을 먼저 안전지대로 옮깁니다." },
  shut_gas: { id: "shut_gas", label: "가스 밸브 차단", robotId: "fix", durationMs: 6_000, description: "과열된 가스 설비를 잠가 폭발을 막습니다." },
  extinguish: { id: "extinguish", label: "화재 진압", robotId: "aqua", durationMs: 10_000, description: "물줄기로 불길을 진압합니다." },
  carry_parts: { id: "carry_parts", label: "수리 부품 운반", robotId: "buddy", durationMs: 7_000, description: "복구에 필요한 부품을 현장으로 운반합니다." },
  repair_power: { id: "repair_power", label: "발전 시설 복구", robotId: "fix", durationMs: 12_000, description: "침수된 전력 설비와 배수 펌프를 복구합니다." },
  lower_water: { id: "lower_water", label: "수위 감소", robotId: "aqua", durationMs: 10_000, description: "물을 분산 배출해 범람 수위를 낮춥니다." },
  build_bridge: { id: "build_bridge", label: "임시 다리 설치", robotId: "fix", durationMs: 10_000, description: "구조 통행로를 빠르게 확보합니다." },
  rescue_residents: { id: "rescue_residents", label: "고립 주민 구조", robotId: "buddy", durationMs: 7_000, description: "고립된 주민을 안전지대로 구조합니다." },
  rescue_cat: { id: "rescue_cat", label: "고양이 구조", robotId: "buddy", durationMs: 6_000, description: "옥상에 고립된 고양이를 구조합니다." },
  clear_debris: { id: "clear_debris", label: "장애물 제거", robotId: "fix", durationMs: 6_000, description: "방화선을 만들 공간을 확보합니다." },
  firebreak: { id: "firebreak", label: "주변 방화 처리", robotId: "aqua", durationMs: 8_000, description: "주변을 적셔 불길의 이동을 차단합니다." },
};

export const INCIDENTS: Record<IncidentId, IncidentDefinition> = {
  electrical_short: { id: "electrical_short", label: "전기 합선", shortLabel: "합선", type: "electrical", nodeId: "bakery_grid", wave: 1, initialSeverity: 2, maxSeverity: 3, spreadAfterMs: 18_000, spreadsTo: ["bakery_fire"], allowedActions: ["cut_power"], requiredProgress: 100, scoreValue: 100, mapPosition: [286, 166], icon: "generator" },
  bakery_fire: { id: "bakery_fire", label: "빵집 화재", shortLabel: "빵집", type: "fire", nodeId: "bakery", wave: 1, initialSeverity: 2, maxSeverity: 3, spreadAfterMs: 22_000, spreadsTo: ["gas_risk"], allowedActions: ["evacuate", "extinguish", "clear_debris", "firebreak"], requiredProgress: 100, scoreValue: 100, mapPosition: [318, 220], icon: "fire" },
  gas_risk: { id: "gas_risk", label: "가스 폭발 위험", shortLabel: "가스", type: "gas", nodeId: "bakery_gas", wave: 1, initialSeverity: 1, maxSeverity: 3, spreadAfterMs: 18_000, spreadsTo: ["house_fire"], allowedActions: ["shut_gas"], requiredProgress: 100, scoreValue: 100, mapPosition: [354, 274], icon: "fire" },
  power_flood: { id: "power_flood", label: "발전소 침수", shortLabel: "발전소", type: "flood", nodeId: "power_station", wave: 2, initialSeverity: 2, maxSeverity: 3, spreadAfterMs: 24_000, spreadsTo: ["river_overflow"], allowedActions: ["carry_parts", "repair_power"], requiredProgress: 100, scoreValue: 100, mapPosition: [946, 188], icon: "generator" },
  river_overflow: { id: "river_overflow", label: "하천 범람", shortLabel: "범람", type: "flood", nodeId: "river", wave: 2, initialSeverity: 1, maxSeverity: 3, spreadAfterMs: 20_000, spreadsTo: ["bridge_damage"], allowedActions: ["lower_water"], requiredProgress: 100, scoreValue: 100, mapPosition: [820, 472], icon: "generator" },
  bridge_damage: { id: "bridge_damage", label: "다리 파손", shortLabel: "다리", type: "bridge", nodeId: "bridge", wave: 2, initialSeverity: 2, maxSeverity: 3, spreadAfterMs: 22_000, spreadsTo: ["resident_isolation"], allowedActions: ["build_bridge"], requiredProgress: 100, scoreValue: 100, mapPosition: [848, 334], icon: "bridge" },
  resident_isolation: { id: "resident_isolation", label: "서쪽 주민 고립", shortLabel: "서쪽 주민", type: "rescue", nodeId: "west_house", wave: 2, initialSeverity: 1, maxSeverity: 3, spreadAfterMs: 26_000, spreadsTo: [], allowedActions: ["rescue_residents"], requiredProgress: 100, scoreValue: 100, mapPosition: [682, 378], icon: "cat" },
  house_fire: { id: "house_fire", label: "민가 확산 화재", shortLabel: "민가 화재", type: "fire", nodeId: "east_house", wave: 3, initialSeverity: 2, maxSeverity: 3, spreadAfterMs: 20_000, spreadsTo: ["east_residents"], allowedActions: ["clear_debris", "firebreak", "extinguish"], requiredProgress: 100, scoreValue: 100, mapPosition: [604, 210], icon: "fire" },
  cat_trapped: { id: "cat_trapped", label: "옥상 고양이 고립", shortLabel: "고양이", type: "rescue", nodeId: "cat_house", wave: 3, initialSeverity: 1, maxSeverity: 2, spreadAfterMs: 30_000, spreadsTo: [], allowedActions: ["rescue_cat"], requiredProgress: 100, scoreValue: 100, mapPosition: [496, 142], icon: "cat" },
  east_residents: { id: "east_residents", label: "동쪽 주민 고립", shortLabel: "동쪽 주민", type: "rescue", nodeId: "square", wave: 3, initialSeverity: 1, maxSeverity: 3, spreadAfterMs: 28_000, spreadsTo: [], allowedActions: ["rescue_residents"], requiredProgress: 100, scoreValue: 100, mapPosition: [942, 486], icon: "cat" },
};

export const COMBOS: readonly ComboDefinition[] = [
  { id: "power_cut_fire", label: "POWER CUT → SPLASH", sequence: [{ robotId: "fix", actionId: "cut_power" }, { robotId: "aqua", actionId: "extinguish" }], maxGapMs: 45_000, scoreBonus: 150 },
  { id: "evacuate_gas_fire", label: "SAFE EVAC TRINITY", sequence: [{ robotId: "buddy", actionId: "evacuate" }, { robotId: "fix", actionId: "shut_gas" }, { robotId: "aqua", actionId: "extinguish" }], maxGapMs: 35_000, scoreBonus: 150 },
  { id: "parts_repair", label: "PARTS EXPRESS", sequence: [{ robotId: "buddy", actionId: "carry_parts" }, { robotId: "fix", actionId: "repair_power" }], maxGapMs: 28_000, scoreBonus: 150 },
  { id: "drain_bridge_rescue", label: "RESCUE ROUTE OPEN", sequence: [{ robotId: "aqua", actionId: "lower_water" }, { robotId: "fix", actionId: "build_bridge" }, { robotId: "buddy", actionId: "rescue_residents" }], maxGapMs: 38_000, scoreBonus: 150 },
  { id: "clear_firebreak", label: "FIREBREAK WALL", sequence: [{ robotId: "fix", actionId: "clear_debris" }, { robotId: "aqua", actionId: "firebreak" }], maxGapMs: 26_000, scoreBonus: 150 },
] as const;

const WAVE_INCIDENTS: Record<1 | 2 | 3, IncidentId[]> = {
  1: ["electrical_short", "bakery_fire", "gas_risk"],
  2: ["power_flood", "river_overflow", "bridge_damage", "resident_isolation"],
  3: ["house_fire", "cat_trapped", "east_residents"],
};

const RESOLUTION_PATHS: Record<IncidentId, readonly (readonly ActionId[])[]> = {
  electrical_short: [["cut_power"]],
  bakery_fire: [["extinguish"]],
  gas_risk: [["shut_gas"]],
  power_flood: [["repair_power"]],
  river_overflow: [["lower_water"]],
  bridge_damage: [["build_bridge"]],
  resident_isolation: [["rescue_residents"]],
  house_fire: [["extinguish"], ["clear_debris", "firebreak"]],
  cat_trapped: [["rescue_cat"]],
  east_residents: [["rescue_residents"]],
};

function appendLog(state: RescueGameState, message: string, tone: GameLog["tone"] = "info"): void {
  state.logs = [...state.logs.slice(-5), { id: state.nextLogId, atMs: state.elapsedMs, tone, message }];
  state.nextLogId += 1;
}

function activateWave(state: RescueGameState, wave: 1 | 2 | 3): void {
  state.wave = wave;
  state.briefingMs = 2_500;
  WAVE_INCIDENTS[wave].forEach((id, index) => {
    const incident = state.incidents[id];
    if (incident.status === "hidden") incident.status = index === 0 || wave === 3 ? "active" : "warning";
  });
  appendLog(state, `WAVE ${wave} · ${WAVE_LABELS[wave - 1]} 브리핑`, "warning");
}

function cloneState(state: RescueGameState): RescueGameState {
  return {
    ...state,
    incidents: Object.fromEntries(INCIDENT_IDS.map((id) => [id, { ...state.incidents[id], completedActions: [...state.incidents[id].completedActions] }])) as Record<IncidentId, IncidentRuntime>,
    robots: Object.fromEntries(ROBOT_IDS.map((id) => [id, { ...state.robots[id], pendingAction: state.robots[id].pendingAction ? { ...state.robots[id].pendingAction } : undefined }])) as Record<RobotId, RobotRuntime>,
    actionHistory: [...state.actionHistory],
    foundCombos: [...state.foundCombos],
    seenDialogues: [...state.seenDialogues],
    logs: [...state.logs],
  };
}

export function createInitialGame(seed = 20260807): RescueGameState {
  const state: RescueGameState = {
    seed,
    status: "playing",
    elapsedMs: 0,
    remainingMs: GAME_DURATION_MS,
    wave: 1,
    briefingMs: 2_500,
    incidents: Object.fromEntries(INCIDENT_IDS.map((id) => [id, {
      id,
      status: "hidden" as IncidentStatus,
      severity: INCIDENTS[id].initialSeverity,
      progress: 0,
      remainingSpreadMs: INCIDENTS[id].spreadAfterMs,
      completedActions: [],
      spreadCount: 0,
    }])) as unknown as Record<IncidentId, IncidentRuntime>,
    robots: Object.fromEntries(ROBOT_IDS.map((id) => [id, { id, status: "idle" as RobotStatus, currentNodeId: "rescue_hq", energy: 100 }])) as Record<RobotId, RobotRuntime>,
    actionHistory: [],
    foundCombos: [],
    comboStreak: 0,
    maxCombo: 0,
    score: 0,
    villagePreservation: 100,
    rescuedResidents: 0,
    catRescued: false,
    preventedSpreads: 0,
    seenDialogues: [],
    selectedIncidentId: "electrical_short",
    selectedRobotId: null,
    comboBanner: null,
    comboBannerMs: 0,
    logs: [],
    nextLogId: 1,
  };
  WAVE_INCIDENTS[1].forEach((id, index) => { state.incidents[id].status = index === 0 ? "active" : "warning"; });
  appendLog(state, "빵집 전력망에서 합선 신호가 감지됐습니다.", "warning");
  return state;
}

function isResolvedStatus(status: IncidentStatus): boolean {
  return status === "resolved" || status === "contained";
}

export function getVisibleIncidents(state: RescueGameState): IncidentDefinition[] {
  return INCIDENT_IDS.filter((id) => state.incidents[id].status !== "hidden").map((id) => INCIDENTS[id]);
}

export function getAvailableActions(state: RescueGameState, incidentId: IncidentId, robotId?: RobotId | null): ActionDefinition[] {
  const incident = state.incidents[incidentId];
  if (state.status !== "playing" || incident.status === "hidden" || isResolvedStatus(incident.status)) return [];
  return INCIDENTS[incidentId].allowedActions
    .filter((id) => !incident.completedActions.includes(id))
    .map((id) => ACTIONS[id])
    .filter((action) => !robotId || action.robotId === robotId);
}

export function selectIncident(state: RescueGameState, incidentId: IncidentId): RescueGameState {
  if (state.incidents[incidentId].status === "hidden") return state;
  return { ...state, selectedIncidentId: incidentId, selectedRobotId: null };
}

export function selectRobot(state: RescueGameState, robotId: RobotId): RescueGameState {
  return { ...state, selectedRobotId: robotId };
}

export type ActionStartResult = { state: RescueGameState; ok: boolean; error?: string; durationMs?: number };

export function startAction(state: RescueGameState, incidentId: IncidentId, actionId: ActionId): ActionStartResult {
  const definition = ACTIONS[actionId];
  const incident = state.incidents[incidentId];
  const robot = state.robots[definition.robotId];
  if (state.status !== "playing") return { state, ok: false, error: "이미 종료된 작전입니다." };
  if (state.briefingMs > 0) return { state, ok: false, error: "브리핑이 끝난 뒤 출동할 수 있습니다." };
  if (!INCIDENTS[incidentId].allowedActions.includes(actionId) || incident.status === "hidden" || isResolvedStatus(incident.status)) return { state, ok: false, error: "이 사고에는 사용할 수 없는 행동입니다." };
  if (incident.completedActions.includes(actionId)) return { state, ok: false, error: "이미 완료한 행동입니다." };
  if (robot.status !== "idle") return { state, ok: false, error: `${robot.id.toUpperCase()}는 다른 임무를 수행 중입니다.` };

  const hasComboSetup = actionId === "repair_power" && incident.completedActions.includes("carry_parts");
  const durationMs = Math.round(definition.durationMs * (hasComboSetup ? 0.7 : 1));
  const next = cloneState(state);
  next.robots[definition.robotId] = {
    ...next.robots[definition.robotId],
    status: "moving",
    targetNodeId: INCIDENTS[incidentId].nodeId,
    currentAction: actionId,
    remainingActionMs: durationMs,
    pendingAction: { incidentId, actionId, remainingMs: durationMs, totalMs: durationMs },
  };
  next.selectedRobotId = definition.robotId;
  appendLog(next, `${definition.robotId.toUpperCase()} 출동 · ${INCIDENTS[incidentId].shortLabel} ${definition.label}`);
  return { state: next, ok: true, durationMs };
}

function resolveIncident(state: RescueGameState, incidentId: IncidentId): void {
  const incident = state.incidents[incidentId];
  if (isResolvedStatus(incident.status)) return;
  incident.status = "resolved";
  incident.progress = 100;
  state.score += INCIDENTS[incidentId].scoreValue;
  appendLog(state, `${INCIDENTS[incidentId].label} 해결 완료 +${INCIDENTS[incidentId].scoreValue}`, "success");
}

function detectCombo(state: RescueGameState): void {
  for (const combo of COMBOS) {
    if (state.foundCombos.includes(combo.id) || state.actionHistory.length < combo.sequence.length) continue;
    let matched = false;
    for (let start = 0; start < state.actionHistory.length && !matched; start += 1) {
      const first = state.actionHistory[start];
      if (first.robotId !== combo.sequence[0].robotId || first.actionId !== combo.sequence[0].actionId) continue;
      let prior = first;
      let cursor = start + 1;
      let sequenceIndex = 1;
      while (cursor < state.actionHistory.length && sequenceIndex < combo.sequence.length) {
        const record = state.actionHistory[cursor];
        const expected = combo.sequence[sequenceIndex];
        if (record.robotId === expected.robotId && record.actionId === expected.actionId) {
          if (record.completedAtMs - prior.completedAtMs > combo.maxGapMs) break;
          prior = record;
          sequenceIndex += 1;
        }
        cursor += 1;
      }
      matched = sequenceIndex === combo.sequence.length;
    }
    if (!matched) continue;
    state.foundCombos.push(combo.id);
    state.score += combo.scoreBonus;
    state.comboStreak = state.lastComboAtMs !== undefined && state.elapsedMs - state.lastComboAtMs <= 28_000 ? state.comboStreak + 1 : 1;
    state.maxCombo = Math.max(state.maxCombo, state.comboStreak);
    state.lastComboAtMs = state.elapsedMs;
    state.comboBanner = combo.label;
    state.comboBannerMs = 1_200;
    appendLog(state, `PERFECT COMBO · ${combo.label} +${combo.scoreBonus}`, "success");
  }
}

function completeAction(state: RescueGameState, robotId: RobotId): void {
  const robot = state.robots[robotId];
  const pending = robot.pendingAction;
  if (!pending) return;
  const incident = state.incidents[pending.incidentId];
  if (!incident.completedActions.includes(pending.actionId)) incident.completedActions.push(pending.actionId);
  state.actionHistory.push({ robotId, incidentId: pending.incidentId, actionId: pending.actionId, completedAtMs: state.elapsedMs });
  state.score += 20;

  if (pending.actionId === "evacuate") state.rescuedResidents += 3;
  if (pending.actionId === "rescue_residents") {
    state.rescuedResidents += pending.incidentId === "resident_isolation" ? 4 : 2;
    resolveIncident(state, pending.incidentId);
  }
  if (pending.actionId === "rescue_cat") {
    state.catRescued = true;
    state.score += 100;
    resolveIncident(state, pending.incidentId);
  }
  if (["cut_power", "shut_gas", "extinguish", "repair_power", "lower_water", "build_bridge"].includes(pending.actionId)) resolveIncident(state, pending.incidentId);
  if (pending.actionId === "firebreak" && incident.completedActions.includes("clear_debris")) resolveIncident(state, pending.incidentId);

  detectCombo(state);
  state.robots[robotId] = { ...robot, status: "idle", currentNodeId: INCIDENTS[pending.incidentId].nodeId, targetNodeId: undefined, currentAction: undefined, remainingActionMs: undefined, pendingAction: undefined, energy: Math.max(0, robot.energy - 8) };
}

function allIncidentsResolved(state: RescueGameState): boolean {
  return INCIDENT_IDS.every((id) => isResolvedStatus(state.incidents[id].status));
}

export function advanceGame(state: RescueGameState, rawDeltaMs: number, timerScale = 1): RescueGameState {
  if (state.status !== "playing" || rawDeltaMs <= 0) return state;
  const next = cloneState(state);
  const deltaMs = Math.min(2_000, rawDeltaMs) * Math.max(0, Math.min(4, timerScale));
  if (next.briefingMs > 0) {
    next.briefingMs = Math.max(0, next.briefingMs - deltaMs);
    return next;
  }

  next.elapsedMs += deltaMs;
  next.remainingMs = Math.max(0, GAME_DURATION_MS - next.elapsedMs);
  next.comboBannerMs = Math.max(0, next.comboBannerMs - deltaMs);
  if (next.comboBannerMs === 0) next.comboBanner = null;

  if (next.wave < 2 && next.elapsedMs >= WAVE_START_MS[1]) activateWave(next, 2);
  if (next.wave < 3 && next.elapsedMs >= WAVE_START_MS[2]) activateWave(next, 3);

  for (const robotId of ROBOT_IDS) {
    const robot = next.robots[robotId];
    if (!robot.pendingAction) continue;
    robot.pendingAction.remainingMs = Math.max(0, robot.pendingAction.remainingMs - deltaMs);
    robot.remainingActionMs = robot.pendingAction.remainingMs;
    robot.status = robot.pendingAction.remainingMs <= robot.pendingAction.totalMs * 0.72 ? "working" : "moving";
    if (robot.pendingAction.remainingMs === 0) completeAction(next, robotId);
  }

  for (const incidentId of INCIDENT_IDS) {
    const incident = next.incidents[incidentId];
    if (incident.status !== "active" && incident.status !== "failed") continue;
    incident.remainingSpreadMs = Math.max(0, incident.remainingSpreadMs - deltaMs);
    if (incident.remainingSpreadMs > 0) continue;
    incident.spreadCount += 1;
    incident.severity = Math.min(INCIDENTS[incidentId].maxSeverity, incident.severity + 1);
    incident.remainingSpreadMs = INCIDENTS[incidentId].spreadAfterMs;
    const preservationLoss = incident.severity >= INCIDENTS[incidentId].maxSeverity ? 14 : 8;
    next.villagePreservation = Math.max(0, next.villagePreservation - preservationLoss);
    next.score -= 100;
    if (incident.severity >= INCIDENTS[incidentId].maxSeverity) incident.status = "failed";
    INCIDENTS[incidentId].spreadsTo.forEach((targetId) => {
      const target = next.incidents[targetId];
      if (target.status === "hidden" || target.status === "warning") {
        target.status = "active";
        next.preventedSpreads = Math.max(0, next.preventedSpreads - 1);
      }
    });
    appendLog(next, `${INCIDENTS[incidentId].label} 확산! 마을 보존율 -${preservationLoss}`, "warning");
  }

  if (next.villagePreservation <= 0) {
    next.status = "failure";
    next.finishReason = "village_lost";
  } else if (next.remainingMs <= 0) {
    next.status = "failure";
    next.finishReason = "timeout";
  } else if (next.wave === 3 && allIncidentsResolved(next) && ROBOT_IDS.every((id) => next.robots[id].status === "idle")) {
    next.status = "success";
    next.finishReason = "completed";
    next.score += Math.floor(next.remainingMs / 1_000) * 10;
  }
  return next;
}

export function applyDialogueChoice(state: RescueGameState, dialogueId: string, choiceId: string): RescueGameState {
  if (state.seenDialogues.includes(dialogueId)) return state;
  const next = cloneState(state);
  next.seenDialogues.push(dialogueId);
  const beneficial = new Set(["protect_nearby_house", "wait_for_drain", "mark_gas_tank", "parts_first"]);
  if (beneficial.has(choiceId)) {
    next.villagePreservation = Math.min(100, next.villagePreservation + 3);
    next.score += 40;
    appendLog(next, "현장 정보 반영 · 안전 보너스 +40", "success");
  } else {
    next.score += 15;
    appendLog(next, "현장 판단을 작전에 반영했습니다.");
  }
  return next;
}

export function abandonGame(state: RescueGameState): RescueGameState {
  return { ...state, status: "failure", finishReason: "abandoned" };
}

export function getResolvedCount(state: RescueGameState): number {
  return INCIDENT_IDS.filter((id) => isResolvedStatus(state.incidents[id].status)).length;
}

export function getIncidentProgress(state: RescueGameState, incidentId: IncidentId): number {
  const incident = state.incidents[incidentId];
  if (isResolvedStatus(incident.status)) return 100;
  const pending = ROBOT_IDS.map((id) => state.robots[id].pendingAction).find((action) => action?.incidentId === incidentId);
  const progress = RESOLUTION_PATHS[incidentId].map((path) => {
    const completed = path.filter((actionId) => incident.completedActions.includes(actionId)).length;
    const partial = pending && path.includes(pending.actionId) ? 1 - pending.remainingMs / pending.totalMs : 0;
    return (completed + partial) / path.length * 100;
  });
  return Math.round(Math.max(0, ...progress));
}

export function getGrade(state: RescueGameState): Grade {
  if (state.villagePreservation >= 90 && state.rescuedResidents >= 9 && state.foundCombos.length >= 3) return "S";
  if (state.villagePreservation >= 75) return "A";
  if (state.villagePreservation >= 55) return "B";
  return "C";
}

export function formatGameTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
