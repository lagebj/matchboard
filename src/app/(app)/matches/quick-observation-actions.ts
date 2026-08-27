"use server";

import { revalidatePath } from "next/cache";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import {
  createQuickObservation,
  getQuickObservations,
  discardQuickObservation,
  keepQuickObservationAsNote,
  convertQuickObservationToDevelopmentThread,
  convertQuickObservationToTeamReflection,
  convertQuickObservationToOpponentObservation,
  type CreateQuickObservationInput,
  type QuickObservationStatus,
} from "@/lib/coaching/quick-observation";
import { logSecurityEvent } from "@/lib/security/audit-log";

type QuickObservationAction =
  | "create_quick_observation"
  | "discard_quick_observation"
  | "keep_quick_observation_as_note"
  | "convert_quick_observation";

function audit(action: QuickObservationAction, ctx: { userId: string; organisationId: string }, resourceId: string, metadata?: Record<string, unknown>) {
  logSecurityEvent({
    category: "mutation",
    action,
    actor: ctx.userId,
    tenant: ctx.organisationId,
    resource: "quick_observation",
    resourceId,
    result: "success",
    metadata,
  });
}

function revalidateQuickObservationPaths(matchId?: string | null): void {
  if (matchId) {
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/o/[orgSlug]/matches/${matchId}`);
  }
}

export async function createQuickObservationAction(input: CreateQuickObservationInput) {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);

    const observation = await createQuickObservation({ ...input, recordedBy: ctx.email }, ctx.orgFilter);
    audit("create_quick_observation", ctx, observation.id, { matchId: input.matchId });
    revalidateQuickObservationPaths(input.matchId);

    return { success: true as const, observation };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to create quick observation." };
  }
}

export async function getQuickObservationsAction(filters: { matchId?: string; playerId?: string; status?: QuickObservationStatus }) {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);

    const observations = await getQuickObservations(filters, ctx.orgFilter);
    return { success: true as const, observations };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to load quick observations." };
  }
}

export async function discardQuickObservationAction(id: string) {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);

    const observation = await discardQuickObservation(id, ctx.orgFilter);
    audit("discard_quick_observation", ctx, id);
    revalidateQuickObservationPaths(observation.matchId);

    return { success: true as const, observation };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to discard quick observation." };
  }
}

export async function keepQuickObservationAsNoteAction(id: string) {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);

    const observation = await keepQuickObservationAsNote(id, ctx.orgFilter);
    audit("keep_quick_observation_as_note", ctx, id);
    revalidateQuickObservationPaths(observation.matchId);

    return { success: true as const, observation };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to update quick observation." };
  }
}

export async function convertQuickObservationAction(
  id: string,
  target: { type: "DEVELOPMENT_THREAD"; threadId: string } | { type: "TEAM_REFLECTION" } | { type: "OPPONENT_OBSERVATION" },
) {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);

    const observation =
      target.type === "DEVELOPMENT_THREAD"
        ? await convertQuickObservationToDevelopmentThread(id, target.threadId, ctx.orgFilter)
        : target.type === "TEAM_REFLECTION"
          ? await convertQuickObservationToTeamReflection(id, ctx.orgFilter)
          : await convertQuickObservationToOpponentObservation(id, ctx.orgFilter);

    audit("convert_quick_observation", ctx, id, { convertedToType: target.type });
    revalidateQuickObservationPaths(observation.matchId);

    return { success: true as const, observation };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to convert quick observation." };
  }
}
