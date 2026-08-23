import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { verifyRealtimeTicket } from "@/lib/live-match/realtime/realtime-ticket";

const { mockRequireActorContext, mockRequireMutationRole, mockRateLimit, mockDb } = vi.hoisted(() => ({
  mockRequireActorContext: vi.fn(),
  mockRequireMutationRole: vi.fn(),
  mockRateLimit: vi.fn(),
  mockDb: {
    match: { findUnique: vi.fn() },
    liveMatchSession: { findUnique: vi.fn() },
  },
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/actor-context", () => ({
  requireActorContext: mockRequireActorContext,
  requireMutationRole: mockRequireMutationRole,
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

function makeRequest() {
  return new NextRequest("http://localhost:3000/api/live-match/match-1/realtime-ticket", { method: "POST" });
}

function makeParams(matchId: string) {
  return { params: Promise.resolve({ matchId }) };
}

describe("POST /api/live-match/[matchId]/realtime-ticket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireActorContext.mockResolvedValue(ctx);
    mockRequireMutationRole.mockImplementation(() => {});
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
});
