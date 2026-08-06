import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { fulfillPlan, waitForOperationState } from "./qa_helpers.mjs";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const output = path.resolve("visual-regression/phase4");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function capturePreview(filename, priority, status = 200) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route("**/api/plan", (route) => status === 200 ? fulfillPlan(route, priority) : route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ code: status === 429 ? "RATE_LIMITED" : "OPENAI_UNAVAILABLE" }) }));
  await page.goto(`${baseUrl}/?screen=play&phase=idle&stepMs=600`, { waitUntil: "networkidle" });
  await page.locator("canvas").waitFor();
  await page.getByRole("button", { name: "명령 분석" }).click();
  await page.getByText(status === 200 ? "GPT LIVE" : "LOCAL").waitFor();
  await page.screenshot({ path: path.join(output, filename) });
  await page.close();
}

await capturePreview("13_priority_cat_first.png", ["cat", "fire", "bridge", "generator"]);

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const priority = ["generator", "cat", "bridge", "fire"];
  await page.route("**/api/plan", (route) => fulfillPlan(route, priority));
  await page.goto(`${baseUrl}/?screen=play&phase=idle&stepMs=900`, { waitUntil: "networkidle" });
  await page.locator("canvas").waitFor();
  await page.getByRole("button", { name: "명령 분석" }).click();
  await page.getByText("GPT LIVE").waitFor();
  await page.getByRole("button", { name: "작전 실행" }).click();
  await waitForOperationState(page, "generator", []);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(output, "14_priority_generator_first.png") });
  await page.close();
}

await capturePreview("15_local_fallback.png", ["fire", "bridge", "cat", "generator"], 503);
await capturePreview("16_rate_limited.png", ["fire", "bridge", "cat", "generator"], 429);

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route("**/api/plan", (route) => fulfillPlan(route, ["fire", "bridge", "cat", "generator"]));
  await page.goto(`${baseUrl}/?stepMs=600&testSeconds=3`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "구조 작전 시작" }).click();
  await page.getByRole("button", { name: "명령 분석" }).click();
  await page.getByText("GPT LIVE").waitFor();
  await page.getByRole("button", { name: "작전 실행" }).click();
  await page.getByText("구조 시간이 종료됐어요").waitFor({ timeout: 5_000 });
  await page.screenshot({ path: path.join(output, "17_timeout_fail.png") });
  await page.close();
}

await browser.close();
console.log("Captured stabilization scenes 13-17 without modifying the Phase 4 baseline 01-12");
