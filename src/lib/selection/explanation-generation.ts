import type { ExplanationRecord } from "@/lib/selection/types";

export function buildExplanation(code: string, summary: string, hardRule = false): ExplanationRecord {
  return {
    code,
    summary,
    hardRule,
  };
}