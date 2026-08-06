import assert from "node:assert/strict";
import { chromium } from "playwright";
import { collectPageErrors, fulfillPlan } from "./qa_helpers.mjs";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const browser = await chromium.launch({ headless: true });

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = collectPageErrors(page);
  await page.route("**/api/plan", (route) => fulfillPlan(route, ["fire", "bridge", "cat", "generator"]));
  await page.goto(`${baseUrl}/?stepMs=600&testSeconds=3`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "구조 작전 시작" }).click();
  await page.getByRole("button", { name: "명령 분석" }).click();
  await page.getByText("GPT LIVE").waitFor();
  await page.getByRole("button", { name: "작전 실행" }).click();
  await page.getByText("구조 시간이 종료됐어요").waitFor({ timeout: 5_000 });
  await page.waitForTimeout(3_000);
  assert.equal(await page.getByText("구조 시간이 종료됐어요").isVisible(), true);
  assert.equal(await page.getByText("완벽한 구조 작전!").count(), 0);
  assert.deepEqual(errors, []);
  await page.close();
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = collectPageErrors(page);
  await page.route("**/api/plan", (route) => fulfillPlan(route, ["fire", "bridge", "cat", "generator"]));
  await page.goto(`${baseUrl}/?screen=play&phase=idle&stepMs=300&testSeconds=20`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "명령 분석" }).click();
  await page.getByText("GPT LIVE").waitFor();
  await page.getByRole("button", { name: "작전 실행" }).click();
  await page.getByRole("button", { name: "일시정지" }).click();
  await page.getByRole("button", { name: "작전 포기" }).click();
  await page.getByText("작전을 종료했습니다").waitFor();
  await page.waitForTimeout(2_000);
  assert.equal(await page.getByText("작전을 종료했습니다").isVisible(), true);
  assert.deepEqual(errors, []);
  await page.close();
}

await browser.close();
console.log("Termination-race smoke PASSED: timeout and abandon cannot be overwritten by success");
