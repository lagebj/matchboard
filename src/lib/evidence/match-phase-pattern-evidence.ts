import type { MatchPeriod } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import type { ConfidenceLevel } from "@/lib/evidence/combination-topology";
import { getMatchPhaseWindows, type MatchPhaseKey, type MatchPhaseWindow } from "@/lib/evidence/match-state-timeline";
import { getGoalAttributionEventsForRef, type GoalAttributionEvent } from "@/lib/evidence/combination-goal-attribution";
import { getLeaguePeriodConfig } from "@/lib/live-match/period-config";

/**
 * Evidence-Informed Match Planning programme, Bundle 2: aggregates named match-phase windows
 * (Bundle 1, `match-state-timeline.ts`) across a team's matches into descriptive
 * "do we repeatedly concede in the opening ten minutes?"-style patterns, with explicit exposure
 * and confidence (PROGRAMME.md, D-002: derive first, persist selectively — nothing here is
 * persisted, mirroring `match-state-timeline.ts`'s own choice).
 *
 * Team-season scoped (D-003: a League team is primarily a team-season instance) — this bundle
 * does not add a group-longitudinal variant; see the programme's CURRENT-STATE.md for that
 * deferral.
 */

export type MatchPhasePatternRow = {
  period: MatchPeriod;
  phase: MatchPhaseKey;
  matches: number;
  exposureMinutes: number;
  goalsFor: number;
  goalsAgainst: number;
  confidence: ConfidenceLevel;
};

export type MatchPhaseSample = {
  /** Not persisted anywhere — kept only for test readability/debugging, never returned. */
  sourceId: string;
  goalEvents: GoalAttributionEvent[];
  phaseWindows: MatchPhaseWindow[];
};

/**
 * Deliberately small thresholds, matching the youth-league scale a League season actually
 * produces (typically 10-20 matches) — see combination-topology.ts's ConfidenceLevel for the
 * shared vocabulary this reuses (D-005: confidence describes evidence sufficiency, not
 * "goodness").
 */
const CONFIDENCE_THRESHOLDS = { EMERGING: 3, ESTABLISHED: 6 } as const;

export function classifyMatchPhaseConfidence(matches: number): ConfidenceLevel {
  if (matches >= CONFIDENCE_THRESHOLDS.ESTABLISHED) return "ESTABLISHED";
  if (matches >= CONFIDENCE_THRESHOLDS.EMERGING) return "EMERGING";
  return "INSUFFICIENT";
}

/**
 * Pure aggregation — no I/O, unit-testable without a database. A goal can legitimately count
 * toward more than one overlapping window (e.g. a 3rd-minute goal is inside both "opening 5"
 * and "opening 10") — these are descriptive buckets, not a mutually-exclusive partition.
 *
 * Windows are aggregated by `(period, phase)`, not `phase` alone: "opening 5" of the first half
 * and "opening 5" of the second half are kept as distinct rows rather than merged into one
 * generic "match opening" bucket, since a coach's question ("do we concede right after kickoff?"
 * vs "do we concede right after the restart?") is genuinely different for each.
 */
export function aggregateMatchPhasePatterns(samples: MatchPhaseSample[]): MatchPhasePatternRow[] {
  const byBucket = new Map<
    string,
    { period: MatchPeriod; phase: MatchPhaseKey; matches: number; exposureMinutes: number; goalsFor: number; goalsAgainst: number }
  >();

  for (const sample of samples) {
    for (const window of sample.phaseWindows) {
      const key = `${window.period}:${window.key}`;
      const bucket = byBucket.get(key) ?? {
        period: window.period,
        phase: window.key,
        matches: 0,
        exposureMinutes: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      };

      bucket.matches += 1;
      bucket.exposureMinutes += (window.endMs - window.startMs) / 60000;

      for (const goal of sample.goalEvents) {
        if (goal.matchMs < window.startMs || goal.matchMs >= window.endMs) continue;
        if (goal.team === "FOR") bucket.goalsFor += 1;
        else bucket.goalsAgainst += 1;
      }

      byBucket.set(key, bucket);
    }
  }

  return [...byBucket.values()]
    .map((bucket) => ({
      ...bucket,
      exposureMinutes: Math.round(bucket.exposureMinutes * 10) / 10,
      confidence: classifyMatchPhaseConfidence(bucket.matches),
    }))
    .sort((a, b) => b.matches - a.matches);
}

/**
 * Team-season match-phase patterns for one League team. Only REPORTED/LOCKED (completed)
 * matches contribute — a DRAFT report is incomplete work, not a fact (AGENTS.md "Fixtures
 * result display rules"). Cancelled matches are excluded via the default `status: SCHEDULED`
 * match query (AGENTS.md "Cancelled match rules").
 *
 * Known limitation (recorded, not hidden): this issues one goal-attribution query per completed
 * match rather than a single batched query — acceptable at the youth-league scale this product
 * targets (a season is typically 10-20 matches), flagged here for a future optimisation pass if
 * profiling ever shows otherwise (TEST-MATRIX.md §23).
 */
export async function getTeamSeasonMatchPhasePatterns(
  leagueSeasonId: string,
  teamId: string,
  orgFilter: OrgFilterMode,
): Promise<MatchPhasePatternRow[]> {
  if (orgFilter.type !== "org") return [];

  const matches = await db.match.findMany({
    where: {
      teamId,
      matchRound: { leagueSeasonId },
      status: "SCHEDULED",
      ...orgFilter.filter,
    },
    select: { id: true, matchType: true },
  });

  if (matches.length === 0) return [];

  const matchIds = matches.map((m) => m.id);
  const reports = await db.postMatchReport.findMany({
    where: { matchId: { in: matchIds }, status: { in: ["REPORTED", "LOCKED"] } },
    select: { matchId: true },
  });
  const completedMatchIds = new Set(reports.map((r) => r.matchId));
  const completedMatches = matches.filter((m) => completedMatchIds.has(m.id));

  if (completedMatches.length === 0) return [];

  const samples: MatchPhaseSample[] = [];
  for (const match of completedMatches) {
    const goalEvents = await getGoalAttributionEventsForRef({
      kind: "LEAGUE_MATCH",
      matchId: match.id,
      leagueSeasonId,
    });
    const periodConfig = getLeaguePeriodConfig(match.matchType);
    samples.push({
      sourceId: match.id,
      goalEvents,
      phaseWindows: getMatchPhaseWindows(periodConfig),
    });
  }

  return aggregateMatchPhasePatterns(samples);
}
