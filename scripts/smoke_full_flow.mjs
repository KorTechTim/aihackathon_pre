import assert from "node:assert/strict";
import { chromium } from "playwright";
import { collectPageErrors, fulfillPlan, waitForOperationState } from "./qa_helpers.mjs";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = collectPageErrors(page);
await page.route("**/api/plan", (route) => fulfillPlan(route, ["fire", "bridge", "cat", "generator"]));

await page.goto(`${baseUrl}/?stepMs=400`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "구조 작전 시작" }).waitFor();
await page.getByRole("button", { name: "구조 작전 시작" }).click();
await page.locator("canvas").waitFor();
await page.getByRole("button", { name: "명령 분석" }).click();
await page.getByText("GPT LIVE").waitFor();
await page.getByRole("button", { name: "작전 실행" }).click();

await waitForOperationState(page, "fire", []);
await waitForOperationState(page, "bridge", ["fire"]);
await waitForOperationState(page, "cat", ["fire", "bridge"]);
await waitForOperationState(page, "generator", ["fire", "bridge", "cat"]);
await waitForOperationState(page, "complete", ["fire", "bridge", "cat", "generator"]);
await page.getByText("완벽한 구조 작전!").waitFor({ timeout: 5_000 });
await page.getByText("4/4").waitFor();
assert.match(await page.locator(".result-stats").innerText(), /마을 보존\s*100%/);
await page.getByRole("button", { name: "다시 출동" }).click();
await waitForOperationState(page, "idle", []);

await browser.close();
assert.deepEqual(errors, []);
console.log("Full-flow smoke PASSED: title → 4 incidents → result 4/4 → retry reset");
