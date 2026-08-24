import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, screen, fireEvent } from "@testing-library/react";

/**
 * Regression test for the 2026-08-24 score data-integrity bug: `handleEndSession` used to call
 * `actions.endSession` unconditionally after a best-effort `syncUnsyncedEvents()`, even when
 * events genuinely failed to sync (network down, etc). The post-match report is seeded from
 * canonical DB events at that instant, so any event still stuck in local storage was silently
 * dropped from the final score forever. `handleEndSession` must now re-check the local store
 * directly (not stale React state) and refuse to end the session if anything remains unsynced.
 */

const getUnsyncedEventsMock = vi.fn();

vi.mock("@/lib/live-match/local/live-local-store", () => ({
  saveEventLocally: vi.fn().mockResolvedValue(undefined),
  markEventSynced: vi.fn().mockResolvedValue(undefined),
  getUnsyncedEvents: (...args: unknown[]) => getUnsyncedEventsMock(...args),
  getAllLocalEvents: vi.fn().mockResolvedValue([]),
  clearLocalEvents: vi.fn().mockResolvedValue(undefined),
  saveSessionLocally: vi.fn().mockResolvedValue(undefined),
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

describe("LiveMatchClient handleEndSession — unsynced-event guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUnsyncedEventsMock.mockResolvedValue([]);
  });

  it("refuses to end the session when events remain unsynced after the sync attempt, and shows an error instead of losing data", async () => {
    getUnsyncedEventsMock.mockResolvedValue([{ clientEventId: "evt-1" }, { clientEventId: "evt-2" }]);
    const endSession = vi.fn().mockResolvedValue({ success: true, data: {} });
    const actions = makeActions({ endSession });

    render(
      <LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={LEAGUE_PERIOD_CONFIG} actions={actions} />,
    );
    await waitFor(() => expect(actions.getPreMatchPackage).toHaveBeenCalled());

    await openFinishDialogAndConfirm();

    await waitFor(() => expect(getUnsyncedEventsMock).toHaveBeenCalled());
    expect(endSession).not.toHaveBeenCalled();
    expect(await screen.findByText(/2 events could not sync and would be lost/i)).toBeInTheDocument();
  });

  it("ends the session normally once no unsynced events remain", async () => {
    getUnsyncedEventsMock.mockResolvedValue([]);
    const endSession = vi.fn().mockResolvedValue({ success: true, data: {} });
    const actions = makeActions({ endSession });

    render(
      <LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={LEAGUE_PERIOD_CONFIG} actions={actions} />,
    );
    await waitFor(() => expect(actions.getPreMatchPackage).toHaveBeenCalled());

    await openFinishDialogAndConfirm();

    await waitFor(() => expect(endSession).toHaveBeenCalledWith("session-1"));
  });
});
