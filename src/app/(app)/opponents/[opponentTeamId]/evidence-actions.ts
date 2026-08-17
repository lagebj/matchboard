import { requireActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import {
  excludeOpponentSportingEvidence as excludeEvidence,
  includeOpponentSportingEvidence as includeEvidence,
  getOpponentSportingEvidence as getEvidence,
} from "@/lib/opponents/sporting-level-recording";
import { aggregateSportingLevel } from "@/lib/opponents/sporting-level-aggregation";

export async function excludeSportingEvidenceAction(
  evidenceId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  return excludeEvidence(evidenceId, reason, ctx.orgFilter);
}

export async function includeSportingEvidenceAction(
  evidenceId: string,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  return includeEvidence(evidenceId, ctx.orgFilter);
}

export async function getOpponentSportingLevelAction(
  opponentTeamId: string,
): Promise<{
  aggregate: {
    estimatedLevel: number;
    confidence: string;
    validEncounterCount: number;
    lastEncounterDate: string | null;
    gameFormat: string | null;
  } | null;
  evidence: Array<{
    id: string;
    matchId: string;
    occurredAt: string;
    gameFormat: string | null;
    goalsFor: number;
    goalsAgainst: number;
    fieldedRatingSnapshot: number | null;
    estimate: number;
    excludedAt: string | null;
    exclusionReason: string | null;
    weightingMethod: string;
    formulaVersion: string;
  }>;
}> {
  const ctx = await requireActorContext();

  const evidenceRecords = await getEvidence(opponentTeamId, ctx.orgFilter);

  const aggregate = aggregateSportingLevel(evidenceRecords as Parameters<typeof aggregateSportingLevel>[0]);

  const evidence = evidenceRecords.map((e) => ({
    id: e.id,
    matchId: e.matchId,
    occurredAt: e.occurredAt.toISOString(),
    gameFormat: e.gameFormat,
    goalsFor: e.goalsFor,
    goalsAgainst: e.goalsAgainst,
    fieldedRatingSnapshot: e.fieldedRatingSnapshot ? Number(e.fieldedRatingSnapshot) : null,
    estimate: Number(e.estimate),
    excludedAt: e.excludedAt ? e.excludedAt.toISOString() : null,
    exclusionReason: e.exclusionReason,
    weightingMethod: e.weightingMethod,
    formulaVersion: e.formulaVersion,
  }));

  return {
    aggregate: aggregate
      ? {
          estimatedLevel: aggregate.estimatedLevel,
          confidence: aggregate.confidence,
          validEncounterCount: aggregate.validEncounterCount,
          lastEncounterDate: aggregate.lastEncounterDate?.toISOString() ?? null,
          gameFormat: aggregate.gameFormat,
        }
      : null,
    evidence,
  };
}