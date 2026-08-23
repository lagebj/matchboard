import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildSignedRequest, persistEvent, fetchSnapshot, PersistEventError } from "../src/internal-client";
import { verifyInternalSignature, signInternalRequest } from "../../../src/lib/live-match/realtime/internal-signature";

const SECRET = "worker-internal-test-secret";

describe("buildSignedRequest", () => {
  it("produces headers whose signature verifies against the same secret/timestamp/body", async () => {
    const signed = await buildSignedRequest({
      url: "https://app.matchboard.football/api/internal/live-match/events",
      method: "POST",
      rawBody: JSON.stringify({ hello: "world" }),
      secret: SECRET,
      timestamp: 1_700_000_000_000,
      requestId: "req-abc",
    });

    expect(signed.headers["x-matchboard-timestamp"]).toBe("1700000000000");
    expect(signed.headers["x-matchboard-request-id"]).toBe("req-abc");
    expect(signed.headers["content-type"]).toBe("application/json");

    const verification = await verifyInternalSignature({
      timestamp: 1_700_000_000_000,
      rawBody: signed.rawBody,
      signature: signed.headers["x-matchboard-signature"],
      secret: SECRET,
      now: 1_700_000_000_000,
    });
    expect(verification).toEqual({ ok: true });
  });
});

describe("persistEvent", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("POSTs a signed request to <baseUrl>/api/internal/live-match/events and returns the parsed response", async () => {
    const captured: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = vi.fn(async (url: string, init: RequestInit) => {
      captured.push({ url, init });
      return new Response(JSON.stringify({ id: "canonical-1", clientEventId: "evt-1", eventType: "GOAL_FOR", createdAt: "2026-08-23T00:00:00.000Z" }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const result = await persistEvent({
      baseUrl: "https://app.matchboard.football",
      secret: SECRET,
      body: {
        matchId: "match-1",
        sessionId: "session-1",
        organisationId: "org-1",
        userId: "user-1",
        clientEventId: "evt-1",
        eventType: "GOAL_FOR",
        rpcId: "rpc-1",
      },
    });

    expect(result).toEqual({ id: "canonical-1", clientEventId: "evt-1", eventType: "GOAL_FOR", createdAt: "2026-08-23T00:00:00.000Z" });
    expect(captured[0]?.url).toBe("https://app.matchboard.football/api/internal/live-match/events");
    expect((captured[0]?.init.headers as Record<string, string>)["x-matchboard-signature"]).toBeDefined();
  });

  it("throws PersistEventError with the response status on a non-2xx response", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 422 })) as unknown as typeof fetch;

    try {
      await persistEvent({
        baseUrl: "https://app.matchboard.football",
        secret: SECRET,
        body: {
          matchId: "match-1",
          sessionId: "session-1",
          organisationId: "org-1",
          userId: "user-1",
          clientEventId: "evt-1",
          eventType: "GOAL_FOR",
          rpcId: "rpc-1",
        },
      });
      expect.unreachable("persistEvent should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(PersistEventError);
      expect((error as PersistEventError).status).toBe(422);
    }
  });
});

describe("fetchSnapshot", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ session: { sessionId: "session-1", matchId: "match-1", status: "ACTIVE" }, events: [] }), { status: 200 }),
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("GETs the snapshot endpoint with matchId/sessionId query params, signed over the query string", async () => {
    const result = await fetchSnapshot({ baseUrl: "https://app.matchboard.football", secret: SECRET, matchId: "match-1", sessionId: "session-1" });
    expect(result.session.matchId).toBe("match-1");

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = new URL(call[0] as string);
    const init = call[1] as { headers: Record<string, string>; body?: unknown };
    expect(url.pathname).toBe("/api/internal/live-match/snapshot");
    expect(url.searchParams.get("matchId")).toBe("match-1");
    expect(url.searchParams.get("sessionId")).toBe("session-1");
    expect(init.body).toBeUndefined(); // GET never sends a body — the query string is signed, not transmitted as one.

    const timestamp = Number(init.headers["x-matchboard-timestamp"]);
    const expectedSignature = await signInternalRequest({ timestamp, rawBody: url.search, secret: SECRET });
    expect(init.headers["x-matchboard-signature"]).toBe(expectedSignature);
  });

  it("signs a different query string differently, so a captured signature can't be replayed against another match/session", async () => {
    await fetchSnapshot({ baseUrl: "https://app.matchboard.football", secret: SECRET, matchId: "match-1", sessionId: "session-1" });
    const firstCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const firstInit = firstCall[1] as { headers: Record<string, string> };
    const firstTimestamp = Number(firstInit.headers["x-matchboard-timestamp"]);

    const otherSignature = await signInternalRequest({
      timestamp: firstTimestamp,
      rawBody: "?matchId=match-2&sessionId=session-2",
      secret: SECRET,
    });
    expect(otherSignature).not.toBe(firstInit.headers["x-matchboard-signature"]);
  });
});
