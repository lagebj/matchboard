import { type ReadinessSignalType, type ReadinessSignalValue } from "@/lib/coaching/types";

export type ReadinessSignalEntry = {
  playerId: string;
  signalType: ReadinessSignalType;
  value: ReadinessSignalValue;
};

type SignalScoreMap = Partial<Record<ReadinessSignalValue, number>>;

const READINESS_SCORE_MODIFIERS: Record<ReadinessSignalType, SignalScoreMap> = {
  EFFORT_TREND: { RISING: 3, STABLE: 0, FALLING: -4 },
  ATTENDANCE_RELIABILITY: { HIGH: 2, MEDIUM: 0, LOW: -3 },
  LEARNING_BEHAVIOR: { STRONG: 2, OK: 0, NEEDS_ATTENTION: -3 },
  TEAM_FIRST_BEHAVIOR: { STRONG: 2, OK: 0, NEEDS_ATTENTION: -4 },
  RESET_AFTER_ERROR_RELIABILITY: { STRONG: 2, OK: 0, NEEDS_ATTENTION: -3 },
  COACH_TRUST: { HIGH: 2, MEDIUM: 0, LOW: -3 },
};

export function getReadinessScoreModifier(
  playerId: string,
  signals: ReadinessSignalEntry[],
): number {
  const playerSignals = signals.filter((s) => s.playerId === playerId);
  if (playerSignals.length === 0) return 0;

  let totalModifier = 0;
  for (const signal of playerSignals) {
    const signalModifiers = READINESS_SCORE_MODIFIERS[signal.signalType];
    if (!signalModifiers) continue;
    const modifier = signalModifiers[signal.value];
    if (modifier !== undefined) {
      totalModifier += modifier;
    }
  }

  return totalModifier;
}

export function getNegativeReadinessSignals(
  playerId: string,
  signals: ReadinessSignalEntry[],
): ReadinessSignalEntry[] {
  const negativeValues: Set<ReadinessSignalValue> = new Set(["FALLING", "LOW", "NEEDS_ATTENTION"]);
  return signals.filter(
    (s) => s.playerId === playerId && negativeValues.has(s.value),
  );
}

export function hasNegativeReadiness(
  playerId: string,
  signals: ReadinessSignalEntry[],
): boolean {
  return getNegativeReadinessSignals(playerId, signals).length > 0;
}

export function getReadinessSignalTypes(): ReadinessSignalType[] {
  return Object.keys(READINESS_SCORE_MODIFIERS) as ReadinessSignalType[];
}

export { READINESS_SCORE_MODIFIERS };