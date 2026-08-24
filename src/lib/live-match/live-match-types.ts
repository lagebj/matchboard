import type { LiveMatchEventType, LiveSessionStatus, LiveEventCorrectionType, MatchPeriod, FairPlayCategory, FairPlayObservationStatus, FairPlayObservationSource, RotationSource } from "@/generated/prisma/client";

export type { LiveMatchEventType, LiveSessionStatus, LiveEventCorrectionType, MatchPeriod, FairPlayCategory, FairPlayObservationStatus, FairPlayObservationSource, RotationSource };

export interface MatchClockState {
  period: MatchPeriod;
  running: boolean;
  startedAt: Date | null;
  elapsedBeforeStartMs: number;
}

export interface LiveSessionInfo {
  id: string;
  matchId: string;
  coachId: string;
  status: LiveSessionStatus;
  startedAt: Date;
  endedAt: Date | null;
  lastHeartbeatAt: Date | null;
}

export interface LiveEventInput {
  matchId: string;
  sessionId: string;
  eventType: LiveMatchEventType;
  period?: MatchPeriod;
  matchSeconds?: number;
  playerId?: string;
  secondaryPlayerId?: string;
  payload?: Record<string, unknown>;
  clientEventId: string;
  correctionType?: LiveEventCorrectionType;
  correctsEventId?: string;
}

export interface RotationInput {
  matchId: string;
  outPlayerId: string;
  inPlayerId: string;
  period: number;
  matchSeconds?: number;
  outPosition?: string;
  inPosition?: string;
  positionOnly?: boolean;
  source?: RotationSource;
  liveEventId?: string;
}

export interface FairPlayInput {
  matchId: string;
  period?: number;
  matchSeconds?: number;
  playerId?: string;
  category: FairPlayCategory;
  note?: string;
  source?: FairPlayObservationSource;
  liveEventId?: string;
}

export interface PlayerPositionInterval {
  playerId: string;
  position: string;
  startedAtMs: number;
  endedAtMs: number | null;
}

export interface LiveMatchScore {
  goalsFor: number;
  goalsAgainst: number;
}

export interface CurrentLineupEntry {
  playerId: string;
  playerName: string;
  position: string | null;
  enteredAtMs: number;
  isStarter: boolean;
}

export interface LiveMatchProjection {
  score: LiveMatchScore;
  clock: MatchClockState;
  currentLineup: CurrentLineupEntry[];
  recentEvents: LiveEventSummary[];
}

export interface LiveEventSummary {
  id: string;
  eventType: LiveMatchEventType;
  period: MatchPeriod | null;
  matchSeconds: number | null;
  wallClockTime: Date | null;
  playerId: string | null;
  secondaryPlayerId: string | null;
  isCorrected: boolean;
  isReversed: boolean;
}

export const GOAL_DETAIL_INACTIVITY_TIMEOUT_MS = 90_000;

export const MATCH_PERIOD_DURATIONS: Record<MatchPeriod, number | null> = {
  BEFORE: null,
  FIRST_HALF: 25 * 60 * 1000,
  HALF_TIME: null,
  SECOND_HALF: 25 * 60 * 1000,
  EXTRA_FIRST_HALF: 10 * 60 * 1000,
  EXTRA_HALF_TIME: null,
  EXTRA_SECOND_HALF: 10 * 60 * 1000,
  FULL_TIME: null,
};

export const MATCH_PERIOD_ORDER: MatchPeriod[] = [
  "BEFORE",
  "FIRST_HALF",
  "HALF_TIME",
  "SECOND_HALF",
  "EXTRA_FIRST_HALF",
  "EXTRA_HALF_TIME",
  "EXTRA_SECOND_HALF",
  "FULL_TIME",
];

export const FAIR_PLAY_POSITIVE_CATEGORIES: FairPlayCategory[] = [
  "HELPED_OPPONENT",
  "CHECKED_ON_INJURED_PLAYER",
  "ACCEPTED_REFEREE_DECISION",
  "ENCOURAGED_TEAMMATE",
  "CALMED_DIFFICULT_SITUATION",
  "OTHER_POSITIVE",
];

export const FAIR_PLAY_CONCERN_CATEGORIES: FairPlayCategory[] = [
  "RETALIATION",
  "ABUSIVE_LANGUAGE",
  "DISSENT_TOWARD_REFEREE",
  "TAUNTING_OR_PROVOKING",
  "DISRESPECT_TOWARD_TEAMMATE",
  "OTHER_CONCERN",
];

// GOAL_FOR deliberately excluded: live-match-client.tsx's handleGoalFor records GOAL_FOR
// immediately on tap with no playerId, then optionally records a separate SCORER_SET event once
// (if) the coach picks a scorer from the "Who scored?" sheet — "Skip" is a supported, intentional
// choice, not an error state. Requiring playerId here (as it was from this file's very first
// commit) made every anonymous-scorer goal fail server validation and get permanently stuck in
// the "Sync issue" error state — confirmed live, 2026-08-24, via E2E testing.
export const LIVE_EVENT_TYPES_THAT_REQUIRE_PLAYER: Set<LiveMatchEventType> = new Set([
  "SCORER_SET",
  "ASSIST_SET",
  "ROTATION_OUT",
  "ROTATION_IN",
  "FAIR_PLAY_POSITIVE",
  "FAIR_PLAY_CONCERN",
]);

export const LIVE_EVENT_TYPES_THAT_ARE_PERIOD_TRANSITIONS: Set<LiveMatchEventType> = new Set([
  "MATCH_START",
  "PERIOD_START",
  "PERIOD_END",
  "MATCH_END",
]);

export const LIVE_EVENT_TYPES_THAT_ARE_CORRECTABLE: Set<LiveMatchEventType> = new Set([
  "GOAL_FOR",
  "GOAL_AGAINST",
  "SCORER_SET",
  "ASSIST_SET",
  "ROTATION_OUT",
  "ROTATION_IN",
  "FAIR_PLAY_POSITIVE",
  "FAIR_PLAY_CONCERN",
  "MOMENT_MARKED",
]);