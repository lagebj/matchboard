export type SportingLevelConfidence = "unknown" | "low" | "medium" | "high";

export interface OpponentEncounterAssessment {
  sportingLevel: number;
  gameFormat: string | null;
  matchDate: Date;
  matchId: string;
}

export interface OpponentSportingEstimate {
  opponentTeamId: string;
  estimatedLevel: number;
  confidence: SportingLevelConfidence;
  assessmentCount: number;
  lastAssessedDate: Date | null;
  historicalContext: string;
}

export const DEFAULT_CHALLENGE_MARGIN = 0.4;
export const MAX_SPORTING_LEVEL = 10.0;
export const MAX_RECENT_ENCOUNTERS = 5;

const CONFIDENCE_THRESHOLDS = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 4,
} as const;

const RECENCY_WEIGHTS = [0.35, 0.25, 0.2, 0.12, 0.08] as const;

export function calculateWeightedLevel(
  assessments: OpponentEncounterAssessment[],
  targetGameFormat: string | null,
): number {
  if (assessments.length === 0) return 0;

  const sorted = [...assessments].sort(
    (a, b) => b.matchDate.getTime() - a.matchDate.getTime(),
  );

  const recent = sorted.slice(0, MAX_RECENT_ENCOUNTERS);

  let totalWeight = 0;
  let weightedSum = 0;

  for (let i = 0; i < recent.length; i++) {
    let weight = i < RECENCY_WEIGHTS.length ? RECENCY_WEIGHTS[i] : 0.1;

    if (targetGameFormat && recent[i].gameFormat && recent[i].gameFormat === targetGameFormat) {
      weight *= 1.5;
    }

    weightedSum += recent[i].sportingLevel * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;

  const raw = weightedSum / totalWeight;
  return Math.round(raw * 10) / 10;
}

export function calculateConfidence(
  assessmentCount: number,
): SportingLevelConfidence {
  if (assessmentCount >= CONFIDENCE_THRESHOLDS.high) return "high";
  if (assessmentCount >= CONFIDENCE_THRESHOLDS.medium) return "medium";
  if (assessmentCount >= CONFIDENCE_THRESHOLDS.low) return "low";
  return "unknown";
}

export function calculateSuggestedMinimum(
  opponentLevel: number,
  challengeMargin: number = DEFAULT_CHALLENGE_MARGIN,
): number {
  const target = opponentLevel + challengeMargin;
  return Math.min(Math.round(target * 10) / 10, MAX_SPORTING_LEVEL);
}

export function generateHistoricalContext(
  estimate: OpponentSportingEstimate,
): string {
  if (estimate.assessmentCount === 0) {
    return "No previous encounters recorded.";
  }

  const parts: string[] = [];

  if (estimate.confidence === "unknown") {
    return "No comparable encounter data available.";
  } else if (estimate.confidence === "low") {
    parts.push("Limited encounter data — estimate may change with more assessments.");
  } else if (estimate.confidence === "medium") {
    parts.push("Moderate encounter data available.");
  } else {
    parts.push("Strong encounter data available.");
  }

  parts.push(
    `Estimated sporting level: ${estimate.estimatedLevel.toFixed(1)} / ${MAX_SPORTING_LEVEL.toFixed(1)}.`,
  );
  parts.push(`Based on ${estimate.assessmentCount} comparable encounter${estimate.assessmentCount !== 1 ? "s" : ""}.`);

  return parts.join(" ");
}

export function buildOpponentEstimate(
  opponentTeamId: string,
  assessments: OpponentEncounterAssessment[],
  targetGameFormat: string | null,
): OpponentSportingEstimate {
  const estimatedLevel = calculateWeightedLevel(assessments, targetGameFormat);
  const assessmentCount = assessments.length;
  const confidence = calculateConfidence(assessmentCount);
  const lastAssessedDate =
    assessmentCount > 0
      ? assessments.reduce((latest, a) =>
          a.matchDate > latest ? a.matchDate : latest,
          assessments[0].matchDate,
        )
      : null;

  const baseEstimate: OpponentSportingEstimate = {
    opponentTeamId,
    estimatedLevel,
    confidence,
    assessmentCount,
    lastAssessedDate,
    historicalContext: "",
  };

  baseEstimate.historicalContext = generateHistoricalContext(baseEstimate);

  return baseEstimate;
}

export function validateSportingLevel(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === "object" && "toNumber" in value ? Number(value) : Number(value);
  if (Number.isNaN(num)) return null;
  if (num < 1.0) return null;
  if (num > MAX_SPORTING_LEVEL) return null;
  return Math.round(num * 10) / 10;
}

export function formatSportingLevel(value: number | null): string {
  if (value === null || value === undefined) return "Not assessed";
  return `${value.toFixed(1)} / ${MAX_SPORTING_LEVEL.toFixed(1)}`;
}