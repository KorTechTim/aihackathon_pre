import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseURL = process.env.PIXEL_PANIC_URL ?? "http://127.0.0.1:3101";
const output = path.resolve("visual-regression/phase2");
await mkdir(output, { recursive: true });

const captures = [
  { name: "01_world_initial", width: 1280, height: 720, query: "?screen=play&phase=idle", wait: 700 },
  { name: "02_plan_preview", width: 1280, height: 720, query: "?screen=play&phase=preview", wait: 700 },
  { name: "03_operation_executing", width: 1280, height: 720, query: "?screen=play&phase=executing", wait: 1200 },
  { name: "04_small_laptop", width: 1024, height: 576, query: "?screen=play&phase=preview", wait: 700 },
  { name: "05_mobile_landscape", width: 844, height: 390, query: "?screen=play&phase=preview", wait: 700 },
];

const browser = await chromium.launch({ headless: true });
for (const capture of captures) {
  const page = await browser.newPage({ viewport: { width: capture.width, height: capture.height }, deviceScaleFactor: 1 });
  await page.goto(`${baseURL}/${capture.query}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(capture.wait);
  await page.screenshot({ path: path.join(output, `${capture.name}.png`) });
  await page.close();
}
await browser.close();
console.log(`Captured ${captures.length} Phase 2 screenshots in ${output}`);
