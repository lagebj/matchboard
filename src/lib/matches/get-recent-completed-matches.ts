import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { deriveMatchLifecycleStatus } from "@/lib/selection/planning-boundary";
import { buildMatchPresentation, type MatchPresentation } from "@/lib/matches/match-presentation";

/**
 * Last N completed (REPORTED/LOCKED) League matches org-wide, own-team perspective — feeds the
 * Today "Latest matches" widget (Touchline Design Atlas, ADR-0136).
 *
 * A deliberately narrow, indexed, bounded query -- NOT `getFixturesOverview()` (which loads every
 * season/league-season/round/match org-wide, unbounded, to build the full League page). That
 * function is fine as League's own one-time-per-visit cost, but Today is very likely the
 * single highest-traffic page in the app (the default post-login landing surface), so calling
 * it a second time from Today doubles the cost of that whole-season tree across every request.
 * This was a real, measured cause of PR #522/#523's repeated "Deploy PR to Test slot" CI timeouts
 * (`/today` navigation exceeding 30s under concurrent Playwright load) -- see
 * `docs/domain/touchline-atlas-provenance.md` §14/§17 for the full account. Fixed by querying
 * only the bounded set of most-recently-kicked-off matches directly, using the existing
 * `[startsAt, createdAt]` index, instead of the whole season/round tree.
 *
 * `reportStatus` is always REPORTED or LOCKED here (the query only returns matches with one of
 * those report statuses), and `matchStatus` is always "SCHEDULED" (CANCELLED matches are
 * excluded) -- `deriveMatchLifecycleStatus()` short-circuits to "done"/"report_incomplete" purely
 * from those two facts before it would ever look at `isLive`/`hasPassed`/`roundStatus`/
 * `planningClosedAt`, so the placeholder values passed for those are never actually reached.
 */
export async function getRecentCompletedMatches(
  orgFilter: OrgFilterMode,
  orgUrl: (path: string) => string,
  limit = 5,
): Promise<MatchPresentation[]> {
  const organisationId = orgFilter.organisationId;
  const now = new Date();

  // Headroom beyond `limit`: not every recently-kicked-off match has a completed report yet
  // (e.g. still DRAFT/pending). 3x is a pragmatic bound, not a guarantee -- at youth-league match
  // frequency this comfortably covers the real gap between "kicked off" and "reported".
  const candidates = await db.match.findMany({
    where: { organisationId, status: { not: "CANCELLED" }, startsAt: { lte: now } },
    orderBy: { startsAt: "desc" },
    take: limit * 3,
    select: {
      id: true,
      opponent: true,
      homeAway: true,
      startsAt: true,
      team: { select: { name: true } },
    },
  });
  if (candidates.length === 0) return [];

  const reports = await db.postMatchReport.findMany({
    where: { matchId: { in: candidates.map((m) => m.id) }, organisationId, status: { in: ["REPORTED", "LOCKED"] } },
    select: { matchId: true, status: true, homeGoals: true, awayGoals: true },
  });
  const reportByMatchId = new Map(reports.map((r) => [r.matchId, r]));

  const completed = candidates.filter((m) => reportByMatchId.has(m.id)).slice(0, limit);

  return completed.map((match) => {
    const report = reportByMatchId.get(match.id)!;
    const isHome = match.homeAway === "HOME";
    const ownGoals = (isHome ? report.homeGoals : report.awayGoals) ?? null;
    const opponentGoals = (isHome ? report.awayGoals : report.homeGoals) ?? null;
    const outcome: "WON" | "DRAWN" | "LOST" | null =
      ownGoals === null || opponentGoals === null
        ? null
        : ownGoals > opponentGoals
          ? "WON"
          : ownGoals === opponentGoals
            ? "DRAWN"
            : "LOST";

    return buildMatchPresentation({
      id: match.id,
      href: orgUrl(`/matches/${match.id}`),
      teamName: match.team.name,
      opponentName: match.opponent,
      isHome,
      kickoffAt: match.startsAt.toISOString(),
      lifecycleStatus: deriveMatchLifecycleStatus({
        matchStatus: "SCHEDULED",
        reportStatus: report.status as "REPORTED" | "LOCKED",
        hasPassed: true,
        isLive: false,
        roundStatus: "",
        planningClosedAt: null,
        startsAt: match.startsAt,
      }),
      ownGoals,
      opponentGoals,
      outcome,
    });
  });
}
