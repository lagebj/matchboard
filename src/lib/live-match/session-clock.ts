// ─────────────────────────────────────────────────────────────────
// Persisted live-match clock (ADR-0133 H2).
//
// The match clock lived only in React state, so a reload / device swap /
// reconnect reset it to "before kickoff" — the coach then had to click
// through Start-1st / End-1st / Start-2nd to recover (confirmed in the
// 2026-09-09 incident). `LiveMatchSession` now persists the clock; these
// helpers map between `MatchClockState` and the stored columns, and give
// the monotonic-period ordering used to reject a stale client that would
// otherwise stomp a running clock with "BEFORE".
// ─────────────────────────────────────────────────────────────────

import { MATCH_PERIOD_ORDER, type MatchClockState, type MatchPeriod } from "./live-match-types";

/** The `LiveMatchSession` columns that store the clock. */
export interface PersistedSessionClock {
  clockPeriod: MatchPeriod;
  clockRunning: boolean;
  clockPeriodStartedAt: Date | null;
  clockElapsedBeforeMs: number;
}

export function clockStateToPersisted(clock: MatchClockState): PersistedSessionClock {
  return {
    clockPeriod: clock.period,
    clockRunning: clock.running,
    // Only meaningful while running; null it otherwise so a paused clock can't drift.
    clockPeriodStartedAt: clock.running ? clock.startedAt : null,
    clockElapsedBeforeMs: Math.max(0, Math.round(clock.elapsedBeforeStartMs)),
  };
}

export function persistedToClockState(row: PersistedSessionClock | null | undefined): MatchClockState | null {
  if (!row) return null;
  return {
    period: row.clockPeriod,
    running: row.clockRunning,
    startedAt: row.clockRunning ? row.clockPeriodStartedAt : null,
    elapsedBeforeStartMs: row.clockElapsedBeforeMs,
  };
}

/**
 * "Nothing has happened yet" — a freshly-created session before the coach starts the clock.
 * When the persisted clock is still in this state the caller uses `createInitialClockState()`
 * (identical result) rather than hydrating, keeping intent explicit.
 */
export function isUnstartedPersistedClock(row: PersistedSessionClock | null | undefined): boolean {
  return (
    !row ||
    (row.clockPeriod === "BEFORE" && !row.clockRunning && row.clockElapsedBeforeMs === 0)
  );
}

/**
 * A clock update may advance the period or stay on it, never move it earlier — a reloaded /
 * second-device client that briefly holds the fresh `BEFORE` state must not overwrite a
 * running second-half clock. `BEFORE` -> anything is always allowed (first start).
 */
export function isForwardClockTransition(current: MatchPeriod, next: MatchPeriod): boolean {
  if (current === "BEFORE") return true;
  return MATCH_PERIOD_ORDER.indexOf(next) >= MATCH_PERIOD_ORDER.indexOf(current);
}
