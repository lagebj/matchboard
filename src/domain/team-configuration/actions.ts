"use server";

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
  const result = await updateTeamConfiguration(teamId, input, ctx.orgFilter);

  await recordDecision({
    decisionType: "TEAM_CONFIGURATION",
    entityType: "TEAM",
    entityId: teamId,
    action: "UPDATE_TEAM_CONFIGURATION",
    reason: "Team configuration updated by coach",
    beforeSnapshot: before ?? undefined,
    afterSnapshot: result,
    organisationId: ctx.organisationId,
  });

  return result;
}