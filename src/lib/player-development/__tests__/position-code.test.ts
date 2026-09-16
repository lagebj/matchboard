import { describe, it, expect } from "vitest";
import { normalizePlayerPositionCode } from "../position-code";

describe("normalizePlayerPositionCode", () => {
  it("normalizes DEFENSIVE_MIDFIELDER to DM", () => {
    expect(normalizePlayerPositionCode("DEFENSIVE_MIDFIELDER")).toBe("DM");
  });

  it("normalizes GOALKEEPER to GK", () => {
    expect(normalizePlayerPositionCode("GOALKEEPER")).toBe("GK");
  });

  it("normalizes ATTACKING_MIDFIELDER to AM", () => {
    expect(normalizePlayerPositionCode("ATTACKING_MIDFIELDER")).toBe("AM");
  });

  it("normalizes CENTRAL_MIDFIELDER, CENTRE_MIDFIELDER and CENTER_MIDFIELDER to CM", () => {
    expect(normalizePlayerPositionCode("CENTRAL_MIDFIELDER")).toBe("CM");
    expect(normalizePlayerPositionCode("CENTRE_MIDFIELDER")).toBe("CM");
    expect(normalizePlayerPositionCode("CENTER_MIDFIELDER")).toBe("CM");
  });

  it("normalizes CENTER_BACK and CENTRE_BACK to CB", () => {
    expect(normalizePlayerPositionCode("CENTER_BACK")).toBe("CB");
    expect(normalizePlayerPositionCode("CENTRE_BACK")).toBe("CB");
  });

  it("normalizes WINGER to W", () => {
    expect(normalizePlayerPositionCode("WINGER")).toBe("W");
  });

  it("normalizes STRIKER to ST", () => {
    expect(normalizePlayerPositionCode("STRIKER")).toBe("ST");
  });

  it("also matches space-separated legacy aliases", () => {
    expect(normalizePlayerPositionCode("DEFENSIVE MIDFIELDER")).toBe("DM");
    expect(normalizePlayerPositionCode("ATTACKING MIDFIELDER")).toBe("AM");
  });

  it("leaves canonical exact codes unchanged", () => {
    for (const code of ["GK", "CB", "LB", "RB", "CM", "DM", "AM", "LM", "RM", "WM", "LW", "RW", "W", "ST", "CF"]) {
      expect(normalizePlayerPositionCode(code)).toBe(code);
    }
  });

  it("keeps broad DEFENDER, MIDFIELDER and FORWARD broad, never upgrading to an exact code", () => {
    expect(normalizePlayerPositionCode("DEFENDER")).toBe("DEFENDER");
    expect(normalizePlayerPositionCode("MIDFIELDER")).toBe("MIDFIELDER");
    expect(normalizePlayerPositionCode("FORWARD")).toBe("FORWARD");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizePlayerPositionCode("  DM  ")).toBe("DM");
  });

  it("returns null for null, undefined and blank input", () => {
    expect(normalizePlayerPositionCode(null)).toBeNull();
    expect(normalizePlayerPositionCode(undefined)).toBeNull();
    expect(normalizePlayerPositionCode("   ")).toBeNull();
    expect(normalizePlayerPositionCode("")).toBeNull();
  });

  it("passes through an unrecognized value unchanged (no fabrication)", () => {
    expect(normalizePlayerPositionCode("SWEEPER")).toBe("SWEEPER");
  });
});
