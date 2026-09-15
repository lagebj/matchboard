/**
 * Today Matchday phase model (Today Matchday Follow-up bundle, ADR-0143). A pure, DB-free
 * resolver: given the current time, a match's kickoff, its canonical lifecycle status, whether
 * it has an active live session, and whether the canonical live-start flow still accepts it, it
 * derives the single `TodayMatchdayPhase` that drives Matchday's display language and the
 * "Start live reporting" prominence rule.
 *
 * Canonical lifecycle state always outranks local phase arithmetic (D4) — an active live session
 * always wins, and a canonical post-match lifecycle is never overridden by minute-based guesses
 * about whether the match "must" have finished.
 */

import type { MatchLifecycleStatus } from "@/lib/selection/planning-boundary";

/** 120 minutes before kickoff: PREPARE -> VERIFY (D4). */
export const MATCHDAY_VERIFY_WINDOW_MINUTES = 120;

/** 45 minutes before kickoff: VERIFY -> IMMINENT, and the window in which "Start live reporting"
 * may become the preferred Matchday action (D5). */
export const MATCHDAY_START_LIVE_WINDOW_MINUTES = 45;

export type TodayMatchdayPhase = "PREPARE" | "VERIFY" | "IMMINENT" | "LIVE" | "POST_MATCH";

export type ResolveTodayMatchdayPhaseInput = {
  nowIso: string;
  startsAtIso: string | null;
  lifecycleStatus: MatchLifecycleStatus;
  hasActiveLiveSession: boolean;
  /** Whether the existing canonical live-start flow would still accept starting/resuming live
   * reporting for this match right now (e.g. not already report-locked). Used only to decide
   * whether a kickoff-passed match with no active session stays IMMINENT rather than reverting
   * to a stale PREPARE/VERIFY reading (D4 "if kickoff has passed but canonical lifecycle still
   * allows live reporting to start ... keep the match in IMMINENT with kickoffPassed=true"). */
  canEnterLiveReporting: boolean;
};

export type TodayMatchdayPhaseResult = {
  phase: TodayMatchdayPhase;
  /** Minutes until kickoff, unrounded; negative once kickoff has passed; null when there is no
   * canonical kickoff time at all. */
  minutesToKickoff: number | null;
  kickoffPassed: boolean;
};

const POST_MATCH_LIFECYCLE_STATUSES: ReadonlySet<MatchLifecycleStatus> = new Set([
  "played",
  "report_incomplete",
  "done",
]);

export function resolveTodayMatchdayPhase(input: ResolveTodayMatchdayPhaseInput): TodayMatchdayPhaseResult {
  const minutesToKickoff =
    input.startsAtIso != null ? computeMinutesToKickoff(input.nowIso, input.startsAtIso) : null;

  // 1. Active live session always wins — canonical lifecycle outranks local arithmetic.
  if (input.hasActiveLiveSession) {
    return { phase: "LIVE", minutesToKickoff, kickoffPassed: false };
  }

  // 2. Canonical post-match lifecycle — never overridden by kickoff-proximity guesses.
  if (POST_MATCH_LIFECYCLE_STATUSES.has(input.lifecycleStatus)) {
    return { phase: "POST_MATCH", minutesToKickoff, kickoffPassed: minutesToKickoff != null ? minutesToKickoff < 0 : true };
  }

  // 3. Missing kickoff — same-day context with no known time.
  if (minutesToKickoff == null) {
    return { phase: "PREPARE", minutesToKickoff: null, kickoffPassed: false };
  }

  // 4. Positive minutes to kickoff.
  if (minutesToKickoff >= 0) {
    if (minutesToKickoff > MATCHDAY_VERIFY_WINDOW_MINUTES) {
      return { phase: "PREPARE", minutesToKickoff, kickoffPassed: false };
    }
    if (minutesToKickoff > MATCHDAY_START_LIVE_WINDOW_MINUTES) {
      return { phase: "VERIFY", minutesToKickoff, kickoffPassed: false };
    }
    return { phase: "IMMINENT", minutesToKickoff, kickoffPassed: false };
  }

  // 5. Kickoff has passed with no active session and no canonical post-match lifecycle yet.
  if (input.canEnterLiveReporting) {
    return { phase: "IMMINENT", minutesToKickoff, kickoffPassed: true };
  }

  // Live reporting is no longer a valid entry (e.g. authorization/lifecycle prevents it) — do
  // not invent a finished state; preserve the pre-live reading the canonical lifecycle implies.
  return { phase: "PREPARE", minutesToKickoff, kickoffPassed: true };
}

function computeMinutesToKickoff(nowIso: string, startsAtIso: string): number {
  const now = Date.parse(nowIso);
  const startsAt = Date.parse(startsAtIso);
  return (startsAt - now) / 60_000;
}

/** Formats a positive minute count as a compact duration, e.g. `1h 35m`, `45m`, `28m`. Callers
 * should clamp/guard negative values themselves (kickoff-passed display uses different copy). */
export function formatMatchdayCountdown(totalMinutes: number): string {
  const clamped = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}
