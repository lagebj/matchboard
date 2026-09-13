import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { verifyRealtimeTicket } from "@/lib/live-match/realtime/realtime-ticket";
import { AuthorizationError } from "@/lib/auth";

const {
  mockRequireActorContext,
  mockRequireMutationRole,
  mockRequireMatchGroupAccess,
  mockRequireMatchGroupMutationRole,
  mockRequireGroupAccessFromContext,
  mockRateLimit,
  mockDb,
} = vi.hoisted(() => ({
  mockRequireActorContext: vi.fn(),
  mockRequireMutationRole: vi.fn(),
  mockRequireMatchGroupAccess: vi.fn(),
  mockRequireMatchGroupMutationRole: vi.fn(),
  mockRequireGroupAccessFromContext: vi.fn(),
  mockRateLimit: vi.fn(),
  mockDb: {
    match: { findUnique: vi.fn() },
    liveMatchSession: { findUnique: vi.fn() },
    eventMatch: { findUnique: vi.fn() },
    eventLiveMatchSession: { findUnique: vi.fn() },
  },
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/actor-context", () => ({
  requireActorContext: mockRequireActorContext,
  requireMutationRole: mockRequireMutationRole,
  requireMatchGroupAccess: mockRequireMatchGroupAccess,
  requireMatchGroupMutationRole: mockRequireMatchGroupMutationRole,
  requireGroupAccessFromContext: mockRequireGroupAccessFromContext,
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return { ...actual, getLiveMatchRealtimeSecret: () => "test-realtime-secret" };
});

const TEST_SECRET = "test-realtime-secret";

const ctx = {
  userId: "user-1",
  email: "coach@test.com",
  membershipId: "mem-1",
  organisationId: "org-1",
  organisationSlug: "test-org",
  role: "COACH",
  orgFilter: { type: "org", filter: { organisationId: "org-1" }, filterNullable: { organisationId: "org-1" }, organisationId: "org-1" },
};

function makeRequest(body?: { mode?: "report" | "view"; subjectType?: "LEAGUE" | "EVENT" }) {
  return new NextRequest("http://localhost:3000/api/live-match/match-1/realtime-ticket", {
    method: "POST",
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function makeParams(matchId: string) {
  return { params: Promise.resolve({ matchId }) };
}

describe("POST /api/live-match/[matchId]/realtime-ticket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireActorContext.mockResolvedValue(ctx);
    mockRequireMutationRole.mockImplementation(() => {});
    mockRequireMatchGroupAccess.mockResolvedValue(null);
    mockRequireMatchGroupMutationRole.mockResolvedValue(undefined);
    mockRequireGroupAccessFromContext.mockImplementation(() => {});
    mockRateLimit.mockResolvedValue({ allowed: true });
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireActorContext.mockRejectedValue(new Error("Unauthorized"));
    const { POST } = await import("../route");
    const res = await POST(makeRequest(), makeParams("match-1"));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false });
    const { POST } = await import("../route");
    const res = await POST(makeRequest(), makeParams("match-1"));
    expect(res.status).toBe(429);
  });

  it("returns 404 when the match does not exist", async () => {
    mockDb.match.findUnique.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(makeRequest(), makeParams("missing-match"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when the match belongs to a different organisation", async () => {
    mockDb.match.findUnique.mockResolvedValue({ id: "match-1", organisationId: "org-OTHER" });
    const { POST } = await import("../route");
    const res = await POST(makeRequest(), makeParams("match-1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when no live session exists for the match", async () => {
    mockDb.match.findUnique.mockResolvedValue({ id: "match-1", organisationId: "org-1" });
    mockDb.liveMatchSession.findUnique.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(makeRequest(), makeParams("match-1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when the live session belongs to a different organisation", async () => {
    mockDb.match.findUnique.mockResolvedValue({ id: "match-1", organisationId: "org-1" });
    mockDb.liveMatchSession.findUnique.mockResolvedValue({ id: "session-1", organisationId: "org-OTHER", status: "ACTIVE" });
    const { POST } = await import("../route");
    const res = await POST(makeRequest(), makeParams("match-1"));
    expect(res.status).toBe(404);
  });

  it("returns 409 when the live session has ended", async () => {
    mockDb.match.findUnique.mockResolvedValue({ id: "match-1", organisationId: "org-1" });
    mockDb.liveMatchSession.findUnique.mockResolvedValue({ id: "session-1", organisationId: "org-1", status: "ENDED" });
    const { POST } = await import("../route");
    const res = await POST(makeRequest(), makeParams("match-1"));
    expect(res.status).toBe(409);
  });

  it("issues a verifiable ticket scoped to the match/session/actor on success", async () => {
    mockDb.match.findUnique.mockResolvedValue({ id: "match-1", organisationId: "org-1" });
    mockDb.liveMatchSession.findUnique.mockResolvedValue({ id: "session-1", organisationId: "org-1", status: "ACTIVE" });
    const { POST } = await import("../route");
    const res = await POST(makeRequest(), makeParams("match-1"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(typeof body.ticket).toBe("string");
    expect(body.expiresIn).toBeGreaterThan(0);

    const claims = await verifyRealtimeTicket(body.ticket, TEST_SECRET);
    expect(claims.userId).toBe(ctx.userId);
    expect(claims.organisationId).toBe(ctx.organisationId);
    expect(claims.matchId).toBe("match-1");
    expect(claims.sessionId).toBe("session-1");
  });

  it("defaults to report mode when no body is sent (backward compatible), issuing a report capability", async () => {
    mockDb.match.findUnique.mockResolvedValue({ id: "match-1", organisationId: "org-1" });
    mockDb.liveMatchSession.findUnique.mockResolvedValue({ id: "session-1", organisationId: "org-1", status: "ACTIVE" });
    const { POST } = await import("../route");
    const res = await POST(makeRequest(), makeParams("match-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const claims = await verifyRealtimeTicket(body.ticket, TEST_SECRET);
    expect(claims.capabilities).toEqual(["report"]);
    expect(mockRequireMutationRole).toHaveBeenCalled();
    expect(mockRequireMatchGroupMutationRole).toHaveBeenCalledWith(ctx, "match-1");
    expect(mockRequireMatchGroupAccess).not.toHaveBeenCalled();
  });

  it("rejects report mode when the caller only has GROUP_VIEWER access to the match's group", async () => {
    mockDb.match.findUnique.mockResolvedValue({ id: "match-1", organisationId: "org-1" });
    mockDb.liveMatchSession.findUnique.mockResolvedValue({ id: "session-1", organisationId: "org-1", status: "ACTIVE" });
    mockRequireMatchGroupMutationRole.mockRejectedValue(new AuthorizationError("You have view-only access to this match's group."));
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ mode: "report" }), makeParams("match-1"));
    expect(res.status).toBe(403);
  });

  it("issues a view-only ticket in view mode without requiring org mutation role", async () => {
    mockDb.match.findUnique.mockResolvedValue({ id: "match-1", organisationId: "org-1" });
    mockDb.liveMatchSession.findUnique.mockResolvedValue({ id: "session-1", organisationId: "org-1", status: "ACTIVE" });
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ mode: "view" }), makeParams("match-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const claims = await verifyRealtimeTicket(body.ticket, TEST_SECRET);
    expect(claims.capabilities).toEqual(["view"]);
    expect(mockRequireMutationRole).not.toHaveBeenCalled();
    expect(mockRequireMatchGroupAccess).toHaveBeenCalledWith(ctx, "match-1");
    expect(mockRequireMatchGroupMutationRole).not.toHaveBeenCalled();
  });

  it("rejects view mode when the caller has no access at all to the match's group", async () => {
    mockDb.match.findUnique.mockResolvedValue({ id: "match-1", organisationId: "org-1" });
    mockDb.liveMatchSession.findUnique.mockResolvedValue({ id: "session-1", organisationId: "org-1", status: "ACTIVE" });
    mockRequireMatchGroupAccess.mockRejectedValue(new AuthorizationError("You do not have access to this match's team."));
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ mode: "view" }), makeParams("match-1"));
    expect(res.status).toBe(403);
  });
});

// ADR-0138 Bundle 8 — Event parity (closes ARR-0046, and work item 7's "view" gate).
describe("POST /api/live-match/[matchId]/realtime-ticket (subjectType: EVENT)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireActorContext.mockResolvedValue(ctx);
    mockRequireMutationRole.mockImplementation(() => {});
    mockRequireGroupAccessFromContext.mockImplementation(() => {});
    mockRateLimit.mockResolvedValue({ allowed: true });
  });

  it("returns 404 when the event match does not exist", async () => {
    mockDb.eventMatch.findUnique.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ subjectType: "EVENT" }), makeParams("event-match-1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when the event match belongs to a different organisation", async () => {
    mockDb.eventMatch.findUnique.mockResolvedValue({ id: "event-match-1", organisationId: "org-OTHER", event: { footballGroupId: "group-1" } });
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ subjectType: "EVENT" }), makeParams("event-match-1"));
    expect(res.status).toBe(404);
  });

  it("issues a report-mode ticket via org-level requireMutationRole only, no group check (matching Event's existing mutation-authorization pattern)", async () => {
    mockDb.eventMatch.findUnique.mockResolvedValue({ id: "event-match-1", organisationId: "org-1", event: { footballGroupId: "group-1" } });
    mockDb.eventLiveMatchSession.findUnique.mockResolvedValue({ id: "session-1", organisationId: "org-1", status: "ACTIVE" });
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ subjectType: "EVENT", mode: "report" }), makeParams("event-match-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const claims = await verifyRealtimeTicket(body.ticket, TEST_SECRET);
    expect(claims.capabilities).toEqual(["report"]);
    expect(claims.subjectType).toBe("EVENT");
    expect(mockRequireMutationRole).toHaveBeenCalled();
    expect(mockRequireGroupAccessFromContext).not.toHaveBeenCalled();
  });

  it("issues a view-mode ticket gated by requireGroupAccessFromContext on the Event's footballGroupId", async () => {
    mockDb.eventMatch.findUnique.mockResolvedValue({ id: "event-match-1", organisationId: "org-1", event: { footballGroupId: "group-1" } });
    mockDb.eventLiveMatchSession.findUnique.mockResolvedValue({ id: "session-1", organisationId: "org-1", status: "ACTIVE" });
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ subjectType: "EVENT", mode: "view" }), makeParams("event-match-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const claims = await verifyRealtimeTicket(body.ticket, TEST_SECRET);
    expect(claims.capabilities).toEqual(["view"]);
    expect(claims.subjectType).toBe("EVENT");
    expect(mockRequireGroupAccessFromContext).toHaveBeenCalledWith(ctx, "group-1");
    expect(mockRequireMutationRole).not.toHaveBeenCalled();
  });

  it("rejects view mode when the caller has no access to the Event's group", async () => {
    mockDb.eventMatch.findUnique.mockResolvedValue({ id: "event-match-1", organisationId: "org-1", event: { footballGroupId: "group-1" } });
    mockDb.eventLiveMatchSession.findUnique.mockResolvedValue({ id: "session-1", organisationId: "org-1", status: "ACTIVE" });
    mockRequireGroupAccessFromContext.mockImplementation(() => {
      throw new AuthorizationError("You do not have access to this group.");
    });
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ subjectType: "EVENT", mode: "view" }), makeParams("event-match-1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when no live session exists for the event match", async () => {
    mockDb.eventMatch.findUnique.mockResolvedValue({ id: "event-match-1", organisationId: "org-1", event: { footballGroupId: "group-1" } });
    mockDb.eventLiveMatchSession.findUnique.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ subjectType: "EVENT" }), makeParams("event-match-1"));
    expect(res.status).toBe(404);
  });

  it("returns 409 when the event live session has ended", async () => {
    mockDb.eventMatch.findUnique.mockResolvedValue({ id: "event-match-1", organisationId: "org-1", event: { footballGroupId: "group-1" } });
    mockDb.eventLiveMatchSession.findUnique.mockResolvedValue({ id: "session-1", organisationId: "org-1", status: "ENDED" });
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ subjectType: "EVENT" }), makeParams("event-match-1"));
    expect(res.status).toBe(409);
  });
});
