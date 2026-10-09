import { describe, it, expect } from "vitest";
import { PROFILE_POSITIONS } from "../../shared/profile-position-model";
import {
  isValidTriple,
  setPrimary,
  setSecondary,
  setTertiary,
  availableOptionsFor,
  previewLegacyConsolidation,
  type ProfilePositionTriple,
} from "../profile-triple-selection";

/**
 * A12 primary/secondary/tertiary selection invariants (PR #777 remediation): no duplicate
 * profile position may ever occupy two slots, optional slots clear cleanly, and the legacy
 * migration preview never invents a secondary/tertiary the source record doesn't distinguish.
 */
describe("A12 profile-triple selection", () => {
  const base: ProfilePositionTriple = { primary: "CM", secondary: "RB", tertiary: null };

  it("accepts a triple with no duplicates", () => {
    expect(isValidTriple(base)).toBe(true);
  });

  it("rejects a triple where two slots share the same position", () => {
    expect(isValidTriple({ primary: "CM", secondary: "CM", tertiary: null })).toBe(false);
  });

  it("clears secondary when primary is changed to match it", () => {
    const next = setPrimary(base, "RB");
    expect(next.primary).toBe("RB");
    expect(next.secondary).toBeNull();
    expect(isValidTriple(next)).toBe(true);
  });

  it("clears tertiary when secondary is changed to match it", () => {
    const withTertiary: ProfilePositionTriple = { primary: "CM", secondary: "RB", tertiary: "LW" };
    const next = setSecondary(withTertiary, "LW");
    expect(next.secondary).toBe("LW");
    expect(next.tertiary).toBeNull();
    expect(isValidTriple(next)).toBe(true);
  });

  it("clears an optional slot back to null", () => {
    expect(setSecondary(base, null).secondary).toBeNull();
    expect(setTertiary({ ...base, tertiary: "LW" }, null).tertiary).toBeNull();
  });

  it("never offers the primary or the other optional slot's value as an option", () => {
    const triple: ProfilePositionTriple = { primary: "CM", secondary: "RB", tertiary: "LW" };
    const secondaryOptions = availableOptionsFor("secondary", triple, PROFILE_POSITIONS);
    expect(secondaryOptions).not.toContain("CM"); // primary
    expect(secondaryOptions).not.toContain("LW"); // tertiary
    expect(secondaryOptions).toContain("RB"); // its own current value stays offered

    const tertiaryOptions = availableOptionsFor("tertiary", triple, PROFILE_POSITIONS);
    expect(tertiaryOptions).not.toContain("CM"); // primary
    expect(tertiaryOptions).not.toContain("RB"); // secondary
    expect(tertiaryOptions).toContain("LW");
  });

  it("consolidates LCF/CF/RCF to a single F primary, inventing nothing", () => {
    const preview = previewLegacyConsolidation(["LCF", "CF", "RCF"]);
    expect(preview.singleProfile).toBe("F");
    expect(preview.distinctProfiles).toEqual(["F"]);
  });

  it("does not guess a primary when the source codes span more than one profile group", () => {
    const preview = previewLegacyConsolidation(["LCF", "LCM"]);
    expect(preview.singleProfile).toBeNull();
    expect(preview.distinctProfiles.sort()).toEqual(["CM", "F"]);
  });
});
