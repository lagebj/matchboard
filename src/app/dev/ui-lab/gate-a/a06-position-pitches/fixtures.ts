import type { TouchlinePositionMapEntry } from "@/components/touchline/pitch/touchline-position-map";
import type { FlatProfilePositionMapEntry } from "./flat-profile-position-map";

/**
 * A06 — tactical 5×6 (real, exact, 24-code) pitch paired against the flat profile 3×6 analysis
 * map candidate (`20_UI_LAB_CANDIDATE_WAVES.md` A06; XR-P01–P04). Same underlying evidence
 * ("strong support at LW, established at LM, limited at RW") shown once through the real 24-code
 * tactical vocabulary and once collapsed to the 14-role profile vocabulary — exercising the
 * "LW/RW stay wide-sided, never silently promoted to a centre forward" rule.
 */
export const exactTacticalEvidence: TouchlinePositionMapEntry[] = [
  { positionCode: "LW", positionLabel: "Left Wing", rank: 1, supportBand: "STRONG", confidence: "HIGH" },
  { positionCode: "LM", positionLabel: "Left Midfield", rank: 2, supportBand: "ESTABLISHED", confidence: "MEDIUM" },
  { positionCode: "RW", positionLabel: "Right Wing", rank: null, supportBand: "LIMITED", confidence: "LOW" },
];

/** Same three positions, collapsed through the profile vocabulary — LW/RW are unsided-wide in
 * the 24-code model but remain their own distinct profile labels (not merged into one "W"). */
export const profileEvidence: FlatProfilePositionMapEntry[] = [
  { position: "LW", positionLabel: "Left Wing", rank: 1, supportBand: "STRONG", confidence: "HIGH" },
  { position: "LM", positionLabel: "Left Midfield", rank: 2, supportBand: "ESTABLISHED", confidence: "MEDIUM" },
  { position: "RW", positionLabel: "Right Wing", rank: null, supportBand: "LIMITED", confidence: "LOW" },
];
