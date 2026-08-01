import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import { LiveMatchClient } from "./live-client";

export const dynamic = "force-dynamic";

interface LiveMatchPageProps {
  params: Promise<{ matchId: string }>;
}

export default async function LiveMatchPage({ params }: LiveMatchPageProps) {
  const { matchId } = await params;
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");
  const orgWhere = orgFilter.type === "org" ? orgFilter.filter : {};

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
    <LiveMatchClient
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
      coachId={coach.id ?? ""}
    />
  );
}