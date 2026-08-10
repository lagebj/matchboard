import { type OpponentSportingEvidence } from "@/generated/prisma/client";

export type SportingLevelConfidence = "unknown" | "low" | "medium" | "high";

export interface OpponentSportingAggregate {
  opponentTeamId: string;
  estimatedLevel: number;
  confidence: SportingLevelConfidence;
  validEncounterCount: number;
  lastEncounterDate: Date | null;
  gameFormat: string | null;
}

const HALF_LIFE_MONTHS = 6;
const CONFIDENCE_THRESHOLDS = { unknown: 0, low: 1, medium: 2, high: 4 } as const;
const WINDOW_MONTHS = 12;

export function recencyWeight(ageMonths: number): number {
  return 0.5 ** (ageMonths / HALF_LIFE_MONTHS);
}

export function classifyConfidence(count: number): SportingLevelConfidence {
  if (count >= CONFIDENCE_THRESHOLDS.high) return "high";
  if (count >= CONFIDENCE_THRESHOLDS.medium) return "medium";
  if (count >= CONFIDENCE_THRESHOLDS.low) return "low";
  return "unknown";
}

export function aggregateSportingLevel(
  evidence: OpponentSportingEvidence[],
  referenceDate: Date = new Date(),
  targetGameFormat: string | null = null,
): OpponentSportingAggregate | null {
  const valid = evidence.filter((e) => {
    if (e.excludedAt != null) return false;
    const ageMs = referenceDate.getTime() - e.occurredAt.getTime();
    const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30.44);
    if (ageMonths > WINDOW_MONTHS) return false;
    return true;
  });

  const filtered = targetGameFormat
    ? valid.filter((e) => e.gameFormat === targetGameFormat || e.gameFormat == null)
    : valid;

  if (filtered.length === 0) {
    return null;
  }

  let totalWeight = 0;
  let weightedSum = 0;
  let lastEncounterDate: Date = filtered[0].occurredAt;

  for (const e of filtered) {
    const ageMs = referenceDate.getTime() - e.occurredAt.getTime();
    const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30.44);
    let weight = recencyWeight(ageMonths);

    if (targetGameFormat && e.gameFormat === targetGameFormat) {
      weight *= 1.5;
    }

    const estimate = Number(e.estimate);
    weightedSum += estimate * weight;
    totalWeight += weight;

    if (e.occurredAt > lastEncounterDate) {
      lastEncounterDate = e.occurredAt;
    }
  }

  if (totalWeight === 0) {
    return null;
  }

  const estimatedLevel = Math.round((weightedSum / totalWeight) * 10) / 10;
  const confidence = classifyConfidence(filtered.length);

  return {
    opponentTeamId: filtered[0].opponentTeamId,
    estimatedLevel,
    confidence,
    validEncounterCount: filtered.length,
    lastEncounterDate,
    gameFormat: targetGameFormat,
  };
}

export { calculateEncounterEstimate, FORMULA_VERSION } from "./sporting-level-calculation";