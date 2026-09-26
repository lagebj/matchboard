// ─────────────────────────────────────────────────────────────────
// ADR-0152 §2: the one canonical "what should the coach do next" resolver for Live Reporting.
//
// Editable Live Reporting (League/Event), Today, and Match Details all consume this instead of
// independently inferring lifecycle state from session/clock fields — the exact requirement the
// bundle's `02_MATCH_LIFECYCLE_AND_LIVE_REPORTING.md` §2/§3 locks in. `Finish live reporting` is
// deliberately NOT part of this union: it is always visible as a secondary action alongside
// whatever this resolver returns, except when the resolver itself returns
// `FINISH_LIVE_REPORTING` (the final configured period has ended, so Finish becomes primary and
// there is no competing action) — see §3 "Final configured period ended".
// ─────────────────────────────────────────────────────────────────

import type { MatchPeriod } from "./live-match-types";
import type { PeriodConfig } from "./period-config";
import { getPeriodAfter, isMatchOver, isPlayingPeriod } from "./match-clock";

export type LiveReportingPrimaryAction =
  | { kind: "START_LIVE_REPORTING" }
  | { kind: "START_PERIOD"; period: MatchPeriod; label: string }
  | { kind: "END_PERIOD"; period: MatchPeriod; label: string }
  | { kind: "RESUME_PERIOD"; period: MatchPeriod; label: string }
  | { kind: "FINISH_LIVE_REPORTING" }
  | { kind: "OPEN_POST_MATCH_REPORT" }
  | { kind: "WAIT_FOR_RECONCILIATION" };

export type LiveReportingSessionStatus = "NONE" | "ACTIVE" | "ENDED";

export interface ResolveLiveReportingPrimaryActionInput {
  /** "NONE": no session has ever been created for this match/event match. */
  sessionStatus: LiveReportingSessionStatus;
  /** Required when `sessionStatus === "ACTIVE"`; ignored otherwise. */
  clock?: { period: MatchPeriod; running: boolean } | null;
  /** The resolved period config (format-driven or legacy fallback) — same set League/Event
   * share via `getLeagueMatchPeriodConfig`/`getEventPeriodConfig`. */
  periodConfig: PeriodConfig[];
  /**
   * True once the client-observed elapsed time has reached the 270-minute server reconciliation
   * threshold (`resolveLiveReportingWarning(...).kind === "EXPIRED"`) but the session has not
   * yet been closed server-side. The client never introduces a second timeout authority — this
   * only changes what is displayed while waiting for the existing reconciliation cron.
   */
  reconciliationPending?: boolean;
  /** Required when `sessionStatus === "ENDED"`; ignored otherwise. */
  reportExists?: boolean;
}

function labelFor(period: MatchPeriod, periodConfig: PeriodConfig[]): string {
  return periodConfig.find((p) => p.key === period)?.label ?? period.replace(/_/g, " ");
}

/**
 * Pure, deterministic. Every Live Reporting/Today/Match Details surface must derive its "what
 * should the coach do next" state from this function, not from ad hoc field inspection.
 */
export function resolveLiveReportingPrimaryAction(
  input: ResolveLiveReportingPrimaryActionInput,
): LiveReportingPrimaryAction {
  const { sessionStatus, periodConfig } = input;

  if (sessionStatus === "NONE") {
    return { kind: "START_LIVE_REPORTING" };
  }

  if (sessionStatus === "ENDED") {
    return input.reportExists ? { kind: "OPEN_POST_MATCH_REPORT" } : { kind: "WAIT_FOR_RECONCILIATION" };
  }

  // ACTIVE.
  if (input.reconciliationPending) {
    return { kind: "WAIT_FOR_RECONCILIATION" };
  }

  const clock = input.clock;
  if (!clock) {
    // Defensive: an ACTIVE session always carries a persisted clock. Treat as "before kickoff"
    // rather than throwing, matching a freshly created session's actual clock state.
    return resolveLiveReportingPrimaryAction({ ...input, clock: { period: "BEFORE", running: false } });
  }

  if (isMatchOver(clock.period)) {
    return { kind: "FINISH_LIVE_REPORTING" };
  }

  if (isPlayingPeriod(clock.period, periodConfig)) {
    const label = labelFor(clock.period, periodConfig);
    return clock.running
      ? { kind: "END_PERIOD", period: clock.period, label: `End ${label.toLowerCase()}` }
      : { kind: "RESUME_PERIOD", period: clock.period, label: `Resume ${label.toLowerCase()}` };
  }

  // Before kickoff, or a break period (including a legacy/custom period config this app has
  // never seen before) — the next playable period, if any, is the primary action; if there is
  // none, the match has no further period to start and Finish is the only sensible action.
  const next = getPeriodAfter(clock.period, periodConfig);
  if (!next) {
    return { kind: "FINISH_LIVE_REPORTING" };
  }
  return { kind: "START_PERIOD", period: next, label: `Start ${labelFor(next, periodConfig).toLowerCase()}` };
}
