import type { CandidateTacticalPositionMapEntry } from "./candidate-tactical-position-map";
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
 * PR #777 remediation (finding A06-2): an earlier version of this fixture derived each
 * consolidated profile dot's support/confidence as "the strongest of its group's three exact-
 * level values" — an aggregation *rule* with no product approval, and no authoritative domain
 * service in this repository computes that semantics (`effective-position-profile.ts` /
 * `get-effective-position-profile.ts`, ADR-0139's evidence-ranking engine, scores individual
 * exact tactical codes — it has no notion of collapsing three sided codes' support into one
 * profile-level value). Inventing that rule here would have made this UI Lab candidate look like
 * it was proposing real domain behaviour.
 *
 * The five consolidated profile dots below therefore carry one flat, explicitly-labeled
 * *illustrative* placeholder (`ESTABLISHED`/`MEDIUM`) instead — chosen, not computed, and
 * identical across all five groups specifically so no reviewer could read a pattern into it as
 * if it were derived from the source values. See the page caption for the same disclosure.
 * Whether and how a real cross-position aggregate should ever be computed is an open product
 * question for a future design review (`candidate_manifest.json`'s A06 `knownGaps`), not decided
 * by this candidate. The exact-level entries below are completely unchanged by this fix — they
 * remain the real source of truth, and the 24→14 *position* mapping itself (not the support
 * values) is still the approved, unchanged behaviour this fixture demonstrates.
 *
 * Owner visual feedback (2026-10-09): "A06 24 point positions should have LW and RW on Attacking
 * midfielder horizontal similar to 14 point position. GK and F are always central." This fixture
 * data is unchanged by that feedback — it's a presentation fix, not a data fix — but the exact
 * panel now renders through `CandidateTacticalPositionMap` (a candidate-only presentation
 * override, see `candidate-position-grid.ts`) instead of the real production
 * `TouchlinePositionMap`, so `LW`/`RW` display on the attacking-midfield line rather than
 * production's attack-line default.
 */
export const exactTacticalEvidence: CandidateTacticalPositionMapEntry[] = [
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
  // Consolidated — ILLUSTRATIVE placeholder only (ESTABLISHED/MEDIUM, uniformly, rank null): not
  // computed from the exact-level group members, no approved aggregation rule exists (see the
  // file-level comment above and CONSOLIDATED_GROUP_PLACEHOLDER_NOTE below).
  { position: "CB", positionLabel: "CB", rank: null, supportBand: "ESTABLISHED", confidence: "MEDIUM" },
  { position: "DM", positionLabel: "DM", rank: null, supportBand: "ESTABLISHED", confidence: "MEDIUM" },
  { position: "CM", positionLabel: "CM", rank: null, supportBand: "ESTABLISHED", confidence: "MEDIUM" },
  { position: "AM", positionLabel: "AM", rank: null, supportBand: "ESTABLISHED", confidence: "MEDIUM" },
  { position: "F", positionLabel: "F", rank: null, supportBand: "ESTABLISHED", confidence: "MEDIUM" },
];

/** The five profile positions whose fixture value above is an illustrative placeholder rather
 * than a real or derived value — used by the fixture test to assert honest labeling/traceability. */
export const CONSOLIDATED_PLACEHOLDER_PROFILE_POSITIONS = ["CB", "DM", "CM", "AM", "F"] as const;
