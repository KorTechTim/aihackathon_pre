import assert from "node:assert/strict";
import test from "node:test";
import {
  MAP_PAN_MAX_X,
  MAP_PAN_MIN_X,
  clampMapPanX,
  mapPanFromPointerDelta,
  revealMapAnchor,
} from "./map-pan";

test("지도 이동은 양쪽 메뉴 안쪽에서 정확히 멈춘다", () => {
  assert.equal(MAP_PAN_MIN_X, -296);
  assert.equal(MAP_PAN_MAX_X, 256);
  assert.equal(clampMapPanX(-999), MAP_PAN_MIN_X);
  assert.equal(clampMapPanX(999), MAP_PAN_MAX_X);
});

test("축소된 화면의 포인터 이동을 1280 스테이지 좌표로 환산한다", () => {
  assert.equal(mapPanFromPointerDelta(0, 100, 364), 200);
  assert.equal(mapPanFromPointerDelta(100, -50, 364), 0);
  assert.equal(mapPanFromPointerDelta(10, 50, 0), 10);
});

test("메뉴 뒤의 사고를 선택하면 지도 안전 영역 안으로 이동한다", () => {
  assert.equal(revealMapAnchor(0, 1144), -208);
  assert.equal(revealMapAnchor(0, 300), 4);
  assert.equal(revealMapAnchor(-120, 600), -120);
  assert.equal(revealMapAnchor(-296, 300), 4);
});
