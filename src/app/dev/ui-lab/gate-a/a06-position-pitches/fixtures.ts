import type { TouchlinePositionMapEntry } from "@/components/touchline/pitch/touchline-position-map";
import type { FlatProfilePositionMapEntry } from "./flat-profile-position-map";

/**
 * A06 — tactical 5×6 (real, exact, 24-code) pitch paired against the flat profile 3×6 analysis
 * map candidate (`20_UI_LAB_CANDIDATE_WAVES.md` A06; XR-P01–P04).
 *
 * PR #777 remediation: the previous fixture only exercised 3 of the 24 exact codes (LW/LM/RW,
 * none of which collapse) — it never actually exercised the 24→14 projection. This fixture now
 * covers all 24 canonical tactical positions, synthetic/deterministic, chosen specifically to
 * demonstrate:
 *
 * 1. `LB`/`LWB` and `RB`/`RWB` as simultaneous, independently visible, individually selectable
 *    evidence (the flat grid's previous coordinate collision is fixed in `profile-position-model.ts`).
 * 2. All five centre-line consolidation groups collapsing correctly:
 *    `LCB/CB/RCB` → `CB`, `LDM/CDM/RDM` → `DM`, `LCM/CM/RCM` → `CM`, `LAM/CAM/RAM` → `AM`,
 *    `LCF/CF/RCF` → `F`.
 *
 * Every profile-level support/confidence value below is the *strongest* of its group's three
 * exact-level values (never invented beyond what the exact entries already state) — each profile
 * entry's comment cites which exact code it mirrors, so a reviewer can trace it back.
 */
export const exactTacticalEvidence: TouchlinePositionMapEntry[] = [
  // Singletons — map 1:1 to their profile label, no collapsing involved.
  { positionCode: "GK", positionLabel: "Goalkeeper", rank: 1, supportBand: "STRONGEST", confidence: "HIGH" },
  { positionCode: "LB", positionLabel: "Left Back", rank: 2, supportBand: "STRONG", confidence: "MEDIUM" },
  { positionCode: "RB", positionLabel: "Right Back", rank: null, supportBand: "ESTABLISHED", confidence: "MEDIUM" },
  { positionCode: "LWB", positionLabel: "Left Wing-Back", rank: null, supportBand: "LIMITED", confidence: "LOW" },
  { positionCode: "RWB", positionLabel: "Right Wing-Back", rank: 2, supportBand: "STRONG", confidence: "HIGH" },
  { positionCode: "LM", positionLabel: "Left Midfield", rank: null, supportBand: "ESTABLISHED", confidence: "MEDIUM" },
  { positionCode: "RM", positionLabel: "Right Midfield", rank: null, supportBand: "LIMITED", confidence: "LOW" },
  { positionCode: "LW", positionLabel: "Left Wing", rank: 1, supportBand: "STRONGEST", confidence: "HIGH" },
  { positionCode: "RW", positionLabel: "Right Wing", rank: null, supportBand: "LIMITED", confidence: "LOW" },

  // CB group — collapses to profile "CB". Strongest member: CB (STRONGEST/HIGH).
  { positionCode: "LCB", positionLabel: "Left Centre-Back", rank: null, supportBand: "STRONG", confidence: "MEDIUM" },
  { positionCode: "CB", positionLabel: "Centre-Back", rank: 1, supportBand: "STRONGEST", confidence: "HIGH" },
  { positionCode: "RCB", positionLabel: "Right Centre-Back", rank: null, supportBand: "LIMITED", confidence: "LOW" },

  // DM group — collapses to profile "DM". Strongest member: CDM (STRONG/HIGH).
  { positionCode: "LDM", positionLabel: "Left Defensive Mid", rank: null, supportBand: "ESTABLISHED", confidence: "MEDIUM" },
  { positionCode: "CDM", positionLabel: "Central Defensive Mid", rank: 2, supportBand: "STRONG", confidence: "HIGH" },
  { positionCode: "RDM", positionLabel: "Right Defensive Mid", rank: null, supportBand: "LIMITED", confidence: "LOW" },

  // CM group — collapses to profile "CM". Strongest member: LCM (STRONG/HIGH).
  { positionCode: "LCM", positionLabel: "Left Centre Mid", rank: 2, supportBand: "STRONG", confidence: "HIGH" },
  { positionCode: "CM", positionLabel: "Centre Mid", rank: null, supportBand: "ESTABLISHED", confidence: "MEDIUM" },
  { positionCode: "RCM", positionLabel: "Right Centre Mid", rank: null, supportBand: "LIMITED", confidence: "LOW" },

  // AM group — collapses to profile "AM". Strongest member: CAM (STRONGEST/HIGH).
  { positionCode: "LAM", positionLabel: "Left Attacking Mid", rank: null, supportBand: "LIMITED", confidence: "LOW" },
  { positionCode: "CAM", positionLabel: "Central Attacking Mid", rank: 1, supportBand: "STRONGEST", confidence: "HIGH" },
  { positionCode: "RAM", positionLabel: "Right Attacking Mid", rank: null, supportBand: "ESTABLISHED", confidence: "MEDIUM" },

  // F group — collapses to profile "F". Strongest member: CF (STRONG/HIGH).
  { positionCode: "LCF", positionLabel: "Left Centre-Forward", rank: null, supportBand: "ESTABLISHED", confidence: "MEDIUM" },
  { positionCode: "CF", positionLabel: "Centre-Forward", rank: 2, supportBand: "STRONG", confidence: "HIGH" },
  { positionCode: "RCF", positionLabel: "Right Centre-Forward", rank: null, supportBand: "LIMITED", confidence: "LOW" },
];

export const profileEvidence: FlatProfilePositionMapEntry[] = [
  // Singletons — identical values to their 1:1 exact source (no aggregation).
  { position: "GK", positionLabel: "GK", rank: 1, supportBand: "STRONGEST", confidence: "HIGH" },
  { position: "LB", positionLabel: "LB", rank: 2, supportBand: "STRONG", confidence: "MEDIUM" },
  { position: "RB", positionLabel: "RB", rank: null, supportBand: "ESTABLISHED", confidence: "MEDIUM" },
  { position: "LWB", positionLabel: "LWB", rank: null, supportBand: "LIMITED", confidence: "LOW" },
  { position: "RWB", positionLabel: "RWB", rank: 2, supportBand: "STRONG", confidence: "HIGH" },
  { position: "LM", positionLabel: "LM", rank: null, supportBand: "ESTABLISHED", confidence: "MEDIUM" },
  { position: "RM", positionLabel: "RM", rank: null, supportBand: "LIMITED", confidence: "LOW" },
  { position: "LW", positionLabel: "LW", rank: 1, supportBand: "STRONGEST", confidence: "HIGH" },
  { position: "RW", positionLabel: "RW", rank: null, supportBand: "LIMITED", confidence: "LOW" },
  // Consolidated — each mirrors its group's strongest exact-level value (see comments above).
  { position: "CB", positionLabel: "CB", rank: 1, supportBand: "STRONGEST", confidence: "HIGH" }, // mirrors CB
  { position: "DM", positionLabel: "DM", rank: 2, supportBand: "STRONG", confidence: "HIGH" }, // mirrors CDM
  { position: "CM", positionLabel: "CM", rank: 2, supportBand: "STRONG", confidence: "HIGH" }, // mirrors LCM
  { position: "AM", positionLabel: "AM", rank: 1, supportBand: "STRONGEST", confidence: "HIGH" }, // mirrors CAM
  { position: "F", positionLabel: "F", rank: 2, supportBand: "STRONG", confidence: "HIGH" }, // mirrors CF
];
