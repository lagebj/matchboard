import { describe, it, expect } from "vitest";
import { resolveSituationContext, MATCHDAY_IMMINENT_MINUTES } from "../resolve-situation-context";

const NOW = "2026-01-01T12:00:00.000Z";

function isoMinutesFromNow(minutes: number): string {
  return new Date(new Date(NOW).getTime() + minutes * 60_000).toISOString();
}

describe("resolveSituationContext", () => {
  it("resolves MATCHDAY when a match has an active live session", () => {
    const context = resolveSituationContext({
      nowIso: NOW,
      matches: [{ matchId: "m1", startsAt: isoMinutesFromNow(-10), hasActiveLiveSession: true }],
    });
    expect(context.primarySituation).toBe("MATCHDAY");
    expect(context.activeMatchId).toBe("m1");
    expect(context.imminentMatchIds).toContain("m1");
  });

  it("resolves MATCHDAY when a match kicks off within the imminent threshold", () => {
    const context = resolveSituationContext({
      nowIso: NOW,
      matches: [{ matchId: "m1", startsAt: isoMinutesFromNow(30), hasActiveLiveSession: false }],
    });
    expect(context.primarySituation).toBe("MATCHDAY");
    expect(context.temporal.nearestKickoffMinutes).toBeCloseTo(30, 5);
  });

  it("does not treat a match just past the imminent threshold as MATCHDAY", () => {
    const context = resolveSituationContext({
      nowIso: NOW,
      matches: [{ matchId: "m1", startsAt: isoMinutesFromNow(MATCHDAY_IMMINENT_MINUTES + 1), hasActiveLiveSession: false }],
    });
    expect(context.primarySituation).toBe("NEXT");
    expect(context.imminentMatchIds).toHaveLength(0);
  });

  it("does not treat a past, non-live match as imminent", () => {
    const context = resolveSituationContext({
      nowIso: NOW,
      matches: [{ matchId: "m1", startsAt: isoMinutesFromNow(-30), hasActiveLiveSession: false }],
    });
    expect(context.primarySituation).toBe("NEXT");
    expect(context.imminentMatchIds).toHaveLength(0);
  });

  it("defaults to NEXT with no matches and no analytical route intent", () => {
    const context = resolveSituationContext({ nowIso: NOW, matches: [] });
    expect(context.primarySituation).toBe("NEXT");
  });

  it("resolves LONG_TERM for an analytical route intent when nothing is imminent", () => {
    const context = resolveSituationContext({ nowIso: NOW, matches: [], routeIntent: "INSIGHTS" });
    expect(context.primarySituation).toBe("LONG_TERM");
  });

  it("MATCHDAY dominates an analytical route intent when a match is imminent", () => {
    const context = resolveSituationContext({
      nowIso: NOW,
      matches: [{ matchId: "m1", startsAt: isoMinutesFromNow(10), hasActiveLiveSession: false }],
      routeIntent: "INSIGHTS",
    });
    expect(context.primarySituation).toBe("MATCHDAY");
  });

  it("resolves LONG_TERM for the OPPONENT route intent when nothing is imminent", () => {
    const context = resolveSituationContext({ nowIso: NOW, matches: [], routeIntent: "OPPONENT" });
    expect(context.primarySituation).toBe("LONG_TERM");
  });

  it("MATCHDAY dominates the OPPONENT route intent when a match is imminent", () => {
    const context = resolveSituationContext({
      nowIso: NOW,
      matches: [{ matchId: "m1", startsAt: isoMinutesFromNow(10), hasActiveLiveSession: false }],
      routeIntent: "OPPONENT",
    });
    expect(context.primarySituation).toBe("MATCHDAY");
  });

  it("computes nearestKickoffMinutes as the minimum across future matches only", () => {
    const context = resolveSituationContext({
      nowIso: NOW,
      matches: [
        { matchId: "past", startsAt: isoMinutesFromNow(-5), hasActiveLiveSession: false },
        { matchId: "near", startsAt: isoMinutesFromNow(45), hasActiveLiveSession: false },
        { matchId: "far", startsAt: isoMinutesFromNow(500), hasActiveLiveSession: false },
      ],
    });
    expect(context.temporal.nearestKickoffMinutes).toBeCloseTo(45, 5);
  });

  it("computes nextRoundDays from nextRoundStartsAt when provided", () => {
    const context = resolveSituationContext({
      nowIso: NOW,
      matches: [],
      nextRoundStartsAt: new Date(new Date(NOW).getTime() + 3 * 24 * 60 * 60_000).toISOString(),
    });
    expect(context.temporal.nextRoundDays).toBeCloseTo(3, 5);
  });

  it("is deterministic for identical inputs", () => {
    const input = {
      nowIso: NOW,
      matches: [{ matchId: "m1", startsAt: isoMinutesFromNow(30), hasActiveLiveSession: false }],
    };
    expect(resolveSituationContext(input)).toEqual(resolveSituationContext(input));
  });
});
