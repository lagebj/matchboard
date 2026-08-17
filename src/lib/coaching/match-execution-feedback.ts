import { db } from "@/lib/db";
import {
  type FeedbackCategory,
  type FeedbackNextAction,
  DISALLOWED_FEEDBACK_TERMS,
  FEEDBACK_CATEGORIES,
  FEEDBACK_NEXT_ACTIONS,
} from "./types";

type CreateFeedbackInput = {
  matchId: string;
  playerId: string;
  category: FeedbackCategory;
  value: string;
  observableBehavior?: string;
  nextAction?: FeedbackNextAction;
  note?: string;
  recordedBy?: string;
  organisationId: string;
};

type UpdateFeedbackInput = {
  value?: string;
  observableBehavior?: string;
  nextAction?: FeedbackNextAction;
  note?: string;
};

export function validateFeedbackCategory(category: string): category is FeedbackCategory {
  return FEEDBACK_CATEGORIES.includes(category as FeedbackCategory);
}

export function validateNextAction(action: string): action is FeedbackNextAction {
  return FEEDBACK_NEXT_ACTIONS.includes(action as FeedbackNextAction);
}

export function checkDisallowedLanguage(text: string): string[] {
  const lowerText = text.toLowerCase();
  const found: string[] = [];
  for (const term of DISALLOWED_FEEDBACK_TERMS) {
    if (lowerText.includes(term.toLowerCase())) {
      found.push(term);
    }
  }
  return found;
}

export function validateFeedbackText(text: string): { valid: boolean; disallowedTerms: string[] } {
  const disallowedTerms = checkDisallowedLanguage(text);
  return {
    valid: disallowedTerms.length === 0,
    disallowedTerms,
  };
}

export async function createMatchExecutionFeedback(input: CreateFeedbackInput) {
  if (!validateFeedbackCategory(input.category)) {
    throw new Error(`Invalid feedback category: ${input.category}`);
  }

  if (input.nextAction && !validateNextAction(input.nextAction)) {
    throw new Error(`Invalid next action: ${input.nextAction}`);
  }

  const allText = [input.value, input.observableBehavior, input.note].filter(Boolean).join(" ");
  const validation = validateFeedbackText(allText);
  if (!validation.valid) {
    throw new Error(
      `Feedback contains disallowed language: ${validation.disallowedTerms.join(", ")}. Use observable behavior descriptions instead.`
    );
  }

  await db.selection.findFirst({
    where: { matchId: input.matchId, playerId: input.playerId },
    select: { id: true },
  });

  return db.matchExecutionFeedback.create({
    data: {
      organisationId: input.organisationId,
      matchId: input.matchId,
      playerId: input.playerId,
      category: input.category,
      value: input.value,
      observableBehavior: input.observableBehavior,
      nextAction: input.nextAction ?? "NO_ACTION",
      note: input.note,
      recordedBy: input.recordedBy,
    },
  });
}

export async function updateMatchExecutionFeedback(id: string, input: UpdateFeedbackInput) {
  if (input.value !== undefined || input.observableBehavior !== undefined || input.note !== undefined) {
    const existing = await db.matchExecutionFeedback.findFirst({ where: { id } });
    if (!existing) throw new Error(`Feedback not found: ${id}`);

    const allText = [
      input.value ?? existing.value,
      input.observableBehavior ?? existing.observableBehavior,
      input.note ?? existing.note,
    ].filter(Boolean).join(" ");

    const validation = validateFeedbackText(allText);
    if (!validation.valid) {
      throw new Error(
        `Feedback contains disallowed language: ${validation.disallowedTerms.join(", ")}. Use observable behavior descriptions instead.`
      );
    }
  }

  return db.matchExecutionFeedback.update({
    where: { id },
    data: {
      ...(input.value !== undefined && { value: input.value }),
      ...(input.observableBehavior !== undefined && { observableBehavior: input.observableBehavior }),
      ...(input.nextAction !== undefined && { nextAction: input.nextAction }),
      ...(input.note !== undefined && { note: input.note }),
    },
  });
}

export async function deleteMatchExecutionFeedback(id: string) {
  return db.matchExecutionFeedback.delete({ where: { id } });
}

export async function getFeedbackForMatch(matchId: string) {
  return db.matchExecutionFeedback.findMany({
    where: { matchId },
    orderBy: [{ category: "asc" }, { playerId: "asc" }],
  });
}

export async function getFeedbackForPlayer(playerId: string) {
  return db.matchExecutionFeedback.findMany({
    where: { playerId },
    orderBy: [{ matchId: "asc" }, { category: "asc" }],
  });
}

export async function getFeedbackForMatchPlayer(matchId: string, playerId: string) {
  return db.matchExecutionFeedback.findMany({
    where: { matchId, playerId },
    orderBy: { category: "asc" },
  });
}