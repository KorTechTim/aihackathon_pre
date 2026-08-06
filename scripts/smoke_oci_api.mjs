import assert from "node:assert/strict";

const baseUrl = process.env.OCI_BACKEND_URL?.replace(/\/$/, "");
const token = process.env.OCI_BACKEND_TOKEN;
if (!baseUrl) {
  console.log("OCI backend smoke SKIPPED: provide OCI_BACKEND_URL through a secure environment");
  process.exit(0);
}

const started = Date.now();
const health = await fetch(`${baseUrl}/health`);
assert.equal(health.status, 200);
const healthBody = await health.json();
assert.equal(healthBody.status, "ok");
assert.equal(healthBody.service, "pixel-panic-api");

const unauthorized = await fetch(`${baseUrl}/v1/plan`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ command: "화재를 먼저 진압해줘" }),
});
assert.equal(unauthorized.status, 401);
assert.equal((await unauthorized.json()).code, "UNAUTHORIZED");

if (!token) {
  console.log("OCI backend health/auth PASSED; authenticated checks skipped because the secure token is unavailable");
  process.exit(0);
}

const authorizedHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
const invalid = await fetch(`${baseUrl}/v1/plan`, {
  method: "POST",
  headers: authorizedHeaders,
  body: JSON.stringify({ command: "가" }),
});
assert.equal(invalid.status, 400);
assert.equal((await invalid.json()).code, "INVALID_COMMAND");

if (process.env.RUN_LIVE_AI_TEST === "1") {
  const response = await fetch(`${baseUrl}/v1/plan`, {
    method: "POST",
    headers: authorizedHeaders,
    body: JSON.stringify({ command: "고양이를 먼저 구조해줘" }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(["openai", "fallback"].includes(body.source), true);
  assert.deepEqual(new Set(body.plan.priority), new Set(["fire", "bridge", "cat", "generator"]));
  assert.equal(typeof body.requestId, "string");
  assert.equal(Date.now() - started < 8_000, true);
  console.log(`OCI backend live plan PASSED: source=${body.source}`);
} else {
  console.log("OCI backend health/auth/validation PASSED; paid plan call skipped");
}
