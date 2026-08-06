import assert from "node:assert/strict";
import { chromium } from "playwright";
import { collectPageErrors, fulfillDialogue, performAction } from "./qa_helpers.mjs";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = collectPageErrors(page);
await page.route("**/api/dialogue", (route) => fulfillDialogue(route, "openai"));
await page.goto(`${baseUrl}/?screen=play&skipBriefing=1&qaAll=1&tickScale=4`, { waitUntil: "networkidle" });
await page.locator("canvas").waitFor();

const actions = [
  { incidentName: "전기 합선", incidentId: "electrical_short", robot: "FIX", actionName: "전력 차단", actionId: "cut_power" },
  { incidentName: "빵집 화재", incidentId: "bakery_fire", robot: "BUDDY", actionName: "주민 대피", actionId: "evacuate", dialogueChoice: "가스통 위치를 FIX에 공유" },
  { incidentName: "가스 폭발 위험", incidentId: "gas_risk", robot: "FIX", actionName: "가스 밸브 차단", actionId: "shut_gas" },
  { incidentName: "빵집 화재", incidentId: "bakery_fire", robot: "AQUA", actionName: "화재 진압", actionId: "extinguish", dialogueChoice: "민가 방화부터 진행" },
  { incidentName: "발전소 침수", incidentId: "power_flood", robot: "BUDDY", actionName: "수리 부품 운반", actionId: "carry_parts", dialogueChoice: "부품을 먼저 운반" },
  { incidentName: "발전소 침수", incidentId: "power_flood", robot: "FIX", actionName: "발전 시설 복구", actionId: "repair_power" },
  { incidentName: "하천 범람", incidentId: "river_overflow", robot: "AQUA", actionName: "수위 감소", actionId: "lower_water" },
  { incidentName: "다리 파손", incidentId: "bridge_damage", robot: "FIX", actionName: "임시 다리 설치", actionId: "build_bridge", dialogueChoice: "AQUA의 배수를 먼저 확인" },
  { incidentName: "서쪽 주민 고립", incidentId: "resident_isolation", robot: "BUDDY", actionName: "고립 주민 구조", actionId: "rescue_residents" },
  { incidentName: "민가 확산 화재", incidentId: "house_fire", robot: "FIX", actionName: "장애물 제거", actionId: "clear_debris" },
  { incidentName: "민가 확산 화재", incidentId: "house_fire", robot: "AQUA", actionName: "주변 방화 처리", actionId: "firebreak" },
  { incidentName: "옥상 고양이 고립", incidentId: "cat_trapped", robot: "BUDDY", actionName: "고양이 구조", actionId: "rescue_cat" },
  { incidentName: "동쪽 주민 고립", incidentId: "east_residents", robot: "BUDDY", actionName: "고립 주민 구조", actionId: "rescue_residents" },
];
for (const action of actions) await performAction(page, action);

await page.getByText("구조 작전 완료!").waitFor({ timeout: 8_000 });
await page.getByText("10/10", { exact: true }).waitFor();
assert.match(await page.locator(".result-stats").innerText(), /발견 콤보\s*5\/5/);
assert.match(await page.locator(".result-stats").innerText(), /구조 주민\s*9명/);
await page.getByRole("button", { name: "다시 출동" }).click();
await page.getByText("WAVE 1", { exact: true }).waitFor();
assert.deepEqual(errors, []);

await browser.close();
console.log("Click full-flow PASSED: 10 incidents → 5 combos → result → retry");
