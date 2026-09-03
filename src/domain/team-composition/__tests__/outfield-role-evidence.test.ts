import { describe, expect, it } from "vitest";
import {
  classifyExposureConfidence,
  classifyOutfieldRoleSuitability,
  computeOutfieldRoleSuitabilityProfile,
  computeTacticalFunctionFit,
  computeTacticalFunctionProfile,
  type DeclaredBroadPositions,
} from "../outfield-role-evidence";
import { OUTFIELD_STRUCTURAL_ROLES, TACTICAL_FUNCTION_CODES, type OutfieldPositionExposureEvidence } from "../team-composition-types";

const NO_EXPOSURE: OutfieldPositionExposureEvidence = { matchCountByRole: {} };

const pureStriker: DeclaredBroadPositions = { primary: "forward" };
const strikerWithWideSecondary: DeclaredBroadPositions = { primary: "forward", secondary: "midfielder" };
const pureDefender: DeclaredBroadPositions = { primary: "defender" };
const pureGoalkeeper: DeclaredBroadPositions = { primary: "goalkeeper" };

describe("classifyExposureConfidence", () => {
  it("is INSUFFICIENT below 3 matches", () => {
    expect(classifyExposureConfidence(0)).toBe("INSUFFICIENT");
    expect(classifyExposureConfidence(2)).toBe("INSUFFICIENT");
  });

  it("is EMERGING for 3-5 matches", () => {
    expect(classifyExposureConfidence(3)).toBe("EMERGING");
    expect(classifyExposureConfidence(5)).toBe("EMERGING");
  });

  it("is ESTABLISHED for 6+ matches", () => {
    expect(classifyExposureConfidence(6)).toBe("ESTABLISHED");
    expect(classifyExposureConfidence(20)).toBe("ESTABLISHED");
  });
});

describe("classifyOutfieldRoleSuitability", () => {
  it("classifies a PRIMARY declared fit as NATURAL regardless of exposure", () => {
    const result = classifyOutfieldRoleSuitability("ATTACK", "PRIMARY", NO_EXPOSURE);
    expect(result.tier).toBe("NATURAL");
    expect(result.explanation).toMatch(/primary/i);
  });

  it("classifies SECONDARY and TERTIARY declared fits as PLAUSIBLE", () => {
    expect(classifyOutfieldRoleSuitability("MIDFIELD", "SECONDARY", NO_EXPOSURE).tier).toBe("PLAUSIBLE");
    expect(classifyOutfieldRoleSuitability("MIDFIELD", "TERTIARY", NO_EXPOSURE).tier).toBe("PLAUSIBLE");
  });

  it("classifies NO_FIT with established exposure as DEVELOPMENTAL, not NATURAL or PLAUSIBLE", () => {
    const exposure: OutfieldPositionExposureEvidence = { matchCountByRole: { MIDFIELD: 7 } };
    const result = classifyOutfieldRoleSuitability("MIDFIELD", "NO_FIT", exposure);
    expect(result.tier).toBe("DEVELOPMENTAL");
    expect(result.exposureConfidence).toBe("ESTABLISHED");
  });

  it("classifies NO_FIT with emerging (but not insufficient) exposure as DEVELOPMENTAL", () => {
    const exposure: OutfieldPositionExposureEvidence = { matchCountByRole: { MIDFIELD: 3 } };
    expect(classifyOutfieldRoleSuitability("MIDFIELD", "NO_FIT", exposure).tier).toBe("DEVELOPMENTAL");
  });

  it("classifies NO_FIT with no exposure as UNSUPPORTED — unknown/absent evidence is neutral, not a reclassification to usable", () => {
    const result = classifyOutfieldRoleSuitability("DEFENCE", "NO_FIT", NO_EXPOSURE);
    expect(result.tier).toBe("UNSUPPORTED");
  });

  it("does not let a single insufficient match of exposure upgrade NO_FIT away from UNSUPPORTED", () => {
    const exposure: OutfieldPositionExposureEvidence = { matchCountByRole: { DEFENCE: 1 } };
    expect(classifyOutfieldRoleSuitability("DEFENCE", "NO_FIT", exposure).tier).toBe("UNSUPPORTED");
  });
});

describe("computeOutfieldRoleSuitabilityProfile — goalkeeper boundary", () => {
  it("never returns a GOALKEEPER role entry, even for a goalkeeper-primary player", () => {
    const profile = computeOutfieldRoleSuitabilityProfile(pureGoalkeeper, NO_EXPOSURE);
    expect(profile.map((r) => r.role)).toEqual(OUTFIELD_STRUCTURAL_ROLES.slice());
    expect(profile.some((r) => (r.role as string) === "GOALKEEPER")).toBe(false);
  });

  it("gives a goalkeeper-primary player UNSUPPORTED for every outfield role absent any declared/demonstrated outfield support", () => {
    const profile = computeOutfieldRoleSuitabilityProfile(pureGoalkeeper, NO_EXPOSURE);
    expect(profile.every((r) => r.tier === "UNSUPPORTED")).toBe(true);
  });

  it("returns exactly the four outfield roles for every player, regardless of goalkeeperAbility", () => {
    const profile = computeOutfieldRoleSuitabilityProfile(pureStriker, NO_EXPOSURE);
    expect(profile.map((r) => r.role).sort()).toEqual(["ATTACK", "DEFENCE", "FLEXIBLE", "MIDFIELD"]);
  });
});

describe("computeOutfieldRoleSuitabilityProfile — five-striker scenario (TEST-MATRIX #8)", () => {
  it("does not force an unsupported defensive role just because a striker needs minutes equalised", () => {
    const profile = computeOutfieldRoleSuitabilityProfile(pureStriker, NO_EXPOSURE);
    const defence = profile.find((r) => r.role === "DEFENCE")!;
    expect(defence.tier).toBe("UNSUPPORTED");
  });

  it("recognises a plausible alternate role from a declared secondary/tertiary position", () => {
    const profile = computeOutfieldRoleSuitabilityProfile(strikerWithWideSecondary, NO_EXPOSURE);
    const midfield = profile.find((r) => r.role === "MIDFIELD")!;
    expect(midfield.tier).toBe("PLAUSIBLE");
  });

  it("recognises a developmental alternate role from demonstrated exposure alone", () => {
    // A Striker with no declared secondary position, but 4 matches of recorded midfield exposure.
    const exposure: OutfieldPositionExposureEvidence = { matchCountByRole: { MIDFIELD: 4 } };
    const profile = computeOutfieldRoleSuitabilityProfile(pureStriker, exposure);
    const midfield = profile.find((r) => r.role === "MIDFIELD")!;
    expect(midfield.tier).toBe("DEVELOPMENTAL");
  });

  it("still reports attack as NATURAL alongside any alternate roles — the primary role is never demoted", () => {
    const profile = computeOutfieldRoleSuitabilityProfile(strikerWithWideSecondary, NO_EXPOSURE);
    expect(profile.find((r) => r.role === "ATTACK")!.tier).toBe("NATURAL");
  });

  it("a flexible declared primary position is NATURAL for every outfield role", () => {
    const flexible: DeclaredBroadPositions = { primary: "flexible" };
    const profile = computeOutfieldRoleSuitabilityProfile(flexible, NO_EXPOSURE);
    expect(profile.every((r) => r.tier === "NATURAL")).toBe(true);
  });
});

describe("computeTacticalFunctionFit", () => {
  const attackNatural = computeOutfieldRoleSuitabilityProfile(pureStriker, NO_EXPOSURE);

  it("is NOT_APPLICABLE when none of the function's applicable roles are supported", () => {
    // PACE_IN_BEHIND only applies to ATTACK; give a purely defensive profile.
    const defenceOnly = computeOutfieldRoleSuitabilityProfile(pureDefender, NO_EXPOSURE);
    const fit = computeTacticalFunctionFit("PACE_IN_BEHIND", { speed: 9, oneVOneAttacking: 9 }, defenceOnly);
    expect(fit.tier).toBe("NOT_APPLICABLE");
    expect(fit.score).toBeNull();
  });

  it("is NOT_APPLICABLE when the role is supported but no relevant attributes are recorded", () => {
    const fit = computeTacticalFunctionFit("PACE_IN_BEHIND", {}, attackNatural);
    expect(fit.tier).toBe("NOT_APPLICABLE");
    expect(fit.score).toBeNull();
  });

  it("computes a STRONG_FIT for high supporting attributes on an applicable role", () => {
    const fit = computeTacticalFunctionFit("PACE_IN_BEHIND", { speed: 9, oneVOneAttacking: 8, decisionMaking: 8 }, attackNatural);
    expect(fit.tier).toBe("STRONG_FIT");
    expect(fit.score).not.toBeNull();
    expect(fit.score!).toBeGreaterThanOrEqual(7);
  });

  it("computes a WEAK_FIT for low supporting attributes on an applicable role", () => {
    const fit = computeTacticalFunctionFit("PACE_IN_BEHIND", { speed: 2, oneVOneAttacking: 2, decisionMaking: 3 }, attackNatural);
    expect(fit.tier).toBe("WEAK_FIT");
  });

  it("degrades gracefully with partial null attributes rather than treating null as zero", () => {
    const fitWithNulls = computeTacticalFunctionFit("PACE_IN_BEHIND", { speed: 8, oneVOneAttacking: null, decisionMaking: undefined }, attackNatural);
    expect(fitWithNulls.score).toBe(8);
  });

  it("computeTacticalFunctionProfile returns one entry per tactical function code", () => {
    const profile = computeTacticalFunctionProfile({ speed: 7, effort: 7 }, attackNatural);
    expect(profile.map((f) => f.function)).toEqual(TACTICAL_FUNCTION_CODES.slice());
  });

  it("two strikers can offer different fits for the same tactical function (PROGRAMME.md example)", () => {
    const stA = computeTacticalFunctionFit("FIRST_LINE_PRESS", { effort: 9, concentration: 8, speed: 9, decisionMaking: 8 }, attackNatural);
    const stB = computeTacticalFunctionFit("FIRST_LINE_PRESS", { effort: 4, concentration: 5, speed: 4, decisionMaking: 5 }, attackNatural);
    expect(stA.tier).toBe("STRONG_FIT");
    expect(stB.tier).not.toBe("STRONG_FIT");
  });
});
