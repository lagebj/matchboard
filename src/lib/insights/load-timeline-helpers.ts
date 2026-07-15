import type { LoadCellStatus, InsightAttentionFlag } from "./insights-types";

export function classifyLoadCell(input: {
  hasActual: boolean;
  actualSources: string[];
  plannedRole: string | undefined;
}): LoadCellStatus {
  if (input.hasActual) {
    const isHelper =
      input.actualSources.includes("UNPLANNED") ||
      (input.plannedRole !== undefined && input.plannedRole !== "CORE");
    return isHelper ? "helper_appearance" : "actual_appearance";
  }

  if (input.plannedRole !== undefined) {
    return "planned_only";
  }

  return "unavailable";
}

export function computeLoadAttentionFlags(
  totalActualAppearances: number,
  roundsWithParticipation: number,
  totalRounds: number,
): InsightAttentionFlag[] {
  const flags: InsightAttentionFlag[] = [];

  if (totalActualAppearances >= 4) {
    flags.push("high_recent_load");
  }

  if (roundsWithParticipation <= 1 && totalRounds > 2) {
    flags.push("low_period_participation");
  }

  return flags;
}