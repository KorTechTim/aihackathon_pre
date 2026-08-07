export const CAT_ROOF_MIN_X = 15;
export const CAT_ROOF_MAX_X = 85;
export const CAT_ROAM_MIN_MS = 3_200;
export const CAT_ROAM_VARIANCE_MS = 1_200;
export const CAT_WARNING_MS = 1_000;
export const CAT_FALL_MS = 820;
export const CAT_CATCH_HALF_WIDTH = 10;
export const CAT_ROBOT_STEP = 8;

export function clampCatRobotX(value: number): number {
  return Math.max(CAT_ROOF_MIN_X, Math.min(CAT_ROOF_MAX_X, value));
}

export function getCatRoamDuration(seed: number): number {
  return CAT_ROAM_MIN_MS + Math.abs(Math.trunc(seed)) % CAT_ROAM_VARIANCE_MS;
}

export function getRoamingCatX(seed: number, elapsedMs: number): number {
  const phase = Math.abs(Math.trunc(seed)) % 628 / 100;
  const primary = Math.sin(elapsedMs / 530 + phase) * 26;
  const secondary = Math.sin(elapsedMs / 211 + phase * 1.7) * 8;
  return clampCatRobotX(50 + primary + secondary);
}

export function getFallingCatY(progress: number): number {
  const normalized = Math.max(0, Math.min(1, progress));
  return 31 + normalized * normalized * 52;
}

export function isCatCaught(catX: number, robotX: number, halfWidth = CAT_CATCH_HALF_WIDTH): boolean {
  return Math.abs(catX - robotX) <= halfWidth;
}
