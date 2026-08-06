import OpenAI from "openai";
import type { AppConfig } from "../config.js";
import { fallbackQuiz, normalizeQuiz, quizJsonSchema, type QuizInput, type QuizResult } from "../schemas/quiz.js";

export interface QuizWriter {
  write(input: QuizInput): Promise<QuizResult>;
}

export function createOpenAIQuizWriter(config: AppConfig, injectedClient?: OpenAI): QuizWriter {
  if (!config.openaiApiKey && !injectedClient) {
    return { write: async (input) => fallbackQuiz(input.incidentId, "OPENAI_NOT_CONFIGURED") };
  }
  const client = injectedClient ?? new OpenAI({ apiKey: config.openaiApiKey, timeout: config.openaiTimeoutMs, maxRetries: 0 });
  return {
    async write(input: QuizInput): Promise<QuizResult> {
      try {
        const response = await client.responses.create({
          model: config.openaiModel,
          store: false,
          reasoning: { effort: "low" },
          max_output_tokens: 380,
          instructions: [
            "당신은 한국어 픽셀 구조 게임 PIXEL PANIC의 안전 상식 퀴즈 출제자입니다.",
            "입력된 실제 장애 상황과 플레이어가 선택한 구조 행동에 직접 관련된 초급 일반 상식 문제 하나를 만드세요.",
            "정답은 논란이 없고 실제 안전 행동에 부합해야 하며, 오답 두 개는 그럴듯하지만 명백히 위험하거나 부적절해야 합니다.",
            "보기는 반드시 a, b, c를 각각 한 번씩 사용하고 정답 ID가 보기 중 하나와 일치해야 합니다.",
            "새로운 게임 상태, 임무, 보상, 피해 또는 의료·법률적 진단을 만들지 마세요.",
            "질문은 120자, 각 보기는 80자, 설명은 180자 이하의 평이한 한국어로 작성하고 마크다운을 쓰지 마세요.",
          ].join("\n"),
          input: JSON.stringify(input),
          text: { format: { type: "json_schema", name: "pixel_panic_safety_quiz", strict: true, schema: quizJsonSchema } },
        });
        let decoded: unknown;
        try { decoded = JSON.parse(response.output_text); }
        catch { return fallbackQuiz(input.incidentId, "INVALID_OPENAI_RESPONSE"); }
        const normalized = normalizeQuiz(decoded);
        return normalized ? { ...normalized, source: "openai" } : fallbackQuiz(input.incidentId, "INVALID_OPENAI_RESPONSE");
      } catch {
        return fallbackQuiz(input.incidentId, "OPENAI_UNAVAILABLE");
      }
    },
  };
}
