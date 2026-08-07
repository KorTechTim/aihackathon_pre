import { randomUUID } from "node:crypto";
import { NPC_DIALOGUES, NPC_DIALOGUE_IDS } from "../npc-dialogue";
import { COMBOS, INCIDENTS, INCIDENT_IDS } from "../rescue-engine";
import { fallbackResultNews, normalizeResultNews, type ResultNewsRequest, type ResultNewsResponse } from "../result-news";
import { extractVercelClientIp, type OciProxyConfig } from "./oci-plan-client";

type NewsDegradedReason = "OCI_NOT_CONFIGURED" | "OCI_TIMEOUT" | "OCI_UNAVAILABLE" | "OCI_RATE_LIMITED" | "OCI_INVALID_RESPONSE";
type NewsProxyOptions = {
  config: OciProxyConfig;
  fetchImpl?: typeof fetch;
  createRequestId?: () => string;
  logger?: (record: { requestId: string; status: ResultNewsRequest["status"]; source: "openai" | "fallback"; upstreamStatus: number | null }) => void;
};

function isStringArray(value: unknown, allowed: ReadonlySet<string>, maximum: number): value is string[] {
  return Array.isArray(value) && value.length <= maximum && value.every((item) => typeof item === "string" && allowed.has(item));
}

function isResultNewsRequest(value: unknown): value is ResultNewsRequest {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<ResultNewsRequest>;
  const npc = NPC_DIALOGUE_IDS.includes(input.intervieweeId as ResultNewsRequest["intervieweeId"])
    ? NPC_DIALOGUES[input.intervieweeId as ResultNewsRequest["intervieweeId"]]
    : null;
  const incidentLabels = new Set(INCIDENT_IDS.map((id) => INCIDENTS[id].label));
  const comboLabels = new Set(COMBOS.map((combo) => combo.label));
  const resolvedIncidents = input.resolvedIncidents;
  const unresolvedIncidents = input.unresolvedIncidents;
  const resolvedValid = isStringArray(resolvedIncidents, incidentLabels, INCIDENT_IDS.length);
  const unresolvedValid = isStringArray(unresolvedIncidents, incidentLabels, INCIDENT_IDS.length);
  const allIncidentLabels = resolvedValid && unresolvedValid ? [...resolvedIncidents, ...unresolvedIncidents] : [];
  const editionValid = input.edition === "stage"
    ? (input.completedWave === 1 || input.completedWave === 2) && input.status === "success"
    : input.edition === "final" && input.completedWave === null;
  return editionValid
    && ["success", "failure"].includes(input.status ?? "")
    && ["completed", "timeout", "village_lost", "abandoned"].includes(input.finishReason ?? "")
    && (input.status === "success" ? input.finishReason === "completed" : input.finishReason !== "completed")
    && ["S", "A", "B", "C"].includes(input.grade ?? "")
    && Number.isInteger(input.score) && (input.score ?? 0) >= -5_000 && (input.score ?? 0) <= 100_000
    && Number.isInteger(input.villagePreservation) && (input.villagePreservation ?? -1) >= 0 && (input.villagePreservation ?? 101) <= 100
    && Number.isInteger(input.rescuedResidents) && (input.rescuedResidents ?? -1) >= 0 && (input.rescuedResidents ?? 51) <= 50
    && resolvedValid && unresolvedValid && allIncidentLabels.length === INCIDENT_IDS.length && new Set(allIncidentLabels).size === INCIDENT_IDS.length
    && isStringArray(input.comboLabels, comboLabels, COMBOS.length)
    && Number.isInteger(input.maxCombo) && (input.maxCombo ?? -1) >= 0 && (input.maxCombo ?? 11) <= 10
    && Number.isInteger(input.remainingSeconds) && (input.remainingSeconds ?? -1) >= 0 && (input.remainingSeconds ?? 211) <= 210
    && typeof input.catRescued === "boolean"
    && Number.isInteger(input.preventedSpreads) && (input.preventedSpreads ?? -1) >= 0 && (input.preventedSpreads ?? 21) <= 20
    && Number.isInteger(input.actionCount) && (input.actionCount ?? -1) >= 0 && (input.actionCount ?? 41) <= 40
    && Boolean(npc) && input.intervieweeName === npc?.name && input.intervieweeRole === npc?.role && input.intervieweeTraits === npc?.characterTraits
    && input.language === "ko";
}

export async function handleNewsProxyRequest(request: Request, options: NewsProxyOptions): Promise<Response> {
  const requestId = options.createRequestId?.() ?? randomUUID();
  let input: unknown;
  try { input = await request.json(); }
  catch { return Response.json({ error: "올바른 뉴스 요청이 필요합니다.", code: "INVALID_JSON", requestId }, { status: 400 }); }
  if (!isResultNewsRequest(input)) return Response.json({ error: "뉴스 요청 형식이 올바르지 않습니다.", code: "INVALID_NEWS_REQUEST", requestId }, { status: 400 });

  let upstreamStatus: number | null = null;
  const record = (result: ResultNewsResponse) => {
    const response = { ...result, requestId };
    options.logger?.({ requestId, status: input.status, source: response.source, upstreamStatus });
    return Response.json(response, { headers: { "X-Request-Id": requestId, "X-Pixel-Panic-Backend": "vercel-oci-proxy" } });
  };
  const fallback = (reason: NewsDegradedReason) => record(fallbackResultNews(input, reason));
  if (!options.config.backendUrl || !options.config.backendToken) return fallback("OCI_NOT_CONFIGURED");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(options.config.timeoutMs, 5_000));
  try {
    const response = await (options.fetchImpl ?? fetch)(`${options.config.backendUrl}/api/news`, {
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
    if (text.length > 8_192) return fallback("OCI_INVALID_RESPONSE");
    let decoded: unknown;
    try { decoded = JSON.parse(text); }
    catch { return fallback("OCI_INVALID_RESPONSE"); }
    const candidate = decoded as { source?: unknown };
    const normalized = normalizeResultNews(decoded);
    if (!normalized || candidate.source !== "openai" && candidate.source !== "fallback") return fallback("OCI_INVALID_RESPONSE");
    return record({ ...normalized, source: candidate.source });
  } catch {
    return fallback(controller.signal.aborted ? "OCI_TIMEOUT" : "OCI_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }
}
