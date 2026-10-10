import { describe, it, expect } from "vitest";
import { formatCoverageValue } from "../coverage";

/**
 * A04 data-truth test #1 (`02_A04_SCOPE_AND_FIXTURE_TRUTH.md`): a fully verified complete capture
 * of zero must show the factual zero; a capture that never happened must show `NOT_RECORDED`/
 * `UNKNOWN` — never both rendered as `0`. Data-truth test #6: an explicit zero is legal only when
 * recorded and verified (`COMPLETE`/`ZERO`), never inferred from an absent value.
 */
describe("formatCoverageValue", () => {
  it("renders a verified ZERO as the factual 0, not a textual absence label", () => {
    expect(formatCoverageValue("ZERO", 0)).toBe("0");
  });

  it("renders COMPLETE with a real value as that value", () => {
    expect(formatCoverageValue("COMPLETE", 4)).toBe("4");
  });

  it("never renders NOT_RECORDED as 0, even if a stray value were passed", () => {
    expect(formatCoverageValue("NOT_RECORDED", 0)).not.toBe("0");
    expect(formatCoverageValue("NOT_RECORDED")).toBe("Not recorded");
  });

  it("never renders UNKNOWN as 0", () => {
    expect(formatCoverageValue("UNKNOWN")).toBe("Unknown");
  });

  it("never renders NOT_APPLICABLE as 0", () => {
    expect(formatCoverageValue("NOT_APPLICABLE")).toBe("Not applicable");
  });

  it("PARTIAL without a value renders the neutral label, not a number", () => {
    expect(formatCoverageValue("PARTIAL")).toBe("Partial");
  });
});
