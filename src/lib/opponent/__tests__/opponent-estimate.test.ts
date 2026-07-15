import { describe, it, expect } from "vitest";
import {
  calculateWeightedLevel,
  calculateConfidence,
  calculateSuggestedMinimum,
  buildOpponentEstimate,
  validateSportingLevel,
  formatSportingLevel,
  DEFAULT_CHALLENGE_MARGIN,
  type OpponentEncounterAssessment,
} from "../opponent-estimate";
import {
  calculateOpponentContextForMatch,
  opponentContextScoringAdjustment,
  OPPONENT_CONTEXT_HARD_BOUNDARIES,
} from "../opponent-context";

const makeAssessment = (overrides: Partial<OpponentEncounterAssessment> = {}): OpponentEncounterAssessment => ({
  sportingLevel: 3.0,
  gameFormat: "SEVEN_A_SIDE",
  matchDate: new Date("2026-04-01"),
  matchId: "match-1",
  ...overrides,
});

describe("opponent estimate calculation", () => {
  describe("calculateWeightedLevel", () => {
    it("returns 0 for empty assessments", () => {
      expect(calculateWeightedLevel([], null)).toBe(0);
    });

    it("returns the single assessment level for one assessment", () => {
      const result = calculateWeightedLevel([makeAssessment({ sportingLevel: 3.4 })], null);
      expect(result).toBeGreaterThan(0);
    });

    it("weights recent assessments more heavily", () => {
      const recent = makeAssessment({ sportingLevel: 4.0, matchDate: new Date("2026-06-01") });
      const older = makeAssessment({ sportingLevel: 2.0, matchDate: new Date("2026-01-01") });
      const result = calculateWeightedLevel([older, recent], null);
      expect(result).toBeGreaterThan(3.0);
    });

    it("caps at MAX_RECENT_ENCOUNTERS assessments", () => {
      const assessments = Array.from({ length: 8 }, () =>
        makeAssessment({ sportingLevel: 2.0, matchDate: new Date("2026-01-01") }),
      );
      assessments[0] = makeAssessment({ sportingLevel: 5.0, matchDate: new Date("2026-07-01") });
      const result = calculateWeightedLevel(assessments, null);
      expect(result).toBeGreaterThan(2.0);
    });

    it("gives higher weight to same-format encounters", () => {
      const same = makeAssessment({ sportingLevel: 4.0, gameFormat: "SEVEN_A_SIDE", matchDate: new Date("2026-06-01") });
      const diff = makeAssessment({ sportingLevel: 2.0, gameFormat: "ELEVEN_A_SIDE", matchDate: new Date("2026-05-01") });
      const resultSame = calculateWeightedLevel([same, diff], "SEVEN_A_SIDE");
      const resultDiff = calculateWeightedLevel([same, diff], "ELEVEN_A_SIDE");
      expect(resultSame).toBeGreaterThan(resultDiff);
    });

    it("handles null game format gracefully", () => {
      const noFormat = makeAssessment({ sportingLevel: 3.0, gameFormat: null });
      const result = calculateWeightedLevel([noFormat], null);
      expect(result).toBe(3.0);
    });

    it("is resistant to one unusual result with multiple assessments", () => {
      const normal = Array.from({ length: 4 }, () =>
        makeAssessment({ sportingLevel: 3.0, matchDate: new Date("2026-04-01") }),
      );
      const outlier = makeAssessment({ sportingLevel: 1.0, matchDate: new Date("2026-05-01") });
      const result = calculateWeightedLevel([...normal, outlier], null);
      expect(result).toBeGreaterThan(2.0);
      expect(result).toBeLessThan(4.0);
    });
  });

  describe("calculateConfidence", () => {
    it("returns low for 1 assessment", () => {
      expect(calculateConfidence(1)).toBe("low");
    });

    it("returns medium for 2-3 assessments", () => {
      expect(calculateConfidence(2)).toBe("medium");
      expect(calculateConfidence(3)).toBe("medium");
    });

    it("returns high for 4+ assessments", () => {
      expect(calculateConfidence(4)).toBe("high");
      expect(calculateConfidence(10)).toBe("high");
    });

    it("returns low for 0 assessments", () => {
      expect(calculateConfidence(0)).toBe("low");
    });
  });

  describe("calculateSuggestedMinimum", () => {
    it("adds default challenge margin of +0.2", () => {
      expect(calculateSuggestedMinimum(3.4)).toBe(3.6);
    });

    it("caps at MAX_SPORTING_LEVEL (5.0)", () => {
      expect(calculateSuggestedMinimum(4.9)).toBe(5.0);
    });

    it("caps at MAX_SPORTING_LEVEL for exactly 5.0", () => {
      expect(calculateSuggestedMinimum(5.0)).toBe(5.0);
    });

    it("uses custom challenge margin", () => {
      expect(calculateSuggestedMinimum(3.4, 0.5)).toBe(3.9);
    });

    it("handles low opponent levels", () => {
      expect(calculateSuggestedMinimum(1.5)).toBe(1.7);
    });

    it("rounds to one decimal place", () => {
      const result = calculateSuggestedMinimum(3.35);
      expect(result).toBe(Number(result.toFixed(1)));
    });
  });

  describe("validateSportingLevel", () => {
    it("returns null for null input", () => {
      expect(validateSportingLevel(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(validateSportingLevel(undefined)).toBeNull();
    });

    it("returns null for values below 1.0", () => {
      expect(validateSportingLevel(0)).toBeNull();
      expect(validateSportingLevel(0.5)).toBeNull();
      expect(validateSportingLevel(-1)).toBeNull();
    });

    it("returns null for values above 5.0", () => {
      expect(validateSportingLevel(5.1)).toBeNull();
      expect(validateSportingLevel(6)).toBeNull();
    });

    it("accepts valid values between 1.0 and 5.0", () => {
      expect(validateSportingLevel(1.0)).toBe(1.0);
      expect(validateSportingLevel(3.4)).toBe(3.4);
      expect(validateSportingLevel(5.0)).toBe(5.0);
    });

    it("rounds to one decimal place", () => {
      expect(validateSportingLevel(3.45)).toBe(3.5);
      expect(validateSportingLevel(2.12)).toBe(2.1);
    });

    it("returns null for NaN", () => {
      expect(validateSportingLevel(NaN)).toBeNull();
    });
  });

  describe("formatSportingLevel", () => {
    it("formats a valid level", () => {
      expect(formatSportingLevel(3.4)).toBe("3.4 / 5.0");
    });

    it("formats null as Not assessed", () => {
      expect(formatSportingLevel(null)).toBe("Not assessed");
    });
  });

  describe("buildOpponentEstimate", () => {
    it("returns zero estimate for no assessments", () => {
      const result = buildOpponentEstimate("team-1", [], null);
      expect(result.estimatedLevel).toBe(0);
      expect(result.confidence).toBe("low");
      expect(result.assessmentCount).toBe(0);
      expect(result.lastAssessedDate).toBeNull();
    });

    it("returns correct estimate for multiple assessments", () => {
      const assessments = [
        makeAssessment({ sportingLevel: 3.0, matchDate: new Date("2026-04-01") }),
        makeAssessment({ sportingLevel: 3.5, matchDate: new Date("2026-05-01") }),
        makeAssessment({ sportingLevel: 4.0, matchDate: new Date("2026-06-01") }),
      ];
      const result = buildOpponentEstimate("team-1", assessments, null);
      expect(result.estimatedLevel).toBeGreaterThan(0);
      expect(result.confidence).toBe("medium");
      expect(result.assessmentCount).toBe(3);
      expect(result.lastAssessedDate).toEqual(new Date("2026-06-01"));
    });

    it("includes historical context", () => {
      const assessments = [
        makeAssessment({ sportingLevel: 3.0, matchDate: new Date("2026-04-01") }),
        makeAssessment({ sportingLevel: 3.5, matchDate: new Date("2026-05-01") }),
      ];
      const result = buildOpponentEstimate("team-1", assessments, null);
      expect(result.historicalContext).toContain("2 comparable encounter");
    });
  });

  describe("stale history", () => {
    it("produces low-confidence estimate from a single old assessment", () => {
      const old = [makeAssessment({ sportingLevel: 3.0, matchDate: new Date("2025-01-01") })];
      const result = buildOpponentEstimate("team-1", old, null);
      expect(result.confidence).toBe("low");
    });
  });

  describe("no history", () => {
    it("returns zero estimate with no-assessed context", () => {
      const result = buildOpponentEstimate("team-1", [], null);
      expect(result.estimatedLevel).toBe(0);
      expect(result.historicalContext).toContain("No previous encounters");
    });
  });
});

describe("opponent context selection integration", () => {
  describe("calculateOpponentContextForMatch", () => {
    it("returns null when no estimate and no difficult environment", () => {
      expect(calculateOpponentContextForMatch(null, false, "Opponent FC")).toBeNull();
    });

    it("returns advisory when no estimate but difficult environment", () => {
      const result = calculateOpponentContextForMatch(null, true, "Opponent FC");
      expect(result).not.toBeNull();
      expect(result!.influence).toBe("difficult_environment_advisory");
      expect(result!.explanation).toContain("match-environment");
    });

    it("returns development opportunity for lower-level opponent", () => {
      const estimate = {
        opponentTeamId: "team-1",
        estimatedLevel: 2.0,
        confidence: "medium" as const,
        assessmentCount: 3,
        lastAssessedDate: new Date("2026-06-01"),
        historicalContext: "Test context",
      };
      const result = calculateOpponentContextForMatch(estimate, false, "Low Level FC");
      expect(result!.influence).toBe("lower_opponent_development_opportunity");
      expect(result!.suggestedMinimumLevel).toBe(2.2);
      expect(result!.isHardBlock).toBe(false);
      expect(result!.isScoringPreference).toBe(true);
    });

    it("returns stability preference for higher-level opponent", () => {
      const estimate = {
        opponentTeamId: "team-1",
        estimatedLevel: 4.2,
        confidence: "high" as const,
        assessmentCount: 5,
        lastAssessedDate: new Date("2026-06-01"),
        historicalContext: "Test context",
      };
      const result = calculateOpponentContextForMatch(estimate, false, "Strong FC");
      expect(result!.influence).toBe("higher_opponent_stability_preference");
      expect(result!.suggestedMinimumLevel).toBe(4.4);
    });

    it("returns opponent level target for mid-level opponent", () => {
      const estimate = {
        opponentTeamId: "team-1",
        estimatedLevel: 3.0,
        confidence: "medium" as const,
        assessmentCount: 2,
        lastAssessedDate: new Date("2026-06-01"),
        historicalContext: "Test context",
      };
      const result = calculateOpponentContextForMatch(estimate, false, "Mid FC");
      expect(result!.influence).toBe("opponent_level_target");
      expect(result!.suggestedMinimumLevel).toBe(3.2);
    });

    it("caps suggested minimum at MAX_SPORTING_LEVEL", () => {
      const estimate = {
        opponentTeamId: "team-1",
        estimatedLevel: 4.9,
        confidence: "high" as const,
        assessmentCount: 5,
        lastAssessedDate: new Date("2026-06-01"),
        historicalContext: "Test context",
      };
      const result = calculateOpponentContextForMatch(estimate, false, "Top FC");
      expect(result!.suggestedMinimumLevel).toBe(5.0);
    });

    it("never returns isHardBlock true", () => {
      const estimate = {
        opponentTeamId: "team-1",
        estimatedLevel: 5.0,
        confidence: "high" as const,
        assessmentCount: 10,
        lastAssessedDate: new Date("2026-06-01"),
        historicalContext: "Test",
      };
      const result = calculateOpponentContextForMatch(estimate, true, "Intense FC");
      expect(result!.isHardBlock).toBe(false);
    });
  });

  describe("opponent context never bypasses core eligibility", () => {
    it("documents all hard boundaries", () => {
      expect(OPPONENT_CONTEXT_HARD_BOUNDARIES.length).toBeGreaterThanOrEqual(5);
      expect(OPPONENT_CONTEXT_HARD_BOUNDARIES).toContain(
        "Opponent level must not make an ineligible player eligible",
      );
      expect(OPPONENT_CONTEXT_HARD_BOUNDARIES).toContain(
        "Opponent level must not exclude an otherwise eligible player",
      );
      expect(OPPONENT_CONTEXT_HARD_BOUNDARIES).toContain(
        "Opponent level must not override squad minimums or core invariants",
      );
    });
  });

  describe("+0.2 target calculation", () => {
    it("applies default challenge margin", () => {
      expect(calculateSuggestedMinimum(3.4)).toBe(3.6);
    });

    it("3.4 opponent produces suggested minimum 3.6", () => {
      expect(calculateSuggestedMinimum(3.4, DEFAULT_CHALLENGE_MARGIN)).toBe(3.6);
    });
  });

  describe("target cap", () => {
    it("caps at 5.0", () => {
      expect(calculateSuggestedMinimum(4.9)).toBe(5.0);
      expect(calculateSuggestedMinimum(5.0)).toBe(5.0);
    });
  });

  describe("scoring adjustment", () => {
    it("gives positive adjustment for higher opponent and established player", () => {
      const estimate = {
        opponentTeamId: "team-1",
        estimatedLevel: 4.0,
        confidence: "high" as const,
        assessmentCount: 5,
        lastAssessedDate: new Date("2026-06-01"),
        historicalContext: "",
      };
      const adj = opponentContextScoringAdjustment(estimate, 3.0, false);
      expect(adj).toBeGreaterThan(0);
    });

    it("gives positive adjustment for lower opponent and development candidate", () => {
      const estimate = {
        opponentTeamId: "team-1",
        estimatedLevel: 2.0,
        confidence: "medium" as const,
        assessmentCount: 3,
        lastAssessedDate: new Date("2026-06-01"),
        historicalContext: "",
      };
      const adj = opponentContextScoringAdjustment(estimate, 2.0, true);
      expect(adj).toBe(2);
    });

    it("returns 0 for no estimate", () => {
      expect(opponentContextScoringAdjustment(null, 3.0, false)).toBe(0);
    });

    it("returns 0 for mid-level opponent with no special conditions", () => {
      const estimate = {
        opponentTeamId: "team-1",
        estimatedLevel: 3.0,
        confidence: "medium" as const,
        assessmentCount: 2,
        lastAssessedDate: new Date("2026-06-01"),
        historicalContext: "",
      };
      expect(opponentContextScoringAdjustment(estimate, 3.0, false)).toBe(0);
    });
  });

  describe("Fair Play observation separation", () => {
    it("difficult environment advisory is separate from level estimate", () => {
      const estimate = {
        opponentTeamId: "team-1",
        estimatedLevel: 3.0,
        confidence: "medium" as const,
        assessmentCount: 2,
        lastAssessedDate: new Date("2026-06-01"),
        historicalContext: "",
      };
      const result = calculateOpponentContextForMatch(estimate, true, "Rough FC");
      expect(result!.influence).toBe("difficult_environment_advisory");
      expect(result!.explanation).toContain("difficult environment");
    });
  });

  describe("parent-export privacy", () => {
    it("opponent estimate does not include internal scoring details in public API", () => {
      const assessments = [
        makeAssessment({ sportingLevel: 3.0, matchDate: new Date("2026-04-01") }),
      ];
      const result = buildOpponentEstimate("team-1", assessments, null);
      expect(result).toHaveProperty("estimatedLevel");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("assessmentCount");
      expect(result).toHaveProperty("lastAssessedDate");
      expect(result).toHaveProperty("historicalContext");
    });
  });
});