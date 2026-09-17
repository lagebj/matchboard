/**
 * ADR-0146 §3 — the one shared Live Reporting guardrails module both League and Event read.
 * Every absolute limit, allowance, and warning threshold in this file is normative from the
 * "Matchboard Live Reporting Guardrails and Match Format" bundle (§03 "Live Timing and
 * Recovery"); no per-domain duplicate of any of these values may exist elsewhere.
 *
 * All time-of-session formulas are anchored ONLY to the session's actual `startedAt`
 * (`LiveMatchSession.startedAt`/`EventLiveMatchSession.startedAt` — set once server-side at
 * session creation, ADR-0146 §2), never to `Match.startsAt`/`EventMatch.startsAt`. A fixture
 * moved in real life but not updated in Matchboard can never trigger (or dodge) these
 * thresholds through its scheduled kickoff.
 *
 * None of these thresholds automatically ends a period or a session. Configured period
 * duration is an expectation, not an automatic whistle (bundle §03.4/§03.5): every warning
 * here is non-destructive presentation, and only the server-side reconciliation job (§7,
 * slice 4) may *finish* a session, and only at the 270-minute limit.
 */

import type { MatchFormatDefinition } from "./match-format";
import { getExpectedWallClockDurationMinutes } from "./match-format";

// --- Absolute Live Reporting limits (bundle §03.1) ---

/** Advisory stale-session warning when NO usable match-format snapshot exists. */
export const LIVE_REPORTING_FALLBACK_SOFT_WARNING_MINUTES = 180;
/** Persistent strong warning, independent of any format or kickoff. */
export const LIVE_REPORTING_STRONG_WARNING_MINUTES = 240;
/** Hard server-side auto-finish eligibility, anchored only to actual session start. */
export const LIVE_REPORTING_AUTO_FINISH_MINUTES = 270;

// --- Period recovery allowance (bundle §03.1, §03.9.2) ---

/** Not an assumed football period duration — only the automatic-recovery trust bound. */
export const LEGACY_ACTIVE_PERIOD_RECOVERY_CEILING_MINUTES = 60;

export const PERIOD_OVERRUN_ALLOWANCE_MIN_MINUTES = 10;
export const PERIOD_OVERRUN_ALLOWANCE_RATIO = 0.25;

export function periodOverrunAllowanceMs(intendedPeriodDurationMs: number): number {
  return Math.max(
    PERIOD_OVERRUN_ALLOWANCE_MIN_MINUTES * 60 * 1000,
    intendedPeriodDurationMs * PERIOD_OVERRUN_ALLOWANCE_RATIO,
  );
}

/** Ceiling a still-active period is recovered to at Finish Live Reporting (bundle §03.9.2). */
export function activePeriodRecoveryCeilingMs(intendedPeriodDurationMs: number): number {
  return intendedPeriodDurationMs + periodOverrunAllowanceMs(intendedPeriodDurationMs);
}

// --- Contextual whole-match warning (bundle §03.1, §03.6) ---

export const MATCH_OVERRUN_ALLOWANCE_MIN_MINUTES = 30;
export const MATCH_OVERRUN_ALLOWANCE_RATIO = 0.5;

export function expectedWallClockDurationMs(format: MatchFormatDefinition): number {
  return getExpectedWallClockDurationMinutes(format) * 60 * 1000;
}

export function matchOverrunAllowanceMs(expectedWallClockDurationMs: number): number {
  return Math.max(
    MATCH_OVERRUN_ALLOWANCE_MIN_MINUTES * 60 * 1000,
    expectedWallClockDurationMs * MATCH_OVERRUN_ALLOWANCE_RATIO,
  );
}

/** Informational whole-match warning threshold (ms from session start) for a frozen format. */
export function contextualMatchWarningAtMs(format: MatchFormatDefinition): number {
  const expected = expectedWallClockDurationMs(format);
  return expected + matchOverrunAllowanceMs(expected);
}

// --- Client-facing warning resolution ---

/** One warning at a time — the highest-severity active signal (bundle §03.5–§03.8, §05.7–§05.11). */
export type LiveReportingWarningKind =
  | "PERIOD_OVERRUN"
  | "CONTEXTUAL_MATCH"
  | "LEGACY_FALLBACK"
  | "STRONG"
  | "EXPIRED";

export interface LiveReportingWarning {
  kind: LiveReportingWarningKind;
  /** Threshold in ms from session start (PERIOD_OVERRUN: ms from period start) — diagnostics only. */
  thresholdMs: number;
}

/**
 * The one warning resolver the editable Live Reporting client (and read-only Follow Live,
 * non-actionably) uses. Precedence, low → high:
 *
 *   PERIOD_OVERRUN  (bundle §03.5 — active period past intended + allowance; needs a format)
 *   CONTEXTUAL_MATCH (§03.6 — session past expected+allowance; needs a format)
 *   LEGACY_FALLBACK (§03.6/§05.9 — 180m fixed threshold when NO format snapshot exists)
 *   STRONG          (§03.7 — 240m absolute, independent of format and kickoff)
 *   EXPIRED         (§05.11 — client observes ≥270m elapsed; server reconciliation is the
 *                    actual finish authority, this only presents the expired status)
 *
 * `activePeriodElapsedMs`/`activePeriodDurationMs` describe the *currently running* period
 * only (null when the clock is paused, in a break, or before kickoff). All inputs are already
 * session-authoritative values — never scheduled kickoff, never client wall-clock guesses.
 */
export function resolveLiveReportingWarning(input: {
  format: MatchFormatDefinition | null;
  liveReportingStartedAt: Date;
  nowMs: number;
  activePeriodElapsedMs: number | null;
  activePeriodDurationMs: number | null;
}): LiveReportingWarning | null {
  const elapsedMs = input.nowMs - input.liveReportingStartedAt.getTime();

  if (elapsedMs >= LIVE_REPORTING_AUTO_FINISH_MINUTES * 60 * 1000) {
    return { kind: "EXPIRED", thresholdMs: LIVE_REPORTING_AUTO_FINISH_MINUTES * 60 * 1000 };
  }

  if (elapsedMs >= LIVE_REPORTING_STRONG_WARNING_MINUTES * 60 * 1000) {
    return { kind: "STRONG", thresholdMs: LIVE_REPORTING_STRONG_WARNING_MINUTES * 60 * 1000 };
  }

  // The 180-minute fallback is used ONLY when no usable format snapshot exists (bundle §03.1).
  if (input.format) {
    const contextualAtMs = contextualMatchWarningAtMs(input.format);
    if (elapsedMs >= contextualAtMs) {
      return { kind: "CONTEXTUAL_MATCH", thresholdMs: contextualAtMs };
    }

    if (
      input.activePeriodElapsedMs != null &&
      input.activePeriodDurationMs != null &&
      input.activePeriodElapsedMs >= periodOverrunWarningAtMs(input.activePeriodDurationMs)
    ) {
      return {
        kind: "PERIOD_OVERRUN",
        thresholdMs: periodOverrunWarningAtMs(input.activePeriodDurationMs),
      };
    }

    return null;
  }

  if (elapsedMs >= LIVE_REPORTING_FALLBACK_SOFT_WARNING_MINUTES * 60 * 1000) {
    return { kind: "LEGACY_FALLBACK", thresholdMs: LIVE_REPORTING_FALLBACK_SOFT_WARNING_MINUTES * 60 * 1000 };
  }

  return null;
}

/** Threshold (ms from period start) past which the active period shows an overrun warning. */
export function periodOverrunWarningAtMs(intendedPeriodDurationMs: number): number {
  return activePeriodRecoveryCeilingMs(intendedPeriodDurationMs);
}

/**
 * Absolute timestamp of the contextual/legacy whole-match warning, anchored only to the
 * session's actual start. `format: null` uses the fixed 180-minute fallback.
 */
export function contextualWarningAtMs(format: MatchFormatDefinition | null, liveReportingStartedAt: Date): number {
  const thresholdMs = format
    ? contextualMatchWarningAtMs(format)
    : LIVE_REPORTING_FALLBACK_SOFT_WARNING_MINUTES * 60 * 1000;
  return liveReportingStartedAt.getTime() + thresholdMs;
}