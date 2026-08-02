import { db } from "@/lib/db";
import type { CoachingIntentCategory, MatchdayResponsibilityType } from "@/lib/coaching/types";
import type { Prisma } from "@/generated/prisma/client";

type ExplanationEnrichmentContext = {
  coachingIntentCategory?: CoachingIntentCategory;
  matchdayResponsibility?: MatchdayResponsibilityType;
  readinessWarnings?: string[];
};

export async function getMatchIntentMap(matchIds: string[]): Promise<Map<string, CoachingIntentCategory>> {
  const intentMap = new Map<string, CoachingIntentCategory>();

  const matchIntents = await db.coachingIntent.findMany({
    where: { scopeType: "MATCH", scopeId: { in: matchIds } },
    orderBy: { createdAt: "desc" },
  });

  for (const intent of matchIntents) {
    if (!intentMap.has(intent.scopeId)) {
      intentMap.set(intent.scopeId, intent.category as CoachingIntentCategory);
    }
  }

  const matchRounds = await db.match.findMany({
    where: { id: { in: matchIds } },
    select: { id: true, matchRoundId: true },
  });

  const roundIdsWithoutMatchIntent = matchRounds
    .filter((m) => !intentMap.has(m.id))
    .map((m) => m.matchRoundId);

  if (roundIdsWithoutMatchIntent.length > 0) {
    const uniqueRoundIds = [...new Set(roundIdsWithoutMatchIntent)];

    const roundIntents = await db.coachingIntent.findMany({
      where: { scopeType: "MATCH_ROUND", scopeId: { in: uniqueRoundIds } },
      orderBy: { createdAt: "desc" },
    });

    const roundIntentMap = new Map<string, CoachingIntentCategory>();
    for (const intent of roundIntents) {
      if (!roundIntentMap.has(intent.scopeId)) {
        roundIntentMap.set(intent.scopeId, intent.category as CoachingIntentCategory);
      }
    }

    for (const m of matchRounds) {
      if (!intentMap.has(m.id) && roundIntentMap.has(m.matchRoundId)) {
        intentMap.set(m.id, roundIntentMap.get(m.matchRoundId)!);
      }
    }

    const _matchIdsStillWithoutIntent = matchRounds
      .filter((m) => !intentMap.has(m.id))
      .map((m) => m.matchRoundId);

    const leagueSeasons = await db.matchRound.findMany({

      select: { id: true, leagueSeasonId: true },
    });

    const uniquePeriodIds = [...new Set(leagueSeasons.map((p) => p.leagueSeasonId))];

    if (uniquePeriodIds.length > 0) {
      const periodIntents = await db.coachingIntent.findMany({
        where: { scopeType: "LEAGUE_SEASON", scopeId: { in: uniquePeriodIds } },
        orderBy: { createdAt: "desc" },
      });

      const periodIntentMap = new Map<string, CoachingIntentCategory>();
      for (const intent of periodIntents) {
        if (!periodIntentMap.has(intent.scopeId)) {
          periodIntentMap.set(intent.scopeId, intent.category as CoachingIntentCategory);
        }
      }

      const roundToPeriod = new Map<string, string>();
      for (const p of leagueSeasons) {
        roundToPeriod.set(p.id, p.leagueSeasonId);
      }

      for (const m of matchRounds) {
        if (!intentMap.has(m.id)) {
          const periodId = roundToPeriod.get(m.matchRoundId);
          if (periodId && periodIntentMap.has(periodId)) {
            intentMap.set(m.id, periodIntentMap.get(periodId)!);
          }
        }
      }
    }
  }

  return intentMap;
}

export function enrichExplanation(
  existingExplanation: Record<string, unknown> | null,
  context: ExplanationEnrichmentContext,
): Record<string, unknown> | null {
  if (!existingExplanation) return existingExplanation;

  const enriched = { ...existingExplanation };

  if (context.coachingIntentCategory) {
    enriched.coachingIntentCategory = context.coachingIntentCategory;
  }

  if (context.matchdayResponsibility) {
    enriched.matchdayResponsibility = context.matchdayResponsibility;
  }

  if (context.readinessWarnings && context.readinessWarnings.length > 0) {
    enriched.readinessWarnings = context.readinessWarnings;
  }

  return enriched;
}

export async function enrichSelectionsWithIntent(matchIds: string[]): Promise<void> {
  const intentMap = await getMatchIntentMap(matchIds);
  if (intentMap.size === 0) return;

  const selections = await db.selection.findMany({
    where: {
      matchId: { in: matchIds },
      status: "DRAFT",
    },
    select: {
      id: true,
      matchId: true,
      explanation: true,
    },
  });

  for (const selection of selections) {
    const intentCategory = intentMap.get(selection.matchId);
    if (!intentCategory) continue;

    const existingExplanation = selection.explanation as Record<string, unknown> | null;
    if (!existingExplanation) continue;

    const enriched = enrichExplanation(existingExplanation, {
      coachingIntentCategory: intentCategory,
    });

    if (JSON.stringify(enriched) !== JSON.stringify(existingExplanation)) {
      await db.selection.update({
        where: { id: selection.id },
        data: { explanation: enriched as unknown as Prisma.InputJsonValue },
      });
    }
  }
}