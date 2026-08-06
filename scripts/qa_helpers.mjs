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
    npc_boram: "이웃들이 안전한 길로 가도록 제가 앞에서 알려줄게요!",
    npc_minsu: "젖은 전력선은 위험합니다. 반짝이는 설비에서 물러나 주세요.",
    npc_hana: "천천히 이동하세요. 뒤처진 주민은 제가 끝까지 살펴볼게요.",
    npc_duri: "강물 흐름을 계속 보고 있어요. 북쪽 산책로는 아직 안전해요!",
  }[request.situation] ?? "현장 상황을 확인했습니다.";
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ dialogue, source, requestId: "qa-dialogue-request", ...(source === "fallback" ? { degradedReason: "OCI_UNAVAILABLE" } : {}) }),
  });
}

export async function fulfillQuiz(route, source = "fallback") {
  const request = route.request().postDataJSON();
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      question: `${request.incidentLabel} 현장에서 가장 안전한 행동은 무엇일까요?`,
      options: [
        { id: "a", label: "보호 장비 없이 바로 접근한다" },
        { id: "b", label: "주변을 통제하고 안전 절차에 따라 대응한다" },
        { id: "c", label: "위험 신호를 무시하고 혼자 처리한다" },
      ],
      correctOptionId: "b",
      explanation: "주변 접근을 통제하고 상황에 맞는 안전 절차를 지키는 것이 우선입니다.",
      source,
      requestId: "qa-quiz-request",
      ...(source === "fallback" ? { degradedReason: "OCI_UNAVAILABLE" } : {}),
    }),
  });
}

export async function waitForDebug(page, predicate, argument, timeout = 8_000) {
  await page.waitForFunction(predicate, argument, { timeout });
}

export async function performAction(page, { incidentId, robot, actionName, actionId, dialogueChoice }) {
  const incidentRow = page.locator(`[data-incident-row="${incidentId}"]`);
  await incidentRow.click();
  await page.locator(`[data-incident-id="${incidentId}"]`).waitFor({ state: "visible" });
  await page.getByRole("button", { name: new RegExp(`${robot} 초상화 ${robot}`) }).click();
  await page.getByRole("button", { name: new RegExp(`^${actionName}`) }).click();
  if (dialogueChoice) await page.getByRole("button", { name: dialogueChoice }).click();
  const quiz = page.locator(`[data-safety-quiz="${incidentId}"]`);
  await quiz.waitFor({ state: "visible", timeout: 8_000 });
  await quiz.locator('[data-quiz-option="b"]').click();
  await quiz.waitFor({ state: "hidden", timeout: 3_000 });
  await waitForDebug(page, ({ expectedIncident, expectedAction, expectedRobot }) => {
    const game = window.__PIXEL_PANIC_DEBUG__?.game;
    return game?.robots?.[expectedRobot]?.status === "idle" && game?.incidents?.[expectedIncident]?.completedActions?.includes(expectedAction);
  }, { expectedIncident: incidentId, expectedAction: actionId, expectedRobot: robot.toLowerCase() }, 3_000);
}
