import { randomUUID } from "node:crypto";
import { ACTION_IDS, INCIDENT_IDS, ROBOT_IDS } from "../rescue-engine";
import {
  MAX_EXCLUDED_QUIZ_QUESTIONS,
  SAFETY_QUIZ_DIFFICULTIES,
  fallbackSafetyQuiz,
  isSafetyQuizQuestionExcluded,
  normalizeSafetyQuiz,
  type SafetyQuizRequest,
  type SafetyQuizResponse,
} from "../safety-quiz";
import { extractVercelClientIp, type OciProxyConfig } from "./oci-plan-client";

type QuizProxyOptions = {
  config: OciProxyConfig;
  fetchImpl?: typeof fetch;
  createRequestId?: () => string;
  logger?: (record: { requestId: string; incidentId: SafetyQuizRequest["incidentId"]; source: "openai" | "fallback"; upstreamStatus: number | null }) => void;
};

type QuizDegradedReason = "OCI_NOT_CONFIGURED" | "OCI_TIMEOUT" | "OCI_UNAVAILABLE" | "OCI_RATE_LIMITED" | "OCI_INVALID_RESPONSE";

function isQuizRequest(value: unknown): value is SafetyQuizRequest {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<SafetyQuizRequest>;
  return INCIDENT_IDS.includes(input.incidentId as SafetyQuizRequest["incidentId"])
    && typeof input.incidentLabel === "string" && input.incidentLabel.length >= 2 && input.incidentLabel.length <= 40
    && typeof input.incidentType === "string" && input.incidentType.length >= 2 && input.incidentType.length <= 30
    && ACTION_IDS.includes(input.actionId as SafetyQuizRequest["actionId"])
    && typeof input.actionLabel === "string" && input.actionLabel.length >= 2 && input.actionLabel.length <= 40
    && ROBOT_IDS.includes(input.robotId as SafetyQuizRequest["robotId"])
    && [1, 2, 3].includes(input.wave ?? 0)
    && Number.isInteger(input.severity) && (input.severity ?? 0) >= 1 && (input.severity ?? 0) <= 3
    && Number.isInteger(input.quizSequence) && (input.quizSequence ?? 0) >= 1 && (input.quizSequence ?? 0) <= MAX_EXCLUDED_QUIZ_QUESTIONS + 1
    && SAFETY_QUIZ_DIFFICULTIES.includes(input.difficulty as SafetyQuizRequest["difficulty"])
    && Array.isArray(input.excludedQuestions) && input.excludedQuestions.length <= MAX_EXCLUDED_QUIZ_QUESTIONS
    && input.excludedQuestions.every((question) => typeof question === "string" && question.length >= 10 && question.length <= 120)
    && input.language === "ko";
}

export async function handleQuizProxyRequest(request: Request, options: QuizProxyOptions): Promise<Response> {
  const requestId = options.createRequestId?.() ?? randomUUID();
  let input: unknown;
  try { input = await request.json(); }
  catch { return Response.json({ error: "올바른 안전 퀴즈 요청이 필요합니다.", code: "INVALID_JSON", requestId }, { status: 400 }); }
  if (!isQuizRequest(input)) return Response.json({ error: "안전 퀴즈 요청 형식이 올바르지 않습니다.", code: "INVALID_QUIZ_REQUEST", requestId }, { status: 400 });

  const { config } = options;
  let upstreamStatus: number | null = null;
  const record = (result: SafetyQuizResponse) => {
    const response = { ...result, requestId };
    options.logger?.({ requestId, incidentId: input.incidentId, source: response.source, upstreamStatus });
    return Response.json(response, { headers: { "X-Request-Id": requestId, "X-Pixel-Panic-Backend": "vercel-oci-proxy" } });
  };
  const fallback = (reason: QuizDegradedReason) => record(fallbackSafetyQuiz(input.incidentId, {
    actionId: input.actionId,
    excludedQuestions: input.excludedQuestions,
    degradedReason: reason,
    quizSequence: input.quizSequence,
  }));
  if (!config.backendUrl || !config.backendToken) return fallback("OCI_NOT_CONFIGURED");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(config.timeoutMs, 5_000));
  try {
    const response = await (options.fetchImpl ?? fetch)(`${config.backendUrl}/api/quiz`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.backendToken}`,
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
    const normalized = normalizeSafetyQuiz(decoded);
    if (!normalized || isSafetyQuizQuestionExcluded(normalized.question, input.excludedQuestions) || candidate.source !== "openai" && candidate.source !== "fallback") return fallback("OCI_INVALID_RESPONSE");
    return record({ ...normalized, source: candidate.source });
  } catch {
    return fallback(controller.signal.aborted ? "OCI_TIMEOUT" : "OCI_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }
}
