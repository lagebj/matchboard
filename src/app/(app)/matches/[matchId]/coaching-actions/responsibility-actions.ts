'use server'

import { revalidatePath } from "next/cache";
import { requireActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import {
  type MatchdayResponsibilityType,
  MATCHDAY_RESPONSIBILITIES,
} from "@/lib/coaching/types";
import { enrichExplanation } from "@/lib/selection/explanation-enrichment";

async function requireSelectionOrgAccess(selectionId: string, orgFilter: OrgFilterMode): Promise<{ matchId: string }> {
  if (orgFilter.type !== "org") {
    const selection = await db.selection.findUnique({ where: { id: selectionId }, select: { matchId: true } });
    if (!selection) throw new Error("Selection not found.");
    return { matchId: selection.matchId };
  }
  const selection = await db.selection.findFirst({
    where: { id: selectionId, ...orgFilter.filter },
    select: { matchId: true },
  });
  if (!selection) throw new Error("Selection not found or access denied.");
  return { matchId: selection.matchId };
}

async function requireMatchOrgAccess(matchId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type !== "org") return;
  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: { id: true },
  });
  if (!match) throw new Error("Match not found or access denied.");
}

export async function setMatchdayResponsibilityAction(
  selectionId: string,
  responsibility: string | null,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  await requireSelectionOrgAccess(selectionId, ctx.orgFilter);

  if (responsibility !== null && !MATCHDAY_RESPONSIBILITIES.includes(responsibility as MatchdayResponsibilityType)) {
    return { success: false, error: `Invalid matchday responsibility: ${responsibility}` };
  }

  try {
    const selection = await db.selection.findUnique({
      where: { id: selectionId },
      select: { id: true, matchId: true, status: true, matchdayResponsibility: true, playerId: true },
    });

    if (!selection) return { success: false, error: "Selection not found." };
    if (selection.status === "FINALIZED") {
      return { success: false, error: "Cannot modify matchday responsibility on a finalised selection." };
    }

    await db.selection.update({
      where: { id: selectionId },
      data: { matchdayResponsibility: responsibility as MatchdayResponsibilityType | null },
    });

    const updatedSelection = await db.selection.findUnique({
      where: { id: selectionId },
      select: { explanation: true },
    });

    if (updatedSelection?.explanation) {
      const enriched = enrichExplanation(
        updatedSelection.explanation as Record<string, unknown>,
        { matchdayResponsibility: (responsibility as MatchdayResponsibilityType | null) ?? undefined },
      );
      if (enriched) {
        await db.selection.update({
          where: { id: selectionId },
          data: { explanation: enriched as unknown as Prisma.InputJsonValue },
        });
      }
    }

    await db.selectionExplanation.updateMany({
      where: { matchId: selection.matchId, playerId: selection.playerId },
      data: { matchdayResponsibility: responsibility as MatchdayResponsibilityType | null },
    });

    revalidatePath(`/matches/${selection.matchId}`);
    revalidatePath(`/rounds`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to set matchday responsibility." };
  }
}

export async function removeMatchdayResponsibilityAction(
  selectionId: string,
): Promise<{ success: boolean; error?: string }> {
  return setMatchdayResponsibilityAction(selectionId, null);
}

export async function setTeamReflectionAction(
  matchId: string,
  data: {
    effort?: string;
    teamCohesion?: string;
    positionalShape?: string;
    recoveryBehavior?: string;
    note?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const orgId = ctx.orgFilter.type === "org" ? ctx.orgFilter.organisationId : undefined;
  await requireMatchOrgAccess(matchId, ctx.orgFilter);

  try {
    const match = await db.match.findFirst({
      where: { id: matchId, ...(ctx.orgFilter.type === 'org' ? ctx.orgFilter.filter : {}) },
    });
    if (!match) return { success: false, error: "Match not found." };

    await db.teamReflection.upsert({
      where: { matchId },
      create: {
        matchId,
        effort: data.effort ?? null,
        teamCohesion: data.teamCohesion ?? null,
        positionalShape: data.positionalShape ?? null,
        recoveryBehavior: data.recoveryBehavior ?? null,
        note: data.note ?? null,
        ...(orgId ? { organisationId: orgId } : {}),
      },
      update: {
        ...(data.effort !== undefined && { effort: data.effort }),
        ...(data.teamCohesion !== undefined && { teamCohesion: data.teamCohesion }),
        ...(data.positionalShape !== undefined && { positionalShape: data.positionalShape }),
        ...(data.recoveryBehavior !== undefined && { recoveryBehavior: data.recoveryBehavior }),
        ...(data.note !== undefined && { note: data.note }),
      },
    });

    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/post-match`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to save team reflection." };
  }
}

export async function getTeamReflectionAction(
  matchId: string,
): Promise<{ success: boolean; reflection?: { id: string; effort: string | null; teamCohesion: string | null; positionalShape: string | null; recoveryBehavior: string | null; note: string | null } | null; error?: string }> {
  const ctx = await requireActorContext();
  await requireMatchOrgAccess(matchId, ctx.orgFilter);

  try {
    const reflection = await db.teamReflection.findFirst({
      where: { matchId, ...(ctx.orgFilter.type === 'org' ? ctx.orgFilter.filter : {}) },
    });

    return {
      success: true,
      reflection: reflection ? {
        id: reflection.id,
        effort: reflection.effort,
        teamCohesion: reflection.teamCohesion,
        positionalShape: reflection.positionalShape,
        recoveryBehavior: reflection.recoveryBehavior,
        note: reflection.note,
      } : null,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to get team reflection." };
  }
}