import { describe, it, expect } from "vitest";
import {
  MATCHBOARD_DISPLAY_TIMEZONE,
  formatDateInDisplayTimezone,
  getDisplayIsoWeekKey,
  getDisplayIsoWeekLabel,
} from "@/lib/date-utils";

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

describe("getDisplayIsoWeekKey / getDisplayIsoWeekLabel (League Operating Surface)", () => {
  it("resolves the ISO week from the Europe/Oslo display date, not the instant's own UTC date", () => {
    // 23:30 UTC on 15 Jan 2026 is 00:30 CET on 16 Jan 2026 -- still ISO week 2026-W03.
    const instant = new Date("2026-01-15T23:30:00.000Z");
    expect(getDisplayIsoWeekKey(instant)).toBe("2026-W03");
  });

  it("does not shift a daytime kickoff into a different ISO week", () => {
    const instant = new Date("2026-09-09T15:30:00.000Z");
    expect(getDisplayIsoWeekKey(instant)).toBe("2026-W37");
    expect(getDisplayIsoWeekLabel(instant)).toBe("W37 2026");
  });

  it("handles the ISO week/year rollover at the turn of the year", () => {
    // 31 Dec 2025 is a Wednesday -- ISO week 1 of 2026, not week 53 of 2025.
    const instant = new Date("2025-12-31T10:00:00.000Z");
    expect(getDisplayIsoWeekKey(instant)).toBe("2026-W01");
  });

  it("keeps a late-December date in the year's final ISO week when its Thursday falls in December", () => {
    // 28 Dec 2026 is a Monday; that week's Thursday (31 Dec) is still in 2026, so this is
    // ISO week 2026-W53, not 2027-W01.
    const instant = new Date("2026-12-28T08:00:00.000Z");
    expect(getDisplayIsoWeekKey(instant)).toBe("2026-W53");
  });

  it("crosses the Europe/Oslo DST spring-forward boundary without shifting the ISO week", () => {
    // 2026-03-29 01:30 UTC is 03:30 CEST (DST just started) -- still 29 March, week 2026-W13.
    const instant = new Date("2026-03-29T01:30:00.000Z");
    expect(getDisplayIsoWeekKey(instant)).toBe("2026-W13");
  });
});
