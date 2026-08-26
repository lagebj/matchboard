import type { RatingAttributeKey } from "@/lib/ratings/player-rating";
import type {
  FootballObservationCode,
  ObservationPolarity,
  EvidenceClass,
} from "./observation-vocabulary";
import { MAPPING_VERSION } from "./observation-mapping";

export const EVIDENCE_ENGINE_VERSION = "1.0.0";

export type EvidenceSource =
  | "HUMAN_OBSERVATION"
  | "MATCH_FACT"
  | "OPPONENT_CONTEXT"
  | "POSITION_USAGE"
  | "MANUAL_REBASE";

export type EvidenceProvenance = {
  sourceType: EvidenceSource;
  observationCode: FootballObservationCode | null;
  matchId: string;
  matchSeconds: number | null;
  playerId: string;
  targetAttributeKey: RatingAttributeKey;
  targetGoalkeeper: boolean;
  evidenceClass: EvidenceClass;
  polarity: ObservationPolarity;
  mappingVersion: string;
  engineVersion: string;
  occurredAt: Date;
  extractedAt: Date;
  extractedById: string;
};

export type ExtractedEvidence = EvidenceProvenance & {
  id: string;
  weight: number;
  confidence: number;
  rebasedAt: Date | null;
  consumedAt: Date | null;
};

export type EvidenceAccumulator = {
  playerId: string;
  attributeKey: RatingAttributeKey;
  targetGoalkeeper: boolean;
  positiveDirect: number;
  positiveSupporting: number;
  negativeDirect: number;
  negativeSupporting: number;
  distinctMatchCount: number;
  evidenceIds: string[];
  earliestAt: Date | null;
  latestAt: Date | null;
  engineVersion: string;
  mappingVersion: string;
};

export function createAccumulator(
  playerId: string,
  attributeKey: RatingAttributeKey,
  targetGoalkeeper: boolean,
): EvidenceAccumulator {
  return {
    playerId,
    attributeKey,
    targetGoalkeeper,
    positiveDirect: 0,
    positiveSupporting: 0,
    negativeDirect: 0,
    negativeSupporting: 0,
    distinctMatchCount: 0,
    evidenceIds: [],
    earliestAt: null,
    latestAt: null,
    engineVersion: EVIDENCE_ENGINE_VERSION,
    mappingVersion: MAPPING_VERSION,
  };
}

export function accumulateEvidence(
  accumulator: EvidenceAccumulator,
  evidence: ExtractedEvidence,
): EvidenceAccumulator {
  if (evidence.rebasedAt || evidence.consumedAt) {
    return accumulator;
  }

  const isPositive = evidence.polarity === "POSITIVE";
  const isDirect = evidence.evidenceClass === "DIRECT";

  if (isPositive && isDirect) {
    accumulator.positiveDirect += evidence.weight;
  } else if (isPositive && !isDirect) {
    accumulator.positiveSupporting += evidence.weight;
  } else if (!isPositive && isDirect) {
    accumulator.negativeDirect += evidence.weight;
  } else {
    accumulator.negativeSupporting += evidence.weight;
  }

  accumulator.evidenceIds.push(evidence.id);

  const occurredAt = evidence.occurredAt;
  if (!accumulator.earliestAt || occurredAt < accumulator.earliestAt) {
    accumulator.earliestAt = occurredAt;
  }
  if (!accumulator.latestAt || occurredAt > accumulator.latestAt) {
    accumulator.latestAt = occurredAt;
  }

  return accumulator;
}

export function computeDistinctMatchCount(
  evidence: ExtractedEvidence[],
): number {
  const matchIds = new Set(
    evidence.filter((e) => !e.rebasedAt && !e.consumedAt).map((e) => e.matchId),
  );
  return matchIds.size;
}

export type AssessmentDirection = "INCREASE" | "DECREASE" | "NO_CHANGE";

export type AssessmentProposal = {
  playerId: string;
  attributeKey: RatingAttributeKey;
  direction: AssessmentDirection;
  magnitude: number;
  confidence: number;
  accumulator: EvidenceAccumulator;
  currentValue: number | null;
  proposedValue: number | null;
};

export const POSITIVE_THRESHOLD = 3;
export const NEGATIVE_THRESHOLD = 3;
export const MINIMUM_DISTINCT_MATCHES = 2;
export const MAX_CHANGE_PER_STEP = 1;
export const MIN_RATING = 1;
export const MAX_RATING = 10;

export function computeAssessmentProposal(
  accumulator: EvidenceAccumulator,
  currentValue: number | null,
  cutoverAt: Date | null,
  _now?: Date,
): AssessmentProposal | null {
  if (cutoverAt && accumulator.earliestAt && accumulator.earliestAt < cutoverAt) {
    return null;
  }

  if (currentValue === null) {
    return null;
  }

  const positiveWeight = accumulator.positiveDirect + accumulator.positiveSupporting * 0.5;
  const negativeWeight = accumulator.negativeDirect + accumulator.negativeSupporting * 0.5;

  let direction: AssessmentDirection;
  let netWeight: number;

  if (positiveWeight > negativeWeight && accumulator.positiveDirect >= POSITIVE_THRESHOLD) {
    direction = "INCREASE";
    netWeight = positiveWeight - negativeWeight;
  } else if (negativeWeight > positiveWeight && accumulator.negativeDirect >= NEGATIVE_THRESHOLD) {
    direction = "DECREASE";
    netWeight = negativeWeight - positiveWeight;
  } else {
    return {
      playerId: accumulator.playerId,
      attributeKey: accumulator.attributeKey,
      direction: "NO_CHANGE",
      magnitude: 0,
      confidence: computeConfidence(positiveWeight, negativeWeight),
      accumulator,
      currentValue,
      proposedValue: currentValue,
    };
  }

  if (accumulator.distinctMatchCount < MINIMUM_DISTINCT_MATCHES) {
    return {
      playerId: accumulator.playerId,
      attributeKey: accumulator.attributeKey,
      direction: "NO_CHANGE",
      magnitude: 0,
      confidence: computeConfidence(positiveWeight, negativeWeight),
      accumulator,
      currentValue,
      proposedValue: currentValue,
    };
  }

  const magnitude = Math.min(MAX_CHANGE_PER_STEP, Math.round(netWeight));

  const proposedValue =
    direction === "INCREASE"
      ? Math.min(MAX_RATING, currentValue + magnitude)
      : Math.max(MIN_RATING, currentValue - magnitude);

  if (proposedValue === currentValue) {
    return {
      playerId: accumulator.playerId,
      attributeKey: accumulator.attributeKey,
      direction: "NO_CHANGE",
      magnitude: 0,
      confidence: computeConfidence(positiveWeight, negativeWeight),
      accumulator,
      currentValue,
      proposedValue: currentValue,
    };
  }

  return {
    playerId: accumulator.playerId,
    attributeKey: accumulator.attributeKey,
    direction,
    magnitude,
    confidence: computeConfidence(positiveWeight, negativeWeight),
    accumulator,
    currentValue,
    proposedValue,
  };
}

function computeConfidence(
  positiveWeight: number,
  negativeWeight: number,
): number {
  const total = positiveWeight + negativeWeight;
  if (total === 0) return 0;

  const alignment = Math.abs(positiveWeight - negativeWeight) / total;
  if (alignment >= 0.8 && total >= 5) return 0.9;
  if (alignment >= 0.6 && total >= 3) return 0.7;
  if (alignment >= 0.4) return 0.5;
  return 0.3;
}