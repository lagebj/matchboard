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
