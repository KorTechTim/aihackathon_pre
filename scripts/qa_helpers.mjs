export function mockPlan(priority, source = "openai") {
  return {
    source,
    requestId: "qa-request-id",
    ...(source === "fallback" ? { degradedReason: "OPENAI_UNAVAILABLE" } : {}),
    plan: {
      summary: source === "openai" ? "요청한 우선순위로 구조 작전을 준비했습니다." : "안전한 기본 구조 작전을 준비했습니다.",
      priority,
      assignments: [
        { robot: "aqua", incidents: ["fire"], reason: "화재 진압 담당" },
        { robot: "fix", incidents: ["bridge", "generator"], reason: "시설 복구 담당" },
        { robot: "buddy", incidents: ["cat"], reason: "생명 구조 담당" },
      ],
    },
  };
}

export async function fulfillPlan(route, priority, source = "openai") {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockPlan(priority, source)) });
}

export async function waitForOperationState(page, phase, completed, timeout = 5_000) {
  await page.waitForFunction(({ expectedPhase, expectedCompleted }) => {
    const game = document.querySelector(".game-screen");
    const world = document.querySelector(".phaser-canvas");
    if (game?.getAttribute("data-phase") !== expectedPhase) return false;
    const uiCompleted = (game?.getAttribute("data-completed") ?? "").split(",").filter(Boolean).sort();
    const worldCompleted = (world?.getAttribute("data-world-completed") ?? "").split(",").filter(Boolean).sort();
    const expected = [...expectedCompleted].sort();
    return JSON.stringify(uiCompleted) === JSON.stringify(expected) && JSON.stringify(worldCompleted) === JSON.stringify(expected);
  }, { expectedPhase: phase, expectedCompleted: completed }, { timeout });
}

export function collectPageErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !/Failed to load resource.*(?:429|5\d\d)/.test(text)) errors.push(text);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
