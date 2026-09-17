import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthorizationError } from "@/lib/auth";
import { mockAuthContext } from "@/test/support/auth-mock";

/**
 * ADR-0140 / ARR-0048 — the live-to-report handoff must authorize group mutation BEFORE ending
 * the live session or seeding the post-match report. A `GROUP_VIEWER` must not be able to
 * complete this handoff.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { mockDb, mockFinishLiveReporting, mockBuildEventMatchRef } = vi.hoisted(() => ({
  mockDb: {
    eventLiveMatchSession: { findFirst: vi.fn() },
    eventMatch: { findFirst: vi.fn() },
  },
  mockFinishLiveReporting: vi.fn(),
  mockBuildEventMatchRef: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/live-match/finish-live-reporting", () => ({
  finishLiveReporting: mockFinishLiveReporting,
}));

vi.mock("@/lib/evidence/adapters/event-evidence-adapter", () => ({
  buildEventMatchRef: mockBuildEventMatchRef,
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
    mockBuildEventMatchRef.mockResolvedValue({ kind: "EVENT_MATCH", eventMatchId: EVENT_MATCH_ID, eventId: "event-1", evidenceLeagueSeasonId: null });
    mockFinishLiveReporting.mockResolvedValue({
      reportId: "report-1",
      reportStatus: "DRAFT",
      alreadyCompleted: false,
      activePeriodResolution: null,
    });
  });

  it("denies the handoff for a COACH with only GROUP_VIEWER access, before finishing Live Reporting", async () => {
    const auth = mockAuthContext({ role: "COACH", groupAccesses: [{ footballGroupId: GROUP_ID, role: "GROUP_VIEWER" }] });
    (auth.mockRequireGroupMutationRoleFromContext as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new AuthorizationError("You have view-only access to this group and cannot report on it.");
    });

    const { endEventLiveSessionAndCreateReportAction } = await import("../event-live-report-handoff");
    const result = await endEventLiveSessionAndCreateReportAction(SESSION_ID, EVENT_MATCH_ID);

    expect(result.success).toBe(false);
    expect(mockFinishLiveReporting).not.toHaveBeenCalled();
  });

  it("denies the handoff for a COACH with no group access at all", async () => {
    const auth = mockAuthContext({ role: "COACH", groupAccesses: [] });
    (auth.mockRequireGroupMutationRoleFromContext as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new AuthorizationError("You have view-only access to this group and cannot report on it.");
    });

    const { endEventLiveSessionAndCreateReportAction } = await import("../event-live-report-handoff");
    const result = await endEventLiveSessionAndCreateReportAction(SESSION_ID, EVENT_MATCH_ID);

    expect(result.success).toBe(false);
    expect(mockFinishLiveReporting).not.toHaveBeenCalled();
  });

  it("allows the handoff for a COACH with GROUP_COACH access", async () => {
    const auth = mockAuthContext({ role: "COACH", groupAccesses: [{ footballGroupId: GROUP_ID, role: "GROUP_COACH" }] });

    const { endEventLiveSessionAndCreateReportAction } = await import("../event-live-report-handoff");
    const result = await endEventLiveSessionAndCreateReportAction(SESSION_ID, EVENT_MATCH_ID);

    expect(result.success).toBe(true);
    expect(auth.mockRequireGroupMutationRoleFromContext).toHaveBeenCalledWith(expect.anything(), GROUP_ID);
    expect(mockFinishLiveReporting).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "EVENT_MATCH", eventMatchId: EVENT_MATCH_ID }),
      "MANUAL",
      { organisationId: "test-org-id" },
    );
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
