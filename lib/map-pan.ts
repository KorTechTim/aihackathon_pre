export const MAP_WIDTH = 1280;
export const MAP_VIEWPORT_LEFT = 256;
export const MAP_VIEWPORT_RIGHT = 984;
export const MAP_VIEWPORT_WIDTH = MAP_VIEWPORT_RIGHT - MAP_VIEWPORT_LEFT;
export const MAP_PAN_MIN_X = MAP_VIEWPORT_RIGHT - MAP_WIDTH;
export const MAP_PAN_MAX_X = MAP_VIEWPORT_LEFT;
export const MAP_FOCUS_LEFT = MAP_VIEWPORT_LEFT + 48;
export const MAP_FOCUS_RIGHT = MAP_VIEWPORT_RIGHT - 48;

export function clampMapPanX(value: number): number {
  return Math.max(MAP_PAN_MIN_X, Math.min(MAP_PAN_MAX_X, Math.round(value)));
}

export function mapPanFromPointerDelta(startOffset: number, clientDeltaX: number, renderedViewportWidth: number): number {
  if (!Number.isFinite(renderedViewportWidth) || renderedViewportWidth <= 0) return clampMapPanX(startOffset);
  return clampMapPanX(startOffset + clientDeltaX * MAP_VIEWPORT_WIDTH / renderedViewportWidth);
}

export function revealMapAnchor(currentOffset: number, anchorX: number): number {
  const renderedX = anchorX + currentOffset;
  if (renderedX < MAP_FOCUS_LEFT) return clampMapPanX(currentOffset + MAP_FOCUS_LEFT - renderedX);
  if (renderedX > MAP_FOCUS_RIGHT) return clampMapPanX(currentOffset + MAP_FOCUS_RIGHT - renderedX);
  return clampMapPanX(currentOffset);
}
