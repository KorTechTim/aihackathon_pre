import OpenAI from "openai";
import type { AppConfig } from "../config.js";
import { dialogueJsonSchema, fallbackDialogue, normalizeDialogue, type DialogueInput, type DialogueResult } from "../schemas/dialogue.js";

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
        const response = await client.responses.create({
          model: config.openaiModel,
          store: false,
          reasoning: { effort: "low" },
          max_output_tokens: 220,
          instructions: [
            "당신은 한국어 픽셀 구조 게임 PIXEL PANIC의 현장 대사 작가입니다.",
            "주어진 사실만 사용해 화자의 성격이 드러나는 1~3문장 대사를 작성하세요.",
            "게임 규칙, 선택지, 결과를 만들거나 변경하지 마세요.",
            "마크다운 없이 160자 이하의 dialogue 문자열만 반환하세요.",
          ].join("\n"),
          input: JSON.stringify(input),
          text: { format: { type: "json_schema", name: "pixel_panic_dialogue", strict: true, schema: dialogueJsonSchema } },
        });
        let decoded: unknown;
        try { decoded = JSON.parse(response.output_text); }
        catch { return fallbackDialogue(input.situation, "INVALID_OPENAI_RESPONSE"); }
        const dialogue = normalizeDialogue(decoded);
        return dialogue ? { dialogue, source: "openai" } : fallbackDialogue(input.situation, "INVALID_OPENAI_RESPONSE");
      } catch {
        return fallbackDialogue(input.situation, "OPENAI_UNAVAILABLE");
      }
    },
  };
}
