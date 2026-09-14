import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ADR-0138 Bundle 8 — Event parity mirror of `league-live-match-client.test.tsx`'s
 * `createLeagueActions.recordEvent` describe block: `createEventActions` now wires the shared
 * `useLiveRealtime` hook exactly like League does (closing ARR-0046's "Event has zero
 * coordinator involvement" finding), so it must exhibit the identical single-mutation-path
 * discipline. `useLiveRealtime` itself is not re-tested here — its generic connection/
 * reconnection/tryRecordEvent behavior is already covered once, subject-agnostically, in
 * `league-live-match-client.test.tsx`.
 */

const {
  mockStartEventLiveSessionAction,
  mockHeartbeatEventAction,
  mockGetRecentEventEventsAction,
  mockGetEventLiveMatchPreMatchPackageAction,
  mockEndEventLiveSessionAndCreateReportAction,
  mockPersistEventLiveSessionClockAction,
} = vi.hoisted(() => ({
  mockStartEventLiveSessionAction: vi.fn(),
  mockHeartbeatEventAction: vi.fn(),
  mockGetRecentEventEventsAction: vi.fn(),
  mockGetEventLiveMatchPreMatchPackageAction: vi.fn(),
  mockEndEventLiveSessionAndCreateReportAction: vi.fn(),
  mockPersistEventLiveSessionClockAction: vi.fn(),
}));

vi.mock("@/app/(app)/events/[eventId]/event-live-actions", () => ({
  startEventLiveSessionAction: mockStartEventLiveSessionAction,
  heartbeatEventAction: mockHeartbeatEventAction,
  getRecentEventEventsAction: mockGetRecentEventEventsAction,
  getEventLiveMatchPreMatchPackageAction: mockGetEventLiveMatchPreMatchPackageAction,
  persistEventLiveSessionClockAction: mockPersistEventLiveSessionClockAction,
}));

vi.mock("@/app/(app)/events/[eventId]/event-live-report-handoff", () => ({
  endEventLiveSessionAndCreateReportAction: mockEndEventLiveSessionAndCreateReportAction,
}));

import { createEventActions } from "../event-live-match-client";
import type { useLiveRealtime } from "../use-live-realtime";

const RECORD_EVENT_INPUT = {
  matchId: "event-match-1",
  sessionId: "session-1",
  eventType: "GOAL_FOR",
  clientEventId: "client-evt-1",
};

function fakeRealtime(overrides: Partial<ReturnType<typeof useLiveRealtime>> = {}): ReturnType<typeof useLiveRealtime> {
  return {
    ensureConnected: vi.fn(),
    disconnect: vi.fn(),
    reconnectNow: vi.fn(),
    onLiveUpdate: vi.fn(() => () => {}),
    onPersistenceChanged: vi.fn(() => () => {}),
    tryRecordEvent: vi.fn().mockResolvedValue({ result: null }),
    ...overrides,
  };
}

describe("createEventActions.recordEvent (ADR-0138 Bundle 8 — Event coordinator parity)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("succeeds without any HTTP call when realtime confirms persisted", async () => {
    const realtime = fakeRealtime({ tryRecordEvent: vi.fn().mockResolvedValue({ result: { version: 1, persistenceStatus: "persisted" } }) });
    const actions = createEventActions("event-match-1", "event-1", realtime);

    const result = await actions.recordEvent(RECORD_EVENT_INPUT);

    expect(result).toEqual({ success: true, data: { persistenceStatus: "persisted" } });
  });

  it("succeeds without an independent HTTP write when the coordinator accepted the event but persistence is still pending — its own outbox owns durability, not a second writer", async () => {
    const realtime = fakeRealtime({ tryRecordEvent: vi.fn().mockResolvedValue({ result: { version: 1, persistenceStatus: "pending" } }) });
    const actions = createEventActions("event-match-1", "event-1", realtime);

    const result = await actions.recordEvent(RECORD_EVENT_INPUT);

    expect(result).toEqual({ success: true, data: { persistenceStatus: "pending" } });
  });

  it("does not persist through an alternate ordering authority when the coordinator is unavailable (tryRecordEvent resolves { result: null }) — the command is left unsynchronized for local-outbox retry instead (ARR-0046 resolved)", async () => {
    const realtime = fakeRealtime();
    const actions = createEventActions("event-match-1", "event-1", realtime);

    const result = await actions.recordEvent(RECORD_EVENT_INPUT);

    expect(result.success).toBe(false);
  });

  it("propagates a genuine conflict distinctly from a plain unavailability", async () => {
    const realtime = fakeRealtime({
      tryRecordEvent: vi.fn().mockResolvedValue({ result: null, conflict: { code: "PLAYER_ALREADY_OFF_FIELD", message: "Player is already off the field." } }),
    });
    const actions = createEventActions("event-match-1", "event-1", realtime);

    const result = await actions.recordEvent(RECORD_EVENT_INPUT);

    expect(result).toEqual({
      success: false,
      error: "Player is already off the field.",
      conflict: { code: "PLAYER_ALREADY_OFF_FIELD", message: "Player is already off the field." },
    });
  });

  it("startSession connects realtime only after the HTTP session actually starts", async () => {
    const realtime = fakeRealtime();
    mockStartEventLiveSessionAction.mockResolvedValue({ success: true, data: { id: "session-1" } });
    const actions = createEventActions("event-match-1", "event-1", realtime);

    await actions.startSession("event-match-1");

    expect(realtime.ensureConnected).toHaveBeenCalledTimes(1);
  });

  it("startSession does not connect realtime when the HTTP session fails to start", async () => {
    const realtime = fakeRealtime();
    mockStartEventLiveSessionAction.mockResolvedValue({ success: false, error: "boom" });
    const actions = createEventActions("event-match-1", "event-1", realtime);

    await actions.startSession("event-match-1");

    expect(realtime.ensureConnected).not.toHaveBeenCalled();
  });

  it("endSession disconnects realtime regardless of the HTTP result", async () => {
    const realtime = fakeRealtime();
    mockEndEventLiveSessionAndCreateReportAction.mockResolvedValue({ success: false, error: "boom" });
    const actions = createEventActions("event-match-1", "event-1", realtime);

    await actions.endSession("session-1");

    expect(realtime.disconnect).toHaveBeenCalledTimes(1);
  });

  it("exposes onLiveUpdate/reconnectRealtime straight through from the realtime hook", () => {
    const realtime = fakeRealtime();
    const actions = createEventActions("event-match-1", "event-1", realtime);

    expect(actions.onLiveUpdate).toBe(realtime.onLiveUpdate);
    expect(actions.reconnectRealtime).toBe(realtime.reconnectNow);
  });
});

describe("createEventActions.persistClock (ADR-0140 parity with League's ADR-0133 H2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls persistEventLiveSessionClockAction with an ISO startedAt string", async () => {
    mockPersistEventLiveSessionClockAction.mockResolvedValue({ success: true });
    const realtime = fakeRealtime();
    const actions = createEventActions("event-match-1", "event-1", realtime);

    const startedAt = new Date("2026-09-14T10:00:00.000Z");
    await actions.persistClock!("session-1", {
      period: "FIRST_HALF",
      running: true,
      startedAt,
      elapsedBeforeStartMs: 0,
    });

    expect(mockPersistEventLiveSessionClockAction).toHaveBeenCalledWith("session-1", {
      period: "FIRST_HALF",
      running: true,
      startedAt: "2026-09-14T10:00:00.000Z",
      elapsedBeforeStartMs: 0,
    });
  });

  it("serializes a null startedAt (paused clock) as null, not a crash", async () => {
    mockPersistEventLiveSessionClockAction.mockResolvedValue({ success: true });
    const realtime = fakeRealtime();
    const actions = createEventActions("event-match-1", "event-1", realtime);

    await actions.persistClock!("session-1", {
      period: "HALF_TIME",
      running: false,
      startedAt: null,
      elapsedBeforeStartMs: 45 * 60 * 1000,
    });

    expect(mockPersistEventLiveSessionClockAction).toHaveBeenCalledWith("session-1", {
      period: "HALF_TIME",
      running: false,
      startedAt: null,
      elapsedBeforeStartMs: 45 * 60 * 1000,
    });
  });
});

describe("createEventActions.getPreMatchPackage: persisted clock passthrough", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the persisted clock through from the Event pre-match package to the shared LiveMatchActions contract", async () => {
    mockGetEventLiveMatchPreMatchPackageAction.mockResolvedValue({
      success: true,
      data: {
        squad: [],
        activeSession: {
          id: "session-1",
          coachId: "coach-1",
          startedAt: "2026-09-14T10:00:00.000Z",
          clock: { period: "FIRST_HALF", running: true, startedAt: "2026-09-14T10:00:00.000Z", elapsedBeforeStartMs: 0 },
        },
      },
    });
    const realtime = fakeRealtime();
    const actions = createEventActions("event-match-1", "event-1", realtime);

    const result = await actions.getPreMatchPackage("event-match-1");

    expect(result.success).toBe(true);
    expect(result.data?.activeSession?.clock).toEqual({
      period: "FIRST_HALF",
      running: true,
      startedAt: "2026-09-14T10:00:00.000Z",
      elapsedBeforeStartMs: 0,
    });
  });
});
