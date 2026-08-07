import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
import { requireBackendAuth } from "../middleware/backend-auth.js";
import { IpRateLimiter } from "../middleware/rate-limit.js";
import { BOMB_WIRES, type BombHintInput } from "../schemas/bomb-hint.js";
import type { BombHintWriter } from "../services/openai-bomb-hint.js";

const bodySchema = {
  type: "object",
  required: ["correctWire", "attempt", "dangerLevel", "language"],
  additionalProperties: false,
  properties: {
    correctWire: { type: "string", enum: [...BOMB_WIRES] },
    attempt: { type: "integer", minimum: 1, maximum: 99 },
    dangerLevel: { type: "integer", minimum: 1, maximum: 3 },
    language: { type: "string", const: "ko" },
  },
} as const;

export function registerBombHintRoute(app: FastifyInstance, options: { config: AppConfig; writer: BombHintWriter }) {
  const limiter = new IpRateLimiter(options.config.rateLimitMax, options.config.rateLimitWindowMs, options.config.rateLimitBurst);
  app.post<{ Body: BombHintInput }>("/api/bomb-hint", {
    onRequest: requireBackendAuth(options.config),
    schema: { body: bodySchema },
  }, async (request, reply) => {
    const rate = limiter.enter(request.ip);
    if (!rate.allowed) {
      reply.header("Retry-After", String(rate.retryAfterSeconds));
      return reply.status(429).send({ error: "요청이 너무 많습니다.", code: "RATE_LIMITED", requestId: request.id });
    }
    try {
      const result = await options.writer.write(request.body);
      request.log.info({ requestId: request.id, attempt: request.body.attempt, source: result.source }, "bomb_hint_request");
      return { ...result, requestId: request.id };
    } finally {
      rate.release();
    }
  });
}
