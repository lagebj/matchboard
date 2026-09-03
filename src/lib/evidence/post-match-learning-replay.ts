import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { buildLeagueMatchRef } from "@/lib/evidence/adapters/league-evidence-adapter";
import { buildEventMatchRef } from "@/lib/evidence/adapters/event-evidence-adapter";
import { runPostMatchLearning, type PostMatchLearningResult } from "@/lib/evidence/post-match-learning";
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

function outcomeFromResult(result: PostMatchLearningResult): PostMatchLearningReplayOutcome {
  const steps = Object.values(result);
  if (steps.some((s) => s.status === "FAILED")) return "FAILED";
  if (steps.some((s) => s.status === "APPLIED")) return "APPLIED";
  return "SKIPPED";
}

/**
 * Reprocesses every eligible completed match for an organisation. Never mutates the report
 * itself and never aborts the batch on one match's failure (MIGRATION.md).
 */
export async function replayPostMatchLearningHistory(
  organisationId: string,
  options?: { from?: Date; to?: Date },
): Promise<PostMatchLearningReplaySummary> {
  const refs = await getEligibleCompletedMatchRefs(organisationId, options);
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
      const result = await runPostMatchLearning(ref, orgFilter);
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
