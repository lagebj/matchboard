import { describe, it, expect } from "vitest";
import { fromConfidenceLevel, fromMeasurementCoverage } from "../evidence-support";

describe("situational/evidence-support — fromConfidenceLevel", () => {
  it("maps INSUFFICIENT to NONE (not enough sample for a pattern claim)", () => {
    expect(fromConfidenceLevel("INSUFFICIENT")).toBe("NONE");
  });

  it("passes EMERGING and ESTABLISHED through unchanged", () => {
    expect(fromConfidenceLevel("EMERGING")).toBe("EMERGING");
    expect(fromConfidenceLevel("ESTABLISHED")).toBe("ESTABLISHED");
  });
});

describe("situational/evidence-support — fromMeasurementCoverage", () => {
  it("passes every ADR-0155 MeasurementCoverage value through unchanged", () => {
    expect(fromMeasurementCoverage("COMPLETE")).toBe("COMPLETE");
    expect(fromMeasurementCoverage("PARTIAL")).toBe("PARTIAL");
    expect(fromMeasurementCoverage("UNKNOWN")).toBe("UNKNOWN");
  });
});
