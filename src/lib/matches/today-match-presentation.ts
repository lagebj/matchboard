import type { TodayMatch } from "@/lib/assistant/types";
import { buildMatchPresentation, type MatchPresentation } from "@/lib/matches/match-presentation";

/**
 * Build the canonical match presentation for a `TodayMatch` row. A played match with a
 * post-match report shows its scoreline + W/D/L; a live match with no report row yet shows
 * state + time (its "Follow live" action is the value).
 *
 * Shared by the Today server page (`(app)/o/[orgSlug]/today/page.tsx`, which needs it to build
 * the Atlas "next match" hero presentation server-side) and `AssistantCommandCentrePage`'s
 * `TodayOperationalTimeline` (which needs it client-side, for org-relative hrefs via
 * `useOrgUrl()`) — moved out of the client component so a plain, non-hook data transform isn't
 * defined inside a `"use client"` module a server component would otherwise need to import from.
 */
export function todayMatchPresentation(match: TodayMatch, href: string): MatchPresentation {
  const isHome = match.homeAway === "HOME";
  const hasScore = match.homeScore != null && match.awayScore != null;
  // TodayMatch scores are home/away oriented; buildMatchPresentation wants them
  // our-team-relative and re-orients with isHome.
  const ownGoals = !hasScore ? null : isHome ? match.homeScore : match.awayScore;
  const opponentGoals = !hasScore ? null : isHome ? match.awayScore : match.homeScore;
  const outcome =
    ownGoals == null || opponentGoals == null
      ? null
      : ownGoals > opponentGoals
        ? "WON"
        : ownGoals < opponentGoals
          ? "LOST"
          : "DRAWN";
  return buildMatchPresentation({
    id: match.matchId,
    href,
    teamName: match.teamName,
    opponentName: match.opponent,
    isHome,
    kickoffAt: match.startsAt,
    lifecycleStatus: match.lifecycleStatus,
    ownGoals,
    opponentGoals,
    outcome,
  });
}

/**
 * The next still-upcoming (not live, not played) `TodayMatch`, soonest first — the same
 * selection `TodayOperationalTimeline` already uses for its "NEXT" timeline node, shared here so
 * the Today Atlas hero (`(app)/o/[orgSlug]/today/page.tsx`) features the identical match rather
 * than re-deriving an equivalent-but-separate selection.
 */
export function resolveFeaturedUpcomingMatch(matches: TodayMatch[]): TodayMatch | undefined {
  const sorted = [...matches].sort((a, b) => {
    const av = a.startsAt ? Date.parse(a.startsAt) : Number.MAX_SAFE_INTEGER;
    const bv = b.startsAt ? Date.parse(b.startsAt) : Number.MAX_SAFE_INTEGER;
    return av - bv;
  });
  return sorted.find((m) => m.lifecycleStatus === "planning_open" || m.lifecycleStatus === "planning_closed");
}
