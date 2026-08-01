import { describe, it, expect } from "vitest";
import {
  calculateEncounterEstimate,
  calculateEncounterEstimate5,
  calculateEncounterEstimateDetailed,
  computeFieldedRating,
  shouldAutoExcludeEncounter,
  ADJUSTMENT_CAP_5,
  ADJUSTMENT_CAP_10,
  ESTIMATE_MIN_5,
  ESTIMATE_MAX_5,
  ESTIMATE_MIN_10,
  ESTIMATE_MAX_10,
  FORMULA_VERSION,
} from "../sporting-level-calculation";
import {
  recencyWeight,
  classifyConfidence,
  aggregateSportingLevel,
} from "../sporting-level-aggregation";
import type { OpponentSportingEvidence } from "@/generated/prisma/client";

import { Prisma } from "@/generated/prisma/client";

function makeEvidence(overrides: Record<string, unknown> = {}): OpponentSportingEvidence {
  return {
    id: "e1",
    organisationId: "org1",
    matchId: "m1",
    opponentTeamId: "opp1",
    occurredAt: new Date("2026-06-01"),
    gameFormat: "SEVEN_A_SIDE",
    goalsFor: 3,
    goalsAgainst: 2,
    fieldedRatingSnapshot: new Prisma.Decimal("7.00"),
    participantCount: 7,
    ratedParticipantCount: 7,
    weightingMethod: "PARTICIPANT_AVERAGE",
    estimate: new Prisma.Decimal("7.40"),
    formulaVersion: FORMULA_VERSION,
    excludedAt: null,
    exclusionReason: null,
    fieldedRatingDetails: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    ...overrides,
  } as OpponentSportingEvidence;
}

describe("Opponent Sporting Level Formula", () => {
  describe("calculateEncounterEstimate5 (old scale)", () => {
    it("draw estimates opponent near the fielded team", () => {
      const result = calculateEncounterEstimate5(3.0, 2, 2);
      expect(result).toBeCloseTo(3.0, 1);
    });

    it("large win lowers inferred opponent level", () => {
      const result = calculateEncounterEstimate5(3.0, 8, 0);
      expect(result).toBeLessThan(3.0);
    });

    it("large loss raises inferred opponent level", () => {
      const result = calculateEncounterEstimate5(3.0, 0, 8);
      expect(result).toBeGreaterThan(3.0);
    });

    it("adjustment is capped on the upside", () => {
      const result = calculateEncounterEstimate5(3.0, 0, 50);
      const uncapped = 3.0 + ADJUSTMENT_CAP_5;
      expect(result).toBeLessThanOrEqual(3.0 + ADJUSTMENT_CAP_5 + 0.01);
    });

    it("adjustment is capped on the downside", () => {
      const result = calculateEncounterEstimate5(3.0, 50, 0);
      expect(result).toBeGreaterThanOrEqual(3.0 - ADJUSTMENT_CAP_5 - 0.01);
    });

    it("estimate is clamped to minimum", () => {
      const result = calculateEncounterEstimate5(1.5, 10, 0);
      expect(result).toBeGreaterThanOrEqual(ESTIMATE_MIN_5);
    });

    it("estimate is clamped to maximum", () => {
      const result = calculateEncounterEstimate5(4.5, 0, 10);
      expect(result).toBeLessThanOrEqual(ESTIMATE_MAX_5);
    });

    it("is deterministic", () => {
      const a = calculateEncounterEstimate5(3.0, 2, 1);
      const b = calculateEncounterEstimate5(3.0, 2, 1);
      expect(a).toBe(b);
    });

    it("same score different fielded strength produces different estimates", () => {
      const low = calculateEncounterEstimate5(2.0, 3, 2);
      const high = calculateEncounterEstimate5(4.0, 3, 2);
      expect(high).toBeGreaterThan(low);
    });
  });

  describe("calculateEncounterEstimate (1-10 scale)", () => {
    it("draw estimates opponent near the fielded team", () => {
      const result = calculateEncounterEstimate(6.0, 2, 2);
      expect(result).toBeCloseTo(6.0, 0);
    });

    it("large win lowers inferred opponent level", () => {
      const result = calculateEncounterEstimate(6.0, 8, 0);
      expect(result).toBeLessThan(6.0);
    });

    it("large loss raises inferred opponent level", () => {
      const result = calculateEncounterEstimate(6.0, 0, 8);
      expect(result).toBeGreaterThan(6.0);
    });

    it("adjustment is capped on 10 scale", () => {
      const result = calculateEncounterEstimate(6.0, 0, 50);
      expect(result).toBeLessThanOrEqual(6.0 + ADJUSTMENT_CAP_10 + 0.01);
    });

    it("estimate is clamped to minimum 2.0", () => {
      const result = calculateEncounterEstimate(3.0, 10, 0);
      expect(result).toBeGreaterThanOrEqual(ESTIMATE_MIN_10);
    });

    it("estimate is clamped to maximum 10.0", () => {
      const result = calculateEncounterEstimate(9.0, 0, 10);
      expect(result).toBeLessThanOrEqual(ESTIMATE_MAX_10);
    });

    it("formula version is defined", () => {
      expect(FORMULA_VERSION).toBe("v1");
    });

    it("detailed result includes snapshot", () => {
      const result = calculateEncounterEstimateDetailed(6.0, 3, 2);
      expect(result.fieldedRatingSnapshot).toBe(6.0);
      expect(result.goalsFor).toBe(3);
      expect(result.goalsAgainst).toBe(2);
      expect(result.formulaVersion).toBe(FORMULA_VERSION);
      expect(result.estimate).toBeGreaterThan(0);
    });
  });

  describe("computeFieldedRating", () => {
    it("returns null when no players have valid ratings", () => {
      const result = computeFieldedRating([
        { rating: null },
        { rating: null },
      ]);
      expect(result.rating).toBeNull();
      expect(result.ratedParticipantCount).toBe(0);
      expect(result.method).toBe("PARTICIPANT_AVERAGE");
    });

    it("uses minute weighting when most players have minutes", () => {
      const result = computeFieldedRating([
        { rating: 6, minutes: 60 },
        { rating: 8, minutes: 30 },
      ]);
      expect(result.method).toBe("MINUTE_WEIGHTED");
      expect(result.rating).toBeCloseTo(6.67, 1);
      expect(result.participantCount).toBe(2);
      expect(result.ratedParticipantCount).toBe(2);
    });

    it("falls back to participant average when minutes are sparse", () => {
      const result = computeFieldedRating([
        { rating: 6 },
        { rating: 8 },
        { rating: null },
      ]);
      expect(result.method).toBe("PARTICIPANT_AVERAGE");
      expect(result.rating).toBeCloseTo(7.0, 1);
      expect(result.ratedParticipantCount).toBe(2);
    });

    it("planned non-participant with null rating is excluded", () => {
      const result = computeFieldedRating([
        { rating: 6 },
        { rating: null },
      ]);
      expect(result.rating).toBeCloseTo(6.0, 1);
      expect(result.ratedParticipantCount).toBe(1);
    });

    it("excludes ratings outside 1-10 range", () => {
      const result = computeFieldedRating([
        { rating: 6 },
        { rating: 11 },
        { rating: 0 },
      ]);
      expect(result.ratedParticipantCount).toBe(1);
      expect(result.rating).toBeCloseTo(6.0, 1);
    });
  });

  describe("shouldAutoExcludeEncounter", () => {
    it("auto-excludes CHAOTIC match fit", () => {
      expect(shouldAutoExcludeEncounter("CHAOTIC")).toBe(true);
    });

    it("auto-excludes SUPPORT_OVERPOWERED match fit", () => {
      expect(shouldAutoExcludeEncounter("SUPPORT_OVERPOWERED")).toBe(true);
    });

    it("auto-excludes SUPPORT_TOO_LOW match fit", () => {
      expect(shouldAutoExcludeEncounter("SUPPORT_TOO_LOW")).toBe(true);
    });

    it("does not auto-exclude GOOD_FIT", () => {
      expect(shouldAutoExcludeEncounter("GOOD_FIT")).toBe(false);
    });

    it("does not auto-exclude UNKNOWN", () => {
      expect(shouldAutoExcludeEncounter("UNKNOWN")).toBe(false);
    });

    it("does not auto-exclude null", () => {
      expect(shouldAutoExcludeEncounter(null)).toBe(false);
    });
  });
});

describe("Opponent Sporting Level Aggregation", () => {
  describe("classifyConfidence", () => {
    it("returns unknown for 0 encounters", () => {
      expect(classifyConfidence(0)).toBe("unknown");
    });

    it("returns low for 1 encounter", () => {
      expect(classifyConfidence(1)).toBe("low");
    });

    it("returns medium for 2-3 encounters", () => {
      expect(classifyConfidence(2)).toBe("medium");
      expect(classifyConfidence(3)).toBe("medium");
    });

    it("returns high for 4+ encounters", () => {
      expect(classifyConfidence(4)).toBe("high");
      expect(classifyConfidence(6)).toBe("high");
    });
  });

  describe("recencyWeight", () => {
    it("gives weight 1 to current data", () => {
      expect(recencyWeight(0)).toBeCloseTo(1.0, 2);
    });

    it("gives weight ~0.5 at 6 months (half-life)", () => {
      expect(recencyWeight(6)).toBeCloseTo(0.5, 2);
    });

    it("gives lower weight to older data", () => {
      expect(recencyWeight(12)).toBeLessThan(recencyWeight(6));
    });
  });

  describe("aggregateSportingLevel", () => {
    it("returns null for empty evidence", () => {
      const result = aggregateSportingLevel([]);
      expect(result).toBeNull();
    });

    it("returns aggregate for valid evidence", () => {
      const evidence = [
        makeEvidence({ estimate: new Prisma.Decimal("6.0"), occurredAt: new Date("2026-04-01"), excludedAt: null }),
        makeEvidence({ estimate: new Prisma.Decimal("7.0"), occurredAt: new Date("2026-05-01"), excludedAt: null }),
        makeEvidence({ estimate: new Prisma.Decimal("8.0"), occurredAt: new Date("2026-06-01"), excludedAt: null }),
      ];
      const result = aggregateSportingLevel(evidence);
      expect(result).not.toBeNull();
      expect(result!.confidence).toBe("medium");
      expect(result!.validEncounterCount).toBe(3);
      expect(result!.estimatedLevel).toBeGreaterThan(0);
    });

    it("excludes excluded evidence", () => {
      const evidence = [
        makeEvidence({ estimate: new Prisma.Decimal("6.0"), occurredAt: new Date("2026-04-01"), excludedAt: null }),
        makeEvidence({ estimate: new Prisma.Decimal("9.0"), occurredAt: new Date("2026-05-01"), excludedAt: new Date("2026-06-01") }),
      ];
      const result = aggregateSportingLevel(evidence);
      expect(result!.validEncounterCount).toBe(1);
      expect(result!.confidence).toBe("low");
    });

    it("excludes evidence older than 12 months", () => {
      const evidence = [
        makeEvidence({ estimate: new Prisma.Decimal("6.0"), occurredAt: new Date("2024-01-01"), excludedAt: null }),
      ];
      const result = aggregateSportingLevel(evidence, new Date("2026-06-01"));
      expect(result).toBeNull();
    });

    it("same-format evidence gets higher weight", () => {
      const same = makeEvidence({ estimate: new Prisma.Decimal("8.0"), occurredAt: new Date("2026-05-01"), gameFormat: "SEVEN_A_SIDE", excludedAt: null });
      const diff = makeEvidence({ estimate: new Prisma.Decimal("4.0"), occurredAt: new Date("2026-05-01"), gameFormat: "ELEVEN_A_SIDE", excludedAt: null });
      const resultSame = aggregateSportingLevel([same, diff], new Date("2026-06-01"), "SEVEN_A_SIDE");
      const resultDiff = aggregateSportingLevel([same, diff], new Date("2026-06-01"), "ELEVEN_A_SIDE");
      expect(resultSame!.estimatedLevel).toBeGreaterThan(resultDiff!.estimatedLevel);
    });

    it("returns null when all evidence is excluded", () => {
      const evidence = [
        makeEvidence({ estimate: new Prisma.Decimal("6.0"), occurredAt: new Date("2026-04-01"), excludedAt: new Date("2026-06-01") }),
      ];
      const result = aggregateSportingLevel(evidence);
      expect(result).toBeNull();
    });
  });
});