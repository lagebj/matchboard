import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { LeagueLiveMatchClient } from "@/components/live-match/league-live-match-client";

export const dynamic = "force-dynamic";

interface LiveMatchPageProps {
  params: Promise<{ orgSlug: string; matchId: string }>;
}

export default async function LiveMatchPage({ params }: LiveMatchPageProps) {
  const { orgSlug, matchId } = await params;
  const ctx = await requireActorContext(orgSlug);
  const orgWhere = ctx.orgFilter.type === "org" ? ctx.orgFilter.filter : {};

  const match = await db.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      opponent: true,
      homeAway: true,
      gameFormat: true,
      startsAt: true,
      status: true,
      teamId: true,
      team: { select: { id: true, name: true } },
      matchRound: { select: { id: true, name: true } },
    },
  });

  if (!match) {
    return <div className="p-6 text-center text-zinc-400">Match not found.</div>;
  }

  return (
    <LeagueLiveMatchClient
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
      }}
      coachId={ctx.userId}
    />
  );
}