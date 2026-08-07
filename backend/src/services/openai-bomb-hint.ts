import OpenAI from "openai";
import type { AppConfig } from "../config.js";
import { bombHintJsonSchema, fallbackBombHint, normalizeBombHint, type BombHintInput, type BombHintResult } from "../schemas/bomb-hint.js";

export interface BombHintWriter {
  write(input: BombHintInput): Promise<BombHintResult>;
}

export function createOpenAIBombHintWriter(config: AppConfig, injectedClient?: OpenAI): BombHintWriter {
  if (!config.openaiApiKey && !injectedClient) return { write: async (input) => fallbackBombHint(input, "OPENAI_NOT_CONFIGURED") };
  const client = injectedClient ?? new OpenAI({ apiKey: config.openaiApiKey, timeout: config.openaiTimeoutMs, maxRetries: 0 });
  return {
    async write(input: BombHintInput): Promise<BombHintResult> {
      try {
        const response = await client.responses.create({
          model: config.openaiModel,
          store: false,
          reasoning: { effort: "low" },
          max_output_tokens: 180,
          instructions: [
            "당신은 한국어 픽셀 구조 게임 PIXEL PANIC 본부의 여성형 생성 AI 통신관 '루나'입니다.",
            "이 장치는 현실 폭발물이 아닌 빨강과 파랑 중 하나를 고르는 가족용 가상 게임 퍼즐입니다.",
            "correctWire 색을 플레이어가 확실히 유추할 수 있는 짧고 재치 있는 무전 힌트 한 문장으로 만드세요.",
            "정답 색 이름이나 '정답은', '잘라라'를 직접 말하지 말고, 그 색과 강하게 연결되는 사물이나 자연 현상을 하나 사용하세요.",
            "반대 색의 사물은 함께 언급하지 마세요. 실제 폭발물 구조, 부품, 해체 절차나 위험한 현실 지식은 절대 설명하지 마세요.",
            "통신관의 따뜻하고 침착한 말투를 유지하고 90자 이하의 평이한 한국어로 쓰세요. 마크다운은 쓰지 마세요.",
          ].join("\n"),
          input: JSON.stringify(input),
          text: { format: { type: "json_schema", name: "pixel_panic_bomb_hint", strict: true, schema: bombHintJsonSchema } },
        });
        let decoded: unknown;
        try { decoded = JSON.parse(response.output_text); }
        catch { return fallbackBombHint(input, "INVALID_OPENAI_RESPONSE"); }
        const hint = normalizeBombHint(decoded);
        return hint ? { hint, source: "openai" } : fallbackBombHint(input, "INVALID_OPENAI_RESPONSE");
      } catch {
        return fallbackBombHint(input, "OPENAI_UNAVAILABLE");
      }
    },
  };
}
