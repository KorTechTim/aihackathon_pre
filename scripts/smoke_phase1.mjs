import { chromium } from "playwright";

const baseURL = process.env.PIXEL_PANIC_URL ?? "http://127.0.0.1:3100";
const browser = await chromium.launch({ headless: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertImages(page, label) {
  await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0), null, { timeout: 5000 });
  const broken = await page.locator("img").evaluateAll((images) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.getAttribute("src")));
  assert(broken.length === 0, `${label}: broken images: ${broken.join(", ")}`);
}

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(baseURL, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "게임 시작" }).waitFor();
await assertImages(page, "title");

for (const asset of ["map", "robot_aqua", "robot_fix", "robot_buddy", "incident_fire", "incident_bridge", "incident_cat", "incident_generator"]) {
  const response = await page.request.get(`${baseURL}/assets/pixel-panic/ui/pp_placeholder_${asset}.png`);
  assert(response.status() === 200, `Phaser asset pp_placeholder_${asset}.png returned ${response.status()}`);
}

const mainButton = page.getByRole("button", { name: "게임 시작" });
const normalPosition = await mainButton.evaluate((element) => getComputedStyle(element).backgroundPositionY);
await mainButton.hover();
const hoverPosition = await mainButton.evaluate((element) => getComputedStyle(element).backgroundPositionY);
assert(normalPosition !== hoverPosition, "primary button hover frame did not change");

await mainButton.click();
await page.getByLabel("자연어 작전 명령").waitFor();
await assertImages(page, "play");
await page.getByRole("button", { name: "위험도 우선" }).click();
const command = await page.getByLabel("자연어 작전 명령").inputValue();
assert(command.includes("위험도"), "quick command did not populate the input");

await page.getByRole("button", { name: "명령 분석" }).click();
await page.getByText("AI가 명령을 분석하고 있어요…").waitFor();
assert(await page.getByRole("button", { name: "분석 중…" }).isDisabled(), "analyzing button should be disabled");
await page.getByText("작전 준비 완료! 배정 내용을 확인하세요.").waitFor({ timeout: 3000 });
await page.getByRole("button", { name: "작전 실행" }).click();
await page.getByText("마을을 완벽하게 구했어요!").waitFor({ timeout: 6500 });
await assertImages(page, "result-success");

for (const viewport of [{ width: 1024, height: 576 }, { width: 844, height: 390 }]) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseURL}/?screen=play&phase=preview`, { waitUntil: "networkidle" });
  const stage = await page.locator(".stage-viewport").boundingBox();
  assert(stage && stage.width <= viewport.width + 0.5 && stage.height <= viewport.height + 0.5, `${viewport.width}x${viewport.height}: stage is clipped`);
  await assertImages(page, `${viewport.width}x${viewport.height}`);
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(baseURL, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
assert(await page.getByText("기기를 가로로 돌려주세요").isVisible(), "portrait rotate overlay is missing");

await browser.close();
console.log("Phase 1 interaction and responsive smoke test PASSED");
