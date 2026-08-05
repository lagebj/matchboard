import type { MatchClockState, MatchPeriod } from "./live-match-types";
import { MATCH_PERIOD_ORDER } from "./live-match-types";
import type { PeriodConfig } from "./period-config";

export function createInitialClockState(): MatchClockState {
  return {
    period: "BEFORE",
    running: false,
    startedAt: null,
    elapsedBeforeStartMs: 0,
  };
}

export function getElapsedMs(clock: MatchClockState, nowMs: number): number {
  if (!clock.running || !clock.startedAt) {
    return clock.elapsedBeforeStartMs;
  }
  return clock.elapsedBeforeStartMs + (nowMs - clock.startedAt.getTime());
}

export function formatElapsedMs(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatPeriodTime(period: MatchPeriod, elapsedMs: number): string {
  return `${formatElapsedMs(elapsedMs)}`;
}

export function advancePeriod(clock: MatchClockState, periodConfig?: PeriodConfig[]): MatchClockState {
  const order = periodConfig ? periodConfig.map((p) => p.key) : MATCH_PERIOD_ORDER;
  const playingKeys = periodConfig
    ? new Set(periodConfig.filter((p) => p.type === "playing").map((p) => p.key))
    : new Set(["FIRST_HALF", "SECOND_HALF", "EXTRA_FIRST_HALF", "EXTRA_SECOND_HALF"] as MatchPeriod[]);

  const currentIdx = order.indexOf(clock.period);
  if (currentIdx < 0 || currentIdx >= order.length - 1) {
    return { ...clock, running: false };
  }

  const nextPeriod = order[currentIdx + 1];
  const isPlayingPeriod = playingKeys.has(nextPeriod);

  if (isPlayingPeriod) {
    return {
      ...clock,
      period: nextPeriod,
      running: true,
      startedAt: new Date(),
      elapsedBeforeStartMs: 0,
    };
  }

  return {
    ...clock,
    period: nextPeriod,
    running: false,
    startedAt: null,
    elapsedBeforeStartMs: 0,
  };
}

export function pauseClock(clock: MatchClockState, nowMs: number): MatchClockState {
  if (!clock.running) return clock;

  const elapsed = getElapsedMs(clock, nowMs);

  return {
    ...clock,
    running: false,
    startedAt: null,
    elapsedBeforeStartMs: elapsed,
  };
}

export function resumeClock(clock: MatchClockState): MatchClockState {
  if (clock.running) return clock;

  return {
    ...clock,
    running: true,
    startedAt: new Date(),
  };
}

export function adjustClock(clock: MatchClockState, adjustmentMs: number): MatchClockState {
  return {
    ...clock,
    elapsedBeforeStartMs: Math.max(0, clock.elapsedBeforeStartMs + adjustmentMs),
  };
}

export function isPlayingPeriod(period: MatchPeriod, periodConfig?: PeriodConfig[]): boolean {
  if (periodConfig) {
    return periodConfig.some((p) => p.key === period && p.type === "playing");
  }
  return period === "FIRST_HALF" || period === "SECOND_HALF" || period === "EXTRA_FIRST_HALF" || period === "EXTRA_SECOND_HALF";
}

export function isBreakPeriod(period: MatchPeriod, periodConfig?: PeriodConfig[]): boolean {
  if (periodConfig) {
    return periodConfig.some((p) => p.key === period && p.type === "break");
  }
  return period === "BEFORE" || period === "HALF_TIME" || period === "EXTRA_HALF_TIME";
}

export function isMatchOver(period: MatchPeriod): boolean {
  return period === "FULL_TIME";
}

export function getPeriodNumber(period: MatchPeriod, periodConfig?: PeriodConfig[]): number {
  if (periodConfig) {
    return periodConfig.findIndex((p) => p.key === period);
  }
  return MATCH_PERIOD_ORDER.indexOf(period);
}