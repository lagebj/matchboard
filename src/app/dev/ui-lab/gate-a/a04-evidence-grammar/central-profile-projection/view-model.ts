import { aggregateExactAppearancesByProfile, type ProfileEvidenceAggregate } from "../../shared/profile-position-model";
import type { SourceRecord } from "../shared/coverage";
import { assertNonOverlappingIntervals } from "../shared/invariants";
import { exactIntervals, matchLabel, toExactAppearances, identity } from "./fixtures";

/** Asserts the fixture's two intervals are non-overlapping, then projects them through the real
 * W1 aggregator — never a bespoke re-implementation that could silently diverge. */
export function computeCmProjection(): ProfileEvidenceAggregate {
  assertNonOverlappingIntervals(exactIntervals.map((i) => ({ start: i.startMinute, end: i.endMinute })));
  const [aggregate] = aggregateExactAppearancesByProfile(toExactAppearances(exactIntervals));
  if (!aggregate || aggregate.profile !== "CM") {
    throw new Error("A04-S5 fixture must project to exactly one CM profile aggregate");
  }
  return aggregate;
}

export function buildSourceRecords(): SourceRecord[] {
  return exactIntervals.map((i) => ({
    sourceId: i.sourceId,
    sourceClass: identity.sourceClass,
    provenance: "Actual closed playing interval",
    scope: matchLabel,
    fieldLabel: i.tacticalPosition,
    fieldValue: `${i.startMinute}'–${i.endMinute}' (${i.endMinute - i.startMinute} minutes)`,
    coverage: "COMPLETE",
    transformation: `Collapses into the CM profile group (${i.tacticalPosition} → CM) for display only — the exact tactical position is preserved here, never overwritten.`,
  }));
}
