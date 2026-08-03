'use server'

import { revalidatePath } from "next/cache";
import { requireActorContext, requireMutationRole, requireTeamAccess } from "@/lib/auth/actor-context";
import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
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
  } else if (scopeType === "LEAGUE_SEASON") {
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
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const orgId = ctx.organisationId;

  if (!COACHING_INTENT_SCOPE_TYPES.includes(scopeType as CoachingIntentScopeType)) {
    return { success: false, error: `Invalid scope type: ${scopeType}` };
  }
  if (!COACHING_INTENT_CATEGORIES.includes(category as CoachingIntentCategory)) {
    return { success: false, error: `Invalid intent category: ${category}` };
  }

  try {
    await requireScopeOrgAccess(scopeType, scopeId, ctx.orgFilter);

    if (scopeType === "TEAM") {
      requireTeamAccess(ctx, scopeId);
    }

    const existing = await db.coachingIntent.findFirst({
      where: { scopeType: scopeType as CoachingIntentScopeType, scopeId, ...(ctx.orgFilter.type === 'org' ? ctx.orgFilter.filter : {}) },
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
    if (scopeType === "LEAGUE_SEASON") {
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
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  try {
    const intent = await db.coachingIntent.findFirst({
      where: { id: intentId, ...(ctx.orgFilter.type === 'org' ? ctx.orgFilter.filter : {}) },
    });
    if (!intent) return { success: false, error: "Intent not found." };

    if (intent.scopeType === "TEAM") {
      requireTeamAccess(ctx, intent.scopeId);
    }

    await db.coachingIntent.delete({ where: { id: intentId } });

    revalidatePath(`/matches/${intent.scopeType === "MATCH" ? intent.scopeId : ""}`);
    revalidatePath(`/rounds`);
    revalidatePath(`/assistant`);

    if (intent.scopeType === "MATCH_ROUND") {
      revalidatePath(`/rounds/${intent.scopeId}`);
    }
    if (intent.scopeType === "LEAGUE_SEASON") {
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
  const ctx = await requireActorContext();

  try {
    const intents = await db.coachingIntent.findMany({
      where: { scopeType: scopeType as CoachingIntentScopeType, scopeId, ...(ctx.orgFilter.type === 'org' ? ctx.orgFilter.filter : {}) },
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