import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type SnapshotTeam = {
  teamId: string;
  teamNameSnapshot: string;
  players: Array<{
    playerId: string;
    playerNameSnapshot: string;
    primaryPositionSnapshot: string | null;
    secondaryPositionSnapshot: string | null;
    tertiaryPositionSnapshot: string | null;
    shirtNumberSnapshot: number | null;
    activeAtSnapshot: boolean;
  }>;
};

export type LeagueSeasonSnapshot = {
  id: string;
  leagueSeasonId: string;
  finalizedAt: Date;
  finalizedBy: string | null;
  teams: SnapshotTeam[];
};

export async function finalizeLeagueSeason(leagueSeasonId: string): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  const leagueSeason = await db.leagueSeason.findUnique({
    where: { id: leagueSeasonId },
    include: {
      matchRounds: { select: { id: true } },
      periodSnapshot: true,
    },
  });

  if (!leagueSeason) {
    return { success: false, error: "League season not found." };
  }

  if (leagueSeason.status === "FINALIZED") {
    return { success: false, error: "League season is already finalized." };
  }

  if (leagueSeason.periodSnapshot) {
    return { success: false, error: "Snapshot already exists for this league season." };
  }

  const teamsWithPlayers = await db.team.findMany({
    where: { archivedAt: null },
    include: {
      corePlayers: {
        where: { removedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          primaryPosition: true,
          secondaryPosition: true,
          tertiaryPosition: true,
          shirtNumber: true,
          active: true,
        },
        orderBy: [{ playerCode: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    await tx.leagueSeason.update({
      where: { id: leagueSeasonId },
      data: {
        status: "FINALIZED",
        finalizedAt: now,
      },
    });

    const snapshot = await tx.seasonPeriodSnapshot.create({
      data: {
        leagueSeasonId,
        finalizedAt: now,
        teamSnapshots: {
          create: teamsWithPlayers.map((team) => ({
            teamId: team.id,
            teamNameSnapshot: team.name,
            playerSnapshots: {
              create: team.corePlayers.map((player) => ({
                playerId: player.id,
                playerNameSnapshot: [player.firstName, player.lastName].filter(Boolean).join(" "),
                primaryPositionSnapshot: player.primaryPosition,
                secondaryPositionSnapshot: player.secondaryPosition,
                tertiaryPositionSnapshot: player.tertiaryPosition,
                shirtNumberSnapshot: player.shirtNumber,
                activeAtSnapshot: player.active,
              })),
            },
          })),
        },
      },
      include: {
        teamSnapshots: {
          include: { playerSnapshots: true },
        },
      },
    });

    return snapshot;
  });

  revalidatePath("/season");
  revalidatePath("/fixtures");

  return { success: true };
}

export async function unfinalizeLeagueSeason(leagueSeasonId: string): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  const leagueSeason = await db.leagueSeason.findUnique({
    where: { id: leagueSeasonId },
    include: { periodSnapshot: true },
  });

  if (!leagueSeason) {
    return { success: false, error: "League season not found." };
  }

  if (leagueSeason.status !== "FINALIZED") {
    return { success: false, error: "League season is not finalized." };
  }

  await db.leagueSeason.update({
    where: { id: leagueSeasonId },
    data: {
      status: "OPEN",
      finalizedAt: null,
      finalizedBy: null,
    },
  });

  revalidatePath("/season");
  revalidatePath("/fixtures");

  return { success: true };
}

export async function getLeagueSeasonSnapshot(leagueSeasonId: string): Promise<LeagueSeasonSnapshot | null> {
  const snapshot = await db.seasonPeriodSnapshot.findUnique({
    where: { leagueSeasonId },
    include: {
      teamSnapshots: {
        include: {
          playerSnapshots: {
            orderBy: { playerNameSnapshot: "asc" },
          },
        },
        orderBy: { teamNameSnapshot: "asc" },
      },
    },
  });

  if (!snapshot) return null;

  return {
    id: snapshot.id,
    leagueSeasonId: snapshot.leagueSeasonId,
    finalizedAt: snapshot.finalizedAt,
    finalizedBy: snapshot.finalizedBy,
    teams: snapshot.teamSnapshots.map((ts) => ({
      teamId: ts.teamId,
      teamNameSnapshot: ts.teamNameSnapshot,
      players: ts.playerSnapshots.map((ps) => ({
        playerId: ps.playerId,
        playerNameSnapshot: ps.playerNameSnapshot,
        primaryPositionSnapshot: ps.primaryPositionSnapshot,
        secondaryPositionSnapshot: ps.secondaryPositionSnapshot,
        tertiaryPositionSnapshot: ps.tertiaryPositionSnapshot,
        shirtNumberSnapshot: ps.shirtNumberSnapshot,
        activeAtSnapshot: ps.activeAtSnapshot,
      })),
    })),
  };
}