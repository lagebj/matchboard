import type { PeriodConfig } from "./period-config";

export interface LiveMatchContext {
  matchType: "league" | "event";
  contextId: string;
  matchInfo: {
    id: string;
    opponent: string;
    homeAway?: string;
    gameFormat: string;
    startsAt: string;
    status: string;
    teamName: string;
    teamId: string;
    roundOrEventName: string | null;
  };
  squad: LiveMatchSquadPlayer[];
  periodConfig: PeriodConfig[];
  eventId?: string;
}

export interface LiveMatchSquadPlayer {
  playerId: string;
  playerName: string;
  position: string | null;
  shirtNumber: number | null;
  role: string;
  availability: string;
}

export interface MatchInfo {
  id: string;
  opponent: string;
  homeAway: string;
  gameFormat: string;
  startsAt: string;
  status: string;
  teamName: string;
  teamId: string;
  roundName: string | null;
}

export interface EventMatchInfo {
  id: string;
  opponentName: string;
  category: string;
  startsAt: string;
  status: string;
  squadName: string;
  eventName: string;
  gameFormat: string;
  matchDurationMinutes: number | null;
}