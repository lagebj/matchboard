import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, screen, fireEvent, within } from "@testing-library/react";

/**
 * Regression test: "Position rotation is not available in Live reporting" (coach feedback,
 * 2026-09-12). POSITIONS_CHANGED was already a valid, consumed LiveMatchEventType (produced
 * server-side when a planned position-only rotation change is applied), but the live-reporting
 * client had no UI to record one manually for an on-field player who changes position without a
 * substitution. This proves the new "Position" action records that event correctly.
 */

vi.mock("@/lib/live-match/local/live-local-store", () => ({
  saveEventLocally: vi.fn().mockResolvedValue(undefined),
  markEventSynced: vi.fn().mockResolvedValue(undefined),
  getUnsyncedEvents: vi.fn().mockResolvedValue([]),
  getAllLocalEvents: vi.fn().mockResolvedValue([]),
  clearLocalEvents: vi.fn().mockResolvedValue(undefined),
  saveSessionLocally: vi.fn().mockResolvedValue(undefined),
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

describe("LiveMatchClient — Position action (manual POSITIONS_CHANGED)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a POSITIONS_CHANGED event for the chosen on-field player and new role", async () => {
    const recordEvent = vi.fn().mockResolvedValue({ success: true, data: {} });
    const actions = makeActions({ recordEvent });

    render(
      <LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={LEAGUE_PERIOD_CONFIG} actions={actions} />,
    );
    await waitFor(() => expect(actions.getPreMatchPackage).toHaveBeenCalled());

    fireEvent.click(await screen.findByText("Position"));
    const playerSheet = await screen.findByRole("dialog", { name: "Who changed position?" });
    fireEvent.click(within(playerSheet).getByText("Alice"));
    const roleSheet = await screen.findByRole("dialog", { name: /New position for Alice/ });
    fireEvent.click(within(roleSheet).getByText("CB"));

    await waitFor(() => expect(recordEvent).toHaveBeenCalled());
    const call = recordEvent.mock.calls.find((c) => c[0].eventType === "POSITIONS_CHANGED");
    expect(call).toBeDefined();
    expect(call![0]).toMatchObject({
      eventType: "POSITIONS_CHANGED",
      playerId: "p1",
      payload: { fromPosition: "CM", toPosition: "CB" },
    });

    // The "On field" overview reflects the new position immediately, without a server round-trip
    // (the sheets are closed by now, so "Alice" only matches the overview chip).
    const aliceChip = (await screen.findByText("Alice")).closest("span");
    expect(aliceChip?.textContent).toContain("CB");
  });

  it("does not record an event when the chosen position matches the player's current position", async () => {
    const recordEvent = vi.fn().mockResolvedValue({ success: true, data: {} });
    const actions = makeActions({ recordEvent });

    render(
      <LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={LEAGUE_PERIOD_CONFIG} actions={actions} />,
    );
    await waitFor(() => expect(actions.getPreMatchPackage).toHaveBeenCalled());

    fireEvent.click(await screen.findByText("Position"));
    const playerSheet = await screen.findByRole("dialog", { name: "Who changed position?" });
    fireEvent.click(within(playerSheet).getByText("Bea"));
    const roleSheet = await screen.findByRole("dialog", { name: /New position for Bea/ });
    fireEvent.click(within(roleSheet).getByText("CB")); // Bea's current position

    const positionsChangedCalls = recordEvent.mock.calls.filter((c) => c[0].eventType === "POSITIONS_CHANGED");
    expect(positionsChangedCalls).toHaveLength(0);
  });
});
