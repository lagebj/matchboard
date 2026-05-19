'use server'

import { revalidatePath } from "next/cache";
import { requireCoachAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  type FeedbackCategory,
  type FeedbackNextAction,
  FEEDBACK_CATEGORIES,
  FEEDBACK_NEXT_ACTIONS,
} from "@/lib/coaching/types";
import { checkDisallowedLanguage } from "@/lib/coaching/match-execution-feedback";

export async function createMatchFeedbackAction(
  matchId: string,
  playerId: string,
  category: string,
  value: string,
  observableBehavior: string | null,
  nextAction: string | null,
  note: string | null,
): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  if (!FEEDBACK_CATEGORIES.includes(category as FeedbackCategory)) {
    return { success: false, error: `Invalid feedback category: ${category}` };
  }

  if (nextAction && !FEEDBACK_NEXT_ACTIONS.includes(nextAction as FeedbackNextAction)) {
    return { success: false, error: `Invalid next action: ${nextAction}` };
  }

  const allText = [value, observableBehavior, note].filter(Boolean).join(" ");
  const disallowedTerms = checkDisallowedLanguage(allText);
  if (disallowedTerms.length > 0) {
    return {
      success: false,
      error: `Feedback contains disallowed language: ${disallowedTerms.join(", ")}. Use observable behavior descriptions instead of character labels.`,
    };
  }

  try {
    await db.matchExecutionFeedback.create({
      data: {
        matchId,
        playerId,
        category: category as FeedbackCategory,
        value,
        observableBehavior: observableBehavior ?? null,
        nextAction: (nextAction as FeedbackNextAction) ?? "NO_ACTION",
        note: note ?? null,
      },
    });

    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/post-match`);
    revalidatePath(`/players/${playerId}`);

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return { success: false, error: "Feedback for this player and category already exists for this match. Update it instead." };
    }
    return { success: false, error: error instanceof Error ? error.message : "Failed to create feedback." };
  }
}

export async function updateMatchFeedbackAction(
  feedbackId: string,
  data: {
    value?: string;
    observableBehavior?: string | null;
    nextAction?: string | null;
    note?: string | null;
  },
): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  if (data.nextAction && !FEEDBACK_NEXT_ACTIONS.includes(data.nextAction as FeedbackNextAction)) {
    return { success: false, error: `Invalid next action: ${data.nextAction}` };
  }

  try {
    const existing = await db.matchExecutionFeedback.findUnique({ where: { id: feedbackId } });
    if (!existing) return { success: false, error: "Feedback not found." };

    const allText = [data.value ?? existing.value, data.observableBehavior ?? existing.observableBehavior, data.note ?? existing.note].filter(Boolean).join(" ");
    const disallowedTerms = checkDisallowedLanguage(allText);
    if (disallowedTerms.length > 0) {
      return {
        success: false,
        error: `Feedback contains disallowed language: ${disallowedTerms.join(", ")}. Use observable behavior descriptions instead of character labels.`,
      };
    }

    await db.matchExecutionFeedback.update({
      where: { id: feedbackId },
      data: {
        ...(data.value !== undefined && { value: data.value }),
        ...(data.observableBehavior !== undefined && { observableBehavior: data.observableBehavior }),
        ...(data.nextAction !== undefined && { nextAction: data.nextAction as FeedbackNextAction }),
        ...(data.note !== undefined && { note: data.note }),
      },
    });

    revalidatePath(`/matches/${existing.matchId}`);
    revalidatePath(`/matches/${existing.matchId}/post-match`);
    revalidatePath(`/players/${existing.playerId}`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update feedback." };
  }
}

export async function deleteMatchFeedbackAction(
  feedbackId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  try {
    const feedback = await db.matchExecutionFeedback.findUnique({ where: { id: feedbackId } });
    if (!feedback) return { success: false, error: "Feedback not found." };

    await db.matchExecutionFeedback.delete({ where: { id: feedbackId } });

    revalidatePath(`/matches/${feedback.matchId}`);
    revalidatePath(`/matches/${feedback.matchId}/post-match`);
    revalidatePath(`/players/${feedback.playerId}`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete feedback." };
  }
}

export async function getMatchFeedbackAction(
  matchId: string,
): Promise<{ success: boolean; feedback?: Array<{ id: string; playerId: string; category: string; value: string; observableBehavior: string | null; nextAction: string; note: string | null }>; error?: string }> {
  await requireCoachAccess();

  try {
    const feedback = await db.matchExecutionFeedback.findMany({
      where: { matchId },
      orderBy: [{ category: "asc" }, { playerId: "asc" }],
    });

    return {
      success: true,
      feedback: feedback.map((f) => ({
        id: f.id,
        playerId: f.playerId,
        category: f.category,
        value: f.value,
        observableBehavior: f.observableBehavior,
        nextAction: f.nextAction,
        note: f.note,
      })),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to get feedback." };
  }
}

export async function getPlayerFeedbackAction(
  playerId: string,
): Promise<{ success: boolean; feedback?: Array<{ id: string; matchId: string; category: string; value: string; observableBehavior: string | null; nextAction: string; note: string | null }>; error?: string }> {
  await requireCoachAccess();

  try {
    const feedback = await db.matchExecutionFeedback.findMany({
      where: { playerId },
      orderBy: [{ matchId: "asc" }, { category: "asc" }],
    });

    return {
      success: true,
      feedback: feedback.map((f) => ({
        id: f.id,
        matchId: f.matchId,
        category: f.category,
        value: f.value,
        observableBehavior: f.observableBehavior,
        nextAction: f.nextAction,
        note: f.note,
      })),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to get player feedback." };
  }
}