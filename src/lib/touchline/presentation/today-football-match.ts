/**
 * Today football-match presentation boundary (Today Matchday Follow-up bundle, ADR-0143). A
 * shared, source-agnostic model so League and Event matches can be featured through one Matchday
 * presentation contract (D9) — this module owns no domain rules; it only adapts already-computed
 * League `TodayMatch` rows and Event match facts into a common shape, and deterministically
 * selects which one same-day match, if any, becomes the featured Matchday/Live Now anchor (D10).
 */

import type { MatchLifecycleStatus } from "@/lib/selection/planning-boundary";
import type { TodayMatch } from "@/lib/assistant/types";

export type TodayFootballMatchSource = "LEAGUE" | "EVENT";

export type TodayFootballMatch = {
  id: string;
  source: TodayFootballMatchSource;
  containerId: string;
  containerLabel: string;
  teamOrSquadName: string;
  opponentName: string;
  startsAt: string | null;
  venueLabel: string | null;
  lifecycleStatus: MatchLifecycleStatus;
  hasActiveLiveSession: boolean;
  reportState: string | null;
  score: { own: number; opponent: number } | null;
  href: string;
  liveEntryHref: string | null;
};

/** Adapts an already-computed League `TodayMatch` (org-relative hrefs are resolved by the
 * caller, which has access to `useOrgUrl()`). */
export function leagueMatchToTodayFootballMatch(match: TodayMatch, orgUrl: (path: string) => string): TodayFootballMatch {
  const isHome = match.homeAway === "HOME";
  const hasScore = match.homeScore != null && match.awayScore != null;
  const ownGoals = !hasScore ? null : isHome ? match.homeScore : match.awayScore;
  const opponentGoals = !hasScore ? null : isHome ? match.awayScore : match.homeScore;

  return {
    id: match.matchId,
    source: "LEAGUE",
    containerId: match.matchRoundId,
    containerLabel: match.matchRoundName,
    teamOrSquadName: match.teamName,
    opponentName: match.opponent,
    startsAt: match.startsAt,
    venueLabel: isHome ? "Home" : "Away",
    lifecycleStatus: match.lifecycleStatus,
    hasActiveLiveSession: match.hasActiveLiveSession,
    reportState: match.reportStatus,
    score: ownGoals != null && opponentGoals != null ? { own: ownGoals, opponent: opponentGoals } : null,
    href: orgUrl(`/matches/${match.matchId}`),
    liveEntryHref: orgUrl(`/matches/${match.matchId}/live`),
  };
}

export type EventMatchTodayFacts = {
  eventMatchId: string;
  eventId: string;
  eventName: string;
  squadName: string;
  opponentName: string;
  startsAt: string | null;
  status: "SCHEDULED" | "CANCELLED";
  hasActiveLiveSession: boolean;
  hasLineup: boolean;
  reportStatus: "DRAFT" | "REPORTED" | "LOCKED" | null;
  score: { own: number; opponent: number } | null;
};

/** Derives the shared `MatchLifecycleStatus` for an Event match from its own canonical facts —
 * mirrors `deriveMatchLifecycleStatus()`'s priority order (report status, then live, then
 * kickoff-passed) without importing League's round/planning-closed concepts, which Events do not
 * have (D3.14 "if an Event concept does not exist, omit that readiness fact rather than
 * fabricating parity"). */
export function deriveEventMatchLifecycleStatus(facts: {
  status: "SCHEDULED" | "CANCELLED";
  reportStatus: "DRAFT" | "REPORTED" | "LOCKED" | null;
  hasActiveLiveSession: boolean;
  hasPassed: boolean;
}): MatchLifecycleStatus {
  if (facts.status === "CANCELLED") return "cancelled";
  if (facts.reportStatus === "LOCKED") return "done";
  if (facts.reportStatus === "DRAFT" || facts.reportStatus === "REPORTED") return "report_incomplete";
  if (facts.hasActiveLiveSession) return "live";
  if (facts.hasPassed) return "played";
  return "planning_open";
}

export function eventMatchToTodayFootballMatch(
  facts: EventMatchTodayFacts,
  orgUrl: (path: string) => string,
  now: Date = new Date(),
): TodayFootballMatch {
  const hasPassed = facts.startsAt != null && Date.parse(facts.startsAt) <= now.getTime();
  const lifecycleStatus = deriveEventMatchLifecycleStatus({
    status: facts.status,
    reportStatus: facts.reportStatus,
    hasActiveLiveSession: facts.hasActiveLiveSession,
    hasPassed,
  });

  return {
    id: facts.eventMatchId,
    source: "EVENT",
    containerId: facts.eventId,
    containerLabel: facts.eventName,
    teamOrSquadName: facts.squadName,
    opponentName: facts.opponentName,
    startsAt: facts.startsAt,
    venueLabel: null,
    lifecycleStatus,
    hasActiveLiveSession: facts.hasActiveLiveSession,
    reportState: facts.reportStatus ? facts.reportStatus.toLowerCase() : null,
    score: facts.score,
    href: orgUrl(`/events/${facts.eventId}`),
    liveEntryHref: orgUrl(`/events/${facts.eventId}/matches/${facts.eventMatchId}/live`),
  };
}

const POST_MATCH_LIFECYCLE_STATUSES: ReadonlySet<MatchLifecycleStatus> = new Set([
  "played",
  "report_incomplete",
  "done",
]);

function isReportClosed(match: TodayFootballMatch): boolean {
  return match.lifecycleStatus === "done";
}

/**
 * Deterministic featured-match selection (D10). Returns `undefined` whenever any candidate is
 * currently live — a live match is owned by the existing Live Now selection/summary, never by
 * Matchday, so composition should render `TodayLiveNow` instead and not call this function's
 * result at all in that case. Also returns `undefined` when there are no eligible candidates.
 */
export function selectFeaturedTodayFootballMatch(matches: TodayFootballMatch[]): TodayFootballMatch | undefined {
  if (matches.some((m) => m.hasActiveLiveSession)) return undefined;

  const nonCancelled = matches.filter((m) => m.lifecycleStatus !== "cancelled");
  const pool = nonCancelled.length > 0 ? nonCancelled : matches;
  if (pool.length === 0) return undefined;

  const sorted = stableSortByKickoff(pool);

  // 2. Nearest upcoming same-day match.
  const upcoming = sorted.find(
    (m) => m.lifecycleStatus === "planning_open" || m.lifecycleStatus === "planning_closed",
  );
  if (upcoming) return upcoming;

  // 3. Most recently played same-day match with unresolved closure work (report not yet
  // complete/locked).
  const unresolvedPostMatch = sorted
    .filter((m) => POST_MATCH_LIFECYCLE_STATUSES.has(m.lifecycleStatus) && !isReportClosed(m))
    .sort(byKickoffDescending)[0];
  if (unresolvedPostMatch) return unresolvedPostMatch;

  // 4. Most recently completed same-day match as a quiet anchor.
  const closed = sorted.filter((m) => isReportClosed(m)).sort(byKickoffDescending)[0];
  if (closed) return closed;

  // 5. Every remaining same-day match is cancelled — show cancellation as a quiet anchor.
  return sorted[0];
}

function stableSortByKickoff(matches: TodayFootballMatch[]): TodayFootballMatch[] {
  return [...matches].sort((a, b) => {
    const av = kickoffSortValue(a);
    const bv = kickoffSortValue(b);
    if (av !== bv) return av - bv;
    if (a.source !== b.source) return a.source === "LEAGUE" ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

function byKickoffDescending(a: TodayFootballMatch, b: TodayFootballMatch): number {
  return kickoffSortValue(b) - kickoffSortValue(a);
}

function kickoffSortValue(match: TodayFootballMatch): number {
  return match.startsAt ? Date.parse(match.startsAt) : Number.MAX_SAFE_INTEGER;
}

/**
 * Identity-based deduplication between Matchday and the rest of Today (D12, 4.8). Only an
 * identity Matchday actually *displays* belongs here — never derived from text similarity, round
 * membership, or potential-assignment-to-the-featured-match alone (4.10).
 */
export type TodayMatchdayConsumption = {
  representedCandidateIds: Set<string>;
  representedSignalKeys: Set<string>;
  representedWorkItemIds: Set<string>;
};

export function emptyMatchdayConsumption(): TodayMatchdayConsumption {
  return {
    representedCandidateIds: new Set(),
    representedSignalKeys: new Set(),
    representedWorkItemIds: new Set(),
  };
}
