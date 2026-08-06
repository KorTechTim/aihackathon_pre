import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/api/plan", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      source: "openai",
      model: "gpt-5.6-luna",
      plan: {
        summary: "생명 구조를 먼저 진행한 뒤 위험 시설을 차례로 복구합니다.",
        priority: ["cat", "fire", "bridge", "generator"],
        assignments: [
          { robot: "aqua", incidents: ["fire"], reason: "화재 진압 담당" },
          { robot: "fix", incidents: ["bridge", "generator"], reason: "시설 복구 담당" },
          { robot: "buddy", incidents: ["cat"], reason: "생명 구조 담당" },
        ],
      },
    }),
  });
});

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "구조 작전 시작" }).waitFor();
await page.getByRole("button", { name: "구조 작전 시작" }).click();
await page.locator("canvas").waitFor({ state: "visible" });
await page.getByRole("button", { name: "명령 분석" }).click();
await page.getByText("역할 배정 완료! 작전을 실행하세요.").waitFor({ timeout: 4000 });
await page.getByText("GPT LIVE").waitFor();
await page.getByText("순서: 고양이 → 화재 → 다리 → 발전기").waitFor();
await page.getByRole("button", { name: "작전 실행" }).click();
await page.getByText("BUDDY가 옥상 고양이에게 접근하고 있어요.").waitFor({ timeout: 3000 });

const manifestResponse = await page.request.get(`${baseUrl}/assets/pixel-panic/manifests/asset-manifest.json`);
if (!manifestResponse.ok()) errors.push(`manifest HTTP ${manifestResponse.status()}`);
const manifest = await manifestResponse.json();
if (manifest.assets.length < 170 || manifest.animations.length < 36) errors.push("manifest entries incomplete");

for (const viewport of [{ width: 1024, height: 576 }, { width: 1920, height: 1080 }, { width: 844, height: 390 }, { width: 740, height: 360 }]) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}/?screen=play&phase=preview`, { waitUntil: "networkidle" });
  const stage = await page.locator(".stage-viewport").boundingBox();
  if (!stage || stage.width > viewport.width + 0.5 || stage.height > viewport.height + 0.5) errors.push(`${viewport.width}x${viewport.height} stage clipped`);
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.getByText("기기를 가로로 돌려주세요").waitFor();

await browser.close();
if (errors.length) {
  console.error("Phase 3/4 smoke FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Phase 3/4 smoke PASSED");
console.log("- title → play → GPT plan → priority-aware execute")
console.log("- Phaser canvas and manifest loaded")
console.log("- 1280×720, 1024×576, 1920×1080, 844×390, 740×360 responsive fit")
console.log("- 390×844 portrait rotation guidance visible")
