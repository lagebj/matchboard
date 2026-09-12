import { describe, it, expect } from "vitest";
import { resolveFeaturedUpcomingMatch, todayMatchPresentation } from "../today-match-presentation";
import type { TodayMatch } from "@/lib/assistant/types";

function makeTodayMatch(overrides: Partial<TodayMatch> & Pick<TodayMatch, "matchId">): TodayMatch {
  return {
    matchRoundId: "round-1",
    matchRoundName: "Round 1",
    teamName: "Blue",
    opponent: "Red",
    homeAway: "HOME",
    startsAt: null,
    squadStatus: "finalized",
    hasActiveLiveSession: false,
    reportStatus: null,
    homeScore: null,
    awayScore: null,
    lifecycleStatus: "planning_closed",
    ...overrides,
  };
}

describe("resolveFeaturedUpcomingMatch", () => {
  it("returns undefined for an empty list", () => {
    expect(resolveFeaturedUpcomingMatch([])).toBeUndefined();
  });

  it("picks the soonest still-open match, ignoring live/played/done ones", () => {
    const matches = [
      makeTodayMatch({ matchId: "played", lifecycleStatus: "done", startsAt: "2026-01-01T10:00:00Z" }),
      makeTodayMatch({ matchId: "later", lifecycleStatus: "planning_open", startsAt: "2026-01-03T10:00:00Z" }),
      makeTodayMatch({ matchId: "soonest", lifecycleStatus: "planning_open", startsAt: "2026-01-02T10:00:00Z" }),
    ];
    expect(resolveFeaturedUpcomingMatch(matches)?.matchId).toBe("soonest");
  });

  it("includes planning_closed as still-upcoming", () => {
    const matches = [makeTodayMatch({ matchId: "m1", lifecycleStatus: "planning_closed", startsAt: "2026-01-02T10:00:00Z" })];
    expect(resolveFeaturedUpcomingMatch(matches)?.matchId).toBe("m1");
  });

  it("never picks a live/played/report_incomplete/done match", () => {
    const matches = [
      makeTodayMatch({ matchId: "live", lifecycleStatus: "live", startsAt: "2026-01-01T10:00:00Z" }),
      makeTodayMatch({ matchId: "played", lifecycleStatus: "played", startsAt: "2026-01-01T09:00:00Z" }),
    ];
    expect(resolveFeaturedUpcomingMatch(matches)).toBeUndefined();
  });

  it("treats a match with no startsAt as furthest out (sorts last), not soonest", () => {
    const matches = [
      makeTodayMatch({ matchId: "no-date", lifecycleStatus: "planning_open", startsAt: null }),
      makeTodayMatch({ matchId: "dated", lifecycleStatus: "planning_open", startsAt: "2026-01-02T10:00:00Z" }),
    ];
    expect(resolveFeaturedUpcomingMatch(matches)?.matchId).toBe("dated");
  });
});

describe("todayMatchPresentation", () => {
  it("re-orients home/away scores to own-team-relative", () => {
    const match = makeTodayMatch({
      matchId: "m1",
      homeAway: "AWAY",
      homeScore: 2,
      awayScore: 3,
      lifecycleStatus: "done",
    });
    const presentation = todayMatchPresentation(match, "/matches/m1");
    // Away team (own team) scored 3, conceded 2 -> a win.
    expect(presentation.resultOutcomeForOwnTeam).toBe("win");
  });

  it("leaves score null when no report score exists yet", () => {
    const match = makeTodayMatch({ matchId: "m1", homeScore: null, awayScore: null });
    const presentation = todayMatchPresentation(match, "/matches/m1");
    expect(presentation.score).toBeNull();
  });
});
