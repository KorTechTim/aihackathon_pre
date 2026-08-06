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

await page.getByRole("button", { name: /빵집 화재, 위험도/ }).click();
await page.getByRole("button", { name: /BUDDY 초상화/ }).click();
await page.getByRole("button", { name: /주민 대피 7초/ }).click();
await page.getByRole("dialog").waitFor({ state: "visible" });
const dialoguePosition = await page.evaluate(() => {
  const card = document.querySelector(".dialogue-card")?.getBoundingClientRect();
  const pin = document.querySelector(".incident-pin.selected")?.getBoundingClientRect();
  return card && pin ? { cardLeft: card.left, cardRight: card.right, cardBottom: card.bottom, pinRight: pin.right } : null;
});
assert.equal(Boolean(dialoguePosition && dialoguePosition.cardLeft > dialoguePosition.pinRight && dialoguePosition.cardRight <= 984 && dialoguePosition.cardBottom < 604), true);
await page.waitForFunction(() => window.__PIXEL_PANIC_DEBUG__?.audio().musicPlaying === true);
await page.getByRole("button", { name: "가스통 위치를 FIX에 공유" }).click();
await page.getByRole("dialog").waitFor({ state: "hidden" });

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
