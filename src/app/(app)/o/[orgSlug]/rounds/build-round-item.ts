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

export type LeagueSeasonCandidate = { id: string; startDate: Date; endDate: Date };

/** No real league season is ever planned this far ahead -- anything starting beyond this window
 * is test-fixture noise (see below), not a legitimate candidate for "most recent". */
const IMPLAUSIBLY_FAR_FUTURE_MS = 730 * 24 * 60 * 60 * 1000; // ~2 years

/**
 * Picks the league season that should scope the Rounds list's default view.
 *
 * Prefers the season actually containing `now`. Otherwise falls back to the most recently
 * started season that starts no more than ~2 years from `now` -- deliberately not "most recent
 * by startDate" unfiltered: e2e specs create throwaway matches dated up to ~100 years out (see
 * e2e/helpers/live-match-fixtures.ts), each auto-creating its own far-future LeagueSeason. An
 * unfiltered "most recent startDate" fallback would keep selecting one of those over a real,
 * merely-already-ended season (confirmed against this repo's own seed dataset,
 * scripts/seed-test-dataset.ts: "Test A1 Spring 2026" has a fixed 2026-04-01..2026-06-30 range
 * that predates whenever "now" actually is by the time this runs) -- the plausibility window
 * exists specifically so that already-ended-but-real season keeps winning over test noise.
 * Only when literally every season (real or not) is implausibly far out does this fall back to
 * the plain most-recent-by-startDate, so a season is still returned rather than `null` when data
 * exists. `null` only when there are no seasons at all.
 */
export function resolveActiveLeagueSeason<T extends LeagueSeasonCandidate>(seasons: T[], now: Date): T | null {
  if (seasons.length === 0) return null;

  const byMostRecentStart = (a: T, b: T) => b.startDate.getTime() - a.startDate.getTime();

  const containingNow = [...seasons]
    .filter((s) => s.startDate.getTime() <= now.getTime() && s.endDate.getTime() >= now.getTime())
    .sort(byMostRecentStart)[0];
  if (containingNow) return containingNow;

  const plausible = seasons.filter((s) => s.startDate.getTime() - now.getTime() <= IMPLAUSIBLY_FAR_FUTURE_MS);
  const candidates = plausible.length > 0 ? plausible : seasons;
  return [...candidates].sort(byMostRecentStart)[0]!;
}
