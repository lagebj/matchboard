import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TodayLiveMatchSummary, TodayLiveNowResult } from "../get-today-live-match-summaries";

const { mockLeague, mockEvent } = vi.hoisted(() => ({
  mockLeague: vi.fn(),
  mockEvent: vi.fn(),
}));

vi.mock("../get-today-live-match-summaries", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getTodayLiveMatchSummaries: mockLeague,
}));

vi.mock("../get-today-event-live-match-summaries", () => ({
  getTodayEventLiveMatchSummaries: mockEvent,
}));

import { getTodayLiveNow } from "../get-today-live-now";

function summary(overrides: Partial<TodayLiveMatchSummary>): TodayLiveMatchSummary {
  return {
    matchId: "m",
    sessionId: "s",
    teamName: "Team",
    opponentName: "Opponent",
    goalsFor: 0,
    goalsAgainst: 0,
    periodLabel: "First half",
    elapsedLabel: "1:00",
    isRunning: true,
    primaryAction: { kind: "END_PERIOD", period: "FIRST_HALF", label: "End first half" },
    startsAtIso: "2026-10-08T16:00:00.000Z",
    kind: "LEAGUE",
    eventId: null,
    ...overrides,
  };
}

const NONE: TodayLiveNowResult = { primary: null, otherLiveCount: 0 };

/**
 * Issue #686 / ADR-0158 slice 3 — comparing each source's own already-best candidate against
 * the other's is mathematically equivalent to re-sorting the full combined set (max of A union B
 * == max of max(A), max(B)), so this never needs each source's full unsorted list.
 */
describe("getTodayLiveNow: League/Event merge", () => {
  beforeEach(() => {
    mockLeague.mockReset();
    mockEvent.mockReset();
  });

  it("returns the League result unchanged when Event has nothing live", async () => {
    const league: TodayLiveNowResult = { primary: summary({ matchId: "league-1" }), otherLiveCount: 2 };
    mockLeague.mockResolvedValue(league);
    mockEvent.mockResolvedValue(NONE);

    const result = await getTodayLiveNow("org-1", [], undefined);
    expect(result).toEqual(league);
  });

  it("returns the Event result unchanged when League has nothing live", async () => {
    const event: TodayLiveNowResult = { primary: summary({ matchId: "event-1", kind: "EVENT", eventId: "ev-1" }), otherLiveCount: 1 };
    mockLeague.mockResolvedValue(NONE);
    mockEvent.mockResolvedValue(event);

    const result = await getTodayLiveNow("org-1", [], undefined);
    expect(result).toEqual(event);
  });

  it("picks the earlier kickoff across sources and sums both otherLiveCounts plus the loser's own primary", async () => {
    mockLeague.mockResolvedValue({
      primary: summary({ matchId: "league-1", startsAtIso: "2026-10-08T17:00:00.000Z" }),
      otherLiveCount: 1,
    });
    mockEvent.mockResolvedValue({
      primary: summary({ matchId: "event-1", kind: "EVENT", eventId: "ev-1", startsAtIso: "2026-10-08T16:00:00.000Z" }),
      otherLiveCount: 0,
    });

    const result = await getTodayLiveNow("org-1", [], undefined);

    expect(result.primary!.matchId).toBe("event-1");
    // event's own otherLiveCount (0) + league's primary demoted to "other" (1) + league's own otherLiveCount (1)
    expect(result.otherLiveCount).toBe(2);
  });

  it("the situational active match wins outright even if the other source's primary started earlier", async () => {
    mockLeague.mockResolvedValue({
      primary: summary({ matchId: "league-1", startsAtIso: "2026-10-08T16:00:00.000Z" }),
      otherLiveCount: 0,
    });
    mockEvent.mockResolvedValue({
      primary: summary({ matchId: "event-1", kind: "EVENT", eventId: "ev-1", startsAtIso: "2026-10-08T15:00:00.000Z" }),
      otherLiveCount: 0,
    });

    const result = await getTodayLiveNow("org-1", [], "league-1");

    expect(result.primary!.matchId).toBe("league-1");
  });
});
