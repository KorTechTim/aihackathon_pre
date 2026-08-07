import { randomUUID } from "node:crypto";
import { BOMB_WIRES, fallbackBombHint, normalizeBombHint, type BombHintRequest, type BombHintResponse } from "../bomb-defusal";
import { extractVercelClientIp, type OciProxyConfig } from "./oci-plan-client";

type BombHintProxyOptions = {
  config: OciProxyConfig;
  fetchImpl?: typeof fetch;
  createRequestId?: () => string;
  logger?: (record: { requestId: string; attempt: number; source: "openai" | "fallback"; upstreamStatus: number | null }) => void;
};

type BombHintDegradedReason = "OCI_NOT_CONFIGURED" | "OCI_TIMEOUT" | "OCI_UNAVAILABLE" | "OCI_RATE_LIMITED" | "OCI_INVALID_RESPONSE";

function isBombHintRequest(value: unknown): value is BombHintRequest {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<BombHintRequest>;
  return BOMB_WIRES.includes(input.correctWire as BombHintRequest["correctWire"])
    && Number.isInteger(input.attempt) && (input.attempt ?? 0) >= 1 && (input.attempt ?? 100) <= 99
    && Number.isInteger(input.dangerLevel) && [1, 2, 3].includes(input.dangerLevel ?? 0)
    && input.language === "ko";
}

export async function handleBombHintProxyRequest(request: Request, options: BombHintProxyOptions): Promise<Response> {
  const requestId = options.createRequestId?.() ?? randomUUID();
  let input: unknown;
  try { input = await request.json(); }
  catch { return Response.json({ error: "올바른 폭탄 힌트 요청이 필요합니다.", code: "INVALID_JSON", requestId }, { status: 400 }); }
  if (!isBombHintRequest(input)) return Response.json({ error: "폭탄 힌트 요청 형식이 올바르지 않습니다.", code: "INVALID_BOMB_HINT_REQUEST", requestId }, { status: 400 });

  let upstreamStatus: number | null = null;
  const record = (result: BombHintResponse) => {
    const response = { ...result, requestId };
    options.logger?.({ requestId, attempt: input.attempt, source: response.source, upstreamStatus });
    return Response.json(response, { headers: { "X-Request-Id": requestId, "X-Pixel-Panic-Backend": "vercel-oci-proxy" } });
  };
  const fallback = (reason: BombHintDegradedReason) => record(fallbackBombHint(input.correctWire, input.attempt, reason));
  if (!options.config.backendUrl || !options.config.backendToken) return fallback("OCI_NOT_CONFIGURED");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(options.config.timeoutMs, 5_000));
  try {
    const response = await (options.fetchImpl ?? fetch)(`${options.config.backendUrl}/api/bomb-hint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.config.backendToken}`,
        "X-Request-Id": requestId,
        "X-Forwarded-For": extractVercelClientIp(request.headers),
      },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: controller.signal,
    });
    upstreamStatus = response.status;
    if (response.status === 429) return fallback("OCI_RATE_LIMITED");
    if (!response.ok) return fallback("OCI_UNAVAILABLE");
    const text = await response.text();
    if (text.length > 4_096) return fallback("OCI_INVALID_RESPONSE");
    let decoded: unknown;
    try { decoded = JSON.parse(text); }
    catch { return fallback("OCI_INVALID_RESPONSE"); }
    const normalized = normalizeBombHint(decoded);
    const source = (decoded as { source?: unknown }).source;
    if (!normalized || source !== "openai" && source !== "fallback") return fallback("OCI_INVALID_RESPONSE");
    return record({ ...normalized, source });
  } catch {
    return fallback(controller.signal.aborted ? "OCI_TIMEOUT" : "OCI_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }
}
