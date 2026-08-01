import { db } from "@/lib/db";
import { resolveOrgFilterForUser, type OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { type DevelopmentAttributeKey } from "./constants";

export type EvidenceConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface AttributeEvidenceResult {
  playerId: string;
  attributeKey: DevelopmentAttributeKey;
  confidence: EvidenceConfidence;
  direction: "POSITIVE" | "NEGATIVE" | null;
  alignedCount: number;
  contradictoryCount: number;
  distinctMatchCount: number;
  evidenceIds: string[];
  baselineAt: Date | null;
}

export interface AttributeSuggestion {
  playerId: string;
  attributeKey: DevelopmentAttributeKey;
  confidence: EvidenceConfidence;
  direction: "POSITIVE" | "NEGATIVE";
  currentValue: number | null;
  proposedValue: number | null;
  alignedCount: number;
  contradictoryCount: number;
  distinctMatchCount: number;
  evidenceIds: string[];
}

export function evaluateAttributeEvidence(
  observations: Array<{
    id: string;
    direction: string;
    observedAt: Date;
    matchId: string;
    attributeKey: string | null;
  }>,
  baselineAt: Date | null,
): AttributeEvidenceResult | null {
  const afterBaseline = baselineAt
    ? observations.filter((o) => o.observedAt > baselineAt)
    : observations;

  if (afterBaseline.length === 0) return null;

  const positive = afterBaseline.filter((o) => o.direction === "POSITIVE");
  const negative = afterBaseline.filter((o) => o.direction === "NEGATIVE");
  const aligned = positive.length >= negative.length ? positive : negative;
  const contradictory = positive.length >= negative.length ? negative : positive;

  const distinctMatchIds = new Set(afterBaseline.map((o) => o.matchId));

  const alignedCount = aligned.length;
  const contradictoryCount = contradictory.length;
  const distinctMatchCount = distinctMatchIds.size;

  let confidence: EvidenceConfidence;
  let direction: "POSITIVE" | "NEGATIVE" | null;

  if (alignedCount < 3 || distinctMatchCount < 3 || alignedCount - contradictoryCount < 2) {
    confidence = "LOW";
    direction = null;
  } else if (alignedCount >= 5 && distinctMatchCount >= 4 && contradictoryCount <= 1) {
    confidence = "HIGH";
    direction = positive.length >= negative.length ? "POSITIVE" : "NEGATIVE";
  } else {
    confidence = "MEDIUM";
    direction = positive.length >= negative.length ? "POSITIVE" : "NEGATIVE";
  }

  if (confidence === "LOW") {
    direction = null;
  }

  return {
    playerId: observations[0]?.matchId ? "" : "",
    attributeKey: observations[0]?.attributeKey as DevelopmentAttributeKey ?? "ballControl",
    confidence,
    direction,
    alignedCount,
    contradictoryCount,
    distinctMatchCount,
    evidenceIds: afterBaseline.map((o) => o.id),
    baselineAt,
  };
}

export function computeAttributeProposal(
  evidence: AttributeEvidenceResult,
  currentValue: number | null,
): AttributeSuggestion | null {
  if (evidence.confidence === "LOW" || !evidence.direction) {
    return null;
  }

  if (currentValue === null) {
    return {
      playerId: evidence.playerId,
      attributeKey: evidence.attributeKey,
      confidence: evidence.confidence,
      direction: evidence.direction,
      currentValue: null,
      proposedValue: null,
      alignedCount: evidence.alignedCount,
      contradictoryCount: evidence.contradictoryCount,
      distinctMatchCount: evidence.distinctMatchCount,
      evidenceIds: evidence.evidenceIds,
    };
  }

  const proposedValue = evidence.direction === "POSITIVE"
    ? Math.min(10, currentValue + 1)
    : Math.max(1, currentValue - 1);

  if (proposedValue === currentValue) {
    return null;
  }

  return {
    playerId: evidence.playerId,
    attributeKey: evidence.attributeKey,
    confidence: evidence.confidence,
    direction: evidence.direction,
    currentValue,
    proposedValue,
    alignedCount: evidence.alignedCount,
    contradictoryCount: evidence.contradictoryCount,
    distinctMatchCount: evidence.distinctMatchCount,
    evidenceIds: evidence.evidenceIds,
  };
}