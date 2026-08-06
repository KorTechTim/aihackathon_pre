import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseURL = process.env.PIXEL_PANIC_URL ?? "http://127.0.0.1:3100";
const output = path.resolve("visual-regression/phase1");
await mkdir(output, { recursive: true });

const viewports = [
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1024x576", width: 1024, height: 576 },
  { name: "844x390", width: 844, height: 390 },
];
const screens = [
  { name: "title", query: "" },
  { name: "play", query: "?screen=play&phase=preview" },
  { name: "success", query: "?screen=result&result=success" },
  { name: "fail", query: "?screen=result&result=fail" },
];

const browser = await chromium.launch({ headless: true });
for (const viewport of viewports) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  for (const screen of screens) {
    await page.goto(`${baseURL}/${screen.query}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(screen.name === "title" ? 900 : 450);
    await page.screenshot({ path: path.join(output, `${viewport.name}_${screen.name}.png`) });
  }
  await page.close();
}
await browser.close();
console.log(`Captured ${viewports.length * screens.length} Phase 1 screenshots in ${output}`);
