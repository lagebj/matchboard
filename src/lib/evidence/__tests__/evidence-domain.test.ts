import { describe, it, expect } from "vitest";
import {
  OBSERVATION_DEFINITIONS,
  ALL_OBSERVATION_CODES,
  isValidObservationCode,
  getObservationLabel,
} from "../observation-vocabulary";
import {
  OBSERVATION_ATTRIBUTE_MAPPINGS,
  verifyFullAttributeCoverage,
  getEvidenceTargets,
  getSupportingTargets,
  MAPPING_VERSION,
} from "../observation-mapping";
import {
  EVIDENCE_ENGINE_VERSION,
  createAccumulator,
  accumulateEvidence,
  computeAssessmentProposal,
  type ExtractedEvidence,
} from "../evidence-accumulator";
import { RATING_ATTRIBUTE_KEYS } from "@/lib/player-development/constants";

describe("Observation vocabulary", () => {
  it("has definitions for all observation codes", () => {
    for (const code of ALL_OBSERVATION_CODES) {
      const def = OBSERVATION_DEFINITIONS[code];
      expect(def).toBeDefined();
      expect(def.code).toBe(code);
      expect(def.positiveLabel).toBeTruthy();
      expect(def.negativeLabel).toBeTruthy();
    }
  });

  it("has exactly 14 observation codes", () => {
    expect(ALL_OBSERVATION_CODES).toHaveLength(14);
  });

  it("validates observation codes", () => {
    expect(isValidObservationCode("SECURE_ON_BALL")).toBe(true);
    expect(isValidObservationCode("INVALID_CODE")).toBe(false);
  });

  it("returns positive and negative labels", () => {
    expect(getObservationLabel("SECURE_ON_BALL", "POSITIVE")).toBe(
      "Secure on the ball",
    );
    expect(getObservationLabel("SECURE_ON_BALL", "NEGATIVE")).toBe(
      "Struggled to keep control",
    );
  });

  it("uses child-safe language in all labels", () => {
    const disallowedTerms = [
      "lazy",
      "selfish",
      "bad attitude",
      "weak player",
      "not good enough",
      "useless",
      "problem player",
    ];

    for (const code of ALL_OBSERVATION_CODES) {
      const def = OBSERVATION_DEFINITIONS[code];
      for (const term of disallowedTerms) {
        expect(
          def.positiveLabel.toLowerCase(),
          `Positive label for ${code} contains disallowed term: ${term}`,
        ).not.toContain(term);
        expect(
          def.negativeLabel.toLowerCase(),
          `Negative label for ${code} contains disallowed term: ${term}`,
        ).not.toContain(term);
      }
    }
  });
});

describe("Observation mapping", () => {
  it("has mappings for all observation codes", () => {
    for (const code of ALL_OBSERVATION_CODES) {
      const mapping = OBSERVATION_ATTRIBUTE_MAPPINGS[code];
      expect(mapping).toBeDefined();
      expect(mapping.code).toBe(code);
    }
  });

  it("has a version stamp", () => {
    expect(MAPPING_VERSION).toBeTruthy();
    expect(MAPPING_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("provides full DIRECT coverage for all 12 mutable numeric player attributes", () => {
    const result = verifyFullAttributeCoverage();
    expect(
      result.passed,
      `Uncovered attributes: ${result.uncovered.join(", ")}`,
    ).toBe(true);
    expect(result.covered).toHaveLength(12);
  });

  it("maps GOALKEEPING_EFFECTIVE to goalkeeper capability (not a numeric attribute)", () => {
    const mapping = OBSERVATION_ATTRIBUTE_MAPPINGS.GOALKEEPING_EFFECTIVE;
    expect(mapping.directTargets).toHaveLength(0);
    expect(mapping.supportingTargets).toHaveLength(0);
  });

  it("returns correct evidence targets with class", () => {
    const targets = getEvidenceTargets("SECURE_ON_BALL");
    const directTargets = targets.filter((t) => t.evidenceClass === "DIRECT");
    const supportingTargets = targets.filter(
      (t) => t.evidenceClass === "SUPPORTING",
    );

    expect(directTargets).toHaveLength(1);
    expect(directTargets[0].attributeKey).toBe("ballControl");

    expect(supportingTargets).toHaveLength(2);
    const supportingKeys = supportingTargets.map((t) => t.attributeKey);
    expect(supportingKeys).toContain("firstTouch");
    expect(supportingKeys).toContain("decisionMaking");
  });

  it("each DIRECT target is a valid rating attribute key", () => {
    const validKeys: readonly string[] = RATING_ATTRIBUTE_KEYS;
    for (const code of ALL_OBSERVATION_CODES) {
      const mapping = OBSERVATION_ATTRIBUTE_MAPPINGS[code];
      for (const attr of mapping.directTargets) {
        expect(
          validKeys.includes(attr as string),
          `Direct target ${attr} for ${code} is not a valid rating attribute key`,
        ).toBe(true);
      }
      for (const attr of mapping.supportingTargets) {
        expect(
          validKeys.includes(attr as string),
          `Supporting target ${attr} for ${code} is not a valid rating attribute key`,
        ).toBe(true);
      }
    }
  });

  it("no attribute is both DIRECT and SUPPORTING for the same observation", () => {
    for (const code of ALL_OBSERVATION_CODES) {
      const mapping = OBSERVATION_ATTRIBUTE_MAPPINGS[code];
      const directSet = new Set(mapping.directTargets);
      for (const attr of mapping.supportingTargets) {
        expect(
          directSet.has(attr),
          `${attr} is both DIRECT and SUPPORTING for ${code}`,
        ).toBe(false);
      }
    }
  });
});

describe("Evidence accumulator", () => {
  it("creates an empty accumulator", () => {
    const acc = createAccumulator("player1", "ballControl", false);
    expect(acc.playerId).toBe("player1");
    expect(acc.attributeKey).toBe("ballControl");
    expect(acc.positiveDirect).toBe(0);
    expect(acc.negativeDirect).toBe(0);
    expect(acc.distinctMatchCount).toBe(0);
  });

  it("has engine and mapping version stamps", () => {
    expect(EVIDENCE_ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("accumulates positive direct evidence", () => {
    const acc = createAccumulator("player1", "ballControl", false);
    const evidence: ExtractedEvidence = {
      id: "ev1",
      sourceType: "HUMAN_OBSERVATION",
      observationCode: "SECURE_ON_BALL",
      matchId: "match1",
      matchSeconds: null,
      playerId: "player1",
      targetAttributeKey: "ballControl",
      targetGoalkeeper: false,
      evidenceClass: "DIRECT",
      polarity: "POSITIVE",
      mappingVersion: "1.0.0",
      engineVersion: "1.0.0",
      occurredAt: new Date("2026-01-01"),
      extractedAt: new Date("2026-01-02"),
      extractedById: "coach1",
      weight: 1,
      confidence: 0.7,
      rebasedAt: null,
      consumedAt: null,
    };

    const result = accumulateEvidence(acc, evidence);
    expect(result.positiveDirect).toBe(1);
    expect(result.evidenceIds).toContain("ev1");
  });

  it("skips rebased evidence", () => {
    const acc = createAccumulator("player1", "ballControl", false);
    const evidence: ExtractedEvidence = {
      id: "ev1",
      sourceType: "HUMAN_OBSERVATION",
      observationCode: "SECURE_ON_BALL",
      matchId: "match1",
      matchSeconds: null,
      playerId: "player1",
      targetAttributeKey: "ballControl",
      targetGoalkeeper: false,
      evidenceClass: "DIRECT",
      polarity: "POSITIVE",
      mappingVersion: "1.0.0",
      engineVersion: "1.0.0",
      occurredAt: new Date("2026-01-01"),
      extractedAt: new Date("2026-01-02"),
      extractedById: "coach1",
      weight: 1,
      confidence: 0.7,
      rebasedAt: new Date("2026-01-03"),
      consumedAt: null,
    };

    const result = accumulateEvidence(acc, evidence);
    expect(result.positiveDirect).toBe(0);
    expect(result.evidenceIds).toHaveLength(0);
  });

  it("skips consumed evidence", () => {
    const acc = createAccumulator("player1", "ballControl", false);
    const evidence: ExtractedEvidence = {
      id: "ev1",
      sourceType: "HUMAN_OBSERVATION",
      observationCode: "SECURE_ON_BALL",
      matchId: "match1",
      matchSeconds: null,
      playerId: "player1",
      targetAttributeKey: "ballControl",
      targetGoalkeeper: false,
      evidenceClass: "DIRECT",
      polarity: "POSITIVE",
      mappingVersion: "1.0.0",
      engineVersion: "1.0.0",
      occurredAt: new Date("2026-01-01"),
      extractedAt: new Date("2026-01-02"),
      extractedById: "coach1",
      weight: 1,
      confidence: 0.7,
      rebasedAt: null,
      consumedAt: new Date("2026-01-03"),
    };

    const result = accumulateEvidence(acc, evidence);
    expect(result.positiveDirect).toBe(0);
    expect(result.evidenceIds).toHaveLength(0);
  });
});

describe("Assessment proposal", () => {
  it("returns null for null current value", () => {
    const acc = createAccumulator("player1", "ballControl", false);
    acc.positiveDirect = 5;
    acc.distinctMatchCount = 3;
    const result = computeAssessmentProposal(acc, null, null, new Date());
    expect(result).toBeNull();
  });

  it("returns NO_CHANGE when evidence is insufficient", () => {
    const acc = createAccumulator("player1", "ballControl", false);
    acc.positiveDirect = 1;
    acc.distinctMatchCount = 1;
    const result = computeAssessmentProposal(acc, 5, null, new Date());
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("NO_CHANGE");
  });

  it("proposes INCREASE with sufficient positive direct evidence", () => {
    const acc = createAccumulator("player1", "ballControl", false);
    acc.positiveDirect = 4;
    acc.positiveSupporting = 2;
    acc.distinctMatchCount = 3;
    acc.earliestAt = new Date("2026-01-01");
    acc.latestAt = new Date("2026-03-01");
    const result = computeAssessmentProposal(acc, 5, null, new Date());
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("INCREASE");
    expect(result!.proposedValue).toBe(6);
  });

  it("proposes DECREASE with sufficient negative direct evidence", () => {
    const acc = createAccumulator("player1", "ballControl", false);
    acc.negativeDirect = 4;
    acc.negativeSupporting = 1;
    acc.distinctMatchCount = 3;
    acc.earliestAt = new Date("2026-01-01");
    acc.latestAt = new Date("2026-03-01");
    const result = computeAssessmentProposal(acc, 5, null, new Date());
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("DECREASE");
    expect(result!.proposedValue).toBe(4);
  });

  it("caps at MAX_RATING (10) — already at max returns NO_CHANGE", () => {
    const acc = createAccumulator("player1", "ballControl", false);
    acc.positiveDirect = 10;
    acc.distinctMatchCount = 5;
    acc.earliestAt = new Date("2026-01-01");
    const result = computeAssessmentProposal(acc, 10, null, new Date());
    expect(result!.proposedValue).toBe(10);
    expect(result!.direction).toBe("NO_CHANGE");
  });

  it("caps at MIN_RATING (1) — already at min returns NO_CHANGE", () => {
    const acc = createAccumulator("player1", "ballControl", false);
    acc.negativeDirect = 10;
    acc.distinctMatchCount = 5;
    acc.earliestAt = new Date("2026-01-01");
    const result = computeAssessmentProposal(acc, 1, null, new Date());
    expect(result!.proposedValue).toBe(1);
    expect(result!.direction).toBe("NO_CHANGE");
  });
});