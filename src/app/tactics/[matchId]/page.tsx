import { notFound } from "next/navigation";
import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/date-utils";
import { formatGameFormat, getDefaultFormation, getFormationsForFormat } from "@/lib/formations";
import { TacticsBoardClient } from "@/components/tactics-board-client";

type TacticsMatchPageProps = {
  params: Promise<{ matchId: string }>;
};

export default async function TacticsMatchPage({ params }: TacticsMatchPageProps) {
  const { matchId } = await params;

  const match = await db.match.findFirst({
    where: { id: matchId },
    include: { team: { select: { id: true, name: true } } },
  });

  if (!match) {
    notFound();
  }

  const gameFormat = match.gameFormat ?? "ELEVEN_A_SIDE";
  const formations = getFormationsForFormat(gameFormat);
  const defaultFormation = getDefaultFormation(gameFormat);

  const selections = await db.selection.findMany({
    where: { matchId, status: { in: [SelectionStatus.DRAFT, SelectionStatus.FINALIZED] } },
    include: {
      player: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          primaryPosition: true,
          secondaryPosition: true,
          tertiaryPosition: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const latestByPlayer = new Map<string, (typeof selections)[number]>();
  for (const s of selections) {
    if (!latestByPlayer.has(s.player.id)) {
      latestByPlayer.set(s.player.id, s);
    }
  }

  const selectedPlayers = [...latestByPlayer.values()].map((s) => ({
    id: s.player.id,
    firstName: s.player.firstName,
    lastName: s.player.lastName,
    role: s.role,
    primaryPosition: s.player.primaryPosition,
    secondaryPosition: s.player.secondaryPosition,
    tertiaryPosition: s.player.tertiaryPosition,
  }));

  return (
    <TacticsBoardClient
      matchId={matchId}
      match={{
        id: match.id,
        opponent: match.opponent,
        startsAt: match.startsAt.toISOString(),
        homeAway: match.homeAway,
        gameFormat,
        teamId: match.teamId,
        teamName: match.team.name,
        formation: match.formation,
      }}
      formations={formations}
      defaultFormationId={defaultFormation.id}
      initialSelectedPlayers={selectedPlayers}
    />
  );
}