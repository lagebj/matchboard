import { describe, it, expect, vi, beforeEach } from "vitest";
import { signInternalRequest } from "@/lib/live-match/realtime/internal-signature";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    liveMatchSession: { findUnique: vi.fn() },
    liveMatchEvent: { findMany: vi.fn() },
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return { ...actual, getLiveMatchInternalSecret: () => TEST_SECRET };
});

const TEST_SECRET = "test-internal-secret";

function buildSnapshotUrl(matchId?: string, sessionId?: string): URL {
  const url = new URL("http://localhost/api/internal/live-match/snapshot");
  if (matchId) url.searchParams.set("matchId", matchId);
  if (sessionId) url.searchParams.set("sessionId", sessionId);
  return url;
}

async function signedGetRequest(params: {
  matchId?: string;
  sessionId?: string;
  timestamp?: number;
  signature?: string;
  /** Sign for a *different* query string than the one actually sent — proves a signature
   * issued for one matchId/sessionId is rejected when replayed against another (the exact
   * scenario this signing scheme exists to close: the query string is now the signable
   * content, not a fixed empty body every matchId/sessionId combination would satisfy). */
  signForMatchId?: string;
  signForSessionId?: string;
}) {
  const timestamp = params.timestamp ?? Date.now();
  const url = buildSnapshotUrl(params.matchId, params.sessionId);

  let signature = params.signature;
  if (!signature) {
    const signUrl =
      params.signForMatchId !== undefined || params.signForSessionId !== undefined
        ? buildSnapshotUrl(params.signForMatchId, params.signForSessionId)
        : url;
    signature = await signInternalRequest({ timestamp, rawBody: signUrl.search, secret: TEST_SECRET });
  }

  return new Request(url, {
    method: "GET",
    headers: {
      "x-matchboard-timestamp": String(timestamp),
      "x-matchboard-request-id": "req-1",
      "x-matchboard-signature": signature,
    },
  });
}

describe("GET /api/internal/live-match/snapshot (SPEC.md §17, §23, Stage 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns session status and deterministically-ordered canonical events for a valid signed request", async () => {
    mockDb.liveMatchSession.findUnique.mockResolvedValue({ id: "session-1", matchId: "match-1", status: "ACTIVE" });
    mockDb.liveMatchEvent.findMany.mockResolvedValue([
      { id: "evt-a", clientEventId: "client-a", eventType: "GOAL_FOR", createdAt: new Date("2026-08-23T00:00:00.000Z") },
      { id: "evt-b", clientEventId: "client-b", eventType: "ROTATION_OUT", createdAt: new Date("2026-08-23T00:00:01.000Z") },
    ]);

    const { GET } = await import("../route");
    const res = await GET(await signedGetRequest({ matchId: "match-1", sessionId: "session-1" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.session).toEqual({ sessionId: "session-1", matchId: "match-1", status: "ACTIVE" });
    expect(json.events).toEqual([
      { id: "evt-a", clientEventId: "client-a", eventType: "GOAL_FOR", createdAt: "2026-08-23T00:00:00.000Z" },
      { id: "evt-b", clientEventId: "client-b", eventType: "ROTATION_OUT", createdAt: "2026-08-23T00:00:01.000Z" },
    ]);
    expect(mockDb.liveMatchEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    );
  });

  it("rejects an invalid signature", async () => {
    const { GET } = await import("../route");
    const res = await GET(await signedGetRequest({ matchId: "match-1", sessionId: "session-1", signature: "0".repeat(64) }));
    expect(res.status).toBe(401);
    expect(mockDb.liveMatchSession.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a signature issued for a different matchId/sessionId (replay-with-substituted-params)", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      await signedGetRequest({
        matchId: "match-1",
        sessionId: "session-1",
        signForMatchId: "match-2",
        signForSessionId: "session-2",
      }),
    );
    expect(res.status).toBe(401);
    expect(mockDb.liveMatchSession.findUnique).not.toHaveBeenCalled();
  });

  it("requires both matchId and sessionId query parameters", async () => {
    const { GET } = await import("../route");
    const res = await GET(await signedGetRequest({ matchId: "match-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the session does not exist", async () => {
    mockDb.liveMatchSession.findUnique.mockResolvedValue(null);
    const { GET } = await import("../route");
    const res = await GET(await signedGetRequest({ matchId: "match-1", sessionId: "session-missing" }));
    expect(res.status).toBe(404);
  });

  it("returns 404 when the session belongs to a different match than claimed", async () => {
    mockDb.liveMatchSession.findUnique.mockResolvedValue({ id: "session-1", matchId: "match-2", status: "ACTIVE" });
    const { GET } = await import("../route");
    const res = await GET(await signedGetRequest({ matchId: "match-1", sessionId: "session-1" }));
    expect(res.status).toBe(404);
  });
});
