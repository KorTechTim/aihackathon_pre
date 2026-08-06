import assert from "node:assert/strict";
import { chromium } from "playwright";
import { collectPageErrors, fulfillPlan, waitForOperationState } from "./qa_helpers.mjs";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const priorities = [
  ["fire", "bridge", "cat", "generator"],
  ["cat", "fire", "bridge", "generator"],
  ["fire", "generator", "bridge", "cat"],
  ["generator", "cat", "bridge", "fire"],
];
const browser = await chromium.launch({ headless: true });

for (const priority of priorities) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = collectPageErrors(page);
  await page.route("**/api/plan", (route) => fulfillPlan(route, priority));
  await page.goto(`${baseUrl}/?screen=play&phase=idle&stepMs=400`, { waitUntil: "networkidle" });
  await page.locator("canvas").waitFor();
  await page.getByRole("button", { name: "명령 분석" }).click();
  await page.getByText("GPT LIVE").waitFor();
  await page.getByRole("button", { name: "작전 실행" }).click();
  for (let index = 0; index < priority.length; index += 1) await waitForOperationState(page, priority[index], priority.slice(0, index));
  await waitForOperationState(page, "complete", priority);
  await page.locator(".result-stats").getByText("4/4", { exact: true }).waitFor({ timeout: 5_000 });
  assert.deepEqual(errors, [], priority.join("→"));
  await page.close();
}

await browser.close();
console.log("Priority smoke PASSED: four representative orders keep UI and Phaser synchronized");
