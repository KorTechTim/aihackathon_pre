import { chromium } from "playwright";

const baseURL = process.env.PIXEL_PANIC_URL ?? "http://127.0.0.1:3101";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const phase2Assets = [
  "world/maps/pp_stage_01_preview.png",
  "world/maps/pp_stage_01.json",
  "world/maps/pp_stage_01_collision.json",
  "world/maps/pp_stage_01_spawn_points.json",
  "world/tilesets/pp_world_tileset_terrain_core.png",
  "world/incidents/pp_world_incident_marker_fire.png",
  "world/incidents/pp_world_incident_marker_bridge.png",
  "world/incidents/pp_world_incident_marker_cat.png",
  "world/incidents/pp_world_incident_marker_generator.png",
];

for (const asset of phase2Assets) {
  const response = await page.request.get(`${baseURL}/assets/pixel-panic/${asset}`);
  assert(response.status() === 200, `${asset} returned ${response.status()}`);
}

await page.goto(`${baseURL}/?screen=play&phase=preview`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
assert(await page.locator("canvas").isVisible(), "Phaser canvas is not visible");
assert(await page.getByText("작전 미리보기").isVisible(), "Plan preview is missing");
const canvasSize = await page.locator("canvas").evaluate((canvas) => ({ width: canvas.width, height: canvas.height }));
assert(canvasSize.width === 1280 && canvasSize.height === 720, `Unexpected canvas size ${canvasSize.width}x${canvasSize.height}`);

const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(700);
assert(errors.length === 0, `Browser console errors: ${errors.join(" | ")}`);

await browser.close();
console.log("Phase 2 runtime smoke test PASSED");
