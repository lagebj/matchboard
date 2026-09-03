import { describe, expect, it } from "vitest";
import { preferredFunctionFor, computeOpponentFunctionBonus, MAX_OPPONENT_FUNCTION_BONUS } from "../opponent-function-preference";
import { computeOutfieldRoleSuitabilityProfile } from "@/domain/team-composition/outfield-role-evidence";

const NO_EXPOSURE = { matchCountByRole: {} };
const attackProfile = computeOutfieldRoleSuitabilityProfile({ primary: "forward" }, NO_EXPOSURE);

describe("preferredFunctionFor", () => {
  it("returns null when no tendencies are given", () => {
    expect(preferredFunctionFor(undefined)).toBeNull();
  });

  it("skips INSUFFICIENT-confidence tendencies", () => {
    expect(preferredFunctionFor([{ tag: "SLOW_BUILD_UP", confidence: "INSUFFICIENT" }])).toBeNull();
  });

  it("maps a known tag to its preferred function", () => {
    const result = preferredFunctionFor([{ tag: "SLOW_BUILD_UP", confidence: "ESTABLISHED" }]);
    expect(result).toEqual({ code: "FIRST_LINE_PRESS", confidence: "ESTABLISHED" });
  });

  it("returns null for a tag with no defensible functional mapping", () => {
    expect(preferredFunctionFor([{ tag: "SET_PIECE_ORIENTED", confidence: "ESTABLISHED" }])).toBeNull();
  });

  it("uses the first mappable tendency when several are given", () => {
    const result = preferredFunctionFor([
      { tag: "SET_PIECE_ORIENTED", confidence: "ESTABLISHED" },
      { tag: "HIGH_PRESSING", confidence: "EMERGING" },
    ]);
    expect(result).toEqual({ code: "PACE_IN_BEHIND", confidence: "EMERGING" });
  });
});

describe("computeOpponentFunctionBonus", () => {
  it("is 0 when there is no preferred function", () => {
    expect(computeOpponentFunctionBonus({ speed: 9 }, attackProfile, null)).toBe(0);
  });

  it("is 0 when the candidate is not a strong fit for the preferred function", () => {
    const preferred = { code: "PACE_IN_BEHIND" as const, confidence: "ESTABLISHED" as const };
    expect(computeOpponentFunctionBonus({ speed: 2, oneVOneAttacking: 2, decisionMaking: 2 }, attackProfile, preferred)).toBe(0);
  });

  it("is bounded even for an ESTABLISHED-confidence strong fit", () => {
    const preferred = { code: "PACE_IN_BEHIND" as const, confidence: "ESTABLISHED" as const };
    const bonus = computeOpponentFunctionBonus({ speed: 9, oneVOneAttacking: 9, decisionMaking: 9 }, attackProfile, preferred);
    expect(bonus).toBeGreaterThan(0);
    expect(bonus).toBeLessThanOrEqual(MAX_OPPONENT_FUNCTION_BONUS);
  });

  it("gives a smaller bonus for EMERGING confidence than ESTABLISHED", () => {
    const attrs = { speed: 9, oneVOneAttacking: 9, decisionMaking: 9 };
    const established = computeOpponentFunctionBonus(attrs, attackProfile, { code: "PACE_IN_BEHIND", confidence: "ESTABLISHED" });
    const emerging = computeOpponentFunctionBonus(attrs, attackProfile, { code: "PACE_IN_BEHIND", confidence: "EMERGING" });
    expect(emerging).toBeLessThan(established);
  });
});
