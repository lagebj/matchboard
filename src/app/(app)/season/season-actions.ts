"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";

export async function finalizeLeagueSeasonAction(leagueSeasonId: string): Promise<{ success: boolean; error?: string }> {
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

  await db.$transaction(async (tx) => {
    await tx.leagueSeason.update({
      where: { id: leagueSeasonId },
      data: {
        status: "FINALIZED",
        finalizedAt: now,
      },
    });

    await tx.seasonPeriodSnapshot.create({
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
    });
  });

  revalidatePath("/season");
  revalidatePath("/fixtures");

  return { success: true };
}

export async function unfinalizeLeagueSeasonAction(leagueSeasonId: string): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  const leagueSeason = await db.leagueSeason.findUnique({
    where: { id: leagueSeasonId },
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