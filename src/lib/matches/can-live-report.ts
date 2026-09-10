import type { MatchLifecycleStatus } from "@/lib/selection/planning-boundary";

/** How long before kickoff the "Start live reporting" entry point becomes available. */
export const LIVE_REPORTING_LEAD_MS = 60 * 60 * 1000;

/**
 * Whether the "Start live reporting" entry point should be offered for a League match
 * (ADR-0133 H5).
 *
 * The 2026-09-09 incident had the coach hand-type `/live` because the only entry point was
 * gated on every `Selection` being `FINALIZED` — which only happens once the planning baseline
 * is captured, and that captures lazily (at/after kickoff, or when live reporting itself
 * starts). This gate is driven by the real-world clock and lifecycle instead:
 *
 * - always available while a session is live;
 * - available once the plan is no longer open for editing (`planning_closed`) or every
 *   selection is finalized;
 * - available in the hour before kickoff so the coach can start during warm-up;
 * - never for a cancelled match, a completed report (`done`), or one whose report is already
 *   in progress (`report_incomplete` — "After match" is the path then), or a match whose
 *   kickoff day has fully passed with no report (`played` — also "After match").
 */
export function canStartLiveReporting(params: {
  lifecycleStatus: MatchLifecycleStatus | null | undefined;
  isCancelled: boolean;
  isLive: boolean;
  allSelectionsFinalized: boolean;
  startsAt: Date;
  now?: Date;
}): boolean {
  const { isCancelled, isLive, allSelectionsFinalized, startsAt } = params;
  if (isCancelled) return false;
  if (isLive) return true;

  const lifecycle = params.lifecycleStatus ?? "planning_open";
  if (lifecycle === "done" || lifecycle === "report_incomplete" || lifecycle === "played") {
    return false;
  }
  if (lifecycle === "planning_closed" || allSelectionsFinalized) return true;

  // lifecycle === "planning_open": offer it once kickoff is imminent.
  const now = (params.now ?? new Date()).getTime();
  return now >= startsAt.getTime() - LIVE_REPORTING_LEAD_MS;
}
