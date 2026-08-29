export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { RoundListClient } from "@/app/(app)/rounds/round-list-client";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { buildRoundItems, resolveActiveLeagueSeason } from "./build-round-item";

export default async function RoundsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const orgWhere = ctx.orgFilter.filter;

  // League seasons are few and cheap to fetch in full -- resolveActiveLeagueSeason() picks the
  // one that should scope the Rounds list in plain JS (testable without a database), rather than
  // this page hand-rolling the "contains now, else most recent" selection inline.
  const leagueSeasons = await db.leagueSeason.findMany({
    where: orgWhere,
    select: { id: true, startDate: true, endDate: true },
  });
  const activeLeagueSeason = resolveActiveLeagueSeason(leagueSeasons, new Date());

  // Scoped to the active league season, not every round the organisation has ever had. This
  // page is the coach's active planning workflow (AGENTS.md: generate/review/finalize per
  // round), not a historical archive -- /history already serves that. Matches the same
  // per-league-season default already used by /players and /fixtures. Unbounded, this query and
  // the render/plan-integrity computation it feeds (buildRoundItems) grow without limit as
  // rounds accumulate over a season's real lifetime, and confirmed live in CI: with ~180
  // accumulated test rounds on one long-lived branch, this caused the page to intermittently
  // load slowly enough to fail E2E assertions that click into a round shortly after navigating
  // here (round-mutation.spec.ts, accessibility.spec.ts's "Round Board" check). Falls back to
  // unscoped when there's no resolvable season at all, so an org with zero seasons still shows
  // its empty state correctly rather than an empty round list for a wrong reason.
  const roundWhere = activeLeagueSeason ? { ...orgWhere, leagueSeasonId: activeLeagueSeason.id } : orgWhere;

  const matchRounds = await db.matchRound.findMany({
    where: roundWhere,
    include: {
      matches: {
        select: {
          id: true,
          opponent: true,
          startsAt: true,
          status: true,
          team: { select: { id: true, name: true } },
        },
        orderBy: [{ startsAt: "asc" }],
      },
      selections: {
        where: { status: "DRAFT" },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const allMatchIds = matchRounds.flatMap((round) => round.matches.map((m) => m.id));
  const reportStatusByMatchId = new Map(
    allMatchIds.length > 0
      ? (await db.postMatchReport.findMany({
          where: { matchId: { in: allMatchIds } },
          select: { matchId: true, status: true },
        })).map((r) => [r.matchId, r.status])
      : [],
  );

  const roundItems = await buildRoundItems(matchRounds, reportStatusByMatchId as Map<string, string>);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Rounds · {roundItems.length}</p>
      </div>

      <RoundListClient
        rounds={roundItems}
        activeLeagueSeasonId={activeLeagueSeason?.id ?? null}
        hasDraftRounds={roundItems.some((r) => r.derivedStatus === "DRAFT" || r.derivedStatus === "BLOCKED" || r.derivedStatus === "READY")}
        hasNotGeneratedRounds={roundItems.some((r) => r.derivedStatus === "NOT_GENERATED")}
        roundCount={roundItems.length}
      />
    </div>
  );
}