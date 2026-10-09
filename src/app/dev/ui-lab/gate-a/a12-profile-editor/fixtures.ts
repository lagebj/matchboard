import { aggregateExactAppearancesByProfile, type ExactPositionAppearance } from "../shared/profile-position-model";

/**
 * A12 — declared profile vs exact match-evidence boundary (`20_UI_LAB_CANDIDATE_WAVES.md` A12).
 * One player's real exact-position match history: 20 minutes at `LCM` in one match, 10 minutes at
 * `RCM` in another — both belong to the `CM` profile group but are genuinely different sided
 * intervals, never recorded as the same position.
 */
export const declaredProfilePosition = "CM" as const;

export const exactAppearances: ExactPositionAppearance[] = [
  { matchId: "m-1", tacticalPosition: "LCM", minutes: 20 },
  { matchId: "m-2", tacticalPosition: "RCM", minutes: 10 },
  { matchId: "m-3", tacticalPosition: "RB", minutes: 45 },
];

export const profileEvidenceAggregates = aggregateExactAppearancesByProfile(exactAppearances);
