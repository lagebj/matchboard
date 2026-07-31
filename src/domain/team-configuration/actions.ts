"use server";

import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import { getTeamConfiguration, updateTeamConfiguration } from "@/domain/team-configuration/service";
import { recordDecision } from "@/domain/assistant-manager/service";

export async function fetchTeamConfiguration(teamId: string) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");
  return getTeamConfiguration(teamId, orgFilter);
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
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");
  const before = await getTeamConfiguration(teamId, orgFilter);
  const result = await updateTeamConfiguration(teamId, input, orgFilter);

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