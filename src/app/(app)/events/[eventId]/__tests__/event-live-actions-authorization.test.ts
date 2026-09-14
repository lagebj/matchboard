import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthorizationError } from "@/lib/auth";
import { mockAuthContext } from "@/test/support/auth-mock";

/**
 * ADR-0140 authorization regression coverage for Event live-reporting mutation boundaries
 * (ARR-0048): report-mode mutation requires organisation mutation authority AND `GROUP_COACH`
 * authority on the Event's `footballGroupId` for non-admin users. This exercises the wiring in
 * `event-live-actions.ts` — the underlying group-role decision itself
 * (`requireGroupMutationRoleFromContext`) is unit-tested directly in `actor-context.test.ts`.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { mockDb, mockStartEventLiveSession, mockHeartbeatEventSession, mockPersistEventLiveSessionClock } = vi.hoisted(() => ({
  mockDb: {
    eventMatch: { findFirst: vi.fn() },
    eventLiveMatchSession: { findFirst: vi.fn() },
  },
  mockStartEventLiveSession: vi.fn(),
  mockHeartbeatEventSession: vi.fn(),
  mockPersistEventLiveSessionClock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/live-match/event-live-match-session", () => ({
  startEventLiveSession: mockStartEventLiveSession,
  endEventLiveSession: vi.fn(),
  getEventActiveSession: vi.fn(),
  heartbeatEventSession: mockHeartbeatEventSession,
  persistEventLiveSessionClock: mockPersistEventLiveSessionClock,
}));

vi.mock("@/lib/live-match/event-live-match-event-store", () => ({
  getEventMatchEvents: vi.fn(),
  getRecentEventEvents: vi.fn(),
}));

vi.mock("@/lib/events/event-match-availability", () => ({
  getUnavailableParticipantIdsForMatch: vi.fn().mockResolvedValue(new Set()),
}));

const GROUP_ID = "group-1";

function denyGroupMutation(auth: ReturnType<typeof mockAuthContext>) {
  (auth.mockRequireGroupMutationRoleFromContext as ReturnType<typeof vi.fn>).mockImplementation(() => {
    throw new AuthorizationError("You have view-only access to this group and cannot report on it.");
  });
}

describe("Event live actions: report-mode group mutation authorization (ADR-0140 / ARR-0048)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.eventMatch.findFirst.mockResolvedValue({ eventId: "event-1", event: { footballGroupId: GROUP_ID } });
    mockDb.eventLiveMatchSession.findFirst.mockResolvedValue({
      id: "session-1",
      eventMatchId: "event-match-1",
      eventMatch: { event: { footballGroupId: GROUP_ID } },
    });
    mockStartEventLiveSession.mockResolvedValue({ id: "session-1", eventMatchId: "event-match-1" });
  });

  it("COACH with GROUP_COACH access can start an Event live session", async () => {
    const auth = mockAuthContext({ role: "COACH", groupAccesses: [{ footballGroupId: GROUP_ID, role: "GROUP_COACH" }] });
    const { startEventLiveSessionAction } = await import("../event-live-actions");
    const result = await startEventLiveSessionAction("event-match-1");
    expect(result.success).toBe(true);
    expect(auth.mockRequireGroupMutationRoleFromContext).toHaveBeenCalledWith(expect.anything(), GROUP_ID);
  });

  it("COACH with only GROUP_VIEWER access cannot start an Event live session", async () => {
    const auth = mockAuthContext({ role: "COACH", groupAccesses: [{ footballGroupId: GROUP_ID, role: "GROUP_VIEWER" }] });
    denyGroupMutation(auth);
    const { startEventLiveSessionAction } = await import("../event-live-actions");
    const result = await startEventLiveSessionAction("event-match-1");
    expect(result.success).toBe(false);
    expect(mockStartEventLiveSession).not.toHaveBeenCalled();
  });

  it("COACH with no group access cannot start an Event live session", async () => {
    const auth = mockAuthContext({ role: "COACH", groupAccesses: [] });
    denyGroupMutation(auth);
    const { startEventLiveSessionAction } = await import("../event-live-actions");
    const result = await startEventLiveSessionAction("event-match-1");
    expect(result.success).toBe(false);
  });

  it("OWNER retains the administrative bypass for starting an Event live session", async () => {
    mockAuthContext({ role: "OWNER" });
    const { startEventLiveSessionAction } = await import("../event-live-actions");
    const result = await startEventLiveSessionAction("event-match-1");
    expect(result.success).toBe(true);
  });

  it("ADMIN retains the administrative bypass for starting an Event live session", async () => {
    mockAuthContext({ role: "ADMIN" });
    const { startEventLiveSessionAction } = await import("../event-live-actions");
    const result = await startEventLiveSessionAction("event-match-1");
    expect(result.success).toBe(true);
  });

  it("COACH with only GROUP_VIEWER access cannot heartbeat an Event live session", async () => {
    const auth = mockAuthContext({ role: "COACH", groupAccesses: [{ footballGroupId: GROUP_ID, role: "GROUP_VIEWER" }] });
    denyGroupMutation(auth);
    const { heartbeatEventAction } = await import("../event-live-actions");
    const result = await heartbeatEventAction("session-1");
    expect(result.success).toBe(false);
    expect(mockHeartbeatEventSession).not.toHaveBeenCalled();
  });

  it("COACH with GROUP_COACH access can heartbeat an Event live session", async () => {
    mockAuthContext({ role: "COACH", groupAccesses: [{ footballGroupId: GROUP_ID, role: "GROUP_COACH" }] });
    const { heartbeatEventAction } = await import("../event-live-actions");
    const result = await heartbeatEventAction("session-1");
    expect(result.success).toBe(true);
    expect(mockHeartbeatEventSession).toHaveBeenCalledWith("session-1");
  });

  it("COACH with only GROUP_VIEWER access cannot persist the Event live-match clock", async () => {
    const auth = mockAuthContext({ role: "COACH", groupAccesses: [{ footballGroupId: GROUP_ID, role: "GROUP_VIEWER" }] });
    denyGroupMutation(auth);
    const { persistEventLiveSessionClockAction } = await import("../event-live-actions");
    const result = await persistEventLiveSessionClockAction("session-1", {
      period: "FIRST_HALF",
      running: true,
      startedAt: new Date().toISOString(),
      elapsedBeforeStartMs: 0,
    });
    expect(result.success).toBe(false);
    expect(mockPersistEventLiveSessionClock).not.toHaveBeenCalled();
  });

  it("COACH with GROUP_COACH access can persist the Event live-match clock", async () => {
    mockAuthContext({ role: "COACH", groupAccesses: [{ footballGroupId: GROUP_ID, role: "GROUP_COACH" }] });
    const { persistEventLiveSessionClockAction } = await import("../event-live-actions");
    const result = await persistEventLiveSessionClockAction("session-1", {
      period: "FIRST_HALF",
      running: true,
      startedAt: new Date().toISOString(),
      elapsedBeforeStartMs: 0,
    });
    expect(result.success).toBe(true);
    expect(mockPersistEventLiveSessionClock).toHaveBeenCalled();
  });
});
