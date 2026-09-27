import { describe, it, expect, vi } from "vitest";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext({ role: "ADMIN" });

const mockRunAiBackfill = vi.fn();
vi.mock("@/lib/evidence/qualitative-evidence-backfill", () => ({
  runAiBackfill: (...args: unknown[]) => mockRunAiBackfill(...args),
}));

vi.mock("@/lib/tenancy/tenant-async-storage", () => ({
  setTenantOrganisationId: vi.fn(),
}));

const mockLogSecurityEvent = vi.fn();
vi.mock("@/lib/security/audit-log", () => ({
  logSecurityEvent: (...args: unknown[]) => mockLogSecurityEvent(...args),
}));

import { runAiBackfillAction } from "../ai-backfill-actions";

const REPORT = {
  organisationId: "test-org-id",
  aiDisabled: false,
  window: { from: new Date("2025-02-04T10:00:00Z"), to: new Date("2025-05-05T10:00:00Z") },
  extraction: [
    { sourceType: "POST_MATCH_TEAM_NOTE", considered: 2, enqueued: 1, alreadyTracked: 1, empty: 0, outOfBudget: 0, failed: 0 },
  ],
  advisor: {
    lockedMatchesConsidered: 3,
    matchReviewsEnqueued: 2,
    weeksConsidered: 13,
    weeklyReviewsEnqueued: 4,
    developmentCycleScanned: 1,
    developmentCycleEnqueued: 1,
  },
};

// ADR-0152 Slice 7: "Run AI analysis on existing data" is org-scoped and admin-only, mirroring
// the sibling "Rebuild historical evidence" / "Populate opponent levels" tools' authorization
// model exactly — and, like them, never accepts a caller-supplied organisation id.
describe("runAiBackfillAction (authorization and tenancy)", () => {
  it("rejects a non-admin caller before touching the backfill engine", async () => {
    auth.mockCanAdmin.mockReturnValue(false);
    mockRunAiBackfill.mockClear();

    await expect(runAiBackfillAction("acme")).rejects.toThrow("Admin access required");
    expect(mockRunAiBackfill).not.toHaveBeenCalled();
  });

  it("runs the backfill scoped to the caller's own organisation for an admin caller", async () => {
    auth.mockCanAdmin.mockReturnValue(true);
    mockRunAiBackfill.mockClear();
    mockRunAiBackfill.mockResolvedValue(REPORT);

    const result = await runAiBackfillAction("acme");

    expect(mockRunAiBackfill).toHaveBeenCalledWith(auth.context.organisationId);
    expect(result).toEqual(REPORT);
  });

  it("never lets a caller pass an arbitrary organisation id — the action only ever uses the resolved actor context's own organisation", async () => {
    auth.mockCanAdmin.mockReturnValue(true);
    mockRunAiBackfill.mockClear();
    mockRunAiBackfill.mockResolvedValue(REPORT);

    await runAiBackfillAction("acme");

    const calledWith = mockRunAiBackfill.mock.calls[0]?.[0];
    expect(calledWith).toBe(auth.context.organisationId);
    expect(calledWith).not.toBe("acme");
  });

  it("records an audit event for the run", async () => {
    auth.mockCanAdmin.mockReturnValue(true);
    mockRunAiBackfill.mockClear();
    mockLogSecurityEvent.mockClear();
    mockRunAiBackfill.mockResolvedValue(REPORT);

    await runAiBackfillAction("acme");

    expect(mockLogSecurityEvent).toHaveBeenCalledTimes(1);
    expect(mockLogSecurityEvent.mock.calls[0][0]).toMatchObject({
      action: "run_ai_backfill",
      actor: auth.context.userId,
      tenant: auth.context.organisationId,
      result: "success",
    });
  });
});