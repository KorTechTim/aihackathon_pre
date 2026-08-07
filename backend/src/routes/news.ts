import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
import { requireBackendAuth } from "../middleware/backend-auth.js";
import { IpRateLimiter } from "../middleware/rate-limit.js";
import { NEWS_COMBO_LABELS, NEWS_FINISH_REASONS, NEWS_GRADES, NEWS_INCIDENT_LABELS, NEWS_INTERVIEWEE_IDS, isNewsIntervieweeValid, type NewsInput } from "../schemas/news.js";
import type { NewsWriter } from "../services/openai-news.js";

const bodySchema = {
  type: "object", additionalProperties: false,
  required: ["status", "finishReason", "grade", "score", "villagePreservation", "rescuedResidents", "resolvedIncidents", "unresolvedIncidents", "comboLabels", "maxCombo", "remainingSeconds", "catRescued", "preventedSpreads", "actionCount", "intervieweeId", "intervieweeName", "intervieweeRole", "intervieweeTraits", "language"],
  properties: {
    status: { type: "string", enum: ["success", "failure"] },
    finishReason: { type: "string", enum: [...NEWS_FINISH_REASONS] },
    grade: { type: "string", enum: [...NEWS_GRADES] },
    score: { type: "integer", minimum: -5_000, maximum: 100_000 },
    villagePreservation: { type: "integer", minimum: 0, maximum: 100 },
    rescuedResidents: { type: "integer", minimum: 0, maximum: 50 },
    resolvedIncidents: { type: "array", maxItems: 10, uniqueItems: true, items: { type: "string", enum: [...NEWS_INCIDENT_LABELS] } },
    unresolvedIncidents: { type: "array", maxItems: 10, uniqueItems: true, items: { type: "string", enum: [...NEWS_INCIDENT_LABELS] } },
    comboLabels: { type: "array", maxItems: 5, uniqueItems: true, items: { type: "string", enum: [...NEWS_COMBO_LABELS] } },
    maxCombo: { type: "integer", minimum: 0, maximum: 10 },
    remainingSeconds: { type: "integer", minimum: 0, maximum: 210 },
    catRescued: { type: "boolean" },
    preventedSpreads: { type: "integer", minimum: 0, maximum: 20 },
    actionCount: { type: "integer", minimum: 0, maximum: 40 },
    intervieweeId: { type: "string", enum: [...NEWS_INTERVIEWEE_IDS] },
    intervieweeName: { type: "string", minLength: 1, maxLength: 10 },
    intervieweeRole: { type: "string", minLength: 2, maxLength: 30 },
    intervieweeTraits: { type: "string", minLength: 5, maxLength: 80 },
    language: { type: "string", const: "ko" },
  },
} as const;

export function registerNewsRoute(app: FastifyInstance, options: { config: AppConfig; writer: NewsWriter }) {
  const limiter = new IpRateLimiter(options.config.rateLimitMax, options.config.rateLimitWindowMs, options.config.rateLimitBurst);
  app.post<{ Body: NewsInput }>("/api/news", { onRequest: requireBackendAuth(options.config), schema: { body: bodySchema } }, async (request, reply) => {
    if (!isNewsIntervieweeValid(request.body)) return reply.status(400).send({ error: "인터뷰 대상 정보가 올바르지 않습니다.", code: "INVALID_NEWS_INTERVIEWEE", requestId: request.id });
    const incidentLabels = [...request.body.resolvedIncidents, ...request.body.unresolvedIncidents];
    if (incidentLabels.length !== NEWS_INCIDENT_LABELS.length || new Set(incidentLabels).size !== NEWS_INCIDENT_LABELS.length) {
      return reply.status(400).send({ error: "사고 기록이 올바르지 않습니다.", code: "INVALID_NEWS_INCIDENTS", requestId: request.id });
    }
    if (request.body.status === "success" ? request.body.finishReason !== "completed" : request.body.finishReason === "completed") {
      return reply.status(400).send({ error: "작전 결과가 올바르지 않습니다.", code: "INVALID_NEWS_OUTCOME", requestId: request.id });
    }
    const rate = limiter.enter(request.ip);
    if (!rate.allowed) {
      reply.header("Retry-After", String(rate.retryAfterSeconds));
      return reply.status(429).send({ error: "요청이 너무 많습니다.", code: "RATE_LIMITED", requestId: request.id });
    }
    try {
      const result = await options.writer.write(request.body);
      request.log.info({ requestId: request.id, status: request.body.status, source: result.source }, "news_request");
      return { ...result, requestId: request.id };
    } finally {
      rate.release();
    }
  });
}
