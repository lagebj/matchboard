import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";

/**
 * Stage 5 (SPEC.md §5 scenario 2, §27) — verifies `LiveMatchClient` itself actually wires up
 * the two new optional `LiveMatchActions` fields, independent of any specific realtime client
 * implementation (`league-live-match-client.test.tsx` covers `useLiveRealtime`/
 * `createLeagueActions` directly). IndexedDB is faked since jsdom has no real IndexedDB.
 */

const { mockGetRetryableCommands, mockUpdateCommandStatus } = vi.hoisted(() => ({
  mockGetRetryableCommands: vi.fn().mockResolvedValue([]),
  mockUpdateCommandStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/live-match/local/live-local-store", () => ({
  saveCommandLocally: vi.fn().mockResolvedValue(undefined),
  updateCommandStatus: mockUpdateCommandStatus,
  getNextLocalOrdinal: vi.fn().mockResolvedValue(1),
  getAllCommands: vi.fn().mockResolvedValue([]),
  getRetryableCommands: mockGetRetryableCommands,
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
    mockGetRetryableCommands.mockResolvedValue([]);
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

  // ADR-0138 (Bundle 4 follow-up fix, generalized in Bundle 6) — a real, reproducible CI
  // regression: recording an action before the realtime WebSocket finishes its initial
  // handshake means the coordinator path fails (not yet connected), and — since Bundle 4
  // removed the HTTP fallback that used to silently cover this race — nothing retried it once
  // the connection actually completed a moment later. `useLiveRealtime`'s own "connected"
  // handler already calls the same `onLiveUpdate` notification used for broadcasts, so this
  // proves that notification now also retries the local outbox (`syncPendingCommands`, Bundle
  // 6's rewrite of what was `syncUnsyncedEvents`).
  it("an onLiveUpdate notification (including the one fired when realtime first connects) retries any pending local commands", async () => {
    let subscribedCallback: (() => void) | undefined;
    const onLiveUpdate = vi.fn((cb: () => void) => {
      subscribedCallback = cb;
      return () => {};
    });
    const recordEvent = vi.fn().mockResolvedValue({ success: true, data: {} });
    const actions = makeActions({ onLiveUpdate, recordEvent });
    mockGetRetryableCommands.mockResolvedValue([
      {
        clientEventId: "evt-1",
        subjectType: "LEAGUE",
        subjectId: "match-1",
        sessionId: "session-1",
        eventType: "GOAL_FOR",
        status: "LOCAL_PENDING",
        localOrdinal: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        attemptCount: 0,
      },
    ]);

    render(<LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={LEAGUE_PERIOD_CONFIG} actions={actions} />);

    await waitFor(() => expect(subscribedCallback).toBeTruthy());
    recordEvent.mockClear();

    await act(async () => {
      subscribedCallback?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ clientEventId: "evt-1" })));
    expect(mockUpdateCommandStatus).toHaveBeenCalledWith("evt-1", "PERSISTED");
  });

  // ADR-0138 Bundle 8 — a genuine coordinator-detected conflict must move the command to
  // NEEDS_REVIEW, never leave it endlessly retrying as LOCAL_PENDING (which would silently hide
  // a real, actionable rejection from the coach forever).
  it("a genuine conflict from recordEvent moves the retried command to NEEDS_REVIEW, carrying the conflictCode", async () => {
    let subscribedCallback: (() => void) | undefined;
    const onLiveUpdate = vi.fn((cb: () => void) => {
      subscribedCallback = cb;
      return () => {};
    });
    const recordEvent = vi.fn().mockResolvedValue({
      success: false,
      error: "Player is already off the field.",
      conflict: { code: "PLAYER_ALREADY_OFF_FIELD", message: "Player is already off the field." },
    });
    const actions = makeActions({ onLiveUpdate, recordEvent });
    mockGetRetryableCommands.mockResolvedValue([
      {
        clientEventId: "evt-1",
        subjectType: "LEAGUE",
        subjectId: "match-1",
        sessionId: "session-1",
        eventType: "ROTATION_OUT",
        status: "LOCAL_PENDING",
        localOrdinal: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        attemptCount: 0,
      },
    ]);

    render(<LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={LEAGUE_PERIOD_CONFIG} actions={actions} />);

    await waitFor(() => expect(subscribedCallback).toBeTruthy());
    recordEvent.mockClear();

    await act(async () => {
      subscribedCallback?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ clientEventId: "evt-1" })));
    expect(mockUpdateCommandStatus).toHaveBeenCalledWith("evt-1", "NEEDS_REVIEW", { conflictCode: "PLAYER_ALREADY_OFF_FIELD" });
    expect(mockUpdateCommandStatus).not.toHaveBeenCalledWith("evt-1", "LOCAL_PENDING");
  });

  // ADR-0138 Bundle 8 (work item 2, "preserve dependent operation groups") — exit test:
  // "independent goals after conflict continue syncing". A later append-safe command (a goal)
  // must still be attempted even though an earlier, non-append-safe command (a rotation) is
  // stuck — while a later NON-append-safe command waits its turn, preserving order for the
  // riskier case.
  it("an independent append-safe command (goal) keeps syncing after an earlier lineup command fails, while a later non-append-safe command waits its turn", async () => {
    let subscribedCallback: (() => void) | undefined;
    const onLiveUpdate = vi.fn((cb: () => void) => {
      subscribedCallback = cb;
      return () => {};
    });
    const recordEvent = vi.fn().mockImplementation(async (input: { clientEventId: string }) => {
      if (input.clientEventId === "rotation-1") {
        return { success: false, error: "conflict", conflict: { code: "PLAYER_ALREADY_OFF_FIELD", message: "conflict" } };
      }
      return { success: true, data: {} };
    });
    const actions = makeActions({ onLiveUpdate, recordEvent });
    const baseCommand = {
      subjectType: "LEAGUE" as const,
      subjectId: "match-1",
      sessionId: "session-1",
      status: "LOCAL_PENDING" as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      attemptCount: 0,
    };
    mockGetRetryableCommands.mockResolvedValue([
      { ...baseCommand, clientEventId: "rotation-1", eventType: "ROTATION_OUT", localOrdinal: 1 },
      { ...baseCommand, clientEventId: "goal-1", eventType: "GOAL_FOR", localOrdinal: 2 },
      { ...baseCommand, clientEventId: "rotation-2", eventType: "ROTATION_IN", localOrdinal: 3 },
    ]);

    render(<LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={LEAGUE_PERIOD_CONFIG} actions={actions} />);

    await waitFor(() => expect(subscribedCallback).toBeTruthy());
    recordEvent.mockClear();

    await act(async () => {
      subscribedCallback?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // The blocked rotation and the independent goal were both attempted...
    await waitFor(() => expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ clientEventId: "rotation-1" })));
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ clientEventId: "goal-1" }));
    // ...but the second, non-append-safe rotation waited behind the first's unresolved conflict.
    expect(recordEvent).not.toHaveBeenCalledWith(expect.objectContaining({ clientEventId: "rotation-2" }));
    expect(mockUpdateCommandStatus).toHaveBeenCalledWith("rotation-1", "NEEDS_REVIEW", { conflictCode: "PLAYER_ALREADY_OFF_FIELD" });
    expect(mockUpdateCommandStatus).toHaveBeenCalledWith("goal-1", "PERSISTED");
  });

  it("calls reconnectRealtime when the browser fires an online event", async () => {
    const reconnectRealtime = vi.fn();
    const actions = makeActions({ reconnectRealtime });

    render(<LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={LEAGUE_PERIOD_CONFIG} actions={actions} />);

    // ADR-0138 Bundle 7 fix — mounting with an already-active session (makeActions' default
    // getPreMatchPackage mock includes one) now also calls reconnectRealtime once on its own,
    // establishing a connection that was previously never attempted for a restored session.
    await waitFor(() => expect(reconnectRealtime).toHaveBeenCalledTimes(1));
    const callsBeforeOnlineEvent = reconnectRealtime.mock.calls.length;

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(reconnectRealtime.mock.calls.length).toBeGreaterThan(callsBeforeOnlineEvent);
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
