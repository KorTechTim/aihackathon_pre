import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";

const trackedFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const textFiles = trackedFiles.flatMap((file) => {
  if (!existsSync(file) || lstatSync(file).isDirectory() || lstatSync(file).isSymbolicLink()) return [];
  const content = readFileSync(file);
  return content.includes(0) ? [] : [{ file, text: content.toString("utf8") }];
});
const findText = (needle) => textFiles.filter(({ text }) => text.includes(needle)).map(({ file }) => file);

const publicOciAddressVariable = ["NEXT", "PUBLIC", "API", "BASE", "URL"].join("_");
const retiredGatewaySlug = ["api", "gateway"].join("-");
const retiredGatewayName = ["API", "Gateway"].join(" ");
assert.deepEqual(findText(publicOciAddressVariable), [], "Public OCI address variable must not be tracked");
assert.deepEqual(findText(retiredGatewaySlug), [], "Retired gateway slug must not be tracked");
assert.deepEqual(findText(retiredGatewayName), [], "Retired gateway documentation must not be tracked");

const trackedSecrets = textFiles.filter(({ text }) => /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/.test(text)).map(({ file }) => file);
assert.deepEqual(trackedSecrets, [], "OpenAI-style secret found in a tracked file");
assert.deepEqual(trackedFiles.filter((file) => file.endsWith(".env.production") || file.endsWith("/backend.env") || file === "backend.env"), [], "Production secret file is tracked");

const publicSecretNames = textFiles.filter(({ text }) => /NEXT_PUBLIC_[A-Z0-9_]*(?:KEY|TOKEN|SECRET)/.test(text)).map(({ file }) => file);
assert.deepEqual(publicSecretNames, [], "Public environment variable name looks secret");

const nextRoutes = ["app/api/plan/route.ts", "app/api/dialogue/route.ts", "app/api/quiz/route.ts", "app/api/bomb-hint/route.ts", "app/api/news/route.ts"].map((file) => readFileSync(file, "utf8")).join("\n");
const openAiKeyName = ["OPENAI", "API", "KEY"].join("_");
assert.equal(nextRoutes.includes(openAiKeyName), false, "Vercel Routes must not read the OpenAI key");
assert.equal(nextRoutes.includes('from "openai"'), false, "Vercel Routes must not import the OpenAI SDK");

const page = readFileSync("app/page.tsx", "utf8");
assert.equal(page.includes("OCI_BACKEND"), false, "Client page must not read OCI server configuration");
assert.match(page, /fetch\("\/api\/dialogue"/);
assert.match(page, /fetch\("\/api\/quiz"/);
assert.match(page, /fetch\("\/api\/bomb-hint"/);
assert.match(page, /fetch\("\/api\/news"/);
assert.equal(/<(?:input|textarea)\b/i.test(page), false, "Client game must remain click/touch only");

const rootPackage = JSON.parse(readFileSync("package.json", "utf8"));
const backendPackage = JSON.parse(readFileSync("backend/package.json", "utf8"));
assert.equal(rootPackage.engines.node, ">=20 <23");
assert.equal(backendPackage.engines.node, ">=20 <23");

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
assert.match(workflow, /node-version: "20\./);
assert.match(workflow, /python-version: "3\.12"/);
assert.match(workflow, /npm run ci:docker/);

const bootstrap = readFileSync("scripts/bootstrap_dev.sh", "utf8");
assert.match(bootstrap, /node_major.*-ge 23/s);
assert.match(bootstrap, /sys\.version_info >= \(3, 10\)/);

const readme = readFileSync("README.md", "utf8");
assert.match(readme, /Python `>=3\.10`/);
assert.match(readme, /키보드나 자연어 입력 없이/);
assert.match(readme, /GPT-5\.6은 NPC·로봇 대사, 현장별 안전 상식 퀴즈와 결과 뉴스를 생성/);

console.log(`Repository policy PASSED: ${trackedFiles.length} tracked files checked`);
