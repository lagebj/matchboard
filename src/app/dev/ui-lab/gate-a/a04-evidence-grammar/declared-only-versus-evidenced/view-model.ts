import { aggregateExactAppearancesByProfile, type ProfileEvidenceAggregate } from "../../shared/profile-position-model";
import type { SourceRecord } from "../shared/coverage";
import { assertNonOverlappingIntervals } from "../shared/invariants";
import { caseBExactIntervals, caseBExactAppearances, caseBMatchLabel, declarationSourceId, declaredPrimary, identity } from "./fixtures";

/** Case B's evidence aggregate — asserted non-overlapping, then projected through the real W1
 * aggregator, exactly as A04-S5 does. Case A has no equivalent: declaration alone produces no
 * aggregate at all, never an invented one. */
export function computeCaseBEvidence(): ProfileEvidenceAggregate {
  assertNonOverlappingIntervals(caseBExactIntervals.map((i) => ({ start: i.startMinute, end: i.endMinute })));
  const [aggregate] = aggregateExactAppearancesByProfile(caseBExactAppearances());
  if (!aggregate || aggregate.profile !== declaredPrimary) {
    throw new Error("A04-S6 Case B fixture must project to the declared CM profile");
  }
  return aggregate;
}

export function buildDeclarationSourceRecord(): SourceRecord {
  return {
    sourceId: declarationSourceId,
    sourceClass: identity.sourceClass,
    provenance: "Coach-authored profile declaration",
    scope: "Current declared profile",
    fieldLabel: "Declared primary profile",
    fieldValue: declaredPrimary,
    coverage: "COMPLETE",
  };
}

export function buildCaseBSourceRecords(): SourceRecord[] {
  return [
    buildDeclarationSourceRecord(),
    ...caseBExactIntervals.map((i) => ({
      sourceId: i.sourceId,
      sourceClass: identity.sourceClass,
      provenance: "Actual closed playing interval",
      scope: caseBMatchLabel,
      fieldLabel: i.tacticalPosition,
      fieldValue: `${i.startMinute}'–${i.endMinute}' (${i.endMinute - i.startMinute} minutes)`,
      coverage: "COMPLETE" as const,
      transformation: `Collapses into the ${declaredPrimary} profile group for display only — the exact tactical position is preserved.`,
    })),
  ];
}
