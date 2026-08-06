import assert from "node:assert/strict";
import { chromium } from "playwright";
import { collectPageErrors } from "./qa_helpers.mjs";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = collectPageErrors(page);
await page.goto(`${baseUrl}/?screen=play&skipBriefing=1`, { waitUntil: "networkidle" });
await page.locator("canvas").waitFor({ state: "visible" });
await page.getByText("CLICK RESCUE OPS").waitFor();
assert.equal(await page.locator("input, textarea").count(), 0);

const manifestResponse = await page.request.get(`${baseUrl}/assets/pixel-panic/manifests/asset-manifest.json`);
assert.equal(manifestResponse.ok(), true);
const manifest = await manifestResponse.json();
assert.equal(manifest.assets.length >= 170 && manifest.animations.length >= 36, true);

for (const viewport of [{ width: 1280, height: 720 }, { width: 1024, height: 576 }, { width: 1920, height: 1080 }, { width: 844, height: 390 }]) {
  await page.setViewportSize(viewport);
  await page.waitForFunction(({ width, height }) => {
    const stage = document.querySelector(".stage-viewport")?.getBoundingClientRect();
    return Boolean(stage && stage.width <= width + .5 && stage.height <= height + .5);
  }, viewport);
  const stage = await page.locator(".stage-viewport").boundingBox();
  assert.equal(Boolean(stage && stage.width <= viewport.width + .5 && stage.height <= viewport.height + .5), true, `${viewport.width}x${viewport.height}`);
}
await page.setViewportSize({ width: 390, height: 844 });
await page.getByText("기기를 가로로 돌려주세요").waitFor();
assert.deepEqual(errors, []);
await browser.close();
console.log("Responsive smoke PASSED: click UI, Phaser, manifest, landscape scaling, portrait guide");
