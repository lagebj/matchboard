'use server'

import { revalidatePath } from "next/cache";
import { requirePageActorContext, requireMutationRole, requirePlayerGroupAccess } from "@/lib/auth/actor-context";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import {
  type MatchdayResponsibilityType,
  MATCHDAY_RESPONSIBILITIES,
} from "@/lib/coaching/types";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { enrichExplanation } from "@/lib/selection/explanation-enrichment";
import { isMatchPlanningEditable } from "@/lib/selection/planning-boundary";

async function requireSelectionOrgAccess(selectionId: string, orgFilter: OrgFilterMode): Promise<{ matchId: string }> {
  const selection = await db.selection.findFirst({
    where: { id: selectionId, ...orgFilter.filter },
    select: { matchId: true },
  });
  if (!selection) throw new Error("Selection not found or access denied.");
  return { matchId: selection.matchId };
}

export async function setMatchdayResponsibilityAction(
  selectionId: string,
  responsibility: string | null,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireSelectionOrgAccess(selectionId, ctx.orgFilter);

  if (responsibility !== null && !MATCHDAY_RESPONSIBILITIES.includes(responsibility as MatchdayResponsibilityType)) {
    return { success: false, error: `Invalid matchday responsibility: ${responsibility}` };
  }

  try {
    const selection = await db.selection.findFirst({
      where: { id: selectionId, ...ctx.orgFilter.filter },
      select: { id: true, matchId: true, matchdayResponsibility: true, playerId: true },
    });

    if (!selection) return { success: false, error: "Selection not found." };

    // Matchday responsibility is pre-match coaching setup — editable while planning is open
    // (ADR-0109 / F1), decided by the match boundary, not a possibly-stale Selection.status.
    const boundary = await isMatchPlanningEditable(selection.matchId);
    if (!boundary.editable) {
      return { success: false, error: boundary.reason ?? "Planning is closed for this match." };
    }

    await requirePlayerGroupAccess(ctx, selection.playerId);

    await db.selection.update({
      where: { id: selectionId },
      data: { matchdayResponsibility: responsibility as MatchdayResponsibilityType | null },
    });

    const updatedSelection = await db.selection.findFirst({
      where: { id: selectionId, ...ctx.orgFilter.filter },
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

