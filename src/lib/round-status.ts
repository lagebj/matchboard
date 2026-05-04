export type RoundStatus = "NOT_GENERATED" | "DRAFT" | "BLOCKED" | "READY" | "FINALIZED";

export function deriveRoundStatus(params: {
  dbStatus: string | null;
  hasDraftSelections: boolean;
  hasMatches: boolean;
  blockingWarningCount: number;
}): RoundStatus {
  const { dbStatus, hasDraftSelections, hasMatches, blockingWarningCount } = params;

  if (dbStatus === "FINALIZED") return "FINALIZED";
  if (dbStatus === "DRAFT") {
    if (blockingWarningCount > 0) return "BLOCKED";
    if (hasDraftSelections) return "READY";
    return "DRAFT";
  }
  if (hasMatches) return "NOT_GENERATED";
  return "NOT_GENERATED";
}