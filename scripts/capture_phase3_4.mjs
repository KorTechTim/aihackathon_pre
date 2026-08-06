import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const output = path.resolve("visual-regression/phase4");
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const captures = [
  ["01_title.png", "/", { width: 1280, height: 720 }, 900],
  ["02_play_initial.png", "/?screen=play&phase=idle", { width: 1280, height: 720 }, 850],
  ["03_ai_analyzing.png", "/?screen=play&phase=analyzing", { width: 1280, height: 720 }, 850],
  ["04_plan_preview.png", "/?screen=play&phase=preview", { width: 1280, height: 720 }, 850],
  ["05_fire_resolving.png", "/?screen=play&phase=fire", { width: 1280, height: 720 }, 1500],
  ["06_bridge_resolving.png", "/?screen=play&phase=bridge", { width: 1280, height: 720 }, 1550],
  ["07_cat_resolving.png", "/?screen=play&phase=cat", { width: 1280, height: 720 }, 1300],
  ["08_generator_resolving.png", "/?screen=play&phase=generator", { width: 1280, height: 720 }, 1500],
  ["09_result_success_s.png", "/?screen=result&result=success", { width: 1280, height: 720 }, 650],
  ["10_result_fail.png", "/?screen=result&result=fail", { width: 1280, height: 720 }, 650],
  ["11_mobile_landscape.png", "/?screen=play&phase=generator", { width: 844, height: 390 }, 1200],
  ["12_mobile_portrait_rotate.png", "/", { width: 390, height: 844 }, 650],
];

for (const [filename, route, viewport, wait] of captures) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(output, filename), fullPage: false });
  await page.close();
  console.log(`captured ${filename}`);
}

await browser.close();
