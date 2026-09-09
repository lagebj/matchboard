import { describe, expect, it } from "vitest";
import {
  AUTOMATIC_ELIGIBLE_TIERS,
  DECLARATION_MULTIPLIERS,
  MATRIX_TARGETS,
  clampScore,
  directedMatrixScore,
  isAutomaticTier,
  tierForScore,
} from "../matrix";
import { EXACT_ROLES } from "../roles";

describe("normative matrix data", () => {
  it("declares the twelve exact targets", () => {
    expect([...MATRIX_TARGETS].sort()).toEqual([...EXACT_ROLES].sort());
  });

  it("uses the fixed declaration multipliers", () => {
    expect(DECLARATION_MULTIPLIERS).toEqual({ primary: 1.0, secondary: 0.95, tertiary: 0.9 });
  });

  it("has a directed score for every source/target pair", () => {
    const sources = [...EXACT_ROLES, "SS", "W"] as const;
    for (const s of sources) {
      for (const t of EXACT_ROLES) {
        expect(typeof directedMatrixScore(s, t)).toBe("number");
      }
    }
  });
});

describe("directed suitability is asymmetric and must not be symmetrized (§4)", () => {
  it("ST→LW is not equal to LW→ST", () => {
    expect(directedMatrixScore("ST", "LW")).toBe(80);
    expect(directedMatrixScore("LW", "ST")).toBe(84);
    expect(directedMatrixScore("ST", "LW")).not.toBe(directedMatrixScore("LW", "ST"));
  });

  it("full-back ↔ wide-midfield is asymmetric", () => {
    expect(directedMatrixScore("LB", "LM")).not.toBe(directedMatrixScore("LM", "LB"));
  });

  it("ST→LW/RW outranks CM→LW/RW (§8)", () => {
    expect(directedMatrixScore("ST", "LW")).toBeGreaterThan(directedMatrixScore("CM", "LW"));
    expect(directedMatrixScore("ST", "RW")).toBeGreaterThan(directedMatrixScore("CM", "RW"));
  });

  it("same-side full-back → winger outranks opposite-side, and both outrank CM (§8)", () => {
    expect(directedMatrixScore("LB", "LW")).toBeGreaterThan(directedMatrixScore("RB", "LW"));
    expect(directedMatrixScore("RB", "LW")).toBeGreaterThan(directedMatrixScore("CM", "LW"));
  });
});

describe("tierForScore boundaries (§7)", () => {
  it("classifies each band inclusively at its lower bound", () => {
    expect(tierForScore(100)).toBe("NATURAL");
    expect(tierForScore(90)).toBe("NATURAL");
    expect(tierForScore(89.9)).toBe("STRONG");
    expect(tierForScore(70)).toBe("STRONG");
    expect(tierForScore(69.9)).toBe("PLAUSIBLE");
    expect(tierForScore(50)).toBe("PLAUSIBLE");
    expect(tierForScore(49.9)).toBe("DEVELOPMENTAL");
    expect(tierForScore(30)).toBe("DEVELOPMENTAL");
    expect(tierForScore(29.9)).toBe("UNSUPPORTED");
    expect(tierForScore(0)).toBe("UNSUPPORTED");
  });

  it("clamps out-of-range input", () => {
    expect(clampScore(140)).toBe(100);
    expect(clampScore(-20)).toBe(0);
    expect(tierForScore(140)).toBe("NATURAL");
    expect(tierForScore(-20)).toBe("UNSUPPORTED");
  });
});

describe("automatic eligibility threshold (§7)", () => {
  it("is exactly NATURAL / STRONG / PLAUSIBLE", () => {
    expect([...AUTOMATIC_ELIGIBLE_TIERS].sort()).toEqual(["NATURAL", "PLAUSIBLE", "STRONG"]);
    expect(isAutomaticTier("NATURAL")).toBe(true);
    expect(isAutomaticTier("STRONG")).toBe(true);
    expect(isAutomaticTier("PLAUSIBLE")).toBe(true);
    expect(isAutomaticTier("DEVELOPMENTAL")).toBe(false);
    expect(isAutomaticTier("UNSUPPORTED")).toBe(false);
  });
});
