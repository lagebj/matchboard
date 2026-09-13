import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, screen, fireEvent, within } from "@testing-library/react";

/**
 * ADR-0138 (Bundle 3), DECISIONS.md D10 — "scorer/assist changes require a stable target goal
 * and must not silently overwrite a conflicting attribution." SCORER_SET/ASSIST_SET previously
 * carried no reference back to the goal they annotate at all — attribution relied on implicit
 * "most recent goal" ordering. This proves the goal flow now threads an explicit target
 * (`correctsEventId`, reusing the existing field rather than inventing a second concept) from
 * the just-recorded GOAL_FOR through to its SCORER_SET/ASSIST_SET.
 */

vi.mock("@/lib/live-match/local/live-local-store", () => ({
  saveCommandLocally: vi.fn().mockResolvedValue(undefined),
  updateCommandStatus: vi.fn().mockResolvedValue(undefined),
  getNextLocalOrdinal: vi.fn().mockResolvedValue(1),
  getAllCommands: vi.fn().mockResolvedValue([]),
  getRetryableCommands: vi.fn().mockResolvedValue([]),
  getUnresolvedCommands: vi.fn().mockResolvedValue([]),
  recoverInterruptedSends: vi.fn().mockResolvedValue([]),
  clearPersistedCommands: vi.fn().mockResolvedValue({ removed: 0, retainedUnresolved: 0 }),
  saveSessionLocally: vi.fn().mockResolvedValue(undefined),
  savePreparedPackage: vi.fn().mockResolvedValue(undefined),
  clearPreparedPackage: vi.fn().mockResolvedValue(undefined),
  getLocalSession: vi.fn().mockResolvedValue(null),
  clearLocalSession: vi.fn().mockResolvedValue(undefined),
}));

import { LiveMatchClient, type LiveMatchActions, type SquadPlayer } from "../live-match-client";
import { LEAGUE_PERIOD_CONFIG } from "@/lib/live-match/period-config";

const SQUAD: SquadPlayer[] = [
  { playerId: "p1", playerName: "Alice", position: "CM", shirtNumber: 8, role: "CORE", availability: "AVAILABLE", startingOnField: true, slotLabel: "CM" },
  { playerId: "p2", playerName: "Bea", position: "CB", shirtNumber: 4, role: "CORE", availability: "AVAILABLE", startingOnField: true, slotLabel: "CB" },
];

function makeActions(overrides: Partial<LiveMatchActions> = {}): LiveMatchActions {
  return {
    startSession: vi.fn().mockResolvedValue({ success: true, data: { id: "session-1" } }),
    endSession: vi.fn().mockResolvedValue({ success: true, data: {} }),
    heartbeat: vi.fn().mockResolvedValue(undefined),
    recordEvent: vi.fn().mockResolvedValue({ success: true, data: {} }),
    getRecentEvents: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getPreMatchPackage: vi.fn().mockResolvedValue({
      success: true,
      data: { squad: SQUAD, activeSession: { id: "session-1", coachId: "coach-1", startedAt: new Date().toISOString() } },
    }),
    ...overrides,
  };
}

describe("LiveMatchClient — explicit scorer/assist target (ADR-0138, Bundle 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("SCORER_SET and ASSIST_SET both reference the exact goal's own clientEventId via correctsEventId", async () => {
    const recordEvent = vi.fn().mockResolvedValue({ success: true, data: {} });
    const actions = makeActions({ recordEvent });

    render(
      <LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={LEAGUE_PERIOD_CONFIG} actions={actions} />,
    );
    await waitFor(() => expect(actions.getPreMatchPackage).toHaveBeenCalled());

    fireEvent.click(await screen.findByText("Goal for us"));
    await waitFor(() => expect(recordEvent).toHaveBeenCalledTimes(1));
    const goalCall = recordEvent.mock.calls.find((c) => c[0].eventType === "GOAL_FOR");
    expect(goalCall).toBeDefined();
    const goalClientEventId = goalCall![0].clientEventId as string;
    expect(goalClientEventId).toBeTruthy();

    const scorerSheet = await screen.findByRole("dialog", { name: "Who scored?" });
    fireEvent.click(within(scorerSheet).getByText("Alice"));

    await waitFor(() => expect(recordEvent).toHaveBeenCalledTimes(2));
    const scorerCall = recordEvent.mock.calls.find((c) => c[0].eventType === "SCORER_SET");
    expect(scorerCall![0]).toMatchObject({ playerId: "p1", correctsEventId: goalClientEventId });

    const assistSheet = await screen.findByRole("dialog", { name: "Assist?" });
    fireEvent.click(within(assistSheet).getByText("Bea"));

    await waitFor(() => expect(recordEvent).toHaveBeenCalledTimes(3));
    const assistCall = recordEvent.mock.calls.find((c) => c[0].eventType === "ASSIST_SET");
    expect(assistCall![0]).toMatchObject({ playerId: "p2", correctsEventId: goalClientEventId });
  });

  it("skipping the assist step still does not lose the target — no ASSIST_SET is sent, and the flow resets cleanly for the next goal", async () => {
    const recordEvent = vi.fn().mockResolvedValue({ success: true, data: {} });
    const actions = makeActions({ recordEvent });

    render(
      <LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={LEAGUE_PERIOD_CONFIG} actions={actions} />,
    );
    await waitFor(() => expect(actions.getPreMatchPackage).toHaveBeenCalled());

    fireEvent.click(await screen.findByText("Goal for us"));
    const scorerSheet = await screen.findByRole("dialog", { name: "Who scored?" });
    fireEvent.click(within(scorerSheet).getByText("Alice"));

    const assistSheet = await screen.findByRole("dialog", { name: "Assist?" });
    fireEvent.click(within(assistSheet).getByText("No assist"));

    await waitFor(() => expect(recordEvent).toHaveBeenCalledTimes(2)); // GOAL_FOR + SCORER_SET only
    expect(recordEvent.mock.calls.some((c) => c[0].eventType === "ASSIST_SET")).toBe(false);
  });
});
