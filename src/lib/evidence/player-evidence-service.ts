import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import {
  createAccumulator,
  accumulateEvidence,
  computeAssessmentProposal,
  computeDistinctMatchCount,
  EVIDENCE_ENGINE_VERSION,
  type ExtractedEvidence,
  type AssessmentProposal,
} from "./evidence-accumulator";
import { getEvidenceTargets, getDirectTargets, getSupportingTargets, MAPPING_VERSION } from "./observation-mapping";
import type { FootballObservationCode, ObservationPolarity } from "./observation-vocabulary";
import { ALL_OBSERVATION_CODES } from "./observation-vocabulary";
import { getPlayerOverallRating, type RatingAttributeKey } from "@/lib/ratings/player-rating";
import { recordAssessmentChange } from "./assessment-change";
import { RATING_ATTRIBUTE_KEYS } from "@/lib/player-development/constants";

export type MatchObservationEvidence = {
  playerId: string;
  observationCode: FootballObservationCode;
  polarity: ObservationPolarity;
  matchId: string;
  occurredAt: Date;
};

export type MatchContextEvidence = {
  playerId: string;
  matchId: string;
  goals: number;
  assists: number;
  minutesPlayed: number | null;
  position: string | null;
  opponentRating: number | null;
  isWin: boolean;
  isLoss: boolean;
  occurredAt: Date;
};

export type PlayerEvidenceInput = {
  playerId: string;
  organisationId: string;
  observations: MatchObservationEvidence[];
  context?: MatchContextEvidence;
  currentPlayerAttributes: Record<RatingAttributeKey, number | null>;
  cutoverAt: Date | null;
};

function extractObservationEvidence(
  observations: MatchObservationEvidence[],
  playerId: string,
): ExtractedEvidence[] {
  const evidence: ExtractedEvidence[] = [];
  const now = new Date();

  for (const obs of observations) {
    if (obs.playerId !== playerId) continue;

    const directTargets = getDirectTargets(obs.observationCode);
    const supportingTargets = getSupportingTargets(obs.observationCode);

    for (const target of directTargets) {
      evidence.push({
        id: `obs-${obs.matchId}-${obs.observationCode}-${target}-DIRECT`,
        sourceType: "HUMAN_OBSERVATION",
        observationCode: obs.observationCode,
        matchId: obs.matchId,
        matchSeconds: null,
        playerId: obs.playerId,
        targetAttributeKey: target,
        targetGoalkeeper: false,
        evidenceClass: "DIRECT",
        polarity: obs.polarity,
        mappingVersion: MAPPING_VERSION,
        engineVersion: EVIDENCE_ENGINE_VERSION,
        occurredAt: obs.occurredAt,
        extractedAt: now,
        extractedById: "evidence-engine",
        weight: 1,
        confidence: 0.8,
        rebasedAt: null,
        consumedAt: null,
      });
    }

    for (const target of supportingTargets) {
      evidence.push({
        id: `obs-${obs.matchId}-${obs.observationCode}-${target}-SUPPORTING`,
        sourceType: "HUMAN_OBSERVATION",
        observationCode: obs.observationCode,
        matchId: obs.matchId,
        matchSeconds: null,
        playerId: obs.playerId,
        targetAttributeKey: target,
        targetGoalkeeper: false,
        evidenceClass: "SUPPORTING",
        polarity: obs.polarity,
        mappingVersion: MAPPING_VERSION,
        engineVersion: EVIDENCE_ENGINE_VERSION,
        occurredAt: obs.occurredAt,
        extractedAt: now,
        extractedById: "evidence-engine",
        weight: 0.5,
        confidence: 0.5,
        rebasedAt: null,
        consumedAt: null,
      });
    }
  }

  return evidence;
}

function extractContextEvidence(
  context: MatchContextEvidence,
): ExtractedEvidence[] {
  const evidence: ExtractedEvidence[] = [];
  const now = new Date();

  if (context.goals > 0) {
    evidence.push({
      id: `ctx-${context.matchId}-goals-SUPPORTING`,
      sourceType: "MATCH_FACT",
      observationCode: null,
      matchId: context.matchId,
      matchSeconds: null,
      playerId: context.playerId,
      targetAttributeKey: "teamplay",
      targetGoalkeeper: false,
      evidenceClass: "SUPPORTING",
      polarity: "POSITIVE",
      mappingVersion: MAPPING_VERSION,
      engineVersion: EVIDENCE_ENGINE_VERSION,
      occurredAt: context.occurredAt,
      extractedAt: now,
      extractedById: "evidence-engine",
      weight: Math.min(context.goals * 0.3, 1.0),
      confidence: 0.3,
      rebasedAt: null,
      consumedAt: null,
    });
  }

  if (context.assists > 0) {
    evidence.push({
      id: `ctx-${context.matchId}-assists-SUPPORTING`,
      sourceType: "MATCH_FACT",
      observationCode: null,
      matchId: context.matchId,
      matchSeconds: null,
      playerId: context.playerId,
      targetAttributeKey: "passing",
      targetGoalkeeper: false,
      evidenceClass: "SUPPORTING",
      polarity: "POSITIVE",
      mappingVersion: MAPPING_VERSION,
      engineVersion: EVIDENCE_ENGINE_VERSION,
      occurredAt: context.occurredAt,
      extractedAt: now,
      extractedById: "evidence-engine",
      weight: Math.min(context.assists * 0.3, 1.0),
      confidence: 0.3,
      rebasedAt: null,
      consumedAt: null,
    });
  }

  return evidence;
}

export function computePlayerAssessmentProposals(
  input: PlayerEvidenceInput,
): AssessmentProposal[] {
  const { playerId, observations, context, currentPlayerAttributes, cutoverAt } = input;

  const proposals: AssessmentProposal[] = [];

  const observationEvidence = extractObservationEvidence(observations, playerId);
  const contextEvidence = context ? extractContextEvidence(context) : [];

  const allEvidence = [...observationEvidence, ...contextEvidence];

  const affectedAttributes = new Set<RatingAttributeKey>();
  for (const e of allEvidence) {
    affectedAttributes.add(e.targetAttributeKey);
  }

  for (const attributeKey of affectedAttributes) {
    const currentValue = currentPlayerAttributes[attributeKey];

    if (currentValue === null) continue;

    const acc = createAccumulator(playerId, attributeKey, false);

    for (const e of allEvidence) {
      if (e.targetAttributeKey === attributeKey) {
        accumulateEvidence(acc, e);
      }
    }

    acc.distinctMatchCount = computeDistinctMatchCount(
      allEvidence.filter((e) => e.targetAttributeKey === attributeKey),
    );

    const proposal = computeAssessmentProposal(acc, currentValue, cutoverAt);
    if (proposal) {
      proposals.push(proposal);
    }
  }

  return proposals;
}

export async function applyPlayerAssessmentProposals(
  proposals: AssessmentProposal[],
  organisationId: string,
): Promise<{ applied: number; skipped: number; errors: string[] }> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

  let applied = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const proposal of proposals) {
    if (proposal.direction === "NO_CHANGE" || proposal.proposedValue === null || proposal.currentValue === null) {
      skipped++;
      continue;
    }

    if (proposal.proposedValue === proposal.currentValue) {
      skipped++;
      continue;
    }

    try {
      await db.player.update({
        where: { id: proposal.playerId },
        data: { [proposal.attributeKey]: proposal.proposedValue },
      });

      await recordAssessmentChange({
        playerId: proposal.playerId,
        targetType: "ATTRIBUTE",
        attributeKey: proposal.attributeKey,
        targetDescription: `Automatic ${proposal.direction.toLowerCase()}: ${proposal.attributeKey}`,
        beforeValue: proposal.currentValue,
        afterValue: proposal.proposedValue,
        source: "AUTOMATIC",
        reason: `${proposal.direction.toLowerCase()} from ${proposal.currentValue} to ${proposal.proposedValue} (${proposal.accumulator.positiveDirect + proposal.accumulator.positiveSupporting} positive, ${proposal.accumulator.negativeDirect + proposal.accumulator.negativeSupporting} negative evidence across ${proposal.accumulator.distinctMatchCount} matches)`,
        evidenceIds: proposal.accumulator.evidenceIds,
        confidence: proposal.confidence,
        cutoverAt: null,
      });

      applied++;
    } catch (error) {
      errors.push(`Failed to apply ${proposal.attributeKey} for ${proposal.playerId}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  return { applied, skipped, errors };
}