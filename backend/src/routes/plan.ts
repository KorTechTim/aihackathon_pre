import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
import { requireBackendAuth } from "../middleware/backend-auth.js";
import { IpRateLimiter } from "../middleware/rate-limit.js";
import type { RescuePlanner } from "../services/openai-planner.js";
import { PlanCache } from "../services/plan-cache.js";

export type AuditRecord = {
  requestId: string;
  commandLength: number;
  durationMs: number;
  source: "openai" | "fallback" | "rate_limited";
  statusCode: number;
  cacheHit: boolean;
};

const bodySchema = {
  type: "object",
  required: ["command"],
  additionalProperties: false,
  properties: { command: { type: "string", minLength: 2, maxLength: 500 } },
} as const;

export function registerPlanRoute(app: FastifyInstance, options: { config: AppConfig; planner: RescuePlanner; audit?: (record: AuditRecord) => void }) {
  const { config, planner, audit } = options;
  const limiter = new IpRateLimiter(config.rateLimitMax, config.rateLimitWindowMs, config.rateLimitBurst);
  const cache = new PlanCache(config.planCacheTtlMs, config.planCacheMax);

  app.post<{ Body: { command: string } }>("/v1/plan", {
    onRequest: requireBackendAuth(config),
    schema: { body: bodySchema },
  }, async (request, reply) => {
    const startedAt = Date.now();
    const command = request.body.command.trim();
    if (command.length < 2) return reply.status(400).send({ error: "command는 2~500자로 입력해주세요.", code: "INVALID_COMMAND", requestId: request.id });

    const rate = limiter.enter(request.ip);
    if (!rate.allowed) {
      reply.header("Retry-After", String(rate.retryAfterSeconds));
      audit?.({ requestId: request.id, commandLength: command.length, durationMs: Date.now() - startedAt, source: "rate_limited", statusCode: 429, cacheHit: false });
      return reply.status(429).send({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", code: "RATE_LIMITED", requestId: request.id });
    }

    try {
      const cached = cache.get(command);
      if (cached) {
        audit?.({ requestId: request.id, commandLength: command.length, durationMs: Date.now() - startedAt, source: cached.source, statusCode: 200, cacheHit: true });
        request.log.info({ requestId: request.id, commandLength: command.length, durationMs: Date.now() - startedAt, source: cached.source, statusCode: 200, cacheHit: true }, "plan_request");
        return { ...cached, requestId: request.id };
      }

      const result = await planner.plan(command);
      cache.set(command, result);
      const durationMs = Date.now() - startedAt;
      audit?.({ requestId: request.id, commandLength: command.length, durationMs, source: result.source, statusCode: 200, cacheHit: false });
      request.log.info({ requestId: request.id, commandLength: command.length, durationMs, source: result.source, statusCode: 200, cacheHit: false }, "plan_request");
      return { ...result, requestId: request.id };
    } finally {
      rate.release();
    }
  });
}
