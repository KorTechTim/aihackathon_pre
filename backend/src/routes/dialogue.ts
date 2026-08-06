import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
import { requireBackendAuth } from "../middleware/backend-auth.js";
import { IpRateLimiter } from "../middleware/rate-limit.js";
import { DIALOGUE_SITUATIONS, MAX_EXCLUDED_NPC_DIALOGUES, MAX_NPC_DIALOGUE_SEQUENCE, NPC_DIALOGUE_SITUATIONS, type DialogueInput } from "../schemas/dialogue.js";
import type { DialogueWriter } from "../services/openai-dialogue.js";

const bodySchema = {
  type: "object",
  required: ["speaker", "personality", "situation", "facts", "choiceIds", "language"],
  additionalProperties: false,
  properties: {
    speaker: { type: "string", enum: ["AQUA", "FIX", "BUDDY", "주민"] },
    personality: { type: "string", minLength: 2, maxLength: 40 },
    situation: { type: "string", enum: [...DIALOGUE_SITUATIONS] },
    facts: { type: "object", additionalProperties: { anyOf: [{ type: "string", maxLength: 80 }, { type: "number" }, { type: "boolean" }] }, maxProperties: 12 },
    choiceIds: { type: "array", minItems: 0, maxItems: 3, uniqueItems: true, items: { type: "string", minLength: 2, maxLength: 40 } },
    dialogueSequence: { type: "integer", minimum: 1, maximum: MAX_NPC_DIALOGUE_SEQUENCE },
    excludedDialogues: { type: "array", maxItems: MAX_EXCLUDED_NPC_DIALOGUES, items: { type: "string", minLength: 2, maxLength: 160 } },
    language: { type: "string", const: "ko" },
  },
  allOf: [{
    if: { properties: { situation: { enum: [...NPC_DIALOGUE_SITUATIONS] } }, required: ["situation"] },
    then: { required: ["dialogueSequence", "excludedDialogues"], properties: { speaker: { const: "주민" }, choiceIds: { type: "array", maxItems: 0 } } },
    else: { properties: { choiceIds: { type: "array", minItems: 2 } } },
  }],
} as const;

export function registerDialogueRoute(app: FastifyInstance, options: { config: AppConfig; writer: DialogueWriter }) {
  const limiter = new IpRateLimiter(options.config.rateLimitMax, options.config.rateLimitWindowMs, options.config.rateLimitBurst);
  app.post<{ Body: DialogueInput }>("/api/dialogue", {
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
      request.log.info({ requestId: request.id, situation: request.body.situation, source: result.source }, "dialogue_request");
      return { ...result, requestId: request.id };
    } finally {
      rate.release();
    }
  });
}
