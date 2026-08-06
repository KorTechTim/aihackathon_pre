import type { NpcDialogueId } from "./npc-dialogue";
import type { IncidentId, RobotId } from "./rescue-engine";

export const STAGE_MAP_IDS = ["day", "harbor", "highland", "canals", "railway", "rain", "night", "autumn", "winter"] as const;
export const STAGE_MAP_TOP = 64;
export const STAGE_MAP_SOURCE_HEIGHT = 544;
export const STAGE_MAP_VIEWPORT_HEIGHT = 720 - STAGE_MAP_TOP;
export const STAGE_MAP_SCALE_Y = STAGE_MAP_VIEWPORT_HEIGHT / STAGE_MAP_SOURCE_HEIGHT;
export type StageMapId = (typeof STAGE_MAP_IDS)[number];
export type StagePoint = readonly [number, number];
export type LegacyIncidentId = "fire" | "bridge" | "cat" | "generator";

export type StageMapDefinition = {
  id: StageMapId;
  label: string;
  file: string;
  layout: "classic" | "harbor" | "highland" | "canals" | "railway";
  robotStarts: Readonly<Record<RobotId, StagePoint>>;
  npcPositions: Readonly<Record<NpcDialogueId, StagePoint>>;
  incidentPositions: Readonly<Record<IncidentId, StagePoint>>;
  legacyTargets: Readonly<Record<LegacyIncidentId, StagePoint>>;
  routes?: Readonly<Partial<Record<IncidentId, readonly StagePoint[]>>>;
  legacyStructureOverlays: boolean;
};

export function stageMapScreenY(y: number): number {
  return Math.round(STAGE_MAP_TOP + (y - STAGE_MAP_TOP) * STAGE_MAP_SCALE_Y);
}

export function getIncidentPopupPosition(map: StageMapDefinition, incidentId: IncidentId): StagePoint {
  if (incidentId === "electrical_short") {
    const [generatorX, generatorY] = map.legacyTargets.generator;
    return [generatorX + 22, generatorY - 8];
  }
  return map.incidentPositions[incidentId];
}

const CLASSIC_ROBOT_STARTS = { aqua: [176, 496], fix: [208, 496], buddy: [240, 496] } as const;
const CLASSIC_NPCS = {
  npc_boram: [400, 360], npc_minsu: [546, 250], npc_hana: [720, 450], npc_duri: [930, 430],
} as const;
const CLASSIC_INCIDENTS = {
  electrical_short: [1144, 166], bakery_fire: [300, 252], gas_risk: [1210, 330], power_flood: [1010, 240],
  river_overflow: [790, 520], bridge_damage: [850, 350], resident_isolation: [600, 470], house_fire: [610, 220],
  cat_trapped: [496, 176], east_residents: [1110, 500],
} as const;
const CLASSIC_TARGETS = { fire: [300, 208], bridge: [848, 336], cat: [496, 176], generator: [992, 208] } as const;
const CLASSIC_ROUTES = {
  electrical_short: [[340, 450], [500, 370], [500, 280], [700, 280], [850, 310], [980, 280], [1080, 230], [1144, 166]],
  bakery_fire: [[340, 450], [470, 370], [430, 290], [330, 275], [300, 252]],
  gas_risk: [[340, 450], [520, 370], [700, 320], [850, 330], [1000, 330], [1210, 330]],
  power_flood: [[340, 450], [520, 370], [700, 300], [850, 310], [960, 280], [1010, 240]],
  river_overflow: [[340, 470], [500, 500], [650, 520], [790, 520]],
  bridge_damage: [[340, 450], [520, 370], [690, 330], [850, 350]],
  resident_isolation: [[340, 450], [470, 470], [600, 470]],
  house_fire: [[340, 450], [500, 370], [500, 280], [610, 220]],
  cat_trapped: [[340, 450], [500, 370], [500, 280], [496, 176]],
  east_residents: [[340, 450], [520, 370], [700, 320], [850, 330], [980, 380], [1050, 450], [1110, 500]],
} as const;

function classicMap(id: StageMapId, label: string, file: string): StageMapDefinition {
  return {
    id, label, file, layout: "classic",
    robotStarts: CLASSIC_ROBOT_STARTS,
    npcPositions: CLASSIC_NPCS,
    incidentPositions: CLASSIC_INCIDENTS,
    legacyTargets: CLASSIC_TARGETS,
    routes: CLASSIC_ROUTES,
    legacyStructureOverlays: true,
  };
}

export const STAGE_MAPS: readonly StageMapDefinition[] = [
  classicMap("day", "푸른 구조 마을", "pp_stage_01_preview.webp"),
  {
    id: "harbor", label: "바닷바람 항구 마을", file: "pp_stage_06_harbor.webp", layout: "harbor",
    robotStarts: { aqua: [205, 222], fix: [252, 222], buddy: [299, 222] },
    npcPositions: { npc_boram: [448, 330], npc_minsu: [735, 310], npc_hana: [858, 466], npc_duri: [1140, 355] },
    incidentPositions: {
      electrical_short: [1180, 150], bakery_fire: [945, 420], gas_risk: [1110, 482], power_flood: [1065, 225],
      river_overflow: [490, 542], bridge_damage: [688, 495], resident_isolation: [332, 420], house_fire: [790, 205],
      cat_trapped: [570, 190], east_residents: [850, 405],
    },
    legacyTargets: { fire: [945, 420], bridge: [688, 495], cat: [570, 190], generator: [1065, 225] },
    routes: {
      electrical_short: [[500, 230], [850, 190], [1050, 170], [1180, 150]],
      bakery_fire: [[410, 245], [610, 300], [790, 365], [945, 420]],
      gas_risk: [[500, 260], [760, 330], [960, 420], [1110, 482]],
      power_flood: [[420, 230], [720, 230], [950, 230], [1065, 225]],
      river_overflow: [[350, 300], [400, 420], [490, 542]],
      bridge_damage: [[410, 275], [540, 390], [688, 495]],
      resident_isolation: [[350, 300], [332, 420]],
      house_fire: [[480, 225], [650, 215], [790, 205]],
      cat_trapped: [[410, 230], [570, 190]],
      east_residents: [[450, 260], [650, 330], [850, 405]],
    },
    legacyStructureOverlays: false,
  },
  {
    id: "highland", label: "계단식 산악 마을", file: "pp_stage_07_highland.webp", layout: "highland",
    robotStarts: { aqua: [545, 222], fix: [595, 222], buddy: [645, 222] },
    npcPositions: { npc_boram: [725, 255], npc_minsu: [555, 385], npc_hana: [870, 420], npc_duri: [665, 505] },
    incidentPositions: {
      electrical_short: [215, 310], bakery_fire: [1020, 185], gas_risk: [1150, 255], power_flood: [135, 420],
      river_overflow: [330, 548], bridge_damage: [402, 402], resident_isolation: [710, 405], house_fire: [985, 445],
      cat_trapped: [1110, 345], east_residents: [805, 520],
    },
    legacyTargets: { fire: [1020, 185], bridge: [402, 402], cat: [1110, 345], generator: [135, 420] },
    routes: {
      electrical_short: [[500, 285], [350, 300], [215, 310]],
      bakery_fire: [[770, 250], [900, 215], [1020, 185]],
      gas_risk: [[800, 240], [980, 245], [1150, 255]],
      power_flood: [[500, 285], [350, 330], [220, 375], [135, 420]],
      river_overflow: [[500, 300], [420, 430], [330, 548]],
      bridge_damage: [[520, 295], [470, 355], [402, 402]],
      resident_isolation: [[620, 320], [710, 405]],
      house_fire: [[750, 310], [870, 390], [985, 445]],
      cat_trapped: [[800, 275], [950, 320], [1110, 345]],
      east_residents: [[650, 350], [720, 450], [805, 520]],
    },
    legacyStructureOverlays: false,
  },
  {
    id: "canals", label: "원형 운하 정원도시", file: "pp_stage_08_canals.webp", layout: "canals",
    robotStarts: { aqua: [578, 548], fix: [628, 548], buddy: [678, 548] },
    npcPositions: { npc_boram: [535, 330], npc_minsu: [745, 330], npc_hana: [835, 505], npc_duri: [820, 190] },
    incidentPositions: {
      electrical_short: [305, 150], bakery_fire: [1045, 170], gas_risk: [1170, 245], power_flood: [180, 245],
      river_overflow: [430, 380], bridge_damage: [640, 450], resident_isolation: [280, 500], house_fire: [1110, 500],
      cat_trapped: [995, 420], east_residents: [640, 320],
    },
    legacyTargets: { fire: [1045, 170], bridge: [640, 450], cat: [995, 420], generator: [180, 245] },
    routes: {
      electrical_short: [[520, 480], [430, 360], [350, 240], [305, 150]],
      bakery_fire: [[790, 510], [915, 390], [1010, 270], [1045, 170]],
      gas_risk: [[800, 500], [950, 380], [1080, 300], [1170, 245]],
      power_flood: [[520, 490], [420, 410], [300, 330], [180, 245]],
      river_overflow: [[540, 470], [430, 380]],
      bridge_damage: [[640, 490], [640, 450]],
      resident_isolation: [[500, 520], [280, 500]],
      house_fire: [[800, 520], [1110, 500]],
      cat_trapped: [[790, 500], [900, 455], [995, 420]],
      east_residents: [[640, 450], [640, 320]],
    },
    legacyStructureOverlays: false,
  },
  {
    id: "railway", label: "철교 산업 마을", file: "pp_stage_09_railway.webp", layout: "railway",
    robotStarts: { aqua: [165, 238], fix: [220, 238], buddy: [275, 238] },
    npcPositions: { npc_boram: [375, 335], npc_minsu: [600, 350], npc_hana: [920, 320], npc_duri: [325, 455] },
    incidentPositions: {
      electrical_short: [1160, 420], bakery_fire: [480, 185], gas_risk: [570, 260], power_flood: [1050, 505],
      river_overflow: [680, 535], bridge_damage: [805, 400], resident_isolation: [205, 485], house_fire: [835, 205],
      cat_trapped: [685, 185], east_residents: [600, 325],
    },
    legacyTargets: { fire: [480, 185], bridge: [805, 400], cat: [685, 185], generator: [1050, 505] },
    routes: {
      electrical_short: [[390, 320], [600, 350], [850, 380], [1160, 420]],
      bakery_fire: [[350, 250], [480, 185]],
      gas_risk: [[380, 260], [570, 260]],
      power_flood: [[390, 320], [600, 350], [800, 405], [1050, 505]],
      river_overflow: [[400, 340], [550, 450], [680, 535]],
      bridge_damage: [[420, 325], [620, 360], [805, 400]],
      resident_isolation: [[260, 330], [205, 485]],
      house_fire: [[400, 245], [600, 220], [835, 205]],
      cat_trapped: [[395, 245], [550, 210], [685, 185]],
      east_residents: [[380, 300], [600, 325]],
    },
    legacyStructureOverlays: false,
  },
  classicMap("rain", "폭우 구조 마을", "pp_stage_02_rain.webp"),
  classicMap("night", "야간 구조 마을", "pp_stage_03_night.webp"),
  classicMap("autumn", "가을 구조 마을", "pp_stage_04_autumn.webp"),
  classicMap("winter", "설원 구조 마을", "pp_stage_05_winter.webp"),
];

export function getStageMap(runIndex: number, wave: 1 | 2 | 3): StageMapDefinition {
  const normalizedRun = Number.isFinite(runIndex) ? Math.max(0, Math.floor(runIndex)) : 0;
  return STAGE_MAPS[(normalizedRun + wave - 1) % STAGE_MAPS.length];
}

export function getStageMapById(id: StageMapId): StageMapDefinition {
  return STAGE_MAPS.find((map) => map.id === id) ?? STAGE_MAPS[0];
}
