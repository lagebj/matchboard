import { describe, expect, it } from "vitest";
import { isEmptyDeclaration, normalizeSourceRole } from "../aliases";

describe("normalizeSourceRole — exact aliases (ADR-0129 §2)", () => {
  it("maps CDM → DM, CAM → AM, CF → ST", () => {
    expect(normalizeSourceRole("CDM")).toEqual({ known: true, role: "DM", sourceSide: null });
    expect(normalizeSourceRole("CAM")).toEqual({ known: true, role: "AM", sourceSide: null });
    expect(normalizeSourceRole("CF")).toEqual({ known: true, role: "ST", sourceSide: null });
  });

  it("maps LCB / RCB to CB with source-side metadata", () => {
    expect(normalizeSourceRole("LCB")).toEqual({ known: true, role: "CB", sourceSide: "LEFT" });
    expect(normalizeSourceRole("RCB")).toEqual({ known: true, role: "CB", sourceSide: "RIGHT" });
  });

  it("keeps SS and the unsided W winger source profile", () => {
    expect(normalizeSourceRole("SS")).toEqual({ known: true, role: "SS", sourceSide: null });
    expect(normalizeSourceRole("W")).toEqual({ known: true, role: "W", sourceSide: null });
  });

  it("passes canonical exact roles through unchanged", () => {
    for (const role of ["GK", "LB", "CB", "RB", "DM", "CM", "AM", "LM", "RM", "LW", "RW", "ST"]) {
      expect(normalizeSourceRole(role)).toEqual({ known: true, role, sourceSide: null });
    }
  });

  it("trims and upper-cases before the exact lookup (no other leniency)", () => {
    expect(normalizeSourceRole(" gk ")).toEqual({ known: true, role: "GK", sourceSide: null });
    expect(normalizeSourceRole("lcb")).toEqual({ known: true, role: "CB", sourceSide: "LEFT" });
  });

  it("resolves any unrecognised string to UNKNOWN and never substring-fuzzy-matches", () => {
    for (const raw of ["Midfielder", "MID", "midfield", "Defender", "DEFENDER", "Forward", "centreback", "CCM", "STx", "left wing"]) {
      expect(normalizeSourceRole(raw)).toEqual({ known: false, role: "UNKNOWN", sourceSide: null });
    }
  });

  it("treats empty / placeholder declarations as UNKNOWN", () => {
    for (const raw of ["", "  ", "NONE", "none", "-", "N/A", "FLEX", "FLEXIBLE", null, undefined]) {
      expect(normalizeSourceRole(raw)).toEqual({ known: false, role: "UNKNOWN", sourceSide: null });
    }
  });
});

describe("normalizeSourceRole — new canonical sided codes resolve (ADR-0154, previously UNKNOWN)", () => {
  it("resolves the new sided midfield/defence/forward codes to their base role + side", () => {
    expect(normalizeSourceRole("LDM")).toEqual({ known: true, role: "DM", sourceSide: "LEFT" });
    expect(normalizeSourceRole("RDM")).toEqual({ known: true, role: "DM", sourceSide: "RIGHT" });
    expect(normalizeSourceRole("LWB")).toEqual({ known: true, role: "LB", sourceSide: "LEFT" });
    expect(normalizeSourceRole("RWB")).toEqual({ known: true, role: "RB", sourceSide: "RIGHT" });
    expect(normalizeSourceRole("LCM")).toEqual({ known: true, role: "CM", sourceSide: "LEFT" });
    expect(normalizeSourceRole("RCM")).toEqual({ known: true, role: "CM", sourceSide: "RIGHT" });
    expect(normalizeSourceRole("LAM")).toEqual({ known: true, role: "AM", sourceSide: "LEFT" });
    expect(normalizeSourceRole("RAM")).toEqual({ known: true, role: "AM", sourceSide: "RIGHT" });
    expect(normalizeSourceRole("LCF")).toEqual({ known: true, role: "ST", sourceSide: "LEFT" });
    expect(normalizeSourceRole("RCF")).toEqual({ known: true, role: "ST", sourceSide: "RIGHT" });
  });

  it("resolves verbose legacy aliases to the same base role as before", () => {
    expect(normalizeSourceRole("GOALKEEPER")).toEqual({ known: true, role: "GK", sourceSide: null });
    expect(normalizeSourceRole("DEFENSIVE_MIDFIELDER")).toEqual({ known: true, role: "DM", sourceSide: null });
    expect(normalizeSourceRole("ATTACKING_MIDFIELDER")).toEqual({ known: true, role: "AM", sourceSide: null });
    expect(normalizeSourceRole("STRIKER")).toEqual({ known: true, role: "ST", sourceSide: null });
  });
});

describe("isEmptyDeclaration", () => {
  it("is true for null, blank and placeholder strings", () => {
    expect(isEmptyDeclaration(null)).toBe(true);
    expect(isEmptyDeclaration("  ")).toBe(true);
    expect(isEmptyDeclaration("NONE")).toBe(true);
  });

  it("is false for a real declared string, even an unknown one", () => {
    expect(isEmptyDeclaration("CM")).toBe(false);
    expect(isEmptyDeclaration("Midfielder")).toBe(false);
  });
});
