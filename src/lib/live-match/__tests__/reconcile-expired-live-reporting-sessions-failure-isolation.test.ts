import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * ADR-0146 §7/§13 — TEST-PLAN §24: one expired session's `finishLiveReporting` failure must not
 * block the rest of the batch, and must be logged/reported rather than silently swallowed. Uses
 * a fully mocked `db`/`finishLiveReporting` (a real DB and a mocked one cannot coexist as two
 * conflicting top-level `vi.mock("@/lib/db")` calls in one file — the end-to-end happy-path
 * coverage lives in `reconcile-expired-live-reporting-sessions.test.ts`).
 */

const { mockFinishLiveReporting, mockBuildLeagueMatchRef, mockDb } = vi.hoisted(() => ({
  mockFinishLiveReporting: vi.fn(),
  mockBuildLeagueMatchRef: vi.fn(),
  mockDb: {
    liveMatchSession: { findMany: vi.fn() },
    eventLiveMatchSession: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("../finish-live-reporting", () => ({ finishLiveReporting: mockFinishLiveReporting }));
vi.mock("@/lib/evidence/adapters/league-evidence-adapter", () => ({ buildLeagueMatchRef: mockBuildLeagueMatchRef }));
vi.mock("@/lib/evidence/adapters/event-evidence-adapter", () => ({ buildEventMatchRef: vi.fn() }));

import { reconcileExpiredLiveReportingSessions } from "../reconcile-expired-live-reporting-sessions";

describe("reconcileExpiredLiveReportingSessions — failure isolation (TEST-PLAN §24)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.eventLiveMatchSession.findMany.mockResolvedValue([]);
    mockBuildLeagueMatchRef.mockImplementation(async (matchId: string) => ({ kind: "LEAGUE_MATCH", matchId, leagueSeasonId: null }));
  });

  it("one session's finish failure is caught and logged; the rest of the batch still processes", async () => {
    mockDb.liveMatchSession.findMany.mockResolvedValue([
      { id: "s1", matchId: "m1", organisationId: "org-1", startedAt: new Date(0) },
      { id: "s2", matchId: "m2", organisationId: "org-1", startedAt: new Date(0) },
      { id: "s3", matchId: "m3", organisationId: "org-1", startedAt: new Date(0) },
    ]);
    mockFinishLiveReporting
      .mockResolvedValueOnce({ alreadyCompleted: false })
      .mockRejectedValueOnce(new Error("simulated finish failure"))
      .mockResolvedValueOnce({ alreadyCompleted: false });

    const outcome = await reconcileExpiredLiveReportingSessions();

    expect(mockFinishLiveReporting).toHaveBeenCalledTimes(3);
    expect(outcome.finished.map((f) => f.sessionId)).toEqual(["s1", "s3"]);
    expect(outcome.failed).toEqual([{ subjectType: "LEAGUE", sessionId: "s2", matchId: "m2", error: "simulated finish failure" }]);
  });

  it("an empty eligibility scan does nothing (TEST-PLAN §21's inverse — no eligible sessions is not an error)", async () => {
    mockDb.liveMatchSession.findMany.mockResolvedValue([]);

    const outcome = await reconcileExpiredLiveReportingSessions();

    expect(mockFinishLiveReporting).not.toHaveBeenCalled();
    expect(outcome).toEqual({ finished: [], failed: [] });
  });
});
