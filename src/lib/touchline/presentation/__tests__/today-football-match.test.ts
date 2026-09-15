import { describe, expect, it } from "vitest";
import {
  eventMatchToTodayFootballMatch,
  leagueMatchToTodayFootballMatch,
  selectFeaturedTodayFootballMatch,
  type TodayFootballMatch,
} from "@/lib/touchline/presentation/today-football-match";
import type { TodayMatch } from "@/lib/assistant/types";

const orgUrl = (path: string) => `/o/rod${path}`;

function makeLeagueMatch(overrides: Partial<TodayMatch> & Pick<TodayMatch, "matchId">): TodayMatch {
  return {
    matchRoundId: "round-1",
    matchRoundName: "Round 34",
    teamName: "Rød",
    opponent: "Konnerud Blå",
    homeAway: "HOME",
    startsAt: null,
    squadStatus: "finalized",
    hasActiveLiveSession: false,
    reportStatus: null,
    homeScore: null,
    awayScore: null,
    lifecycleStatus: "planning_open",
    ...overrides,
  };
}

function makeFootball(overrides: Partial<TodayFootballMatch> & Pick<TodayFootballMatch, "id">): TodayFootballMatch {
  return {
    source: "LEAGUE",
    containerId: "round-1",
    containerLabel: "Round 34",
    teamOrSquadName: "Rød",
    opponentName: "Konnerud Blå",
    startsAt: null,
    venueLabel: "Home",
    lifecycleStatus: "planning_open",
    hasActiveLiveSession: false,
    reportState: null,
    score: null,
    href: "/o/rod/matches/x",
    liveEntryHref: "/o/rod/matches/x/live",
    ...overrides,
  };
}

describe("leagueMatchToTodayFootballMatch", () => {
  it("adapts a League TodayMatch with re-oriented score", () => {
    const match = makeLeagueMatch({
      matchId: "m1",
      homeAway: "AWAY",
      homeScore: 2,
      awayScore: 5,
      lifecycleStatus: "done",
    });
    const adapted = leagueMatchToTodayFootballMatch(match, orgUrl);
    expect(adapted.score).toEqual({ own: 5, opponent: 2 });
    expect(adapted.venueLabel).toBe("Away");
    expect(adapted.href).toBe("/o/rod/matches/m1");
    expect(adapted.liveEntryHref).toBe("/o/rod/matches/m1/live");
  });
});

describe("eventMatchToTodayFootballMatch", () => {
  it("derives POST_MATCH-family lifecycle from report status", () => {
    const adapted = eventMatchToTodayFootballMatch(
      {
        eventMatchId: "em1",
        eventId: "ev1",
        eventName: "Summer Cup",
        squadName: "Hvit",
        opponentName: "Tofte",
        startsAt: "2026-09-15T10:00:00.000Z",
        status: "SCHEDULED",
        hasActiveLiveSession: false,
        hasLineup: true,
        reportStatus: "LOCKED",
        score: { own: 3, opponent: 1 },
      },
      orgUrl,
      new Date("2026-09-15T12:00:00.000Z"),
    );
    expect(adapted.lifecycleStatus).toBe("done");
    expect(adapted.href).toBe("/o/rod/events/ev1");
    expect(adapted.liveEntryHref).toBe("/o/rod/events/ev1/matches/em1/live");
  });

  it("derives 'played' when kickoff has passed with no report yet", () => {
    const adapted = eventMatchToTodayFootballMatch(
      {
        eventMatchId: "em2",
        eventId: "ev1",
        eventName: "Summer Cup",
        squadName: "Hvit",
        opponentName: "Tofte",
        startsAt: "2026-09-15T08:00:00.000Z",
        status: "SCHEDULED",
        hasActiveLiveSession: false,
        hasLineup: true,
        reportStatus: null,
        score: null,
      },
      orgUrl,
      new Date("2026-09-15T12:00:00.000Z"),
    );
    expect(adapted.lifecycleStatus).toBe("played");
  });
});

describe("selectFeaturedTodayFootballMatch", () => {
  it("returns undefined whenever any candidate is live (owned by Live Now)", () => {
    const result = selectFeaturedTodayFootballMatch([
      makeFootball({ id: "m1", hasActiveLiveSession: true, lifecycleStatus: "live" }),
      makeFootball({ id: "m2", startsAt: "2026-09-15T18:00:00.000Z" }),
    ]);
    expect(result).toBeUndefined();
  });

  it("selects the nearest upcoming same-day match", () => {
    const result = selectFeaturedTodayFootballMatch([
      makeFootball({ id: "later", startsAt: "2026-09-15T20:00:00.000Z" }),
      makeFootball({ id: "sooner", startsAt: "2026-09-15T14:00:00.000Z" }),
    ]);
    expect(result?.id).toBe("sooner");
  });

  it("falls back to the most recent unresolved post-match match when nothing is upcoming", () => {
    const result = selectFeaturedTodayFootballMatch([
      makeFootball({
        id: "earlier",
        startsAt: "2026-09-15T08:00:00.000Z",
        lifecycleStatus: "played",
      }),
      makeFootball({
        id: "later-unresolved",
        startsAt: "2026-09-15T10:00:00.000Z",
        lifecycleStatus: "report_incomplete",
      }),
    ]);
    expect(result?.id).toBe("later-unresolved");
  });

  it("falls back to the most recently completed match as a quiet anchor", () => {
    const result = selectFeaturedTodayFootballMatch([
      makeFootball({ id: "earlier-done", startsAt: "2026-09-15T08:00:00.000Z", lifecycleStatus: "done" }),
      makeFootball({ id: "later-done", startsAt: "2026-09-15T10:00:00.000Z", lifecycleStatus: "done" }),
    ]);
    expect(result?.id).toBe("later-done");
  });

  it("never features a cancelled match unless every same-day match is cancelled", () => {
    const result = selectFeaturedTodayFootballMatch([
      makeFootball({ id: "cancelled", startsAt: "2026-09-15T09:00:00.000Z", lifecycleStatus: "cancelled" }),
      makeFootball({ id: "upcoming", startsAt: "2026-09-15T18:00:00.000Z", lifecycleStatus: "planning_open" }),
    ]);
    expect(result?.id).toBe("upcoming");
  });

  it("features the cancelled match when every same-day match is cancelled", () => {
    const result = selectFeaturedTodayFootballMatch([
      makeFootball({ id: "cancelled-1", startsAt: "2026-09-15T09:00:00.000Z", lifecycleStatus: "cancelled" }),
    ]);
    expect(result?.id).toBe("cancelled-1");
  });

  it("orders League before Event and then by id for equal/missing kickoff times", () => {
    const result = selectFeaturedTodayFootballMatch([
      makeFootball({ id: "z-event", source: "EVENT", startsAt: null }),
      makeFootball({ id: "a-league", source: "LEAGUE", startsAt: null }),
    ]);
    expect(result?.id).toBe("a-league");
  });
});
