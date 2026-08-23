import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/**
 * Stage 5 (SPEC.md §5, §20, §22, §27, §28) — the realtime-primary/HTTP-fallback decision and
 * the reconnect/multi-client wiring built on top of `RealtimeMatchClient` (Stage 1, tested
 * independently in `realtime-client.test.ts`). These tests fake `RealtimeMatchClient` itself
 * so they exercise exactly the new decision logic in this file, not Stage 1's WebSocket
 * plumbing.
 */

const { FakeRealtimeMatchClient, instances } = vi.hoisted(() => {
  const instances: FakeClientInstance[] = [];

  interface FakeClientInstance {
    connectionState: string;
    options: {
      callbackHandlers?: Record<string, (params: unknown) => unknown>;
      onConnectionStateChange?: (state: string) => void;
    };
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    recordEvent: ReturnType<typeof vi.fn>;
    getSnapshot: ReturnType<typeof vi.fn>;
  }

  class FakeRealtimeMatchClient implements FakeClientInstance {
    connectionState = "connected";
    options: FakeClientInstance["options"];
    connect = vi.fn().mockResolvedValue(undefined);
    disconnect = vi.fn();
    recordEvent = vi.fn();
    getSnapshot = vi.fn().mockResolvedValue({ version: 0 });

    constructor(options: FakeClientInstance["options"]) {
      this.options = options;
      instances.push(this);
    }
  }

  return { FakeRealtimeMatchClient, instances };
});

vi.mock("@/lib/live-match/realtime/realtime-client", () => ({ RealtimeMatchClient: FakeRealtimeMatchClient }));
vi.mock("@/lib/live-match/realtime/fetch-ticket", () => ({ fetchRealtimeTicket: vi.fn().mockResolvedValue("fake-ticket") }));

const {
  mockStartLiveSessionAction,
  mockHeartbeatAction,
  mockRecordLiveEventAction,
  mockGetRecentEventsAction,
  mockGetLiveMatchPreMatchPackageAction,
  mockEndLiveSessionAndCreateReportAction,
} = vi.hoisted(() => ({
  mockStartLiveSessionAction: vi.fn(),
  mockHeartbeatAction: vi.fn(),
  mockRecordLiveEventAction: vi.fn(),
  mockGetRecentEventsAction: vi.fn(),
  mockGetLiveMatchPreMatchPackageAction: vi.fn(),
  mockEndLiveSessionAndCreateReportAction: vi.fn(),
}));

vi.mock("@/app/(app)/matches/[matchId]/live/live-actions", () => ({
  startLiveSessionAction: mockStartLiveSessionAction,
  heartbeatAction: mockHeartbeatAction,
  recordLiveEventAction: mockRecordLiveEventAction,
  getRecentEventsAction: mockGetRecentEventsAction,
  getLiveMatchPreMatchPackageAction: mockGetLiveMatchPreMatchPackageAction,
}));

vi.mock("@/app/(app)/matches/[matchId]/live/live-report-handoff", () => ({
  endLiveSessionAndCreateReportAction: mockEndLiveSessionAndCreateReportAction,
}));

import { useLiveRealtime, createLeagueActions } from "../league-live-match-client";

const RECORD_EVENT_INPUT = {
  matchId: "match-1",
  sessionId: "session-1",
  eventType: "GOAL_FOR",
  clientEventId: "client-evt-1",
};

describe("useLiveRealtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    instances.length = 0;
    process.env.NEXT_PUBLIC_LIVE_MATCH_REALTIME_URL = "wss://realtime.test";
  });

  it("does not create a connection when NEXT_PUBLIC_LIVE_MATCH_REALTIME_URL is unset (kill switch, ADR-0086)", () => {
    delete process.env.NEXT_PUBLIC_LIVE_MATCH_REALTIME_URL;
    const { result } = renderHook(() => useLiveRealtime("match-1"));
    act(() => {
      result.current.ensureConnected();
    });
    expect(instances.length).toBe(0);
  });

  it("tryRecordEvent returns null without ever calling the client when nothing is connected", async () => {
    const { result } = renderHook(() => useLiveRealtime("match-1"));
    const outcome = await result.current.tryRecordEvent({ clientEventId: "e1", event: { eventType: "GOAL_FOR" } });
    expect(outcome).toBeNull();
    expect(instances.length).toBe(0);
  });

  it("returns the persisted result and advances the tracked version on success", async () => {
    const { result } = renderHook(() => useLiveRealtime("match-1"));
    act(() => {
      result.current.ensureConnected();
    });
    const client = instances[0];
    client.recordEvent.mockResolvedValueOnce({ version: 1, persistenceStatus: "persisted" });

    const outcome = await result.current.tryRecordEvent({ clientEventId: "e1", event: { eventType: "GOAL_FOR" } });
    expect(outcome).toEqual({ version: 1, persistenceStatus: "persisted" });
    expect(client.recordEvent).toHaveBeenCalledWith({ clientEventId: "e1", baseVersion: 0, event: { eventType: "GOAL_FOR" } });
  });

  it("self-heals baseVersion from a STALE_STATE rejection so the next attempt doesn't repeat it", async () => {
    const { result } = renderHook(() => useLiveRealtime("match-1"));
    act(() => {
      result.current.ensureConnected();
    });
    const client = instances[0];

    client.recordEvent.mockRejectedValueOnce({ code: "STALE_STATE", message: "stale", currentVersion: 7 });
    const first = await result.current.tryRecordEvent({ clientEventId: "e1", event: { eventType: "PERIOD_START" } });
    expect(first).toBeNull();
    expect(client.recordEvent).toHaveBeenNthCalledWith(1, { clientEventId: "e1", baseVersion: 0, event: { eventType: "PERIOD_START" } });

    client.recordEvent.mockResolvedValueOnce({ version: 8, persistenceStatus: "persisted" });
    const second = await result.current.tryRecordEvent({ clientEventId: "e2", event: { eventType: "PERIOD_END" } });
    expect(second).toEqual({ version: 8, persistenceStatus: "persisted" });
    expect(client.recordEvent).toHaveBeenNthCalledWith(2, { clientEventId: "e2", baseVersion: 7, event: { eventType: "PERIOD_END" } });
  });

  it("returns null on a plain rejection with no currentVersion, leaving the tracked version unchanged", async () => {
    const { result } = renderHook(() => useLiveRealtime("match-1"));
    act(() => {
      result.current.ensureConnected();
    });
    const client = instances[0];
    client.recordEvent.mockRejectedValueOnce({ code: "PERSISTENCE_UNAVAILABLE", message: "Not connected." });

    const outcome = await result.current.tryRecordEvent({ clientEventId: "e1", event: { eventType: "GOAL_FOR" } });
    expect(outcome).toBeNull();

    client.recordEvent.mockResolvedValueOnce({ version: 1, persistenceStatus: "persisted" });
    await result.current.tryRecordEvent({ clientEventId: "e2", event: { eventType: "GOAL_FOR" } });
    expect(client.recordEvent).toHaveBeenNthCalledWith(2, { clientEventId: "e2", baseVersion: 0, event: { eventType: "GOAL_FOR" } });
  });

  it("falls through to null (and so to HTTP, via createLeagueActions) on a PROTOCOL_UNSUPPORTED rejection (SPEC.md §31)", async () => {
    const { result } = renderHook(() => useLiveRealtime("match-1"));
    act(() => {
      result.current.ensureConnected();
    });
    const client = instances[0];
    client.recordEvent.mockRejectedValueOnce({ code: "PROTOCOL_UNSUPPORTED", message: "Unsupported protocol version: 2" });

    const outcome = await result.current.tryRecordEvent({ clientEventId: "e1", event: { eventType: "GOAL_FOR" } });
    expect(outcome).toBeNull();
  });

  it("notifies onLiveUpdate subscribers when applyEvent/presenceChanged/sessionEnded broadcasts arrive (SPEC.md §44 scenario 2)", () => {
    const { result } = renderHook(() => useLiveRealtime("match-1"));
    act(() => {
      result.current.ensureConnected();
    });
    const client = instances[0];
    const listener = vi.fn();
    const unsubscribe = result.current.onLiveUpdate(listener);

    client.options.callbackHandlers?.applyEvent?.({
      version: 2,
      event: { id: "evt", clientEventId: "evt", eventType: "GOAL_FOR", createdAt: "now" },
    });
    expect(listener).toHaveBeenCalledTimes(1);

    client.options.callbackHandlers?.presenceChanged?.({ connectedCount: 2 });
    expect(listener).toHaveBeenCalledTimes(2);

    client.options.callbackHandlers?.sessionEnded?.({ version: 2 });
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    client.options.callbackHandlers?.applyEvent?.({
      version: 3,
      event: { id: "evt2", clientEventId: "evt2", eventType: "GOAL_FOR", createdAt: "now" },
    });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("re-derives the tracked version from a getSnapshot response once connected (SPEC.md §27 reconnect step 4)", async () => {
    const { result } = renderHook(() => useLiveRealtime("match-1"));
    act(() => {
      result.current.ensureConnected();
    });
    const client = instances[0];
    client.getSnapshot.mockResolvedValueOnce({ version: 42 });

    await act(async () => {
      client.options.onConnectionStateChange?.("connected");
      await Promise.resolve();
      await Promise.resolve();
    });

    client.recordEvent.mockResolvedValueOnce({ version: 43, persistenceStatus: "persisted" });
    await result.current.tryRecordEvent({ clientEventId: "e1", event: { eventType: "GOAL_FOR" } });
    expect(client.recordEvent).toHaveBeenCalledWith({ clientEventId: "e1", baseVersion: 42, event: { eventType: "GOAL_FOR" } });
  });

  it("reconnectNow reconnects the existing client rather than creating a new one; no-ops if never connected", () => {
    const { result } = renderHook(() => useLiveRealtime("match-1"));

    // No-op before any connection exists.
    expect(() => result.current.reconnectNow()).not.toThrow();
    expect(instances.length).toBe(0);

    act(() => {
      result.current.ensureConnected();
    });
    expect(instances.length).toBe(1);
    result.current.reconnectNow();
    expect(instances[0].connect).toHaveBeenCalledTimes(2);
    expect(instances.length).toBe(1);
  });
});

describe("createLeagueActions.recordEvent (SPEC.md §28 primary/fallback decision)", () => {
  function fakeRealtime(overrides: Partial<ReturnType<typeof useLiveRealtime>> = {}): ReturnType<typeof useLiveRealtime> {
    return {
      ensureConnected: vi.fn(),
      disconnect: vi.fn(),
      reconnectNow: vi.fn(),
      onLiveUpdate: vi.fn(() => () => {}),
      tryRecordEvent: vi.fn().mockResolvedValue(null),
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips the HTTP call entirely when realtime confirms persisted", async () => {
    const realtime = fakeRealtime({ tryRecordEvent: vi.fn().mockResolvedValue({ version: 1, persistenceStatus: "persisted" }) });
    const actions = createLeagueActions("match-1", realtime);

    const result = await actions.recordEvent(RECORD_EVENT_INPUT);

    expect(result).toEqual({ success: true, data: {} });
    expect(mockRecordLiveEventAction).not.toHaveBeenCalled();
  });

  it("falls through to HTTP when realtime accepts but persistence is still pending (self-healing corrective write)", async () => {
    const realtime = fakeRealtime({ tryRecordEvent: vi.fn().mockResolvedValue({ version: 1, persistenceStatus: "pending" }) });
    mockRecordLiveEventAction.mockResolvedValue({ success: true, data: { eventId: "evt-db-1" } });
    const actions = createLeagueActions("match-1", realtime);

    const result = await actions.recordEvent(RECORD_EVENT_INPUT);

    expect(mockRecordLiveEventAction).toHaveBeenCalledWith(RECORD_EVENT_INPUT);
    expect(result).toEqual({ success: true, data: { id: "evt-db-1" } });
  });

  it("falls through to HTTP when realtime is unavailable (tryRecordEvent resolves null) — existing behavior unchanged", async () => {
    const realtime = fakeRealtime();
    mockRecordLiveEventAction.mockResolvedValue({ success: true, data: { eventId: "evt-db-2" } });
    const actions = createLeagueActions("match-1", realtime);

    const result = await actions.recordEvent(RECORD_EVENT_INPUT);

    expect(mockRecordLiveEventAction).toHaveBeenCalledWith(RECORD_EVENT_INPUT);
    expect(result).toEqual({ success: true, data: { id: "evt-db-2" } });
  });

  it("surfaces the HTTP fallback's own failure when both paths fail", async () => {
    const realtime = fakeRealtime();
    mockRecordLiveEventAction.mockResolvedValue({ success: false, error: "Session has ended." });
    const actions = createLeagueActions("match-1", realtime);

    const result = await actions.recordEvent(RECORD_EVENT_INPUT);

    expect(result).toEqual({ success: false, error: "Session has ended." });
  });

  it("startSession connects realtime only after the HTTP session actually starts", async () => {
    const realtime = fakeRealtime();
    mockStartLiveSessionAction.mockResolvedValue({ success: true, data: { id: "session-1" } });
    const actions = createLeagueActions("match-1", realtime);

    await actions.startSession("match-1");

    expect(realtime.ensureConnected).toHaveBeenCalledTimes(1);
  });

  it("startSession does not connect realtime when the HTTP session fails to start", async () => {
    const realtime = fakeRealtime();
    mockStartLiveSessionAction.mockResolvedValue({ success: false, error: "boom" });
    const actions = createLeagueActions("match-1", realtime);

    await actions.startSession("match-1");

    expect(realtime.ensureConnected).not.toHaveBeenCalled();
  });

  it("endSession disconnects realtime regardless of the HTTP result", async () => {
    const realtime = fakeRealtime();
    mockEndLiveSessionAndCreateReportAction.mockResolvedValue({ success: false, error: "boom" });
    const actions = createLeagueActions("match-1", realtime);

    await actions.endSession("session-1");

    expect(realtime.disconnect).toHaveBeenCalledTimes(1);
  });

  it("exposes onLiveUpdate/reconnectRealtime straight through from the realtime hook", () => {
    const realtime = fakeRealtime();
    const actions = createLeagueActions("match-1", realtime);

    expect(actions.onLiveUpdate).toBe(realtime.onLiveUpdate);
    expect(actions.reconnectRealtime).toBe(realtime.reconnectNow);
  });
});
