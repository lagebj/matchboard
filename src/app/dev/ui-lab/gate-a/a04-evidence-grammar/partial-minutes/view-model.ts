import type { SourceRecord } from "../shared/coverage";
import { eligibleRounds, actualMinutesMeasure, groupScopeLabel, identity } from "./fixtures";

/** Derives the opportunity denominator/numerator from the raw fixture, never a hard-coded 5/5. */
export function computeOpportunityCoverage(): { numerator: number; denominator: number } {
  const denominator = eligibleRounds.length;
  const numerator = eligibleRounds.filter((round) => Boolean(round.opportunitySourceId)).length;
  return { numerator, denominator };
}

export function buildSourceRecords(): SourceRecord[] {
  return [
    ...eligibleRounds.map((round) => ({
      sourceId: round.opportunitySourceId,
      sourceClass: identity.sourceClass,
      provenance: "League round opportunity record",
      scope: `${round.roundLabel} · ${round.dateUtc.slice(0, 10)} · ${groupScopeLabel}`,
      fieldLabel: "Opportunity",
      fieldValue: "Eligible — player was selectable for this round",
      coverage: "COMPLETE" as const,
    })),
    {
      sourceId: actualMinutesMeasure.minutesSourceId,
      sourceClass: identity.sourceClass,
      provenance: "Actual-minutes measurement scope",
      scope: groupScopeLabel,
      fieldLabel: `Minutes (${actualMinutesMeasure.measureName})`,
      fieldValue: actualMinutesMeasure.explanation,
      coverage: actualMinutesMeasure.coverage,
    },
  ];
}
