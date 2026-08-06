import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";

export function registerHealthRoute(app: FastifyInstance, config: AppConfig) {
  app.get("/health", async () => ({
    status: "ok",
    service: "pixel-panic-api",
    version: "0.2.0",
    openaiConfigured: Boolean(config.openaiApiKey),
    timestamp: new Date().toISOString(),
  }));
}
