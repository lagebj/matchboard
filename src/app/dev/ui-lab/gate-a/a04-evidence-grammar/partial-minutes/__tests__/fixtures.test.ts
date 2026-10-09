import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { eligibleRounds, actualMinutesMeasure, identity, rawRecordsForHash, eligibleNoOpportunityRound, duplicateRoundIdRecord } from "../fixtures";
import { computeOpportunityCoverage, hasRecordedOpportunity, buildOpportunitySourceRecords } from "../view-model";

describe("A04-S1 partial-minutes fixture", () => {
  it("has exactly five distinct eligible round IDs, each with its own eligibility AND opportunity source ID", () => {
    expect(new Set(eligibleRounds.map((r) => r.roundId)).size).toBe(5);
    expect(new Set(eligibleRounds.map((r) => r.eligibilitySourceId)).size).toBe(5);
    expect(new Set(eligibleRounds.map((r) => r.opportunitySourceId)).size).toBe(5);
    for (const round of eligibleRounds) {
      expect(round.eligibilitySourceId).not.toBe(round.opportunitySourceId);
    }
  });

  it("derives 5/5 from the fixture length and a real opportunity-presence count, never a hard-coded literal", () => {
    const { numerator, denominator } = computeOpportunityCoverage();
    expect(denominator).toBe(eligibleRounds.length);
    expect(numerator).toBe(eligibleRounds.filter(hasRecordedOpportunity).length);
    expect(numerator).toBe(5);
  });

  it("chooses NOT_RECORDED for actual minutes, never ZERO or a numeric value", () => {
    expect(actualMinutesMeasure.coverage).toBe("NOT_RECORDED");
    expect(actualMinutesMeasure.measureName).toBe("recorded opportunity");
  });

  describe("independent review round 1 (PR #778, finding R1): eligibility vs recorded opportunity are different facts", () => {
    it("an eligible round with no recorded opportunity is NOT counted in the numerator", () => {
      const withNegativeCase = [...eligibleRounds, eligibleNoOpportunityRound];
      const { numerator, denominator } = computeOpportunityCoverage(withNegativeCase);
      expect(denominator).toBe(6);
      expect(numerator).toBe(5); // the 6th round is eligible but has no opportunity source
      expect(hasRecordedOpportunity(eligibleNoOpportunityRound)).toBe(false);
    });

    it("a duplicate roundId is rejected rather than silently double-counted", () => {
      const withDuplicate = [...eligibleRounds, duplicateRoundIdRecord];
      expect(() => computeOpportunityCoverage(withDuplicate)).toThrow(/Duplicate round id "round-12"/);
    });

    it("every rendered opportunity-claim source record's field text matches the fact actually counted", () => {
      const sources = buildOpportunitySourceRecords();
      const opportunityRecords = sources.filter((s) => s.fieldLabel === "Opportunity");
      expect(opportunityRecords).toHaveLength(5);
      for (const record of opportunityRecords) {
        expect(record.fieldValue).toMatch(/named to the matchday squad/i);
      }
      const eligibilityRecords = sources.filter((s) => s.fieldLabel === "Eligibility");
      expect(eligibilityRecords).toHaveLength(5);
      for (const record of eligibilityRecords) {
        expect(record.fieldValue).toMatch(/registered and not suspended/i);
      }
    });
  });

  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
