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
import { getDirectTargets, getSupportingTargets, MAPPING_VERSION } from "./observation-mapping";
import type { FootballObservationCode, ObservationPolarity } from "./observation-vocabulary";
import { ALL_OBSERVATION_CODES } from "./observation-vocabulary";
import { type RatingAttributeKey } from "@/lib/ratings/player-rating";
import { recordAssessmentChange } from "./assessment-change";
import { footballMatchRefSourceId, type FootballMatchRef } from "./football-match-ref";

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

export type PositionEvidenceMapping = {
  position: string;
  attributeKey: RatingAttributeKey;
  weight: number;
};

const POSITION_ATTRIBUTE_MAPPINGS: PositionEvidenceMapping[] = [
  { position: "GK", attributeKey: "concentration", weight: 0.4 },
  { position: "GK", attributeKey: "positioning", weight: 0.3 },
  { position: "CB", attributeKey: "positioning", weight: 0.4 },
  { position: "CB", attributeKey: "oneVOneDefending", weight: 0.3 },
  { position: "LB", attributeKey: "positioning", weight: 0.3 },
  { position: "LB", attributeKey: "speed", weight: 0.3 },
  { position: "RB", attributeKey: "positioning", weight: 0.3 },
  { position: "RB", attributeKey: "speed", weight: 0.3 },
  { position: "CM", attributeKey: "decisionMaking", weight: 0.4 },
  { position: "CM", attributeKey: "passing", weight: 0.3 },
  { position: "CDM", attributeKey: "positioning", weight: 0.4 },
  { position: "CDM", attributeKey: "oneVOneDefending", weight: 0.3 },
  { position: "CAM", attributeKey: "decisionMaking", weight: 0.3 },
  { position: "CAM", attributeKey: "oneVOneAttacking", weight: 0.3 },
  { position: "LM", attributeKey: "passing", weight: 0.3 },
  { position: "LM", attributeKey: "speed", weight: 0.3 },
  { position: "RM", attributeKey: "passing", weight: 0.3 },
  { position: "RM", attributeKey: "speed", weight: 0.3 },
  { position: "LW", attributeKey: "oneVOneAttacking", weight: 0.3 },
  { position: "LW", attributeKey: "speed", weight: 0.3 },
  { position: "RW", attributeKey: "oneVOneAttacking", weight: 0.3 },
  { position: "RW", attributeKey: "speed", weight: 0.3 },
  { position: "ST", attributeKey: "oneVOneAttacking", weight: 0.4 },
  { position: "ST", attributeKey: "positioning", weight: 0.2 },
  { position: "CF", attributeKey: "oneVOneAttacking", weight: 0.4 },
  { position: "CF", attributeKey: "firstTouch", weight: 0.3 },
];

export type PlayerEvidenceInput = {
  playerId: string;
  organisationId: string;
  observations: MatchObservationEvidence[];
  context?: MatchContextEvidence;
  currentPlayerAttributes: Record<RatingAttributeKey, number | null>;
  goalkeeperAbility: string;
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

function extractPositionEvidence(
  context: MatchContextEvidence,
): ExtractedEvidence[] {
  const evidence: ExtractedEvidence[] = [];
  if (!context.position) return evidence;

  const now = new Date();
  const positionUpper = context.position.toUpperCase();

  const mappings = POSITION_ATTRIBUTE_MAPPINGS.filter(
    (m) => m.position === positionUpper,
  );

  for (const mapping of mappings) {
    evidence.push({
      id: `pos-${context.matchId}-${context.position}-${mapping.attributeKey}-CONTEXT`,
      sourceType: "POSITION_USAGE",
      observationCode: null,
      matchId: context.matchId,
      matchSeconds: null,
      playerId: context.playerId,
      targetAttributeKey: mapping.attributeKey,
      targetGoalkeeper: false,
      evidenceClass: "SUPPORTING",
      polarity: "POSITIVE",
      mappingVersion: MAPPING_VERSION,
      engineVersion: EVIDENCE_ENGINE_VERSION,
      occurredAt: context.occurredAt,
      extractedAt: now,
      extractedById: "evidence-engine",
      weight: mapping.weight,
      confidence: 0.2,
      rebasedAt: null,
      consumedAt: null,
    });
  }

  return evidence;
}

export type GoalkeeperAssessmentProposal = {
  playerId: string;
  direction: "PROMOTE" | "DEMOTE" | "NO_CHANGE";
  currentValue: "NO" | "EMERGENCY" | "YES";
  proposedValue: "NO" | "EMERGENCY" | "YES";
  positiveObservations: number;
  negativeObservations: number;
  distinctMatchCount: number;
  confidence: number;
};

function computeGoalkeeperProposal(
  playerId: string,
  observations: MatchObservationEvidence[],
  currentValue: string,
  cutoverAt: Date | null,
): GoalkeeperAssessmentProposal | null {
  const gkObs = observations.filter(
    (o) => o.observationCode === "GOALKEEPING_EFFECTIVE" && o.playerId === playerId,
  );

  if (gkObs.length === 0) return null;

  const earliestAt = gkObs.reduce(
    (min, o) => (!min || o.occurredAt < min ? o.occurredAt : min),
    gkObs[0].occurredAt,
  );

  if (cutoverAt && earliestAt < cutoverAt) return null;

  const positiveCount = gkObs.filter((o) => o.polarity === "POSITIVE").length;
  const negativeCount = gkObs.filter((o) => o.polarity === "NEGATIVE").length;
  const distinctMatches = new Set(gkObs.map((o) => o.matchId)).size;

  const gkValue = currentValue as "NO" | "EMERGENCY" | "YES";

  if (positiveCount >= 3 && distinctMatches >= 2) {
    if (gkValue === "NO") {
      return {
        playerId,
        direction: "PROMOTE",
        currentValue: gkValue,
        proposedValue: "EMERGENCY",
        positiveObservations: positiveCount,
        negativeObservations: negativeCount,
        distinctMatchCount: distinctMatches,
        confidence: 0.7,
      };
    }
    if (gkValue === "EMERGENCY") {
      return {
        playerId,
        direction: "PROMOTE",
        currentValue: gkValue,
        proposedValue: "YES",
        positiveObservations: positiveCount,
        negativeObservations: negativeCount,
        distinctMatchCount: distinctMatches,
        confidence: 0.7,
      };
    }
  }

  if (negativeCount >= 3 && distinctMatches >= 2) {
    if (gkValue === "YES") {
      return {
        playerId,
        direction: "DEMOTE",
        currentValue: gkValue,
        proposedValue: "EMERGENCY",
        positiveObservations: positiveCount,
        negativeObservations: negativeCount,
        distinctMatchCount: distinctMatches,
        confidence: 0.7,
      };
    }
    if (gkValue === "EMERGENCY") {
      return {
        playerId,
        direction: "DEMOTE",
        currentValue: gkValue,
        proposedValue: "NO",
        positiveObservations: positiveCount,
        negativeObservations: negativeCount,
        distinctMatchCount: distinctMatches,
        confidence: 0.7,
      };
    }
  }

  return {
    playerId,
    direction: "NO_CHANGE",
    currentValue: gkValue,
    proposedValue: gkValue,
    positiveObservations: positiveCount,
    negativeObservations: negativeCount,
    distinctMatchCount: distinctMatches,
    confidence: 0.3,
  };
}

export type PlayerAssessmentResult = {
  attributeProposals: AssessmentProposal[];
  goalkeeperProposal: GoalkeeperAssessmentProposal | null;
};

export function computePlayerAssessmentProposals(
  input: PlayerEvidenceInput,
): PlayerAssessmentResult {
  const { playerId, observations, context, currentPlayerAttributes, goalkeeperAbility, cutoverAt } = input;

  const attributeProposals: AssessmentProposal[] = [];

  const observationEvidence = extractObservationEvidence(observations, playerId);
  const contextEvidence = context ? extractContextEvidence(context) : [];
  const positionEvidence = context ? extractPositionEvidence(context) : [];

  const allEvidence = [...observationEvidence, ...contextEvidence, ...positionEvidence];

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
      attributeProposals.push(proposal);
    }
  }

  const goalkeeperProposal = computeGoalkeeperProposal(
    playerId,
    observations,
    goalkeeperAbility,
    cutoverAt,
  );

  return { attributeProposals, goalkeeperProposal };
}

export async function applyPlayerAssessmentProposals(
  proposals: AssessmentProposal[],
  _organisationId: string,
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

export async function computeAndApplyPlayerEvidenceForMatch(
  ref: FootballMatchRef,
  orgFilter?: { filter: Record<string, unknown> },
): Promise<{ proposalsComputed: number; applied: number; skipped: number; errors: string[]; observationsFound: number }> {
  const sourceId = footballMatchRefSourceId(ref);
  const matchWhere = ref.kind === "LEAGUE_MATCH" ? { matchId: ref.matchId } : { eventMatchId: ref.eventMatchId };

  const observations = await db.playerDevelopmentObservation.findMany({
    where: {
      ...matchWhere,
      kind: "ATTRIBUTE",
      attributeKey: { in: [...ALL_OBSERVATION_CODES] },
      ...(orgFilter?.filter ?? {}),
    },
    select: {
      id: true,
      playerId: true,
      attributeKey: true,
      direction: true,
      observedAt: true,
    },
  });

  if (observations.length === 0) {
    return { proposalsComputed: 0, applied: 0, skipped: 0, errors: [], observationsFound: 0 };
  }

  const playerIds = [...new Set(observations.map((o) => o.playerId))];

  const matchExists =
    ref.kind === "LEAGUE_MATCH"
      ? await db.match.findUnique({ where: { id: ref.matchId }, select: { id: true } })
      : await db.eventMatch.findUnique({ where: { id: ref.eventMatchId }, select: { id: true } });

  if (!matchExists) {
    return { proposalsComputed: 0, applied: 0, skipped: 0, errors: ["Match not found"], observationsFound: observations.length };
  }

  const players = await db.player.findMany({
    where: {
      id: { in: playerIds },
      active: true,
      removedAt: null,
    },
    select: {
      id: true,
      ballControl: true,
      passing: true,
      firstTouch: true,
      oneVOneAttacking: true,
      positioning: true,
      oneVOneDefending: true,
      decisionMaking: true,
      effort: true,
      teamplay: true,
      concentration: true,
      speed: true,
      strength: true,
      goalkeeperAbility: true,
      evidenceCutoverAt: true,
      organisationId: true,
    },
  });

  const playerMap = new Map(players.map((p) => [p.id, p]));
  let totalProposals = 0;
  let totalApplied = 0;
  let totalSkipped = 0;
  const allErrors: string[] = [];

  for (const playerId of playerIds) {
    const player = playerMap.get(playerId);
    if (!player) continue;

    const playerObservations: MatchObservationEvidence[] = observations
      .filter((o) => o.playerId === playerId)
      .map((o) => ({
        playerId: o.playerId,
        observationCode: o.attributeKey as FootballObservationCode,
        polarity: o.direction as ObservationPolarity,
        matchId: sourceId,
        occurredAt: o.observedAt,
      }));

    const currentPlayerAttributes: Record<RatingAttributeKey, number | null> = {
      ballControl: player.ballControl,
      passing: player.passing,
      firstTouch: player.firstTouch,
      oneVOneAttacking: player.oneVOneAttacking,
      positioning: player.positioning,
      oneVOneDefending: player.oneVOneDefending,
      decisionMaking: player.decisionMaking,
      effort: player.effort,
      teamplay: player.teamplay,
      concentration: player.concentration,
      speed: player.speed,
      strength: player.strength,
    };

    const input: PlayerEvidenceInput = {
      playerId,
      organisationId: player.organisationId,
      observations: playerObservations,
      currentPlayerAttributes,
      goalkeeperAbility: player.goalkeeperAbility,
      cutoverAt: player.evidenceCutoverAt,
    };

    const result = computePlayerAssessmentProposals(input);
    totalProposals += result.attributeProposals.length;

    if (result.attributeProposals.length > 0) {
      const applyResult = await applyPlayerAssessmentProposals(result.attributeProposals, player.organisationId);
      totalApplied += applyResult.applied;
      totalSkipped += applyResult.skipped;
      allErrors.push(...applyResult.errors);
    }

    if (result.goalkeeperProposal && result.goalkeeperProposal.direction !== "NO_CHANGE") {
      try {
        await db.player.update({
          where: { id: playerId },
          data: { goalkeeperAbility: result.goalkeeperProposal.proposedValue },
        });

        await recordAssessmentChange({
          playerId,
          targetType: "GOALKEEPER",
          attributeKey: null,
          targetDescription: `Automatic ${result.goalkeeperProposal.direction.toLowerCase()}: goalkeeperAbility`,
          beforeValue: null,
          afterValue: null,
          source: "AUTOMATIC",
          reason: `${result.goalkeeperProposal.direction.toLowerCase()} from ${result.goalkeeperProposal.currentValue} to ${result.goalkeeperProposal.proposedValue} (${result.goalkeeperProposal.positiveObservations} positive, ${result.goalkeeperProposal.negativeObservations} negative observations across ${result.goalkeeperProposal.distinctMatchCount} matches)`,
          evidenceIds: [],
          confidence: result.goalkeeperProposal.confidence,
          cutoverAt: null,
        });

        totalApplied++;
      } catch (error) {
        allErrors.push(`Failed to apply goalkeeperAbility for ${playerId}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
  }

  return {
    proposalsComputed: totalProposals,
    applied: totalApplied,
    skipped: totalSkipped,
    errors: allErrors,
    observationsFound: observations.length,
  };
}