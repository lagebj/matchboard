import "server-only";

import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import type { ConfidenceLevel } from "@/lib/evidence/combination-topology";
import { buildMatchStateTimeline, type MatchStateTimeline, type TransitionDisruptionDescriptor } from "@/lib/evidence/match-state-timeline";
import type { MatchPeriod } from "@/generated/prisma/client";

/**
 * Team-season transition-structure pattern aggregation (Evidence-Informed Match Planning
 * programme, Bundle 7, ADR-0118). Closes a gap flagged by earlier bundles ("Bundle 7 territory")
 * — a real historical evidence source for the "Rotation-transition evidence"
 * (TEST-MATRIX.md #5) scenario: does a given transition *shape* (how many players changed, what
 * kind of disruption, at what point in the match) correlate with goals conceded shortly after it?
 *
 * Derived only from the actual position timeline (Bundle 1's `MatchTransition`/
 * `MatchStateInterval`, via `buildMatchStateTimeline()`), never persisted — matching D-002
 * ("derive first, persist selectively") and every other evidence aggregation in this programme.
 */

export type TransitionBatchSizeBucket = "SINGLE" | "DOUBLE" | "TRIPLE_PLUS";

export interface TransitionStructureEvidenceRow {
  period: MatchPeriod;
  batchSizeBucket: TransitionBatchSizeBucket;
  disruptionDescriptors: TransitionDisruptionDescriptor[];
  isAtNaturalBreak: boolean;
  occurrences: number;
  goalsAgainstInWindow: number;
  confidence: ConfidenceLevel;
}

// A 5-minute observation window after a transition, matching the existing "opening 5"
// phase-window granularity (match-state-timeline.ts) rather than inventing a new scale.
const GOALS_AGAINST_WINDOW_MS = 5 * 60 * 1000;

/**
 * Occurrence-count thresholds matching Bundle 2's `classifyTacticalConfidence()`
 * (opponent playing-style tags) rather than Bundle 2's match-count-based
 * `classifyMatchPhaseConfidence()` — a transition shape can occur multiple times within a single
 * match, so "occurrences" here is an event count, not a match count, the same reasoning Bundle 2
 * used to justify its own separate threshold set for occurrence-based evidence.
 */
export function classifyTransitionStructureConfidence(occurrences: number): ConfidenceLevel {
  if (occurrences >= 4) return "ESTABLISHED";
  if (occurrences >= 2) return "EMERGING";
  return "INSUFFICIENT";
}

export function bucketForSubstitutionCount(count: number): TransitionBatchSizeBucket {
  if (count <= 1) return "SINGLE";
  if (count === 2) return "DOUBLE";
  return "TRIPLE_PLUS";
}

function goalsAgainstInWindowAfter(timeline: MatchStateTimeline, transitionAtMs: number): number {
  return timeline.intervals
    .filter((interval) => interval.startMs >= transitionAtMs && interval.startMs < transitionAtMs + GOALS_AGAINST_WINDOW_MS)
    .reduce((sum, interval) => sum + interval.goalsAgainst, 0);
}

/**
 * Pure aggregation over already-built timelines — callers (the DB-bound function below) supply
 * one `MatchStateTimeline` per match in scope; this function never queries the database itself.
 */
export function aggregateTransitionStructurePatterns(timelines: MatchStateTimeline[]): TransitionStructureEvidenceRow[] {
  const buckets = new Map<
    string,
    {
      period: MatchPeriod;
      batchSizeBucket: TransitionBatchSizeBucket;
      disruptionDescriptors: TransitionDisruptionDescriptor[];
      isAtNaturalBreak: boolean;
      occurrences: number;
      goalsAgainstInWindow: number;
    }
  >();

  for (const timeline of timelines) {
    for (const transition of timeline.transitions) {
      if (transition.period === null) continue;

      const batchSizeBucket = bucketForSubstitutionCount(transition.substitutionCount);
      const key = `${transition.period}:${batchSizeBucket}:${transition.isAtNaturalBreak}`;
      const existing = buckets.get(key) ?? {
        period: transition.period,
        batchSizeBucket,
        disruptionDescriptors: transition.disruptionDescriptors,
        isAtNaturalBreak: transition.isAtNaturalBreak,
        occurrences: 0,
        goalsAgainstInWindow: 0,
      };

      existing.occurrences += 1;
      existing.goalsAgainstInWindow += goalsAgainstInWindowAfter(timeline, transition.atMs);
      buckets.set(key, existing);
    }
  }

  return [...buckets.values()].map((bucket) => ({
    ...bucket,
    confidence: classifyTransitionStructureConfidence(bucket.occurrences),
  }));
}

/**
 * DB-bound: loads every completed League match for `teamId` in `leagueSeasonId`, builds each
 * match's canonical state timeline (Bundle 1), and aggregates transition-structure patterns.
 * Never a second timeline-reconstruction — reuses `buildMatchStateTimeline()` exactly as every
 * other timeline consumer does.
 */
export async function getTeamSeasonTransitionPatterns(
  leagueSeasonId: string,
  teamId: string,
  orgFilter: OrgFilterMode,
): Promise<TransitionStructureEvidenceRow[]> {
  if (orgFilter.type !== "org") return [];

  const matches = await db.match.findMany({
    where: {
      teamId,
      matchRound: { leagueSeasonId },
      status: "SCHEDULED",
      ...orgFilter.filter,
    },
    select: { id: true },
  });
  if (matches.length === 0) return [];

  const matchIds = matches.map((m) => m.id);
  const reports = await db.postMatchReport.findMany({
    where: { matchId: { in: matchIds }, status: { in: ["REPORTED", "LOCKED"] } },
    select: { matchId: true },
  });
  const completedMatchIds = new Set(reports.map((r) => r.matchId));
  if (completedMatchIds.size === 0) return [];

  const timelines: MatchStateTimeline[] = [];
  for (const matchId of completedMatchIds) {
    const timeline = await buildMatchStateTimeline({ kind: "LEAGUE_MATCH", matchId, leagueSeasonId });
    if (timeline) timelines.push(timeline);
  }

  return aggregateTransitionStructurePatterns(timelines);
}
