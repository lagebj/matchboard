import type { GoalAttributionEvent } from "@/lib/evidence/combination-goal-attribution";
import type { MatchPhaseWindow } from "@/lib/evidence/match-state-timeline";
import { classifyMatchPhaseConfidence } from "@/lib/evidence/match-phase-pattern-evidence";
import { aggregateSeasonCombinations, type SeasonCombinationSummary } from "@/lib/evidence/combination-aggregation";
import type { CombinationEvidenceRow } from "@/lib/evidence/combination-topology";
import { rate, type RateWindow } from "@/lib/team-season-profile/rate-comparison";
import { classifyRateTrajectory, classifyCombinationTrajectory } from "@/lib/team-season-profile/trajectory";
import type { TeamSeasonPattern, TeamSeasonCorridor } from "@/lib/team-season-profile/contracts";

/**
 * Match-rhythm (`03_PATTERN_CATALOGUE_V1.md` §A) and combination (§D) candidate builders --
 * the two families this bundle explicitly groups into one "pattern catalogue" module, since
 * both are purely deterministic adapters over already-existing evidence
 * (`match-phase-pattern-evidence.ts`'s goal-attribution/phase-window primitives,
 * `combination-aggregation.ts`'s season summaries) with no new derivation of their own --
 * everything here is candidate SELECTION, THRESHOLDING and RANKING on top of that evidence,
 * never a second phase-window or combination-topology implementation (ADR-0156 §5, locked
 * decision #1/#5).
 */

// ---------------------------------------------------------------------------
// A. Match rhythm
// ---------------------------------------------------------------------------

export type MatchRhythmSample = {
  matchId: string;
  startsAt: Date;
  goalEvents: GoalAttributionEvent[];
  phaseWindows: MatchPhaseWindow[];
  /** Total playing-period exposure available in this match, in minutes (all periods, not just
   * the ones carrying a named phase window) -- the denominator for "outside the candidate
   * window" exposure. */
  totalExposureMinutes: number;
};

type Direction = "FOR" | "AGAINST";

function pickOpeningFirstHalfWindow(sample: MatchRhythmSample): MatchPhaseWindow | null {
  const restartPeriods = new Set(sample.phaseWindows.filter((w) => w.key === "IMMEDIATELY_AFTER_RESTART").map((w) => w.period));
  return sample.phaseWindows.find((w) => w.key === "OPENING_10" && !restartPeriods.has(w.period)) ?? null;
}

function pickOpeningRestartWindow(sample: MatchRhythmSample): MatchPhaseWindow | null {
  const candidates = sample.phaseWindows.filter((w) => w.key === "IMMEDIATELY_AFTER_RESTART");
  if (candidates.length === 0) return null;
  return candidates.reduce((earliest, candidate) => (candidate.startMs < earliest.startMs ? candidate : earliest));
}

function pickLateFinalWindow(sample: MatchRhythmSample): MatchPhaseWindow | null {
  return sample.phaseWindows.find((w) => w.key === "FINAL_10") ?? null;
}

type RhythmWindowPicker = (sample: MatchRhythmSample) => MatchPhaseWindow | null;

type RhythmAccumulation = {
  candidateGoals: number;
  allGoalsInEligibleMatches: number;
  candidateExposureMinutes: number;
  outsideExposureMinutes: number;
  matchesWithWindow: number;
  approximateTiming: boolean;
  firstObservedAt: Date | null;
  lastObservedAt: Date | null;
  contributingMatchIds: string[];
};

function accumulateRhythmCandidate(samples: MatchRhythmSample[], pickWindow: RhythmWindowPicker, direction: Direction): RhythmAccumulation {
  const acc: RhythmAccumulation = {
    candidateGoals: 0,
    allGoalsInEligibleMatches: 0,
    candidateExposureMinutes: 0,
    outsideExposureMinutes: 0,
    matchesWithWindow: 0,
    approximateTiming: false,
    firstObservedAt: null,
    lastObservedAt: null,
    contributingMatchIds: [],
  };

  for (const sample of samples) {
    const directionGoals = sample.goalEvents.filter((g) => g.team === direction);
    acc.allGoalsInEligibleMatches += directionGoals.length;

    const window = pickWindow(sample);
    if (!window) continue;

    acc.matchesWithWindow += 1;
    const windowMinutes = (window.endMs - window.startMs) / 60000;
    acc.candidateExposureMinutes += windowMinutes;
    acc.outsideExposureMinutes += Math.max(sample.totalExposureMinutes - windowMinutes, 0);

    const goalsInWindow = directionGoals.filter((g) => g.matchMs >= window.startMs && g.matchMs < window.endMs);
    if (goalsInWindow.length === 0) continue;

    acc.candidateGoals += goalsInWindow.length;
    acc.contributingMatchIds.push(sample.matchId);
    if (goalsInWindow.some((g) => g.approximateTiming)) acc.approximateTiming = true;
    if (!acc.firstObservedAt || sample.startsAt < acc.firstObservedAt) acc.firstObservedAt = sample.startsAt;
    if (!acc.lastObservedAt || sample.startsAt > acc.lastObservedAt) acc.lastObservedAt = sample.startsAt;
  }

  return acc;
}

/** §A1/A2: "at least 2 goals in the candidate window" and "concentration meaningfully above the
 * team's own remaining-match rate" -- the exposure-aware gate that stops a raw high percentage
 * on a single event from surfacing (Test plan B.4/B.5).
 *
 * Deliberately NOT `isMaterialRateDifference()` (that gate requires >=2 events on both sides,
 * which is right for trajectory -- two small, possibly-noisy windows shouldn't produce a false
 * trend -- but wrong here: a team whose goals occur *entirely* inside the candidate window
 * (zero outside) is the strongest possible concentration signal, not an unmeasurable one, so an
 * all-in-window case must not be rejected just because the "outside" baseline has too few
 * events to independently qualify. */
function clearsRhythmSurfaceGate(acc: RhythmAccumulation): boolean {
  if (acc.candidateGoals < 2) return false;
  if (acc.candidateExposureMinutes <= 0) return false;

  const candidateRate: RateWindow = { events: acc.candidateGoals, exposureHours: acc.candidateExposureMinutes / 60 };
  const outsideGoals = acc.allGoalsInEligibleMatches - acc.candidateGoals;
  const outsideRate = acc.outsideExposureMinutes > 0 ? outsideGoals / (acc.outsideExposureMinutes / 60) : 0;

  const absoluteDiff = rate(candidateRate) - outsideRate;
  if (absoluteDiff < 0.5) return false;

  const relativeDiff = outsideRate > 0 ? absoluteDiff / outsideRate : Infinity;
  return relativeDiff >= 0.5;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildRhythmPattern(params: {
  key: string;
  subtype: string;
  direction: Direction;
  seasonAcc: RhythmAccumulation;
  recentAcc: RhythmAccumulation;
  earlierAcc: RhythmAccumulation;
}): TeamSeasonPattern | null {
  const { key, subtype, direction, seasonAcc, recentAcc, earlierAcc } = params;
  const confidence = classifyMatchPhaseConfidence(seasonAcc.matchesWithWindow);
  if (confidence === "INSUFFICIENT") return null;
  if (!clearsRhythmSurfaceGate(seasonAcc)) return null;

  const trajectory = classifyRateTrajectory(
    { events: earlierAcc.candidateGoals, exposureHours: earlierAcc.candidateExposureMinutes / 60, matches: earlierAcc.matchesWithWindow },
    { events: recentAcc.candidateGoals, exposureHours: recentAcc.candidateExposureMinutes / 60, matches: recentAcc.matchesWithWindow },
  );

  return {
    key,
    family: "MATCH_RHYTHM",
    subtype,
    subjects: {},
    evidenceStrength: confidence,
    trajectory,
    tone: direction === "FOR" ? "POSITIVE" : "ATTENTION",
    firstObservedAt: seasonAcc.firstObservedAt?.toISOString() ?? null,
    lastObservedAt: seasonAcc.lastObservedAt?.toISOString() ?? null,
    approximateTiming: seasonAcc.approximateTiming,
    sample: { matches: seasonAcc.matchesWithWindow, exposureMinutes: round1(seasonAcc.candidateExposureMinutes), eventCount: seasonAcc.candidateGoals },
    metrics: {
      candidateGoals: seasonAcc.candidateGoals,
      allGoalsInEligibleMatches: seasonAcc.allGoalsInEligibleMatches,
      candidateExposureMinutes: round1(seasonAcc.candidateExposureMinutes),
      outsideExposureMinutes: round1(seasonAcc.outsideExposureMinutes),
      candidateRatePerHour: round1((seasonAcc.candidateGoals / seasonAcc.candidateExposureMinutes) * 60 || 0),
      outsideRatePerHour: round1(((seasonAcc.allGoalsInEligibleMatches - seasonAcc.candidateGoals) / seasonAcc.outsideExposureMinutes) * 60 || 0),
    },
    sourceRefs: seasonAcc.contributingMatchIds.map((id) => `match:${id}`),
  };
}

const RHYTHM_CANDIDATES: Array<{ pick: RhythmWindowPicker; subtypePrefix: string; keyPrefix: string }> = [
  { pick: pickOpeningFirstHalfWindow, subtypePrefix: "OPENING_FIRST_HALF", keyPrefix: "rhythm:opening-first-half" },
  { pick: pickOpeningRestartWindow, subtypePrefix: "OPENING_RESTART", keyPrefix: "rhythm:opening-restart" },
  { pick: pickLateFinalWindow, subtypePrefix: "LATE_FINAL", keyPrefix: "rhythm:late-final" },
];

/**
 * Builds every §A1-A4 match-rhythm candidate (opening-first-half / opening-restart /
 * late-final, each for/against) plus the optional §A5 first-goal-direction pattern, from
 * already-loaded per-match samples. `recentMatchIds` must be a subset of the matches present in
 * `seasonSamples` and must never reach outside the selected season (caller's responsibility --
 * this function has no date/season logic of its own).
 */
export function buildMatchRhythmPatterns(seasonSamples: MatchRhythmSample[], recentMatchIds: Set<string>): TeamSeasonPattern[] {
  const recentSamples = seasonSamples.filter((s) => recentMatchIds.has(s.matchId));
  const earlierSamples = seasonSamples.filter((s) => !recentMatchIds.has(s.matchId));

  const patterns: TeamSeasonPattern[] = [];

  for (const candidate of RHYTHM_CANDIDATES) {
    for (const direction of ["FOR", "AGAINST"] as const) {
      const pattern = buildRhythmPattern({
        key: `${candidate.keyPrefix}:${direction.toLowerCase()}`,
        subtype: `${candidate.subtypePrefix}_${direction}`,
        direction,
        seasonAcc: accumulateRhythmCandidate(seasonSamples, candidate.pick, direction),
        recentAcc: accumulateRhythmCandidate(recentSamples, candidate.pick, direction),
        earlierAcc: accumulateRhythmCandidate(earlierSamples, candidate.pick, direction),
      });
      if (pattern) patterns.push(pattern);
    }
  }

  const firstGoal = buildFirstGoalDirectionPattern(seasonSamples);
  if (firstGoal) patterns.push(firstGoal);

  return patterns;
}

/** §A5: only surfaced when the match's own canonical goal-attribution ordering can identify a
 * chronological first goal without inventing timing -- `GoalAttributionEvent.matchMs` is
 * already the canonical ordering (ADR-0146), so this is a read, not a new inference. */
function buildFirstGoalDirectionPattern(samples: MatchRhythmSample[]): TeamSeasonPattern | null {
  let scoredFirst = 0;
  let concededFirst = 0;
  let approximateTiming = false;
  let firstObservedAt: Date | null = null;
  let lastObservedAt: Date | null = null;
  const contributingMatchIds: string[] = [];

  for (const sample of samples) {
    if (sample.goalEvents.length === 0) continue;
    const firstGoal = sample.goalEvents.reduce((earliest, g) => (g.matchMs < earliest.matchMs ? g : earliest));
    if (firstGoal.team === "FOR") scoredFirst += 1;
    else concededFirst += 1;
    if (firstGoal.approximateTiming) approximateTiming = true;
    contributingMatchIds.push(sample.matchId);
    if (!firstObservedAt || sample.startsAt < firstObservedAt) firstObservedAt = sample.startsAt;
    if (!lastObservedAt || sample.startsAt > lastObservedAt) lastObservedAt = sample.startsAt;
  }

  const matchesWithFirstGoal = scoredFirst + concededFirst;
  if (matchesWithFirstGoal < 4) return null;
  const confidence = classifyMatchPhaseConfidence(matchesWithFirstGoal);
  if (confidence === "INSUFFICIENT") return null;

  return {
    key: "rhythm:first-goal-direction",
    family: "MATCH_RHYTHM",
    subtype: "FIRST_GOAL_DIRECTION",
    subjects: {},
    evidenceStrength: confidence,
    trajectory: "PERSISTENT",
    tone: "NEUTRAL",
    firstObservedAt: firstObservedAt?.toISOString() ?? null,
    lastObservedAt: lastObservedAt?.toISOString() ?? null,
    approximateTiming,
    sample: { matches: matchesWithFirstGoal, eventCount: matchesWithFirstGoal },
    metrics: { scoredFirst, concededFirst, matchesWithFirstGoal },
    sourceRefs: contributingMatchIds.map((id) => `match:${id}`),
  };
}

// ---------------------------------------------------------------------------
// D. Combination patterns
// ---------------------------------------------------------------------------

/** Closed V1 family list (`03_PATTERN_CATALOGUE_V1.md` §D1-D4) -- LINE and FULL_CONFIGURATION
 * are excluded (D4: "Do not show full-configuration patterns in V1"; LINE is not in the
 * catalogue at all), satisfying Test plan E.8. */
const INCLUDED_COMBINATION_FAMILIES = new Set(["PARTNERSHIP", "CORRIDOR", "TRIANGLE", "FUNCTIONAL_UNIT"]);

function combinationIdentity(family: string, subtype: string | null, playerIds: string[]): string {
  return `${family}|${subtype ?? "null"}|${[...playerIds].sort().join(",")}`;
}

function combinationKey(summary: SeasonCombinationSummary): string {
  const familyKey = summary.family.toLowerCase().replace(/_/g, "-");
  const subtypeKey = summary.subtype ? summary.subtype.toLowerCase().replace(/_/g, "-") : "none";
  return `combo:${familyKey}:${subtypeKey}:${summary.playerIds.join(",")}`;
}

/** §D1's explicit extra numeric gate for partnerships specifically (">=60 total minutes",
 * ">=3 matches", ">=2 opponents when opponent identity is available") -- stricter than
 * `deriveConfidence`'s own EMERGING floor, so applied on top of it, not instead of it. */
function clearsPartnershipSurfaceGate(summary: SeasonCombinationSummary): boolean {
  if (summary.totalMinutesTogether < 60) return false;
  if (summary.matchCount < 3) return false;
  if (summary.opponentDiversity < 2) return false;
  return true;
}

/**
 * Builds §D1-D4 combination patterns from already-filtered (team + League-season scoped,
 * Event rows excluded per locked decision #4) combination evidence rows. `recentMatchIds` must
 * be a subset of the matches these rows belong to and must never cross the season boundary.
 */
export function buildCombinationPatterns(params: {
  evidenceRows: CombinationEvidenceRow[];
  opponentByMatch: Map<string, string>;
  recentMatchIds: Set<string>;
  matchDatesById: Map<string, Date>;
}): TeamSeasonPattern[] {
  const { evidenceRows, opponentByMatch, recentMatchIds, matchDatesById } = params;
  const includedRows = evidenceRows.filter((r) => INCLUDED_COMBINATION_FAMILIES.has(r.family));

  const matchIdsByIdentity = new Map<string, Set<string>>();
  for (const row of includedRows) {
    if (!row.matchId) continue;
    const identity = combinationIdentity(row.family, row.subtype, row.playerIds);
    const set = matchIdsByIdentity.get(identity) ?? new Set<string>();
    set.add(row.matchId);
    matchIdsByIdentity.set(identity, set);
  }

  const summaries = aggregateSeasonCombinations(includedRows, opponentByMatch);
  const patterns: TeamSeasonPattern[] = [];

  for (const summary of summaries) {
    if (summary.confidence === "INSUFFICIENT") continue;
    if (summary.family === "PARTNERSHIP" && !clearsPartnershipSurfaceGate(summary)) continue;

    const identity = combinationIdentity(summary.family, summary.subtype, summary.playerIds);
    const matchIds = [...(matchIdsByIdentity.get(identity) ?? new Set<string>())];
    const earlierPresent = matchIds.some((id) => !recentMatchIds.has(id));
    const recentPresent = matchIds.some((id) => recentMatchIds.has(id));
    const dates = matchIds.map((id) => matchDatesById.get(id)).filter((d): d is Date => d != null);

    patterns.push({
      key: combinationKey(summary),
      family: "COMBINATION",
      subtype: summary.subtype ? `${summary.family}_${summary.subtype}` : summary.family,
      subjects: {
        playerIds: summary.playerIds,
        positions: summary.positions,
        ...(summary.family === "CORRIDOR" && summary.subtype ? { corridor: summary.subtype as TeamSeasonCorridor } : {}),
      },
      evidenceStrength: summary.confidence,
      trajectory: classifyCombinationTrajectory(earlierPresent, recentPresent),
      tone: "NEUTRAL",
      firstObservedAt: dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString() : null,
      lastObservedAt: dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString() : null,
      approximateTiming: summary.approximateTiming,
      sample: { matches: summary.matchCount, exposureMinutes: summary.totalMinutesTogether, opponentDiversity: summary.opponentDiversity },
      metrics: {
        minutesTogether: summary.totalMinutesTogether,
        matchCount: summary.matchCount,
        goalsForWhilePresent: summary.goalsForTotal,
        goalsAgainstWhilePresent: summary.goalsAgainstTotal,
        directGoalContributions: summary.directGoalContributionsTotal,
        directAssistContributions: summary.directAssistContributionsTotal,
        opponentDiversity: summary.opponentDiversity,
      },
      sourceRefs: matchIds.map((id) => `match:${id}`),
    });
  }

  return patterns;
}
