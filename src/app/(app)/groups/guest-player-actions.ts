'use server'

import { revalidatePath } from "next/cache";
import { requirePageActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { resolveGroupContext, requireGroupMutationRole } from "@/lib/auth/group-context";
import {
  createGuestPlayer,
  updateGuestPlayer,
  setGuestPlayerActive,
  getGroupGuestPlayers,
  type UpdateGuestPlayerInput,
} from "@/lib/guest-players/guest-player";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

// ADR-0106: Guest player pool CRUD, scoped to one Group. Mirrors the movement-candidate-actions.ts
// pattern for auth (org mutation role + group mutation role) and the groups/actions.ts pattern
// for group-context resolution (a group slug or id is accepted, matching resolveGroupContext()).

function orgFilterFrom(organisationId: string): OrgFilterMode {
  return {
    type: "org" as const,
    filter: { organisationId },
    filterNullable: { organisationId },
    organisationId,
  };
}

async function requireGuestPlayerOrgAccess(
  guestPlayerId: string,
  organisationId: string,
): Promise<string> {
  const guestPlayer = await db.guestPlayer.findFirst({
    where: { id: guestPlayerId, organisationId },
    select: { footballGroupId: true },
  });
  if (!guestPlayer) {
    throw new Error("Guest player not found or access denied.");
  }
  return guestPlayer.footballGroupId;
}

export async function createGuestPlayerAction(groupSlugOrId: string, formData: FormData) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const groupCtx = await resolveGroupContext(ctx.organisationId, groupSlugOrId, ctx.membershipId, ctx.role);
  requireGroupMutationRole(groupCtx);

  const name = (formData.get("name") as string)?.trim() ?? "";
  const sourceLabel = (formData.get("sourceLabel") as string)?.trim() || null;
  const note = (formData.get("note") as string)?.trim() || null;

  const result = await createGuestPlayer({
    organisationId: ctx.organisationId,
    footballGroupId: groupCtx.footballGroupId,
    name,
    sourceLabel,
    note,
  });

  if (!result.success) {
    return { success: false as const, error: result.error };
  }

  revalidatePath(`/o/${ctx.organisationSlug}/groups/${groupSlugOrId}`);
  return { success: true as const, guestPlayer: result.guestPlayer };
}

export async function updateGuestPlayerAction(guestPlayerId: string, formData: FormData) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const footballGroupId = await requireGuestPlayerOrgAccess(guestPlayerId, ctx.organisationId);
  const groupCtx = await resolveGroupContext(ctx.organisationId, footballGroupId, ctx.membershipId, ctx.role);
  requireGroupMutationRole(groupCtx);

  const input: UpdateGuestPlayerInput = {};
  if (formData.has("name")) input.name = (formData.get("name") as string)?.trim() ?? "";
  if (formData.has("sourceLabel")) input.sourceLabel = (formData.get("sourceLabel") as string)?.trim() || null;
  if (formData.has("note")) input.note = (formData.get("note") as string)?.trim() || null;

  const result = await updateGuestPlayer(guestPlayerId, input, orgFilterFrom(ctx.organisationId));

  if (!result.success) {
    return { success: false as const, error: result.error };
  }

  revalidatePath(`/o/${ctx.organisationSlug}/groups/${footballGroupId}`);
  return { success: true as const, guestPlayer: result.guestPlayer };
}

export async function setGuestPlayerActiveAction(guestPlayerId: string, active: boolean) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const footballGroupId = await requireGuestPlayerOrgAccess(guestPlayerId, ctx.organisationId);
  const groupCtx = await resolveGroupContext(ctx.organisationId, footballGroupId, ctx.membershipId, ctx.role);
  requireGroupMutationRole(groupCtx);

  const result = await setGuestPlayerActive(guestPlayerId, active, orgFilterFrom(ctx.organisationId));

  if (!result.success) {
    return { success: false as const, error: result.error };
  }

  revalidatePath(`/o/${ctx.organisationSlug}/groups/${footballGroupId}`);
  return { success: true as const, guestPlayer: result.guestPlayer };
}

export async function getGroupGuestPlayersAction(groupSlugOrId: string, includeInactive = false) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const groupCtx = await resolveGroupContext(ctx.organisationId, groupSlugOrId, ctx.membershipId, ctx.role);

  return getGroupGuestPlayers(groupCtx.footballGroupId, orgFilterFrom(ctx.organisationId), { includeInactive });
}
