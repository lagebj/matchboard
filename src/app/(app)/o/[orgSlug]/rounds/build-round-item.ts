import { formatIsoWeekLabel } from "@/lib/date-utils";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import { deriveRoundStatus, type RoundStatus } from "@/lib/round-status";
import { deriveRoundProgress, type RoundProgress } from "@/lib/rounds/round-progress";
import { logger } from "@/lib/logger";

export type RoundItem = {
  id: string;
  name: string;
  weekLabel: string;
  matchCount: number;
  teamNames: string[];
  derivedStatus: RoundStatus;
  progress: RoundProgress;
  /** Set when this round's own plan-integrity computation failed -- see the per-round try/catch
   * below. A single round's query error must never blank the whole Rounds list (it previously
   * did: one round's computeRoundPlanIntegrity() throwing rejected an enclosing Promise.all,
   * crashing the entire page and hiding every round, not just the broken one). */
  loadError?: string;
};

export type RoundForBuildItem = {
  id: string;
  name: string;
  status: string;
  selections: { id: string }[];
  matches: {
    id: string;
    status: string;
    startsAt: Date;
    team: { name: string };
  }[];
};

/**
 * Builds one Rounds-list item, tolerating computeRoundPlanIntegrity() failing for this round
 * specifically (e.g. transient schema drift, a corrupted selection row) -- the caller's
 * Promise.all must never reject because of one bad round. blockedSignalCount falls back to 0
 * (READY/DRAFT rather than BLOCKED) on failure -- a safer under-report than crashing, since the
 * round is also flagged with loadError for the coach to investigate directly.
 */
export async function buildRoundItem(
  round: RoundForBuildItem,
  reportStatusByMatchId: Map<string, string>,
): Promise<RoundItem> {
  const hasDraftSelections = round.selections.length > 0;
  const weekLabel = round.matches.length > 0
    ? formatIsoWeekLabel(round.matches[0]!.startsAt)
    : round.name;
  const teamNames = [...new Set(round.matches.map((m) => m.team.name))];
  const progress = deriveRoundProgress(
    round.matches.map((m) => ({
      status: m.status,
      startsAt: m.startsAt,
      reportStatus: (reportStatusByMatchId.get(m.id) as "DRAFT" | "REPORTED" | "LOCKED" | undefined) ?? "NONE",
    })),
  );

  try {
    const integrity = await computeRoundPlanIntegrity(round.id);
    const blockedCount = integrity.summary.blockerCount + integrity.summary.decisionRequiredCount;
    return {
      id: round.id,
      name: round.name,
      weekLabel,
      matchCount: round.matches.length,
      teamNames,
      derivedStatus: deriveRoundStatus({ dbStatus: round.status, hasDraftSelections, blockedSignalCount: blockedCount }),
      progress,
    };
  } catch (err) {
    logger.error({ roundId: round.id, err }, "[rounds] computeRoundPlanIntegrity failed for round");
    return {
      id: round.id,
      name: round.name,
      weekLabel,
      matchCount: round.matches.length,
      teamNames,
      derivedStatus: deriveRoundStatus({ dbStatus: round.status, hasDraftSelections, blockedSignalCount: 0 }),
      progress,
      loadError: "Couldn't load full status for this round.",
    };
  }
}

export async function buildRoundItems(
  rounds: RoundForBuildItem[],
  reportStatusByMatchId: Map<string, string>,
): Promise<RoundItem[]> {
  return Promise.all(rounds.map((round) => buildRoundItem(round, reportStatusByMatchId)));
}
