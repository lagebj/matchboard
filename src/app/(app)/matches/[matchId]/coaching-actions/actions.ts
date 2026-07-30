'use server'

import { revalidatePath } from "next/cache";
import { requireCoachAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveOrgFilterForUser, type OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import {
  type CoachingIntentCategory,
  type CoachingIntentScopeType,
  COACHING_INTENT_CATEGORIES,
  COACHING_INTENT_SCOPE_TYPES,
} from "@/lib/coaching/types";

async function requireScopeOrgAccess(scopeType: string, scopeId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type !== "org") return;
  if (scopeType === "MATCH") {
    const match = await db.match.findFirst({
      where: { id: scopeId, ...orgFilter.filter },
      select: { id: true },
    });
    if (!match) throw new Error("Match not found or access denied.");
  } else if (scopeType === "MATCH_ROUND") {
    const round = await db.matchRound.findFirst({
      where: { id: scopeId, ...orgFilter.filter },
      select: { id: true },
    });
    if (!round) throw new Error("Match round not found or access denied.");
  } else if (scopeType === "LEAGUE_SEASON" || scopeType === "PLANNING_PERIOD") {
    const season = await db.leagueSeason.findFirst({
      where: { id: scopeId, ...orgFilter.filter },
      select: { id: true },
    });
    if (!season) throw new Error("League season not found or access denied.");
  } else if (scopeType === "TEAM") {
    const team = await db.team.findFirst({
      where: { id: scopeId, ...orgFilter.filter },
      select: { id: true },
    });
    if (!team) throw new Error("Team not found or access denied.");
  }
}

export async function setCoachingIntentAction(
  scopeType: string,
  scopeId: string,
  category: string,
  note: string | null,
): Promise<{ success: boolean; error?: string }> {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');
  const orgId = orgFilter.type === "org" ? orgFilter.organisationId : undefined;

  if (!COACHING_INTENT_SCOPE_TYPES.includes(scopeType as CoachingIntentScopeType)) {
    return { success: false, error: `Invalid scope type: ${scopeType}` };
  }
  if (!COACHING_INTENT_CATEGORIES.includes(category as CoachingIntentCategory)) {
    return { success: false, error: `Invalid intent category: ${category}` };
  }

  try {
    await requireScopeOrgAccess(scopeType, scopeId, orgFilter);

    const existing = await db.coachingIntent.findFirst({
      where: { scopeType: scopeType as CoachingIntentScopeType, scopeId, ...(orgFilter.type === 'org' ? orgFilter.filter : {}) },
    });

    if (existing) {
      await db.coachingIntent.update({
        where: { id: existing.id },
        data: {
          category: category as CoachingIntentCategory,
          note: note ?? null,
        },
      });
    } else {
      await db.coachingIntent.create({
        data: {
          scopeType: scopeType as CoachingIntentScopeType,
          scopeId,
          category: category as CoachingIntentCategory,
          note: note ?? null,
          ...(orgId ? { organisationId: orgId } : {}),
        },
      });
    }

    revalidatePath(`/matches/${scopeType === "MATCH" ? scopeId : ""}`);
    revalidatePath(`/rounds`);
    revalidatePath(`/assistant`);

    if (scopeType === "MATCH_ROUND") {
      revalidatePath(`/rounds/${scopeId}`);
    }
    if (scopeType === "PLANNING_PERIOD") {
      revalidatePath(`/season`);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to set coaching intent." };
  }
}

export async function removeCoachingIntentAction(
  intentId: string,
): Promise<{ success: boolean; error?: string }> {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');

  try {
    const intent = await db.coachingIntent.findFirst({
      where: { id: intentId, ...(orgFilter.type === 'org' ? orgFilter.filter : {}) },
    });
    if (!intent) return { success: false, error: "Intent not found." };

    await db.coachingIntent.delete({ where: { id: intentId } });

    revalidatePath(`/matches/${intent.scopeType === "MATCH" ? intent.scopeId : ""}`);
    revalidatePath(`/rounds`);
    revalidatePath(`/assistant`);

    if (intent.scopeType === "MATCH_ROUND") {
      revalidatePath(`/rounds/${intent.scopeId}`);
    }
    if (intent.scopeType === "PLANNING_PERIOD") {
      revalidatePath(`/season`);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to remove coaching intent." };
  }
}

export async function getCoachingIntentsAction(
  scopeType: string,
  scopeId: string,
): Promise<{ success: boolean; intents?: Array<{ id: string; category: string; note: string | null; scopeType: string; scopeId: string }>; error?: string }> {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');

  try {
    const intents = await db.coachingIntent.findMany({
      where: { scopeType: scopeType as CoachingIntentScopeType, scopeId, ...(orgFilter.type === 'org' ? orgFilter.filter : {}) },
      orderBy: { createdAt: "desc" },
    });
    return {
      success: true,
      intents: intents.map((i) => ({
        id: i.id,
        category: i.category,
        note: i.note,
        scopeType: i.scopeType,
        scopeId: i.scopeId,
      })),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to get coaching intents." };
  }
}