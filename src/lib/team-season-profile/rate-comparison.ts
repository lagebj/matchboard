/**
 * Shared effect-size gate (ADR-0156 / `04_CONFIDENCE_TRAJECTORY_AND_LANGUAGE.md` §3/§4) --
 * "transparent effect-size gates", never statistical significance testing on youth-football
 * sample sizes. Used both for match-rhythm candidate surfacing
 * (`03_PATTERN_CATALOGUE_V1.md` A1: "the concentration is meaningfully above the team's own
 * remaining-match rate") and for rate-based trajectory classification
 * (`trajectory.ts`'s `classifyRateTrajectory`) -- one gate, two callers, so the two concepts
 * can never silently drift apart.
 */
export type RateWindow = { events: number; exposureHours: number };

export function rate(window: RateWindow): number {
  return window.exposureHours > 0 ? window.events / window.exposureHours : 0;
}

/**
 * True when `candidate`'s rate differs from `baseline`'s rate by at least 50% relative (to the
 * baseline) AND at least 0.5 events per exposure hour absolute, and both windows independently
 * have at least 2 events. `baseline` is the comparison reference (the "outside the candidate
 * window" rate for surfacing, or the "earlier in the season" rate for trajectory) -- relative
 * difference is always computed against it, not symmetrically, matching §3's "recent rate to
 * differ ... relative" framing.
 */
export function isMaterialRateDifference(candidate: RateWindow, baseline: RateWindow): boolean {
  if (candidate.events < 2 || baseline.events < 2) return false;

  const candidateRate = rate(candidate);
  const baselineRate = rate(baseline);
  const absoluteDiff = Math.abs(candidateRate - baselineRate);
  if (absoluteDiff < 0.5) return false;

  const relativeDiff = baselineRate > 0 ? absoluteDiff / baselineRate : candidateRate > 0 ? Infinity : 0;
  return relativeDiff >= 0.5;
}
