import { describe, it, expect } from "vitest";
import {
  getCombinationScoreModifier,
  findPartnerCombinations,
  explainCombinationEvidence,
  deriveCombinationIntentMode,
  COMBINATION_SCORING_BONUS,
  MAX_COMBINATION_BONUS,
  type CombinationScoringInput,
} from "../combination-scoring";

function makeEvidence(overrides: Partial<CombinationScoringInput> & { playerIds: string[] }): CombinationScoringInput {
  return {
    family: "PARTNERSHIP",
    subtype: "HORIZONTAL",
    confidence: "EMERGING",
    totalMinutesTogether: 100,
    matchCount: 2,
    ...overrides,
  };
}

describe("getCombinationScoreModifier", () => {
  it("returns 0 when no partners are in the squad", () => {
    const modifier = getCombinationScoreModifier("p1", [], []);
    expect(modifier).toBe(0);
  });

  it("returns 0 when no evidence exists", () => {
    const modifier = getCombinationScoreModifier("p1", ["p2"], []);
    expect(modifier).toBe(0);
  });

  it("returns 0 for INSUFFICIENT confidence", () => {
    const evidence = [
      makeEvidence({
        playerIds: ["p1", "p2"],
        confidence: "INSUFFICIENT",
      }),
    ];
    const modifier = getCombinationScoreModifier("p1", ["p2"], evidence);
    expect(modifier).toBe(0);
  });

  it("returns bonus for EMERGING confidence with partner in squad", () => {
    const evidence = [
      makeEvidence({
        playerIds: ["p1", "p2"],
        confidence: "EMERGING",
      }),
    ];
    const modifier = getCombinationScoreModifier("p1", ["p2"], evidence);
    expect(modifier).toBe(COMBINATION_SCORING_BONUS.EMERGING);
  });

  it("returns bonus for ESTABLISHED confidence with partner in squad", () => {
    const evidence = [
      makeEvidence({
        playerIds: ["p1", "p2"],
        confidence: "ESTABLISHED",
      }),
    ];
    const modifier = getCombinationScoreModifier("p1", ["p2"], evidence);
    expect(modifier).toBe(COMBINATION_SCORING_BONUS.ESTABLISHED);
  });

  it("does not count partner not in squad", () => {
    const evidence = [
      makeEvidence({
        playerIds: ["p1", "p2"],
        confidence: "ESTABLISHED",
      }),
    ];
    const modifier = getCombinationScoreModifier("p1", ["p3"], evidence);
    expect(modifier).toBe(0);
  });

  it("accumulates bonuses from multiple established partnerships", () => {
    const evidence = [
      makeEvidence({
        playerIds: ["p1", "p2"],
        confidence: "EMERGING",
      }),
      makeEvidence({
        playerIds: ["p1", "p3"],
        confidence: "EMERGING",
      }),
    ];
    const modifier = getCombinationScoreModifier("p1", ["p2", "p3"], evidence);
    expect(modifier).toBe(COMBINATION_SCORING_BONUS.EMERGING * 2);
  });

  it("caps at MAX_COMBINATION_BONUS", () => {
    const evidence = [
      makeEvidence({ playerIds: ["p1", "p2"], confidence: "ESTABLISHED" }),
      makeEvidence({ playerIds: ["p1", "p3"], confidence: "ESTABLISHED" }),
      makeEvidence({ playerIds: ["p1", "p4"], confidence: "ESTABLISHED" }),
    ];
    const modifier = getCombinationScoreModifier("p1", ["p2", "p3", "p4"], evidence);
    expect(modifier).toBe(MAX_COMBINATION_BONUS);
  });

  it("ignores non-partnership evidence", () => {
    const evidence = [
      makeEvidence({
        playerIds: ["p1", "p2", "p3"],
        family: "TRIANGLE",
        confidence: "ESTABLISHED",
      }),
    ];
    const modifier = getCombinationScoreModifier("p1", ["p2", "p3"], evidence);
    expect(modifier).toBe(0);
  });
});

describe("getCombinationScoreModifier — intent-dependent behaviour", () => {
  it("amplifies established evidence under COMPETITIVE intent", () => {
    const evidence = [makeEvidence({ playerIds: ["p1", "p2"], confidence: "ESTABLISHED" })];
    const modifier = getCombinationScoreModifier("p1", ["p2"], evidence, "COMPETITIVE");
    expect(modifier).toBe(Math.round(COMBINATION_SCORING_BONUS.ESTABLISHED * 1.5));
    expect(modifier).toBeGreaterThan(COMBINATION_SCORING_BONUS.ESTABLISHED);
  });

  it("suppresses the bonus entirely under DEVELOPMENT intent so unknown pairs are not penalised relative to known ones", () => {
    const evidence = [makeEvidence({ playerIds: ["p1", "p2"], confidence: "ESTABLISHED" })];
    const modifier = getCombinationScoreModifier("p1", ["p2"], evidence, "DEVELOPMENT");
    expect(modifier).toBe(0);
  });

  it("uses the unmodified bonus under BALANCED intent (default)", () => {
    const evidence = [makeEvidence({ playerIds: ["p1", "p2"], confidence: "EMERGING" })];
    const modifier = getCombinationScoreModifier("p1", ["p2"], evidence, "BALANCED");
    expect(modifier).toBe(COMBINATION_SCORING_BONUS.EMERGING);
  });

  it("never turns an unknown combination into a penalty under any intent", () => {
    for (const intent of ["COMPETITIVE", "BALANCED", "DEVELOPMENT"] as const) {
      expect(getCombinationScoreModifier("p1", ["p2"], [], intent)).toBe(0);
    }
  });
});

describe("deriveCombinationIntentMode", () => {
  it("maps CHALLENGE_EXPOSURE and STABILIZE_WEAKER_TEAM to COMPETITIVE", () => {
    expect(deriveCombinationIntentMode("CHALLENGE_EXPOSURE")).toBe("COMPETITIVE");
    expect(deriveCombinationIntentMode("STABILIZE_WEAKER_TEAM")).toBe("COMPETITIVE");
  });

  it("maps CONFIDENCE_REBUILD and RESET_AFTER_ERROR to DEVELOPMENT", () => {
    expect(deriveCombinationIntentMode("CONFIDENCE_REBUILD")).toBe("DEVELOPMENT");
    expect(deriveCombinationIntentMode("RESET_AFTER_ERROR")).toBe("DEVELOPMENT");
  });

  it("defaults every other category, and no intent at all, to BALANCED", () => {
    expect(deriveCombinationIntentMode("TEAM_FIRST")).toBe("BALANCED");
    expect(deriveCombinationIntentMode(null)).toBe("BALANCED");
    expect(deriveCombinationIntentMode(undefined)).toBe("BALANCED");
  });
});

describe("explainCombinationEvidence", () => {
  it("produces a factual sentence with minutes and match count, no score", () => {
    const evidence = [
      makeEvidence({ playerIds: ["p1", "p2"], subtype: "HORIZONTAL", confidence: "ESTABLISHED", totalMinutesTogether: 104, matchCount: 5 }),
    ];
    const lines = explainCombinationEvidence("p1", ["p2"], evidence);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("104 min across 5 matches");
    expect(lines[0]).toContain("Established");
    expect(lines[0]).not.toMatch(/\d+\/10|synergy|score/i);
  });

  it("omits INSUFFICIENT evidence from explanations", () => {
    const evidence = [makeEvidence({ playerIds: ["p1", "p2"], confidence: "INSUFFICIENT" })];
    expect(explainCombinationEvidence("p1", ["p2"], evidence)).toHaveLength(0);
  });

  it("omits evidence for a partner not in the squad", () => {
    const evidence = [makeEvidence({ playerIds: ["p1", "p2"], confidence: "ESTABLISHED" })];
    expect(explainCombinationEvidence("p1", ["p3"], evidence)).toHaveLength(0);
  });
});

describe("findPartnerCombinations", () => {
  it("finds all partnerships involving a player", () => {
    const evidence = [
      makeEvidence({ playerIds: ["p1", "p2"], confidence: "EMERGING" }),
      makeEvidence({ playerIds: ["p2", "p3"], confidence: "ESTABLISHED" }),
    ];
    const result = findPartnerCombinations("p1", evidence);
    expect(result).toHaveLength(1);
    expect(result[0]!.playerIds).toEqual(["p1", "p2"]);
  });

  it("returns empty when player has no partnerships", () => {
    const evidence = [
      makeEvidence({ playerIds: ["p2", "p3"], confidence: "EMERGING" }),
    ];
    const result = findPartnerCombinations("p1", evidence);
    expect(result).toHaveLength(0);
  });
});