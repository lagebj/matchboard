import { describe, expect, it } from "vitest";
import {
  classifyEventType,
  evaluateAuthenticate,
  evaluateRecordEvent,
  evaluateSyncPending,
  evaluateEndSession,
  initialClockAnchor,
  type SessionMeta,
  type AcceptedEventRecord,
} from "../src/state";

function makeMeta(overrides: Partial<SessionMeta> = {}): SessionMeta {
  return {
    matchId: "match-1",
    sessionId: "session-1",
    organisationId: "org-1",
    version: 5,
    clockAnchor: initialClockAnchor(1000),
    endedAt: null,
    ...overrides,
  };
}

function makeRecord(overrides: Partial<AcceptedEventRecord> = {}): AcceptedEventRecord {
  return {
    clientEventId: "client-evt-1",
    version: 6,
    actorUserId: "user-1",
    acceptedAt: 1000,
    persistenceStatus: "pending",
    retryCount: 0,
    ...overrides,
  };
}

describe("classifyEventType", () => {
  it("classifies SPEC.md §9.2's named events as state-sensitive", () => {
    for (const type of [
      "MATCH_START",
      "PERIOD_START",
      "PERIOD_END",
      "MATCH_END",
      "CLOCK_ADJUSTMENT",
      "ROTATION_OUT",
      "ROTATION_IN",
      "POSITIONS_CHANGED",
      "EVENT_CORRECTED",
      "EVENT_REVERSED",
    ]) {
      expect(classifyEventType(type)).toBe("state-sensitive");
    }
  });

  it("classifies everything else as append-safe by default (SPEC.md §9.1)", () => {
    for (const type of ["GOAL_FOR", "GOAL_AGAINST", "SCORER_SET", "ASSIST_SET", "FAIR_PLAY_POSITIVE", "FAIR_PLAY_CONCERN", "MOMENT_MARKED", "SOME_FUTURE_EVENT_TYPE"]) {
      expect(classifyEventType(type)).toBe("append-safe");
    }
  });
});

describe("evaluateAuthenticate", () => {
  it("initializes fresh meta on first authenticate for a match", () => {
    const decision = evaluateAuthenticate({
      routedMatchId: "match-1",
      ticket: { matchId: "match-1", sessionId: "session-1", organisationId: "org-1" },
      existingMeta: null,
      now: 1000,
    });
    expect(decision.outcome).toBe("initialize");
    if (decision.outcome === "initialize") {
      expect(decision.meta).toEqual({
        matchId: "match-1",
        sessionId: "session-1",
        organisationId: "org-1",
        version: 0,
        clockAnchor: initialClockAnchor(1000),
        endedAt: null,
      });
    }
  });

  it("attaches to an existing active session with matching claims", () => {
    const decision = evaluateAuthenticate({
      routedMatchId: "match-1",
      ticket: { matchId: "match-1", sessionId: "session-1", organisationId: "org-1" },
      existingMeta: makeMeta(),
      now: 2000,
    });
    expect(decision.outcome).toBe("attach");
  });

  it("rejects a ticket whose matchId does not match the routed matchId", () => {
    const decision = evaluateAuthenticate({
      routedMatchId: "match-1",
      ticket: { matchId: "match-2", sessionId: "session-1", organisationId: "org-1" },
      existingMeta: null,
      now: 1000,
    });
    expect(decision.outcome).toBe("match_mismatch");
  });

  it("rejects a different sessionId while the existing session is still active", () => {
    const decision = evaluateAuthenticate({
      routedMatchId: "match-1",
      ticket: { matchId: "match-1", sessionId: "session-OTHER", organisationId: "org-1" },
      existingMeta: makeMeta({ endedAt: null }),
      now: 2000,
    });
    expect(decision.outcome).toBe("session_mismatch");
  });

  it("rejects a mismatched organisationId even when sessionId matches", () => {
    const decision = evaluateAuthenticate({
      routedMatchId: "match-1",
      ticket: { matchId: "match-1", sessionId: "session-1", organisationId: "org-OTHER" },
      existingMeta: makeMeta(),
      now: 2000,
    });
    expect(decision.outcome).toBe("session_mismatch");
  });

  it("re-arms (initializes fresh meta) for a new session once the previous one ended", () => {
    const decision = evaluateAuthenticate({
      routedMatchId: "match-1",
      ticket: { matchId: "match-1", sessionId: "session-2", organisationId: "org-1" },
      existingMeta: makeMeta({ endedAt: 5000 }),
      now: 6000,
    });
    expect(decision.outcome).toBe("initialize");
    if (decision.outcome === "initialize") {
      expect(decision.meta.sessionId).toBe("session-2");
      expect(decision.meta.version).toBe(0);
    }
  });
});

describe("evaluateRecordEvent", () => {
  it("rejects any mutation once the session has ended", () => {
    const decision = evaluateRecordEvent({
      meta: makeMeta({ endedAt: 9999 }),
      existing: undefined,
      clientEventId: "c1",
      baseVersion: 5,
      eventType: "GOAL_FOR",
      actorUserId: "user-1",
      now: 1000,
    });
    expect(decision.outcome).toBe("session_ended");
  });

  it("returns the existing record for a duplicate clientEventId without advancing version", () => {
    const existing = makeRecord();
    const decision = evaluateRecordEvent({
      meta: makeMeta(),
      existing,
      clientEventId: existing.clientEventId,
      baseVersion: 5,
      eventType: "GOAL_FOR",
      actorUserId: "user-1",
      now: 2000,
    });
    expect(decision).toEqual({ outcome: "duplicate", existing });
  });

  it("rejects a missing/invalid eventType", () => {
    const decision = evaluateRecordEvent({
      meta: makeMeta(),
      existing: undefined,
      clientEventId: "c1",
      baseVersion: 5,
      eventType: undefined,
      actorUserId: "user-1",
      now: 1000,
    });
    expect(decision.outcome).toBe("invalid");
  });

  it("accepts an append-safe event even when baseVersion is behind current", () => {
    const decision = evaluateRecordEvent({
      meta: makeMeta({ version: 10 }),
      existing: undefined,
      clientEventId: "c1",
      baseVersion: 3,
      eventType: "GOAL_FOR",
      actorUserId: "user-1",
      now: 1000,
    });
    expect(decision.outcome).toBe("accepted");
    if (decision.outcome === "accepted") {
      expect(decision.record.version).toBe(11);
      expect(decision.record.persistenceStatus).toBe("pending");
    }
  });

  it("rejects a state-sensitive event whose baseVersion is stale", () => {
    const decision = evaluateRecordEvent({
      meta: makeMeta({ version: 10 }),
      existing: undefined,
      clientEventId: "c1",
      baseVersion: 9,
      eventType: "PERIOD_START",
      actorUserId: "user-1",
      now: 1000,
    });
    expect(decision).toEqual({ outcome: "stale_state", currentVersion: 10 });
  });

  it("accepts a state-sensitive event whose baseVersion exactly matches current", () => {
    const decision = evaluateRecordEvent({
      meta: makeMeta({ version: 10 }),
      existing: undefined,
      clientEventId: "c1",
      baseVersion: 10,
      eventType: "PERIOD_START",
      actorUserId: "user-1",
      now: 1000,
    });
    expect(decision.outcome).toBe("accepted");
    if (decision.outcome === "accepted") {
      expect(decision.record.version).toBe(11);
    }
  });

  it("assigns contiguous versions for successive accepted events", () => {
    let meta = makeMeta({ version: 0 });
    const versions: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const decision = evaluateRecordEvent({
        meta,
        existing: undefined,
        clientEventId: `c${i}`,
        baseVersion: meta.version,
        eventType: "GOAL_FOR",
        actorUserId: "user-1",
        now: 1000 + i,
      });
      expect(decision.outcome).toBe("accepted");
      if (decision.outcome === "accepted") {
        versions.push(decision.record.version);
        meta = { ...meta, version: decision.record.version };
      }
    }
    expect(versions).toEqual([1, 2, 3]);
  });
});

describe("evaluateSyncPending", () => {
  it("returns only the ids the object has already accepted", () => {
    const accepted = new Map<string, AcceptedEventRecord>([
      ["a", makeRecord({ clientEventId: "a" })],
      ["b", makeRecord({ clientEventId: "b" })],
    ]);
    expect(evaluateSyncPending(["a", "b", "c"], accepted)).toEqual(["a", "b"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(evaluateSyncPending(["x"], new Map())).toEqual([]);
  });
});

describe("evaluateEndSession", () => {
  it("rejects ending an already-ended session", () => {
    const decision = evaluateEndSession({ meta: makeMeta({ endedAt: 1000 }), baseVersion: 5, pendingCount: 0 });
    expect(decision.outcome).toBe("already_ended");
  });

  it("rejects a stale baseVersion", () => {
    const decision = evaluateEndSession({ meta: makeMeta({ version: 10 }), baseVersion: 9, pendingCount: 0 });
    expect(decision).toEqual({ outcome: "stale_state", currentVersion: 10 });
  });

  it("refuses to end while events remain unpersisted", () => {
    const decision = evaluateEndSession({ meta: makeMeta({ version: 10 }), baseVersion: 10, pendingCount: 2 });
    expect(decision).toEqual({ outcome: "pending_persistence", pendingCount: 2 });
  });

  it("ends cleanly when baseVersion matches and nothing is pending", () => {
    const decision = evaluateEndSession({ meta: makeMeta({ version: 10 }), baseVersion: 10, pendingCount: 0 });
    expect(decision.outcome).toBe("ended");
  });
});
