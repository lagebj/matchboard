"use client";

/**
 * ADR-0146 (bundle §05.7–§05.11) — the one Live Reporting guardrails warning surface. Renders
 * the `LiveReportingWarning` resolved by `resolveLiveReportingWarning()` from the session's
 * ACTUAL start (`startedAt`), never from scheduled kickoff.
 *
 * Two variants, one component:
 * - `editable` (Live Reporting client): the warning may carry actions — `Continue live
 *   reporting` (dismiss/acknowledge, presentation-only: bundle §03.15 forbids it from touching
 *   `startedAt`, the format snapshot, or any deadline) and a prominent `Finish live reporting`
 *   shortcut at STRONG severity.
 * - `readOnly` (Follow Live): warning-neutral live status only — NO actionable controls,
 *   per bundle §05.16 (the read-only mutation-control regression must not return).
 *
 * Every warning is non-destructive: nothing here stops a clock, ends a period, or changes any
 * persisted timing. The 270-minute finish authority is the server reconciler (ADR-0146 §7).
 */

import type { LiveReportingWarning } from "@/lib/live-match/live-reporting-guardrails";

const WARNING_TEST_IDS: Record<LiveReportingWarning["kind"], string> = {
  PERIOD_OVERRUN: "live-period-overrun-warning",
  CONTEXTUAL_MATCH: "live-contextual-match-warning",
  LEGACY_FALLBACK: "live-legacy-fallback-warning",
  STRONG: "live-strong-warning",
  EXPIRED: "live-expired-warning",
};

interface LiveReportingWarningBannerProps {
  warning: LiveReportingWarning;
  /** Follow Live and other read-only viewers get no action controls (bundle §05.16). */
  readOnly?: boolean;
  /** Dismiss/acknowledge — presentation-only (bundle §03.15). Optional even for editable users
   * at EXPIRED severity, where there is nothing to continue. */
  onContinue?: () => void;
  /** Shortcut to the client's own finish flow (still the same manual operation, §05.11). */
  onFinish?: () => void;
}

export function LiveReportingWarningBanner({ warning, readOnly = false, onContinue, onFinish }: LiveReportingWarningBannerProps) {
  const isStrong = warning.kind === "STRONG" || warning.kind === "EXPIRED";

  const body = getWarningBody(warning.kind);

  return (
    <div
      data-testid={WARNING_TEST_IDS[warning.kind]}
      role="status"
      className={`mx-3 mt-2 px-3 py-2.5 rounded-lg border text-sm ${
        isStrong
          ? "bg-[var(--warning-subtle)] border-[color-mix(in_srgb,var(--warning)_45%,transparent)]"
          : "bg-[var(--surface-hover)]/60 border-[var(--border-soft)]"
      }`}
    >
      <p className={isStrong ? "text-[var(--warning)] font-medium" : "text-[var(--text-soft)]"}>{body}</p>
      {!readOnly && (
        <div className="mt-2 flex flex-wrap gap-2">
          {warning.kind === "EXPIRED" ? (
            onFinish && (
              <button
                onClick={onFinish}
                className="px-3 py-2 min-h-[44px] rounded-lg text-sm font-semibold bg-[var(--warning)] text-[var(--surface-base)] hover:brightness-110 active:brightness-95"
              >
                Finish live reporting
              </button>
            )
          ) : (
            <>
              {onContinue && (
                <button
                  onClick={onContinue}
                  className="px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium bg-[var(--surface-hover)] text-[var(--text-soft)] hover:bg-[var(--surface-strong)]"
                >
                  Continue live reporting
                </button>
              )}
              {onFinish && (
                <button
                  onClick={onFinish}
                  className="px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium bg-[var(--surface-strong)] text-[var(--foreground)] hover:brightness-95"
                >
                  Finish live reporting
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** One copy source for every severity — bundle §05.7–§05.11 recommended copy, adapted to the
 * component's own casing ("live reporting", matching the existing "Finish live reporting"
 * action label, bundle §05.6's keep-the-wording rule). */
function getWarningBody(kind: LiveReportingWarning["kind"]): string {
  switch (kind) {
    case "PERIOD_OVERRUN":
      return "This period has been running longer than the configured period length. If play is still continuing, no action is required. If the period has ended, end the period in live reporting.";
    case "CONTEXTUAL_MATCH":
      return "Live reporting has been active substantially longer than this match's configured format. Is the match still in progress?";
    case "LEGACY_FALLBACK":
      return "Live reporting has been active for 3 hours. Is the match still in progress?";
    case "STRONG":
      return "Live reporting has been active for 4 hours. It will finish automatically 4 hours 30 minutes after it started.";
    case "EXPIRED":
      return "Live reporting passed the 4 hours 30 minutes limit and will finish automatically. Finishing it now uses the same safe completion.";
  }
}