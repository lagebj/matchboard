import type { SourceRecord } from "../shared/coverage";
import { assertUniqueIds } from "../shared/invariants";
import { eligibleRounds, actualMinutesMeasure, groupScopeLabel, identity, type EligibleRoundRecord } from "./fixtures";

/**
 * Derives the opportunity denominator/numerator from the raw fixture — never a hard-coded 5/5.
 * The denominator counts distinct eligible rounds; the numerator counts only those with a
 * genuinely recorded opportunity (not merely eligibility) — the two are different facts
 * (independent review round 1, PR #778, finding R1).
 */
export function computeOpportunityCoverage(rounds: readonly EligibleRoundRecord[] = eligibleRounds): {
  numerator: number;
  denominator: number;
} {
  assertUniqueIds(
    rounds.map((r) => r.roundId),
    "round",
  );
  const denominator = rounds.length;
  const numerator = rounds.filter(hasRecordedOpportunity).length;
  return { numerator, denominator };
}

export function hasRecordedOpportunity(round: EligibleRoundRecord): boolean {
  return round.opportunitySourceId !== undefined;
}

/** Scoped to the opportunity claim only — each round's eligibility record and (when present) its
 * separately recorded opportunity record, each with its own source ID and field text that matches
 * what is actually being counted (review finding R1/R3). */
export function buildOpportunitySourceRecords(): SourceRecord[] {
  return eligibleRounds.flatMap((round) => {
    const records: SourceRecord[] = [
      {
        sourceId: round.eligibilitySourceId,
        sourceClass: identity.sourceClass,
        provenance: "Administrative eligibility record",
        scope: `${round.roundLabel} · ${round.dateUtc.slice(0, 10)} · ${groupScopeLabel}`,
        fieldLabel: "Eligibility",
        fieldValue: "Eligible — registered and not suspended for this round",
        coverage: "COMPLETE",
      },
    ];
    if (round.opportunitySourceId) {
      records.push({
        sourceId: round.opportunitySourceId,
        sourceClass: identity.sourceClass,
        provenance: "Recorded squad-opportunity record",
        scope: `${round.roundLabel} · ${round.dateUtc.slice(0, 10)} · ${groupScopeLabel}`,
        fieldLabel: "Opportunity",
        fieldValue: "Recorded — player was named to the matchday squad for this round",
        coverage: "COMPLETE",
      });
    }
    return records;
  });
}

/** Scoped to the actual-minutes claim only — a different recording scope from the opportunity
 * records above, inspected separately (review finding R3). */
export function buildMinutesSourceRecords(): SourceRecord[] {
  return [
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
