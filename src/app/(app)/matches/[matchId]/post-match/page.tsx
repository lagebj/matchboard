import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PostMatchPage } from "@/components/assistant/post-match-page";
import { requireCoachAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ matchId: string }>;
};

export default async function PostMatchRoute({ params }: PageProps) {
  await requireCoachAccess();
  const { matchId } = await params;

  const match = await db.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      teamId: true,
      opponent: true,
      homeAway: true,
      team: { select: { id: true, name: true } },
      selections: {
        where: { status: "FINALIZED" },
        select: {
          playerId: true,
          role: true,
          player: {
            select: { id: true, firstName: true, lastName: true, coreTeam: { select: { name: true } } },
          },
        },
        orderBy: [{ role: "asc" }],
      },
    },
  });

  if (!match) notFound();

  const report = await db.postMatchReport.findUnique({
    where: { matchId },
    include: {
      playerActuals: {
        include: {
          player: {
            select: { id: true, firstName: true, lastName: true, coreTeam: { select: { name: true } } },
          },
        },
      },
      goals: {
        include: {
          player: {
            select: { firstName: true, lastName: true },
          },
        },
        orderBy: [{ minute: "asc" }],
      },
    },
  });

  const plannedSelections = match.selections.map((s) => ({
    playerId: s.playerId,
    playerName: `${s.player.firstName} ${s.player.lastName ?? ""}`.trim(),
    coreTeamName: s.player.coreTeam?.name ?? "Unassigned",
    role: s.role,
  }));

  const initialReport = report ? {
    id: report.id,
    matchId: report.matchId,
    status: report.status,
    homeGoals: report.homeGoals,
    awayGoals: report.awayGoals,
    teamNote: report.teamNote,
    completedBy: report.completedBy,
    completedAt: report.completedAt?.toISOString() ?? null,
    playerActuals: report.playerActuals.map((p) => ({
      id: p.id,
      playerId: p.playerId,
      playerName: `${p.player.firstName} ${p.player.lastName ?? ""}`.trim(),
      coreTeamName: p.player.coreTeam?.name ?? "Unassigned",
      source: p.source,
      attendanceStatus: p.attendanceStatus,
    })),
    goals: report.goals.map((g) => ({
      id: g.id,
      playerId: g.playerId,
      playerName: g.player ? `${g.player.firstName} ${g.player.lastName ?? ""}`.trim() : undefined,
      minute: g.minute,
      type: g.type,
    })),
    teamName: match.team.name,
    opponent: match.opponent,
    homeAway: match.homeAway,
    plannedSelections,
  } : null;

  return <PostMatchPage matchId={matchId} initialReport={initialReport} />;
}