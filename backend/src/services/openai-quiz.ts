import OpenAI from "openai";
import type { AppConfig } from "../config.js";
import { fallbackQuiz, isQuizQuestionExcluded, normalizeQuiz, quizJsonSchema, type QuizInput, type QuizResult } from "../schemas/quiz.js";

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
      const difficultyInstruction = input.difficulty === "hard"
        ? "고급: 두 가지 이상의 위험 요소를 함께 판단하고, 그럴듯하지만 위험한 선택지 사이에서 올바른 우선순위를 고르게 하세요."
        : input.difficulty === "medium"
          ? "중급: 현장 조건을 하나 더 제시하고 안전한 행동 순서나 판단 기준을 고르게 하세요."
          : "초급: 한 가지 핵심 안전 원칙을 바로 적용하는 쉽고 명확한 문제를 내세요.";
      const focusInstruction = {
        first_response: "사고 발견 직후의 최초 대응을 묻되 이전 문제와 다른 구체적 현장 조건을 사용하세요.",
        hidden_hazard: "겉으로 잘 보이지 않는 2차 위험을 알아채는 판단을 물으세요.",
        safe_sequence: "두세 단계 행동의 안전한 순서나 선행 조건을 물으세요.",
        protective_setup: "안전거리, 보호 장비 또는 현장 통제 준비를 물으세요.",
        evacuation: "주민의 대피 방향, 동선 또는 취약 인원 보호를 물으세요.",
        communication: "본부 보고나 주민 안내에 반드시 포함할 핵심 정보를 물으세요.",
        post_check: "조치가 끝난 뒤 남은 위험과 통제 해제 전 확인을 물으세요.",
        priority: "동시에 두 위험이 나타난 상황에서 무엇을 우선할지 물으세요.",
      }[input.questionFocus];

      let unavailable = false;
      for (let generationAttempt = 1; generationAttempt <= 2; generationAttempt += 1) {
        try {
          const response = await client.responses.create({
            model: config.openaiModel,
            store: false,
            reasoning: { effort: "low" },
            max_output_tokens: 380,
            instructions: [
              "당신은 한국어 픽셀 구조 게임 PIXEL PANIC의 안전 상식 퀴즈 출제자입니다.",
              "입력된 실제 장애 상황과 플레이어가 선택한 구조 행동에 직접 관련된 일반 상식 문제 하나를 만드세요.",
              `현재 난이도 규칙: ${difficultyInstruction}`,
              `이번 문제의 필수 출제 관점: ${focusInstruction}`,
              "variationSeed는 질문 문구와 구체적 상황 조건을 매번 다르게 구성하기 위한 변형값이며 답에 직접 노출하지 마세요.",
              "excludedQuestions에 있는 이전 질문은 문장 그대로는 물론, 핵심 위험·정답 원칙·상황 판단이 같은 유사 질문도 절대 다시 내지 마세요.",
              "quizSequence가 뒤로 갈수록 앞선 문제보다 더 많은 상황 판단이 필요하도록 구성하세요.",
              generationAttempt === 2 ? "직전 생성물은 중복 또는 형식 오류로 폐기됐습니다. 질문의 상황, 판단 관점과 정답 원칙을 모두 바꿔 완전히 새로 작성하세요." : "첫 생성 시도입니다. 이전 목록과 겹치지 않는 새 문제를 작성하세요.",
              "정답은 논란이 없고 실제 안전 행동에 부합해야 하며, 오답 두 개는 그럴듯하지만 명백히 위험하거나 부적절해야 합니다.",
              "보기는 반드시 a, b, c를 각각 한 번씩 사용하고 정답 ID가 보기 중 하나와 일치해야 합니다.",
              "새로운 게임 상태, 임무, 보상, 피해 또는 의료·법률적 진단을 만들지 마세요.",
              "질문은 120자, 각 보기는 80자, 설명은 180자 이하의 평이한 한국어로 작성하고 마크다운을 쓰지 마세요.",
            ].join("\n"),
            input: JSON.stringify({ ...input, generationAttempt }),
            text: { format: { type: "json_schema", name: "pixel_panic_safety_quiz", strict: true, schema: quizJsonSchema } },
          });
          let decoded: unknown;
          try { decoded = JSON.parse(response.output_text); }
          catch { continue; }
          const normalized = normalizeQuiz(decoded);
          if (normalized && !isQuizQuestionExcluded(normalized.question, input.excludedQuestions)) return { ...normalized, source: "openai" };
        } catch {
          unavailable = true;
        }
      }
      return fallbackQuiz(input.incidentId, unavailable ? "OPENAI_UNAVAILABLE" : "INVALID_OPENAI_RESPONSE");
    },
  };
}
