import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { eligibleRounds, actualMinutesMeasure, identity, rawRecordsForHash } from "../fixtures";
import { computeOpportunityCoverage } from "../view-model";

describe("A04-S1 partial-minutes fixture", () => {
  it("has exactly five distinct eligible round IDs and five distinct opportunity source IDs", () => {
    expect(new Set(eligibleRounds.map((r) => r.roundId)).size).toBe(5);
    expect(new Set(eligibleRounds.map((r) => r.opportunitySourceId)).size).toBe(5);
  });

  it("derives 5/5 from the fixture length, never a hard-coded literal", () => {
    const { numerator, denominator } = computeOpportunityCoverage();
    expect(denominator).toBe(eligibleRounds.length);
    expect(numerator).toBe(eligibleRounds.length);
    expect(numerator).toBe(5);
  });

  it("chooses NOT_RECORDED for actual minutes, never ZERO or a numeric value", () => {
    expect(actualMinutesMeasure.coverage).toBe("NOT_RECORDED");
    expect(actualMinutesMeasure.measureName).toBe("recorded opportunity");
  });

  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
