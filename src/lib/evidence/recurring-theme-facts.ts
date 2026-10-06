import type { QualitativeEvidencePhase, QualitativeEvidencePolarity } from "@/generated/prisma/client";

/**
 * Deterministic recurring-theme phase summary (originally inline in
 * `src/lib/ai/context/weekly-team-review.ts`'s `buildWeeklyTeamReviewContext`, extracted
 * unchanged here by ADR-0157 slice C7 so Season Review's Teams tab and Overview "recurring
 * tactical/team patterns" story can reuse the exact same deterministic accumulation instead of
 * building a second recurring-theme algorithm — `09_SEASON_REVIEW.md` "Recurring patterns:
 * Reuse existing weekly-team-review recurring-theme facts and deterministic evidence owners. Do
 * not create a second recurring-theme algorithm.").
 *
 * A theme is "recurring" only once it has shown up in more than one match — a single match's own
 * observation is already covered elsewhere (that match's own qualitative evidence). Pure: takes
 * already-fetched, already-deduped observations and the already-fetched recent-match ordering;
 * never queries the database itself.
 */

export type RecurringThemeObservation = {
  matchId: string | null;
  phase: QualitativeEvidencePhase;
  polarity: QualitativeEvidencePolarity;
  createdAt: Date;
};

export type RecurringThemePhaseSummary = {
  phase: QualitativeEvidencePhase;
  matchesWithWorking: number;
  matchesWithProblem: number;
  newestObservationDate: Date;
  consecutiveStreak: { direction: "WORKING" | "PROBLEM"; count: number } | null;
};

const DEFAULT_MIN_MATCH_COUNT = 2;
const DEFAULT_MAX_ITEMS = 10;

function directionForMatchPhase(
  observationsByMatchId: ReadonlyMap<string, RecurringThemeObservation[]>,
  matchId: string,
  phase: QualitativeEvidencePhase,
): "WORKING" | "PROBLEM" | null {
  const directional = (observationsByMatchId.get(matchId) ?? []).filter(
    (o) => o.phase === phase && (o.polarity === "WORKING" || o.polarity === "PROBLEM"),
  );
  const polarities = new Set(directional.map((o) => o.polarity));
  return polarities.size === 1 ? (directional[0]!.polarity as "WORKING" | "PROBLEM") : null;
}

/**
 * `dedupedObservations` should already be deduped by statement (see
 * `dedupeQualitativeObservationsByStatement`); `recentMatches` must be ordered newest-first — the
 * consecutive streak walk stops at the first match that breaks the direction or lacks directional
 * evidence for that phase.
 */
export function computeRecurringThemePhaseSummaries(
  dedupedObservations: readonly RecurringThemeObservation[],
  recentMatches: readonly { id: string }[],
  options?: { minMatchCount?: number; maxItems?: number },
): RecurringThemePhaseSummary[] {
  const minMatchCount = options?.minMatchCount ?? DEFAULT_MIN_MATCH_COUNT;
  const maxItems = options?.maxItems ?? DEFAULT_MAX_ITEMS;

  const observationsByMatchId = new Map<string, RecurringThemeObservation[]>();
  for (const o of dedupedObservations) {
    if (!o.matchId) continue;
    const list = observationsByMatchId.get(o.matchId) ?? [];
    list.push(o);
    observationsByMatchId.set(o.matchId, list);
  }

  const phaseAccumulators = new Map<
    QualitativeEvidencePhase,
    { workingMatchIds: Set<string>; problemMatchIds: Set<string>; newestObservationDate: Date }
  >();
  for (const o of dedupedObservations) {
    if (!o.matchId || (o.polarity !== "WORKING" && o.polarity !== "PROBLEM")) continue;
    const acc = phaseAccumulators.get(o.phase) ?? {
      workingMatchIds: new Set<string>(),
      problemMatchIds: new Set<string>(),
      newestObservationDate: o.createdAt,
    };
    if (o.polarity === "WORKING") acc.workingMatchIds.add(o.matchId);
    else acc.problemMatchIds.add(o.matchId);
    if (o.createdAt > acc.newestObservationDate) acc.newestObservationDate = o.createdAt;
    phaseAccumulators.set(o.phase, acc);
  }

  return [...phaseAccumulators.entries()]
    .map(([phase, acc]) => {
      const totalMatches = new Set([...acc.workingMatchIds, ...acc.problemMatchIds]).size;
      if (totalMatches < minMatchCount) return null;

      let streakDirection: "WORKING" | "PROBLEM" | null = null;
      let streakCount = 0;
      for (const m of recentMatches) {
        const direction = directionForMatchPhase(observationsByMatchId, m.id, phase);
        if (!direction) break;
        if (streakDirection === null) streakDirection = direction;
        else if (direction !== streakDirection) break;
        streakCount++;
      }

      return {
        phase,
        matchesWithWorking: acc.workingMatchIds.size,
        matchesWithProblem: acc.problemMatchIds.size,
        newestObservationDate: acc.newestObservationDate,
        consecutiveStreak: streakCount > 0 && streakDirection ? { direction: streakDirection, count: streakCount } : null,
      };
    })
    .filter((t): t is RecurringThemePhaseSummary => t !== null)
    .sort((a, b) => b.matchesWithWorking + b.matchesWithProblem - (a.matchesWithWorking + a.matchesWithProblem) || a.phase.localeCompare(b.phase))
    .slice(0, maxItems);
}
