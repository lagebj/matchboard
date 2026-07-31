import { describe, it, expect } from "vitest";
import {
  createInitialClockState,
  getElapsedMs,
  formatElapsedMs,
  advancePeriod,
  pauseClock,
  resumeClock,
  adjustClock,
  isPlayingPeriod,
  isBreakPeriod,
  isMatchOver,
  getPeriodNumber,
} from "../match-clock";

describe("createInitialClockState", () => {
  it("creates a clock in BEFORE period, not running", () => {
    const clock = createInitialClockState();
    expect(clock.period).toBe("BEFORE");
    expect(clock.running).toBe(false);
    expect(clock.startedAt).toBeNull();
    expect(clock.elapsedBeforeStartMs).toBe(0);
  });
});

describe("getElapsedMs", () => {
  it("returns elapsedBeforeStartMs when not running", () => {
    const clock = createInitialClockState();
    expect(getElapsedMs(clock, Date.now())).toBe(0);
  });

  it("returns elapsedBeforeStartMs when running but startedAt is null", () => {
    const clock = { ...createInitialClockState(), running: true, startedAt: null };
    expect(getElapsedMs(clock, Date.now())).toBe(0);
  });

  it("calculates elapsed time when running", () => {
    const startedAt = new Date("2026-01-01T12:00:00Z");
    const clock = {
      period: "FIRST_HALF" as const,
      running: true,
      startedAt,
      elapsedBeforeStartMs: 5000,
    };
    const nowMs = new Date("2026-01-01T12:01:00Z").getTime();
    expect(getElapsedMs(clock, nowMs)).toBe(5000 + 60000);
  });
});

describe("formatElapsedMs", () => {
  it("formats 0 ms as 0:00", () => {
    expect(formatElapsedMs(0)).toBe("0:00");
  });

  it("formats 65 seconds as 1:05", () => {
    expect(formatElapsedMs(65000)).toBe("1:05");
  });

  it("formats 25 minutes as 25:00", () => {
    expect(formatElapsedMs(25 * 60 * 1000)).toBe("25:00");
  });

  it("formats 5 seconds as 0:05", () => {
    expect(formatElapsedMs(5000)).toBe("0:05");
  });
});

describe("advancePeriod", () => {
  it("advances from BEFORE to FIRST_HALF and starts running", () => {
    const clock = createInitialClockState();
    const next = advancePeriod(clock);
    expect(next.period).toBe("FIRST_HALF");
    expect(next.running).toBe(true);
    expect(next.startedAt).not.toBeNull();
    expect(next.elapsedBeforeStartMs).toBe(0);
  });

  it("advances from FIRST_HALF to HALF_TIME and pauses", () => {
    const clock = { period: "FIRST_HALF" as const, running: true, startedAt: new Date(), elapsedBeforeStartMs: 0 };
    const next = advancePeriod(clock);
    expect(next.period).toBe("HALF_TIME");
    expect(next.running).toBe(false);
  });

  it("advances from HALF_TIME to SECOND_HALF and starts running", () => {
    const clock = { period: "HALF_TIME" as const, running: false, startedAt: null, elapsedBeforeStartMs: 0 };
    const next = advancePeriod(clock);
    expect(next.period).toBe("SECOND_HALF");
    expect(next.running).toBe(true);
  });

  it("advances from SECOND_HALF to EXTRA_FIRST_HALF", () => {
    const clock = { period: "SECOND_HALF" as const, running: true, startedAt: new Date(), elapsedBeforeStartMs: 0 };
    const next = advancePeriod(clock);
    expect(next.period).toBe("EXTRA_FIRST_HALF");
    expect(next.running).toBe(true);
  });

  it("returns FULL_TIME and stops at the end", () => {
    const clock = { period: "EXTRA_SECOND_HALF" as const, running: true, startedAt: new Date(), elapsedBeforeStartMs: 0 };
    const next = advancePeriod(clock);
    expect(next.period).toBe("FULL_TIME");
    expect(next.running).toBe(false);
  });
});

describe("pauseClock", () => {
  it("pauses a running clock and preserves elapsed time", () => {
    const startedAt = new Date("2026-01-01T12:00:00Z");
    const clock = {
      period: "FIRST_HALF" as const,
      running: true,
      startedAt,
      elapsedBeforeStartMs: 5000,
    };
    const nowMs = new Date("2026-01-01T12:00:30Z").getTime();
    const paused = pauseClock(clock, nowMs);
    expect(paused.running).toBe(false);
    expect(paused.startedAt).toBeNull();
    expect(paused.elapsedBeforeStartMs).toBe(5000 + 30000);
  });

  it("does nothing when already paused", () => {
    const clock = createInitialClockState();
    const paused = pauseClock(clock, Date.now());
    expect(paused).toEqual(clock);
  });
});

describe("resumeClock", () => {
  it("resumes a paused clock", () => {
    const clock = {
      period: "FIRST_HALF" as const,
      running: false,
      startedAt: null,
      elapsedBeforeStartMs: 30000,
    };
    const resumed = resumeClock(clock);
    expect(resumed.running).toBe(true);
    expect(resumed.startedAt).not.toBeNull();
    expect(resumed.elapsedBeforeStartMs).toBe(30000);
  });

  it("does nothing when already running", () => {
    const clock = {
      period: "FIRST_HALF" as const,
      running: true,
      startedAt: new Date(),
      elapsedBeforeStartMs: 0,
    };
    const resumed = resumeClock(clock);
    expect(resumed.running).toBe(true);
  });
});

describe("adjustClock", () => {
  it("adjusts elapsed time forward", () => {
    const clock = { ...createInitialClockState(), elapsedBeforeStartMs: 10000 };
    const adjusted = adjustClock(clock, 5000);
    expect(adjusted.elapsedBeforeStartMs).toBe(15000);
  });

  it("adjusts elapsed time backward", () => {
    const clock = { ...createInitialClockState(), elapsedBeforeStartMs: 10000 };
    const adjusted = adjustClock(clock, -5000);
    expect(adjusted.elapsedBeforeStartMs).toBe(5000);
  });

  it("does not go below zero", () => {
    const clock = { ...createInitialClockState(), elapsedBeforeStartMs: 3000 };
    const adjusted = adjustClock(clock, -5000);
    expect(adjusted.elapsedBeforeStartMs).toBe(0);
  });
});

describe("period classification", () => {
  it("identifies playing periods", () => {
    expect(isPlayingPeriod("FIRST_HALF")).toBe(true);
    expect(isPlayingPeriod("SECOND_HALF")).toBe(true);
    expect(isPlayingPeriod("EXTRA_FIRST_HALF")).toBe(true);
    expect(isPlayingPeriod("EXTRA_SECOND_HALF")).toBe(true);
    expect(isPlayingPeriod("BEFORE")).toBe(false);
    expect(isPlayingPeriod("HALF_TIME")).toBe(false);
  });

  it("identifies break periods", () => {
    expect(isBreakPeriod("BEFORE")).toBe(true);
    expect(isBreakPeriod("HALF_TIME")).toBe(true);
    expect(isBreakPeriod("EXTRA_HALF_TIME")).toBe(true);
    expect(isBreakPeriod("FIRST_HALF")).toBe(false);
  });

  it("identifies match over", () => {
    expect(isMatchOver("FULL_TIME")).toBe(true);
    expect(isMatchOver("FIRST_HALF")).toBe(false);
  });
});

describe("getPeriodNumber", () => {
  it("returns sequential period numbers", () => {
    expect(getPeriodNumber("BEFORE")).toBe(0);
    expect(getPeriodNumber("FIRST_HALF")).toBe(1);
    expect(getPeriodNumber("HALF_TIME")).toBe(2);
    expect(getPeriodNumber("SECOND_HALF")).toBe(3);
    expect(getPeriodNumber("FULL_TIME")).toBe(7);
  });
});