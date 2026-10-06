import type { TeamSeasonPatternTrajectory } from "@/lib/team-season-profile/contracts";
import { isMaterialRateDifference, rate, type RateWindow } from "@/lib/team-season-profile/rate-comparison";

/**
 * Trajectory (ADR-0156 / `04_CONFIDENCE_TRAJECTORY_AND_LANGUAGE.md` §2/§3) is a dimension
 * separate from evidence-strength confidence. `recent` must always be constructed by the
 * caller from the latest 4 completed matches that exist within the SAME selected season
 * (never crossing the season boundary -- Test plan F.1); `earlier` is everything else in the
 * season. This module only classifies already-bucketed windows -- it has no I/O and does not
 * decide which matches belong in which window.
 */

export type RateTrajectoryWindow = RateWindow & { matches: number };

/**
 * Rate-based trajectory (events per exposure hour) -- shared by match-rhythm
 * (`pattern-catalogue.ts`) and player-contribution (`player-contributions.ts`) patterns, since
 * both are dimensionally "how often did this event happen per unit of exposure".
 */
export function classifyRateTrajectory(earlier: RateTrajectoryWindow, recent: RateTrajectoryWindow): TeamSeasonPatternTrajectory {
  const earlierHasSupport = earlier.matches > 0 && earlier.events >= 2;
  const recentHasSupport = recent.matches > 0 && recent.events >= 2;

  if (!earlierHasSupport && recentHasSupport) return "NEW";

  // DORMANT requires relevant recent exposure (recent.matches > 0) with no recurrence --
  // Test plan F.8: "no relevant recent exposure does not imply DORMANT".
  if (earlierHasSupport && recent.events === 0 && recent.matches > 0) return "DORMANT";

  if (earlierHasSupport && recentHasSupport) {
    if (isMaterialRateDifference(recent, earlier)) {
      return rate(recent) > rate(earlier) ? "STRENGTHENING" : "WEAKENING";
    }
    return "PERSISTENT";
  }

  // Neither window independently clears the 2-event support bar -- a contradictory/too-small
  // comparison must not be forced into a trend (Test plan F.6).
  if (!earlierHasSupport && !recentHasSupport) {
    return earlier.events > 0 || recent.events > 0 ? "MIXED" : "PERSISTENT";
  }

  // earlierHasSupport && !recentHasSupport, but recent.matches === 0 (no completed matches in
  // the recent window at all, e.g. a season with under 4 matches total) -- no recent exposure
  // to compare against, so no claim is made either way.
  return "PERSISTENT";
}

/**
 * Qualitative tactical-theme trajectory. Reuses `classifyRateTrajectory` by treating "matches
 * in the window" as the exposure unit and "distinct matches carrying this theme's own
 * direction" as the event count (§3: "compare distinct-match prevalence, not note count") --
 * the same material-difference math applies once dimensioned this way. A genuine polarity
 * reversal is handled separately by the caller (`qualitative-patterns.ts`), which forces
 * MIXED when the opposite polarity recurs in >=2 recent matches (§3: "a polarity reversal
 * should become MIXED unless repeated in at least 2 recent matches").
 */
export function classifyThemeTrajectory(
  earlier: { distinctMatchesWithTheme: number; windowMatches: number },
  recent: { distinctMatchesWithTheme: number; windowMatches: number },
): TeamSeasonPatternTrajectory {
  return classifyRateTrajectory(
    { events: earlier.distinctMatchesWithTheme, exposureHours: earlier.windowMatches, matches: earlier.windowMatches },
    { events: recent.distinctMatchesWithTheme, exposureHours: recent.windowMatches, matches: recent.windowMatches },
  );
}

/**
 * Combination trajectory is deliberately restricted to NEW | PERSISTENT | DORMANT (§3: "V1
 * should normally use NEW | PERSISTENT | DORMANT only. Do not claim a partnership is
 * strengthening/weakening from one recent goal swing.") -- simple presence/absence across the
 * same earlier/recent split the other families use, never a rate comparison.
 */
export function classifyCombinationTrajectory(earlierPresent: boolean, recentPresent: boolean): TeamSeasonPatternTrajectory {
  if (!earlierPresent && recentPresent) return "NEW";
  if (earlierPresent && !recentPresent) return "DORMANT";
  return "PERSISTENT";
}
