import { describe, it, expect, vi, beforeEach } from "vitest";
import { signInternalRequest } from "@/lib/live-match/realtime/internal-signature";

const { mockRecordEventForActor, mockLoggerError } = vi.hoisted(() => ({
  mockRecordEventForActor: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/live-match/live-match-event-store", () => ({
  recordEventForActor: mockRecordEventForActor,
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: mockLoggerError, info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return { ...actual, getLiveMatchInternalSecret: () => TEST_SECRET };
});

const TEST_SECRET = "test-internal-secret";

const VALID_BODY = {
  matchId: "match-1",
  sessionId: "session-1",
  organisationId: "org-1",
  userId: "user-1",
  clientEventId: "evt-1",
  eventType: "GOAL_FOR",
  rpcId: "rpc-1",
};

async function signedRequest(body: unknown, overrides?: { timestamp?: number; signature?: string; requestId?: string | null }) {
  const rawBody = JSON.stringify(body);
  const timestamp = overrides?.timestamp ?? Date.now();
  const signature = overrides?.signature ?? (await signInternalRequest({ timestamp, rawBody, secret: TEST_SECRET }));
  const headers: Record<string, string> = {
    "x-matchboard-timestamp": String(timestamp),
    "x-matchboard-signature": signature,
  };
  if (overrides?.requestId !== null) {
    headers["x-matchboard-request-id"] = overrides?.requestId ?? "req-1";
  }
  return new Request("http://localhost/api/internal/live-match/events", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

describe("POST /api/internal/live-match/events (SPEC.md §17-19, Stage 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists a validly-signed event via recordEventForActor", async () => {
    mockRecordEventForActor.mockResolvedValue({
      id: "canonical-1",
      clientEventId: "evt-1",
      eventType: "GOAL_FOR",
      createdAt: "2026-08-23T00:00:00.000Z",
    });

    const { POST } = await import("../route");
    const res = await POST(await signedRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      id: "canonical-1",
      clientEventId: "evt-1",
      eventType: "GOAL_FOR",
      createdAt: "2026-08-23T00:00:00.000Z",
    });
    expect(mockRecordEventForActor).toHaveBeenCalledWith(
      expect.objectContaining({ matchId: "match-1", sessionId: "session-1", clientEventId: "evt-1", eventType: "GOAL_FOR" }),
      { userId: "user-1", organisationId: "org-1" },
    );
  });

  it("rejects a request with an invalid signature", async () => {
    const { POST } = await import("../route");
    const res = await POST(await signedRequest(VALID_BODY, { signature: "0".repeat(64) }));
    expect(res.status).toBe(401);
    expect(mockRecordEventForActor).not.toHaveBeenCalled();
  });

  it("rejects a request with a tampered body (signed over a different body)", async () => {
    const rawBody = JSON.stringify(VALID_BODY);
    const timestamp = Date.now();
    const signature = await signInternalRequest({ timestamp, rawBody, secret: TEST_SECRET });
    const tamperedRequest = new Request("http://localhost/api/internal/live-match/events", {
      method: "POST",
      headers: {
        "x-matchboard-timestamp": String(timestamp),
        "x-matchboard-request-id": "req-1",
        "x-matchboard-signature": signature,
      },
      body: JSON.stringify({ ...VALID_BODY, eventType: "GOAL_AGAINST" }),
    });

    const { POST } = await import("../route");
    const res = await POST(tamperedRequest);
    expect(res.status).toBe(401);
    expect(mockRecordEventForActor).not.toHaveBeenCalled();
  });

  it("rejects a request with a stale timestamp", async () => {
    const { POST } = await import("../route");
    const res = await POST(await signedRequest(VALID_BODY, { timestamp: Date.now() - 120_000 }));
    expect(res.status).toBe(401);
    expect(mockRecordEventForActor).not.toHaveBeenCalled();
  });

  it("rejects a request missing signature headers entirely", async () => {
    const { POST } = await import("../route");
    const res = await POST(await signedRequest(VALID_BODY, { requestId: null }));
    expect(res.status).toBe(401);
    expect(mockRecordEventForActor).not.toHaveBeenCalled();
  });

  it("rejects a body missing required fields even with a valid signature", async () => {
    const { POST } = await import("../route");
    const res = await POST(await signedRequest({ matchId: "match-1" }));
    expect(res.status).toBe(400);
    expect(mockRecordEventForActor).not.toHaveBeenCalled();
  });

  it("maps a recordEventForActor domain rejection (e.g. session/match mismatch) to 422, not 500", async () => {
    mockRecordEventForActor.mockRejectedValue(new Error("Session does not belong to this match"));

    const { POST } = await import("../route");
    const res = await POST(await signedRequest(VALID_BODY));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe("Session does not belong to this match");
  });

  it("never logs the raw request body/payload on failure", async () => {
    mockRecordEventForActor.mockRejectedValue(new Error("Session not found"));

    const { POST } = await import("../route");
    await POST(await signedRequest({ ...VALID_BODY, payload: { note: "sensitive fair-play text" } }));

    expect(mockLoggerError).toHaveBeenCalledTimes(1);
    const loggedArg = mockLoggerError.mock.calls[0][0];
    expect(JSON.stringify(loggedArg)).not.toContain("sensitive fair-play text");
  });
});
