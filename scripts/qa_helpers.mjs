export function collectPageErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !/Failed to load resource.*(?:429|5\d\d)/.test(text)) errors.push(text);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

export async function fulfillDialogue(route, source = "fallback") {
  const request = route.request().postDataJSON();
  const dialogue = {
    hydrant_broken: "소화전 수압이 낮지만 주변부터 안전하게 보호할게요.",
    high_water_bridge: "수위와 교각을 확인했습니다. 안전 순서를 선택해주세요.",
    bakery_gas_info: "오븐 옆 예비 가스통 위치를 꼭 FIX에게 알려주세요.",
    buddy_priority: "부품 운반과 주민 확인 중 먼저 할 임무를 정해주세요.",
  }[request.situation] ?? "현장 상황을 확인했습니다.";
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ dialogue, source, requestId: "qa-dialogue-request", ...(source === "fallback" ? { degradedReason: "OCI_UNAVAILABLE" } : {}) }),
  });
}

export async function waitForDebug(page, predicate, argument, timeout = 8_000) {
  await page.waitForFunction(predicate, argument, { timeout });
}

export async function performAction(page, { incidentName, incidentId, robot, actionName, actionId, dialogueChoice }) {
  await page.getByRole("button", { name: new RegExp(`^${incidentName}, 위험도`) }).click();
  await page.getByRole("button", { name: new RegExp(`${robot} 초상화 ${robot}`) }).click();
  await page.getByRole("button", { name: new RegExp(`^${actionName}`) }).click();
  if (dialogueChoice) await page.getByRole("button", { name: dialogueChoice }).click();
  await waitForDebug(page, ({ expectedIncident, expectedAction, expectedRobot }) => {
    const game = window.__PIXEL_PANIC_DEBUG__?.game;
    return game?.robots?.[expectedRobot]?.status === "idle" && game?.incidents?.[expectedIncident]?.completedActions?.includes(expectedAction);
  }, { expectedIncident: incidentId, expectedAction: actionId, expectedRobot: robot.toLowerCase() }, 10_000);
}
