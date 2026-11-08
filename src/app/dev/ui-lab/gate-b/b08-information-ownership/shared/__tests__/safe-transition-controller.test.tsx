import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { getElapsedMs, formatElapsedMs } from "@/lib/live-match/match-clock";
import { B08_MATCH_FORMAT } from "../fixture";
import { useB08LiveFixtureActions } from "../safe-transition-controller";

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
