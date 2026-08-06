"use server";

import { generateLeagueTeamPreview, applyLeagueTeamProposal } from "@/domain/team-composition/league-team-adapter";
import type { SystemTeamScenario } from "@/domain/team-composition/team-composition-types";
import { revalidatePath } from "next/cache";

export async function generateLeagueTeamPreviewAction(input: {
  footballGroupId: string;
  leagueSeasonId: string;
  scenario: SystemTeamScenario;
  deterministicSeed?: string;
  coachAcknowledgedPolicyGate?: boolean;
}) {
  const seed = input.deterministicSeed || `seed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const proposal = await generateLeagueTeamPreview({
    footballGroupId: input.footballGroupId,
    leagueSeasonId: input.leagueSeasonId,
    scenario: input.scenario,
    deterministicSeed: seed,
    coachAcknowledgedPolicyGate: input.coachAcknowledgedPolicyGate,
  });
  return proposal;
}

export async function applyLeagueTeamProposalAction(input: {
  footballGroupId: string;
  leagueSeasonId: string;
  scenario: SystemTeamScenario;
  deterministicSeed: string;
  proposalIdempotencyKey: string;
}) {
  const result = await applyLeagueTeamProposal({
    footballGroupId: input.footballGroupId,
    leagueSeasonId: input.leagueSeasonId,
    scenario: input.scenario,
    deterministicSeed: input.deterministicSeed,
    proposalIdempotencyKey: input.proposalIdempotencyKey,
  });

  revalidatePath("/teams");
  revalidatePath("/o/[orgSlug]/teams");
  revalidatePath("/players");
  revalidatePath("/o/[orgSlug]/players");

  return result;
}