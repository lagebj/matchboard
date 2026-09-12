import { describe, it, expect } from "vitest";
import { computePlayerPositionFitEntries } from "../position-fit-entries";

describe("computePlayerPositionFitEntries", () => {
  it("never includes GK, matching the goalkeeper-boundary precedent (ADR-0116 D-011)", () => {
    const entries = computePlayerPositionFitEntries({ primaryPosition: "CM" });
    const allRoles = entries.flatMap((e) => e.roles);
    expect(allRoles).not.toContain("GK");
  });

  it("groups a declared left midfielder's natural role correctly", () => {
    const entries = computePlayerPositionFitEntries({ primaryPosition: "LM" });
    const natural = entries.find((e) => e.tier === "NATURAL");
    expect(natural?.roles).toContain("LM");
  });

  it("covers all 11 outfield exact roles exactly once across all tiers", () => {
    const entries = computePlayerPositionFitEntries({ primaryPosition: "CM", secondaryPosition: "ST" });
    const allRoles = entries.flatMap((e) => e.roles);
    expect(allRoles).toHaveLength(11);
    expect(new Set(allRoles).size).toBe(11);
  });

  it("returns only UNSUPPORTED-tier roles for a player with no declared position", () => {
    const entries = computePlayerPositionFitEntries({ primaryPosition: null });
    expect(entries).toHaveLength(1);
    expect(entries[0].tier).toBe("UNSUPPORTED");
    expect(entries[0].roles).toHaveLength(11);
  });

  it("locks in the normative CM -> winger DEVELOPMENTAL rule (ADR-0129)", () => {
    const entries = computePlayerPositionFitEntries({ primaryPosition: "CM" });
    const developmental = entries.find((e) => e.tier === "DEVELOPMENTAL");
    expect(developmental?.roles).toEqual(expect.arrayContaining(["LW", "RW"]));
  });
});
