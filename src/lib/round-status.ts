export type RoundStatus = "NOT_GENERATED" | "DRAFT" | "BLOCKED" | "READY" | "FINALIZED";

export function deriveRoundStatus(params: {
  dbStatus: string | null;
  hasDraftSelections: boolean;
  blockedSignalCount: number;
}): RoundStatus {
  const { dbStatus, hasDraftSelections, blockedSignalCount } = params;

  if (dbStatus === "FINALIZED") return "FINALIZED";
  if (dbStatus === "DRAFT") {
    // A round with no draft selections generated yet is NOT_GENERATED, not DRAFT — the persisted
    // column only ever distinguishes DRAFT/FINALIZED; whether anything has actually been
    // generated is a separate, live-computed signal (Phase 11 §68 — this branch previously
    // returned "DRAFT" here unconditionally, making NOT_GENERATED unreachable from real data).
    if (!hasDraftSelections) return "NOT_GENERATED";
    if (blockedSignalCount > 0) return "BLOCKED";
    return "READY";
  }
  return "NOT_GENERATED";
}