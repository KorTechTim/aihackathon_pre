export const MAP_WIDTH = 1280;
export const MAP_VIEWPORT_LEFT = 256;
export const MAP_VIEWPORT_RIGHT = 984;
export const MAP_VIEWPORT_WIDTH = MAP_VIEWPORT_RIGHT - MAP_VIEWPORT_LEFT;
export const MAP_PAN_MIN_X = MAP_VIEWPORT_RIGHT - MAP_WIDTH;
export const MAP_PAN_MAX_X = MAP_VIEWPORT_LEFT;

export function clampMapPanX(value: number): number {
  return Math.max(MAP_PAN_MIN_X, Math.min(MAP_PAN_MAX_X, Math.round(value)));
}

export function mapPanFromPointerDelta(startOffset: number, clientDeltaX: number, renderedViewportWidth: number): number {
  if (!Number.isFinite(renderedViewportWidth) || renderedViewportWidth <= 0) return clampMapPanX(startOffset);
  return clampMapPanX(startOffset + clientDeltaX * MAP_VIEWPORT_WIDTH / renderedViewportWidth);
}
