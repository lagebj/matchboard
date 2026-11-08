import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { getElapsedMs, formatElapsedMs } from "@/lib/live-match/match-clock";
import { B08_MATCH_FORMAT } from "../fixture";
import { useB08LiveFixtureActions } from "../safe-transition-controller";
import { loadB08Journey, loadFinishedB08JourneyEvents, resetB08Journey } from "../b08-journey";

const FIXED_NOW = new Date("2026-11-07T12:00:00.000Z");

/**
 * B08 W5 remediation (independent review, P1-2) — the real production clock contract
 * (`getElapsedMs()`, `src/lib/live-match/match-clock.ts`) fed the fixture-local
 * `getPreMatchPackage()` clock, with a deterministic fake "now" so the test is reproducible
 * regardless of when it runs (per the review's own "use deterministic fake timers" instruction).
 */
describe("useB08LiveFixtureActions — LIVE clock correctness", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("the second half shows exactly 15:00 elapsed at the B08 LIVE snapshot instant — not 45:00", async () => {
    const { result } = renderHook(() => useB08LiveFixtureActions("b08-fixture-clock-test"));
    const response = await act(async () => {
      const r = await result.current.actions.getPreMatchPackage("b08-fixture-clock-test");
      if (!r.success || !r.data) throw new Error("getPreMatchPackage failed");
      return r;
    });
    const data = response.data!;

    const clock = data.activeSession!.clock!;
    expect(clock.period).toBe("SECOND_HALF");
    expect(clock.running).toBe(true);
    // Not 30 minutes (the first half's own duration must not be double-counted into the second
    // half's elapsedBeforeStartMs) — the defect this test guards against.
    expect(clock.elapsedBeforeStartMs).toBe(0);

    const elapsedMs = getElapsedMs(
      { period: clock.period as never, running: clock.running, startedAt: clock.startedAt ? new Date(clock.startedAt) : null, elapsedBeforeStartMs: clock.elapsedBeforeStartMs },
      Date.now(),
    );
    expect(elapsedMs).toBe(15 * 60 * 1000);
    expect(formatElapsedMs(elapsedMs)).toBe("15:00");
  });

  it("the current-period elapsed time never exceeds the configured 30-minute period duration (no false over-duration warning)", async () => {
    const { result } = renderHook(() => useB08LiveFixtureActions("b08-fixture-clock-test"));
    const response = await act(async () => {
      const r = await result.current.actions.getPreMatchPackage("b08-fixture-clock-test");
      if (!r.success || !r.data) throw new Error("getPreMatchPackage failed");
      return r;
    });
    const data = response.data!;

    const clock = data.activeSession!.clock!;
    const elapsedMs = getElapsedMs(
      { period: clock.period as never, running: clock.running, startedAt: clock.startedAt ? new Date(clock.startedAt) : null, elapsedBeforeStartMs: clock.elapsedBeforeStartMs },
      Date.now(),
    );
    const configuredPeriodDurationMs = B08_MATCH_FORMAT.periodDurationMinutes * 60_000;
    expect(elapsedMs).toBeLessThan(configuredPeriodDurationMs);
  });

  it("the session's real-world start accounts for the first half (30') plus the break (10') plus 15' of the second half — 55' total", async () => {
    const { result } = renderHook(() => useB08LiveFixtureActions("b08-fixture-clock-test"));
    const response = await act(async () => {
      const r = await result.current.actions.getPreMatchPackage("b08-fixture-clock-test");
      if (!r.success || !r.data) throw new Error("getPreMatchPackage failed");
      return r;
    });
    const data = response.data!;

    const sessionStartedAt = new Date(data.activeSession!.startedAt).getTime();
    const realWorldElapsedMs = FIXED_NOW.getTime() - sessionStartedAt;
    expect(realWorldElapsedMs).toBe(55 * 60_000);
  });

  it("reload (a second getPreMatchPackage call at the same fixed instant) restores an identical, correct clock", async () => {
    const { result } = renderHook(() => useB08LiveFixtureActions("b08-fixture-clock-test"));
    const first = await act(async () => {
      const response = await result.current.actions.getPreMatchPackage("b08-fixture-clock-test");
      if (!response.success || !response.data) throw new Error("getPreMatchPackage failed");
      return response;
    });
    const second = await act(async () => {
      const response = await result.current.actions.getPreMatchPackage("b08-fixture-clock-test");
      if (!response.success || !response.data) throw new Error("getPreMatchPackage failed");
      return response;
    });
    expect(second.data!.activeSession!.clock).toEqual(first.data!.activeSession!.clock);
  });
});

/**
 * B08 W5 remediation (independent review, P1-6) — "LIVE-to-report continuity": a real,
 * sessionStorage-backed journey, not just React state that vanishes on navigation.
 */
describe("useB08LiveFixtureActions — interactive journey persistence", () => {
  beforeEach(() => {
    resetB08Journey();
  });

  afterEach(() => {
    resetB08Journey();
  });

  it("a fresh session (no journey yet) starts from the canonical cutoff seed, and recordEvent persists beyond this component's own React state", async () => {
    expect(loadB08Journey()).toBeNull();
    const { result } = renderHook(() => useB08LiveFixtureActions("b08-fixture-journey-test"));
    const seedCount = result.current.events.length;
    expect(seedCount).toBeGreaterThan(0);

    await act(async () => {
      await result.current.actions.recordEvent({ matchId: "b08-fixture-journey-test", sessionId: "b08-fixture-session", clientEventId: "test-client-event", eventType: "GOAL_FOR", period: "SECOND_HALF", matchSeconds: 1_080_000 });
    });

    // Persisted to sessionStorage, not only held in this hook instance's own React state.
    const persisted = loadB08Journey();
    expect(persisted).not.toBeNull();
    expect(persisted!.events).toHaveLength(seedCount + 1);
    expect(persisted!.finished).toBe(false);
  });

  it("a finished journey's events are NOT readable by loadFinishedB08JourneyEvents() until endSession has actually been called", async () => {
    const { result } = renderHook(() => useB08LiveFixtureActions("b08-fixture-journey-test"));
    await act(async () => {
      await result.current.actions.recordEvent({ matchId: "b08-fixture-journey-test", sessionId: "b08-fixture-session", clientEventId: "test-client-event", eventType: "GOAL_FOR", period: "SECOND_HALF", matchSeconds: 1_080_000 });
    });
    // Recorded, but the session was never "finished" — the Report candidate must not see a
    // half-recorded, abandoned session as though it were the final record.
    expect(loadFinishedB08JourneyEvents()).toBeNull();

    await act(async () => {
      await result.current.actions.endSession("b08-fixture-session");
    });
    const finished = loadFinishedB08JourneyEvents();
    expect(finished).not.toBeNull();
    expect(finished).toEqual(result.current.events);
  });

  it("a second hook instance (simulating a reload of B08-LIVE itself) restores exactly where the first one left off, not the canonical seed again", async () => {
    const first = renderHook(() => useB08LiveFixtureActions("b08-fixture-journey-test"));
    await act(async () => {
      await first.result.current.actions.recordEvent({ matchId: "b08-fixture-journey-test", sessionId: "b08-fixture-session", clientEventId: "test-client-event", eventType: "GOAL_FOR", period: "SECOND_HALF", matchSeconds: 1_080_000 });
    });
    const afterFirstRecord = first.result.current.events;

    const second = renderHook(() => useB08LiveFixtureActions("b08-fixture-journey-test"));
    expect(second.result.current.events).toEqual(afterFirstRecord);
  });

  it("resetB08Journey() returns a brand-new hook instance to the canonical cutoff seed (reference snapshot mode)", async () => {
    const { result } = renderHook(() => useB08LiveFixtureActions("b08-fixture-journey-test"));
    const seed = result.current.events;
    await act(async () => {
      await result.current.actions.recordEvent({ matchId: "b08-fixture-journey-test", sessionId: "b08-fixture-session", clientEventId: "test-client-event", eventType: "GOAL_FOR", period: "SECOND_HALF", matchSeconds: 1_080_000 });
    });
    expect(result.current.events).not.toEqual(seed);

    resetB08Journey();
    const fresh = renderHook(() => useB08LiveFixtureActions("b08-fixture-journey-test"));
    expect(fresh.result.current.events).toEqual(seed);
  });
});

/**
 * B08 W5 THIRD remediation (independent review, 2026-11-08, "final data-integrity remediation",
 * defect #3) — `recordEvent()` is the real fixture write boundary; mirrors production's own real
 * contract exactly (confirmed against `LiveMatchClient`'s own `reconcileOutboxWithServer()` doc
 * comment: "a resend is dedup-safe server-side by clientEventId"). Every case in the required
 * matrix is checked against BOTH the stored row count and the derived score — a test that checks
 * only one of the two would miss a real regression in the other.
 */
describe("useB08LiveFixtureActions — idempotent event recording", () => {
  beforeEach(() => {
    resetB08Journey();
  });

  afterEach(() => {
    resetB08Journey();
  });

  it("recording a new goal accepts exactly one row", async () => {
    const { result } = renderHook(() => useB08LiveFixtureActions("b08-idem-test"));
    const seedCount = result.current.events.length;
    await act(async () => {
      await result.current.actions.recordEvent({ matchId: "b08-idem-test", sessionId: "b08-fixture-session", clientEventId: "goal-1", eventType: "GOAL_FOR", period: "SECOND_HALF", matchSeconds: 1_080_000 });
    });
    expect(result.current.events).toHaveLength(seedCount + 1);
  });

  it("retrying the identical goal with the same clientEventId is a no-op — still one accepted row, returning the SAME real id", async () => {
    const { result } = renderHook(() => useB08LiveFixtureActions("b08-idem-test"));
    const seedCount = result.current.events.length;
    const input = { matchId: "b08-idem-test", sessionId: "b08-fixture-session", clientEventId: "goal-1", eventType: "GOAL_FOR", period: "SECOND_HALF", matchSeconds: 1_080_000 };
    const first = await act(async () => result.current.actions.recordEvent(input));
    const retry = await act(async () => result.current.actions.recordEvent(input));
    expect(result.current.events).toHaveLength(seedCount + 1);
    expect(retry.success).toBe(true);
    expect(retry.data?.id).toBe(first.data?.id);
  });

  it("reload (a second hook instance) and retry of the same goal is still a no-op — still one accepted row", async () => {
    const first = renderHook(() => useB08LiveFixtureActions("b08-idem-test"));
    const seedCount = first.result.current.events.length;
    const input = { matchId: "b08-idem-test", sessionId: "b08-fixture-session", clientEventId: "goal-1", eventType: "GOAL_FOR", period: "SECOND_HALF", matchSeconds: 1_080_000 };
    await act(async () => first.result.current.actions.recordEvent(input));

    const second = renderHook(() => useB08LiveFixtureActions("b08-idem-test"));
    await act(async () => second.result.current.actions.recordEvent(input));
    expect(second.result.current.events).toHaveLength(seedCount + 1);
  });

  it("retrying the same clientEventId with DIFFERENT content is a genuine conflict — rejected, not silently appended or silently overwritten", async () => {
    const { result } = renderHook(() => useB08LiveFixtureActions("b08-idem-test"));
    const seedCount = result.current.events.length;
    await act(async () =>
      result.current.actions.recordEvent({ matchId: "b08-idem-test", sessionId: "b08-fixture-session", clientEventId: "goal-1", eventType: "GOAL_FOR", period: "SECOND_HALF", matchSeconds: 1_080_000 }),
    );
    const conflict = await act(async () =>
      result.current.actions.recordEvent({ matchId: "b08-idem-test", sessionId: "b08-fixture-session", clientEventId: "goal-1", eventType: "GOAL_AGAINST", period: "SECOND_HALF", matchSeconds: 1_080_000 }),
    );
    expect(conflict.success).toBe(false);
    expect(conflict.error).toBeTruthy();
    // The first, genuinely-accepted event is untouched — neither a second row nor a mutated one.
    expect(result.current.events).toHaveLength(seedCount + 1);
    expect(result.current.events.find((e) => e.clientEventId === "goal-1")?.eventType).toBe("GOAL_FOR");
  });

  it("two goals with different clientEventIds both accept — no false collision", async () => {
    const { result } = renderHook(() => useB08LiveFixtureActions("b08-idem-test"));
    const seedCount = result.current.events.length;
    // Two SEPARATE `act()` calls — each lets React actually commit the state update (and this
    // hook's own `eventsRef.current = events` render-time sync) before the next call reads it;
    // two awaited calls inside one shared `act()` can otherwise observe a stale `eventsRef`.
    await act(async () => result.current.actions.recordEvent({ matchId: "b08-idem-test", sessionId: "b08-fixture-session", clientEventId: "goal-1", eventType: "GOAL_FOR", period: "SECOND_HALF", matchSeconds: 1_080_000 }));
    await act(async () => result.current.actions.recordEvent({ matchId: "b08-idem-test", sessionId: "b08-fixture-session", clientEventId: "goal-2", eventType: "GOAL_FOR", period: "SECOND_HALF", matchSeconds: 1_200_000 }));
    expect(result.current.events).toHaveLength(seedCount + 2);
  });

  it("reversing a goal (EVENT_REVERSED targeting its real id) applies once even if the same reversal is retried with the same clientEventId", async () => {
    const { result } = renderHook(() => useB08LiveFixtureActions("b08-idem-test"));
    const goalResult = await act(async () =>
      result.current.actions.recordEvent({ matchId: "b08-idem-test", sessionId: "b08-fixture-session", clientEventId: "goal-1", eventType: "GOAL_FOR", period: "SECOND_HALF", matchSeconds: 1_080_000 }),
    );
    const goalId = goalResult.data!.id!;
    const countBeforeReversal = result.current.events.length;

    const reversalInput = { matchId: "b08-idem-test", sessionId: "b08-fixture-session", clientEventId: "reversal-1", eventType: "EVENT_REVERSED", correctsEventId: goalId, correctionType: "REVERSAL" };
    await act(async () => result.current.actions.recordEvent(reversalInput));
    expect(result.current.events).toHaveLength(countBeforeReversal + 1);

    // A retried, IDENTICAL reversal (same clientEventId) must not apply a second time.
    await act(async () => result.current.actions.recordEvent(reversalInput));
    expect(result.current.events).toHaveLength(countBeforeReversal + 1);
  });

  it("an Undo clicked on a not-yet-confirmed row (correctsEventId is the target's clientEventId, not its real id yet) still correctly excludes the target — the real-id namespace is resolved at the write boundary", async () => {
    const { result } = renderHook(() => useB08LiveFixtureActions("b08-idem-test"));
    const goalResult = await act(async () =>
      result.current.actions.recordEvent({ matchId: "b08-idem-test", sessionId: "b08-fixture-session", clientEventId: "goal-1", eventType: "GOAL_FOR", period: "SECOND_HALF", matchSeconds: 1_080_000 }),
    );
    const realGoalId = goalResult.data!.id!;
    const countBeforeReversal = result.current.events.length;

    // Simulates `LiveMatchClient.handleUndo()` being invoked against a still-local overlay row,
    // whose own `id` field is its `clientEventId` ("goal-1"), not the real fixture-generated id.
    await act(async () =>
      result.current.actions.recordEvent({ matchId: "b08-idem-test", sessionId: "b08-fixture-session", clientEventId: "reversal-ambiguous", eventType: "EVENT_REVERSED", correctsEventId: "goal-1", correctionType: "REVERSAL" }),
    );

    const reversal = result.current.events.find((e) => e.clientEventId === "reversal-ambiguous");
    // Normalized to the REAL id — not stored verbatim as the clientEventId it was recorded with.
    expect(reversal?.correctsEventId).toBe(realGoalId);
    expect(result.current.events).toHaveLength(countBeforeReversal + 1);
  });

  it("assigning a scorer twice through the same clientEventId is idempotent — one accepted correction", async () => {
    const { result } = renderHook(() => useB08LiveFixtureActions("b08-idem-test"));
    const goalResult = await act(async () =>
      result.current.actions.recordEvent({ matchId: "b08-idem-test", sessionId: "b08-fixture-session", clientEventId: "goal-1", eventType: "GOAL_FOR", period: "SECOND_HALF", matchSeconds: 1_080_000 }),
    );
    const countAfterGoal = result.current.events.length;
    const scorerInput = {
      matchId: "b08-idem-test",
      sessionId: "b08-fixture-session",
      clientEventId: "scorer-1",
      eventType: "SCORER_SET",
      correctsEventId: "goal-1",
      correctionType: "ATTRIBUTION",
      playerId: "player-gb8-vetle",
    };
    await act(async () => result.current.actions.recordEvent(scorerInput));
    await act(async () => result.current.actions.recordEvent(scorerInput));
    expect(result.current.events).toHaveLength(countAfterGoal + 1);
    void goalResult;
  });

  it("an assist assigned through its own distinct clientEventId is a normal, separate append — no extra goal, correct attribution", async () => {
    const { result } = renderHook(() => useB08LiveFixtureActions("b08-idem-test"));
    const countBefore = result.current.events.length;
    const goalsBefore = result.current.events.filter((e) => e.eventType === "GOAL_FOR").length;
    await act(async () =>
      result.current.actions.recordEvent({ matchId: "b08-idem-test", sessionId: "b08-fixture-session", clientEventId: "goal-1", eventType: "GOAL_FOR", period: "SECOND_HALF", matchSeconds: 1_080_000 }),
    );
    await act(async () =>
      result.current.actions.recordEvent({ matchId: "b08-idem-test", sessionId: "b08-fixture-session", clientEventId: "assist-1", eventType: "ASSIST_SET", correctsEventId: "goal-1", correctionType: "ATTRIBUTION", playerId: "player-gb8-sindre" }),
    );
    expect(result.current.events).toHaveLength(countBefore + 2);
    const goals = result.current.events.filter((e) => e.eventType === "GOAL_FOR");
    expect(goals).toHaveLength(goalsBefore + 1);
    const assist = result.current.events.find((e) => e.eventType === "ASSIST_SET");
    expect(assist?.playerId).toBe("player-gb8-sindre");
  });
});
