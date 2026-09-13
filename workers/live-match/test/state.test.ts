import { describe, expect, it } from "vitest";
import {
  classifyEventType,
  classifyDomain,
  isKnownLiveMatchEventType,
  deriveLineupState,
  evaluateClockPrecondition,
  evaluateLineupPrecondition,
  evaluateAnnotationPrecondition,
  derivePositionChange,
  evaluateAuthenticate,
  evaluateRecordEvent,
  evaluateSyncPending,
  evaluateEndSession,
  hasReportCapability,
  initialClockAnchor,
  advanceClockAnchor,
  classifyPersistenceFailure,
  computeBackoffDelayMs,
  selectDueRetries,
  nextAlarmTime,
  evaluateReconciliation,
  evaluateRetry,
  MAX_RETRY_ATTEMPTS,
  MAX_RETRY_AGE_MS,
  evaluateLifecycleExpiry,
  LIFECYCLE_GRACE_MS,
  LIFECYCLE_FALLBACK_CEILING_MS,
  LIFECYCLE_INACTIVITY_AFTER_DEADLINE_MS,
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
    eventType: "GOAL_FOR",
    persistenceStatus: "pending",
    retryCount: 0,
    ...overrides,
  };
}

// ADR-0138 (Bundle 3), DECISIONS.md D09 — exhaustive classification replaces the previous
// Stage-3 catch-all. Confirmed real audit finding: SCORER_SET/ASSIST_SET were previously
// (incorrectly, per D09) classified as append-safe by the old catch-all default.
describe("classifyEventType / classifyDomain (DECISIONS.md D09)", () => {
  it("classifies append-safe events correctly", () => {
    for (const type of ["GOAL_FOR", "GOAL_AGAINST", "FAIR_PLAY_POSITIVE", "FAIR_PLAY_CONCERN", "MOMENT_MARKED"] as const) {
      expect(classifyDomain(type)).toBe("append-safe");
      expect(classifyEventType(type)).toBe("append-safe");
    }
  });

  it("classifies clock-domain events as state-sensitive", () => {
    for (const type of ["MATCH_START", "PERIOD_START", "PERIOD_END", "MATCH_END", "CLOCK_ADJUSTMENT"] as const) {
      expect(classifyDomain(type)).toBe("clock");
      expect(classifyEventType(type)).toBe("state-sensitive");
    }
  });

  it("classifies lineup-domain events as state-sensitive", () => {
    for (const type of ["ROTATION_OUT", "ROTATION_IN", "POSITIONS_CHANGED"] as const) {
      expect(classifyDomain(type)).toBe("lineup");
      expect(classifyEventType(type)).toBe("state-sensitive");
    }
  });

  it("classifies annotation-domain events as state-sensitive, including SCORER_SET/ASSIST_SET (D09 — previously misclassified as append-safe)", () => {
    for (const type of ["SCORER_SET", "ASSIST_SET", "EVENT_CORRECTED", "EVENT_REVERSED"] as const) {
      expect(classifyDomain(type)).toBe("annotation");
      expect(classifyEventType(type)).toBe("state-sensitive");
    }
  });

  it("a new/unrecognized event type is never silently treated as a known type — the exact Stage-3 catch-all gap this bundle closes", () => {
    expect(isKnownLiveMatchEventType("SOME_FUTURE_EVENT_TYPE")).toBe(false);
    expect(isKnownLiveMatchEventType("")).toBe(false);
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
        startedAt: 1000,
        expectedEndAt: null,
        lastActivityAt: 1000,
        clockRevision: 0,
        lineupRevision: 0,
        annotationRevision: 0,
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
      acceptedEvents: [],
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
      acceptedEvents: [existing],
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
      acceptedEvents: [],
      clientEventId: "c1",
      baseVersion: 5,
      eventType: undefined,
      actorUserId: "user-1",
      now: 1000,
    });
    expect(decision.outcome).toBe("invalid");
  });

  it("rejects an unrecognized event type rather than silently treating it as append-safe (D09)", () => {
    const decision = evaluateRecordEvent({
      meta: makeMeta(),
      existing: undefined,
      acceptedEvents: [],
      clientEventId: "c1",
      baseVersion: 5,
      eventType: "SOME_FUTURE_EVENT_TYPE",
      actorUserId: "user-1",
      now: 1000,
    });
    expect(decision.outcome).toBe("invalid");
  });

  it("accepts an append-safe event even when baseVersion is behind current — an unrelated goal must never invalidate a pending action (D08)", () => {
    const decision = evaluateRecordEvent({
      meta: makeMeta({ version: 10 }),
      existing: undefined,
      acceptedEvents: [],
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
      expect(decision.domain).toBe("append-safe");
    }
  });

  it("accepts a state-sensitive event whose baseVersion is stale, as long as its actual precondition still holds (D08/D10 — replaces the old whole-state baseVersion gate)", () => {
    const decision = evaluateRecordEvent({
      meta: makeMeta({ version: 10 }),
      existing: undefined,
      acceptedEvents: [],
      clientEventId: "c1",
      baseVersion: 3, // deliberately stale — must not matter
      eventType: "PERIOD_START",
      eventFields: { period: "FIRST_HALF" },
      actorUserId: "user-1",
      now: 1000,
    });
    expect(decision.outcome).toBe("accepted");
    if (decision.outcome === "accepted") {
      expect(decision.record.version).toBe(11);
      expect(decision.domain).toBe("clock");
    }
  });

  it("rejects a state-sensitive event whose semantic precondition genuinely does not hold, even with a fresh baseVersion", () => {
    const rotatedOut = makeRecord({
      clientEventId: "rot-out-1",
      version: 6,
      eventType: "ROTATION_OUT",
      eventFields: { playerId: "henrik" },
      persistenceStatus: "persisted",
    });
    const decision = evaluateRecordEvent({
      meta: makeMeta({ version: 6 }),
      existing: undefined,
      acceptedEvents: [rotatedOut],
      clientEventId: "rot-out-2",
      baseVersion: 6, // fresh — must not matter either
      eventType: "ROTATION_OUT",
      eventFields: { playerId: "henrik" },
      actorUserId: "user-1",
      now: 1000,
    });
    expect(decision).toEqual({ outcome: "conflict", conflictCode: "PLAYER_ALREADY_OFF_FIELD", currentVersion: 6 });
  });

  it("concurrent goal + rotation both accepted — the goal does not invalidate the rotation (PROGRAMME.md worked example)", () => {
    let meta = makeMeta({ version: 20 });
    const goalDecision = evaluateRecordEvent({
      meta,
      existing: undefined,
      acceptedEvents: [],
      clientEventId: "goal-1",
      baseVersion: 20,
      eventType: "GOAL_FOR",
      actorUserId: "user-a",
      now: 1000,
    });
    expect(goalDecision.outcome).toBe("accepted");
    if (goalDecision.outcome !== "accepted") return;
    meta = { ...meta, version: goalDecision.record.version }; // append-safe: no revision bump

    const rotationDecision = evaluateRecordEvent({
      meta, // Coach B still has an older sequence (20), but the goal never touched lineupRevision
      existing: undefined,
      acceptedEvents: [goalDecision.record],
      clientEventId: "rot-1",
      baseVersion: 20,
      eventType: "ROTATION_OUT",
      eventFields: { playerId: "someone-never-touched" },
      actorUserId: "user-b",
      now: 1001,
    });
    expect(rotationDecision.outcome).toBe("accepted");
  });

  it("assigns contiguous versions for successive accepted events", () => {
    let meta = makeMeta({ version: 0 });
    const versions: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const decision = evaluateRecordEvent({
        meta,
        existing: undefined,
        acceptedEvents: [],
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

  it("threads eventFields through into the accepted record, so a later alarm retry can resend the full original payload", () => {
    const decision = evaluateRecordEvent({
      meta: makeMeta(),
      existing: undefined,
      acceptedEvents: [],
      clientEventId: "c1",
      baseVersion: 5,
      eventType: "GOAL_FOR",
      eventFields: { eventType: "GOAL_FOR", playerId: "player-1", matchSeconds: 900 },
      actorUserId: "user-1",
      now: 1000,
    });
    expect(decision.outcome).toBe("accepted");
    if (decision.outcome === "accepted") {
      expect(decision.record.eventFields).toEqual({ eventType: "GOAL_FOR", playerId: "player-1", matchSeconds: 900 });
    }
  });
});

describe("deriveLineupState (ADR-0138, Bundle 3)", () => {
  it("starts with no on-field or touched players", () => {
    const state = deriveLineupState([]);
    expect(state.onFieldPlayerIds.size).toBe(0);
    expect(state.touchedPlayerIds.size).toBe(0);
  });

  it("tracks a player as on-field after ROTATION_IN and off-field after ROTATION_OUT", () => {
    const events = [
      makeRecord({ clientEventId: "a", version: 1, eventType: "ROTATION_IN", eventFields: { playerId: "oliver" }, persistenceStatus: "persisted" }),
      makeRecord({ clientEventId: "b", version: 2, eventType: "ROTATION_OUT", eventFields: { playerId: "oliver" }, persistenceStatus: "persisted" }),
    ];
    const state = deriveLineupState(events);
    expect(state.onFieldPlayerIds.has("oliver")).toBe(false);
    expect(state.touchedPlayerIds.has("oliver")).toBe(true);
  });

  it("ignores a terminally-failed event — it will never exist in Neon", () => {
    const events = [
      makeRecord({ clientEventId: "a", version: 1, eventType: "ROTATION_OUT", eventFields: { playerId: "henrik" }, persistenceStatus: "failed_terminal" }),
    ];
    const state = deriveLineupState(events);
    expect(state.touchedPlayerIds.has("henrik")).toBe(false);
  });

  it("orders by version, not array order, when computing the final state", () => {
    const events = [
      makeRecord({ clientEventId: "b", version: 2, eventType: "ROTATION_OUT", eventFields: { playerId: "noah" }, persistenceStatus: "persisted" }),
      makeRecord({ clientEventId: "a", version: 1, eventType: "ROTATION_IN", eventFields: { playerId: "noah" }, persistenceStatus: "persisted" }),
    ];
    const state = deriveLineupState(events);
    expect(state.onFieldPlayerIds.has("noah")).toBe(false); // IN(v1) then OUT(v2) — final state is off
  });
});

describe("evaluateLineupPrecondition (ADR-0138, Bundle 3, DECISIONS.md D10)", () => {
  it("ROTATION_OUT for a never-touched player is permitted (open-world — no starting-lineup baseline yet, Bundle 5)", () => {
    const result = evaluateLineupPrecondition("ROTATION_OUT", { playerId: "unknown-player" }, { onFieldPlayerIds: new Set(), touchedPlayerIds: new Set() });
    expect(result).toEqual({ ok: true });
  });

  it("ROTATION_OUT for a player already rotated out earlier in this session is a conflict", () => {
    const result = evaluateLineupPrecondition(
      "ROTATION_OUT",
      { playerId: "henrik" },
      { onFieldPlayerIds: new Set(), touchedPlayerIds: new Set(["henrik"]) },
    );
    expect(result).toEqual({ ok: false, conflictCode: "PLAYER_ALREADY_OFF_FIELD" });
  });

  it("ROTATION_IN for a player currently on field is a conflict", () => {
    const result = evaluateLineupPrecondition(
      "ROTATION_IN",
      { playerId: "oliver" },
      { onFieldPlayerIds: new Set(["oliver"]), touchedPlayerIds: new Set(["oliver"]) },
    );
    expect(result).toEqual({ ok: false, conflictCode: "PLAYER_ALREADY_ON_FIELD" });
  });

  it("ROTATION_IN for a never-touched or currently-off player is permitted", () => {
    expect(evaluateLineupPrecondition("ROTATION_IN", { playerId: "noah" }, { onFieldPlayerIds: new Set(), touchedPlayerIds: new Set() })).toEqual({ ok: true });
  });

  // Bundle 5 (ADR-0138) — the real `POSITIONS_CHANGED` payload shape was confirmed as one event
  // per moved player (top-level `playerId`, `{ fromPosition, toPosition }` on `payload`), not a
  // batched `{ assignments: [...] }` array. The array shape asserted here before Bundle 5 never
  // actually occurred, so this precondition never fired in practice — fixed to the real shape.
  it("POSITIONS_CHANGED conflicts when the moved player was already rotated off in this session", () => {
    const result = evaluateLineupPrecondition(
      "POSITIONS_CHANGED",
      { playerId: "henrik", payload: { fromPosition: "CM", toPosition: "CB" } },
      { onFieldPlayerIds: new Set(), touchedPlayerIds: new Set(["henrik"]) },
    );
    expect(result).toEqual({ ok: false, conflictCode: "POSITION_ASSIGNMENT_CHANGED" });
  });

  it("POSITIONS_CHANGED for a player currently on field is permitted", () => {
    const result = evaluateLineupPrecondition(
      "POSITIONS_CHANGED",
      { playerId: "henrik", payload: { fromPosition: "CM", toPosition: "CB" } },
      { onFieldPlayerIds: new Set(["henrik"]), touchedPlayerIds: new Set(["henrik"]) },
    );
    expect(result).toEqual({ ok: true });
  });

  it("POSITIONS_CHANGED with no playerId never blocks", () => {
    expect(evaluateLineupPrecondition("POSITIONS_CHANGED", { somethingElse: true }, { onFieldPlayerIds: new Set(), touchedPlayerIds: new Set() })).toEqual({ ok: true });
  });
});

describe("derivePositionChange (ADR-0138 Bundle 5)", () => {
  it("derives fromPosition/toPosition for a POSITIONS_CHANGED payload", () => {
    expect(derivePositionChange("POSITIONS_CHANGED", { fromPosition: "CM", toPosition: "CB" })).toEqual({
      fromPosition: "CM",
      toPosition: "CB",
    });
  });

  it("treats a missing fromPosition as null, not a rejection", () => {
    expect(derivePositionChange("POSITIONS_CHANGED", { toPosition: "ST" })).toEqual({ fromPosition: null, toPosition: "ST" });
  });

  it("returns null for a non-POSITIONS_CHANGED event type, even with a payload shaped the same way", () => {
    expect(derivePositionChange("ROTATION_OUT", { fromPosition: "CM", toPosition: "CB" })).toBeNull();
  });

  it("returns null for a malformed or missing payload", () => {
    expect(derivePositionChange("POSITIONS_CHANGED", undefined)).toBeNull();
    expect(derivePositionChange("POSITIONS_CHANGED", { toPosition: 123 })).toBeNull();
    expect(derivePositionChange("POSITIONS_CHANGED", "not-an-object")).toBeNull();
  });
});

describe("evaluateClockPrecondition (ADR-0138, Bundle 3, DECISIONS.md D10)", () => {
  it("MATCH_START is legal only from BEFORE", () => {
    expect(evaluateClockPrecondition("MATCH_START", { period: "FIRST_HALF" }, "BEFORE")).toEqual({ ok: true });
    expect(evaluateClockPrecondition("MATCH_START", { period: "FIRST_HALF" }, "FIRST_HALF")).toEqual({
      ok: false,
      conflictCode: "ILLEGAL_PERIOD_TRANSITION",
    });
  });

  it("a forward period transition is legal", () => {
    expect(evaluateClockPrecondition("PERIOD_END", { period: "HALF_TIME" }, "FIRST_HALF")).toEqual({ ok: true });
    expect(evaluateClockPrecondition("PERIOD_START", { period: "SECOND_HALF" }, "HALF_TIME")).toEqual({ ok: true });
  });

  it("a backward period transition is illegal (a stale/reloaded device cannot move the clock backward)", () => {
    expect(evaluateClockPrecondition("PERIOD_START", { period: "FIRST_HALF" }, "SECOND_HALF")).toEqual({
      ok: false,
      conflictCode: "ILLEGAL_PERIOD_TRANSITION",
    });
  });

  it("a repeated transition to the same resulting period is a harmless no-op, not a hard conflict", () => {
    expect(evaluateClockPrecondition("MATCH_END", { period: "FULL_TIME" }, "FULL_TIME")).toEqual({ ok: true });
  });

  it("CLOCK_ADJUSTMENT never has a period-transition precondition", () => {
    expect(evaluateClockPrecondition("CLOCK_ADJUSTMENT", {}, "SECOND_HALF")).toEqual({ ok: true });
  });
});

describe("evaluateAnnotationPrecondition (ADR-0138, Bundle 3, DECISIONS.md D10)", () => {
  it("a target-less annotation (no correctsEventId) is always accepted", () => {
    expect(evaluateAnnotationPrecondition("SCORER_SET", { playerId: "p1" }, [])).toEqual({ ok: true });
  });

  it("reversing a missing target is a conflict", () => {
    const result = evaluateAnnotationPrecondition("EVENT_REVERSED", { correctsEventId: "goal-1" }, []);
    expect(result).toEqual({ ok: false, conflictCode: "TARGET_EVENT_MISSING" });
  });

  it("reversing an existing, not-yet-reversed target is accepted", () => {
    const goal = makeRecord({ clientEventId: "goal-1", version: 1, eventType: "GOAL_FOR", persistenceStatus: "persisted" });
    const result = evaluateAnnotationPrecondition("EVENT_REVERSED", { correctsEventId: "goal-1" }, [goal]);
    expect(result).toEqual({ ok: true });
  });

  it("reversing an already-reversed target is a conflict — idempotent, never a second active reversal", () => {
    const goal = makeRecord({ clientEventId: "goal-1", version: 1, eventType: "GOAL_FOR", persistenceStatus: "persisted" });
    const firstReversal = makeRecord({
      clientEventId: "rev-1",
      version: 2,
      eventType: "EVENT_REVERSED",
      eventFields: { correctsEventId: "goal-1" },
      persistenceStatus: "persisted",
    });
    const result = evaluateAnnotationPrecondition("EVENT_REVERSED", { correctsEventId: "goal-1" }, [goal, firstReversal]);
    expect(result).toEqual({ ok: false, conflictCode: "TARGET_EVENT_ALREADY_REVERSED" });
  });

  it("resolves a target by canonicalEventId as well as clientEventId (the browser's Undo flow can reference either)", () => {
    const goal = makeRecord({ clientEventId: "goal-local-1", canonicalEventId: "goal-canonical-1", version: 1, eventType: "GOAL_FOR", persistenceStatus: "persisted" });
    const result = evaluateAnnotationPrecondition("EVENT_REVERSED", { correctsEventId: "goal-canonical-1" }, [goal]);
    expect(result).toEqual({ ok: true });
  });

  it("SCORER_SET targeting a valid goal is accepted", () => {
    const goal = makeRecord({ clientEventId: "goal-1", version: 1, eventType: "GOAL_FOR", persistenceStatus: "persisted" });
    const result = evaluateAnnotationPrecondition("SCORER_SET", { playerId: "p1", correctsEventId: "goal-1" }, [goal]);
    expect(result).toEqual({ ok: true });
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

describe("hasReportCapability", () => {
  it("allows a connection whose capabilities include report", () => {
    expect(hasReportCapability(["report"])).toBe(true);
  });

  it("rejects a view-only connection", () => {
    expect(hasReportCapability(["view"])).toBe(false);
  });

  it("rejects a connection with no capabilities at all", () => {
    expect(hasReportCapability([])).toBe(false);
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

describe("classifyPersistenceFailure", () => {
  it("classifies exactly 422 (LiveMatchDomainError) as terminal — will never succeed on retry", () => {
    expect(classifyPersistenceFailure(422)).toBe("terminal");
  });

  it("classifies 401 as retryable — an HMAC/signature failure is a transient request-level problem, not a domain rejection of the event's data", () => {
    expect(classifyPersistenceFailure(401)).toBe("retryable");
  });

  it("classifies other 4xx (400, 499), 5xx, and no response at all as retryable", () => {
    expect(classifyPersistenceFailure(400)).toBe("retryable");
    expect(classifyPersistenceFailure(499)).toBe("retryable");
    expect(classifyPersistenceFailure(500)).toBe("retryable");
    expect(classifyPersistenceFailure(503)).toBe("retryable");
    expect(classifyPersistenceFailure(undefined)).toBe("retryable");
  });
});

describe("computeBackoffDelayMs", () => {
  it("doubles with each retry count, starting from a 1s base", () => {
    expect(computeBackoffDelayMs(0)).toBe(1000);
    expect(computeBackoffDelayMs(1)).toBe(2000);
    expect(computeBackoffDelayMs(2)).toBe(4000);
    expect(computeBackoffDelayMs(3)).toBe(8000);
  });

  it("caps the delay rather than growing unbounded", () => {
    expect(computeBackoffDelayMs(10)).toBe(60_000);
    expect(computeBackoffDelayMs(30)).toBe(60_000);
  });
});

describe("evaluateRetry", () => {
  // 2026-09 incident regression: classifyPersistenceFailure only ever treats 422 as terminal —
  // every other failure (including a structural routing problem, like the incident's own
  // Vercel auth-gate 307) is "retryable", and computeBackoffDelayMs alone never stops trying.
  // evaluateRetry is the backstop: a bounded ceiling that always wins eventually.

  it("keeps retrying with normal backoff below both ceilings", () => {
    const decision = evaluateRetry({ retryCount: 3, firstFailureAt: 0, now: 8_000 });
    expect(decision).toEqual({ outcome: "retry", nextRetryAt: 8_000 + computeBackoffDelayMs(3) });
  });

  it("exhausts once the attempt-count ceiling is reached, even if the failure age is small", () => {
    const decision = evaluateRetry({ retryCount: MAX_RETRY_ATTEMPTS, firstFailureAt: 0, now: 100 });
    expect(decision).toEqual({ outcome: "exhausted" });
  });

  it("exhausts once the max retry age is reached, even with very few attempts", () => {
    const decision = evaluateRetry({ retryCount: 1, firstFailureAt: 0, now: MAX_RETRY_AGE_MS + 1 });
    expect(decision).toEqual({ outcome: "exhausted" });
  });

  it("does not exhaust on the boundary just below either ceiling", () => {
    const decision = evaluateRetry({ retryCount: MAX_RETRY_ATTEMPTS - 1, firstFailureAt: 0, now: MAX_RETRY_AGE_MS - 1 });
    expect(decision.outcome).toBe("retry");
  });
});

describe("evaluateLifecycleExpiry", () => {
  // 2026-09 incident hardening: a reporting session must eventually become dormant even if
  // nobody explicitly ends it — reporter closes the browser, a UI bug, or simply forgetting.

  it("stays active well before the expected end + grace, regardless of activity", () => {
    const decision = evaluateLifecycleExpiry({
      startedAt: 0,
      expectedEndAt: 60 * 60 * 1000,
      lastActivityAt: 0,
      now: 60 * 60 * 1000 - 1,
    });
    expect(decision.outcome).toBe("active");
  });

  it("stays active just past the expected end while still within the grace period", () => {
    const decision = evaluateLifecycleExpiry({
      startedAt: 0,
      expectedEndAt: 60 * 60 * 1000,
      lastActivityAt: 0,
      now: 60 * 60 * 1000 + 1,
    });
    expect(decision.outcome).toBe("active");
  });

  it("expires once past expected end + grace with no activity in the inactivity window", () => {
    const expectedEndAt = 60 * 60 * 1000;
    const deadline = expectedEndAt + LIFECYCLE_GRACE_MS;
    const decision = evaluateLifecycleExpiry({
      startedAt: 0,
      expectedEndAt,
      lastActivityAt: 0,
      now: deadline + LIFECYCLE_INACTIVITY_AFTER_DEADLINE_MS,
    });
    expect(decision.outcome).toBe("expire");
  });

  it("stays active past the deadline if reporting activity is recent, and asks to be rechecked", () => {
    const expectedEndAt = 60 * 60 * 1000;
    const deadline = expectedEndAt + LIFECYCLE_GRACE_MS;
    const now = deadline + 1;
    const decision = evaluateLifecycleExpiry({
      startedAt: 0,
      expectedEndAt,
      lastActivityAt: now - 1, // just recorded an event
      now,
    });
    expect(decision).toMatchObject({ outcome: "active" });
    if (decision.outcome === "active") {
      expect(decision.nextCheckAt).not.toBeNull();
    }
  });

  it("clamps an implausibly distant expectedEndAt to the fallback ceiling (CI regression: a test fixture's match date decades in the future produced an unschedulable alarm time)", () => {
    const decadesOut = 60 * 365 * 24 * 60 * 60 * 1000; // ~60 years
    const clampedDeadline = LIFECYCLE_FALLBACK_CEILING_MS + LIFECYCLE_GRACE_MS;

    const stillActive = evaluateLifecycleExpiry({
      startedAt: 0,
      expectedEndAt: decadesOut,
      lastActivityAt: 0,
      now: clampedDeadline - 1,
    });
    expect(stillActive).toEqual({ outcome: "active", nextCheckAt: clampedDeadline });

    const expired = evaluateLifecycleExpiry({
      startedAt: 0,
      expectedEndAt: decadesOut,
      lastActivityAt: 0,
      now: clampedDeadline + LIFECYCLE_INACTIVITY_AFTER_DEADLINE_MS,
    });
    expect(expired.outcome).toBe("expire");
  });

  it("still trusts an expectedEndAt that is sooner than the fallback ceiling", () => {
    const soonExpectedEndAt = 30 * 60 * 1000; // 30 minutes — well under the 4h fallback
    const deadline = soonExpectedEndAt + LIFECYCLE_GRACE_MS;
    const decision = evaluateLifecycleExpiry({ startedAt: 0, expectedEndAt: soonExpectedEndAt, lastActivityAt: 0, now: deadline - 1 });
    expect(decision).toEqual({ outcome: "active", nextCheckAt: deadline });
  });

  it("falls back to a fixed ceiling from session start when no expectedEndAt is known", () => {
    const deadline = LIFECYCLE_FALLBACK_CEILING_MS + LIFECYCLE_GRACE_MS;
    const stillActive = evaluateLifecycleExpiry({ startedAt: 0, expectedEndAt: null, lastActivityAt: 0, now: deadline - 1 });
    expect(stillActive.outcome).toBe("active");

    const expired = evaluateLifecycleExpiry({
      startedAt: 0,
      expectedEndAt: null,
      lastActivityAt: 0,
      now: deadline + LIFECYCLE_INACTIVITY_AFTER_DEADLINE_MS,
    });
    expect(expired.outcome).toBe("expire");
  });

  it("never expires a pre-existing session with no startedAt/lastActivityAt (created before this field existed)", () => {
    const decision = evaluateLifecycleExpiry({
      startedAt: undefined,
      expectedEndAt: null,
      lastActivityAt: undefined,
      now: Number.MAX_SAFE_INTEGER,
    });
    expect(decision).toEqual({ outcome: "active", nextCheckAt: null });
  });

  it("is independent of connection/viewer presence — only lastActivityAt (recordEvent acceptance) matters", () => {
    // A "Follow live" viewer connecting/disconnecting must never call anything that advances
    // lastActivityAt (only an accepted recordEvent does) — this test documents that contract at
    // the pure-function level: presence is not even a parameter this function accepts.
    const expectedEndAt = 60 * 60 * 1000;
    const deadline = expectedEndAt + LIFECYCLE_GRACE_MS;
    const decision = evaluateLifecycleExpiry({
      startedAt: 0,
      expectedEndAt,
      lastActivityAt: 0,
      now: deadline + LIFECYCLE_INACTIVITY_AFTER_DEADLINE_MS,
    });
    expect(decision.outcome).toBe("expire");
  });
});

describe("selectDueRetries", () => {
  it("selects only pending events whose nextRetryAt has arrived", () => {
    const events: AcceptedEventRecord[] = [
      makeRecord({ clientEventId: "due", persistenceStatus: "pending", nextRetryAt: 1000 }),
      makeRecord({ clientEventId: "not-due-yet", persistenceStatus: "pending", nextRetryAt: 5000 }),
      makeRecord({ clientEventId: "never-failed", persistenceStatus: "pending", nextRetryAt: undefined }),
      makeRecord({ clientEventId: "already-persisted", persistenceStatus: "persisted", nextRetryAt: 500 }),
      makeRecord({ clientEventId: "terminal", persistenceStatus: "failed_terminal", nextRetryAt: 500 }),
    ];

    const due = selectDueRetries(events, 2000);
    expect(due.map((e) => e.clientEventId)).toEqual(["due"]);
  });
});

describe("nextAlarmTime", () => {
  it("returns the minimum nextRetryAt across pending events", () => {
    const events: AcceptedEventRecord[] = [
      makeRecord({ clientEventId: "a", persistenceStatus: "pending", nextRetryAt: 5000 }),
      makeRecord({ clientEventId: "b", persistenceStatus: "pending", nextRetryAt: 2000 }),
      makeRecord({ clientEventId: "c", persistenceStatus: "persisted", nextRetryAt: 500 }),
    ];
    expect(nextAlarmTime(events)).toBe(2000);
  });

  it("returns null when nothing is pending a retry (do not keep the object awake needlessly)", () => {
    const events: AcceptedEventRecord[] = [
      makeRecord({ clientEventId: "a", persistenceStatus: "persisted" }),
      makeRecord({ clientEventId: "b", persistenceStatus: "pending", nextRetryAt: undefined }),
    ];
    expect(nextAlarmTime(events)).toBeNull();
  });
});

describe("evaluateReconciliation", () => {
  it("assigns new versions only to events this object has never seen, in snapshot order", () => {
    const result = evaluateReconciliation({
      currentVersion: 3,
      knownClientEventIds: new Set(["known-1"]),
      canonicalEvents: [
        { clientEventId: "known-1", id: "canon-1", eventType: "GOAL_FOR", createdAt: "2026-08-23T00:00:00.000Z" },
        { clientEventId: "unknown-1", id: "canon-2", eventType: "GOAL_AGAINST", createdAt: "2026-08-23T00:00:01.000Z" },
        { clientEventId: "unknown-2", id: "canon-3", eventType: "PERIOD_START", createdAt: "2026-08-23T00:00:02.000Z" },
      ],
    });

    expect(result.finalVersion).toBe(5);
    expect(result.newRecords).toEqual([
      expect.objectContaining({ clientEventId: "unknown-1", version: 4, persistenceStatus: "persisted", canonicalEventId: "canon-2" }),
      expect.objectContaining({ clientEventId: "unknown-2", version: 5, persistenceStatus: "persisted", canonicalEventId: "canon-3" }),
    ]);
  });

  it("is a no-op when every canonical event is already known", () => {
    const result = evaluateReconciliation({
      currentVersion: 7,
      knownClientEventIds: new Set(["a", "b"]),
      canonicalEvents: [
        { clientEventId: "a", id: "canon-a", eventType: "GOAL_FOR", createdAt: "2026-08-23T00:00:00.000Z" },
        { clientEventId: "b", id: "canon-b", eventType: "GOAL_FOR", createdAt: "2026-08-23T00:00:01.000Z" },
      ],
    });
    expect(result.finalVersion).toBe(7);
    expect(result.newRecords).toEqual([]);
  });

  // ADR-0138 (Bundle 2, DECISIONS.md D06): "Reconcile Durable Object state from persisted
  // sequence, never regenerated local numbering."
  describe("persisted sequence is authoritative (ADR-0138, Bundle 2)", () => {
    it("reuses a discovered event's real persisted sequence verbatim, never renumbering it", () => {
      const result = evaluateReconciliation({
        currentVersion: 0,
        knownClientEventIds: new Set(),
        canonicalEvents: [
          { clientEventId: "a", id: "canon-a", eventType: "GOAL_FOR", createdAt: "2026-08-23T00:00:00.000Z", sequence: 5 },
        ],
      });
      expect(result.newRecords).toEqual([expect.objectContaining({ clientEventId: "a", version: 5 })]);
      expect(result.finalVersion).toBe(5);
    });

    it("seeds finalVersion from the highest persisted sequence when it exceeds the object's own prior version — a fresh object with no local state resumes correctly instead of colliding with rows Neon already has", () => {
      const result = evaluateReconciliation({
        currentVersion: 0,
        knownClientEventIds: new Set(),
        canonicalEvents: [
          { clientEventId: "a", id: "canon-a", eventType: "GOAL_FOR", createdAt: "2026-08-23T00:00:00.000Z", sequence: 10 },
        ],
      });
      expect(result.finalVersion).toBe(10);
    });

    it("a real-sequenced event keeps its exact slot; a legacy sequence-less event (ARR-0045, direct-HTTP path) is assigned synthetically after the highest real sequence seen", () => {
      const result = evaluateReconciliation({
        currentVersion: 0,
        knownClientEventIds: new Set(),
        canonicalEvents: [
          // Snapshot order already puts sequence-less rows last (Postgres NULLS LAST), so a
          // real-world call would never see this exact ordering — but the function must not
          // depend on caller-supplied ordering to get this right.
          { clientEventId: "legacy", id: "canon-legacy", eventType: "GOAL_AGAINST", createdAt: "2026-08-23T00:00:01.000Z" },
          { clientEventId: "real", id: "canon-real", eventType: "GOAL_FOR", createdAt: "2026-08-23T00:00:00.000Z", sequence: 7 },
        ],
      });
      // The legacy row is assigned AFTER the highest real sequence seen anywhere in the batch
      // (8, not 1) — `maxPersistedSequence` is computed up front from the whole array, so this
      // is correct regardless of which order the array happens to arrive in.
      expect(result.newRecords).toEqual([
        expect.objectContaining({ clientEventId: "legacy", version: 8 }),
        expect.objectContaining({ clientEventId: "real", version: 7 }),
      ]);
      expect(result.finalVersion).toBe(8);
    });

    it("does not renumber an already-known event even if it carries a persisted sequence", () => {
      const result = evaluateReconciliation({
        currentVersion: 3,
        knownClientEventIds: new Set(["known"]),
        canonicalEvents: [
          { clientEventId: "known", id: "canon-known", eventType: "GOAL_FOR", createdAt: "2026-08-23T00:00:00.000Z", sequence: 1 },
        ],
      });
      expect(result.newRecords).toEqual([]);
      // Still seeds finalVersion from the max persisted sequence discovered, even for an
      // already-known event — the object's own tracked version must never fall behind Neon's.
      expect(result.finalVersion).toBe(3);
    });

    it("threads correctionType/correctsEventId into the reconciled record's eventFields so a later getSnapshot from this object reflects them", () => {
      const result = evaluateReconciliation({
        currentVersion: 0,
        knownClientEventIds: new Set(),
        canonicalEvents: [
          {
            clientEventId: "reversal",
            id: "canon-reversal",
            eventType: "EVENT_REVERSED",
            createdAt: "2026-08-23T00:00:00.000Z",
            sequence: 2,
            correctionType: "REVERSAL",
            correctsEventId: "canon-goal",
          },
        ],
      });
      expect(result.newRecords[0]?.eventFields).toEqual(
        expect.objectContaining({ correctionType: "REVERSAL", correctsEventId: "canon-goal" }),
      );
    });
  });
});

describe("advanceClockAnchor (ADR-0133 H6c)", () => {
  const before = initialClockAnchor(1000);

  it("leaves the anchor unchanged for a non-transition event", () => {
    expect(advanceClockAnchor(before, "GOAL_FOR", { period: "FIRST_HALF" }, 5000)).toBe(before);
  });

  it("starts the clock on PERIOD_START / MATCH_START", () => {
    expect(advanceClockAnchor(before, "MATCH_START", { period: "FIRST_HALF", matchSeconds: 0 }, 5000)).toEqual({
      period: "FIRST_HALF",
      running: true,
      matchSecondsAtAnchor: 0,
      anchorServerTimeMs: 5000,
    });
    expect(
      advanceClockAnchor(before, "PERIOD_START", { period: "SECOND_HALF", matchSeconds: 1500 }, 9000),
    ).toEqual({ period: "SECOND_HALF", running: true, matchSecondsAtAnchor: 1500, anchorServerTimeMs: 9000 });
  });

  it("stops the clock on PERIOD_END / MATCH_END", () => {
    const running = advanceClockAnchor(before, "PERIOD_START", { period: "FIRST_HALF" }, 5000);
    expect(advanceClockAnchor(running, "PERIOD_END", { period: "HALF_TIME" }, 8000)).toEqual({
      period: "HALF_TIME",
      running: false,
      matchSecondsAtAnchor: 0,
      anchorServerTimeMs: 8000,
    });
  });

  it("clamps a missing or negative matchSeconds to 0", () => {
    expect(advanceClockAnchor(before, "PERIOD_START", { period: "FIRST_HALF" }, 5000).matchSecondsAtAnchor).toBe(0);
    expect(
      advanceClockAnchor(before, "PERIOD_START", { period: "FIRST_HALF", matchSeconds: -10 }, 5000).matchSecondsAtAnchor,
    ).toBe(0);
  });
});

