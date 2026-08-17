'use server';

import { revalidatePath } from 'next/cache';
import {
  getBestLineup,
  autoSelectBestLineup,
  setBestLineupFormation,
  assignPlayerToBestLineupSlot,
  clearBestLineupSlot,
  clearBestLineup,
  deleteBestLineup,
  copyBestLineupToMatch,
  getFormationsForTeam,
} from '@/lib/best-lineup/best-lineup';
import { requireActorContext, requireMutationRole } from '@/lib/auth/actor-context';

export async function getBestLineupAction(teamId: string) {
  const ctx = await requireActorContext();
  return getBestLineup(teamId, ctx.orgFilter);
}

export async function autoSelectBestLineupAction(teamId: string, formationId?: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const result = await autoSelectBestLineup(teamId, ctx.orgFilter, formationId);
  revalidatePath(`/o/${ctx.organisationSlug}/teams/${teamId}`);
  return result;
}

export async function setBestLineupFormationAction(teamId: string, formationId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const result = await setBestLineupFormation(teamId, formationId, ctx.orgFilter);
  revalidatePath(`/o/${ctx.organisationSlug}/teams/${teamId}`);
  return result;
}

export async function assignPlayerToBestLineupSlotAction(
  lineupId: string,
  slotId: string,
  playerId: string | null,
  locked?: boolean,
) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  await assignPlayerToBestLineupSlot(lineupId, slotId, playerId, ctx.orgFilter, locked);
  revalidatePath(`/o/${ctx.organisationSlug}/teams`);
}

export async function clearBestLineupSlotAction(lineupId: string, slotId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  await clearBestLineupSlot(lineupId, slotId);
  revalidatePath(`/o/${ctx.organisationSlug}/teams`);
}

export async function clearBestLineupAction(teamId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  await clearBestLineup(teamId, ctx.orgFilter);
  revalidatePath(`/o/${ctx.organisationSlug}/teams/${teamId}`);
}

export async function deleteBestLineupAction(teamId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  await deleteBestLineup(teamId, ctx.orgFilter);
  revalidatePath(`/o/${ctx.organisationSlug}/teams/${teamId}`);
}

export async function copyBestLineupToMatchAction(teamId: string, matchId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const result = await copyBestLineupToMatch(teamId, matchId, ctx.orgFilter);
  revalidatePath(`/o/${ctx.organisationSlug}/matches/${matchId}`);
  return result;
}

export async function getFormationsForTeamAction(teamId: string) {
  const ctx = await requireActorContext();
  return getFormationsForTeam(teamId, ctx.orgFilter);
}