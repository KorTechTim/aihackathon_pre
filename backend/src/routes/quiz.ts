import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
import { requireBackendAuth } from "../middleware/backend-auth.js";
import { IpRateLimiter } from "../middleware/rate-limit.js";
import { MAX_EXCLUDED_QUIZ_QUESTIONS, MAX_QUIZ_SEQUENCE, QUIZ_ACTION_IDS, QUIZ_DIFFICULTIES, QUIZ_FOCUSES, QUIZ_INCIDENT_IDS, QUIZ_ROBOT_IDS, type QuizInput } from "../schemas/quiz.js";
import type { QuizWriter } from "../services/openai-quiz.js";

const bodySchema = {
  type: "object", additionalProperties: false,
  required: ["incidentId", "incidentLabel", "incidentType", "actionId", "actionLabel", "robotId", "wave", "severity", "quizSequence", "difficulty", "questionFocus", "variationSeed", "excludedQuestions", "language"],
  properties: {
    incidentId: { type: "string", enum: [...QUIZ_INCIDENT_IDS] },
    incidentLabel: { type: "string", minLength: 2, maxLength: 40 },
    incidentType: { type: "string", minLength: 2, maxLength: 30 },
    actionId: { type: "string", enum: [...QUIZ_ACTION_IDS] },
    actionLabel: { type: "string", minLength: 2, maxLength: 40 },
    robotId: { type: "string", enum: [...QUIZ_ROBOT_IDS] },
    wave: { type: "integer", minimum: 1, maximum: 3 },
    severity: { type: "integer", minimum: 1, maximum: 3 },
    quizSequence: { type: "integer", minimum: 1, maximum: MAX_QUIZ_SEQUENCE },
    difficulty: { type: "string", enum: [...QUIZ_DIFFICULTIES] },
    questionFocus: { type: "string", enum: [...QUIZ_FOCUSES] },
    variationSeed: { type: "integer", minimum: 0, maximum: 2_147_483_647 },
    excludedQuestions: { type: "array", maxItems: MAX_EXCLUDED_QUIZ_QUESTIONS, items: { type: "string", minLength: 10, maxLength: 120 } },
    language: { type: "string", const: "ko" },
  },
} as const;

export function registerQuizRoute(app: FastifyInstance, options: { config: AppConfig; writer: QuizWriter }) {
  const limiter = new IpRateLimiter(options.config.rateLimitMax, options.config.rateLimitWindowMs, options.config.rateLimitBurst);
  app.post<{ Body: QuizInput }>("/api/quiz", { onRequest: requireBackendAuth(options.config), schema: { body: bodySchema } }, async (request, reply) => {
    const rate = limiter.enter(request.ip);
    if (!rate.allowed) {
      reply.header("Retry-After", String(rate.retryAfterSeconds));
      return reply.status(429).send({ error: "요청이 너무 많습니다.", code: "RATE_LIMITED", requestId: request.id });
    }
    try {
      const result = await options.writer.write(request.body);
      request.log.info({ requestId: request.id, incidentId: request.body.incidentId, actionId: request.body.actionId, source: result.source }, "quiz_request");
      return { ...result, requestId: request.id };
    } finally {
      rate.release();
    }
  });
}
