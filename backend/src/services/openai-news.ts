import OpenAI from "openai";
import type { AppConfig } from "../config.js";
import { fallbackNews, newsJsonSchema, normalizeNews, type NewsInput, type NewsResult } from "../schemas/news.js";

export interface NewsWriter {
  write(input: NewsInput): Promise<NewsResult>;
}
export function createOpenAINewsWriter(config: AppConfig, injectedClient?: OpenAI): NewsWriter {
  if (!config.openaiApiKey && !injectedClient) return { write: async (input) => fallbackNews(input, "OPENAI_NOT_CONFIGURED") };
  const client = injectedClient ?? new OpenAI({ apiKey: config.openaiApiKey, timeout: config.openaiTimeoutMs, maxRetries: 0 });
  return {
    async write(input: NewsInput): Promise<NewsResult> {
      try {
        const response = await client.responses.create({
          model: config.openaiModel,
          store: false,
          reasoning: { effort: "low" },
          max_output_tokens: 520,
          instructions: [
            "당신은 한국어 픽셀 구조 게임 PIXEL PANIC의 마을 신문 기자입니다.",
            "입력된 결정론 게임 기록만 사용해 작전 결과 기사와 주민 인터뷰를 작성하세요.",
            "headline은 결과가 드러나는 신문 제목, article은 2~3문장의 간결한 기사로 작성하세요.",
            "interviewQuote는 지정된 intervieweeName의 1인칭 발언이며 intervieweeRole과 intervieweeTraits의 말투를 지키세요.",
            "입력에 없는 사고 원인, 사상자, 장소, 날짜, 로봇 행동, 기록 또는 보상을 만들지 마세요.",
            "실패 결과도 조롱하지 말고 해결한 내용과 남은 과제를 사실적으로 전달하세요.",
            "마크다운, 따옴표, 기자명, 매체명 없이 제목 70자, 기사 320자, 인터뷰 160자 이하로 작성하세요.",
          ].join("\n"),
          input: JSON.stringify(input),
          text: { format: { type: "json_schema", name: "pixel_panic_result_news", strict: true, schema: newsJsonSchema } },
        });
        let decoded: unknown;
        try { decoded = JSON.parse(response.output_text); }
        catch { return fallbackNews(input, "INVALID_OPENAI_RESPONSE"); }
        const normalized = normalizeNews(decoded);
        return normalized ? { ...normalized, source: "openai" } : fallbackNews(input, "INVALID_OPENAI_RESPONSE");
      } catch {
        return fallbackNews(input, "OPENAI_UNAVAILABLE");
      }
    },
  };
}
