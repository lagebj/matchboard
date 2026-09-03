import { describe, it, expect, vi } from "vitest";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext({ role: "ADMIN" });

const mockReplay = vi.fn();
vi.mock("@/lib/evidence/post-match-learning-replay", () => ({
  replayPostMatchLearningHistory: (...args: unknown[]) => mockReplay(...args),
}));

vi.mock("@/lib/tenancy/tenant-async-storage", () => ({
  setTenantOrganisationId: vi.fn(),
}));

import { rebuildHistoricalEvidenceAction } from "../evidence-rebuild-actions";

const SUMMARY = {
  totalMatches: 10,
  applied: 8,
  skipped: 2,
  failed: 0,
  bySource: {
    league: { total: 6, applied: 5, skipped: 1, failed: 0 },
    event: { total: 4, applied: 3, skipped: 1, failed: 0 },
  },
  details: [],
};

// Evidence-Informed Match Planning addendum: "Rebuild historical evidence" is org-scoped and
// admin-only (AGENTS.md "Transient historical evidence rebuild"), mirroring the existing
// "Populate opponent levels" tool's authorization model exactly.
describe("rebuildHistoricalEvidenceAction (authorization and tenancy)", () => {
  it("rejects a non-admin caller before touching the replay engine", async () => {
    auth.mockCanAdmin.mockReturnValue(false);
    mockReplay.mockClear();

    await expect(rebuildHistoricalEvidenceAction("acme")).rejects.toThrow("Admin access required");
    expect(mockReplay).not.toHaveBeenCalled();
  });

  it("runs the replay engine scoped to the caller's own organisation for an admin caller", async () => {
    auth.mockCanAdmin.mockReturnValue(true);
    mockReplay.mockClear();
    mockReplay.mockResolvedValue(SUMMARY);

    const result = await rebuildHistoricalEvidenceAction("acme");

    expect(mockReplay).toHaveBeenCalledWith(auth.context.organisationId);
    expect(result).toEqual(SUMMARY);
  });

  it("never lets a caller pass an arbitrary organisation id — the action only ever uses the resolved actor context's own organisation", async () => {
    auth.mockCanAdmin.mockReturnValue(true);
    mockReplay.mockClear();
    mockReplay.mockResolvedValue(SUMMARY);

    await rebuildHistoricalEvidenceAction("acme");

    // rebuildHistoricalEvidenceAction takes only an orgSlug (resolved server-side via
    // requireActorContext), never a raw organisationId the caller could substitute.
    const calledWith = mockReplay.mock.calls[0]?.[0];
    expect(calledWith).toBe(auth.context.organisationId);
    expect(calledWith).not.toBe("acme");
  });
});
