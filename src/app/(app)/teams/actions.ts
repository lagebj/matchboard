'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireActorContext, requireMutationRole, requireTeamAccess } from "@/lib/auth/actor-context";
import { buildPathWithSearch } from "@/lib/build-path-with-search";
import { createOrRestoreTeam, archiveTeam } from "@/lib/teams/team-domain";

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
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const organisationId = ctx.organisationId;
  try {
    const name = readText(formData, "name");
    const targetSquadSize = readNonNegativeInteger(formData, "targetSquadSize", "Target squad size");
    const minAcceptedSquadSize = readNonNegativeInteger(formData, "minAcceptedSquadSize", "Minimum accepted squad size");
    const maxSquadSize = readNonNegativeInteger(formData, "maxSquadSize", "Maximum squad size");
    const minCorePlayers = readNonNegativeInteger(formData, "minCorePlayers", "Minimum core players");
    const minSupportPlayers = readNonNegativeInteger(formData, "minSupportPlayers", "Minimum support players");
    const developmentSlots = readNonNegativeInteger(formData, "developmentSlots", "Development slots");
    const supportPriority = readNonNegativeInteger(formData, "supportPriority", "Support priority rank");

    if (!name) {
      throw new Error("Team name is required.");
    }

    const result = await createOrRestoreTeam({
      name,
      targetSquadSize,
      minAcceptedSquadSize,
      maxSquadSize,
      minCorePlayers,
      minSupportPlayers,
      developmentSlots,
      supportPriority,
      organisationId,
    });

    if (!result.success) {
      throw new Error(result.error);
    }
  } catch (error) {
    redirect(
      buildPathWithSearch("/teams/new", {
        error: getTeamErrorMessage(error),
      }),
    );
  }

  revalidatePath("/teams");
  revalidatePath("/players");
  revalidatePath("/fixtures");
  redirect(
    buildPathWithSearch("/teams", {
      saved: "created",
    }),
  );
}

export async function updateTeamConfigurationAction(teamId: string, formData: FormData) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  requireTeamAccess(ctx, teamId);
  const organisationId = ctx.organisationId;
  try {
    const team = await db.team.findFirst({
      where: {
        id: teamId,
        archivedAt: null,
        ...(organisationId ? { organisationId } : {}),
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
      "Maximum Support count",
    );
     const supportPriority = readNonNegativeInteger(
      formData,
      "supportPriority",
      "Support priority rank",
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
  revalidatePath("/fixtures");
  redirect(
    buildPathWithSearch("/teams", {
      saved: "support-updated",
    }),
  );
}

export async function deleteTeamAction(teamId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  requireTeamAccess(ctx, teamId);
  const organisationId = ctx.organisationId;
  try {
    const result = await archiveTeam(teamId, organisationId);
    if (!result.success) {
      throw new Error(result.error);
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
  revalidatePath("/fixtures");
  revalidatePath("/");
  redirect(
    buildPathWithSearch("/teams", {
      saved: "deleted",
    }),
  );
}
