import { aggregateExactAppearancesByProfile, type ExactPositionAppearance } from "../shared/profile-position-model";
import { previewLegacyDeclaredConsolidation, type ProfilePositionTriple } from "./profile-triple-selection";

/**
 * A12 — declared profile vs exact match-evidence boundary (`20_UI_LAB_CANDIDATE_WAVES.md` A12).
 * One player's real exact-position match history: 20 minutes at `LCM` in one match, 10 minutes at
 * `RCM` in another — both belong to the `CM` profile group but are genuinely different sided
 * intervals, never recorded as the same position. A separate `RB` appearance stays its own,
 * unrelated profile group.
 */
export const exactAppearances: ExactPositionAppearance[] = [
  { matchId: "m-1", tacticalPosition: "LCM", minutes: 20 },
  { matchId: "m-2", tacticalPosition: "RCM", minutes: 10 },
  { matchId: "m-3", tacticalPosition: "RB", minutes: 45 },
];

export const profileEvidenceAggregates = aggregateExactAppearancesByProfile(exactAppearances);

/** Initial declared triple (PR #777 remediation): primary + secondary filled, tertiary left
 * empty — demonstrates the "optional, clearable" slots from the first render, not just after an
 * interaction. */
export const initialDeclaredTriple: ProfilePositionTriple = {
  primary: "CM",
  secondary: "RB",
  tertiary: null,
};

/**
 * Case A — "Legacy declared positions" (PR #777 remediation, finding A12-1): a player who
 * already had a declared 24-code primary/secondary/tertiary (`LCF`/`CF`/`RCF`). All three
 * collapse to the single `F` profile group — the projected result is primary `F`, with secondary
 * and tertiary left empty (not three declarations of the same thing). The original primary
 * declaration (`LCF`) is what gives `F` its ordering authority here — this is a consolidation of
 * an existing coach decision, not a new one.
 */
export const legacyDeclaredConsolidationPreview = previewLegacyDeclaredConsolidation({
  primary: "LCF",
  secondary: "CF",
  tertiary: "RCF",
});

/**
 * Case B — "Recorded match exposure" (PR #777 remediation, finding A12-1): a *different* player,
 * with no declared profile fields at all — only historical match minutes at `LCF`/`CF`/`RCF`.
 * Reuses the same `aggregateExactAppearancesByProfile` as the main evidence drilldown: real
 * minutes and distinct-match counts, source intervals fully preserved. Deliberately NOT run
 * through any declared-triple logic — this fixture must never produce a primary/secondary/
 * tertiary declaration, since match exposure alone does not authorize one.
 */
export const matchExposureOnlyAppearances: ExactPositionAppearance[] = [
  { matchId: "m-10", tacticalPosition: "LCF", minutes: 30 },
  { matchId: "m-11", tacticalPosition: "CF", minutes: 60 },
  { matchId: "m-12", tacticalPosition: "RCF", minutes: 15 },
];

export const matchExposureOnlyAggregates = aggregateExactAppearancesByProfile(matchExposureOnlyAppearances);
