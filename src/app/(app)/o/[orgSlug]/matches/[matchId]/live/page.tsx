import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { LeagueLiveMatchWithRotation } from "@/components/live-match/league-live-match-with-rotation";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { getPlannedRotation } from "@/lib/planned-rotation/planned-rotation";

export const dynamic = "force-dynamic";

interface LiveMatchPageProps {
  params: Promise<{ orgSlug: string; matchId: string }>;
}

export default async function LiveMatchPage({ params }: LiveMatchPageProps) {
  const { orgSlug, matchId } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);

  const match = await db.match.findFirst({
    where: { id: matchId, ...ctx.orgFilter.filter },
    select: {
      id: true,
      opponent: true,
      homeAway: true,
      gameFormat: true,
      startsAt: true,
      status: true,
      matchType: true,
      teamId: true,
      team: { select: { id: true, name: true } },
      matchRound: { select: { id: true, name: true } },
    },
  });

  if (!match) {
    return <div className="p-6 text-center text-zinc-400">Match not found.</div>;
  }

  const plannedRotation = await getPlannedRotation(match.id, match.teamId, ctx.orgFilter);

  return (
    <LeagueLiveMatchWithRotation
      matchId={match.id}
      matchInfo={{
        id: match.id,
        opponent: match.opponent,
        homeAway: match.homeAway,
        gameFormat: match.gameFormat,
        startsAt: match.startsAt.toISOString(),
        status: match.status,
        teamName: match.team.name,
        teamId: match.teamId,
        roundName: match.matchRound?.name ?? null,
        matchType: match.matchType,
      }}
      plannedRotation={plannedRotation}
    />
  );
}