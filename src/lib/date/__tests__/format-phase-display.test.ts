import { describe, it, expect } from "vitest";
import { formatLeagueSeasonDisplay } from "../format-phase-display";

function makeDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

describe("formatLeagueSeasonDisplay", () => {
  it("renders Spring 2026 with short date range", () => {
    const result = formatLeagueSeasonDisplay({
      seasonName: "Demo Season",
      leagueSeasonName: "Spring 2026",
      startDate: makeDate(2026, 4, 1),
      endDate: makeDate(2026, 6, 30),
    });
    expect(result.seasonLabel).toBe("2026 Season");
    expect(result.leagueSeasonLabel).toBe("Spring 2026");
    expect(result.dateRangeLabel).toBe("Apr\u2013Jun");
    expect(result.combinedLabel).toBe("Spring 2026 \u00B7 Apr\u2013Jun");
  });

  it("renders Autumn 2026 with short date range", () => {
    const result = formatLeagueSeasonDisplay({
      seasonName: "Demo Season",
      leagueSeasonName: "Autumn 2026",
      startDate: makeDate(2026, 8, 1),
      endDate: makeDate(2026, 10, 31),
    });
    expect(result.seasonLabel).toBe("2026 Season");
    expect(result.leagueSeasonLabel).toBe("Autumn 2026");
    expect(result.dateRangeLabel).toBe("Aug\u2013Oct");
    expect(result.combinedLabel).toBe("Autumn 2026 \u00B7 Aug\u2013Oct");
  });

  it("falls back to date range for misleading single-month name", () => {
    const result = formatLeagueSeasonDisplay({
      seasonName: "Demo Season",
      leagueSeasonName: "April 2026",
      startDate: makeDate(2026, 4, 1),
      endDate: makeDate(2026, 6, 30),
    });
    expect(result.seasonLabel).toBe("2026 Season");
    expect(result.leagueSeasonLabel).toBe("April\u2013June 2026");
    expect(result.combinedLabel).toBe("April\u2013June 2026");
  });

  it("handles null league season name with date-range fallback", () => {
    const result = formatLeagueSeasonDisplay({
      seasonName: "Demo Season",
      leagueSeasonName: null,
      startDate: makeDate(2026, 4, 1),
      endDate: makeDate(2026, 6, 30),
    });
    expect(result.leagueSeasonLabel).toBe("April\u2013June 2026");
    expect(result.combinedLabel).toBe("April\u2013June 2026");
  });

  it("handles single-month league season", () => {
    const result = formatLeagueSeasonDisplay({
      seasonName: "Demo Season",
      leagueSeasonName: "Spring 2026",
      startDate: makeDate(2026, 4, 1),
      endDate: makeDate(2026, 4, 30),
    });
    expect(result.dateRangeLabel).toBe("Apr");
    expect(result.combinedLabel).toBe("Spring 2026 \u00B7 Apr");
  });

  it("handles cross-year league season", () => {
    const result = formatLeagueSeasonDisplay({
      seasonName: "Demo Season",
      leagueSeasonName: "Winter 2026\u20132027",
      startDate: makeDate(2026, 12, 1),
      endDate: makeDate(2027, 2, 28),
    });
    expect(result.leagueSeasonLabel).toBe("Winter 2026\u20132027");
    expect(result.dateRangeLabel).toBe("Dec\u2013Feb");
    expect(result.combinedLabel).toBe("Winter 2026\u20132027 \u00B7 Dec\u2013Feb");
  });

  it("extracts season year from season name", () => {
    const result = formatLeagueSeasonDisplay({
      seasonName: "2026 Season",
      leagueSeasonName: "Spring 2026",
      startDate: makeDate(2026, 4, 1),
      endDate: makeDate(2026, 6, 30),
    });
    expect(result.seasonLabel).toBe("2026 Season");
  });

  it("uses start year as fallback when season name has no year", () => {
    const result = formatLeagueSeasonDisplay({
      seasonName: "Demo",
      leagueSeasonName: "Spring 2026",
      startDate: makeDate(2026, 4, 1),
      endDate: makeDate(2026, 6, 30),
    });
    expect(result.seasonLabel).toBe("2026 Season");
  });
});