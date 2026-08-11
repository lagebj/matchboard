import { db } from "@/lib/db";
import type { GeneratedRound } from "@/lib/selection/types";
import type { CoachingIntentCategory, MatchdayResponsibilityType } from "@/lib/coaching/types";

type PersistableExplanation = {
  scopeType: "ROUND" | "MATCH" | "TEAM" | "PLAYER";
  scopeId: string;
  matchId?: string;
  teamId?: string;
  playerId?: string;
  summary: string;
  rulesApplied: Array<{ code: string; summary: string; hardRule?: boolean }>;
  blockers: Array<{ code: string; summary: string }>;
  warnings: Array<{ code: string; message: string; severity?: string }>;
  recommendations: Array<{ summary: string }>;
  crossTeamImpacts: Array<{ description: string }>;
  coachingIntentCategory?: CoachingIntentCategory;
  matchdayResponsibility?: MatchdayResponsibilityType;
};

function buildMatchExplanation(
  matchResult: GeneratedRound["matchResults"][number],
): PersistableExplanation {
  const rulesApplied: PersistableExplanation["rulesApplied"] = [];
  const blockers: PersistableExplanation["blockers"] = [];
  const warnings: PersistableExplanation["warnings"] = [];
  const recommendations: PersistableExplanation["recommendations"] = [];

  for (const player of matchResult.selectedPlayers) {
    for (const exp of player.explanations) {
      rulesApplied.push({ code: exp.code, summary: exp.summary, hardRule: exp.hardRule });
      if (exp.hardRule) {
        blockers.push({ code: exp.code, summary: exp.summary });
      }
    }
  }

  for (const warning of matchResult.warnings) {
    warnings.push({
      code: warning.code,
      message: warning.message,
      severity: warning.severity,
    });
  }

  return {
    scopeType: "MATCH",
    scopeId: matchResult.matchId,
    matchId: matchResult.matchId,
    teamId: matchResult.teamId,
    summary: `${matchResult.selectedPlayers.length} players selected for ${matchResult.teamName}`,
    rulesApplied,
    blockers,
    warnings,
    recommendations,
    crossTeamImpacts: [],
  };
}

function buildPlayerExplanations(
  matchResult: GeneratedRound["matchResults"][number],
): PersistableExplanation[] {
  return matchResult.selectedPlayers.map((player) => ({
    scopeType: "PLAYER" as const,
    scopeId: player.playerId,
    matchId: matchResult.matchId,
    teamId: matchResult.teamId,
    playerId: player.playerId,
    summary: player.selectionReason,
    rulesApplied: player.explanations.map((exp) => ({
      code: exp.code,
      summary: exp.summary,
      hardRule: exp.hardRule,
    })),
    blockers: player.explanations
      .filter((exp) => exp.hardRule)
      .map((exp) => ({ code: exp.code, summary: exp.summary })),
    warnings: [],
    recommendations: [],
    crossTeamImpacts: [],
  }));
}

export function buildPersistableExplanations(
  generatedRound: GeneratedRound,
): PersistableExplanation[] {
  const explanations: PersistableExplanation[] = [];

  const roundRulesApplied: PersistableExplanation["rulesApplied"] = [];
  const roundBlockers: PersistableExplanation["blockers"] = [];
  const roundWarnings: PersistableExplanation["warnings"] = [];

  for (const warning of generatedRound.roundWarnings) {
    roundWarnings.push({
      code: warning.code,
      message: warning.message,
      severity: warning.severity,
    });
  }

  for (const matchResult of generatedRound.matchResults) {
    const matchExplanation = buildMatchExplanation(matchResult);
    explanations.push(matchExplanation);
    explanations.push(...buildPlayerExplanations(matchResult));

    roundRulesApplied.push(...matchExplanation.rulesApplied);
    roundBlockers.push(...matchExplanation.blockers);
  }

  explanations.unshift({
    scopeType: "ROUND",
    scopeId: generatedRound.matchRoundId,
    summary: `Round with ${generatedRound.matchResults.length} matches`,
    rulesApplied: roundRulesApplied,
    blockers: roundBlockers,
    warnings: roundWarnings,
    recommendations: [],
    crossTeamImpacts: [],
  });

  return explanations;
}

export async function persistRoundExplanations(
  generatedRound: GeneratedRound,
  matchIntentMap?: Map<string, CoachingIntentCategory>,
): Promise<void> {
  const explanations = buildPersistableExplanations(generatedRound);
  if (explanations.length === 0) return;

  const matchRoundId = generatedRound.matchRoundId;

  const matchRound = await db.matchRound.findUnique({
    where: { id: matchRoundId },
    select: { organisationId: true },
  });
  const organisationId = matchRound?.organisationId;
  if (!organisationId) {
    throw new Error(`Match round ${matchRoundId} not found or missing organisationId.`);
  }

  if (matchIntentMap) {
    for (const explanation of explanations) {
      if (explanation.matchId && matchIntentMap.has(explanation.matchId)) {
        explanation.coachingIntentCategory = matchIntentMap.get(explanation.matchId);
      }
    }
  }

  await db.$transaction(async (tx) => {
    await tx.selectionExplanation.deleteMany({
      where: {
        scopeType: "ROUND",
        scopeId: matchRoundId,
      },
    });

    await tx.selectionExplanation.deleteMany({
      where: { scopeType: "MATCH", scopeId: { in: generatedRound.matchResults.map((m) => m.matchId) } },
    });

    for (const matchResult of generatedRound.matchResults) {
      await tx.selectionExplanation.deleteMany({
        where: { scopeType: "PLAYER", matchId: matchResult.matchId },
      });
    }

    for (const explanation of explanations) {
      await tx.selectionExplanation.create({
        data: {
          organisationId,
          scopeType: explanation.scopeType,
          scopeId: explanation.scopeId,
          matchId: explanation.matchId,
          teamId: explanation.teamId,
          playerId: explanation.playerId,
          summary: explanation.summary,
          rulesApplied: explanation.rulesApplied ?? [],
          blockers: explanation.blockers ?? [],
          warnings: explanation.warnings ?? [],
          recommendations: explanation.recommendations ?? [],
          crossTeamImpacts: explanation.crossTeamImpacts ?? [],
          coachingIntentCategory: explanation.coachingIntentCategory,
        },
      });
    }
  });
}