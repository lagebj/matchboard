import { describe, it, expect } from "vitest";
import type { FixturePeriod } from "@/domain/fixtures/types";
import * as midSeason from "../mid-season-current-round/fixtures";
import * as seasonClosed from "../season-closed-no-current-round/fixtures";

/**
 * Independent fixture-integrity reconciliation (E01-R1 remediation). The existing per-state
 * `fixtures.test.ts` files verify that `buildLeagueOperatingViewModel()` classifies these fixtures
 * correctly (CURRENT/NEEDS_CLOSURE/FINAL, cancelled-match exclusion, missing-report handling) —
 * that is not repeated here. This file verifies a different, previously-untested property: that
 * every *manually-authored display label* (period title, period date range, round date label)
 * actually agrees with the real underlying `startDate`/`endDate`/`startsAt` records, so a future
 * edit to a match's kickoff (or a period's boundary) that forgets to update its label is caught
 * mechanically, not by a human re-reading the fixture.
 */

// A fixed 3-letter abbreviation table, not `Intl.DateTimeFormat`'s own "short" month name — ICU's
// en-GB "short" format renders September as the 4-letter "Sept", inconsistent with every other
// month's 3-letter form already used throughout this fixture's own hand-authored labels.
const MONTH_ABBREV = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthAbbrev(iso: string): string {
  return MONTH_ABBREV[new Date(iso).getUTCMonth()];
}

function formatDayMonthYear(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${monthAbbrev(iso)} ${d.getUTCFullYear()}`;
}

function yearOf(iso: string): number {
  return new Date(iso).getUTCFullYear();
}

function expectedPeriodRangeLabel(period: FixturePeriod): string {
  const startYear = yearOf(period.startDate);
  const endYear = yearOf(period.endDate);
  const startMonth = monthAbbrev(period.startDate);
  const endMonth = monthAbbrev(period.endDate);
  return startYear === endYear
    ? `${startMonth} – ${endMonth} ${endYear}`
    : `${startMonth} ${startYear} – ${endMonth} ${endYear}`;
}

function checkPeriodIntegrity(period: FixturePeriod) {
  describe(`fixture-temporal-integrity: ${period.id}`, () => {
    it("period start is before period end", () => {
      expect(new Date(period.startDate).getTime()).toBeLessThan(new Date(period.endDate).getTime());
    });

    it("every scheduled match's kickoff lies within the period's own boundaries", () => {
      const start = new Date(period.startDate).getTime();
      const end = new Date(period.endDate).getTime();
      for (const round of period.rounds) {
        for (const match of round.matches) {
          if (!match.startsAt) continue;
          const t = new Date(match.startsAt).getTime();
          expect(t).toBeGreaterThanOrEqual(start);
          expect(t).toBeLessThanOrEqual(end);
        }
      }
    });

    it("every round's matches share one calendar date, and the round's displayed date label matches it exactly", () => {
      for (const round of period.rounds) {
        const dates = round.matches
          .map((m) => (m.startsAt ? formatDayMonthYear(m.startsAt) : null))
          .filter((d): d is string => d != null);
        if (dates.length === 0) continue;
        const uniqueDates = new Set(dates);
        // This fixture shape assumes one label per round — if a round's matches ever span more
        // than one calendar date, `round.dateRange` can no longer be a single-day label and this
        // assumption itself must be revisited, not silently passed.
        expect(uniqueDates.size).toBe(1);
        expect(round.dateRange).toBe(dates[0]);
      }
    });

    it("rounds appear in chronological order by their own earliest match kickoff", () => {
      const earliestKickoffs = period.rounds
        .map((round) => {
          const times = round.matches
            .map((m) => (m.startsAt ? new Date(m.startsAt).getTime() : null))
            .filter((t): t is number => t != null);
          return times.length > 0 ? Math.min(...times) : null;
        })
        .filter((t): t is number => t != null);
      for (let i = 1; i < earliestKickoffs.length; i++) {
        expect(earliestKickoffs[i]).toBeGreaterThan(earliestKickoffs[i - 1]);
      }
    });

    it("the period's displayed date range accurately describes its actual start/end boundaries", () => {
      expect(period.dateRange).toBe(expectedPeriodRangeLabel(period));
    });

    it("any calendar year named in the period title is consistent with the years its real boundaries fall in", () => {
      const titleYears = [...period.title.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
      if (titleYears.length === 0) return;
      const startYear = yearOf(period.startDate);
      const endYear = yearOf(period.endDate);
      for (const y of titleYears) {
        expect([startYear, endYear]).toContain(y);
      }
    });
  });
}

checkPeriodIntegrity(midSeason.springPeriod);
checkPeriodIntegrity(midSeason.autumnPeriod);
checkPeriodIntegrity(seasonClosed.closedPeriod);

describe("fixture-temporal-integrity: cross-fixture facts", () => {
  it("both E01 fixtures share the identical frozen anchor instant (never Date.now())", () => {
    expect(midSeason.now.toISOString()).toBe(seasonClosed.now.toISOString());
  });

  it("match and round counts match what the documentation claims (DATA_TRUTH_AND_FIXTURES.md)", () => {
    const springMatches = midSeason.springPeriod.rounds.flatMap((r) => r.matches).length;
    const autumnMatches = midSeason.autumnPeriod.rounds.flatMap((r) => r.matches).length;
    expect(midSeason.springPeriod.rounds.length).toBe(6);
    expect(springMatches).toBe(8);
    expect(midSeason.autumnPeriod.rounds.length).toBe(2);
    expect(autumnMatches).toBe(2);
    expect(springMatches + autumnMatches).toBe(10);

    expect(seasonClosed.closedPeriod.rounds.length).toBe(3);
    expect(seasonClosed.closedPeriod.rounds.flatMap((r) => r.matches).length).toBe(3);
  });

  it("cancelled matches never carry a completed result, and missing-report matches never carry a fabricated score", () => {
    const allMatches = [
      ...midSeason.springPeriod.rounds.flatMap((r) => r.matches),
      ...midSeason.autumnPeriod.rounds.flatMap((r) => r.matches),
      ...seasonClosed.closedPeriod.rounds.flatMap((r) => r.matches),
    ];
    for (const match of allMatches) {
      if (match.matchStatus === "CANCELLED") {
        expect(match.reportState.state).not.toBe("COMPLETED");
      }
      if (match.lifecycleStatus === "played") {
        expect(match.reportState.state).toBe("NO_REPORT");
      }
    }
  });
});
