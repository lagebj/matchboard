'use server'

import { db } from "@/lib/db";
import { requireActorContext, requireMutationRole, requireMatchGroupAccess } from "@/lib/auth/actor-context";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { MatchEnvironmentObservation, OpponentConcernCategory, OpponentObservationFollowUp, MatchFit } from "@/generated/prisma/client";
import {
  validateObservation,
  deduplicateCategories,
  cleanFactualSummary,
  type ObservationFormData,
} from "@/lib/opponents/validate-observation";
import { revalidatePath } from "next/cache";

export type ObservationActionState = {
  success: boolean;
  error: string;
  errors?: string[];
};

async function requireMatchOrgAccess(matchId: string, orgFilter: OrgFilterMode): Promise<void> {
  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: { id: true },
  });
  if (!match) throw new Error("Match not found or access denied.");
}

export async function saveObservationAction(
  _prevState: ObservationActionState,
  formData: FormData,
): Promise<ObservationActionState> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const matchId = formData.get("matchId") as string;
  if (!matchId) return { success: false, error: "Match ID is required." };

  const match = await db.match.findFirst({
    where: { id: matchId, ...ctx.orgFilter.filter },
    select: { id: true, opponentTeamId: true },
  });
  if (!match) return { success: false, error: "Match not found." };
  if (!match.opponentTeamId) return { success: false, error: "No opponent profile linked yet. Complete the post-match report to link a canonical opponent." };

  await requireMatchOrgAccess(matchId, ctx.orgFilter);
  await requireMatchGroupAccess(ctx, matchId);

  const existingObservation = await db.opponentEncounterObservation.findFirst({
    where: { matchId, ...ctx.orgFilter.filter },
    select: { id: true },
  });

  const postMatchReport = await db.postMatchReport.findFirst({
    where: { matchId, ...ctx.orgFilter.filter },
    select: { id: true, status: true },
  });

  if (postMatchReport?.status === "LOCKED" && !existingObservation) {
    return { success: false, error: "Cannot add observation to a locked report." };
  }

  const data: ObservationFormData = {
    overallEnvironment: (formData.get("overallEnvironment") as MatchEnvironmentObservation) || "NOT_ASSESSED",
    opponentPlayersContext: (formData.get("opponentPlayersContext") as MatchEnvironmentObservation) || "NOT_ASSESSED",
    opponentStaffContext: (formData.get("opponentStaffContext") as MatchEnvironmentObservation) || "NOT_ASSESSED",
    spectatorSidelineContext: (formData.get("spectatorSidelineContext") as MatchEnvironmentObservation) || "NOT_ASSESSED",
    concernCategories: formData.getAll("concernCategories") as OpponentConcernCategory[],
    factualSummary: (formData.get("factualSummary") as string) || null,
    followUp: (formData.get("followUp") as OpponentObservationFollowUp) || "NONE",
  };

  const validation = validateObservation(data);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join(" "), errors: validation.errors };
  }

  const cleanedCategories = deduplicateCategories(data.concernCategories as OpponentConcernCategory[]);
  const cleanedSummary = cleanFactualSummary(data.factualSummary);

  try {
    if (existingObservation) {
      await db.opponentEncounterObservation.update({
        where: { id: existingObservation.id },
        data: {
          overallEnvironment: data.overallEnvironment,
          opponentPlayersContext: data.opponentPlayersContext,
          opponentStaffContext: data.opponentStaffContext,
          spectatorSidelineContext: data.spectatorSidelineContext,
          concernCategories: cleanedCategories,
          factualSummary: cleanedSummary,
          followUp: data.followUp,
          recordedBy: ctx.email,
        },
      });
    } else {
      await db.opponentEncounterObservation.create({
        data: {
          matchId,
          opponentTeamId: match.opponentTeamId,
          overallEnvironment: data.overallEnvironment,
          opponentPlayersContext: data.opponentPlayersContext,
          opponentStaffContext: data.opponentStaffContext,
          spectatorSidelineContext: data.spectatorSidelineContext,
          concernCategories: cleanedCategories,
          factualSummary: cleanedSummary,
          followUp: data.followUp,
          recordedBy: ctx.email,
          organisationId: ctx.organisationId,
        },
      });
    }
  } catch {
    return { success: false, error: "Could not save observation." };
  }

  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/matches/${matchId}/post-match`);
  return { success: true, error: "" };
}

export type MatchFitActionState = {
  success: boolean;
  error: string;
};

export async function updateMatchFitAction(
  _prevState: MatchFitActionState,
  formData: FormData,
): Promise<MatchFitActionState> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const matchId = formData.get("matchId") as string;
  const matchFit = formData.get("matchFit") as string;

  if (!matchId) return { success: false, error: "Match ID is required." };

  const validMatchFit = [
    "UNKNOWN", "TOO_EASY", "GOOD_FIT", "TOO_HARD",
    "CHAOTIC", "SUPPORT_OVERPOWERED", "SUPPORT_TOO_LOW",
  ];
  if (!validMatchFit.includes(matchFit)) {
    return { success: false, error: "Invalid match fit value." };
  }

  const match = await db.match.findFirst({
    where: { id: matchId, ...ctx.orgFilter.filter },
  });
  if (!match) return { success: false, error: "Match not found or access denied." };

  try {
    await db.match.update({
      where: { id: matchId },
      data: { matchFit: matchFit as MatchFit },
    });
  } catch {
    return { success: false, error: "Could not update match fit." };
  }

  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/matches/${matchId}/post-match`);
  return { success: true, error: "" };
}