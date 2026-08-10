"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { requireActorContext } from "@/lib/auth/actor-context";
import { getTeamConfiguration, updateTeamConfiguration } from "@/domain/team-configuration/service";
import { recordDecision } from "@/domain/assistant-manager/service";

export async function fetchTeamConfiguration(teamId: string) {
  const ctx = await requireActorContext();
  return getTeamConfiguration(teamId, ctx.orgFilter);
}

export async function updateTeamConfigurationAction(
  teamId: string,
  input: {
    name?: string;
    active?: boolean;
    targetSquadSize?: number;
    minAcceptedSquadSize?: number;
    maxSquadSize?: number;
    minCorePlayers?: number;
    supportPriority?: number;
    minSupportPlayers?: number;
    developmentSlots?: number;
    footballGroupId?: string;
  },
) {
  const ctx = await requireActorContext();
  const before = await getTeamConfiguration(teamId, ctx.orgFilter);

  let result;
  try {
    result = await updateTeamConfiguration(teamId, input, ctx.orgFilter);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      Array.isArray(error.meta?.target) &&
      error.meta.target.includes("name")
    ) {
      throw new Error("A team with this name already exists in your organisation.");
    }
    throw error;
  }

  await recordDecision({
    decisionType: "TEAM_CONFIGURATION",
    entityType: "TEAM",
    entityId: teamId,
    action: "UPDATE_TEAM_CONFIGURATION",
    reason: input.name ? `Team renamed to "${input.name}"` : "Team configuration updated by coach",
    beforeSnapshot: before ?? undefined,
    afterSnapshot: result,
    organisationId: ctx.organisationId,
  });

  revalidatePath("/teams");
  revalidatePath("/players");
  revalidatePath("/fixtures");

  return result;
}