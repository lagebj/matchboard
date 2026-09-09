import type { ExplanationRecord } from "@/lib/selection/types";
import { reasonFromLegacyExplanation } from "@/lib/explanations/recommendation-reason";

export function buildExplanation(code: string, summary: string, hardRule = false): ExplanationRecord {
  return {
    code,
    summary,
    hardRule,
    // C6 / ADR-0128: attach the structured reason where `code` maps to a `ReasonCode`. Prose
    // stays in `summary` (it carries team names / counts the generic renderer can't); consumers
    // that want a neutral, contract-shaped reason use `.reason`.
    reason: reasonFromLegacyExplanation(code, hardRule),
  };
}
