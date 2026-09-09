import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { buildLeagueMatchRef } from "@/lib/evidence/adapters/league-evidence-adapter";
import { buildEventMatchRef } from "@/lib/evidence/adapters/event-evidence-adapter";
import {
  runPostMatchLearning,
  summariseLearningOutcome,
  type PostMatchLearningResult,
} from "@/lib/evidence/post-match-learning";
import { footballMatchRefSourceId, type FootballMatchRef } from "@/lib/evidence/football-match-ref";
import { startsAtRangeFilter } from "@/lib/evidence/date-range-filter";

/**
 * Historical catch-up for the Evidence-Informed Match Planning programme (Bundle 2,
 * MIGRATION.md): reprocesses every existing completed League/Event match through the same
 * canonical `runPostMatchLearning()` pipeline new matches already go through on report
 * completion (ADR-0104) — not a second, parallel historical-only learning algorithm.
 *
 * This also closes Bundle 1's own follow-up: `rebuildActualTimeline`/`rebuildEventActualTimeline`
 * fixed a period-crossing ordering bug and a two-half Event truncation bug, but existing
 * `ActualPositionInterval` rows for matches recorded before that fix only self-correct the next
 * time they are rebuilt. Running this tool rebuilds them for every existing organisation.
 *
 * Idempotent and safe to rerun (MIGRATION.md): every step inside `runPostMatchLearning()` is
 * itself an idempotent delete-and-recreate or upsert. Never mutates a completed report's own
 * fields, never invents timing that was not recorded — it only recomputes what the pipeline can
 * already derive from existing facts.
 */

export type PostMatchLearningReplayOutcome = "APPLIED" | "SKIPPED" | "FAILED";

export type PostMatchLearningReplayDetail = {
  sourceId: string;
  kind: FootballMatchRef["kind"];
  outcome: PostMatchLearningReplayOutcome;
  result?: PostMatchLearningResult;
  error?: string;
};

export type PostMatchLearningReplaySummary = {
  totalMatches: number;
  applied: number;
  skipped: number;
  failed: number;
  bySource: {
    league: { total: number; applied: number; skipped: number; failed: number };
    event: { total: number; applied: number; skipped: number; failed: number };
  };
  details: PostMatchLearningReplayDetail[];
};

/**
 * Every completed (REPORTED/LOCKED) League and Event match ref for an organisation, built
 * through the same canonical adapters (`buildLeagueMatchRef`/`buildEventMatchRef`) every other
 * caller uses — never a duplicated leagueSeasonId/evidenceLeagueSeasonId resolver.
 */
async function getEligibleCompletedMatchRefs(
  organisationId: string,
  options?: { from?: Date; to?: Date },
): Promise<FootballMatchRef[]> {
  const dateFilter = startsAtRangeFilter(options);

  const leagueMatches = await db.match.findMany({
    where: {
      organisationId,
      ...(dateFilter ? { startsAt: dateFilter } : {}),
    },
    select: { id: true },
  });
  const leagueMatchIds = leagueMatches.map((m) => m.id);
  const leagueReports = await db.postMatchReport.findMany({
    where: { matchId: { in: leagueMatchIds }, status: { in: ["REPORTED", "LOCKED"] } },
    select: { matchId: true },
  });
  const completedLeagueIds = new Set(leagueReports.map((r) => r.matchId));

  const leagueRefs = await Promise.all(
    leagueMatches.filter((m) => completedLeagueIds.has(m.id)).map((m) => buildLeagueMatchRef(m.id)),
  );

  const eventMatches = await db.eventMatch.findMany({
    where: {
      organisationId,
      ...(dateFilter ? { startsAt: dateFilter } : {}),
    },
    select: { id: true },
  });
  const eventMatchIds = eventMatches.map((m) => m.id);
  const eventReports = await db.eventPostMatchReport.findMany({
    where: { eventMatchId: { in: eventMatchIds }, status: { in: ["REPORTED", "LOCKED"] } },
    select: { eventMatchId: true },
  });
  const completedEventIds = new Set(eventReports.map((r) => r.eventMatchId));

  const eventRefs = await Promise.all(
    eventMatches.filter((m) => completedEventIds.has(m.id)).map((m) => buildEventMatchRef(m.id)),
  );

  return [...leagueRefs, ...eventRefs];
}

const outcomeFromResult = summariseLearningOutcome;

export type ReplayPostMatchLearningOptions = {
  from?: Date;
  to?: Date;
  /** Reprocess just this one League match. */
  matchId?: string;
  /** Reprocess just this one Event match. */
  eventMatchId?: string;
  /**
   * Only reprocess matches whose latest `PostMatchLearningRun` is `FAILED` or missing — the
   * retry-the-broken-ones mode (ADR-0127). Ignored when `matchId`/`eventMatchId` is given.
   */
  failedOnly?: boolean;
};

async function filterToFailedOrMissing(
  organisationId: string,
  refs: FootballMatchRef[],
): Promise<FootballMatchRef[]> {
  const latestRuns = await db.postMatchLearningRun.findMany({
    where: { organisationId },
    orderBy: { runAt: "desc" },
    select: { matchId: true, eventMatchId: true, overallOutcome: true },
  });
  // First (newest) run seen per source id wins.
  const latestBySource = new Map<string, string>();
  for (const r of latestRuns) {
    const key = r.matchId ?? r.eventMatchId;
    if (key && !latestBySource.has(key)) latestBySource.set(key, r.overallOutcome);
  }
  return refs.filter((ref) => {
    const outcome = latestBySource.get(footballMatchRefSourceId(ref));
    return outcome === undefined || outcome === "FAILED";
  });
}

/**
 * Reprocesses every eligible completed match for an organisation (or a filtered subset — see
 * `ReplayPostMatchLearningOptions`). Never mutates the report itself and never aborts the batch
 * on one match's failure (MIGRATION.md). Each run writes an observable `PostMatchLearningRun`
 * with `trigger: "REPLAY"` (ADR-0127).
 */
export async function replayPostMatchLearningHistory(
  organisationId: string,
  options?: ReplayPostMatchLearningOptions,
): Promise<PostMatchLearningReplaySummary> {
  let refs = await getEligibleCompletedMatchRefs(organisationId, options);

  if (options?.matchId) {
    refs = refs.filter((r) => r.kind === "LEAGUE_MATCH" && r.matchId === options.matchId);
  } else if (options?.eventMatchId) {
    refs = refs.filter((r) => r.kind === "EVENT_MATCH" && r.eventMatchId === options.eventMatchId);
  } else if (options?.failedOnly) {
    refs = await filterToFailedOrMissing(organisationId, refs);
  }
  const orgFilter: OrgFilterMode = {
    type: "org",
    organisationId,
    filter: { organisationId },
    filterNullable: { organisationId },
  };

  let applied = 0;
  let skipped = 0;
  let failed = 0;
  const details: PostMatchLearningReplayDetail[] = [];
  const bySource: PostMatchLearningReplaySummary["bySource"] = {
    league: { total: 0, applied: 0, skipped: 0, failed: 0 },
    event: { total: 0, applied: 0, skipped: 0, failed: 0 },
  };

  for (const ref of refs) {
    const sourceId = footballMatchRefSourceId(ref);
    const bucket = ref.kind === "LEAGUE_MATCH" ? bySource.league : bySource.event;
    bucket.total++;

    try {
      const result = await runPostMatchLearning(ref, orgFilter, "REPLAY");
      const outcome = outcomeFromResult(result);

      if (outcome === "APPLIED") {
        applied++;
        bucket.applied++;
      } else if (outcome === "FAILED") {
        failed++;
        bucket.failed++;
      } else {
        skipped++;
        bucket.skipped++;
      }

      details.push({ sourceId, kind: ref.kind, outcome, result });
    } catch (error) {
      failed++;
      bucket.failed++;
      details.push({
        sourceId,
        kind: ref.kind,
        outcome: "FAILED",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { totalMatches: refs.length, applied, skipped, failed, bySource, details };
}
