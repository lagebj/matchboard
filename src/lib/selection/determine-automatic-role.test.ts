import { describe, it, expect } from "vitest";
import { determineAutomaticRoleFromPaths } from "./determine-automatic-role";

describe("determineAutomaticRoleFromPaths", () => {
  it("returns CORE when the player's core team matches the target team", () => {
    expect(determineAutomaticRoleFromPaths("team-a", "team-a", [])).toBe("CORE");
    expect(determineAutomaticRoleFromPaths("team-a", "team-a", ["SUPPORT", "DEVELOPMENT"])).toBe("CORE");
  });

  it("prefers SUPPORT when both SUPPORT and DEVELOPMENT paths exist", () => {
    expect(determineAutomaticRoleFromPaths("team-a", "team-b", ["SUPPORT", "DEVELOPMENT"])).toBe("SUPPORT");
  });

  it("returns SUPPORT when only a SUPPORT path exists", () => {
    expect(determineAutomaticRoleFromPaths("team-a", "team-b", ["SUPPORT"])).toBe("SUPPORT");
  });

  it("returns DEVELOPMENT when only a DEVELOPMENT path exists", () => {
    expect(determineAutomaticRoleFromPaths("team-a", "team-b", ["DEVELOPMENT"])).toBe("DEVELOPMENT");
  });

  it("returns CORE (requiring override server-side) when no path exists", () => {
    expect(determineAutomaticRoleFromPaths("team-a", "team-b", [])).toBe("CORE");
  });

  it("returns CORE when the player has no core team on record", () => {
    expect(determineAutomaticRoleFromPaths(null, "team-b", [])).toBe("CORE");
    expect(determineAutomaticRoleFromPaths(undefined, "team-b", ["SUPPORT"])).toBe("SUPPORT");
  });
});
