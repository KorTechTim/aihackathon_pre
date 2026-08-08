import assert from "node:assert/strict";
import { chromium } from "playwright";
import { collectPageErrors, fulfillDialogue } from "./qa_helpers.mjs";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = collectPageErrors(page);
const exhaustedQuestions = [
  "주민 대피 도중 새로운 위험 신호가 나타났다면 가장 먼저 할 판단은 무엇일까요?",
  "빵집 안에 연기가 차기 시작했다면 손님을 어느 방향으로 안내해야 할까요?",
  "빵집 화재에서 소화기를 사용할 때 가장 먼저 확보해야 할 것은 무엇일까요?",
  "빵집 화재 현장에서 주민 대피를 시작하기 전 가장 안전한 확인 순서는 무엇일까요?",
  "빵집 화재의 주민 대피 임무 전에 갖춰야 할 보호 원칙은 무엇일까요?",
  "빵집 화재 대응 중 주민 대피 동선을 정할 때 가장 중요한 기준은 무엇일까요?",
  "빵집 화재 현장에서 본부에 우선 보고해야 할 정보 조합은 무엇일까요?",
  "주민 대피를 마친 뒤 빵집 화재 현장을 다시 확인해야 하는 이유는 무엇일까요?",
];
await page.addInitScript(({ questions }) => {
  window.localStorage.setItem("pixel-panic:safety-quiz-history:v2", JSON.stringify({ sequence: 22, questions }));
}, { questions: exhaustedQuestions });
await page.route("**/api/dialogue", (route) => fulfillDialogue(route, "fallback"));
await page.route("**/api/quiz", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({
    question: exhaustedQuestions[0],
    options: [
      { id: "a", label: "보호 장비 없이 바로 접근한다" },
      { id: "b", label: "주변을 통제하고 안전 절차에 따라 대응한다" },
      { id: "c", label: "위험 신호를 무시하고 혼자 처리한다" },
    ],
    correctOptionId: "b",
    explanation: "주변 접근을 통제하고 상황에 맞는 안전 절차를 지키는 것이 우선입니다.",
    source: "fallback",
    degradedReason: "OCI_UNAVAILABLE",
    requestId: "qa-duplicate-quiz-request",
  }),
}));
await page.goto(`${baseUrl}/?screen=play&skipBriefing=1`, { waitUntil: "networkidle" });
await page.locator(".incident-row").filter({ hasText: "빵집 화재" }).click();
await page.locator(".robot-card").filter({ hasText: "BUDDY" }).click();
await page.getByRole("button", { name: /^주민 대피/ }).click();
await page.getByText("LOCAL SAFE").waitFor();
await page.getByRole("button", { name: "가스통 위치를 FIX에 공유" }).click();
await page.waitForFunction(() => window.__PIXEL_PANIC_DEBUG__?.game?.robots?.buddy?.status !== "idle");
const quiz = page.locator('[data-safety-quiz="bakery_fire"]');
await quiz.waitFor({ state: "visible", timeout: 8_000 });
assert.equal(await quiz.getAttribute("data-quiz-source"), "fallback");
assert.equal(await quiz.locator(".safety-quiz-question").innerText().then((question) => exhaustedQuestions.includes(question)), false);
assert.equal((await page.evaluate(() => window.__PIXEL_PANIC_DEBUG__?.quizHistory().sequence)), 23);
const correctOption = await quiz.getAttribute("data-qa-correct-option");
assert.equal(["a", "b", "c"].includes(correctOption ?? ""), true);
await quiz.locator(`[data-quiz-option="${correctOption}"]`).click();
await page.waitForFunction(() => window.__PIXEL_PANIC_DEBUG__?.game?.incidents?.bakery_fire?.completedActions?.includes("evacuate"));
assert.equal(await page.locator("input, textarea").count(), 0);
assert.deepEqual(errors, []);
await browser.close();
console.log("AI fallback PASSED: exhausted duplicate history never leaves the safety quiz loading");
