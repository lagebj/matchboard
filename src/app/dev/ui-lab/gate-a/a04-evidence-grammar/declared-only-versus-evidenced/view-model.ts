import { aggregateExactAppearancesByProfile, type ProfileEvidenceAggregate } from "../../shared/profile-position-model";
import type { SourceRecord } from "../shared/coverage";
import { assertNonOverlappingIntervals } from "../shared/invariants";
import {
  caseAExposureCheckExplanation,
  caseAExposureCheckSourceId,
  caseADeclarationSourceId,
  caseBDeclarationSourceId,
  caseBExactIntervals,
  caseBExactAppearances,
  caseBMatchLabel,
  declaredPrimary,
  identity,
} from "./fixtures";

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

function buildDeclarationSourceRecord(sourceId: string): SourceRecord {
  return {
    sourceId,
    sourceClass: identity.sourceClass,
    provenance: "Coach-authored profile declaration",
    scope: "Current declared profile",
    fieldLabel: "Declared primary profile",
    fieldValue: declaredPrimary,
    coverage: "COMPLETE",
  };
}

/** Case A's declaration is a fully recorded fact — `COMPLETE`, scoped separately from the
 * exposure-absence claim below (independent review round 1, PR #778, finding R2). */
export function buildCaseADeclarationSourceRecords(): SourceRecord[] {
  return [buildDeclarationSourceRecord(caseADeclarationSourceId)];
}

/** Case A's actual-exposure absence has its own inspectable source — proving the absence was
 * checked, not merely inferred from a missing field (finding R2). */
export function buildCaseAExposureSourceRecords(): SourceRecord[] {
  return [
    {
      sourceId: caseAExposureCheckSourceId,
      sourceClass: identity.sourceClass,
      provenance: "Actual-exposure recording-scope check",
      scope: "Full match history",
      fieldLabel: "Actual match exposure",
      fieldValue: caseAExposureCheckExplanation,
      coverage: "NOT_RECORDED",
    },
  ];
}

export function buildCaseBDeclarationSourceRecords(): SourceRecord[] {
  return [buildDeclarationSourceRecord(caseBDeclarationSourceId)];
}

/** Scoped to the evidence claim only — never includes the declaration record (finding R2/R3). */
export function buildCaseBEvidenceSourceRecords(): SourceRecord[] {
  return caseBExactIntervals.map((i) => ({
    sourceId: i.sourceId,
    sourceClass: identity.sourceClass,
    provenance: "Actual closed playing interval",
    scope: caseBMatchLabel,
    fieldLabel: i.tacticalPosition,
    fieldValue: `${i.startMinute}'–${i.endMinute}' (${i.endMinute - i.startMinute} minutes)`,
    coverage: "COMPLETE",
    transformation: `Collapses into the ${declaredPrimary} profile group for display only — the exact tactical position is preserved.`,
  }));
}
