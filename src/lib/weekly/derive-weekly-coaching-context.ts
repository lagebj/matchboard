/**
 * Pure, DB-free derivation helpers for Weekly Coaching Context (ADR-0108). No Prisma, no React —
 * safe to unit test directly. The DB-bound orchestration lives in get-weekly-coaching-context.ts.
 */

import type { RoundProgressStage } from "@/lib/rounds/round-progress";
import type { WeeklyContextStatus } from "./weekly-coaching-context-types";
import { formatIsoWeekKey, getWeekRangeFromIsoWeekKey } from "@/lib/date-utils";

/**
 * Maps deriveRoundProgress()'s 5-stage model onto the 3-value weekly status, reusing its
 * completeness rule rather than redefining one (AGENTS.md "Canonical data truth").
 *
 * PLANNING / PARTIALLY_PLAYED -> IN_PROGRESS (the week's matches have not all been played yet).
 * ALL_PLAYED / REPORTING      -> PROVISIONAL (played, but reporting is not fully settled).
 * COMPLETE                    -> COMPLETE (every reportable match has a REPORTED/LOCKED report).
 */
export function deriveWeeklyContextStatus(stage: RoundProgressStage): WeeklyContextStatus {
  switch (stage) {
    case "PLANNING":
    case "PARTIALLY_PLAYED":
      return "IN_PROGRESS";
    case "ALL_PLAYED":
    case "REPORTING":
      return "PROVISIONAL";
    case "COMPLETE":
      return "COMPLETE";
  }
}

/** The ISO week immediately before the given week key -- used by the Round Board integration,
 * which reviews the previous week's carry-forward context rather than the in-progress current
 * week. */
export function getPreviousIsoWeekKey(weekKey: string): string {
  const { startsAt } = getWeekRangeFromIsoWeekKey(weekKey);
  const previousWeekDate = new Date(startsAt);
  previousWeekDate.setUTCDate(previousWeekDate.getUTCDate() - 7);
  return formatIsoWeekKey(previousWeekDate);
}
