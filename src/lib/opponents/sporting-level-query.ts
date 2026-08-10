import { db } from "@/lib/db";
import { type OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { getOpponentSportingEvidence } from "@/lib/opponents/sporting-level-recording";
import { aggregateSportingLevel } from "@/lib/opponents/sporting-level-aggregation";
import {
  type OpponentSportingEstimate,
  type OpponentEncounterAssessment,
  buildOpponentEstimate,
} from "@/lib/opponent/opponent-estimate";

export async function getOpponentSportingEstimate(
  opponentTeamId: string,
  orgFilter: OrgFilterMode,
  targetGameFormat: string | null = null,
): Promise<OpponentSportingEstimate | null> {
  if (orgFilter.type !== "org") return null;

  const evidence = await getOpponentSportingEvidence(opponentTeamId, orgFilter);

  const aggregate = aggregateSportingLevel(
    evidence as Parameters<typeof aggregateSportingLevel>[0],
    new Date(),
    targetGameFormat,
  );

  if (!aggregate) return null;

  const assessments: OpponentEncounterAssessment[] = evidence
    .filter((e) => !e.excludedAt)
    .map((e) => ({
      sportingLevel: Number(e.estimate),
      gameFormat: e.gameFormat,
      matchDate: e.occurredAt,
      matchId: e.matchId,
    }));

  const estimate = buildOpponentEstimate(opponentTeamId, assessments, targetGameFormat);

  return {
    ...estimate,
    estimatedLevel: aggregate.estimatedLevel,
    confidence: aggregate.confidence === "unknown" ? "unknown" : aggregate.confidence,
    assessmentCount: aggregate.validEncounterCount,
    lastAssessedDate: aggregate.lastEncounterDate,
  };
}

export async function getOpponentSportingEstimatesForMatches(
  matchIds: string[],
  orgFilter: OrgFilterMode,
): Promise<Map<string, OpponentSportingEstimate>> {
  const result = new Map<string, OpponentSportingEstimate>();

  if (orgFilter.type !== "org" || matchIds.length === 0) return result;

  const matches = await db.match.findMany({
    where: {
      id: { in: matchIds },
      ...orgFilter.filter,
    },
    select: {
      id: true,
      opponentTeamId: true,
      gameFormat: true,
    },
  });

  const opponentTeamIds = [...new Set(matches.map((m) => m.opponentTeamId).filter(Boolean) as string[])];

  for (const teamId of opponentTeamIds) {
    const match = matches.find((m) => m.opponentTeamId === teamId);
    const gameFormat = match?.gameFormat ?? null;
    const estimate = await getOpponentSportingEstimate(teamId, orgFilter, gameFormat);
    if (estimate) {
      result.set(teamId, estimate);
    }
  }

  return result;
}