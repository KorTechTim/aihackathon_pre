import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "../config.js";

function validBearerToken(authorization: string | undefined, expected: string): boolean {
  if (!authorization?.startsWith("Bearer ") || !expected) return false;
  const received = Buffer.from(authorization.slice("Bearer ".length), "utf8");
  const configured = Buffer.from(expected, "utf8");
  return received.length === configured.length && timingSafeEqual(received, configured);
}

export function requireBackendAuth(config: AppConfig) {
  return async function backendAuth(request: FastifyRequest, reply: FastifyReply) {
    if (validBearerToken(request.headers.authorization, config.backendSharedToken)) return;
    request.log.warn({ requestId: request.id, code: "UNAUTHORIZED" }, "backend_auth_failed");
    return reply.status(401).send({
      error: "인증되지 않은 요청입니다.",
      code: "UNAUTHORIZED",
      requestId: request.id,
    });
  };
}
