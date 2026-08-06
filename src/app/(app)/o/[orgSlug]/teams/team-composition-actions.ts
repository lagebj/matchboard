"use server";

import { generateLeagueTeamPreview, applyLeagueTeamProposal } from "@/domain/team-composition/league-team-adapter";
import type { SystemTeamScenario } from "@/domain/team-composition/team-composition-types";
import type { GameFormat } from "@/domain/team-composition/structural-requirements";
import { getFormationsForFormat } from "@/app/(app)/rules/formation-actions";
import { revalidatePath } from "next/cache";

export type FormationOption = {
  id: string;
  name: string;
  source: string;
  gameFormat: string;
};

export async function getCompositionFormationOptionsAction(gameFormat: GameFormat): Promise<FormationOption[]> {
  const formations = await getFormationsForFormat(gameFormat);
  return formations.map((f) => ({
    id: f.id,
    name: f.name,
    source: f.source,
    gameFormat: f.gameFormat,
  }));
}

export async function generateLeagueTeamPreviewAction(input: {
  footballGroupId: string;
  leagueSeasonId: string;
  scenario: SystemTeamScenario;
  gameFormat: GameFormat;
  formationId?: string;
  deterministicSeed?: string;
  coachAcknowledgedPolicyGate?: boolean;
}) {
  const seed = input.deterministicSeed || `seed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const proposal = await generateLeagueTeamPreview({
    footballGroupId: input.footballGroupId,
    leagueSeasonId: input.leagueSeasonId,
    scenario: input.scenario,
    gameFormat: input.gameFormat,
    formationId: input.formationId,
    deterministicSeed: seed,
    coachAcknowledgedPolicyGate: input.coachAcknowledgedPolicyGate,
  });
  return proposal;
}

export async function applyLeagueTeamProposalAction(input: {
  footballGroupId: string;
  leagueSeasonId: string;
  scenario: SystemTeamScenario;
  gameFormat: GameFormat;
  formationId?: string;
  deterministicSeed: string;
  proposalIdempotencyKey: string;
}) {
  const result = await applyLeagueTeamProposal({
    footballGroupId: input.footballGroupId,
    leagueSeasonId: input.leagueSeasonId,
    scenario: input.scenario,
    gameFormat: input.gameFormat,
    formationId: input.formationId,
    deterministicSeed: input.deterministicSeed,
    proposalIdempotencyKey: input.proposalIdempotencyKey,
  });

  revalidatePath("/teams");
  revalidatePath("/o/[orgSlug]/teams");
  revalidatePath("/players");
  revalidatePath("/o/[orgSlug]/players");

  return result;
}