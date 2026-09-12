import { describe, it, expect } from "vitest";
import { MATCHBOARD_DISPLAY_TIMEZONE, formatDateInDisplayTimezone } from "@/lib/date-utils";

describe("formatDateInDisplayTimezone (ADR-0137)", () => {
  it("uses Europe/Oslo, not the runtime's own local timezone", () => {
    expect(MATCHBOARD_DISPLAY_TIMEZONE).toBe("Europe/Oslo");
  });

  it("resolves the calendar date against Europe/Oslo, deterministically regardless of the test runner's own timezone", () => {
    // 23:30 UTC on 15 Jan 2026 is 00:30 CET (UTC+1 in January) on 16 Jan 2026 -- a genuine
    // day-boundary crossing that a naive UTC-local formatter would get wrong. This proves the
    // function is actually timezone-aware, not merely coincidentally correct wherever it runs.
    const instant = new Date("2026-01-15T23:30:00.000Z");
    expect(formatDateInDisplayTimezone(instant)).toBe("Friday, 16 January 2026");
  });

  it("does not shift a daytime kickoff onto a different calendar day", () => {
    // 15:30 UTC on 9 Sep 2026 is 17:30 CEST (UTC+2 in September) -- still 9 September.
    const instant = new Date("2026-09-09T15:30:00.000Z");
    expect(formatDateInDisplayTimezone(instant)).toBe("Wednesday, 9 September 2026");
  });
});
