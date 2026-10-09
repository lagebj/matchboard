import { aggregateExactAppearancesByProfile, type ExactPositionAppearance } from "../shared/profile-position-model";
import { previewLegacyConsolidation, type ProfilePositionTriple } from "./profile-triple-selection";

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

/** Legacy migration preview (PR #777 remediation): a player whose entire historical exact-match
 * record is LCF/CF/RCF — all three collapse to the single `F` profile group, so the preview must
 * show ONE declared primary (`F`) and must NOT invent a secondary or tertiary the source data
 * never distinguished. */
export const legacyForwardConsolidationPreview = previewLegacyConsolidation(["LCF", "CF", "RCF"]);
