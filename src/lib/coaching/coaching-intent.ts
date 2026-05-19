import { db } from "@/lib/db";
import {
  type CoachingIntentCategory,
  type CoachingIntentScopeType,
  COACHING_INTENT_CATEGORIES,
  COACHING_INTENT_SCOPE_TYPES,
} from "./types";

type CreateCoachingIntentInput = {
  scopeType: CoachingIntentScopeType;
  scopeId: string;
  category: CoachingIntentCategory;
  note?: string;
  createdBy?: string;
};

type UpdateCoachingIntentInput = {
  category?: CoachingIntentCategory;
  note?: string;
};

export function validateCoachingIntentCategory(category: string): category is CoachingIntentCategory {
  return COACHING_INTENT_CATEGORIES.includes(category as CoachingIntentCategory);
}

export function validateCoachingIntentScopeType(scopeType: string): scopeType is CoachingIntentScopeType {
  return COACHING_INTENT_SCOPE_TYPES.includes(scopeType as CoachingIntentScopeType);
}

export async function createCoachingIntent(input: CreateCoachingIntentInput) {
  if (!validateCoachingIntentScopeType(input.scopeType)) {
    throw new Error(`Invalid coaching intent scope type: ${input.scopeType}`);
  }
  if (!validateCoachingIntentCategory(input.category)) {
    throw new Error(`Invalid coaching intent category: ${input.category}`);
  }

  return db.coachingIntent.create({
    data: {
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      category: input.category,
      note: input.note,
      createdBy: input.createdBy,
    },
  });
}

export async function updateCoachingIntent(id: string, input: UpdateCoachingIntentInput) {
  if (input.category !== undefined && !validateCoachingIntentCategory(input.category)) {
    throw new Error(`Invalid coaching intent category: ${input.category}`);
  }

  return db.coachingIntent.update({
    where: { id },
    data: {
      ...(input.category !== undefined && { category: input.category }),
      ...(input.note !== undefined && { note: input.note }),
    },
  });
}

export async function deleteCoachingIntent(id: string) {
  return db.coachingIntent.delete({ where: { id } });
}

export async function getCoachingIntentsForScope(scopeType: CoachingIntentScopeType, scopeId: string) {
  return db.coachingIntent.findMany({
    where: { scopeType, scopeId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCoachingIntentForMatch(matchId: string) {
  return db.coachingIntent.findMany({
    where: { scopeType: "MATCH", scopeId: matchId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCoachingIntentForRound(matchRoundId: string) {
  return db.coachingIntent.findMany({
    where: { scopeType: "MATCH_ROUND", scopeId: matchRoundId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getActiveCoachingIntentForMatch(matchId: string) {
  const matchIntents = await db.coachingIntent.findMany({
    where: { scopeType: "MATCH", scopeId: matchId },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  if (matchIntents.length > 0) return matchIntents[0];

  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { matchRoundId: true },
  });
  if (!match) return null;

  const roundIntents = await db.coachingIntent.findMany({
    where: { scopeType: "MATCH_ROUND", scopeId: match.matchRoundId },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  if (roundIntents.length > 0) return roundIntents[0];

  const round = await db.matchRound.findUnique({
    where: { id: match.matchRoundId },
    select: { planningPeriodId: true },
  });
  if (!round) return null;

  const periodIntents = await db.coachingIntent.findMany({
    where: { scopeType: "PLANNING_PERIOD", scopeId: round.planningPeriodId },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  return periodIntents.length > 0 ? periodIntents[0] : null;
}