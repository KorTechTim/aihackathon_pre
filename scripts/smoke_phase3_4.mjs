import assert from "node:assert/strict";
import { chromium } from "playwright";
import { collectPageErrors, fulfillDialogue, fulfillQuiz } from "./qa_helpers.mjs";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
const titlePage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const titleErrors = collectPageErrors(titlePage);
await titlePage.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
await titlePage.getByRole("button", { name: "구조 작전 시작" }).waitFor();
await titlePage.waitForFunction(() => window.__PIXEL_PANIC_DEBUG__?.audio().requestedTrack === "title");
await titlePage.getByRole("button", { name: "플레이 방법" }).click();
assert.equal(await titlePage.getByRole("button", { name: "닫기" }).count(), 0);
await titlePage.waitForFunction(() => {
  const audio = window.__PIXEL_PANIC_DEBUG__?.audio();
  return audio?.activeTrack === "title" && audio.musicPlaying;
});
await titlePage.getByRole("button", { name: "확인" }).click();
await titlePage.getByRole("button", { name: "구조 작전 시작" }).waitFor();
assert.equal(await titlePage.locator(".game-screen").count(), 0);
await titlePage.close();

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = collectPageErrors(page);
await page.route("**/api/dialogue", (route) => fulfillDialogue(route, "openai"));
await page.route("**/api/quiz", (route) => fulfillQuiz(route, "openai"));
await page.goto(`${baseUrl}/?screen=play&skipBriefing=1`, { waitUntil: "networkidle" });
await page.locator("canvas").waitFor({ state: "visible" });
await page.getByText("CLICK RESCUE OPS").waitFor();
assert.equal(await page.locator("input, textarea").count(), 0);
assert.equal(await page.locator(".game-screen").getAttribute("data-stage-map"), "day");
assert.equal(await page.locator(".mission-flow, .score-box").count(), 0);
const operationDock = await page.locator(".operation-dock").boundingBox();
assert.equal(Boolean(operationDock && operationDock.width <= 430 && operationDock.height <= 88), true);
const lowerFrame = await page.locator("[data-lower-rescue-frame]").boundingBox();
assert.equal(Boolean(lowerFrame && lowerFrame.width === 1280 && lowerFrame.height === 116 && lowerFrame.y >= 604), true);
assert.equal(await page.locator(".lower-unit-console .lower-unit").count(), 3);
const incidentRects = await page.locator(".incident-pin").evaluateAll((pins) => pins.map((pin) => {
  const rect = pin.getBoundingClientRect();
  return { id: pin.getAttribute("data-incident-id"), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
}));
for (let index = 0; index < incidentRects.length; index += 1) {
  for (let other = index + 1; other < incidentRects.length; other += 1) {
    const first = incidentRects[index];
    const second = incidentRects[other];
    const overlap = first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
    assert.equal(overlap, false, `${first.id} and ${second.id} incident cards overlap`);
  }
}
assert.equal(await page.locator('[data-incident-id="bakery_fire"]').evaluate((pin) => getComputedStyle(pin, "::after").content), '\"\"');

const dragSurface = page.locator(".map-drag-surface");
const dragBox = await dragSurface.boundingBox();
assert.equal(Boolean(dragBox), true);
assert.equal(await dragSurface.evaluate((element) => getComputedStyle(element).cursor), "grab");
const initialPanX = Number(await dragSurface.getAttribute("data-map-pan-x"));
assert.equal(initialPanX, -208);
const dragStart = { x: dragBox.x + dragBox.width / 2, y: dragBox.y + dragBox.height / 2 };
await page.mouse.move(dragStart.x, dragStart.y);
await page.mouse.down();
await page.mouse.move(dragStart.x + 160, dragStart.y, { steps: 5 });
await page.waitForFunction((start) => Number(document.querySelector(".map-drag-surface")?.getAttribute("data-map-pan-x")) >= start + 150, initialPanX);
assert.equal(await dragSurface.evaluate((element) => getComputedStyle(element).cursor), "grabbing");
const draggedPanX = Number(await dragSurface.getAttribute("data-map-pan-x"));
assert.equal(await page.locator(".phaser-canvas").getAttribute("data-map-pan-x"), String(draggedPanX));
assert.equal(await page.locator(".map-hotspots").getAttribute("data-map-pan-x"), String(draggedPanX));
await page.mouse.up();
assert.equal(await dragSurface.evaluate((element) => getComputedStyle(element).cursor), "grab");
await page.mouse.move(dragStart.x + 160, dragStart.y);
await page.mouse.down();
await page.mouse.move(dragStart.x, dragStart.y, { steps: 5 });
await page.mouse.up();
await page.waitForFunction((start) => document.querySelector(".map-drag-surface")?.getAttribute("data-map-pan-x") === String(start), initialPanX);

await page.locator('[data-npc-id="npc_duri"]').click();
await page.locator('[data-npc-speech="npc_duri"]').waitFor({ state: "visible" });
await page.waitForFunction(() => document.querySelector('[data-npc-speech="npc_duri"]')?.getAttribute("data-dialogue-source") === "openai");
assert.match(await page.locator('[data-npc-speech="npc_duri"] p').innerText(), /강물|산책로/);
await page.getByRole("button", { name: "주민 말풍선 닫기" }).click();
await page.locator('[data-npc-speech="npc_duri"]').waitFor({ state: "hidden" });

await page.locator('[data-incident-row="bakery_fire"]').click();
await page.getByRole("button", { name: /BUDDY 초상화/ }).click();
await page.locator('[data-action-popup="buddy"]').waitFor({ state: "visible" });
assert.equal(await page.locator(".action-panel").count(), 0);
await page.getByRole("button", { name: "행동 선택 닫기" }).click();
await page.locator('[data-action-popup="buddy"]').waitFor({ state: "hidden" });
await page.getByRole("button", { name: /BUDDY 초상화/ }).click();
await page.locator('[data-action-popup="buddy"]').waitFor({ state: "visible" });
await page.getByRole("button", { name: /주민 대피 7초/ }).click();
await page.getByRole("dialog").waitFor({ state: "visible" });
const dialoguePosition = await page.evaluate(() => {
  const card = document.querySelector(".dialogue-card")?.getBoundingClientRect();
  const pin = document.querySelector(".incident-pin.selected")?.getBoundingClientRect();
  return card && pin ? { cardLeft: card.left, cardRight: card.right, cardBottom: card.bottom, pinRight: pin.right } : null;
});
assert.equal(Boolean(dialoguePosition && dialoguePosition.cardLeft > dialoguePosition.pinRight && dialoguePosition.cardRight <= 984 && dialoguePosition.cardBottom < 604), true);
await page.waitForFunction(() => {
  const audio = window.__PIXEL_PANIC_DEBUG__?.audio();
  return audio?.activeTrack === "mission" && audio.musicPlaying;
});
await page.getByRole("button", { name: "가스통 위치를 FIX에 공유" }).click();
await page.getByRole("dialog").waitFor({ state: "hidden" });
await page.waitForFunction(() => document.querySelector(".phaser-canvas")?.getAttribute("data-robot-buddy-mission") === "bakery_fire");
assert.equal(await page.locator(".phaser-canvas").getAttribute("data-robot-buddy-target"), "300,252");
assert.equal(Number(await page.locator(".phaser-canvas").getAttribute("data-robot-buddy-route-steps")) > 5, true);
await page.waitForFunction(() => document.querySelector(".phaser-canvas")?.getAttribute("data-robot-buddy-position") === "300,252");
await page.waitForFunction(() => document.querySelector(".phaser-canvas")?.getAttribute("data-robot-buddy-movement") === "working");
const quiz = page.locator('[data-safety-quiz="bakery_fire"]');
await quiz.waitFor({ state: "visible" });
await page.waitForFunction(() => document.querySelector('[data-safety-quiz="bakery_fire"]')?.getAttribute("data-quiz-source") === "openai");
assert.match(await quiz.locator(".safety-quiz-question").innerText(), /빵집 화재/);
await quiz.locator('[data-quiz-option="a"]').click();
assert.equal(await quiz.getAttribute("data-quiz-status"), "wrong");
assert.equal((await page.evaluate(() => window.__PIXEL_PANIC_DEBUG__?.game.incidents.bakery_fire.completedActions.includes("evacuate"))) ?? false, false);
await quiz.locator('[data-quiz-option="b"]').click();
await quiz.waitFor({ state: "hidden" });
await page.waitForFunction(() => window.__PIXEL_PANIC_DEBUG__?.game.incidents.bakery_fire.completedActions.includes("evacuate"));

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
const waveThreePage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await waveThreePage.goto(`${baseUrl}/?screen=play&skipBriefing=1&qaAll=1`, { waitUntil: "networkidle" });
await waveThreePage.locator('.game-screen[data-stage-map="highland"]').waitFor();
const highlandNpcPosition = await waveThreePage.locator('[data-npc-id="npc_boram"]').evaluate((node) => ({ left: node.style.left, top: node.style.top }));
assert.deepEqual(highlandNpcPosition, { left: "725px", top: "193px" });
const highlandIncidentPosition = await waveThreePage.locator('[data-incident-id="house_fire"]').evaluate((node) => ({ left: node.style.left, top: node.style.top }));
assert.deepEqual(highlandIncidentPosition, { left: "985px", top: "445px" });
await waveThreePage.close();
assert.deepEqual([...titleErrors, ...errors], []);
await browser.close();
console.log("Responsive smoke PASSED: lower rescue command frame, arrival-triggered AI safety quiz, step-by-step road routes and exact robot targets, title/mission audio, 9 rotating maps, NPC AI speech, robot action pop-up, map drag, Phaser, manifest, scaling");
