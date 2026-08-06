import { FALLBACK_PLAN, type PlanResult } from "../schemas/rescue-plan.js";

export function fallbackResult(reason: PlanResult["degradedReason"]): PlanResult {
  return { plan: FALLBACK_PLAN, source: "fallback", degradedReason: reason };
}
