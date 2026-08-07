import assert from "node:assert/strict";
import test from "node:test";
import {
  CAT_WARNING_MS,
  clampCatRobotX,
  getCatRoamDuration,
  getFallingCatY,
  getRoamingCatX,
  isCatCaught,
} from "./cat-rescue-minigame";

test("고양이는 지붕 안전 범위 안에서 불규칙하게 움직인다", () => {
  const positions = Array.from({ length: 20 }, (_, index) => getRoamingCatX(20260807, index * 240));
  assert.equal(positions.every((position) => position >= 15 && position <= 85), true);
  assert.equal(new Set(positions.map((position) => Math.round(position))).size > 8, true);
  assert.equal(getCatRoamDuration(20260807) >= 3_200, true);
  assert.equal(CAT_WARNING_MS, 1_000);
});

test("낙하 위치와 쿠션 중심이 겹칠 때만 구조 성공이다", () => {
  assert.equal(isCatCaught(47, 52), true);
  assert.equal(isCatCaught(47, 58), false);
  assert.equal(clampCatRobotX(-20), 15);
  assert.equal(clampCatRobotX(120), 85);
  assert.equal(getFallingCatY(0), 31);
  assert.equal(getFallingCatY(1), 83);
});
