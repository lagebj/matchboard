import { describe, it, expect } from "vitest";
import { PROFILE_POSITIONS, aggregateExactAppearancesByProfile, type ExactPositionAppearance } from "../../shared/profile-position-model";
import {
  isValidTriple,
  setPrimary,
  setSecondary,
  setTertiary,
  availableOptionsFor,
  previewLegacyDeclaredConsolidation,
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

  describe("Case A — legacy DECLARED positions (PR #777 remediation, finding A12-1)", () => {
    it("consolidates a declared LCF/CF/RCF primary/secondary/tertiary to a single F primary, inventing nothing", () => {
      const preview = previewLegacyDeclaredConsolidation({ primary: "LCF", secondary: "CF", tertiary: "RCF" });
      expect(preview.primary).toBe("F");
      expect(preview.secondary).toBeNull();
      expect(preview.tertiary).toBeNull();
      expect(preview.sourceDeclared).toEqual({ primary: "LCF", secondary: "CF", tertiary: "RCF" });
    });

    it("the original primary declaration provides the ordering authority — it always wins the primary slot", () => {
      const preview = previewLegacyDeclaredConsolidation({ primary: "LCM", secondary: "LCF" });
      expect(preview.primary).toBe("CM"); // from the declared primary, LCM
      expect(preview.secondary).toBe("F"); // distinct group, kept
    });

    it("keeps genuinely distinct declared groups as distinct secondary/tertiary, never merging them", () => {
      const preview = previewLegacyDeclaredConsolidation({ primary: "GK", secondary: "LCM", tertiary: "LCF" });
      expect(preview.primary).toBe("GK");
      expect(preview.secondary).toBe("CM");
      expect(preview.tertiary).toBe("F");
    });
  });

  describe("Case B — recorded MATCH EXPOSURE only, no declaration (PR #777 remediation, finding A12-1)", () => {
    it("collapses recorded exposure through the same 24->14 mapping without creating any declared triple", () => {
      const appearances: ExactPositionAppearance[] = [
        { matchId: "m-10", tacticalPosition: "LCF", minutes: 30 },
        { matchId: "m-11", tacticalPosition: "CF", minutes: 60 },
        { matchId: "m-12", tacticalPosition: "RCF", minutes: 15 },
      ];
      const aggregates = aggregateExactAppearancesByProfile(appearances);
      // Exposure is real and visible...
      expect(aggregates).toEqual([
        {
          profile: "F",
          totalMinutes: 105,
          appearanceCount: 3,
          breakdown: [
            { tacticalPosition: "LCF", minutes: 30 },
            { tacticalPosition: "CF", minutes: 60 },
            { tacticalPosition: "RCF", minutes: 15 },
          ],
        },
      ]);
      // ...but the aggregation function itself has no concept of "primary" / "declared" at all —
      // it cannot produce a ProfilePositionTriple, so no declaration can leak out of this path.
      expect(aggregates[0]).not.toHaveProperty("primary");
      expect(aggregates[0]).not.toHaveProperty("secondary");
      expect(aggregates[0]).not.toHaveProperty("tertiary");
    });

    it("never double-counts a match that appears at two sided codes within the same profile group", () => {
      const appearances: ExactPositionAppearance[] = [
        { matchId: "m-1", tacticalPosition: "LCF", minutes: 20 },
        { matchId: "m-1", tacticalPosition: "RCF", minutes: 20 },
      ];
      const [aggregate] = aggregateExactAppearancesByProfile(appearances);
      expect(aggregate.totalMinutes).toBe(40);
      expect(aggregate.appearanceCount).toBe(1);
    });
  });
});
