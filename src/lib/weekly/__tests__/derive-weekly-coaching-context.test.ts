import { describe, it, expect } from "vitest";
import { deriveWeeklyContextStatus, getPreviousIsoWeekKey } from "../derive-weekly-coaching-context";

describe("deriveWeeklyContextStatus", () => {
  it("maps PLANNING and PARTIALLY_PLAYED to IN_PROGRESS", () => {
    expect(deriveWeeklyContextStatus("PLANNING")).toBe("IN_PROGRESS");
    expect(deriveWeeklyContextStatus("PARTIALLY_PLAYED")).toBe("IN_PROGRESS");
  });

  it("maps ALL_PLAYED and REPORTING to PROVISIONAL", () => {
    expect(deriveWeeklyContextStatus("ALL_PLAYED")).toBe("PROVISIONAL");
    expect(deriveWeeklyContextStatus("REPORTING")).toBe("PROVISIONAL");
  });

  it("maps COMPLETE to COMPLETE", () => {
    expect(deriveWeeklyContextStatus("COMPLETE")).toBe("COMPLETE");
  });
});

describe("getPreviousIsoWeekKey", () => {
  it("returns the immediately preceding ISO week within the same year", () => {
    expect(getPreviousIsoWeekKey("2026-W10")).toBe("2026-W09");
  });

  it("crosses a year boundary correctly", () => {
    // 2026-W01 starts 2025-12-29 (Monday); the week before is the last ISO week of 2025.
    expect(getPreviousIsoWeekKey("2026-W01")).toBe("2025-W52");
  });

  it("is the inverse of moving one week forward", () => {
    const previous = getPreviousIsoWeekKey("2026-W23");
    expect(getPreviousIsoWeekKey("2026-W24")).toBe("2026-W23");
    expect(previous).toBe("2026-W22");
  });
});
