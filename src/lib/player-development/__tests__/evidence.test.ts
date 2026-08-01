import { describe, it, expect } from "vitest";
import {
  evaluateAttributeEvidence,
  computeAttributeProposal,
  type AttributeEvidenceResult,
  type AttributeSuggestion,
  type EvidenceConfidence,
} from "../evidence";

describe("evaluateAttributeEvidence", () => {
  const makeObs = (id: string, direction: "POSITIVE" | "NEGATIVE", daysAgo: number, matchId: string) => ({
    id,
    direction,
    observedAt: new Date(Date.now() - daysAgo * 86400000),
    matchId,
    attributeKey: "ballControl" as const,
  });

  it("returns null for empty observations", () => {
    const result = evaluateAttributeEvidence([], null);
    expect(result).toBeNull();
  });

  it("returns LOW confidence with no direction for fewer than 3 aligned observations", () => {
    const observations = [
      makeObs("1", "POSITIVE", 5, "m1"),
      makeObs("2", "POSITIVE", 10, "m2"),
    ];
    const result = evaluateAttributeEvidence(observations, null);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("LOW");
    expect(result!.direction).toBeNull();
  });

  it("returns MEDIUM confidence with direction for 3+ aligned, distinct matches", () => {
    const observations = [
      makeObs("1", "POSITIVE", 5, "m1"),
      makeObs("2", "POSITIVE", 10, "m2"),
      makeObs("3", "POSITIVE", 15, "m3"),
    ];
    const result = evaluateAttributeEvidence(observations, null);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("MEDIUM");
    expect(result!.direction).toBe("POSITIVE");
  });

  it("returns HIGH confidence for 5+ aligned across 4+ distinct matches with ≤1 contradictory", () => {
    const observations = [
      makeObs("1", "POSITIVE", 1, "m1"),
      makeObs("2", "POSITIVE", 5, "m2"),
      makeObs("3", "POSITIVE", 10, "m3"),
      makeObs("4", "POSITIVE", 15, "m4"),
      makeObs("5", "POSITIVE", 20, "m5"),
    ];
    const result = evaluateAttributeEvidence(observations, null);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("HIGH");
    expect(result!.direction).toBe("POSITIVE");
  });

  it("returns LOW confidence when aligned-contradictory gap is less than 2", () => {
    const observations = [
      makeObs("1", "POSITIVE", 5, "m1"),
      makeObs("2", "NEGATIVE", 10, "m2"),
    ];
    const result = evaluateAttributeEvidence(observations, null);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("LOW");
    expect(result!.direction).toBeNull();
  });

  it("returns NEGATIVE direction when more negatives than positives", () => {
    const observations = [
      makeObs("1", "NEGATIVE", 5, "m1"),
      makeObs("2", "NEGATIVE", 10, "m2"),
      makeObs("3", "NEGATIVE", 15, "m3"),
      makeObs("4", "POSITIVE", 20, "m4"),
    ];
    const result = evaluateAttributeEvidence(observations, null);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("NEGATIVE");
  });

  it("filters observations after baseline date", () => {
    const baseline = new Date(Date.now() - 20 * 86400000);
    const observations = [
      makeObs("1", "POSITIVE", 5, "m1"),
      makeObs("2", "POSITIVE", 10, "m2"),
      makeObs("3", "POSITIVE", 30, "m3"),
    ];
    const result = evaluateAttributeEvidence(observations, baseline);
    expect(result).not.toBeNull();
    expect(result!.evidenceIds).toHaveLength(2);
  });
});

describe("computeAttributeProposal", () => {
  const makeEvidence = (
    overrides: Partial<AttributeEvidenceResult> = {},
  ): AttributeEvidenceResult => ({
    playerId: "p1",
    attributeKey: "ballControl",
    confidence: "MEDIUM" as EvidenceConfidence,
    direction: "POSITIVE",
    alignedCount: 3,
    contradictoryCount: 0,
    distinctMatchCount: 3,
    evidenceIds: ["e1", "e2", "e3"],
    baselineAt: null,
    ...overrides,
  });

  it("returns null for LOW confidence", () => {
    const evidence = makeEvidence({ confidence: "LOW" });
    const proposal = computeAttributeProposal(evidence, 5);
    expect(proposal).toBeNull();
  });

  it("returns null for null direction", () => {
    const evidence = makeEvidence({ direction: null });
    const proposal = computeAttributeProposal(evidence, 5);
    expect(proposal).toBeNull();
  });

  it("returns null proposal when currentValue is null (no baseline to propose from)", () => {
    const evidence = makeEvidence();
    const proposal = computeAttributeProposal(evidence, null);
    expect(proposal).not.toBeNull();
    expect(proposal!.proposedValue).toBeNull();
  });

  it("proposes +1 for POSITIVE MEDIUM evidence", () => {
    const evidence = makeEvidence({ confidence: "MEDIUM", direction: "POSITIVE" });
    const proposal = computeAttributeProposal(evidence, 5);
    expect(proposal).not.toBeNull();
    expect(proposal!.proposedValue).toBe(6);
    expect(proposal!.direction).toBe("POSITIVE");
  });

  it("proposes -1 for NEGATIVE MEDIUM evidence", () => {
    const evidence = makeEvidence({ confidence: "MEDIUM", direction: "NEGATIVE" });
    const proposal = computeAttributeProposal(evidence, 5);
    expect(proposal).not.toBeNull();
    expect(proposal!.proposedValue).toBe(4);
  });

  it("caps proposed value at 10", () => {
    const evidence = makeEvidence({ confidence: "HIGH", direction: "POSITIVE" });
    const proposal = computeAttributeProposal(evidence, 10);
    expect(proposal).toBeNull();
  });

  it("caps proposed value at 1 minimum", () => {
    const evidence = makeEvidence({ confidence: "HIGH", direction: "NEGATIVE" });
    const proposal = computeAttributeProposal(evidence, 1);
    expect(proposal).toBeNull();
  });

  it("returns null when proposed equals current", () => {
    const evidence = makeEvidence({ confidence: "HIGH", direction: "POSITIVE" });
    const proposal = computeAttributeProposal(evidence, 10);
    expect(proposal).toBeNull();
  });
});