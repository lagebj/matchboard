"use server";

import { revalidatePath } from "next/cache";
import { requirePageActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import {
  registerGuestPlayerForRound,
  unregisterGuestPlayerFromRound,
  getRoundGuestParticipants,
  getAvailableGuestPlayersForRound,
} from "@/lib/matches/league-round-guest-participant";

// ADR-0106: LeagueRoundParticipant write path for GuestPlayers -- registers a GuestPlayer as a
// participant of a League Round, a prerequisite for assigning them to any Match within it. Follows
// the same org-scoping-only auth pattern as the existing rounds/actions.ts (no additional
// per-Group mutation check beyond org role, matching that file's established convention).

export async function registerGuestPlayerForRoundAction(matchRoundId: string, guestPlayerId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const result = await registerGuestPlayerForRound(matchRoundId, guestPlayerId, ctx.orgFilter);
  if (!result.success) return result;

  revalidatePath(`/rounds/${matchRoundId}`);
  return result;
}

export async function unregisterGuestPlayerFromRoundAction(matchRoundId: string, guestPlayerId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const result = await unregisterGuestPlayerFromRound(matchRoundId, guestPlayerId, ctx.orgFilter);
  if (!result.success) return result;

  revalidatePath(`/rounds/${matchRoundId}`);
  return result;
}

export async function getRoundGuestParticipantsAction(matchRoundId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  return getRoundGuestParticipants(matchRoundId, ctx.orgFilter);
}

export async function getAvailableGuestPlayersForRoundAction(matchRoundId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  return getAvailableGuestPlayersForRound(matchRoundId, ctx.orgFilter);
}
