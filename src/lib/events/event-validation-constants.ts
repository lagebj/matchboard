import type { EventType, GameFormat, EventPlayerStatus, EventSquadIntent, EventSelectionPattern } from "@/generated/prisma/client";

export const VALID_EVENT_TYPES: EventType[] = ["CUP", "TOURNAMENT", "FRIENDLY_DAY", "OTHER"];
export const VALID_GAME_FORMATS: GameFormat[] = ["THREE_A_SIDE", "FIVE_A_SIDE", "SEVEN_A_SIDE", "NINE_A_SIDE", "ELEVEN_A_SIDE"];
export const VALID_EVENT_PLAYER_STATUSES: EventPlayerStatus[] = ["AVAILABLE", "UNAVAILABLE", "UNKNOWN", "RESERVE", "LATE_ADDITION", "WITHDRAWN"];
export const VALID_SQUAD_INTENTS: EventSquadIntent[] = ["COMPETITIVE", "BALANCED", "MANUAL"];
export const VALID_SELECTION_PATTERNS: EventSelectionPattern[] = ["ALL_BALANCED", "ONE_COMPETITIVE_BALANCED_REMAINDER", "MANUAL_SEED_AUTO_BALANCE", "PRESERVE_AND_FILL"];

export function parseEnum<T extends string>(value: string | null | undefined, validValues: readonly T[], defaultValue: T): T {
  if (!value) return defaultValue;
  if (validValues.includes(value as T)) return value as T;
  return defaultValue;
}

export function isValidEventStatus(status: string): status is EventPlayerStatus {
  return VALID_EVENT_PLAYER_STATUSES.includes(status as EventPlayerStatus);
}

// 1 (default, single continuous "Match" period) or 2 (First half/Half time/Second half). See
// getEventPeriodConfig (src/lib/live-match/period-config.ts) and Event.numberOfHalves.
export const VALID_NUMBER_OF_HALVES = [1, 2] as const;

export function parseNumberOfHalves(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : value ? parseInt(value, 10) : NaN;
  return VALID_NUMBER_OF_HALVES.includes(parsed as 1 | 2) ? parsed : 1;
}

export function requireValidEventStatus(status: string): EventPlayerStatus {
  if (!isValidEventStatus(status)) {
    throw new Error(`Invalid event player status: ${status}`);
  }
  return status as EventPlayerStatus;
}