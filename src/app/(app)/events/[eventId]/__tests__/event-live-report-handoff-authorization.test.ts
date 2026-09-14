import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthorizationError } from "@/lib/auth";
import { mockAuthContext } from "@/test/support/auth-mock";

/**
 * ADR-0140 / ARR-0048 — the live-to-report handoff must authorize group mutation BEFORE ending
 * the live session or seeding the post-match report. A `GROUP_VIEWER` must not be able to
 * complete this handoff.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { mockDb, mockEndEventLiveSession, mockSeedEventReportFromLiveSession } = vi.hoisted(() => ({
  mockDb: {
    eventLiveMatchSession: { findFirst: vi.fn() },
    eventMatch: { findFirst: vi.fn() },
  },
  mockEndEventLiveSession: vi.fn(),
  mockSeedEventReportFromLiveSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/live-match/event-live-match-session", () => ({
  endEventLiveSession: mockEndEventLiveSession,
}));

vi.mock("@/lib/reports/event-report-mutations", () => ({
  seedEventReportFromLiveSession: mockSeedEventReportFromLiveSession,
}));

const GROUP_ID = "group-1";
const SESSION_ID = "session-1";
const EVENT_MATCH_ID = "event-match-1";

describe("endEventLiveSessionAndCreateReportAction: group mutation authorization (ADR-0140 / ARR-0048)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.eventLiveMatchSession.findFirst.mockResolvedValue({
      id: SESSION_ID,
      eventMatchId: EVENT_MATCH_ID,
      status: "ACTIVE",
      organisationId: "test-org-id",
      eventMatch: { event: { footballGroupId: GROUP_ID } },
    });
    mockDb.eventMatch.findFirst.mockResolvedValue({ eventId: "event-1" });
    mockEndEventLiveSession.mockResolvedValue({ id: SESSION_ID, eventMatchId: EVENT_MATCH_ID });
    mockSeedEventReportFromLiveSession.mockResolvedValue({ success: true, reportId: "report-1", status: "DRAFT" });
  });

  it("denies the handoff for a COACH with only GROUP_VIEWER access, before ending the session or seeding a report", async () => {
    const auth = mockAuthContext({ role: "COACH", groupAccesses: [{ footballGroupId: GROUP_ID, role: "GROUP_VIEWER" }] });
    (auth.mockRequireGroupMutationRoleFromContext as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new AuthorizationError("You have view-only access to this group and cannot report on it.");
    });

    const { endEventLiveSessionAndCreateReportAction } = await import("../event-live-report-handoff");
    const result = await endEventLiveSessionAndCreateReportAction(SESSION_ID, EVENT_MATCH_ID);

    expect(result.success).toBe(false);
    expect(mockEndEventLiveSession).not.toHaveBeenCalled();
    expect(mockSeedEventReportFromLiveSession).not.toHaveBeenCalled();
  });

  it("denies the handoff for a COACH with no group access at all", async () => {
    const auth = mockAuthContext({ role: "COACH", groupAccesses: [] });
    (auth.mockRequireGroupMutationRoleFromContext as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new AuthorizationError("You have view-only access to this group and cannot report on it.");
    });

    const { endEventLiveSessionAndCreateReportAction } = await import("../event-live-report-handoff");
    const result = await endEventLiveSessionAndCreateReportAction(SESSION_ID, EVENT_MATCH_ID);

    expect(result.success).toBe(false);
    expect(mockEndEventLiveSession).not.toHaveBeenCalled();
  });

  it("allows the handoff for a COACH with GROUP_COACH access", async () => {
    const auth = mockAuthContext({ role: "COACH", groupAccesses: [{ footballGroupId: GROUP_ID, role: "GROUP_COACH" }] });

    const { endEventLiveSessionAndCreateReportAction } = await import("../event-live-report-handoff");
    const result = await endEventLiveSessionAndCreateReportAction(SESSION_ID, EVENT_MATCH_ID);

    expect(result.success).toBe(true);
    expect(auth.mockRequireGroupMutationRoleFromContext).toHaveBeenCalledWith(expect.anything(), GROUP_ID);
    expect(mockEndEventLiveSession).toHaveBeenCalledWith(SESSION_ID);
    expect(mockSeedEventReportFromLiveSession).toHaveBeenCalled();
  });

  it("allows the handoff for OWNER via the administrative bypass", async () => {
    mockAuthContext({ role: "OWNER" });

    const { endEventLiveSessionAndCreateReportAction } = await import("../event-live-report-handoff");
    const result = await endEventLiveSessionAndCreateReportAction(SESSION_ID, EVENT_MATCH_ID);

    expect(result.success).toBe(true);
  });

  it("allows the handoff for ADMIN via the administrative bypass", async () => {
    mockAuthContext({ role: "ADMIN" });

    const { endEventLiveSessionAndCreateReportAction } = await import("../event-live-report-handoff");
    const result = await endEventLiveSessionAndCreateReportAction(SESSION_ID, EVENT_MATCH_ID);

    expect(result.success).toBe(true);
  });
});
