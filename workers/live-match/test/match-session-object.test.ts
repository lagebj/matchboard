import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { signRealtimeTicket } from "../../../src/lib/live-match/realtime/realtime-ticket";
import { LIFECYCLE_FALLBACK_CEILING_MS, MAX_RETRY_ATTEMPTS, LIFECYCLE_GRACE_MS, LIFECYCLE_INACTIVITY_AFTER_DEADLINE_MS } from "../src/state";

/**
 * Class-level orchestration tests for `MatchSessionObject` — specifically the Stage 6 pieces
 * that are genuinely hard to verify via `state.ts`'s pure functions alone (the alarm sweep's
 * end-to-end wiring, and reconciliation's effect on real Durable Object storage across an
 * `authenticate` call). This repository does not use `@cloudflare/vitest-pool-workers`/
 * Miniflare (see `state.ts`'s header and `docs/adr/0086-...md`'s Stage 6 amendment for why) —
 * instead, `cloudflare:workers` (unresolvable outside the real Workers runtime) is mocked with
 * a minimal `DurableObject` base class, and Durable Object storage/WebSocket primitives are
 * hand-rolled fakes, sufficient to exercise the *real* `MatchSessionObject` class — its actual
 * `webSocketMessage`/`dispatch`/`handleAuthenticate`/`handleRecordEvent`/`alarm` methods, not
 * reimplementations of them — end to end. `persistEvent`/`fetchSnapshot` (the only genuine
 * network calls) are mocked at the `./internal-client` boundary; `verifyRealtimeTicket` is the
 * real implementation (pure crypto, no I/O), so tickets must be genuinely signed with
 * `signRealtimeTicket` to pass.
 */

const REALTIME_SECRET = "test-realtime-secret";
const INTERNAL_SECRET = "test-internal-secret";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    ctx: unknown;
    env: unknown;
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  },
}));

const { mockPersistEvent, mockFetchSnapshot, TestPersistEventError } = vi.hoisted(() => {
  class TestPersistEventError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
  }
  return {
    mockPersistEvent: vi.fn(),
    mockFetchSnapshot: vi.fn(),
    TestPersistEventError,
  };
});

vi.mock("../src/internal-client", () => ({
  persistEvent: mockPersistEvent,
  fetchSnapshot: mockFetchSnapshot,
  PersistEventError: TestPersistEventError,
}));

class FakeStorage {
  private map = new Map<string, unknown>();
  private alarmTime: number | null = null;

  async get(key: string | string[]): Promise<unknown> {
    if (Array.isArray(key)) {
      const result = new Map<string, unknown>();
      for (const k of key) {
        if (this.map.has(k)) result.set(k, this.map.get(k));
      }
      return result;
    }
    return this.map.get(key);
  }

  async put(key: string, value: unknown): Promise<void> {
    this.map.set(key, value);
  }

  async delete(key: string | string[]): Promise<void> {
    for (const k of Array.isArray(key) ? key : [key]) this.map.delete(k);
  }

  async setAlarm(time: number): Promise<void> {
    this.alarmTime = time;
  }

  async deleteAlarm(): Promise<void> {
    this.alarmTime = null;
  }

  async getAlarm(): Promise<number | null> {
    return this.alarmTime;
  }
}

class FakeWebSocket {
  sent: unknown[] = [];
  closed: { code: number; reason: string } | null = null;
  private attachment: unknown = null;

  serializeAttachment(data: unknown): void {
    this.attachment = data;
  }

  deserializeAttachment(): unknown {
    return this.attachment;
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }

  close(code: number, reason: string): void {
    this.closed = { code, reason };
  }
}

class FakeCtx {
  storage = new FakeStorage();
  private sockets: FakeWebSocket[] = [];

  acceptWebSocket(ws: FakeWebSocket): void {
    this.sockets.push(ws);
  }

  getWebSockets(): FakeWebSocket[] {
    return this.sockets;
  }
}

async function setUpConnectedObject(matchId: string) {
  const { MatchSessionObject } = await import("../src/match-session-object");
  const ctx = new FakeCtx();
  const env = {
    MATCHBOARD_APP_ORIGINS: "http://localhost:3333",
    MATCHBOARD_API_BASE_URL: "http://localhost:3333",
    LIVE_MATCH_REALTIME_SECRET: REALTIME_SECRET,
    LIVE_MATCH_INTERNAL_SECRET: INTERNAL_SECRET,
  };
  // Mirrors what `fetch()` does before handing off to webSocketMessage — this repo's test
  // approach (see file header) starts one layer below `fetch()` itself, since WebSocketPair
  // is a real Workers-runtime global with no Node equivalent.
  await ctx.storage.put("routedMatchId", matchId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instance = new MatchSessionObject(ctx as any, env as any);
  const ws = new FakeWebSocket();
  ctx.acceptWebSocket(ws);
  ws.serializeAttachment({
    authenticated: false,
    connectionId: "conn-1",
    clientId: "",
    userId: "",
    organisationId: "",
    sessionId: "",
    authValidUntil: 0,
    lastAckVersion: 0,
    capabilities: [],
  });
  return { instance, ctx, ws };
}

async function authenticate(
  instance: InstanceType<Awaited<ReturnType<typeof importMSO>>["MatchSessionObject"]>,
  ws: FakeWebSocket,
  params: { matchId: string; sessionId: string; organisationId: string; userId: string; capabilities?: string[] },
) {
  const ticket = await signRealtimeTicket(
    {
      userId: params.userId,
      organisationId: params.organisationId,
      matchId: params.matchId,
      sessionId: params.sessionId,
      capabilities: params.capabilities ?? ["report"],
    },
    REALTIME_SECRET,
  );
  await instance.webSocketMessage(
    ws as unknown as WebSocket,
    JSON.stringify({ protocol: 1, kind: "call", id: "auth-1", method: "authenticate", params: { ticket, clientId: "client-1" } }),
  );
  return ws.sent.at(-1);
}

async function importMSO() {
  return import("../src/match-session-object");
}

function rpc(id: string, method: string, params: unknown) {
  return JSON.stringify({ protocol: 1, kind: "call", id, method, params });
}

/** `scheduleRetry` sets `nextRetryAt` `computeBackoffDelayMs(0)` (1s) in the future — a real
 * Durable Object alarm only fires once that time has actually passed, so a test calling
 * `alarm()` immediately after scheduling must fast-forward past it first, or `selectDueRetries`
 * correctly (and desirably) finds nothing due yet. Ticket signing already happened by the time
 * this is called in every test below, so faking time here can't affect JWT `iat`/`exp` claims. */
function advancePastFirstRetry(): void {
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 1_500);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("MatchSessionObject — persistence outbox (SPEC.md §21, Stage 6)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetchSnapshot.mockResolvedValue({ session: { sessionId: "session-1", matchId: "match-1", status: "ACTIVE" }, events: [] });
  });

  it("classifies a 5xx as retryable: stays pending, schedules an alarm, does not mark failed_terminal", async () => {
    const { instance, ctx, ws } = await setUpConnectedObject("match-1");
    await authenticate(instance, ws, { matchId: "match-1", sessionId: "session-1", organisationId: "org-1", userId: "user-1" });

    mockPersistEvent.mockRejectedValueOnce(new TestPersistEventError("Neon unavailable", 503));

    await instance.webSocketMessage(
      ws as unknown as WebSocket,
      rpc("rec-1", "recordEvent", { clientEventId: "evt-1", baseVersion: 0, event: { eventType: "GOAL_FOR" } }),
    );

    const result = ws.sent.at(-1) as { result: { persistenceStatus: string } };
    expect(result.result.persistenceStatus).toBe("pending");
    expect(await ctx.storage.getAlarm()).not.toBeNull();

    const stored = (await ctx.storage.get("event:evt-1")) as { persistenceStatus: string; retryCount: number };
    expect(stored.persistenceStatus).toBe("pending");
    expect(stored.retryCount).toBe(1);
  });

  it("classifies a 401 (HMAC/signature failure) as retryable, not terminal — a transient request-level problem must not permanently give up on the event's data", async () => {
    const { instance, ctx, ws } = await setUpConnectedObject("match-1");
    await authenticate(instance, ws, { matchId: "match-1", sessionId: "session-1", organisationId: "org-1", userId: "user-1" });

    mockPersistEvent.mockRejectedValueOnce(new TestPersistEventError("Invalid signature", 401));

    await instance.webSocketMessage(
      ws as unknown as WebSocket,
      rpc("rec-1", "recordEvent", { clientEventId: "evt-1", baseVersion: 0, event: { eventType: "GOAL_FOR" } }),
    );

    const result = ws.sent.at(-1) as { result: { persistenceStatus: string } };
    expect(result.result.persistenceStatus).toBe("pending");
    expect(await ctx.storage.getAlarm()).not.toBeNull();

    const stored = (await ctx.storage.get("event:evt-1")) as { persistenceStatus: string; retryCount: number };
    expect(stored.persistenceStatus).toBe("pending");
    expect(stored.retryCount).toBe(1);
  });

  it("classifies a 422 (domain rejection) as terminal: marks failed_terminal immediately, no alarm scheduled, broadcasts eventPersistenceChanged", async () => {
    const { instance, ctx, ws } = await setUpConnectedObject("match-1");
    await authenticate(instance, ws, { matchId: "match-1", sessionId: "session-1", organisationId: "org-1", userId: "user-1" });

    mockPersistEvent.mockRejectedValueOnce(new TestPersistEventError("Session not active", 422));

    await instance.webSocketMessage(
      ws as unknown as WebSocket,
      rpc("rec-1", "recordEvent", { clientEventId: "evt-1", baseVersion: 0, event: { eventType: "GOAL_FOR" } }),
    );

    const result = ws.sent.find((m) => (m as { id?: string }).id === "rec-1") as { result: { persistenceStatus: string } };
    expect(result.result.persistenceStatus).toBe("failed_terminal");
    // No *retry* alarm remains for this event (it's terminal, never retried) — but the session
    // itself is still active with an unknown expectedEndAt, so a far-future lifecycle-check
    // alarm legitimately remains armed (2026-09 incident hardening). It must not be scheduled
    // anywhere near "soon" the way a retry would be.
    const alarmTime = await ctx.storage.getAlarm();
    expect(alarmTime).not.toBeNull();
    expect(alarmTime!).toBeGreaterThan(Date.now() + LIFECYCLE_FALLBACK_CEILING_MS);

    const stored = (await ctx.storage.get("event:evt-1")) as { persistenceStatus: string };
    expect(stored.persistenceStatus).toBe("failed_terminal");

    const broadcast = ws.sent.find((m) => (m as { method?: string }).method === "eventPersistenceChanged");
    expect((broadcast as { params: { persistenceStatus: string } }).params.persistenceStatus).toBe("failed_terminal");
  });

  it("alarm() retries every due pending event, persists the ones that succeed, and re-arms for the rest", async () => {
    const { instance, ctx, ws } = await setUpConnectedObject("match-1");
    await authenticate(instance, ws, { matchId: "match-1", sessionId: "session-1", organisationId: "org-1", userId: "user-1" });

    mockPersistEvent.mockRejectedValueOnce(new TestPersistEventError("Neon unavailable", 503));
    await instance.webSocketMessage(
      ws as unknown as WebSocket,
      rpc("rec-1", "recordEvent", { clientEventId: "evt-1", baseVersion: 0, event: { eventType: "GOAL_FOR" } }),
    );
    expect(((await ctx.storage.get("event:evt-1")) as { persistenceStatus: string }).persistenceStatus).toBe("pending");

    mockPersistEvent.mockResolvedValueOnce({ id: "canonical-1", clientEventId: "evt-1", eventType: "GOAL_FOR", createdAt: "2026-08-23T00:00:00.000Z" });
    advancePastFirstRetry();
    await instance.alarm();

    const stored = (await ctx.storage.get("event:evt-1")) as { persistenceStatus: string; canonicalEventId: string };
    expect(stored.persistenceStatus).toBe("persisted");
    expect(stored.canonicalEventId).toBe("canonical-1");
    // No *retry* alarm remains (the event persisted) — but a far-future lifecycle-check alarm
    // legitimately remains armed for the still-active session (2026-09 incident hardening).
    const alarmTime = await ctx.storage.getAlarm();
    expect(alarmTime).not.toBeNull();
    expect(alarmTime!).toBeGreaterThan(Date.now() + LIFECYCLE_FALLBACK_CEILING_MS);

    const broadcast = ws.sent.find((m) => (m as { method?: string }).method === "eventPersistenceChanged" && (m as { params: { persistenceStatus: string } }).params.persistenceStatus === "persisted");
    expect(broadcast).toBeDefined();
  });

  it("alarm() retry resends the full original event fields, not just eventType", async () => {
    const { instance, ctx, ws } = await setUpConnectedObject("match-1");
    await authenticate(instance, ws, { matchId: "match-1", sessionId: "session-1", organisationId: "org-1", userId: "user-1" });

    mockPersistEvent.mockRejectedValueOnce(new TestPersistEventError("Neon unavailable", 503));
    await instance.webSocketMessage(
      ws as unknown as WebSocket,
      rpc("rec-1", "recordEvent", {
        clientEventId: "evt-1",
        baseVersion: 0,
        event: { eventType: "GOAL_FOR", playerId: "player-42", matchSeconds: 1234, period: "FIRST_HALF" },
      }),
    );

    mockPersistEvent.mockResolvedValueOnce({ id: "canonical-1", clientEventId: "evt-1", eventType: "GOAL_FOR", createdAt: "2026-08-23T00:00:00.000Z" });
    advancePastFirstRetry();
    await instance.alarm();

    expect(mockPersistEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        body: expect.objectContaining({
          clientEventId: "evt-1",
          eventType: "GOAL_FOR",
          playerId: "player-42",
          matchSeconds: 1234,
          period: "FIRST_HALF",
        }),
      }),
    );
  });

  it("alarm() is idempotent: invoking it twice for an already-persisted event does not call persistEvent again", async () => {
    const { instance, ctx, ws } = await setUpConnectedObject("match-1");
    await authenticate(instance, ws, { matchId: "match-1", sessionId: "session-1", organisationId: "org-1", userId: "user-1" });

    mockPersistEvent.mockRejectedValueOnce(new TestPersistEventError("Neon unavailable", 503));
    await instance.webSocketMessage(
      ws as unknown as WebSocket,
      rpc("rec-1", "recordEvent", { clientEventId: "evt-1", baseVersion: 0, event: { eventType: "GOAL_FOR" } }),
    );

    mockPersistEvent.mockResolvedValueOnce({ id: "canonical-1", clientEventId: "evt-1", eventType: "GOAL_FOR", createdAt: "2026-08-23T00:00:00.000Z" });
    advancePastFirstRetry();
    await instance.alarm();
    expect(mockPersistEvent).toHaveBeenCalledTimes(2); // 1 synchronous attempt + 1 retry

    // A second alarm firing (Cloudflare's own "alarms may be retried" — simulate a duplicate
    // invocation) must not re-attempt an event that's already persisted.
    advancePastFirstRetry();
    await instance.alarm();
    expect(mockPersistEvent).toHaveBeenCalledTimes(2);

    void ctx;
  });

  it("gives up after the bounded retry ceiling instead of retrying forever (2026-09 production incident regression)", async () => {
    // Regression test for the actual root cause: every persistence attempt returning a
    // non-terminal status (the incident's own HTTP 307, a Vercel auth-gate redirect) forever,
    // because classifyPersistenceFailure only treats 422 as terminal and computeBackoffDelayMs
    // alone never stops trying. evaluateRetry's bounded ceiling is what actually guarantees this
    // object's alarm traffic is finite regardless of the specific failure cause, current or
    // future.
    const { instance, ctx, ws } = await setUpConnectedObject("match-1");
    await authenticate(instance, ws, { matchId: "match-1", sessionId: "session-1", organisationId: "org-1", userId: "user-1" });

    mockPersistEvent.mockRejectedValue(new TestPersistEventError("Redirected by auth gate", 307));
    await instance.webSocketMessage(
      ws as unknown as WebSocket,
      rpc("rec-1", "recordEvent", { clientEventId: "evt-1", baseVersion: 0, event: { eventType: "GOAL_FOR" } }),
    );

    // One synchronous attempt already happened; drive exactly MAX_RETRY_ATTEMPTS alarm-driven
    // retries (each one still failing the same way) to reach the ceiling.
    for (let i = 0; i < MAX_RETRY_ATTEMPTS; i++) {
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 120_000);
      await instance.alarm();
    }

    const stored = (await ctx.storage.get("event:evt-1")) as {
      persistenceStatus: string;
      retryCount: number;
      nextRetryAt?: number;
      lastErrorStatus?: number;
    };
    expect(stored.persistenceStatus).toBe("failed_exhausted");
    expect(stored.nextRetryAt).toBeUndefined();
    expect(stored.lastErrorStatus).toBe(307);

    const broadcast = ws.sent.find(
      (m) => (m as { method?: string }).method === "eventPersistenceChanged" &&
        (m as { params: { persistenceStatus: string } }).params.persistenceStatus === "failed_exhausted",
    );
    expect(broadcast).toBeDefined();

    // The event is permanently excluded from selectDueRetries/nextAlarmTime from here on — no
    // further attempts, no matter how many more times alarm() fires or time advances.
    const callsSoFar = mockPersistEvent.mock.calls.length;
    vi.setSystemTime(Date.now() + 10 * 60 * 60 * 1000);
    await instance.alarm();
    expect(mockPersistEvent).toHaveBeenCalledTimes(callsSoFar);
  });
});

describe("MatchSessionObject — finite session lifecycle (2026-09 incident hardening)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetchSnapshot.mockResolvedValue({ session: { sessionId: "session-1", matchId: "match-1", status: "ACTIVE" }, events: [] });
  });

  it("auto-expires a session with no reporting activity past its expected end + grace, without ever calling the persistence/report APIs", async () => {
    const { instance, ctx, ws } = await setUpConnectedObject("match-1");
    const expectedEndAt = Date.now() + 60 * 60 * 1000; // kickoff + 1h, as a stand-in duration
    const ticket = await signRealtimeTicket(
      { userId: "user-1", organisationId: "org-1", matchId: "match-1", sessionId: "session-1", capabilities: ["report"], expectedEndAt },
      REALTIME_SECRET,
    );
    await instance.webSocketMessage(
      ws as unknown as WebSocket,
      JSON.stringify({ protocol: 1, kind: "call", id: "auth-1", method: "authenticate", params: { ticket, clientId: "client-1" } }),
    );

    // Simulate the browser going away without ever calling endSession — no recordEvent ever
    // happens, so lastActivityAt never advances past session start.
    vi.useFakeTimers();
    vi.setSystemTime(expectedEndAt + LIFECYCLE_GRACE_MS + LIFECYCLE_INACTIVITY_AFTER_DEADLINE_MS);
    await instance.alarm();

    const meta = (await ctx.storage.get("meta")) as { endedAt: number | null; endReason?: string };
    expect(meta.endedAt).not.toBeNull();
    expect(meta.endReason).toBe("AUTO_EXPIRED");

    // This must be pure transport/session bookkeeping — never a canonical persistence or
    // report-related call of any kind.
    expect(mockPersistEvent).not.toHaveBeenCalled();

    const broadcast = ws.sent.find((m) => (m as { method?: string }).method === "sessionEnded");
    expect((broadcast as { params: { reason?: string } }).params.reason).toBe("AUTO_EXPIRED");

    // No further alarm activity continues for an ended session.
    expect(await ctx.storage.getAlarm()).toBeNull();
  });

  it("does not expire while reporting activity continues past the expected end (e.g. a match running long)", async () => {
    const { instance, ctx, ws } = await setUpConnectedObject("match-1");
    const expectedEndAt = Date.now() + 60 * 60 * 1000;
    const ticket = await signRealtimeTicket(
      { userId: "user-1", organisationId: "org-1", matchId: "match-1", sessionId: "session-1", capabilities: ["report"], expectedEndAt },
      REALTIME_SECRET,
    );
    await instance.webSocketMessage(
      ws as unknown as WebSocket,
      JSON.stringify({ protocol: 1, kind: "call", id: "auth-1", method: "authenticate", params: { ticket, clientId: "client-1" } }),
    );

    mockPersistEvent.mockResolvedValue({ id: "canonical-1", clientEventId: "evt-1", eventType: "GOAL_FOR", createdAt: "2026-08-23T00:00:00.000Z" });

    vi.useFakeTimers();
    vi.setSystemTime(expectedEndAt + LIFECYCLE_GRACE_MS + 1);
    // A recordEvent right at the deadline is genuine, recent reporting activity.
    await instance.webSocketMessage(
      ws as unknown as WebSocket,
      rpc("rec-1", "recordEvent", { clientEventId: "evt-1", baseVersion: 0, event: { eventType: "GOAL_FOR" } }),
    );

    vi.setSystemTime(Date.now() + LIFECYCLE_INACTIVITY_AFTER_DEADLINE_MS - 1_000);
    await instance.alarm();

    const meta = (await ctx.storage.get("meta")) as { endedAt: number | null };
    expect(meta.endedAt).toBeNull();
  });

  it("a Follow Live (view-only) connection's presence never keeps an abandoned reporting session alive", async () => {
    const { instance, ctx, ws } = await setUpConnectedObject("match-1");
    const expectedEndAt = Date.now() + 60 * 60 * 1000;
    const reportTicket = await signRealtimeTicket(
      { userId: "user-1", organisationId: "org-1", matchId: "match-1", sessionId: "session-1", capabilities: ["report"], expectedEndAt },
      REALTIME_SECRET,
    );
    await instance.webSocketMessage(
      ws as unknown as WebSocket,
      JSON.stringify({ protocol: 1, kind: "call", id: "auth-1", method: "authenticate", params: { ticket: reportTicket, clientId: "client-1" } }),
    );

    // A second, view-only ("Follow live") connection stays attached the whole time. Its mere
    // presence must not advance lastActivityAt or otherwise block expiry.
    const viewerWs = new FakeWebSocket();
    const viewTicket = await signRealtimeTicket(
      { userId: "user-2", organisationId: "org-1", matchId: "match-1", sessionId: "session-1", capabilities: ["view"], expectedEndAt },
      REALTIME_SECRET,
    );
    await instance.webSocketMessage(
      viewerWs as unknown as WebSocket,
      JSON.stringify({ protocol: 1, kind: "call", id: "auth-2", method: "authenticate", params: { ticket: viewTicket, clientId: "client-2" } }),
    );

    vi.useFakeTimers();
    vi.setSystemTime(expectedEndAt + LIFECYCLE_GRACE_MS + LIFECYCLE_INACTIVITY_AFTER_DEADLINE_MS);
    await instance.alarm();

    const meta = (await ctx.storage.get("meta")) as { endedAt: number | null; endReason?: string };
    expect(meta.endedAt).not.toBeNull();
    expect(meta.endReason).toBe("AUTO_EXPIRED");
  });

  it("never auto-expires a session created before startedAt/lastActivityAt existed (defensive backward compatibility)", async () => {
    const { instance, ctx, ws } = await setUpConnectedObject("match-1");
    await authenticate(instance, ws, { matchId: "match-1", sessionId: "session-1", organisationId: "org-1", userId: "user-1" });

    // Simulate a meta row written by a pre-hardening deploy: no startedAt/expectedEndAt/
    // lastActivityAt at all.
    const meta = (await ctx.storage.get("meta")) as Record<string, unknown>;
    delete meta.startedAt;
    delete meta.expectedEndAt;
    delete meta.lastActivityAt;
    await ctx.storage.put("meta", meta);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 365 * 24 * 60 * 60 * 1000); // one year later
    await instance.alarm();

    const stored = (await ctx.storage.get("meta")) as { endedAt: number | null };
    expect(stored.endedAt).toBeNull();
  });
});

describe("MatchSessionObject — reconciliation (SPEC.md §23, Stage 6)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetchSnapshot.mockResolvedValue({ session: { sessionId: "session-1", matchId: "match-1", status: "ACTIVE" }, events: [] });
  });

  it("discovers an HTTP-fallback-written event on initial authenticate and includes it in the next snapshot", async () => {
    mockFetchSnapshot.mockResolvedValueOnce({
      session: { sessionId: "session-1", matchId: "match-1", status: "ACTIVE" },
      events: [{ id: "canon-http-1", clientEventId: "http-evt-1", eventType: "GOAL_FOR", createdAt: "2026-08-23T00:00:00.000Z" }],
    });

    const { instance, ws } = await setUpConnectedObject("match-1");
    await authenticate(instance, ws, { matchId: "match-1", sessionId: "session-1", organisationId: "org-1", userId: "user-1" });

    expect(mockFetchSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ matchId: "match-1", sessionId: "session-1" }),
    );

    await instance.webSocketMessage(ws as unknown as WebSocket, rpc("snap-1", "getSnapshot", {}));
    const snapshotResult = ws.sent.find((m) => (m as { id?: string }).id === "snap-1") as {
      result: { version: number; events: Array<{ clientEventId: string }> };
    };
    expect(snapshotResult.result.version).toBe(1);
    expect(snapshotResult.result.events.map((e) => e.clientEventId)).toEqual(["http-evt-1"]);
  });

  it("does not re-reconcile on a plain reconnect (attach) to an already-initialized session", async () => {
    const { instance, ws } = await setUpConnectedObject("match-1");
    await authenticate(instance, ws, { matchId: "match-1", sessionId: "session-1", organisationId: "org-1", userId: "user-1" });
    expect(mockFetchSnapshot).toHaveBeenCalledTimes(1);

    const ws2 = new FakeWebSocket();
    // Second connection to the same already-initialized session — this is an "attach", not
    // an "initialize" (see evaluateAuthenticate in state.ts).
    await authenticate(instance, ws2, { matchId: "match-1", sessionId: "session-1", organisationId: "org-1", userId: "user-2" });
    expect(mockFetchSnapshot).toHaveBeenCalledTimes(1);
  });

  it("a reconciliation fetch failure does not block authentication", async () => {
    mockFetchSnapshot.mockRejectedValueOnce(new Error("network error"));
    const { instance, ws } = await setUpConnectedObject("match-1");

    const result = await authenticate(instance, ws, { matchId: "match-1", sessionId: "session-1", organisationId: "org-1", userId: "user-1" });
    expect((result as { result: { authenticated: boolean } }).result.authenticated).toBe(true);
  });
});

describe("MatchSessionObject — end-session pending checks resolve for real (SPEC.md §29, Stage 6)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetchSnapshot.mockResolvedValue({ session: { sessionId: "session-1", matchId: "match-1", status: "ACTIVE" }, events: [] });
  });

  it("blocks ending while a retryable failure is still pending, then succeeds once the alarm retry resolves it", async () => {
    const { instance, ws } = await setUpConnectedObject("match-1");
    await authenticate(instance, ws, { matchId: "match-1", sessionId: "session-1", organisationId: "org-1", userId: "user-1" });

    mockPersistEvent.mockRejectedValueOnce(new TestPersistEventError("Neon unavailable", 503));
    await instance.webSocketMessage(
      ws as unknown as WebSocket,
      rpc("rec-1", "recordEvent", { clientEventId: "evt-1", baseVersion: 0, event: { eventType: "GOAL_FOR" } }),
    );

    await instance.webSocketMessage(ws as unknown as WebSocket, rpc("end-1", "endSession", { baseVersion: 1 }));
    const blocked = ws.sent.find((m) => (m as { id?: string }).id === "end-1") as { ok: boolean; error: { code: string } };
    expect(blocked.ok).toBe(false);
    expect(blocked.error.code).toBe("PERSISTENCE_UNAVAILABLE");

    mockPersistEvent.mockResolvedValueOnce({ id: "canonical-1", clientEventId: "evt-1", eventType: "GOAL_FOR", createdAt: "2026-08-23T00:00:00.000Z" });
    advancePastFirstRetry();
    await instance.alarm();

    await instance.webSocketMessage(ws as unknown as WebSocket, rpc("end-2", "endSession", { baseVersion: 1 }));
    const ended = ws.sent.find((m) => (m as { id?: string }).id === "end-2") as { ok: boolean; result?: { ended: boolean } };
    expect(ended.ok).toBe(true);
    expect(ended.result?.ended).toBe(true);
  });
});
