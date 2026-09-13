import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, screen, fireEvent } from "@testing-library/react";

/**
 * Regression test for the 2026-08-24 score data-integrity bug: `handleEndSession` used to call
 * `actions.endSession` unconditionally after a best-effort `syncUnsyncedEvents()`, even when
 * events genuinely failed to sync (network down, etc). The post-match report is seeded from
 * canonical DB events at that instant, so any event still stuck in local storage was silently
 * dropped from the final score forever. `handleEndSession` must now re-check the local store
 * directly (not stale React state) and refuse to end the session if anything remains unresolved
 * (LOCAL_PENDING/SENDING/ACCEPTED_PENDING_PERSISTENCE — ADR-0138 Bundle 6's outbox state model).
 */

const getAllCommandsMock = vi.fn();

vi.mock("@/lib/live-match/local/live-local-store", () => ({
  saveCommandLocally: vi.fn().mockResolvedValue(undefined),
  updateCommandStatus: vi.fn().mockResolvedValue(undefined),
  getNextLocalOrdinal: vi.fn().mockResolvedValue(1),
  getAllCommands: (...args: unknown[]) => getAllCommandsMock(...args),
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

import { LiveMatchClient, type LiveMatchActions } from "../live-match-client";
import { LEAGUE_PERIOD_CONFIG } from "@/lib/live-match/period-config";

function makeActions(overrides: Partial<LiveMatchActions> = {}): LiveMatchActions {
  return {
    startSession: vi.fn().mockResolvedValue({ success: true, data: { id: "session-1" } }),
    endSession: vi.fn().mockResolvedValue({ success: true, data: {} }),
    heartbeat: vi.fn().mockResolvedValue(undefined),
    recordEvent: vi.fn().mockResolvedValue({ success: true, data: {} }),
    getRecentEvents: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getPreMatchPackage: vi.fn().mockResolvedValue({
      success: true,
      data: { squad: [], activeSession: { id: "session-1", coachId: "coach-1", startedAt: new Date().toISOString() } },
    }),
    ...overrides,
  };
}

async function openFinishDialogAndConfirm() {
  const finishButton = await screen.findByText("Finish live reporting");
  fireEvent.click(finishButton);
  const confirmButton = await screen.findByRole("button", { name: "Confirm" });
  fireEvent.click(confirmButton);
}

describe("LiveMatchClient handleEndSession — unresolved-command guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllCommandsMock.mockResolvedValue([]);
  });

  it("refuses to end the session when commands remain in flight after the sync attempt, and shows an error instead of losing data", async () => {
    getAllCommandsMock.mockResolvedValue([
      { clientEventId: "evt-1", status: "LOCAL_PENDING" },
      { clientEventId: "evt-2", status: "SENDING" },
    ]);
    const endSession = vi.fn().mockResolvedValue({ success: true, data: {} });
    const actions = makeActions({ endSession });

    render(
      <LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={LEAGUE_PERIOD_CONFIG} actions={actions} />,
    );
    await waitFor(() => expect(actions.getPreMatchPackage).toHaveBeenCalled());

    await openFinishDialogAndConfirm();

    await waitFor(() => expect(getAllCommandsMock).toHaveBeenCalled());
    expect(endSession).not.toHaveBeenCalled();
    expect(await screen.findByText(/2 events could not sync and would be lost/i)).toBeInTheDocument();
  });

  it("ends the session normally once no commands remain in flight", async () => {
    getAllCommandsMock.mockResolvedValue([]);
    const endSession = vi.fn().mockResolvedValue({ success: true, data: {} });
    const actions = makeActions({ endSession });

    render(
      <LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={LEAGUE_PERIOD_CONFIG} actions={actions} />,
    );
    await waitFor(() => expect(actions.getPreMatchPackage).toHaveBeenCalled());

    await openFinishDialogAndConfirm();

    await waitFor(() => expect(endSession).toHaveBeenCalledWith("session-1"));
  });

  it("ends the session but does not clear the outbox when a NEEDS_REVIEW/FAILED_TERMINAL command remains (D13 — never silently discard an unresolved command)", async () => {
    getAllCommandsMock.mockResolvedValue([{ clientEventId: "evt-1", status: "FAILED_TERMINAL", terminalReason: "invalid" }]);
    const endSession = vi.fn().mockResolvedValue({ success: true, data: {} });
    const actions = makeActions({ endSession });

    render(
      <LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={LEAGUE_PERIOD_CONFIG} actions={actions} />,
    );
    await waitFor(() => expect(actions.getPreMatchPackage).toHaveBeenCalled());

    await openFinishDialogAndConfirm();

    // A FAILED_TERMINAL command never blocks ending the session (it will never resolve by
    // retrying — blocking forever would trap the coach), but the outbox is not cleared while it
    // remains, so it's not silently discarded.
    await waitFor(() => expect(endSession).toHaveBeenCalledWith("session-1"));
    const { clearPersistedCommands } = await import("@/lib/live-match/local/live-local-store");
    expect(clearPersistedCommands).not.toHaveBeenCalled();
  });
});
