import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { deriveMatchLifecycleStatus } from "@/lib/selection/planning-boundary";
import { buildMatchPresentation, type MatchPresentation } from "@/lib/matches/match-presentation";

const UPCOMING_WINDOW_DAYS = 7;

/**
 * Bounded forward-looking sibling of `getRecentCompletedMatches()` (same narrow, indexed,
 * `[startsAt]`-ordered query shape; same reasoning against calling the unbounded
 * `getFixturesOverview()` from Today, the single highest-traffic page — see that function's own
 * doc comment and `docs/domain/touchline-atlas-provenance.md` §14/§17).
 *
 * Feeds Today's quiet-day "This week" compact chronology (ADR-0157 §6,
 * `04_TODAY_SURFACE.md` composition state A item 4) — explicitly permitted as new, bounded data
 * for Today by `12_DATA_AND_QUERY_CONTRACT.md`'s "bounded next-football chronology" allowance.
 * Not used for any season-wide analysis.
 */
export async function getTodayUpcomingWeekMatches(
  orgFilter: OrgFilterMode,
  orgUrl: (path: string) => string,
  excludeMatchIds: ReadonlySet<string>,
  limit = 4,
): Promise<MatchPresentation[]> {
  const organisationId = orgFilter.organisationId;
  const now = new Date();
  const windowEnd = new Date(now.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const matches = await db.match.findMany({
    where: { organisationId, status: { not: "CANCELLED" }, startsAt: { gt: now, lte: windowEnd } },
    orderBy: { startsAt: "asc" },
    take: limit + excludeMatchIds.size,
    select: {
      id: true,
      opponent: true,
      homeAway: true,
      startsAt: true,
      team: { select: { name: true } },
    },
  });
  if (matches.length === 0) return [];

  const included = matches.filter((m) => !excludeMatchIds.has(m.id)).slice(0, limit);
  if (included.length === 0) return [];

  return included.map((match) => {
    const isHome = match.homeAway === "HOME";
    return buildMatchPresentation({
      id: match.id,
      href: orgUrl(`/matches/${match.id}`),
      teamName: match.team.name,
      opponentName: match.opponent,
      isHome,
      kickoffAt: match.startsAt.toISOString(),
      lifecycleStatus: deriveMatchLifecycleStatus({
        matchStatus: "SCHEDULED",
        reportStatus: "NONE",
        hasPassed: false,
        isLive: false,
        roundStatus: "",
        planningClosedAt: null,
        startsAt: match.startsAt,
      }),
      ownGoals: null,
      opponentGoals: null,
      outcome: null,
    });
  });
}
