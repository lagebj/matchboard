import type { MatchStateInterval, MatchStateScore } from "@/lib/evidence/match-state-timeline";
import type { GameState } from "./types";

/**
 * Thin game-state wrapper (ADR-0155 §4, source bundle §03's "Game state"). Deliberately not a
 * reconstruction: `MatchStateInterval.scoreAtStart` (ADR-0113) already carries the cumulative
 * goal count strictly before the segment's start, derived from the match's own canonical goal
 * events — this module only classifies that score from the team's own perspective.
 *
 * `timingQuality === "UNAVAILABLE"` makes the result `UNKNOWN` regardless of score: when a
 * segment's own temporal boundary is unreliable, trusting "goals before this point in time" to
 * reflect the state at the moment play actually happened is not safe — this is this module's
 * reading of the source bundle's "if chronology becomes incomplete or contradictory, affected
 * ranges are UNKNOWN" rule, applied via the one per-segment reliability signal
 * `deriveMatchStateIntervals` already produces, rather than re-deriving chronology reliability
 * independently.
 */
export function gameStateForInterval(interval: Pick<MatchStateInterval, "scoreAtStart" | "timingQuality">): GameState {
  if (interval.timingQuality === "UNAVAILABLE") return "UNKNOWN";
  return gameStateForScore(interval.scoreAtStart);
}

function gameStateForScore(score: MatchStateScore): GameState {
  if (score.for > score.against) return "LEADING";
  if (score.for < score.against) return "TRAILING";
  return "DRAWING";
}
