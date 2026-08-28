export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { RoundListClient } from "@/app/(app)/rounds/round-list-client";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { buildRoundItems } from "./build-round-item";

export default async function RoundsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const orgWhere = ctx.orgFilter.filter;

  const activeLeagueSeason = await db.leagueSeason.findFirst({
    where: orgWhere,
    orderBy: { startDate: "desc" },
  });

  const matchRounds = await db.matchRound.findMany({
    where: orgWhere,
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