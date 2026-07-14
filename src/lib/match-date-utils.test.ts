import { describe, it, expect } from "vitest";
import { hasMatchPassed, hasLeagueMatchPassed } from "./match-date-utils";

describe("hasMatchPassed", () => {
  const now = new Date("2026-07-15T12:00:00Z");

  it("returns false for cancelled matches", () => {
    expect(hasMatchPassed({ startsAt: new Date("2026-07-10T10:00:00Z"), matchDurationMinutes: 20, status: "CANCELLED" }, now)).toBe(false);
  });

  it("returns false when startsAt is null", () => {
    expect(hasMatchPassed({ startsAt: null, matchDurationMinutes: 20 }, now)).toBe(false);
  });

  it("returns false when match has not ended yet (with duration)", () => {
    expect(hasMatchPassed({ startsAt: new Date("2026-07-15T11:30:00Z"), matchDurationMinutes: 60, status: "SCHEDULED" }, now)).toBe(false);
  });

  it("returns true when match has ended (with duration)", () => {
    expect(hasMatchPassed({ startsAt: new Date("2026-07-15T10:00:00Z"), matchDurationMinutes: 20, status: "SCHEDULED" }, now)).toBe(true);
  });

  it("returns false when match is today but no duration (same day)", () => {
    expect(hasMatchPassed({ startsAt: new Date("2026-07-15T10:00:00Z"), matchDurationMinutes: null, status: "SCHEDULED" }, now)).toBe(false);
  });

  it("returns true when match day has passed (no duration)", () => {
    expect(hasMatchPassed({ startsAt: new Date("2026-07-14T10:00:00Z"), matchDurationMinutes: null, status: "SCHEDULED" }, now)).toBe(true);
  });

  it("uses current Date when now is not provided", () => {
    const pastMatch = { startsAt: new Date("2020-01-01T10:00:00Z"), matchDurationMinutes: 20, status: "SCHEDULED" as const };
    expect(hasMatchPassed(pastMatch)).toBe(true);
  });
});

describe("hasLeagueMatchPassed", () => {
  const now = new Date("2026-07-15T08:00:00Z");

  it("returns false for cancelled matches", () => {
    expect(hasLeagueMatchPassed({ startsAt: new Date("2026-07-10T10:00:00Z"), status: "CANCELLED" }, now)).toBe(false);
  });

  it("returns false when startsAt is null", () => {
    expect(hasLeagueMatchPassed({ startsAt: null }, now)).toBe(false);
  });

  it("returns false when match is today (same day)", () => {
    expect(hasLeagueMatchPassed({ startsAt: new Date("2026-07-15T10:00:00Z"), status: "SCHEDULED" }, now)).toBe(false);
  });

  it("returns true when match day has passed", () => {
    expect(hasLeagueMatchPassed({ startsAt: new Date("2026-07-14T10:00:00Z"), status: "SCHEDULED" }, now)).toBe(true);
  });

  it("uses current Date when now is not provided", () => {
    const pastMatch = { startsAt: new Date("2020-01-01T10:00:00Z"), status: "SCHEDULED" as const };
    expect(hasLeagueMatchPassed(pastMatch)).toBe(true);
  });
});