import assert from "node:assert/strict";
import { chromium } from "playwright";
import { collectPageErrors, fulfillBombHint, fulfillDialogue, fulfillNews, fulfillQuiz } from "./qa_helpers.mjs";

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
const quizRequests = [];
const dialogueRequests = [];
await page.route("**/api/dialogue", (route) => {
  dialogueRequests.push(route.request().postDataJSON());
  return fulfillDialogue(route, "openai");
});
await page.route("**/api/quiz", (route) => {
  quizRequests.push(route.request().postDataJSON());
  return fulfillQuiz(route, "openai");
});
await page.goto(`${baseUrl}/?screen=play&skipBriefing=1`, { waitUntil: "networkidle" });
await page.locator("canvas").waitFor({ state: "visible" });
await page.getByText("CLICK RESCUE OPS").waitFor();
assert.equal(await page.locator("input, textarea").count(), 0);
assert.equal(await page.locator(".game-screen").getAttribute("data-stage-map"), "day");
assert.equal(await page.locator(".mission-flow, .score-box").count(), 0);
const operationDock = await page.locator(".operation-dock").boundingBox();
assert.equal(Boolean(operationDock && operationDock.width <= 430 && operationDock.height <= 88), true);
assert.equal(await page.locator("[data-lower-rescue-frame], .lower-unit-console").count(), 0);
assert.equal(await page.locator(".phaser-canvas").getAttribute("data-map-viewport-height"), "656");
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
assert.equal(Boolean(dragBox && dragBox.y === 66 && dragBox.height === 654), true);
assert.equal(await dragSurface.evaluate((element) => getComputedStyle(element).cursor), "grab");
const initialPanX = Number(await dragSurface.getAttribute("data-map-pan-x"));
assert.equal(initialPanX, -78);
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
const firstNpcDialogue = await page.locator('[data-npc-speech="npc_duri"] p').innerText();
assert.match(firstNpcDialogue, /강물|산책로/);
await page.getByRole("button", { name: "주민 말풍선 닫기" }).click();
await page.locator('[data-npc-speech="npc_duri"]').waitFor({ state: "hidden" });
await page.locator('[data-npc-id="npc_duri"]').click();
await page.locator('[data-npc-speech="npc_duri"]').waitFor({ state: "visible" });
await page.waitForFunction(() => document.querySelector('[data-npc-speech="npc_duri"]')?.getAttribute("data-dialogue-source") === "fallback");
const secondNpcDialogue = await page.locator('[data-npc-speech="npc_duri"] p').innerText();
assert.notEqual(secondNpcDialogue, firstNpcDialogue);
assert.deepEqual(dialogueRequests.slice(0, 2).map(({ dialogueSequence, excludedDialogues }) => ({ dialogueSequence, excludedDialogues })), [
  { dialogueSequence: 1, excludedDialogues: [] },
  { dialogueSequence: 2, excludedDialogues: [firstNpcDialogue] },
]);
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
assert.equal(Boolean(dialoguePosition && dialoguePosition.cardLeft > dialoguePosition.pinRight && dialoguePosition.cardRight <= 984 && dialoguePosition.cardBottom < 710), true);
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
assert.equal(await quiz.getAttribute("data-quiz-difficulty"), "easy");
assert.deepEqual(quizRequests.map(({ quizSequence, difficulty, excludedQuestions }) => ({ quizSequence, difficulty, excludedQuestions })), [
  { quizSequence: 1, difficulty: "easy", excludedQuestions: [] },
]);
const firstSafetyQuestion = await quiz.locator(".safety-quiz-question").innerText();
assert.match(firstSafetyQuestion, /빵집 화재/);
assert.equal(["first_response", "hidden_hazard", "safe_sequence", "protective_setup", "evacuation", "communication", "post_check", "priority"].includes(quizRequests[0].questionFocus), true);
assert.equal(Number.isInteger(quizRequests[0].variationSeed), true);
await quiz.locator('[data-quiz-option="a"]').click();
assert.equal(await quiz.getAttribute("data-quiz-status"), "wrong");
assert.equal((await page.evaluate(() => window.__PIXEL_PANIC_DEBUG__?.game.incidents.bakery_fire.completedActions.includes("evacuate"))) ?? false, false);
await quiz.locator('[data-quiz-option="b"]').click();
await quiz.waitFor({ state: "hidden" });
await page.waitForFunction(() => window.__PIXEL_PANIC_DEBUG__?.game.incidents.bakery_fire.completedActions.includes("evacuate"));
await page.waitForFunction((question) => window.__PIXEL_PANIC_DEBUG__?.quizHistory().questions.includes(question), firstSafetyQuestion);

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
await page.setViewportSize({ width: 1280, height: 720 });
await page.goto(`${baseUrl}/?screen=play&skipBriefing=1`, { waitUntil: "networkidle" });
const persistedQuizHistory = await page.evaluate(() => window.__PIXEL_PANIC_DEBUG__?.quizHistory());
assert.equal(persistedQuizHistory?.sequence, 1);
assert.equal(persistedQuizHistory?.questions.includes(firstSafetyQuestion), true);

const waveThreePage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await waveThreePage.goto(`${baseUrl}/?screen=play&skipBriefing=1&qaAll=1`, { waitUntil: "networkidle" });
await waveThreePage.locator('.game-screen[data-stage-map="highland"]').waitFor();
const highlandNpcPosition = await waveThreePage.locator('[data-npc-id="npc_boram"]').evaluate((node) => ({ left: node.style.left, top: node.style.top }));
assert.deepEqual(highlandNpcPosition, { left: "725px", top: "232px" });
const highlandIncidentPosition = await waveThreePage.locator('[data-incident-id="house_fire"]').evaluate((node) => ({ left: node.style.left, top: node.style.top }));
assert.deepEqual(highlandIncidentPosition, { left: "985px", top: "523px" });
await waveThreePage.close();

const catPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const catErrors = collectPageErrors(catPage);
const catQuizRequests = [];
await catPage.route("**/api/quiz", (route) => {
  catQuizRequests.push(route.request().postDataJSON());
  return fulfillQuiz(route, "openai");
});
await catPage.goto(`${baseUrl}/?screen=play&skipBriefing=1&qaAll=1`, { waitUntil: "networkidle" });
await catPage.locator('[data-incident-id="cat_trapped"]').click();
await catPage.getByRole("button", { name: /BUDDY 초상화/ }).click();
await catPage.getByRole("button", { name: /^고양이 구조/ }).click();
const catGame = catPage.locator('[data-cat-rescue="cat_trapped"]');
await catGame.waitFor({ state: "visible", timeout: 12_000 });
assert.equal(await catPage.locator('[data-safety-quiz="cat_trapped"]').count(), 0);
assert.equal(catQuizRequests.length, 0);
const catGameBounds = await catGame.boundingBox();
assert.equal(Boolean(catGameBounds && catGameBounds.x >= 0 && catGameBounds.y >= 0 && catGameBounds.x + catGameBounds.width <= 1280 && catGameBounds.y + catGameBounds.height <= 720), true);
await catPage.waitForTimeout(350);
await catPage.screenshot({ path: "/tmp/pixel-panic-cat-minigame.png" });
await catPage.waitForFunction(() => document.querySelector('[data-cat-rescue="cat_trapped"]')?.getAttribute("data-cat-phase") === "warning", undefined, { timeout: 8_000 });
const warningStartedAt = Date.now();
const catField = await catGame.locator(".cat-rescue-field").boundingBox();
const fallingCatX = Number(await catGame.getAttribute("data-cat-x"));
assert.equal(Boolean(catField && Number.isFinite(fallingCatX)), true);
const missX = fallingCatX < 50 ? 85 : 15;
await catPage.mouse.click(catField.x + catField.width * missX / 100, catField.y + catField.height * .82);
await catPage.waitForFunction(() => document.querySelector('[data-cat-rescue="cat_trapped"]')?.getAttribute("data-cat-phase") === "falling", undefined, { timeout: 2_000 });
assert.equal(Date.now() - warningStartedAt >= 850, true, "cat must wait one second after the warning motion before falling");
await catPage.waitForFunction(() => document.querySelector('[data-cat-rescue="cat_trapped"]')?.getAttribute("data-cat-phase") === "failure", undefined, { timeout: 2_000 });
await catPage.screenshot({ path: "/tmp/pixel-panic-cat-minigame-failure.png" });
await catGame.waitFor({ state: "hidden", timeout: 3_000 });
await catPage.waitForFunction(() => window.__PIXEL_PANIC_DEBUG__?.game.robots.buddy.status === "idle");
assert.equal((await catPage.evaluate(() => window.__PIXEL_PANIC_DEBUG__?.game.catRescued)) ?? true, false);
assert.notEqual(await catPage.evaluate(() => window.__PIXEL_PANIC_DEBUG__?.game.incidents.cat_trapped.status), "resolved");

await catPage.locator('[data-incident-id="cat_trapped"]').click();
await catPage.getByRole("button", { name: /BUDDY 초상화/ }).click();
await catPage.getByRole("button", { name: /^고양이 구조/ }).click();
await catGame.waitFor({ state: "visible", timeout: 12_000 });
await catPage.waitForFunction(() => document.querySelector('[data-cat-rescue="cat_trapped"]')?.getAttribute("data-cat-phase") === "warning", undefined, { timeout: 8_000 });
const retryField = await catGame.locator(".cat-rescue-field").boundingBox();
const retryCatX = Number(await catGame.getAttribute("data-cat-x"));
assert.equal(Boolean(retryField && Number.isFinite(retryCatX)), true);
await catPage.mouse.click(retryField.x + retryField.width * retryCatX / 100, retryField.y + retryField.height * .82);
await catPage.waitForFunction(() => document.querySelector('[data-cat-rescue="cat_trapped"]')?.getAttribute("data-cat-phase") === "success", undefined, { timeout: 2_000 });
await catPage.screenshot({ path: "/tmp/pixel-panic-cat-minigame-success.png" });
await catGame.waitFor({ state: "hidden", timeout: 3_000 });
await catPage.waitForFunction(() => window.__PIXEL_PANIC_DEBUG__?.game.catRescued === true);
await catPage.close();

const bombPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const bombErrors = collectPageErrors(bombPage);
const bombHintRequests = [];
await bombPage.route("**/api/bomb-hint", (route) => {
  bombHintRequests.push(route.request().postDataJSON());
  return fulfillBombHint(route, "openai");
});
await bombPage.goto(`${baseUrl}/?screen=play&skipBriefing=1&qaAll=1`, { waitUntil: "networkidle" });
await bombPage.locator('[data-incident-id="suspicious_bomb"]').click();
await bombPage.getByRole("button", { name: /FIX 초상화/ }).click();
await bombPage.getByRole("button", { name: /^폭탄 해체/ }).click();
const bombGame = bombPage.locator('[data-bomb-defusal="suspicious_bomb"]');
await bombGame.waitFor({ state: "visible", timeout: 12_000 });
assert.equal(await bombPage.locator('[data-safety-quiz="suspicious_bomb"]').count(), 0);
await bombPage.waitForFunction(() => document.querySelector('[data-bomb-defusal="suspicious_bomb"]')?.getAttribute("data-bomb-hint-source") === "openai");
assert.equal(bombHintRequests.length, 1);
assert.equal(["red", "blue"].includes(bombHintRequests[0].correctWire), true);
assert.equal(await bombGame.locator('img[alt="본부 AI 루나"]').evaluate((image) => image.complete && image.naturalWidth === 256), true);
const bombBounds = await bombGame.boundingBox();
assert.equal(Boolean(bombBounds && bombBounds.x >= 0 && bombBounds.y >= 0 && bombBounds.x + bombBounds.width <= 1280 && bombBounds.y + bombBounds.height <= 720), true);
await bombPage.screenshot({ path: "/tmp/pixel-panic-bomb-defusal.png" });
const firstCorrectWire = await bombGame.getAttribute("data-qa-correct-wire");
const firstWrongWire = firstCorrectWire === "red" ? "blue" : "red";
await bombGame.locator(`[data-bomb-wire="${firstWrongWire}"]`).click();
await bombPage.waitForFunction(() => document.querySelector('[data-bomb-defusal="suspicious_bomb"]')?.getAttribute("data-bomb-status") === "failure");
await bombGame.waitFor({ state: "hidden", timeout: 3_000 });
assert.notEqual(await bombPage.evaluate(() => window.__PIXEL_PANIC_DEBUG__?.game.incidents.suspicious_bomb.status), "resolved");

await bombPage.locator('[data-incident-id="suspicious_bomb"]').click();
await bombPage.getByRole("button", { name: /FIX 초상화/ }).click();
await bombPage.getByRole("button", { name: /^폭탄 해체/ }).click();
await bombGame.waitFor({ state: "visible", timeout: 12_000 });
await bombPage.waitForFunction(() => document.querySelector('[data-bomb-defusal="suspicious_bomb"]')?.getAttribute("data-bomb-hint-source") === "openai");
const retryCorrectWire = await bombGame.getAttribute("data-qa-correct-wire");
assert.equal(retryCorrectWire === "red" || retryCorrectWire === "blue", true);
await bombGame.locator(`[data-bomb-wire="${retryCorrectWire}"]`).click();
await bombPage.waitForFunction(() => document.querySelector('[data-bomb-defusal="suspicious_bomb"]')?.getAttribute("data-bomb-status") === "success");
await bombPage.waitForTimeout(300);
await bombPage.screenshot({ path: "/tmp/pixel-panic-bomb-defusal-success.png" });
await bombGame.waitFor({ state: "hidden", timeout: 3_000 });
await bombPage.waitForFunction(() => window.__PIXEL_PANIC_DEBUG__?.game.incidents.suspicious_bomb.status === "resolved");
await bombPage.close();

const stagePage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const stageErrors = collectPageErrors(stagePage);
const stageNewsRequests = [];
await stagePage.route("**/api/news", (route) => {
  stageNewsRequests.push(route.request().postDataJSON());
  return fulfillNews(route, "openai");
});
await stagePage.goto(`${baseUrl}/?screen=play&skipBriefing=1`, { waitUntil: "networkidle" });
await stagePage.evaluate(() => {
  const game = window.__PIXEL_PANIC_DEBUG__?.game;
  if (!game) throw new Error("debug game state is unavailable");
  const completedIds = ["electrical_short", "bakery_fire", "gas_risk", "cat_trapped", "suspicious_bomb"];
  for (const id of completedIds) {
    game.incidents[id].status = "resolved";
    game.incidents[id].progress = 100;
  }
  game.completedStageIncidents = completedIds.map((id) => `1:${id}`);
});
const stageNews = stagePage.locator('[data-stage-news="1"]');
await stageNews.waitFor({ state: "visible", timeout: 3_000 });
await stagePage.waitForFunction(() => {
  const audio = window.__PIXEL_PANIC_DEBUG__?.audio();
  return audio?.activeTrack === "stage-complete" && audio.musicPlaying;
});
await stagePage.waitForFunction(() => document.querySelector('[data-stage-news="1"]')?.getAttribute("data-news-source") === "openai");
assert.equal(stageNewsRequests.length, 1);
assert.equal(stageNewsRequests[0].edition, "stage");
assert.equal(stageNewsRequests[0].completedWave, 1);
assert.match(await stageNews.innerText(), /누적 해결 임무 5건/);
const stageNewsBounds = await stageNews.boundingBox();
assert.equal(Boolean(stageNewsBounds && stageNewsBounds.x >= 0 && stageNewsBounds.y >= 0 && stageNewsBounds.x + stageNewsBounds.width <= 1280 && stageNewsBounds.y + stageNewsBounds.height <= 720), true);
await stagePage.screenshot({ path: "/tmp/pixel-panic-wave-news.png" });
assert.equal(await stagePage.locator('.game-screen').getAttribute('data-wave'), "1");
const elapsedBeforeStage = await stagePage.evaluate(() => window.__PIXEL_PANIC_DEBUG__?.game.elapsedMs);
await stagePage.waitForTimeout(500);
assert.equal(await stagePage.evaluate(() => window.__PIXEL_PANIC_DEBUG__?.game.elapsedMs), elapsedBeforeStage, "stage news must pause the game timer");
await stagePage.getByRole("button", { name: /WAVE 2.*폭우와 침수 출동/ }).click();
await stagePage.locator('.game-screen[data-wave="2"][data-stage-map="harbor"]').waitFor();
await stagePage.waitForFunction(() => {
  const audio = window.__PIXEL_PANIC_DEBUG__?.audio();
  return audio?.activeTrack === "mission" && audio.musicPlaying;
});
assert.equal(await stagePage.evaluate(() => window.__PIXEL_PANIC_DEBUG__?.game.incidents.power_flood.status), "active");
await stagePage.close();

const resultPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const resultErrors = collectPageErrors(resultPage);
const newsRequests = [];
await resultPage.route("**/api/news", (route) => {
  newsRequests.push(route.request().postDataJSON());
  return fulfillNews(route, "openai");
});
await resultPage.goto(`${baseUrl}/?screen=result&result=success`, { waitUntil: "networkidle" });
const newsButton = resultPage.getByRole("button", { name: "AI 마을 뉴스" });
await newsButton.waitFor();
assert.equal(newsRequests.length >= 1, true);
assert.equal(newsRequests.at(-1).status, "success");
assert.equal(newsRequests.at(-1).resolvedIncidents.length, 11);
await newsButton.click();
const newsDialog = resultPage.getByRole("dialog", { name: /구조 로봇 협동/ });
await newsDialog.waitFor();
await resultPage.waitForTimeout(300);
assert.equal(await resultPage.locator(".result-news-card").getAttribute("data-news-source"), "openai");
assert.match(await resultPage.locator(".result-news-article p").innerText(), /주민 9명|보존율 91%/);
assert.match(await resultPage.locator(".result-news-interview blockquote").innerText(), /구조대/);
const newsBounds = await resultPage.locator(".result-news-card").boundingBox();
assert.equal(Boolean(newsBounds && newsBounds.x >= 0 && newsBounds.y >= 0 && newsBounds.x + newsBounds.width <= 1280 && newsBounds.y + newsBounds.height <= 720), true);
await resultPage.screenshot({ path: "/tmp/pixel-panic-ai-news.png" });
await resultPage.getByRole("button", { name: "AI 마을 뉴스 닫기" }).click();
await resultPage.close();

assert.deepEqual([...titleErrors, ...errors, ...catErrors, ...bombErrors, ...stageErrors, ...resultErrors], []);
await browser.close();
console.log("Responsive smoke PASSED: immediate wave-news transition, rooftop cat catch and AI-radio bomb-defusal mini games, full-height map, arrival-triggered AI safety quiz, AI result news/interview, step-by-step road routes and exact robot targets, title/mission audio, 9 rotating maps, NPC AI speech, robot action pop-up, map drag, Phaser, manifest, scaling");
