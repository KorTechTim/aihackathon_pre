import { spawn } from "node:child_process";

const port = process.env.QA_PORT ?? "3100";
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["start", "--", "-p", port], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PORT: port } });
server.stdout.on("data", (chunk) => process.stdout.write(`[server] ${chunk}`));
server.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { const response = await fetch(baseUrl); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Next.js QA server did not become ready");
}

async function run(script) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { stdio: "inherit", env: { ...process.env, BASE_URL: baseUrl } });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${script} exited with ${code}`)));
    child.on("error", reject);
  });
}

try {
  await waitForServer();
  for (const script of ["scripts/smoke_phase3_4.mjs", "scripts/smoke_full_flow.mjs", "scripts/smoke_fallback.mjs", "scripts/smoke_termination_races.mjs"]) await run(script);
  console.log("All browser QA suites PASSED");
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => { server.once("exit", resolve); setTimeout(resolve, 2_000); });
}
