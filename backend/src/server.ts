import { pathToFileURL } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { loadConfig, type AppConfig } from "./config.js";
import { registerErrorHandler } from "./middleware/error-handler.js";
import { generateRequestId } from "./middleware/request-id.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerDialogueRoute } from "./routes/dialogue.js";
import { registerQuizRoute } from "./routes/quiz.js";
import { registerNewsRoute } from "./routes/news.js";
import { registerBombHintRoute } from "./routes/bomb-hint.js";
import { registerPlanRoute, type AuditRecord } from "./routes/plan.js";
import { createOpenAIDialogueWriter, type DialogueWriter } from "./services/openai-dialogue.js";
import { createOpenAIQuizWriter, type QuizWriter } from "./services/openai-quiz.js";
import { createOpenAINewsWriter, type NewsWriter } from "./services/openai-news.js";
import { createOpenAIBombHintWriter, type BombHintWriter } from "./services/openai-bomb-hint.js";
import { createOpenAIPlanner, type RescuePlanner } from "./services/openai-planner.js";

export async function buildServer(options: { config?: AppConfig; planner?: RescuePlanner; dialogueWriter?: DialogueWriter; quizWriter?: QuizWriter; newsWriter?: NewsWriter; bombHintWriter?: BombHintWriter; audit?: (record: AuditRecord) => void; logger?: boolean } = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const app = Fastify({
    logger: options.logger ?? config.nodeEnv !== "test",
    trustProxy: config.trustProxyHops,
    genReqId: generateRequestId,
    bodyLimit: 4_096,
    requestTimeout: 8_000,
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Request-Id", request.id);
  });

  registerErrorHandler(app);
  registerHealthRoute(app, config);
  registerPlanRoute(app, { config, planner: options.planner ?? createOpenAIPlanner(config), audit: options.audit });
  registerDialogueRoute(app, { config, writer: options.dialogueWriter ?? createOpenAIDialogueWriter(config) });
  registerQuizRoute(app, { config, writer: options.quizWriter ?? createOpenAIQuizWriter(config) });
  registerNewsRoute(app, { config, writer: options.newsWriter ?? createOpenAINewsWriter(config) });
  registerBombHintRoute(app, { config, writer: options.bombHintWriter ?? createOpenAIBombHintWriter(config) });
  return app;
}

async function main() {
  const config = loadConfig();
  const app = await buildServer({ config });
  const shutdown = async () => { await app.close(); process.exit(0); };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
  await app.listen({ host: config.host, port: config.port });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: { name?: string }) => {
    console.error(JSON.stringify({ level: "fatal", event: "startup_failed", errorName: error?.name ?? "Error" }));
    process.exit(1);
  });
}
