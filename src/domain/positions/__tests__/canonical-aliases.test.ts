import { describe, expect, it } from "vitest";
import { normalizeCanonicalPosition } from "../canonical-aliases";
import { CANONICAL_TACTICAL_POSITIONS } from "../roles";

describe("normalizeCanonicalPosition — canonical passthrough (ADR-0154 §1)", () => {
  it("passes every canonical 24-code through unchanged", () => {
    for (const code of CANONICAL_TACTICAL_POSITIONS) {
      expect(normalizeCanonicalPosition(code)).toBe(code);
    }
  });

  it("passes broad historical codes through unchanged", () => {
    for (const code of ["DEFENDER", "MIDFIELDER", "FORWARD"]) {
      expect(normalizeCanonicalPosition(code)).toBe(code);
    }
  });
});

describe("legacy alias collapse (ADR-0154 §6)", () => {
  it("normalizes DM -> CDM, AM -> CAM, ST -> CF", () => {
    expect(normalizeCanonicalPosition("DM")).toBe("CDM");
    expect(normalizeCanonicalPosition("AM")).toBe("CAM");
    expect(normalizeCanonicalPosition("ST")).toBe("CF");
  });

  it("normalizes verbose legacy strings", () => {
    expect(normalizeCanonicalPosition("GOALKEEPER")).toBe("GK");
    expect(normalizeCanonicalPosition("STRIKER")).toBe("CF");
    expect(normalizeCanonicalPosition("DEFENSIVE_MIDFIELDER")).toBe("CDM");
    expect(normalizeCanonicalPosition("DEFENSIVE MIDFIELDER")).toBe("CDM");
    expect(normalizeCanonicalPosition("ATTACKING_MIDFIELDER")).toBe("CAM");
    expect(normalizeCanonicalPosition("ATTACKING MIDFIELDER")).toBe("CAM");
    expect(normalizeCanonicalPosition("CENTRE_BACK")).toBe("CB");
    expect(normalizeCanonicalPosition("CENTER BACK")).toBe("CB");
    expect(normalizeCanonicalPosition("CENTRAL_MIDFIELDER")).toBe("CM");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(normalizeCanonicalPosition(" dm ")).toBe("CDM");
    expect(normalizeCanonicalPosition("goalkeeper")).toBe("GK");
  });
});

describe("sided exact codes NEVER collapse onto their unsided sibling (ADR-0154 §4 — the regression this ADR exists to prevent)", () => {
  it("LCB / RCB stay LCB / RCB, never CB", () => {
    expect(normalizeCanonicalPosition("LCB")).toBe("LCB");
    expect(normalizeCanonicalPosition("RCB")).toBe("RCB");
    expect(normalizeCanonicalPosition("LCB")).not.toBe("CB");
    expect(normalizeCanonicalPosition("RCB")).not.toBe("CB");
  });

  it("LDM / RDM stay LDM / RDM, never CDM", () => {
    expect(normalizeCanonicalPosition("LDM")).toBe("LDM");
    expect(normalizeCanonicalPosition("RDM")).toBe("RDM");
  });

  it("LCM / RCM stay LCM / RCM, never CM", () => {
    expect(normalizeCanonicalPosition("LCM")).toBe("LCM");
    expect(normalizeCanonicalPosition("RCM")).toBe("RCM");
    expect(normalizeCanonicalPosition("LCM")).not.toBe("CM");
  });

  it("LAM / RAM stay LAM / RAM, never CAM", () => {
    expect(normalizeCanonicalPosition("LAM")).toBe("LAM");
    expect(normalizeCanonicalPosition("RAM")).toBe("RAM");
    expect(normalizeCanonicalPosition("LAM")).not.toBe("CAM");
  });

  it("LCF / RCF stay LCF / RCF, never CF", () => {
    expect(normalizeCanonicalPosition("LCF")).toBe("LCF");
    expect(normalizeCanonicalPosition("RCF")).toBe("RCF");
    expect(normalizeCanonicalPosition("LCF")).not.toBe("CF");
  });
});

describe("broad codes never upgrade to exact precision (ADR-0154 §7)", () => {
  it("MIDFIELDER stays MIDFIELDER, never becomes CM", () => {
    expect(normalizeCanonicalPosition("MIDFIELDER")).toBe("MIDFIELDER");
    expect(normalizeCanonicalPosition("MIDFIELDER")).not.toBe("CM");
  });
});

describe("empty / unrecognized input", () => {
  it("returns null for empty/placeholder declarations", () => {
    for (const raw of ["", "  ", "NONE", "none", "-", "N/A", "FLEX", "FLEXIBLE", null, undefined]) {
      expect(normalizeCanonicalPosition(raw)).toBeNull();
    }
  });

  it("returns an unrecognized string trimmed/uppercased, never fabricated", () => {
    expect(normalizeCanonicalPosition("sweeper")).toBe("SWEEPER");
    expect(normalizeCanonicalPosition(" left wing ")).toBe("LEFT WING");
  });
});
