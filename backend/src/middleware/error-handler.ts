import type { FastifyInstance } from "fastify";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    const safeError = error as { code?: string; name?: string; validation?: unknown };
    const invalidJson = safeError.code === "FST_ERR_CTP_INVALID_JSON_BODY";
    const invalidRequest = Boolean(safeError.validation);
    const statusCode = invalidJson || invalidRequest ? 400 : 500;
    request.log.error({ requestId: request.id, errorName: safeError.name, errorCode: safeError.code, statusCode }, "request_failed");
    if (invalidJson) return reply.status(400).send({ error: "올바른 JSON 요청이 필요합니다.", code: "INVALID_JSON", requestId: request.id });
    if (invalidRequest) {
      const isPlan = request.url.startsWith("/v1/plan");
      return reply.status(400).send({ error: isPlan ? "command는 2~500자로 입력해주세요." : "대화 요청 형식이 올바르지 않습니다.", code: isPlan ? "INVALID_COMMAND" : "INVALID_DIALOGUE_REQUEST", requestId: request.id });
    }
    return reply.status(500).send({ error: "서버 오류가 발생했습니다.", code: "INTERNAL_ERROR", requestId: request.id });
  });
}
