import { describe, it, expect } from "vitest";
import {
  calculateWeightedLevel,
  calculateConfidence,
  calculateSuggestedMinimum,
  buildOpponentEstimate,
  validateSportingLevel,
  formatSportingLevel,
  DEFAULT_CHALLENGE_MARGIN,
  MAX_SPORTING_LEVEL,
  type OpponentEncounterAssessment,
} from "../opponent-estimate";
import {
  calculateOpponentContextForMatch,
  opponentContextScoringAdjustment,
  OPPONENT_CONTEXT_HARD_BOUNDARIES,
} from "../opponent-context";

const makeAssessment = (overrides: Partial<OpponentEncounterAssessment> = {}): OpponentEncounterAssessment => ({
  sportingLevel: 6.0,
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
      const result = calculateWeightedLevel([makeAssessment({ sportingLevel: 6.8 })], null);
      expect(result).toBeGreaterThan(0);
    });

    it("weights recent assessments more heavily", () => {
      const recent = makeAssessment({ sportingLevel: 8.0, matchDate: new Date("2026-06-01") });
      const older = makeAssessment({ sportingLevel: 4.0, matchDate: new Date("2026-01-01") });
      const result = calculateWeightedLevel([older, recent], null);
      expect(result).toBeGreaterThan(6.0);
    });

    it("caps at MAX_RECENT_ENCOUNTERS assessments", () => {
      const assessments = Array.from({ length: 8 }, () =>
        makeAssessment({ sportingLevel: 4.0, matchDate: new Date("2026-01-01") }),
      );
      assessments[0] = makeAssessment({ sportingLevel: 10.0, matchDate: new Date("2026-07-01") });
      const result = calculateWeightedLevel(assessments, null);
      expect(result).toBeGreaterThan(4.0);
    });

    it("gives higher weight to same-format encounters", () => {
      const same = makeAssessment({ sportingLevel: 8.0, gameFormat: "SEVEN_A_SIDE", matchDate: new Date("2026-06-01") });
      const diff = makeAssessment({ sportingLevel: 4.0, gameFormat: "ELEVEN_A_SIDE", matchDate: new Date("2026-05-01") });
      const resultSame = calculateWeightedLevel([same, diff], "SEVEN_A_SIDE");
      const resultDiff = calculateWeightedLevel([same, diff], "ELEVEN_A_SIDE");
      expect(resultSame).toBeGreaterThan(resultDiff);
    });

    it("handles null game format gracefully", () => {
      const noFormat = makeAssessment({ sportingLevel: 6.0, gameFormat: null });
      const result = calculateWeightedLevel([noFormat], null);
      expect(result).toBe(6.0);
    });

    it("is resistant to one unusual result with multiple assessments", () => {
      const normal = Array.from({ length: 4 }, () =>
        makeAssessment({ sportingLevel: 6.0, matchDate: new Date("2026-04-01") }),
      );
      const outlier = makeAssessment({ sportingLevel: 2.0, matchDate: new Date("2026-05-01") });
      const result = calculateWeightedLevel([...normal, outlier], null);
      expect(result).toBeGreaterThan(4.0);
      expect(result).toBeLessThan(8.0);
    });
  });

  describe("calculateConfidence", () => {
    it("returns unknown for 0 assessments", () => {
      expect(calculateConfidence(0)).toBe("unknown");
    });

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
  });

  describe("calculateSuggestedMinimum", () => {
    it("adds default challenge margin of +0.4", () => {
      expect(calculateSuggestedMinimum(6.8)).toBe(7.2);
    });

    it("caps at MAX_SPORTING_LEVEL (10.0)", () => {
      expect(calculateSuggestedMinimum(9.8)).toBe(10.0);
    });

    it("caps at MAX_SPORTING_LEVEL for exactly 10.0", () => {
      expect(calculateSuggestedMinimum(10.0)).toBe(10.0);
    });

    it("uses custom challenge margin", () => {
      expect(calculateSuggestedMinimum(6.8, 0.8)).toBe(7.6);
    });

    it("handles low opponent levels", () => {
      expect(calculateSuggestedMinimum(3.0)).toBe(3.4);
    });

    it("rounds to one decimal place", () => {
      const result = calculateSuggestedMinimum(6.7);
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

    it("returns null for values above 10.0", () => {
      expect(validateSportingLevel(10.1)).toBeNull();
      expect(validateSportingLevel(12)).toBeNull();
    });

    it("accepts valid values between 1.0 and 10.0", () => {
      expect(validateSportingLevel(2.0)).toBe(2.0);
      expect(validateSportingLevel(6.8)).toBe(6.8);
      expect(validateSportingLevel(10.0)).toBe(10.0);
    });

    it("rounds to one decimal place", () => {
      expect(validateSportingLevel(6.85)).toBe(6.9);
      expect(validateSportingLevel(4.12)).toBe(4.1);
    });

    it("returns null for NaN", () => {
      expect(validateSportingLevel(NaN)).toBeNull();
    });
  });

  describe("formatSportingLevel", () => {
    it("formats a valid level", () => {
      expect(formatSportingLevel(6.8)).toBe("6.8 / 10.0");
    });

    it("formats null as Not assessed", () => {
      expect(formatSportingLevel(null)).toBe("Not assessed");
    });
  });

  describe("buildOpponentEstimate", () => {
    it("returns zero estimate with unknown confidence for no assessments", () => {
      const result = buildOpponentEstimate("team-1", [], null);
      expect(result.estimatedLevel).toBe(0);
      expect(result.confidence).toBe("unknown");
      expect(result.assessmentCount).toBe(0);
      expect(result.lastAssessedDate).toBeNull();
    });

    it("returns correct estimate for multiple assessments", () => {
      const assessments = [
        makeAssessment({ sportingLevel: 6.0, matchDate: new Date("2026-04-01") }),
        makeAssessment({ sportingLevel: 7.0, matchDate: new Date("2026-05-01") }),
        makeAssessment({ sportingLevel: 8.0, matchDate: new Date("2026-06-01") }),
      ];
      const result = buildOpponentEstimate("team-1", assessments, null);
      expect(result.estimatedLevel).toBeGreaterThan(0);
      expect(result.confidence).toBe("medium");
      expect(result.assessmentCount).toBe(3);
      expect(result.lastAssessedDate).toEqual(new Date("2026-06-01"));
    });

    it("includes historical context", () => {
      const assessments = [
        makeAssessment({ sportingLevel: 6.0, matchDate: new Date("2026-04-01") }),
        makeAssessment({ sportingLevel: 7.0, matchDate: new Date("2026-05-01") }),
      ];
      const result = buildOpponentEstimate("team-1", assessments, null);
      expect(result.historicalContext).toContain("2 comparable encounter");
    });
  });

  describe("stale history", () => {
    it("produces low-confidence estimate from a single old assessment", () => {
      const old = [makeAssessment({ sportingLevel: 6.0, matchDate: new Date("2025-01-01") })];
      const result = buildOpponentEstimate("team-1", old, null);
      expect(result.confidence).toBe("low");
    });
  });

  describe("no history", () => {
    it("returns zero estimate with unknown confidence and no-assessed context", () => {
      const result = buildOpponentEstimate("team-1", [], null);
      expect(result.estimatedLevel).toBe(0);
      expect(result.confidence).toBe("unknown");
      expect(result.historicalContext).toContain("No comparable encounter data");
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
        estimatedLevel: 4.0,
        confidence: "medium" as const,
        assessmentCount: 3,
        lastAssessedDate: new Date("2026-06-01"),
        historicalContext: "Test context",
      };
      const result = calculateOpponentContextForMatch(estimate, false, "Low Level FC");
      expect(result!.influence).toBe("lower_opponent_development_opportunity");
      expect(result!.suggestedMinimumLevel).toBe(4.4);
      expect(result!.isHardBlock).toBe(false);
      expect(result!.isScoringPreference).toBe(true);
    });

    it("returns stability preference for higher-level opponent", () => {
      const estimate = {
        opponentTeamId: "team-1",
        estimatedLevel: 8.4,
        confidence: "high" as const,
        assessmentCount: 5,
        lastAssessedDate: new Date("2026-06-01"),
        historicalContext: "Test context",
      };
      const result = calculateOpponentContextForMatch(estimate, false, "Strong FC");
      expect(result!.influence).toBe("higher_opponent_stability_preference");
      expect(result!.suggestedMinimumLevel).toBe(8.8);
    });

    it("returns opponent level target for mid-level opponent", () => {
      const estimate = {
        opponentTeamId: "team-1",
        estimatedLevel: 6.0,
        confidence: "medium" as const,
        assessmentCount: 2,
        lastAssessedDate: new Date("2026-06-01"),
        historicalContext: "Test context",
      };
      const result = calculateOpponentContextForMatch(estimate, false, "Mid FC");
      expect(result!.influence).toBe("opponent_level_target");
      expect(result!.suggestedMinimumLevel).toBe(6.4);
    });

    it("caps suggested minimum at MAX_SPORTING_LEVEL", () => {
      const estimate = {
        opponentTeamId: "team-1",
        estimatedLevel: 9.8,
        confidence: "high" as const,
        assessmentCount: 5,
        lastAssessedDate: new Date("2026-06-01"),
        historicalContext: "Test context",
      };
      const result = calculateOpponentContextForMatch(estimate, false, "Top FC");
      expect(result!.suggestedMinimumLevel).toBe(10.0);
    });

    it("never returns isHardBlock true", () => {
      const estimate = {
        opponentTeamId: "team-1",
        estimatedLevel: 10.0,
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

  describe("+0.4 target calculation", () => {
    it("applies default challenge margin", () => {
      expect(DEFAULT_CHALLENGE_MARGIN).toBe(0.4);
      expect(calculateSuggestedMinimum(6.8)).toBe(7.2);
    });

    it("6.8 opponent produces suggested minimum 7.2", () => {
      expect(calculateSuggestedMinimum(6.8, DEFAULT_CHALLENGE_MARGIN)).toBe(7.2);
    });
  });

  describe("target cap", () => {
    it("caps at 10.0", () => {
      expect(calculateSuggestedMinimum(9.8)).toBe(10.0);
      expect(calculateSuggestedMinimum(10.0)).toBe(10.0);
    });
  });

  describe("scoring adjustment", () => {
    it("gives positive adjustment for higher opponent and established player", () => {
      const estimate = {
        opponentTeamId: "team-1",
        estimatedLevel: 8.0,
        confidence: "high" as const,
        assessmentCount: 5,
        lastAssessedDate: new Date("2026-06-01"),
        historicalContext: "",
      };
      const adj = opponentContextScoringAdjustment(estimate, 6.0, false);
      expect(adj).toBeGreaterThan(0);
    });

    it("gives positive adjustment for lower opponent and development candidate", () => {
      const estimate = {
        opponentTeamId: "team-1",
        estimatedLevel: 4.0,
        confidence: "medium" as const,
        assessmentCount: 3,
        lastAssessedDate: new Date("2026-06-01"),
        historicalContext: "",
      };
      const adj = opponentContextScoringAdjustment(estimate, 4.0, true);
      expect(adj).toBe(2);
    });

    it("returns 0 for unknown confidence", () => {
      const estimate = {
        opponentTeamId: "team-1",
        estimatedLevel: 8.0,
        confidence: "unknown" as const,
        assessmentCount: 0,
        lastAssessedDate: null,
        historicalContext: "",
      };
      expect(opponentContextScoringAdjustment(estimate, 6.0, false)).toBe(0);
    });

    it("returns 0 for low confidence", () => {
      const estimate = {
        opponentTeamId: "team-1",
        estimatedLevel: 8.0,
        confidence: "low" as const,
        assessmentCount: 1,
        lastAssessedDate: new Date("2026-06-01"),
        historicalContext: "",
      };
      expect(opponentContextScoringAdjustment(estimate, 6.0, false)).toBe(0);
    });

    it("returns 0 for no estimate", () => {
      expect(opponentContextScoringAdjustment(null, 6.0, false)).toBe(0);
    });

    it("returns 0 for mid-level opponent with no special conditions", () => {
      const estimate = {
        opponentTeamId: "team-1",
        estimatedLevel: 6.0,
        confidence: "medium" as const,
        assessmentCount: 2,
        lastAssessedDate: new Date("2026-06-01"),
        historicalContext: "",
      };
      expect(opponentContextScoringAdjustment(estimate, 6.0, false)).toBe(0);
    });
  });

  describe("Fair Play observation separation", () => {
    it("difficult environment advisory is separate from level estimate", () => {
      const estimate = {
        opponentTeamId: "team-1",
        estimatedLevel: 6.0,
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
        makeAssessment({ sportingLevel: 6.0, matchDate: new Date("2026-04-01") }),
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