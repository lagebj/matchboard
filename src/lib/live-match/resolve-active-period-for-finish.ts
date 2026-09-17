/**
 * ADR-0146 §6/§9 — resolving a still-active period at `finishLiveReporting` time. A pure
 * function (no DB, no clock reads) so the exact recovery formula is unit-testable against the
 * bundle's own worked examples without a database — `finish-live-reporting.ts` is the only
 * caller, supplying the raw elapsed duration it already computed from the session's persisted
 * clock state.
 *
 * Manual and TIMEOUT triggers call this identically (ADR-0146 §10/D9) — there is no
 * timeout-specific recovery algorithm.
 */

import type { MatchPeriod } from "@/generated/prisma/client";
import { activePeriodRecoveryCeilingMs, LEGACY_ACTIVE_PERIOD_RECOVERY_CEILING_MINUTES } from "./live-reporting-guardrails";

export type ActivePeriodResolutionSource = "FINISH_LIVE_REPORTING" | "RECOVERED_BOUNDED";

export interface ActivePeriodResolution {
  period: MatchPeriod;
  /** The raw persisted-clock elapsed duration at the moment of resolution — always populated,
   * regardless of whether it needed clamping (diagnostic value; only `RECOVERED_BOUNDED` rows
   * persist it as `rawElapsedMs`, per ADR-0146 §8's "only when clamped" note). */
  rawElapsedMs: number;
  resolvedDurationMs: number;
  resolutionSource: ActivePeriodResolutionSource;
  reviewStatus: "NOT_REQUIRED" | "NEEDS_REVIEW";
}

/**
 * `intendedPeriodDurationMs: null` means no usable frozen format snapshot exists for this
 * session (a legacy/unconfigured match) — the 60-minute legacy ceiling applies instead
 * (ADR-0146 §3/D9), never a guessed football duration.
 */
export function resolveActivePeriodForFinish(params: {
  period: MatchPeriod;
  rawElapsedMs: number;
  intendedPeriodDurationMs: number | null;
}): ActivePeriodResolution {
  const ceilingMs =
    params.intendedPeriodDurationMs != null
      ? activePeriodRecoveryCeilingMs(params.intendedPeriodDurationMs)
      : LEGACY_ACTIVE_PERIOD_RECOVERY_CEILING_MINUTES * 60 * 1000;

  if (params.rawElapsedMs <= ceilingMs) {
    return {
      period: params.period,
      rawElapsedMs: params.rawElapsedMs,
      resolvedDurationMs: params.rawElapsedMs,
      resolutionSource: "FINISH_LIVE_REPORTING",
      reviewStatus: "NOT_REQUIRED",
    };
  }

  return {
    period: params.period,
    rawElapsedMs: params.rawElapsedMs,
    resolvedDurationMs: ceilingMs,
    resolutionSource: "RECOVERED_BOUNDED",
    reviewStatus: "NEEDS_REVIEW",
  };
}
