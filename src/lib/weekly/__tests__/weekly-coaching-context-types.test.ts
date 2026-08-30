import { describe, it, expect } from "vitest";
import { isWeeklyCoachingContextEmpty, type WeeklyCoachingContext } from "../weekly-coaching-context-types";

function emptyBase(): WeeklyCoachingContext {
  return {
    weekKey: "2026-W10",
    weekLabel: "W10 2026",
    startsAt: "2026-03-02T00:00:00.000Z",
    endsAt: "2026-03-08T23:59:59.999Z",
    status: "IN_PROGRESS",
    leagueSeasonId: "season-1",
    activity: { leagueMatches: [], eventMatches: [] },
    opportunity: { availableWithoutPlannedLeagueOpportunityPlayerIds: [] },
    noRecordedAppearance: null,
    planActual: { plannedButAbsent: [], unplannedAppearances: [] },
    movement: { supportAppearances: [] },
    reporting: { incompleteLeagueMatchIds: [], incompleteEventMatchIds: [] },
  };
}

describe("isWeeklyCoachingContextEmpty", () => {
  it("is true for a context with no activity and no facts", () => {
    expect(isWeeklyCoachingContextEmpty(emptyBase())).toBe(true);
  });

  it("is true when noRecordedAppearance is present but has zero player ids", () => {
    const context = emptyBase();
    context.noRecordedAppearance = { playerIds: [] };
    expect(isWeeklyCoachingContextEmpty(context)).toBe(true);
  });

  it("is false when there is league match activity", () => {
    const context = emptyBase();
    context.activity.leagueMatches.push({
      matchId: "m1",
      source: "LEAGUE",
      startsAt: "2026-03-03T18:00:00.000Z",
      isCancelled: false,
      isReportComplete: false,
      hasReport: false,
    });
    expect(isWeeklyCoachingContextEmpty(context)).toBe(false);
  });

  it("is false when an opportunity gap exists", () => {
    const context = emptyBase();
    context.opportunity.availableWithoutPlannedLeagueOpportunityPlayerIds.push("player-1");
    expect(isWeeklyCoachingContextEmpty(context)).toBe(false);
  });

  it("is false when noRecordedAppearance has player ids", () => {
    const context = emptyBase();
    context.noRecordedAppearance = { playerIds: ["player-1"] };
    expect(isWeeklyCoachingContextEmpty(context)).toBe(false);
  });

  it("is false when there is an incomplete report", () => {
    const context = emptyBase();
    context.reporting.incompleteLeagueMatchIds.push("m1");
    expect(isWeeklyCoachingContextEmpty(context)).toBe(false);
  });
});
