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

  it("resolves the day boundary against Europe/Oslo, not the runtime's own local timezone (ADR-0137)", () => {
    // 2026-01-15T23:30:00Z is 00:30 CET (UTC+1 in January) on 2026-01-16 in Europe/Oslo -- a
    // genuine day-boundary crossing a naive UTC/runtime-local getter would get wrong. "now" is
    // the same Oslo calendar day (2026-01-16 09:00 CET = 08:00Z), so the match must not be
    // considered passed yet.
    const lateKickoff = new Date("2026-01-15T23:30:00.000Z");
    const sameOsloDay = new Date("2026-01-16T08:00:00.000Z");
    expect(hasLeagueMatchPassed({ startsAt: lateKickoff, status: "SCHEDULED" }, sameOsloDay)).toBe(false);
  });

  it("still correctly marks a match passed once the real Europe/Oslo day has rolled over, even for a historically skewed startsAt (ARR-0044)", () => {
    // A match whose real kickoff was 20:00 Europe/Oslo (CEST, UTC+2) on 2026-09-15 -- correctly
    // 18:00Z -- but was written by ARR-0044's pre-fix buggy server-side path, which stored the
    // raw "20:00" digits as literal UTC (20:00Z) instead of converting from Oslo local time: a
    // +2h skew, still the same Oslo calendar day. The following Oslo morning must still resolve
    // this as passed.
    const skewedStartsAt = new Date("2026-09-15T20:00:00.000Z");
    const nextOsloMorning = new Date("2026-09-16T08:00:00.000Z"); // 10:00 CEST, 2026-09-16
    expect(hasLeagueMatchPassed({ startsAt: skewedStartsAt, status: "SCHEDULED" }, nextOsloMorning)).toBe(true);
  });

  it("uses current Date when now is not provided", () => {
    const pastMatch = { startsAt: new Date("2020-01-01T10:00:00Z"), status: "SCHEDULED" as const };
    expect(hasLeagueMatchPassed(pastMatch)).toBe(true);
  });
});