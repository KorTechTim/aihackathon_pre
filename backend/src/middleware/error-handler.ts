import type { FastifyInstance } from "fastify";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    const safeError = error as { code?: string; name?: string; validation?: unknown };
    const invalidJson = safeError.code === "FST_ERR_CTP_INVALID_JSON_BODY";
    const invalidCommand = Boolean(safeError.validation);
    const statusCode = invalidJson || invalidCommand ? 400 : 500;
    request.log.error({ requestId: request.id, errorName: safeError.name, errorCode: safeError.code, statusCode }, "request_failed");
    if (invalidJson) return reply.status(400).send({ error: "올바른 JSON 요청이 필요합니다.", code: "INVALID_JSON", requestId: request.id });
    if (invalidCommand) return reply.status(400).send({ error: "command는 2~500자로 입력해주세요.", code: "INVALID_COMMAND", requestId: request.id });
    return reply.status(500).send({ error: "서버 오류가 발생했습니다.", code: "INTERNAL_ERROR", requestId: request.id });
  });
}
