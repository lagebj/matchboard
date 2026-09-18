import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * ADR-0146 §7/§14 — mirrors the notification-outbox cron route's own bearer-auth contract
 * exactly: `CRON_SECRET` required, no new authentication mechanism, never an unauthenticated
 * public endpoint that lets arbitrary callers finish matches.
 */

const { mockReconcile } = vi.hoisted(() => ({ mockReconcile: vi.fn() }));

vi.mock("@/lib/live-match/reconcile-expired-live-reporting-sessions", () => ({
  reconcileExpiredLiveReportingSessions: mockReconcile,
}));

describe("/api/cron/live-reporting-reconciliation", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
  });

  afterEach(() => {
    if (originalSecret !== undefined) process.env.CRON_SECRET = originalSecret;
    else delete process.env.CRON_SECRET;
  });

  function makeRequest(authHeader?: string) {
    return new Request("http://localhost:3333/api/cron/live-reporting-reconciliation", {
      headers: authHeader ? { authorization: authHeader } : {},
    });
  }

  it("rejects a request with no Authorization header", async () => {
    const { GET } = await import("../route");
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong bearer token", async () => {
    const { GET } = await import("../route");
    const response = await GET(makeRequest("Bearer wrong-secret"));
    expect(response.status).toBe(401);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it("runs the reconciler and returns its finished/failed counts when authorized", async () => {
    mockReconcile.mockResolvedValue({
      finished: [{ subjectType: "LEAGUE", sessionId: "s1", matchId: "m1" }],
      failed: [],
    });

    const { GET } = await import("../route");
    const response = await GET(makeRequest("Bearer test-cron-secret"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, finished: 1, failed: 0 });
    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });

  it("returns 500 (not a silent 200) when the reconciler itself throws", async () => {
    mockReconcile.mockRejectedValue(new Error("boom"));

    const { GET } = await import("../route");
    const response = await GET(makeRequest("Bearer test-cron-secret"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: "Internal server error" });
  });
});
