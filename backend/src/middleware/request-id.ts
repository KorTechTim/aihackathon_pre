import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,80}$/;

export function generateRequestId(request: IncomingMessage): string {
  const supplied = request.headers["x-request-id"];
  return typeof supplied === "string" && SAFE_REQUEST_ID.test(supplied) ? supplied : randomUUID();
}
