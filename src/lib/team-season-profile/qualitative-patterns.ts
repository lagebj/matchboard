import type { QualitativeEvidencePhase, QualitativeEvidencePolarity } from "@/generated/prisma/client";
import { classifyThemeTrajectory } from "@/lib/team-season-profile/trajectory";
import type { TeamSeasonPattern, ConfidenceLevel } from "@/lib/team-season-profile/contracts";

/**
 * Tactical qualitative theme builder (`03_PATTERN_CATALOGUE_V1.md` §B). Operates on structured
 * `QualitativeEvidenceObservation` rows the caller has already loaded, filtered to `scope ===
 * "TEAM"`, active (non-superseded, SUCCEEDED-run) evidence, and matches within the selected
 * season (ADR-0156 §3/§5, locked decision #10) -- this module does no I/O and never rereads raw
 * report prose itself (locked decision §5/B: "Do not reread arbitrary raw report prose").
 */
export type TeamThemeObservation = {
  id: string;
  matchId: string;
  phase: QualitativeEvidencePhase;
  polarity: QualitativeEvidencePolarity;
  createdAt: Date;
};

/** §04 "Qualitative themes" baseline: <2 distinct matches INSUFFICIENT, 2-3 EMERGING, >=4
 * ESTABLISHED. No existing qualitative-evidence helper defines a stricter rule for this
 * season-aggregate use (distinct from the unrelated player-development evidence accumulator's
 * own `MINIMUM_DISTINCT_MATCHES`), so this is the authoritative V1 threshold. */
export function classifyThemeConfidence(distinctMatches: number): ConfidenceLevel {
  if (distinctMatches >= 4) return "ESTABLISHED";
  if (distinctMatches >= 2) return "EMERGING";
  return "INSUFFICIENT";
}

/** `GENERAL` is the "not a specific tactical theme" bucket -- excluded from pattern generation
 * since a coach-readable theme card needs an actual named theme (build-up, pressing, ...). */
const THEME_PHASES: QualitativeEvidencePhase[] = [
  "BUILD_UP",
  "PROGRESSION",
  "CHANCE_CREATION",
  "PRESSING",
  "DEFENSIVE_SHAPE",
  "DEFENSIVE_TRANSITION",
  "ATTACKING_TRANSITION",
  "SET_PLAYS",
];

function distinctMatchIds(observations: TeamThemeObservation[]): Set<string> {
  return new Set(observations.map((o) => o.matchId));
}

function dateRange(observations: TeamThemeObservation[]): { first: Date | null; last: Date | null } {
  if (observations.length === 0) return { first: null, last: null };
  const times = observations.map((o) => o.createdAt.getTime());
  return { first: new Date(Math.min(...times)), last: new Date(Math.max(...times)) };
}

function themeKey(phase: QualitativeEvidencePhase, direction: "working" | "problem" | "mixed"): string {
  return `theme:${phase.toLowerCase().replace(/_/g, "-")}:${direction}`;
}

/**
 * Builds §B1 (recurring working), §B2 (recurring problem) and §B3 (mixed) patterns, one per
 * tactical phase. `totalSeasonMatches` and `recentMatchIds` define the trajectory windows;
 * `recentMatchIds` must never cross the selected season boundary (caller's responsibility).
 */
export function buildTacticalThemePatterns(
  observations: TeamThemeObservation[],
  totalSeasonMatches: number,
  recentMatchIds: Set<string>,
): TeamSeasonPattern[] {
  const recentWindowMatches = recentMatchIds.size;
  const earlierWindowMatches = Math.max(totalSeasonMatches - recentWindowMatches, 0);
  const patterns: TeamSeasonPattern[] = [];

  for (const phase of THEME_PHASES) {
    const phaseObservations = observations.filter((o) => o.phase === phase);
    if (phaseObservations.length === 0) continue;

    const working = phaseObservations.filter((o) => o.polarity === "WORKING");
    const problem = phaseObservations.filter((o) => o.polarity === "PROBLEM");

    const workingMatches = distinctMatchIds(working);
    const problemMatches = distinctMatchIds(problem);
    const workingConfidence = classifyThemeConfidence(workingMatches.size);
    const problemConfidence = classifyThemeConfidence(problemMatches.size);

    const workingQualifies = workingConfidence !== "INSUFFICIENT";
    const problemQualifies = problemConfidence !== "INSUFFICIENT";
    if (!workingQualifies && !problemQualifies) continue;

    const recentWorking = working.filter((o) => recentMatchIds.has(o.matchId));
    const earlierWorking = working.filter((o) => !recentMatchIds.has(o.matchId));
    const recentProblem = problem.filter((o) => recentMatchIds.has(o.matchId));
    const earlierProblem = problem.filter((o) => !recentMatchIds.has(o.matchId));

    if (workingQualifies && problemQualifies) {
      const combinedMatches = new Set([...workingMatches, ...problemMatches]);
      const { first, last } = dateRange(phaseObservations);
      patterns.push({
        key: themeKey(phase, "mixed"),
        family: "TACTICAL_THEME",
        subtype: `${phase}_MIXED`,
        subjects: {},
        evidenceStrength: classifyThemeConfidence(combinedMatches.size),
        trajectory: classifyThemeTrajectory(
          { distinctMatchesWithTheme: distinctMatchIds(earlierWorking.length >= earlierProblem.length ? earlierWorking : earlierProblem).size, windowMatches: earlierWindowMatches },
          { distinctMatchesWithTheme: distinctMatchIds(recentWorking.length >= recentProblem.length ? recentWorking : recentProblem).size, windowMatches: recentWindowMatches },
        ),
        tone: "NEUTRAL",
        firstObservedAt: first?.toISOString() ?? null,
        lastObservedAt: last?.toISOString() ?? null,
        approximateTiming: false,
        sample: { matches: combinedMatches.size, observationCount: phaseObservations.length },
        metrics: { workingMatches: workingMatches.size, problemMatches: problemMatches.size },
        sourceRefs: phaseObservations.map((o) => `qualitative-evidence:${o.id}`),
      });
      continue;
    }

    if (workingQualifies) {
      const { first, last } = dateRange(working);
      patterns.push({
        key: themeKey(phase, "working"),
        family: "TACTICAL_THEME",
        subtype: `${phase}_WORKING`,
        subjects: {},
        evidenceStrength: workingConfidence,
        trajectory: classifyThemeTrajectory(
          { distinctMatchesWithTheme: distinctMatchIds(earlierWorking).size, windowMatches: earlierWindowMatches },
          { distinctMatchesWithTheme: distinctMatchIds(recentWorking).size, windowMatches: recentWindowMatches },
        ),
        tone: "POSITIVE",
        firstObservedAt: first?.toISOString() ?? null,
        lastObservedAt: last?.toISOString() ?? null,
        approximateTiming: false,
        sample: { matches: workingMatches.size, observationCount: working.length, recentMatches: distinctMatchIds(recentWorking).size },
        metrics: { workingMatches: workingMatches.size },
        sourceRefs: working.map((o) => `qualitative-evidence:${o.id}`),
      });
      continue;
    }

    const { first, last } = dateRange(problem);
    patterns.push({
      key: themeKey(phase, "problem"),
      family: "TACTICAL_THEME",
      subtype: `${phase}_PROBLEM`,
      subjects: {},
      evidenceStrength: problemConfidence,
      trajectory: classifyThemeTrajectory(
        { distinctMatchesWithTheme: distinctMatchIds(earlierProblem).size, windowMatches: earlierWindowMatches },
        { distinctMatchesWithTheme: distinctMatchIds(recentProblem).size, windowMatches: recentWindowMatches },
      ),
      tone: "ATTENTION",
      firstObservedAt: first?.toISOString() ?? null,
      lastObservedAt: last?.toISOString() ?? null,
      approximateTiming: false,
      sample: { matches: problemMatches.size, observationCount: problem.length, recentMatches: distinctMatchIds(recentProblem).size },
      metrics: { problemMatches: problemMatches.size },
      sourceRefs: problem.map((o) => `qualitative-evidence:${o.id}`),
    });
  }

  return patterns;
}
