import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { FALLBACK_PLAN, normalizeRescuePlan, type RescuePlan } from "../game-state";

export type OciDegradedReason =
  | "OCI_NOT_CONFIGURED"
  | "OCI_TIMEOUT"
  | "OCI_UNAVAILABLE"
  | "OCI_RATE_LIMITED"
  | "OCI_INVALID_RESPONSE";

export type PlanProxyResponse = {
  plan: RescuePlan;
  source: "openai" | "fallback";
  degradedReason?: OciDegradedReason;
  requestId: string;
};

export type OciProxyConfig = {
  backendUrl?: string;
  backendToken?: string;
  timeoutMs: number;
};

export type OciProxyLogRecord = {
  requestId: string;
  commandLength: number;
  durationMs: number;
  upstreamStatus: number | null;
  source: "openai" | "fallback";
};

type PlanProxyOptions = {
  config: OciProxyConfig;
  fetchImpl?: typeof fetch;
  logger?: (record: OciProxyLogRecord) => void;
  createRequestId?: () => string;
};

function positiveInt(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export function loadOciProxyConfig(env: Readonly<Record<string, string | undefined>> = process.env): OciProxyConfig {
  const rawUrl = env.OCI_BACKEND_URL?.trim();
  let backendUrl: string | undefined;
  if (rawUrl) {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("OCI_BACKEND_URL must use http or https");
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error("OCI_BACKEND_URL must not contain credentials, query, or fragment");
    }
    backendUrl = parsed.toString().replace(/\/$/, "");
  }

  const backendToken = env.OCI_BACKEND_TOKEN || undefined;
  if (backendToken && (Buffer.byteLength(backendToken, "utf8") < 32 || /\s/.test(backendToken))) {
    throw new Error("OCI_BACKEND_TOKEN must be at least 32 bytes and contain no whitespace");
  }

  return {
    backendUrl,
    backendToken,
    timeoutMs: positiveInt(env.OCI_BACKEND_TIMEOUT_MS, 6_500, 30_000),
  };
}

export function extractVercelClientIp(headers: Headers): string {
  for (const name of ["x-vercel-forwarded-for", "x-forwarded-for", "x-real-ip"]) {
    const candidate = headers.get(name)?.split(",", 1)[0]?.trim();
    if (candidate && isIP(candidate)) return candidate;
  }
  return "0.0.0.0";
}

function fallback(requestId: string, degradedReason: OciDegradedReason): PlanProxyResponse {
  return { plan: FALLBACK_PLAN, source: "fallback", degradedReason, requestId };
}

async function requestPlan(
  command: string,
  requestId: string,
  clientIp: string,
  options: PlanProxyOptions,
): Promise<PlanProxyResponse> {
  const { config } = options;
  const startedAt = Date.now();
  let upstreamStatus: number | null = null;
  const record = (result: PlanProxyResponse) => {
    const entry: OciProxyLogRecord = {
      requestId,
      commandLength: command.length,
      durationMs: Date.now() - startedAt,
      upstreamStatus,
      source: result.source,
    };
    if (options.logger) options.logger(entry);
    else console.info("plan_proxy", entry);
    return result;
  };

  if (!config.backendUrl || !config.backendToken) return record(fallback(requestId, "OCI_NOT_CONFIGURED"));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await (options.fetchImpl ?? fetch)(`${config.backendUrl}/v1/plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.backendToken}`,
        "X-Request-Id": requestId,
        "X-Forwarded-For": clientIp,
      },
      body: JSON.stringify({ command }),
      cache: "no-store",
      signal: controller.signal,
    });
    upstreamStatus = response.status;
    if (response.status === 429) return record(fallback(requestId, "OCI_RATE_LIMITED"));
    if (!response.ok) return record(fallback(requestId, "OCI_UNAVAILABLE"));

    const rawBody = await response.text();
    if (rawBody.length > 32_768) return record(fallback(requestId, "OCI_INVALID_RESPONSE"));
    let decoded: unknown;
    try { decoded = JSON.parse(rawBody); }
    catch { return record(fallback(requestId, "OCI_INVALID_RESPONSE")); }
    if (!decoded || typeof decoded !== "object") return record(fallback(requestId, "OCI_INVALID_RESPONSE"));
    const candidate = decoded as { plan?: unknown; source?: unknown };
    const plan = normalizeRescuePlan(candidate.plan);
    if (!plan || candidate.source !== "openai" && candidate.source !== "fallback") {
      return record(fallback(requestId, "OCI_INVALID_RESPONSE"));
    }
    return record({ plan, source: candidate.source, requestId });
  } catch {
    return record(fallback(requestId, controller.signal.aborted ? "OCI_TIMEOUT" : "OCI_UNAVAILABLE"));
  } finally {
    clearTimeout(timeout);
  }
}

export async function handlePlanProxyRequest(request: Request, options: PlanProxyOptions): Promise<Response> {
  const requestId = options.createRequestId?.() ?? randomUUID();
  let command = "";
  try {
    const body = await request.json() as { command?: unknown };
    command = typeof body.command === "string" ? body.command.trim() : "";
  } catch {
    return Response.json({ error: "올바른 명령을 입력해주세요.", code: "INVALID_JSON", requestId }, { status: 400 });
  }
  if (command.length < 2 || command.length > 500) {
    return Response.json({ error: "명령은 2~500자로 입력해주세요.", code: "INVALID_COMMAND", requestId }, { status: 400 });
  }

  const result = await requestPlan(command, requestId, extractVercelClientIp(request.headers), options);
  return Response.json(result, {
    headers: {
      "X-Request-Id": requestId,
      "X-Pixel-Panic-Backend": "vercel-oci-proxy",
    },
  });
}
