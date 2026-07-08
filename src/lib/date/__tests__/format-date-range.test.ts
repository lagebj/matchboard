import { describe, it, expect } from "vitest";
import { formatDateRange } from "../format-date-range";

function makeDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

describe("formatDateRange", () => {
  it("formats same-month period as Month Year", () => {
    expect(
      formatDateRange(makeDate(2026, 4, 1), makeDate(2026, 4, 30)),
    ).toBe("April 2026");
  });

  it("formats multi-month same-year period as StartMonth\u2013EndMonth Year", () => {
    expect(
      formatDateRange(makeDate(2026, 4, 1), makeDate(2026, 6, 30)),
    ).toBe("April\u2013June 2026");
  });

  it("formats August to October same year", () => {
    expect(
      formatDateRange(makeDate(2026, 8, 1), makeDate(2026, 10, 31)),
    ).toBe("August\u2013October 2026");
  });

  it("formats cross-year period as StartMonth StartYear\u2013EndMonth EndYear", () => {
    expect(
      formatDateRange(makeDate(2026, 12, 1), makeDate(2027, 2, 28)),
    ).toBe("December 2026\u2013February 2027");
  });

  it("uses en dash for multi-month ranges", () => {
    const result = formatDateRange(
      makeDate(2026, 4, 1),
      makeDate(2026, 6, 30),
    );
    expect(result).toContain("\u2013");
    expect(result).not.toContain("--");
  });
});