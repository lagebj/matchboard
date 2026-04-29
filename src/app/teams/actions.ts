'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { buildPathWithSearch } from "@/lib/build-path-with-search";

function readText(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function readNonNegativeInteger(formData: FormData, fieldName: string, label: string): number {
  const value = readText(formData, fieldName);
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`${label} must be a whole number of 0 or more.`);
  }

  return parsedValue;
}

async function readRelatedTeamIds(
  formData: FormData,
  fieldName: string,
  currentTeamId: string,
): Promise<string[]> {
  const teamIds = [...new Set(formData.getAll(fieldName))].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  if (teamIds.length === 0) {
    return [];
  }

  const teams = await db.team.findMany({
    where: {
      archivedAt: null,
      id: {
        in: teamIds,
      },
    },
    select: {
      id: true,
    },
  });

  const validTeamIds = teams
    .map((team) => team.id)
    .filter((teamId) => teamId !== currentTeamId);

  if (validTeamIds.length !== teamIds.filter((teamId) => teamId !== currentTeamId).length) {
    throw new Error("Team relationships must reference active teams other than the current team.");
  }

  return validTeamIds;
}

function getTeamErrorMessage(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "A team with this name already exists.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Could not save the team.";
}

export async function createTeamAction(formData: FormData) {
  try {
    const name = readText(formData, "name");
    const minSupportPlayers = readNonNegativeInteger(
      formData,
      "minSupportPlayers",
      "Minimum support players",
    );
    const developmentSlots = readNonNegativeInteger(
      formData,
      "developmentSlots",
      "Development slots",
    );

    if (!name) {
      throw new Error("Team name is required.");
    }

    const existingTeam = await db.team.findUnique({
      where: {
        name,
      },
      select: {
        archivedAt: true,
        id: true,
      },
    });

    if (existingTeam?.archivedAt) {
      await db.team.update({
        where: {
          id: existingTeam.id,
        },
        data: {
          archivedAt: null,
          developmentSlots,
          minSupportPlayers,
        },
      });
    } else {
      await db.team.create({
        data: {
          developmentSlots,
          name,
          minSupportPlayers,
        },
      });
    }
  } catch (error) {
    redirect(
      buildPathWithSearch("/teams", {
        error: getTeamErrorMessage(error),
      }),
    );
  }

  revalidatePath("/teams");
  revalidatePath("/players");
  revalidatePath("/matches");
  redirect(
    buildPathWithSearch("/teams", {
      saved: "created",
    }),
  );
}

export async function updateTeamConfigurationAction(teamId: string, formData: FormData) {
  try {
    const team = await db.team.findFirst({
      where: {
        id: teamId,
        archivedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!team) {
      throw new Error("Team not found.");
    }

    const minSupportPlayers = readNonNegativeInteger(
      formData,
      "minSupportPlayers",
      "Minimum support players",
    );
    const developmentSlots = readNonNegativeInteger(
      formData,
      "developmentSlots",
      "Development slots",
    );
    const targetSquadSize = readNonNegativeInteger(
      formData,
      "targetSquadSize",
      "Target squad size",
    );
    const minAcceptedSquadSize = readNonNegativeInteger(
      formData,
      "minAcceptedSquadSize",
      "Minimum accepted squad size",
    );
    const maxSquadSize = readNonNegativeInteger(
      formData,
      "maxSquadSize",
      "Maximum squad size",
    );
    const minCorePlayers = readNonNegativeInteger(
      formData,
      "minCorePlayers",
      "Minimum core players",
    );
    const minSupportCount = readNonNegativeInteger(
      formData,
      "minSupportCount",
      "Minimum support count",
    );
    const targetSupportCount = readNonNegativeInteger(
      formData,
      "targetSupportCount",
      "Target support count",
    );
    const maxSupportCount = readNonNegativeInteger(
      formData,
      "maxSupportCount",
      "Maximum support count",
    );
    const supportPriority = readNonNegativeInteger(
      formData,
      "supportPriority",
      "Support priority",
    );
    const supportSourceTeamIds = await readRelatedTeamIds(formData, "supportSourceTeamIds", team.id);
    const developmentSourceTeamIds = await readRelatedTeamIds(
      formData,
      "developmentSourceTeamIds",
      team.id,
    );

    await db.$transaction(async (transaction) => {
      await transaction.team.update({
        where: {
          id: team.id,
        },
        data: {
          developmentSlots,
          maxSquadSize,
          maxSupportCount,
          minAcceptedSquadSize,
          minCorePlayers,
          minSupportCount,
          minSupportPlayers,
          supportPriority,
          targetSquadSize,
          targetSupportCount,
        },
      });

      await transaction.teamSupportSource.deleteMany({
        where: {
          targetTeamId: team.id,
        },
      });

      if (supportSourceTeamIds.length > 0) {
        await transaction.teamSupportSource.createMany({
          data: supportSourceTeamIds.map((sourceTeamId) => ({
            sourceTeamId,
            targetTeamId: team.id,
          })),
        });
      }

      await transaction.teamDevelopmentSource.deleteMany({
        where: {
          targetTeamId: team.id,
        },
      });

      if (developmentSourceTeamIds.length > 0) {
        await transaction.teamDevelopmentSource.createMany({
          data: developmentSourceTeamIds.map((sourceTeamId) => ({
            sourceTeamId,
            targetTeamId: team.id,
          })),
        });
      }
    });
  } catch (error) {
    redirect(
      buildPathWithSearch("/teams", {
        error: getTeamErrorMessage(error),
      }),
    );
  }

  revalidatePath("/teams");
  revalidatePath("/players");
  revalidatePath("/matches");
  redirect(
    buildPathWithSearch("/teams", {
      saved: "support-updated",
    }),
  );
}

export async function deleteTeamAction(teamId: string) {
  try {
    const [
      team,
      activeCorePlayerCount,
      supportRelationshipCount,
      developmentRelationshipCount,
      matchCount,
    ] = await Promise.all([
      db.team.findUnique({
        where: {
          id: teamId,
        },
        select: {
          id: true,
        },
      }),
      db.player.count({
        where: {
          coreTeamId: teamId,
          removedAt: null,
        },
      }),
      db.teamSupportSource.count({
        where: {
          OR: [
            {
              targetTeamId: teamId,
            },
            {
              sourceTeamId: teamId,
            },
          ],
        },
      }),
      db.teamDevelopmentSource.count({
        where: {
          OR: [
            {
              targetTeamId: teamId,
            },
            {
              sourceTeamId: teamId,
            },
          ],
        },
      }),
      db.match.count({
        where: {
          teamId: teamId,
        },
      }),
    ]);

    if (!team) {
      throw new Error("Team not found.");
    }

    if (
      activeCorePlayerCount > 0 ||
      supportRelationshipCount > 0 ||
      developmentRelationshipCount > 0 ||
      matchCount > 0
    ) {
      throw new Error(
        "This team is still referenced by active players, support or development relationships, or matches. Remove those references first.",
      );
    }

    await db.team.update({
      where: {
        id: team.id,
      },
      data: {
        archivedAt: new Date(),
      },
    });
  } catch (error) {
    redirect(
      buildPathWithSearch("/teams", {
        error: getTeamErrorMessage(error),
      }),
    );
  }

  revalidatePath("/teams");
  revalidatePath("/players");
  revalidatePath("/matches");
  revalidatePath("/");
  redirect(
    buildPathWithSearch("/teams", {
      saved: "deleted",
    }),
  );
}
