'use server'

import { revalidatePath } from "next/cache";
import { requireCoachAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  type CoachingIntentCategory,
  type CoachingIntentScopeType,
  COACHING_INTENT_CATEGORIES,
  COACHING_INTENT_SCOPE_TYPES,
} from "@/lib/coaching/types";

export async function setCoachingIntentAction(
  scopeType: string,
  scopeId: string,
  category: string,
  note: string | null,
): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  if (!COACHING_INTENT_SCOPE_TYPES.includes(scopeType as CoachingIntentScopeType)) {
    return { success: false, error: `Invalid scope type: ${scopeType}` };
  }
  if (!COACHING_INTENT_CATEGORIES.includes(category as CoachingIntentCategory)) {
    return { success: false, error: `Invalid intent category: ${category}` };
  }

  try {
    const existing = await db.coachingIntent.findFirst({
      where: { scopeType: scopeType as CoachingIntentScopeType, scopeId },
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
  await requireCoachAccess();

  try {
    const intent = await db.coachingIntent.findUnique({ where: { id: intentId } });
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
  await requireCoachAccess();

  try {
    const intents = await db.coachingIntent.findMany({
      where: { scopeType: scopeType as CoachingIntentScopeType, scopeId },
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