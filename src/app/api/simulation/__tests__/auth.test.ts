import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireActorContext, mockRequireMutationRole, mockRateLimit } = vi.hoisted(() => ({
  mockRequireActorContext: vi.fn(),
  mockRequireMutationRole: vi.fn(),
  mockRateLimit: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/actor-context", () => ({
  requireActorContext: mockRequireActorContext,
  requireMutationRole: mockRequireMutationRole,
}));

vi.mock("@/lib/db", () => ({
  db: {
    leagueSeason: { findFirst: vi.fn().mockResolvedValue(null) },
    matchRound: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit.mockReturnValue({ allowed: true }),
}));

vi.mock("@/lib/security/errors", () => ({
  safeErrorResponse: vi.fn().mockReturnValue(new Response("Internal Server Error", { status: 500 })),
}));

vi.mock("@/lib/simulation/simulation-context-builder", () => ({
  buildLeagueSimulationContext: vi.fn().mockRejectedValue(new Error("Not implemented in test")),
}));

vi.mock("@/lib/simulation/simulation-service", () => ({
  runSeasonSimulation: vi.fn(),
}));

describe("Simulation run API auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockReturnValue({ allowed: true });
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireActorContext.mockRejectedValue(new Error("Unauthorized"));

    const { POST } = await import("@/app/api/simulation/run/route");

    const req = new NextRequest("http://localhost:3000/api/simulation/run", {
      method: "POST",
      body: JSON.stringify({ scope: "league", includeLeague: true }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockRequireActorContext.mockResolvedValue({
      userId: "test-user",
      email: "test@test.com",
      membershipId: "mem-1",
      organisationId: "org-1",
      organisationSlug: "test-org",
      role: "COACH",
      delegatedTeamIds: null,
      orgFilter: { type: "org", filter: { organisationId: "org-1" }, filterNullable: { organisationId: "org-1" }, organisationId: "org-1" },
    });
    mockRateLimit.mockReturnValue({ allowed: false });

    const { POST } = await import("@/app/api/simulation/run/route");

    const req = new NextRequest("http://localhost:3000/api/simulation/run", {
      method: "POST",
      body: JSON.stringify({ scope: "league", includeLeague: true }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
  });
});

describe("Simulation apply API auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockReturnValue({ allowed: true });
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireActorContext.mockRejectedValue(new Error("Unauthorized"));

    const { POST } = await import("@/app/api/simulation/apply/route");

    const req = new NextRequest("http://localhost:3000/api/simulation/apply", {
      method: "POST",
      body: JSON.stringify({ leagueSeasonId: "ls-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when VIEWER role attempts mutation", async () => {
    const viewCtx = {
      userId: "test-viewer",
      email: "viewer@test.com",
      membershipId: "mem-v",
      organisationId: "org-1",
      organisationSlug: "test-org",
      role: "VIEWER",
      delegatedTeamIds: null,
      orgFilter: { type: "org", filter: { organisationId: "org-1" }, filterNullable: { organisationId: "org-1" }, organisationId: "org-1" },
    };
    mockRequireActorContext.mockResolvedValue(viewCtx);
    mockRequireMutationRole.mockImplementation(() => {
      throw new Error("VIEWER cannot mutate");
    });

    const { POST } = await import("@/app/api/simulation/apply/route");

    const req = new NextRequest("http://localhost:3000/api/simulation/apply", {
      method: "POST",
      body: JSON.stringify({ leagueSeasonId: "ls-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when SUPPORT role attempts mutation", async () => {
    const supportCtx = {
      userId: "test-support",
      email: "support@test.com",
      membershipId: "mem-s",
      organisationId: "org-1",
      organisationSlug: "test-org",
      role: "SUPPORT",
      delegatedTeamIds: null,
      orgFilter: { type: "org", filter: { organisationId: "org-1" }, filterNullable: { organisationId: "org-1" }, organisationId: "org-1" },
    };
    mockRequireActorContext.mockResolvedValue(supportCtx);
    mockRequireMutationRole.mockImplementation(() => {
      throw new Error("SUPPORT cannot mutate");
    });

    const { POST } = await import("@/app/api/simulation/apply/route");

    const req = new NextRequest("http://localhost:3000/api/simulation/apply", {
      method: "POST",
      body: JSON.stringify({ leagueSeasonId: "ls-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});