"use server";

import { requirePageActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import {
  createThread,
  updateThread,
  addObservation,
  updateObservation,
  removeObservation,
  getThread,
  getThreadsForPlayer,
  getActiveThreadsForPlayer,
  completeThread,
  closeThread,
  reopenThread,
  type CreateThreadInput,
  type UpdateThreadInput,
  type AddObservationInput,
  type UpdateObservationInput,
} from "@/lib/planned-rotation/development-thread";
import { logSecurityEvent } from "@/lib/security/audit-log";

function audit(action: SecurityEventAction, ctx: { userId: string; organisationId: string }, resource: string, resourceId: string, metadata?: Record<string, unknown>) {
  logSecurityEvent({
    category: "mutation",
    action,
    actor: ctx.userId,
    tenant: ctx.organisationId,
    resource,
    resourceId,
    result: "success",
    metadata,
  });
}

type SecurityEventAction = "create_development_thread" | "update_development_thread" | "complete_development_thread" | "close_development_thread" | "reopen_development_thread" | "add_development_observation" | "remove_development_observation";

export async function createThreadAction(input: CreateThreadInput) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const thread = await createThread(input, ctx.orgFilter);

  audit("create_development_thread", ctx, "development_thread", thread.id, { playerId: input.playerId, focus: input.focus, category: input.category });

  return { success: true as const, thread };
}

export async function updateThreadAction(threadId: string, input: UpdateThreadInput) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const thread = await updateThread(threadId, input, ctx.orgFilter);

  audit("update_development_thread", ctx, "development_thread", threadId, { status: input.status, focus: input.focus });

  return { success: true as const, thread };
}

export async function addObservationAction(input: AddObservationInput) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const observation = await addObservation(input, ctx.orgFilter);

  audit("add_development_observation", ctx, "development_observation", observation.id, { threadId: input.threadId, matchId: input.matchId });

  return { success: true as const, observation };
}

export async function updateObservationAction(observationId: string, input: UpdateObservationInput) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const observation = await updateObservation(observationId, input, ctx.orgFilter);

  return { success: true as const, observation };
}

export async function removeObservationAction(observationId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  await removeObservation(observationId, ctx.orgFilter);

  audit("remove_development_observation", ctx, "development_observation", observationId);

  return { success: true as const };
}

export async function getThreadAction(threadId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const thread = await getThread(threadId, ctx.orgFilter);
  return { success: true as const, thread };
}

export async function getThreadsForPlayerAction(playerId: string, status?: "ACTIVE" | "COMPLETED" | "CLOSED") {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const threads = await getThreadsForPlayer(playerId, ctx.orgFilter, status);
  return { success: true as const, threads };
}

export async function getActiveThreadsForPlayerAction(playerId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const threads = await getActiveThreadsForPlayer(playerId, ctx.orgFilter);
  return { success: true as const, threads };
}

export async function completeThreadAction(threadId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const thread = await completeThread(threadId, ctx.orgFilter);

  audit("complete_development_thread", ctx, "development_thread", threadId);

  return { success: true as const, thread };
}

export async function closeThreadAction(threadId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const thread = await closeThread(threadId, ctx.orgFilter);

  audit("close_development_thread", ctx, "development_thread", threadId);

  return { success: true as const, thread };
}

export async function reopenThreadAction(threadId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const thread = await reopenThread(threadId, ctx.orgFilter);

  audit("reopen_development_thread", ctx, "development_thread", threadId);

  return { success: true as const, thread };
}