import { db } from "@/lib/db";
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

export type FinalizeValidationResult = {
  canFinalize: boolean;
  errors: string[];
  warnings: string[];
};

export async function validateLeagueSeasonFinalization(
  leagueSeasonId: string,
): Promise<FinalizeValidationResult> {
  const leagueSeason = await db.leagueSeason.findFirst({
    where: { id: leagueSeasonId },
    include: {
      matchRounds: {
        select: { id: true, status: true },
      },
    },
  });

  if (!leagueSeason) {
    return { canFinalize: false, errors: ["League season not found."], warnings: [] };
  }

  if (leagueSeason.status === "FINALIZED") {
    return { canFinalize: false, errors: ["League season is already finalised."], warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  if (leagueSeason.matchRounds.length === 0) {
    warnings.push("League season has no rounds.");
  }

  const nonFinalizedRounds = leagueSeason.matchRounds.filter(
    (r) => r.status !== "FINALIZED",
  );
  if (nonFinalizedRounds.length > 0) {
    errors.push(
      `${nonFinalizedRounds.length} round(s) are not finalised. All rounds must be finalised before the league season can be finalised.`,
    );
  }

  if (leagueSeason.matchRounds.length > 0) {
    const roundsWithMatches = await db.matchRound.findMany({
      where: { leagueSeasonId },
      include: {
        matches: {
          select: { id: true, status: true },
        },
      },
    });

    const allMatchIds = roundsWithMatches.flatMap((r) =>
      r.matches.filter((m) => m.status !== "CANCELLED").map((m) => m.id),
    );

    if (allMatchIds.length > 0) {
      const completedReports = await db.postMatchReport.findMany({
        where: {
          matchId: { in: allMatchIds },
          status: { in: ["REPORTED", "LOCKED"] },
        },
        select: { matchId: true },
      });

      const matchesWithCompletedReports = new Set(completedReports.map((r) => r.matchId));
      const matchesWithoutCompletedReports = allMatchIds.filter(
        (id) => !matchesWithCompletedReports.has(id),
      );

      if (matchesWithoutCompletedReports.length > 0) {
        warnings.push(
          `${matchesWithoutCompletedReports.length} match(es) do not have completed post-match reports.`,
        );
      }
    }
  }

  return {
    canFinalize: errors.length === 0,
    errors,
    warnings,
  };
}

export async function finalizeLeagueSeason(
  leagueSeasonId: string,
  finalisedBy: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  const leagueSeason = await db.leagueSeason.findFirst({
    where: { id: leagueSeasonId },
  });

  if (!leagueSeason) {
    return { success: false, error: "League season not found." };
  }

  if (leagueSeason.status === "FINALIZED") {
    return { success: false, error: "League season is already finalised." };
  }

  const orgFilter = { organisationId: leagueSeason.organisationId };

  const teamsWithPlayers = await db.team.findMany({
    where: { archivedAt: null, ...orgFilter },
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
    const existingSnapshot = await tx.seasonPeriodSnapshot.findFirst({
      where: { leagueSeasonId },
    });

    if (existingSnapshot) {
      await tx.teamSeasonSnapshotPlayer.deleteMany({
        where: { teamSeasonSnapshot: { seasonPeriodSnapshot: { leagueSeasonId } } },
      });
      await tx.teamSeasonSnapshot.deleteMany({
        where: { seasonPeriodSnapshot: { leagueSeasonId } },
      });
      await tx.seasonPeriodSnapshot.delete({
        where: { leagueSeasonId },
      });
    }

    await tx.leagueSeason.update({
      where: { id: leagueSeasonId },
      data: {
        status: "FINALIZED",
        finalizedAt: now,
        finalizedBy: finalisedBy,
      },
    });

    await tx.seasonPeriodSnapshot.create({
      data: {
        organisationId: leagueSeason.organisationId,
        leagueSeasonId,
        finalizedAt: now,
        finalizedBy: finalisedBy,
        teamSnapshots: {
          create: teamsWithPlayers.map((team) => ({
            organisationId: leagueSeason.organisationId,
            teamId: team.id,
            teamNameSnapshot: team.name,
            playerSnapshots: {
              create: team.corePlayers.map((player) => ({
                organisationId: leagueSeason.organisationId,
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
  });

  revalidatePath("/season");
  revalidatePath("/fixtures");

  return { success: true };
}

export async function unfinalizeLeagueSeason(
  leagueSeasonId: string,
): Promise<{ success: boolean; error?: string }> {
  const leagueSeason = await db.leagueSeason.findFirst({
    where: { id: leagueSeasonId },
  });

  if (!leagueSeason) {
    return { success: false, error: "League season not found." };
  }

  if (leagueSeason.status !== "FINALIZED") {
    return { success: false, error: "League season is not finalised." };
  }

  await db.$transaction(async (tx) => {
    await tx.leagueSeason.update({
      where: { id: leagueSeasonId },
      data: {
        status: "OPEN",
        finalizedAt: null,
        finalizedBy: null,
      },
    });

    const existingSnapshot = await tx.seasonPeriodSnapshot.findFirst({
      where: { leagueSeasonId },
    });

    if (existingSnapshot) {
      await tx.teamSeasonSnapshotPlayer.deleteMany({
        where: { teamSeasonSnapshot: { seasonPeriodSnapshotId: existingSnapshot.id } },
      });
      await tx.teamSeasonSnapshot.deleteMany({
        where: { seasonPeriodSnapshotId: existingSnapshot.id },
      });
      await tx.seasonPeriodSnapshot.delete({
        where: { id: existingSnapshot.id },
      });
    }
  });

  revalidatePath("/season");
  revalidatePath("/fixtures");

  return { success: true };
}

export async function getLeagueSeasonSnapshot(leagueSeasonId: string): Promise<LeagueSeasonSnapshot | null> {
  const snapshot = await db.seasonPeriodSnapshot.findFirst({
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

export async function getLeagueSeasonFinalizationStatus(leagueSeasonId: string): Promise<{
  status: string;
  finalizedAt: Date | null;
  finalizedBy: string | null;
  snapshotExists: boolean;
}> {
  const leagueSeason = await db.leagueSeason.findFirst({
    where: { id: leagueSeasonId },
    select: { status: true, finalizedAt: true, finalizedBy: true },
  });

  if (!leagueSeason) {
    return { status: "NOT_FOUND", finalizedAt: null, finalizedBy: null, snapshotExists: false };
  }

  const snapshot = await db.seasonPeriodSnapshot.findFirst({
    where: { leagueSeasonId },
    select: { id: true },
  });

  return {
    status: leagueSeason.status,
    finalizedAt: leagueSeason.finalizedAt,
    finalizedBy: leagueSeason.finalizedBy,
    snapshotExists: snapshot !== null,
  };
}