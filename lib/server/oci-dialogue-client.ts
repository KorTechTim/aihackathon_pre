import { randomUUID } from "node:crypto";
import { DIALOGUE_EVENTS, DIALOGUE_EVENT_IDS, type DialogueEventId } from "../dialogue-events";
import { NPC_DIALOGUES, NPC_DIALOGUE_IDS, type NpcDialogueId } from "../npc-dialogue";
import { extractVercelClientIp, type OciProxyConfig } from "./oci-plan-client";

type DialogueSituation = DialogueEventId | NpcDialogueId;

type DialogueProxyRequest = {
  speaker: "AQUA" | "FIX" | "BUDDY" | "주민";
  personality: string;
  situation: DialogueSituation;
  facts: Record<string, string | number | boolean>;
  choiceIds: string[];
  language: "ko";
};

export type DialogueProxyResponse = {
  dialogue: string;
  source: "openai" | "fallback";
  degradedReason?: "OCI_NOT_CONFIGURED" | "OCI_TIMEOUT" | "OCI_UNAVAILABLE" | "OCI_RATE_LIMITED" | "OCI_INVALID_RESPONSE";
  requestId: string;
};

type DialogueProxyOptions = {
  config: OciProxyConfig;
  fetchImpl?: typeof fetch;
  createRequestId?: () => string;
  logger?: (record: { requestId: string; situation: DialogueSituation; source: "openai" | "fallback"; upstreamStatus: number | null }) => void;
};

function fallback(situation: DialogueSituation, requestId: string, degradedReason: NonNullable<DialogueProxyResponse["degradedReason"]>): DialogueProxyResponse {
  const dialogue = situation in NPC_DIALOGUES
    ? NPC_DIALOGUES[situation as NpcDialogueId].fallbackDialogue
    : DIALOGUE_EVENTS[situation as DialogueEventId].fallbackDialogue;
  return { dialogue, source: "fallback", degradedReason, requestId };
}

function normalizeDialogue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized && normalized.length <= 160 && !/[`*_#\[\]<>]/.test(normalized) ? normalized : null;
}

function isDialogueRequest(value: unknown): value is DialogueProxyRequest {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<DialogueProxyRequest>;
  const npcSituation = NPC_DIALOGUE_IDS.includes(input.situation as NpcDialogueId);
  const eventSituation = DIALOGUE_EVENT_IDS.includes(input.situation as DialogueEventId);
  const validChoices = Array.isArray(input.choiceIds)
    && (npcSituation ? input.choiceIds.length === 0 : input.choiceIds.length >= 2 && input.choiceIds.length <= 3)
    && input.choiceIds.every((id) => typeof id === "string" && id.length >= 2 && id.length <= 40);
  return ["AQUA", "FIX", "BUDDY", "주민"].includes(input.speaker ?? "")
    && typeof input.personality === "string" && input.personality.length >= 2 && input.personality.length <= 40
    && (npcSituation || eventSituation)
    && (!npcSituation || input.speaker === "주민")
    && Boolean(input.facts) && typeof input.facts === "object" && !Array.isArray(input.facts)
    && validChoices
    && input.language === "ko";
}

export async function handleDialogueProxyRequest(request: Request, options: DialogueProxyOptions): Promise<Response> {
  const requestId = options.createRequestId?.() ?? randomUUID();
  let input: unknown;
  try { input = await request.json(); }
  catch { return Response.json({ error: "올바른 대화 요청이 필요합니다.", code: "INVALID_JSON", requestId }, { status: 400 }); }
  if (!isDialogueRequest(input)) return Response.json({ error: "대화 요청 형식이 올바르지 않습니다.", code: "INVALID_DIALOGUE_REQUEST", requestId }, { status: 400 });

  const { config } = options;
  let upstreamStatus: number | null = null;
  const record = (result: DialogueProxyResponse) => {
    options.logger?.({ requestId, situation: input.situation, source: result.source, upstreamStatus });
    return Response.json(result, { headers: { "X-Request-Id": requestId, "X-Pixel-Panic-Backend": "vercel-oci-proxy" } });
  };
  if (!config.backendUrl || !config.backendToken) return record(fallback(input.situation, requestId, "OCI_NOT_CONFIGURED"));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(config.timeoutMs, 5_000));
  try {
    const response = await (options.fetchImpl ?? fetch)(`${config.backendUrl}/api/dialogue`, {
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
    if (response.status === 429) return record(fallback(input.situation, requestId, "OCI_RATE_LIMITED"));
    if (!response.ok) return record(fallback(input.situation, requestId, "OCI_UNAVAILABLE"));
    const text = await response.text();
    if (text.length > 4_096) return record(fallback(input.situation, requestId, "OCI_INVALID_RESPONSE"));
    let decoded: unknown;
    try { decoded = JSON.parse(text); }
    catch { return record(fallback(input.situation, requestId, "OCI_INVALID_RESPONSE")); }
    const candidate = decoded as { dialogue?: unknown; source?: unknown };
    const dialogue = normalizeDialogue(candidate.dialogue);
    if (!dialogue || candidate.source !== "openai" && candidate.source !== "fallback") return record(fallback(input.situation, requestId, "OCI_INVALID_RESPONSE"));
    return record({ dialogue, source: candidate.source, requestId });
  } catch {
    return record(fallback(input.situation, requestId, controller.signal.aborted ? "OCI_TIMEOUT" : "OCI_UNAVAILABLE"));
  } finally {
    clearTimeout(timeout);
  }
}
