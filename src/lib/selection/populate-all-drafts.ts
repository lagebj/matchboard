import { db } from "@/lib/db";
import { generateMatchRound } from "@/lib/selection/generate-round";
import { createGeneratedDraftRound } from "@/lib/selection/save-generated-draft";
import { buildPersistableWarnings, persistRoundWarnings } from "@/lib/selection/persist-warnings";

export type PopulateAllResult = {
  planningPeriodId: string;
  results: PopulateRoundResult[];
  failedRoundIds: string[];
  skippedRoundIds: string[];
  totalRounds: number;
  generatedCount: number;
  failedCount: number;
  skippedCount: number;
};

export type PopulateRoundResult = {
  matchRoundId: string;
  matchRoundName: string;
  matchCount: number;
  warningCount: number;
  success: boolean;
  error?: string;
};

export async function populateAllDrafts(
  planningPeriodId: string,
): Promise<PopulateAllResult> {
  const planningPeriod = await db.planningPeriod.findUnique({
    where: { id: planningPeriodId },
    include: {
      matchRounds: {
        include: {
          matches: {
            include: {
              team: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!planningPeriod) {
    throw new Error("Planning period not found.");
  }

  const sortedRounds = [...planningPeriod.matchRounds].sort((a, b) => {
    const aEarliest = a.matches.length > 0 ? Math.min(...a.matches.map((m) => new Date(m.startsAt).getTime())) : 0;
    const bEarliest = b.matches.length > 0 ? Math.min(...b.matches.map((m) => new Date(m.startsAt).getTime())) : 0;
    return aEarliest - bEarliest;
  });

  const results: PopulateRoundResult[] = [];
  const failedRoundIds: string[] = [];
  const skippedRoundIds: string[] = [];

  for (const matchRound of sortedRounds) {
    if (matchRound.status === "FINALIZED") {
      skippedRoundIds.push(matchRound.id);
      continue;
    }

    try {
      const generatedRound = await generateMatchRound(matchRound.id);
      await createGeneratedDraftRound(generatedRound);

      const matchIdByTeamName = new Map<string, string>();
      const teamIdByTeamName = new Map<string, string>();
      for (const match of matchRound.matches) {
        matchIdByTeamName.set(match.team.name, match.id);
        teamIdByTeamName.set(match.team.name, match.team.id);
      }

      const warnings = buildPersistableWarnings(generatedRound, matchIdByTeamName, teamIdByTeamName);
      await persistRoundWarnings(warnings);

      results.push({
        matchRoundId: matchRound.id,
        matchRoundName: matchRound.name,
        matchCount: generatedRound.matchResults.length,
        warningCount: warnings.length,
        success: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      failedRoundIds.push(matchRound.id);
      results.push({
        matchRoundId: matchRound.id,
        matchRoundName: matchRound.name,
        matchCount: 0,
        warningCount: 0,
        success: false,
        error: errorMessage,
      });
    }
  }

  return {
    planningPeriodId,
    results,
    failedRoundIds,
    skippedRoundIds,
    totalRounds: planningPeriod.matchRounds.length,
    generatedCount: results.filter((r) => r.success).length,
    failedCount: failedRoundIds.length,
    skippedCount: skippedRoundIds.length,
  };
}