"use server";

import { requirePageActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import {
  createTeamFocus,
  updateTeamFocus,
  completeTeamFocus,
  closeTeamFocus,
  reopenTeamFocus,
  getTeamFocusesForTeam,
  getActiveTeamFocusesForTeam,
  getTeamFocus,
  type CreateTeamFocusInput,
  type UpdateTeamFocusInput,
  type TeamFocusStatus,
} from "@/lib/coaching/team-focus";
import { logSecurityEvent } from "@/lib/security/audit-log";

function audit(action: string, ctx: { userId: string; organisationId: string }, resourceId: string) {
  logSecurityEvent({
    category: "mutation",
    action: action as Parameters<typeof logSecurityEvent>[0]["action"],
    actor: ctx.userId,
    tenant: ctx.organisationId,
    resource: "team_focus",
    resourceId,
    result: "success",
  });
}

export async function createTeamFocusAction(input: CreateTeamFocusInput) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const focus = await createTeamFocus(input, ctx.orgFilter);
  audit("create_team_focus", ctx, focus.id);
  return { success: true as const, focus };
}

export async function updateTeamFocusAction(focusId: string, input: UpdateTeamFocusInput) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const focus = await updateTeamFocus(focusId, input, ctx.orgFilter);
  audit("update_team_focus", ctx, focusId);
  return { success: true as const, focus };
}

export async function completeTeamFocusAction(focusId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const focus = await completeTeamFocus(focusId, ctx.orgFilter);
  audit("complete_team_focus", ctx, focusId);
  return { success: true as const, focus };
}

export async function closeTeamFocusAction(focusId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const focus = await closeTeamFocus(focusId, ctx.orgFilter);
  audit("close_team_focus", ctx, focusId);
  return { success: true as const, focus };
}

export async function reopenTeamFocusAction(focusId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const focus = await reopenTeamFocus(focusId, ctx.orgFilter);
  audit("reopen_team_focus", ctx, focusId);
  return { success: true as const, focus };
}

export async function getTeamFocusesForTeamAction(teamId: string, status?: TeamFocusStatus) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const focuses = await getTeamFocusesForTeam(teamId, ctx.orgFilter, status);
  return { success: true as const, focuses };
}

export async function getActiveTeamFocusesForTeamAction(teamId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const focuses = await getActiveTeamFocusesForTeam(teamId, ctx.orgFilter);
  return { success: true as const, focuses };
}

export async function getTeamFocusAction(focusId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const focus = await getTeamFocus(focusId, ctx.orgFilter);
  return { success: true as const, focus };
}