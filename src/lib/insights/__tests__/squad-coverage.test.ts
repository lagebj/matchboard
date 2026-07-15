import { describe, it, expect } from "vitest";
import {
  classifyGKCapability,
  classifyPosition,
  computeCoverageWarnings,
} from "../squad-coverage-helpers";

describe("squad-coverage-helpers", () => {
  describe("classifyGKCapability", () => {
    it("classifies YES as primary", () => {
      expect(classifyGKCapability("YES")).toBe("primary");
    });

    it("classifies EMERGENCY as emergency", () => {
      expect(classifyGKCapability("EMERGENCY")).toBe("emergency");
    });

    it("classifies NO as none", () => {
      expect(classifyGKCapability("NO")).toBe("none");
    });

    it("classifies unknown as none", () => {
      expect(classifyGKCapability("UNKNOWN")).toBe("none");
    });
  });

  describe("classifyPosition", () => {
    it("classifies CB as defender", () => {
      expect(classifyPosition("CB")).toBe("defender");
    });

    it("classifies LB as defender", () => {
      expect(classifyPosition("LB")).toBe("defender");
    });

    it("classifies RB as defender", () => {
      expect(classifyPosition("RB")).toBe("defender");
    });

    it("classifies CM as midfielder", () => {
      expect(classifyPosition("CM")).toBe("midfielder");
    });

    it("classifies CDM as midfielder", () => {
      expect(classifyPosition("CDM")).toBe("midfielder");
    });

    it("classifies ST as attacker", () => {
      expect(classifyPosition("ST")).toBe("attacker");
    });

    it("classifies LW as attacker", () => {
      expect(classifyPosition("LW")).toBe("attacker");
    });

    it("classifies null as unassigned", () => {
      expect(classifyPosition(null)).toBe("unassigned");
    });

    it("classifies GK as unassigned (GK is handled separately)", () => {
      expect(classifyPosition("GK")).toBe("unassigned");
    });

    it("classifies unknown position as unassigned", () => {
      expect(classifyPosition("UNKNOWN")).toBe("unassigned");
    });

    it("is case-insensitive", () => {
      expect(classifyPosition("cb")).toBe("defender");
      expect(classifyPosition("cm")).toBe("midfielder");
      expect(classifyPosition("st")).toBe("attacker");
    });
  });

  describe("computeCoverageWarnings", () => {
    it("warns about no goalkeeper when total GK is 0", () => {
      const warnings = computeCoverageWarnings({
        totalGK: 0, primaryGK: 0, secondaryGK: 0, emergencyGK: 0,
        defenders: 3, midfielders: 3, attackers: 3,
      });
      expect(warnings).toContain("no_goalkeeper");
    });

    it("warns about no primary goalkeeper when only emergency GK", () => {
      const warnings = computeCoverageWarnings({
        totalGK: 1, primaryGK: 0, secondaryGK: 0, emergencyGK: 1,
        defenders: 3, midfielders: 3, attackers: 3,
      });
      expect(warnings).toContain("no_primary_goalkeeper");
      expect(warnings).not.toContain("tertiary_goalkeeper_only");
    });

    it("warns about no defenders", () => {
      const warnings = computeCoverageWarnings({
        totalGK: 1, primaryGK: 1, secondaryGK: 0, emergencyGK: 0,
        defenders: 0, midfielders: 3, attackers: 3,
      });
      expect(warnings).toContain("no_defenders");
    });

    it("warns about no midfielders", () => {
      const warnings = computeCoverageWarnings({
        totalGK: 1, primaryGK: 1, secondaryGK: 0, emergencyGK: 0,
        defenders: 3, midfielders: 0, attackers: 3,
      });
      expect(warnings).toContain("no_midfielders");
    });

    it("warns about no attackers", () => {
      const warnings = computeCoverageWarnings({
        totalGK: 1, primaryGK: 1, secondaryGK: 0, emergencyGK: 0,
        defenders: 3, midfielders: 3, attackers: 0,
      });
      expect(warnings).toContain("no_attackers");
    });

    it("returns empty warnings for well-covered squad", () => {
      const warnings = computeCoverageWarnings({
        totalGK: 1, primaryGK: 1, secondaryGK: 0, emergencyGK: 0,
        defenders: 3, midfielders: 3, attackers: 3,
      });
      expect(warnings).toHaveLength(0);
    });

    it("does not warn no_goalkeeper when GK exists", () => {
      const warnings = computeCoverageWarnings({
        totalGK: 1, primaryGK: 1, secondaryGK: 0, emergencyGK: 0,
        defenders: 3, midfielders: 3, attackers: 3,
      });
      expect(warnings).not.toContain("no_goalkeeper");
    });
  });
});