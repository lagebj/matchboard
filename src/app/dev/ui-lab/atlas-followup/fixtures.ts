import type { PlanningPitchSlot, PlanningPitchAssignment } from "@/components/touchline/pitch/touchline-planning-pitch";
import { gridToNormalizedPoint } from "@/components/touchline/pitch/projection";
import type { TouchlinePositionMapEntry } from "@/components/touchline/pitch/touchline-position-map";

/**
 * Static fixtures for the Atlas Follow-up UI Lab (Phase F2, `01_GOLDEN_REFERENCE_INDEX_AND_CONFORMANCE_METHOD.md
 * §2 Step B: "Use static fixtures"`). Reuses the same 4-3-3 / player-name scenario the golden
 * references (`03-lineup-vertical-pitch-golden.png`) already established, for a like-for-like
 * visual comparison — not invented product data (this route is dev-only fixture data, matching
 * the existing `/dev/ui-lab/atlas/fixtures.ts` convention).
 */
const RED_KIT = "#d5342c";

export const planningPitchSlots: PlanningPitchSlot[] = [
  { id: "gk", point: gridToNormalizedPoint(2, 5), roleLabel: "GK", isGoalkeeper: true },
  { id: "lb", point: gridToNormalizedPoint(0, 4), roleLabel: "LB" },
  { id: "cb1", point: gridToNormalizedPoint(1, 4), roleLabel: "CB" },
  { id: "cb2", point: gridToNormalizedPoint(3, 4), roleLabel: "CB" },
  { id: "rb", point: gridToNormalizedPoint(4, 4), roleLabel: "RB" },
  { id: "cm1", point: gridToNormalizedPoint(0, 2), roleLabel: "CM" },
  { id: "cm2", point: gridToNormalizedPoint(2, 2), roleLabel: "CM" },
  { id: "cm3", point: gridToNormalizedPoint(4, 2), roleLabel: "CM" },
  { id: "lw", point: gridToNormalizedPoint(0, 0), roleLabel: "LW" },
  { id: "st", point: gridToNormalizedPoint(2, 0), roleLabel: "ST" },
  { id: "rw", point: gridToNormalizedPoint(4, 0), roleLabel: "RW" },
];

export const planningPitchAssignments: PlanningPitchAssignment[] = [
  { slotId: "gk", name: "Kristian", number: 1, kitColor: null },
  { slotId: "lb", name: "Marius", number: 3, kitColor: RED_KIT },
  { slotId: "cb1", name: "Lars", number: 5, kitColor: RED_KIT },
  { slotId: "cb2", name: "Jonas", number: 4, kitColor: RED_KIT },
  { slotId: "rb", name: "David", number: 2, kitColor: RED_KIT },
  { slotId: "cm1", name: "Elias", number: 8, kitColor: RED_KIT },
  { slotId: "cm2", name: "Emil", number: 6, kitColor: RED_KIT, selected: true },
  { slotId: "cm3", name: "Sander", number: 10, kitColor: RED_KIT, locked: true },
  { slotId: "lw", name: "Oliver", number: 11, kitColor: RED_KIT },
  { slotId: "st", name: "Henrik", number: 9, kitColor: RED_KIT, status: "attention" },
  // "rw" intentionally left unassigned to exercise the empty-slot state.
];

export const positionMapEntries: TouchlinePositionMapEntry[] = [
  { positionCode: "LW", positionLabel: "Left Wing", rank: 1, supportBand: "STRONGEST", confidence: "HIGH" },
  { positionCode: "LM", positionLabel: "Left Midfield", rank: 2, supportBand: "STRONG", confidence: "MEDIUM" },
  { positionCode: "ST", positionLabel: "Striker", rank: null, supportBand: "LIMITED", confidence: "LOW" },
];
