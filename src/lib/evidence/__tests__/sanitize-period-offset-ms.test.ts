import { describe, it, expect } from "vitest";
import { sanitizePeriodOffsetMs } from "@/lib/evidence/actual-timeline";

// ADR-0133 H3: `matchSeconds` holds MILLISECONDS since period start. A corrupt live-reporting
// session (the 2026-09-09 incident produced period=0 events after an F5 reset) can persist a
// wildly out-of-range value; this clamp keeps one bad event from pushing an interval decades
// into the match.
describe("sanitizePeriodOffsetMs", () => {
  const CAP = 4 * 60 * 60 * 1000;

  it("passes a plausible in-match offset through unchanged", () => {
    expect(sanitizePeriodOffsetMs(0)).toBe(0);
    expect(sanitizePeriodOffsetMs(25 * 60 * 1000)).toBe(25 * 60 * 1000);
  });

  it("treats null / undefined / NaN / negative as 0", () => {
    expect(sanitizePeriodOffsetMs(null)).toBe(0);
    expect(sanitizePeriodOffsetMs(undefined)).toBe(0);
    expect(sanitizePeriodOffsetMs(Number.NaN)).toBe(0);
    expect(sanitizePeriodOffsetMs(-5000)).toBe(0);
  });

  it("clamps an implausibly large value to the 4-hour cap", () => {
    expect(sanitizePeriodOffsetMs(999_999_999)).toBe(CAP); // ~11.5 days
    expect(sanitizePeriodOffsetMs(CAP + 1)).toBe(CAP);
    expect(sanitizePeriodOffsetMs(CAP)).toBe(CAP);
  });
});
