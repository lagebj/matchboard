import type { MatchLifecycleStatus } from "@/lib/selection/planning-boundary";

/**
 * Whether the "Start live reporting" entry point should be offered for a League match on the
 * match-detail page (ADR-0133 H5, refined 2026-09-12).
 *
 * The 2026-09-09 incident had the coach hand-type `/live` because the only entry point was
 * gated on every `Selection` being `FINALIZED` — which only happens once the planning baseline
 * is captured, and that captures lazily (at/after kickoff, or when live reporting itself
 * starts). H5 replaced that with a real-world-clock/lifecycle gate, but coaches kept losing
 * track of the button in the days/hours before a match because it was still hidden until an
 * hour before kickoff (`LIVE_REPORTING_LEAD_MS`, removed here).
 *
 * The match-detail entry point is now offered for the entire life of an unplayed, unreported,
 * non-cancelled match, regardless of how far before kickoff the coach opens the page — there is
 * no safety benefit to hiding it, and hiding it is exactly what made it hard to find. Today's
 * own "Start live reporting" work item (`get-assistant-command-centre.ts`) keeps its own,
 * separate, narrower gate (only surfaces once a finalized squad exists for the match) — that
 * remains the intentionally-gated surface; the match view is not.
 *
 * - always available while a session is live;
 * - available for any not-yet-played, not-yet-reported, non-cancelled match;
 * - never for a cancelled match, a completed report (`done`), one whose report is already in
 *   progress (`report_incomplete` — "After match" is the path then), or a match whose kickoff
 *   day has fully passed with no report (`played` — also "After match").
 */
export function canStartLiveReporting(params: {
  lifecycleStatus: MatchLifecycleStatus | null | undefined;
  isCancelled: boolean;
  isLive: boolean;
}): boolean {
  const { isCancelled, isLive } = params;
  if (isCancelled) return false;
  if (isLive) return true;

  const lifecycle = params.lifecycleStatus ?? "planning_open";
  if (lifecycle === "done" || lifecycle === "report_incomplete" || lifecycle === "played") {
    return false;
  }
  // planning_open or planning_closed: always offered, regardless of kickoff proximity.
  return true;
}
