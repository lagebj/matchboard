import { describe, expect, it } from "vitest";
import { deriveCoverage, meetsEligibilityGate } from "../quality";

describe("deriveCoverage (ADR-0155 §6)", () => {
  it("is UNKNOWN when there are no inputs at all", () => {
    expect(deriveCoverage(0, 0)).toBe("UNKNOWN");
  });

  it("is COMPLETE when nothing is missing", () => {
    expect(deriveCoverage(10, 0)).toBe("COMPLETE");
  });

  it("is PARTIAL when some but not all inputs are missing", () => {
    expect(deriveCoverage(10, 2)).toBe("PARTIAL");
  });

  it("is UNKNOWN when every input is missing", () => {
    expect(deriveCoverage(10, 10)).toBe("UNKNOWN");
  });
});

describe("meetsEligibilityGate (ADR-0155 §6)", () => {
  it("is always eligible when the gate has no minimum", () => {
    expect(meetsEligibilityGate(undefined, {})).toBe(true);
    expect(meetsEligibilityGate(0, {})).toBe(true);
  });

  it("requires at least the configured minimum exposure", () => {
    expect(meetsEligibilityGate(59, { minExposureSeconds: 60 })).toBe(false);
    expect(meetsEligibilityGate(60, { minExposureSeconds: 60 })).toBe(true);
    expect(meetsEligibilityGate(61, { minExposureSeconds: 60 })).toBe(true);
  });

  it("treats missing exposure as zero against a minimum", () => {
    expect(meetsEligibilityGate(undefined, { minExposureSeconds: 60 })).toBe(false);
  });
});
