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
  saveCommandLocally: vi.fn().mockResolvedValue(undefined),
  updateCommandStatus: vi.fn().mockResolvedValue(undefined),
  getNextLocalOrdinal: vi.fn().mockResolvedValue(1),
  getAllCommands: vi.fn().mockResolvedValue([]),
  getRetryableCommands: vi.fn().mockResolvedValue([]),
  getUnresolvedCommands: vi.fn().mockResolvedValue([]),
  isActionableForCoach: (c: { status: string; resolvedByCoach?: boolean }) =>
    c.status === "NEEDS_REVIEW" || (c.status === "FAILED_TERMINAL" && !c.resolvedByCoach),
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
  { playerId: "p3", playerName: "Carl", position: null, shirtNumber: 12, role: "CORE", availability: "AVAILABLE", startingOnField: true, slotLabel: null },
];

// Reproduces a real production incident: a substitute's DECLARED position (`Player.primaryPosition`,
// unrelated to what slot they actually entered) must never be treated as "already occupying" a
// target position — see `getConfirmedPosition`'s doc comment in `live-match-client.tsx`.
const SUB_INCIDENT_SQUAD: SquadPlayer[] = [
  { playerId: "anton", playerName: "Anton BB", position: "ST", shirtNumber: 9, role: "CORE", availability: "AVAILABLE", startingOnField: true, slotLabel: "CB" },
  { playerId: "theo", playerName: "Theodor E", position: "FORWARD", shirtNumber: 11, role: "CORE", availability: "AVAILABLE", startingOnField: true, slotLabel: "ST" },
  // Ibro's declared position ("CB") coincidentally matches the position Anton is about to be
  // corrected to below — the exact coincidence that triggered the incident.
  { playerId: "ibro", playerName: "Ibro O", position: "CB", shirtNumber: 5, role: "CORE", availability: "AVAILABLE", startingOnField: false, slotLabel: null },
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

  it("swaps both players when the chosen position is already held by another on-field player", async () => {
    // Regression test: recording only the mover's event would leave the backend state with two
    // players labelled at the target position and nobody at the vacated one. Bea already holds
    // "CB" here, so moving Alice there must also move Bea to Alice's old position ("CM").
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

    await waitFor(() => expect(recordEvent).toHaveBeenCalledTimes(2));
    const positionsChangedCalls = recordEvent.mock.calls.filter((c) => c[0].eventType === "POSITIONS_CHANGED");
    expect(positionsChangedCalls).toHaveLength(2);
    expect(positionsChangedCalls).toEqual(
      expect.arrayContaining([
        [expect.objectContaining({ playerId: "p1", payload: { fromPosition: "CM", toPosition: "CB" } })],
        [expect.objectContaining({ playerId: "p2", payload: { fromPosition: "CB", toPosition: "CM" } })],
      ]),
    );

    // The "On field" overview reflects both new positions immediately, without a server
    // round-trip (the sheets are closed by now, so each name only matches its overview chip).
    const aliceChip = (await screen.findByText("Alice")).closest("span");
    expect(aliceChip?.textContent).toContain("CB");
    const beaChip = (await screen.findByText("Bea")).closest("span");
    expect(beaChip?.textContent).toContain("CM");
  });

  it("moves a single player with no swap when the target position is vacant", async () => {
    const recordEvent = vi.fn().mockResolvedValue({ success: true, data: {} });
    const actions = makeActions({ recordEvent });

    render(
      <LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={LEAGUE_PERIOD_CONFIG} actions={actions} />,
    );
    await waitFor(() => expect(actions.getPreMatchPackage).toHaveBeenCalled());

    fireEvent.click(await screen.findByText("Position"));
    const playerSheet = await screen.findByRole("dialog", { name: "Who changed position?" });
    fireEvent.click(within(playerSheet).getByText("Carl"));
    const roleSheet = await screen.findByRole("dialog", { name: /New position for Carl/ });
    fireEvent.click(within(roleSheet).getByText("ST"));

    await waitFor(() => expect(recordEvent).toHaveBeenCalledTimes(1));
    const positionsChangedCalls = recordEvent.mock.calls.filter((c) => c[0].eventType === "POSITIONS_CHANGED");
    expect(positionsChangedCalls).toHaveLength(1);
    expect(positionsChangedCalls[0][0]).toMatchObject({
      playerId: "p3",
      payload: { fromPosition: null, toPosition: "ST" },
    });
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

  it("does not reassign a just-subbed-on player whose declared position coincidentally matches the target", async () => {
    const recordEvent = vi.fn().mockResolvedValue({ success: true, data: {} });
    const actions = makeActions({
      recordEvent,
      getPreMatchPackage: vi.fn().mockResolvedValue({
        success: true,
        data: { squad: SUB_INCIDENT_SQUAD, activeSession: { id: "session-1", coachId: "coach-1", startedAt: new Date().toISOString() } },
      }),
    });

    render(
      <LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={LEAGUE_PERIOD_CONFIG} actions={actions} />,
    );
    await waitFor(() => expect(actions.getPreMatchPackage).toHaveBeenCalled());

    // Theodor E comes off, Ibro O comes on (Ibro is now on the field but never had any explicit
    // position recorded for him — his true on-field slot is unknown to this client).
    fireEvent.click(await screen.findByText("Rotation"));
    const outSheet = await screen.findByRole("dialog", { name: "Player going off" });
    fireEvent.click(within(outSheet).getByText("Theodor E"));
    const inSheet = await screen.findByRole("dialog", { name: "Replacing: Theodor E" });
    fireEvent.click(within(inSheet).getByText("Ibro O"));
    await waitFor(() => expect(recordEvent).toHaveBeenCalledTimes(2)); // ROTATION_OUT + ROTATION_IN

    // The coach now corrects Anton's position label to "CB" (what he's genuinely been playing
    // since kickoff) — a one-sided correction that must never touch Ibro, who has never played a
    // minute at CB this match and whose declared position ("CB") is coincidental only.
    fireEvent.click(screen.getByText("Position"));
    const playerSheet = await screen.findByRole("dialog", { name: "Who changed position?" });
    fireEvent.click(within(playerSheet).getByText("Anton BB"));
    const roleSheet = await screen.findByRole("dialog", { name: /New position for Anton BB/ });
    fireEvent.click(within(roleSheet).getByText("CB"));

    await waitFor(() => expect(recordEvent).toHaveBeenCalledTimes(3)); // + one single-sided POSITIONS_CHANGED
    const positionsChangedCalls = recordEvent.mock.calls.filter((c) => c[0].eventType === "POSITIONS_CHANGED");
    expect(positionsChangedCalls).toHaveLength(1);
    expect(positionsChangedCalls[0][0]).toMatchObject({
      playerId: "anton",
      payload: { fromPosition: "ST", toPosition: "CB" },
    });
    expect(positionsChangedCalls.some((c) => c[0].playerId === "ibro")).toBe(false);
  });
});
