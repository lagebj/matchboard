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
