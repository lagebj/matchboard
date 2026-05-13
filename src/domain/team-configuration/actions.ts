"use server";

import { requireCoachAccess } from "@/lib/auth";
import { getTeamConfiguration, updateTeamConfiguration } from "@/domain/team-configuration/service";
import { recordDecision } from "@/domain/assistant-manager/service";

export async function fetchTeamConfiguration(teamId: string) {
  await requireCoachAccess();
  return getTeamConfiguration(teamId);
}

export async function updateTeamConfigurationAction(
  teamId: string,
  input: {
    name?: string;
    active?: boolean;
    targetSquadSize?: number;
    maxSquadSize?: number;
    supportPriority?: number;
  },
) {
  await requireCoachAccess();
  const before = await getTeamConfiguration(teamId);
  const result = await updateTeamConfiguration(teamId, input);

  await recordDecision({
    decisionType: "TEAM_CONFIGURATION",
    entityType: "TEAM",
    entityId: teamId,
    action: "UPDATE_TEAM_CONFIGURATION",
    reason: "Team configuration updated by coach",
    beforeSnapshot: before ?? undefined,
    afterSnapshot: result,
  });

  return result;
}