import OpenAI from "openai";
import type { AppConfig } from "../config.js";
import { dialogueJsonSchema, fallbackDialogue, isDialogueExcluded, isNpcDialogueSituation, normalizeDialogue, type DialogueInput, type DialogueResult } from "../schemas/dialogue.js";

export interface DialogueWriter {
  write(input: DialogueInput): Promise<DialogueResult>;
}

export function createOpenAIDialogueWriter(config: AppConfig, injectedClient?: OpenAI): DialogueWriter {
  if (!config.openaiApiKey && !injectedClient) {
    return { write: async (input) => fallbackDialogue(input.situation, "OPENAI_NOT_CONFIGURED") };
  }
  const client = injectedClient ?? new OpenAI({ apiKey: config.openaiApiKey, timeout: config.openaiTimeoutMs, maxRetries: 0 });

  return {
    async write(input: DialogueInput): Promise<DialogueResult> {
      try {
        const npcDialogue = isNpcDialogueSituation(input.situation);
        const response = await client.responses.create({
          model: config.openaiModel,
          store: false,
          reasoning: { effort: "low" },
          max_output_tokens: 220,
          instructions: (npcDialogue ? [
            "당신은 한국어 픽셀 구조 게임 PIXEL PANIC의 주민 캐릭터 대사 작가입니다.",
            "입력의 npcName, npcRole, characterTraits를 지키고 현재 재난 사실에 자연스럽게 반응하는 1~2문장을 작성하세요.",
            "캐릭터의 말투와 관찰 내용은 살리되 새로운 사고, 임무, 보상, 규칙 또는 선택지를 만들지 마세요.",
            "자기소개를 반복하지 말고 플레이어에게 직접 말하듯 작성하세요.",
            "excludedDialogues에 있는 이전 대사는 문장 그대로는 물론 의미만 바꾼 유사 대사도 절대 다시 쓰지 마세요.",
            "dialogueSequence마다 현재 사실에서 아직 언급하지 않은 관찰, 감정 또는 안전 행동을 골라 새로운 대사를 만드세요.",
            "마크다운 없이 120자 이하의 dialogue 문자열만 반환하세요.",
          ] : [
            "당신은 한국어 픽셀 구조 게임 PIXEL PANIC의 현장 대사 작가입니다.",
            "주어진 사실만 사용해 화자의 성격이 드러나는 1~3문장 대사를 작성하세요.",
            "게임 규칙, 선택지, 결과를 만들거나 변경하지 마세요.",
            "마크다운 없이 160자 이하의 dialogue 문자열만 반환하세요.",
          ]).join("\n"),
          input: JSON.stringify(input),
          text: { format: { type: "json_schema", name: "pixel_panic_dialogue", strict: true, schema: dialogueJsonSchema } },
        });
        let decoded: unknown;
        try { decoded = JSON.parse(response.output_text); }
        catch { return fallbackDialogue(input.situation, "INVALID_OPENAI_RESPONSE"); }
        const dialogue = normalizeDialogue(decoded);
        return dialogue && (!npcDialogue || !isDialogueExcluded(dialogue, input.excludedDialogues ?? []))
          ? { dialogue, source: "openai" }
          : fallbackDialogue(input.situation, "INVALID_OPENAI_RESPONSE");
      } catch {
        return fallbackDialogue(input.situation, "OPENAI_UNAVAILABLE");
      }
    },
  };
}
