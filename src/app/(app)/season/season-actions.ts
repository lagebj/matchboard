"use server";

import {
  finalizeLeagueSeason,
  unfinalizeLeagueSeason,
  validateLeagueSeasonFinalization,
} from "@/lib/seasons/finalize-league-season";
import { requireActorContext, requireMutationRole } from "@/lib/auth/actor-context";

export async function finalizeLeagueSeasonAction(leagueSeasonId: string): Promise<{
  success: boolean;
  error?: string;
  validation?: { canFinalize: boolean; errors: string[]; warnings: string[] };
}> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  const validation = await validateLeagueSeasonFinalization(leagueSeasonId);

  if (!validation.canFinalize) {
    return { success: false, validation };
  }

  const orgFilter = ctx.orgFilter.filter;
  const { db } = await import("@/lib/db");
  const leagueSeason = await db.leagueSeason.findFirst({
    where: { id: leagueSeasonId, ...orgFilter },
    select: { id: true },
  });

  if (!leagueSeason) {
    return { success: false, error: "League season not found or access denied." };
  }

  const result = await finalizeLeagueSeason(leagueSeasonId, ctx.userId);
  return result;
}

export async function unfinalizeLeagueSeasonAction(leagueSeasonId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  const orgFilter = ctx.orgFilter.filter;
  const { db } = await import("@/lib/db");
  const leagueSeason = await db.leagueSeason.findFirst({
    where: { id: leagueSeasonId, ...orgFilter },
    select: { id: true },
  });

  if (!leagueSeason) {
    return { success: false, error: "League season not found or access denied." };
  }

  return unfinalizeLeagueSeason(leagueSeasonId);
}

export async function getFinalizationValidationAction(leagueSeasonId: string): Promise<{
  validation: { canFinalize: boolean; errors: string[]; warnings: string[] };
}> {
  const ctx = await requireActorContext();

  const orgFilter = ctx.orgFilter.filter;
  const { db } = await import("@/lib/db");
  const leagueSeason = await db.leagueSeason.findFirst({
    where: { id: leagueSeasonId, ...orgFilter },
    select: { id: true },
  });

  if (!leagueSeason) {
    return { validation: { canFinalize: false, errors: ["Access denied."], warnings: [] } };
  }

  const validation = await validateLeagueSeasonFinalization(leagueSeasonId);
  return { validation };
}