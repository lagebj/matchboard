import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";

/**
 * Stage 5 (SPEC.md §5 scenario 2, §27) — verifies `LiveMatchClient` itself actually wires up
 * the two new optional `LiveMatchActions` fields, independent of any specific realtime client
 * implementation (`league-live-match-client.test.tsx` covers `useLiveRealtime`/
 * `createLeagueActions` directly). IndexedDB is faked since jsdom has no real IndexedDB.
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

describe("LiveMatchClient realtime wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("subscribes to onLiveUpdate once a session is active, and unsubscribes on unmount", async () => {
    const unsubscribe = vi.fn();
    const onLiveUpdate = vi.fn().mockReturnValue(unsubscribe);
    const actions = makeActions({ onLiveUpdate });

    const { unmount } = render(
      <LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={LEAGUE_PERIOD_CONFIG} actions={actions} />,
    );

    await waitFor(() => expect(onLiveUpdate).toHaveBeenCalledTimes(1));
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("an onLiveUpdate broadcast triggers an immediate getRecentEvents refresh, not just the 5s poll", async () => {
    let subscribedCallback: (() => void) | undefined;
    const onLiveUpdate = vi.fn((cb: () => void) => {
      subscribedCallback = cb;
      return () => {};
    });
    const getRecentEvents = vi.fn().mockResolvedValue({ success: true, data: [] });
    const actions = makeActions({ onLiveUpdate, getRecentEvents });

    render(<LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={LEAGUE_PERIOD_CONFIG} actions={actions} />);

    await waitFor(() => expect(subscribedCallback).toBeTruthy());
    const callsBeforeBroadcast = getRecentEvents.mock.calls.length;

    await act(async () => {
      subscribedCallback?.();
      await Promise.resolve();
    });

    expect(getRecentEvents.mock.calls.length).toBeGreaterThan(callsBeforeBroadcast);
  });

  it("calls reconnectRealtime when the browser fires an online event", async () => {
    const reconnectRealtime = vi.fn();
    const actions = makeActions({ reconnectRealtime });

    render(<LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={LEAGUE_PERIOD_CONFIG} actions={actions} />);

    await waitFor(() => expect(actions.getPreMatchPackage).toHaveBeenCalled());

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(reconnectRealtime).toHaveBeenCalledTimes(1);
  });

  it("does not throw when onLiveUpdate/reconnectRealtime are absent (non-League clients)", async () => {
    const actions = makeActions({ onLiveUpdate: undefined, reconnectRealtime: undefined });

    expect(() =>
      render(<LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={LEAGUE_PERIOD_CONFIG} actions={actions} />),
    ).not.toThrow();

    await waitFor(() => expect(actions.getPreMatchPackage).toHaveBeenCalled());
    expect(() => window.dispatchEvent(new Event("online"))).not.toThrow();
  });
});
